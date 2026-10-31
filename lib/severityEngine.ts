import type { Severity } from "@/types/incident";

export function classifySeverityFromStats(stats: {
  totalEntries: number;
  errorCount: number;
  warningCount: number;
  databaseFailures: number;
  apiTimeouts: number;
  http500Count: number;
  connectionRefusedCount: number;
  relatedFailures: string[];
}): { severity: Severity; reason: string } {
  const points =
    stats.databaseFailures * 3 +
    stats.apiTimeouts * 2 +
    stats.http500Count * 2 +
    stats.connectionRefusedCount * 2 +
    stats.errorCount;

  if (
    stats.relatedFailures.length >= 2 &&
    (stats.databaseFailures > 0 || stats.apiTimeouts > 0 || stats.http500Count > 0) &&
    points >= 12
  ) {
    return {
      severity: "Critical",
      reason: "Multiple core services are failing with repeated database and API errors, indicating a widespread outage or severe degradation.",
    };
  }

  if (
    stats.databaseFailures >= 3 ||
    stats.apiTimeouts >= 3 ||
    stats.http500Count >= 4 ||
    points >= 8
  ) {
    return {
      severity: "High",
      reason: "Repeated failures and recoverable routing issues suggest significant service impact affecting critical functionality.",
    };
  }

  if (stats.errorCount > 0 && stats.errorCount <= 4) {
    return {
      severity: "Medium",
      reason: "Intermittent errors are present but appear limited and recoverable based on the available log evidence.",
    };
  }

  return {
    severity: "Low",
    reason: "No material service impact is evident from the logs; only isolated warnings or minor errors were observed.",
  };
}

export function describeSeveritySelection(severity: Severity, impactUnknown?: boolean): string {
  if (impactUnknown) {
    return `Severity set to ${severity} based on technical evidence in the logs rather than confirmed business impact.`;
  }
  return `Severity set to ${severity} based on current log evidence and observed incident patterns.`;
}
