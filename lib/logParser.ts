import type { LogEntry, ParsedLogsResult } from "@/types/incident";

const LOG_LEVELS = ["ERROR", "WARN", "INFO", "DEBUG", "TRACE"] as const;

function normalizeDate(raw: string): string {
  if (!raw) return "";
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return raw;
}

function unwrapLogPayload(line: string): string {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) return trimmed;

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const nestedLog = typeof parsed.log === "string" ? parsed.log : "";
    if (nestedLog.trim()) return nestedLog.trim();
  } catch {
    // Ignore invalid JSON wrappers and use the original line.
  }

  return trimmed;
}

export function parseLogLines(rawText: string): { entries: LogEntry[]; result: ParsedLogsResult; rawLines: string[] } {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => unwrapLogPayload(line).trim())
    .filter(Boolean);

  const entries: LogEntry[] = [];
  const services: Record<string, number> = {};
  const statusCodes: Record<string, number> = {};
  const timelineMap = new Map<string, { errors: number; warnings: number }>();
  const repeatedErrors = new Map<string, { count: number; service: string }>();
  const relatedFailures = new Set<string>();

  let errorCount = 0;
  let warningCount = 0;
  let infoCount = 0;
  let debugCount = 0;
  let databaseFailures = 0;
  let apiTimeouts = 0;
  let http500Count = 0;
  let connectionRefusedCount = 0;

  const brokenLines = lines.filter((line) => !/\b(INFO|WARN|ERROR|DEBUG|TRACE)\b/i.test(line)).length;

  for (const line of lines) {
    const payloadLine = unwrapLogPayload(line);
    const timestampMatch = payloadLine.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)/);
    const levelMatch = payloadLine.match(/\b(INFO|WARN|ERROR|DEBUG|TRACE)\b/i);
    const serviceMatch = payloadLine.match(/\b([a-zA-Z0-9_.-]+(?:-service|-api|api|service))\b/i);
    const statusCodeMatch = payloadLine.match(/HTTP\s+(\d{3})|status\s+(\d{3})|statusCode\s*[:=]\s*(\d{3})/i);
    const normalizedLevel = (levelMatch?.[1] || "UNKNOWN").toUpperCase() as LogEntry["level"];
    const timestamp = timestampMatch ? normalizeDate(timestampMatch[1]) : "";
    const service = serviceMatch?.[1] || "unknown-service";
    const statusCode = (() => {
      const match = statusCodeMatch || [];
      const code = Number(match[1] || match[2] || match[3] || 0);
      return Number.isFinite(code) && code > 0 ? code : undefined;
    })();

    const message = payloadLine
      .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\b/g, "")
      .replace(/\b(INFO|WARN|ERROR|DEBUG|TRACE)\b/gi, "")
      .replace(/\b([a-zA-Z0-9_.-]+(?:-service|-api|api|service))\b/gi, "")
      .replace(/\bHTTP\s+\d{3}\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    const isError = normalizedLevel === "ERROR" || /error|exception|failed|timeout|refused|unavailable|fatal/i.test(message);
    const isWarning = normalizedLevel === "WARN" || /warn|retry|backoff|degradation/i.test(message);

    if (service) {
      services[service] = (services[service] || 0) + 1;
    }

    if (statusCode) {
      statusCodes[String(statusCode)] = (statusCodes[String(statusCode)] || 0) + 1;
      if (statusCode === 500) http500Count += 1;
    }

    const tsKey = timestamp ? timestamp.slice(0, 16) : "unknown";
    const current = timelineMap.get(tsKey) || { errors: 0, warnings: 0 };
    if (isError) current.errors += 1;
    if (isWarning) current.warnings += 1;
    timelineMap.set(tsKey, current);

    if (isError) {
      errorCount += 1;
      if (/connection refused|refused|pool exhausted|unable to connect|sqlstate\[08006\]|failed to acquire connection/i.test(message)) {
        databaseFailures += 1;
        connectionRefusedCount += /refused|connection refused|unable to connect/i.test(message) ? 1 : 0;
      }
      if (/timeout|timed out|deadline exceeded|after \d+ms/i.test(message)) {
        apiTimeouts += 1;
      }
      const errorKey = message.toLowerCase();
      if (errorKey) {
        const value = repeatedErrors.get(errorKey) || { count: 0, service };
        value.count += 1;
        value.service = service;
        repeatedErrors.set(errorKey, value);
      }
      if (/db|database|postgres|sql|pool|mysql|connection/i.test(message)) {
        relatedFailures.add("Database connectivity and query failures");
      }
      if (/api|gateway|http 500|timeout|payment|processor/i.test(message)) {
        relatedFailures.add("API and upstream dependency failures");
      }
      if (/service|instance|health|unavailable/i.test(message)) {
        relatedFailures.add("Service degradation and availability interruptions");
      }
    }

    if (isWarning) {
      warningCount += 1;
    }

    if (normalizedLevel === "INFO") {
      infoCount += 1;
    }
    if (normalizedLevel === "DEBUG") {
      debugCount += 1;
    }

    entries.push({
      timestamp,
      level: normalizedLevel,
      service,
      message,
      raw: line,
      statusCode,
      isError,
      isWarning,
    });
  }

  const timeline = Array.from(timelineMap.entries())
    .map(([label, value]) => ({ label, ...value }))
    .slice(-20);

  const repeatedErrorsList = Array.from(repeatedErrors.entries())
    .map(([message, value]) => ({
      message: message.trim(),
      count: value.count,
      service: value.service,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const result: ParsedLogsResult = {
    totalEntries: entries.length,
    errorCount,
    warningCount,
    infoCount,
    debugCount,
    services,
    statusCodes,
    timeline,
    repeatedErrors: repeatedErrorsList,
    relatedFailures: Array.from(relatedFailures),
    databaseFailures,
    apiTimeouts,
    http500Count,
    connectionRefusedCount,
    brokenLines,
    sampleEntries: lines.slice(0, 8),
  };

  return { entries, result, rawLines: lines };
}

export function countLogEntries(rawText: string): number {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;
}

export function extractServices(rawText: string): string[] {
  const unique = new Set<string>();
  const matches = rawText.matchAll(/\b([a-zA-Z0-9_.-]+(?:-service|-api|api|service))\b/gi);
  for (const match of matches) {
    const value = match[1]?.trim();
    if (value) unique.add(value);
  }
  return Array.from(unique).slice(0, 10);
}

export function detectLogLevel(line: string): LogEntry["level"] {
  const match = line.match(/\b(INFO|WARN|ERROR|DEBUG|TRACE)\b/i);
  return (match?.[1]?.toUpperCase() || "UNKNOWN") as LogEntry["level"];
}

export function findRepeatedErrorMessages(rawText: string): Array<{ message: string; count: number }> {
  const patterns = new Map<string, number>();
  for (const line of rawText.split(/\r?\n/)) {
    if (!line) continue;
    const match = line.match(/(?:ERROR|WARN|INFO|DEBUG|TRACE)\s+[^\s]+\s+(.*)/i);
    const message = match?.[1]?.trim() || line.trim();
    if (/error|failed|timeout|refused|exception/i.test(message)) {
      patterns.set(message.toLowerCase(), (patterns.get(message.toLowerCase()) || 0) + 1);
    }
  }

  return Array.from(patterns.entries())
    .map(([message, count]) => ({ message, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

export function getErrorSignature(message: string): string {
  return message
    .replace(/\d+/g, "X")
    .replace(/https?:\/\/[^\s]+/g, "URL")
    .replace(/\b[a-f0-9]{8,}\b/gi, "ID")
    .trim();
}

export const LOG_LEVELS_LIST = LOG_LEVELS;
