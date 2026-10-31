"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, ShieldAlert, Sparkles } from "lucide-react";
import { IncidentOverview } from "@/components/IncidentOverview";
import { IncidentReport } from "@/components/IncidentReport";
import { LogInput } from "@/components/LogInput";
import { RecommendedActions } from "@/components/RecommendedActions";
import { RootCauseAnalysis } from "@/components/RootCauseAnalysis";
import { countLogEntries, parseLogLines } from "@/lib/logParser";
import type { IncidentAnalysis } from "@/types/incident";

const SAMPLE_FILES: Record<string, string> = {
  "payment-errors": "/samples/payment-errors.log",
  "database-errors": "/samples/database-errors.log",
  "healthy-logs": "/samples/healthy-logs.log",
};

export default function HomePage() {
  const [logs, setLogs] = useState("");
  const [analysis, setAnalysis] = useState<IncidentAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [analysisSource, setAnalysisSource] = useState<string>("manual");

  const totalEntries = useMemo(() => countLogEntries(logs), [logs]);

  async function loadSample(name: string) {
    const url = SAMPLE_FILES[name];
    if (!url) return;
    const response = await fetch(url);
    const text = await response.text();
    setLogs(text);
    setErrorText("");
  }

  async function runAnalysis() {
    if (!logs.trim()) {
      setErrorText("Please provide log content or upload a file before running the analysis.");
      return;
    }

    const parsed = parseLogLines(logs);
    if (parsed.result.totalEntries === 0) {
      setErrorText("No valid log entries detected. Please check the input format.");
      return;
    }

    setLoading(true);
    setErrorText("");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logs }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Analysis failed.");
      }

      const nextAnalysis = payload.analysis as IncidentAnalysis;
      nextAnalysis.totalEntries = parsed.result.totalEntries;
      nextAnalysis.errors = parsed.result.errorCount;
      nextAnalysis.warnings = parsed.result.warningCount;
      nextAnalysis.source = payload.source || "fallback";
      if (payload.source === "fallback") {
        nextAnalysis.note = payload.fallbackReason || "The live analysis provider was unavailable, so the built-in diagnostic review was used instead.";
      }
      setAnalysis(nextAnalysis);
      setAnalysisSource(payload.source || "fallback");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected analysis error.";
      setErrorText(message);
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }

  const resetAll = () => {
    setLogs("");
    setAnalysis(null);
    setErrorText("");
    setAnalysisSource("manual");
  };

  const providerLabel =
    analysisSource === "gemini"
      ? "Gemini AI"
      : analysisSource === "openrouter"
        ? "OpenRouter AI"
        : analysisSource === "fallback"
          ? "Fallback review"
          : "Ready for analysis";

  return (
    <main className="min-h-screen bg-slate-100 text-slate-800">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.14em] text-slate-500">Northstar Ops</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Incident Response Console</h1>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-600">
              <Sparkles className="h-4 w-4 text-sky-600" />
              {providerLabel}
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
            Review application telemetry, isolate recurring failure patterns, and coordinate response actions across engineering and operations teams.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <LogInput
            value={logs}
            onChange={setLogs}
            onAnalyze={runAnalysis}
            onLoadSample={loadSample}
            onClear={resetAll}
            isLoading={loading}
            totalEntries={totalEntries}
            errorText={errorText}
          />
        </section>

        {loading ? (
          <div className="mt-6 flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-sm font-medium text-slate-600 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
            Analyzing logs and correlating related failures...
          </div>
        ) : null}

        {!analysis && !loading && logs.trim() ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 shadow-sm">
            <ShieldAlert className="mx-auto mb-3 h-6 w-6 text-slate-400" />
            Ready for analysis. Submit the logs to detect incidents and recommended actions.
          </div>
        ) : null}

        {analysis ? (
          <div className="mt-8 space-y-6">
            {analysis.source === "fallback" ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">
                <span className="font-semibold">Diagnostic review:</span> the live analysis provider was unavailable, so this assessment used the built-in operational review.
              </div>
            ) : null}

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <IncidentOverview analysis={analysis} />
            </section>

            <section className="grid gap-5 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Total logs</p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">{analysis.totalEntries}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Errors</p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">{analysis.errors}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Warnings</p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">{analysis.warnings}</p>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Key errors</h2>
                {analysis.keyErrors.length ? (
                  <ul className="mt-4 space-y-3">
                    {analysis.keyErrors.map((item, index) => (
                      <li key={`${item.message}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-slate-900">{item.message}</p>
                          <span className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-white">{item.count}x</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">Service: {item.service}</p>
                        <p className="mt-1 text-sm text-slate-600">Evidence: {item.evidence}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-slate-600">No repeated error signatures were detected in the supplied log set.</p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Detected patterns</h2>
                {analysis.patterns.length ? (
                  <ul className="mt-4 space-y-3">
                    {analysis.patterns.map((pattern, index) => (
                      <li key={`${pattern.pattern}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="font-medium text-slate-900">{pattern.pattern}</p>
                        <p className="mt-2 text-sm text-slate-600">Observation: {pattern.observation}</p>
                        <p className="mt-1 text-sm text-slate-600">Significance: {pattern.significance}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-slate-600">No distinct failure patterns were observed.</p>
                )}
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Probable root causes</h2>
                <div className="mt-4">
                  <RootCauseAnalysis analysis={analysis} />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Potential impact</h2>
                <ul className="mt-4 space-y-3">
                  {analysis.potentialImpact.map((impact, index) => (
                    <li key={`${impact}-${index}`} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{impact}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Recommended troubleshooting steps</h2>
                <div className="mt-4">
                  <RecommendedActions analysis={analysis} />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Escalation recommendation</h2>
                <div className="mt-4 space-y-4">
                  <p className="text-sm leading-6 text-slate-600">
                    {analysis.escalationRequired
                      ? `Escalation is recommended to: ${analysis.escalationTeams.join(", ")}.`
                      : "Escalation does not appear necessary from the current logs."}
                  </p>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    <span className="font-medium text-slate-800">Reason:</span> {analysis.escalationReason}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Incident report</h2>
                <button
                  type="button"
                  onClick={resetAll}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <ArrowRight className="h-4 w-4" />
                  Analyze another log
                </button>
              </div>
              <div className="mt-4">
                <IncidentReport analysis={analysis} />
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
