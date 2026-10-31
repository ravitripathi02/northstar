import { parseLogLines } from "@/lib/logParser";
import type { IncidentAnalysis } from "@/types/incident";

const MAX_LOG_CHARS = 4000;
const REQUEST_TIMEOUT_MS = 20000;
const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-latest"];
const OPENROUTER_MODELS = Array.from(
  new Set([
    process.env.OPENROUTER_MODEL,
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
  ].filter(Boolean) as string[]),
);

const DEFAULT_PROMPT = `You are an experienced Site Reliability Engineer investigating application logs. Identify and explain the likely issue using only the supplied evidence. Do not invent evidence. Distinguish correlation from causation. If the logs do not provide enough evidence, say so explicitly. Return valid JSON only with this schema:
{
  "incidentTitle": "string",
  "severity": "Critical | High | Medium | Low",
  "confidence": "High | Medium | Low",
  "executiveSummary": "string",
  "keyErrors": [{ "message": "string", "count": 0, "service": "string", "evidence": "string" }],
  "patterns": [{ "pattern": "string", "observation": "string", "significance": "string" }],
  "probableRootCauses": [{ "cause": "string", "evidence": "string", "hypothesis": "string", "confidence": "High | Medium | Low" }],
  "potentialImpact": ["string"],
  "recommendedActions": [{ "priority": "P1 | P2 | P3", "action": "string", "reason": "string" }],
  "escalationRequired": true,
  "escalationTeams": ["string"],
  "escalationReason": "string",
  "incidentReport": "string"
}`;

function trimLogsForAi(rawText: string): string {
  const lines = rawText.split(/\r?\n/);
  const selected = lines.filter((line) => /ERROR|WARN|FAIL|TIMEOUT|EXCEPTION|CRITICAL|DB|DATABASE|HTTP 5\d\d|connection refused/i.test(line));
  const combined = (selected.length ? selected : lines).slice(0, 80).join("\n");
  return combined.slice(0, MAX_LOG_CHARS);
}

function cleanJsonText(raw: string): string {
  return raw.replace(/```json|```/gi, "").trim();
}

function buildIncidentAnalysis(parsed: Partial<IncidentAnalysis>, result: ReturnType<typeof parseLogLines>["result"], source: "gemini" | "openrouter"): IncidentAnalysis {
  return {
    id: `${source}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    incidentTitle: parsed.incidentTitle || "Incident analysis",
    severity: parsed.severity || "Medium",
    confidence: parsed.confidence || "Medium",
    executiveSummary: parsed.executiveSummary || "AI analysis completed using the supplied logs.",
    keyErrors: parsed.keyErrors || [],
    patterns: parsed.patterns || [],
    probableRootCauses: parsed.probableRootCauses || [],
    potentialImpact: parsed.potentialImpact || ["Impact cannot be confirmed from the supplied logs."],
    recommendedActions: parsed.recommendedActions || [],
    escalationRequired: !!parsed.escalationRequired,
    escalationTeams: parsed.escalationTeams || [],
    escalationReason: parsed.escalationReason || "Escalation considered based on log evidence.",
    incidentReport: parsed.incidentReport || "No incident report generated.",
    totalEntries: result.totalEntries,
    errors: result.errorCount,
    warnings: result.warningCount,
    source,
  } as IncidentAnalysis;
}

function extractTextFromResponse(data: any): string {
  const candidateText = data?.candidates?.[0]?.content?.parts?.map((part: any) => part.text).join("\n") || "";
  if (candidateText) return candidateText;

  const choicesText = data?.choices?.[0]?.message?.content;
  if (typeof choicesText === "string") return choicesText;
  if (Array.isArray(choicesText)) {
    return choicesText.map((part: any) => typeof part === "string" ? part : part?.text || "").join("\n");
  }

  return "";
}

async function analyzeWithGoogle(rawText: string): Promise<IncidentAnalysis | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const { result } = parseLogLines(rawText);
  const compactPayload = JSON.stringify({
    summary: {
      totalEntries: result.totalEntries,
      errors: result.errorCount,
      warnings: result.warningCount,
      services: result.services,
      statusCodes: result.statusCodes,
      repeatedErrors: result.repeatedErrors.slice(0, 8),
      relatedFailures: result.relatedFailures.slice(0, 8),
      databaseFailures: result.databaseFailures,
      apiTimeouts: result.apiTimeouts,
      http500Count: result.http500Count,
      connectionRefusedCount: result.connectionRefusedCount,
    },
    logs: trimLogsForAi(rawText),
  });

  let lastError: Error | null = null;

  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: `${DEFAULT_PROMPT}\n\nIncident data:\n${compactPayload}` }],
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        const text = await response.text();
        lastError = new Error(`Gemini API request failed for ${model}: ${response.status} ${text}`);
        (lastError as Error & { status?: number }).status = response.status;

        if (response.status !== 404) {
          throw lastError;
        }

        continue;
      }

      const data = await response.json();
      const candidateText = extractTextFromResponse(data);

      if (!candidateText) {
        throw new Error("Gemini API returned an empty response.");
      }

      const parsed: Partial<IncidentAnalysis> = JSON.parse(cleanJsonText(candidateText));
      return buildIncidentAnalysis(parsed, result, "gemini");
    } catch (error) {
      lastError = error as Error;
      if ((error as Error & { status?: number })?.status === 404) {
        continue;
      }

      if ((error as Error & { status?: number })?.status === 429 || (error as Error & { status?: number })?.status === 500 || (error as Error & { status?: number })?.status === 503) {
        throw error;
      }

      if ((error as Error).name === "AbortError") {
        const timeoutError = new Error("Gemini request timed out.");
        (timeoutError as Error & { status?: number }).status = 504;
        throw timeoutError;
      }

      if (error instanceof SyntaxError) {
        continue;
      }

      throw error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return null;
}

async function analyzeWithOpenRouter(rawText: string): Promise<IncidentAnalysis | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const { result } = parseLogLines(rawText);
  const compactPayload = JSON.stringify({
    summary: {
      totalEntries: result.totalEntries,
      errors: result.errorCount,
      warnings: result.warningCount,
      services: result.services,
      statusCodes: result.statusCodes,
      repeatedErrors: result.repeatedErrors.slice(0, 8),
      relatedFailures: result.relatedFailures.slice(0, 8),
      databaseFailures: result.databaseFailures,
      apiTimeouts: result.apiTimeouts,
      http500Count: result.http500Count,
      connectionRefusedCount: result.connectionRefusedCount,
    },
    logs: trimLogsForAi(rawText),
  });

  let lastError: Error | null = null;

  for (const model of OPENROUTER_MODELS) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "X-Title": "Northstar Ops",
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: DEFAULT_PROMPT },
            { role: "user", content: `Incident data:\n${compactPayload}` },
          ],
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        const error = new Error(`OpenRouter request failed for ${model}: ${response.status} ${text}`);
        (error as Error & { status?: number }).status = response.status;

        if (response.status === 404) {
          lastError = error;
          continue;
        }

        throw error;
      }

      const data = await response.json();
      const rawContent = extractTextFromResponse(data);
      if (!rawContent) {
        throw new Error("OpenRouter returned an empty response.");
      }

      const parsed: Partial<IncidentAnalysis> = JSON.parse(cleanJsonText(rawContent));
      return buildIncidentAnalysis(parsed, result, "openrouter");
    } catch (error) {
      const err = error as Error & { status?: number };
      lastError = err;
      if (err?.status === 404) {
        continue;
      }
      if (err?.status === 429 || err?.status === 500 || err?.status === 503) {
        throw err;
      }
      if (err?.name === "AbortError") {
        const timeoutError = new Error("OpenRouter request timed out.");
        (timeoutError as Error & { status?: number }).status = 504;
        throw timeoutError;
      }
      throw error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return null;
}

export async function analyzeWithGemini(rawText: string): Promise<IncidentAnalysis | null> {
  const preferredProvider = (process.env.AI_PROVIDER || "gemini").toLowerCase();

  if (preferredProvider === "openrouter") {
    const openRouterResult = await analyzeWithOpenRouter(rawText);
    if (openRouterResult) return openRouterResult;
    return analyzeWithGoogle(rawText);
  }

  try {
    const googleResult = await analyzeWithGoogle(rawText);
    if (googleResult) return googleResult;
  } catch (error) {
    console.warn("Gemini provider failed; trying OpenRouter fallback.", error);
  }

  return analyzeWithOpenRouter(rawText);
}

export function safelyParseGeminiJson(raw: string): any {
  const cleaned = cleanJsonText(raw);
  return JSON.parse(cleaned);
}

export function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY);
}
