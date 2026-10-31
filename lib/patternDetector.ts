import type { ParsedLogsResult } from "@/types/incident";

export function detectPatterns(result: ParsedLogsResult) {
  const repeated = result.repeatedErrors.slice(0, 5);
  const activities: Array<{ pattern: string; observation: string; significance: string }> = [];

  if (repeated.length > 0) {
    activities.push({
      pattern: "Repeated failures",
      observation: repeated
        .slice(0, 3)
        .map((item) => `${item.message} (${item.count}x)`)
        .join(", "),
      significance: "Multiple retries or repeated errors indicate a persistent failure mode rather than a one-off issue.",
    });
  }

  if (result.databaseFailures > 0) {
    activities.push({
      pattern: "Database connectivity issues",
      observation: `Detected ${result.databaseFailures} database related failures and ${result.connectionRefusedCount} connection refused signals.`,
      significance: "Database issues are likely blocking application transactions or API responsiveness and can amplify user-facing failures.",
    });
  }

  if (result.apiTimeouts > 0) {
    activities.push({
      pattern: "Timeouts and slow dependencies",
      observation: `Observed ${result.apiTimeouts} timeout events and ${result.http500Count} HTTP 500 responses.`,
      significance: "Latency or dependency instability appears to be contributing to request failures and elevated retry rates.",
    });
  }

  if (result.relatedFailures.length > 0) {
    activities.push({
      pattern: "Related failures",
      observation: result.relatedFailures.join("; "),
      significance: "These events point to a common root cause or shared dependency chain across services.",
    });
  }

  if (activities.length === 0) {
    activities.push({
      pattern: "Healthy operations",
      observation: "No significant operational issues were detected in the supplied logs.",
      significance: "This indicates that the application is operating within normal thresholds for the provided log set.",
    });
  }

  return activities;
}
