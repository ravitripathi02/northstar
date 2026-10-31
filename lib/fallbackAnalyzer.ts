import { detectPatterns } from "@/lib/patternDetector";
import { classifySeverityFromStats } from "@/lib/severityEngine";
import type { IncidentAnalysis, RecommendedActionItem, RootCauseItem } from "@/types/incident";

export function buildFallbackAnalysis(logText: string, parsed: any): IncidentAnalysis {
  const repeated = parsed.repeatedErrors || [];
  const recommendations: RecommendedActionItem[] = [
    { priority: "P1", action: "Validate database connectivity and pool limits", reason: "Database connection failures are the most repeated signal in the supplied logs." },
    { priority: "P2", action: "Review payment gateway and external dependency health", reason: "Timeouts and HTTP 500 responses indicate upstream dependency instability or request saturation." },
    { priority: "P3", action: "Inspect retry and backoff behavior", reason: "Repeated retries can increase load and degrade service availability if not throttled effectively." },
  ];

  const rootCauses: RootCauseItem[] = [];
  if (parsed.databaseFailures > 0) {
    rootCauses.push({
      cause: "Database connectivity or pool exhaustion",
      evidence: repeated.some((entry: any) => /database|connection|pool|refused/i.test(entry.message))
        ? "Repeated connection refused, pool exhaustion, and query timeout events were observed in the logs."
        : "Database-related errors were present in the provided log set.",
      hypothesis: "The application may be failing to establish or retain database connections, causing transaction errors and downstream API failures.",
      confidence: "High",
    });
  }
  if (parsed.apiTimeouts > 0) {
    rootCauses.push({
      cause: "Dependency timeout or degraded upstream service",
      evidence: parsed.apiTimeouts > 0 ? `Timeout and retry behavior occurred ${parsed.apiTimeouts} times.` : "No clear timeout evidence was found.",
      hypothesis: "Slow or failing upstream dependencies may be causing the observed request timeouts and 500 responses.",
      confidence: "Medium",
    });
  }

  const severity = classifySeverityFromStats({
    totalEntries: parsed.totalEntries,
    errorCount: parsed.errorCount,
    warningCount: parsed.warningCount,
    databaseFailures: parsed.databaseFailures,
    apiTimeouts: parsed.apiTimeouts,
    http500Count: parsed.http500Count,
    connectionRefusedCount: parsed.connectionRefusedCount,
    relatedFailures: parsed.relatedFailures || [],
  });

  const titleBase = parsed.errorCount > 0 ? "Operational incident detected" : "No active incident";
  const incidentTitle = parsed.errorCount > 0 ? `${titleBase}: ${parsed.databaseFailures > 0 ? "database and dependency failures" : "service reliability issue"}` : "Healthy application state";

  const analysis: IncidentAnalysis = {
    id: `fallback-${Date.now()}`,
    createdAt: new Date().toISOString(),
    incidentTitle,
    severity: severity.severity,
    confidence: "Medium",
    executiveSummary:
      parsed.errorCount > 0
        ? `The logs show repeated ${parsed.errorCount} error events, including database and timeout issues, suggesting service degradation or a partial outage.`
        : "The supplied logs do not show error patterns or severe service disruption.",
    keyErrors:
      repeated.slice(0, 5).map((entry: any) => ({
        message: entry.message,
        count: entry.count,
        service: entry.service || "unknown-service",
        evidence: `Appeared ${entry.count} times in the log data.`,
      })) || [],
    patterns: detectPatterns(parsed),
    probableRootCauses: rootCauses,
    potentialImpact: parsed.errorCount > 0
      ? [
          "Customer-facing transactions may fail or time out if dependency issues persist.",
          "Application availability may degrade for users impacted by the failing dependency or database path.",
          "Operational teams may see elevated retry volume and support incidents during the event window.",
        ]
      : ["No active customer impact is evident from the provided logs."],
    recommendedActions: recommendations,
    escalationRequired: parsed.errorCount > 0,
    escalationTeams: parsed.errorCount > 0 ? ["Application Engineering", "Database Team", "Infrastructure/DevOps"] : [],
    escalationReason:
      parsed.errorCount > 0
        ? "Repeated application and database failures warrant coordinated investigation across service and infrastructure owners."
        : "No incident escalation is necessary based on the supplied logs.",
    incidentReport:
      parsed.errorCount > 0
        ? `Summary: ${severity.reason}. Observed ${parsed.errorCount} errors across the log set, with repeated database and timeout incidents. Recommended actions: verify connection health, inspect dependency status, and verify retry policies.`
        : "Summary: No significant incident evidence detected; no active operational issue is indicated by this log set.",
    totalEntries: parsed.totalEntries,
    errors: parsed.errorCount,
    warnings: parsed.warningCount,
    source: "fallback",
    note: "Operational review used because the live analysis provider was unavailable.",
  };

  return analysis;
}
