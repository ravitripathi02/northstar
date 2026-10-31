export type Severity = "Critical" | "High" | "Medium" | "Low";
export type Confidence = "High" | "Medium" | "Low";
export type AnalysisSource = "gemini" | "openrouter" | "fallback";
export type Priority = "P1" | "P2" | "P3";

export interface LogEntry {
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "DEBUG" | "TRACE" | "UNKNOWN";
  service: string;
  message: string;
  raw: string;
  statusCode?: number;
  isError: boolean;
  isWarning: boolean;
}

export interface ParsedLogsResult {
  totalEntries: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  debugCount: number;
  services: Record<string, number>;
  statusCodes: Record<string, number>;
  timeline: Array<{ label: string; errors: number; warnings: number }>;
  repeatedErrors: Array<{ message: string; count: number; service: string }>;
  relatedFailures: string[];
  databaseFailures: number;
  apiTimeouts: number;
  http500Count: number;
  connectionRefusedCount: number;
  brokenLines: number;
  sampleEntries: string[];
}

export interface PatternItem {
  pattern: string;
  observation: string;
  significance: string;
}

export interface KeyErrorItem {
  message: string;
  count: number;
  service: string;
  evidence: string;
}

export interface RootCauseItem {
  cause: string;
  evidence: string;
  hypothesis: string;
  confidence: Confidence;
}

export interface RecommendedActionItem {
  priority: Priority;
  action: string;
  reason: string;
}

export interface IncidentAnalysis {
  id: string;
  createdAt: string;
  incidentTitle: string;
  severity: Severity;
  confidence: Confidence;
  executiveSummary: string;
  keyErrors: KeyErrorItem[];
  patterns: PatternItem[];
  probableRootCauses: RootCauseItem[];
  potentialImpact: string[];
  recommendedActions: RecommendedActionItem[];
  escalationRequired: boolean;
  escalationTeams: string[];
  escalationReason: string;
  incidentReport: string;
  totalEntries: number;
  errors: number;
  warnings: number;
  source: AnalysisSource;
  note?: string;
}

export interface GeminiCandidate {
  content?: {
    parts?: Array<{ text?: string }>;
  };
}

export interface GeminiResponse {
  candidates?: GeminiCandidate[];
}
