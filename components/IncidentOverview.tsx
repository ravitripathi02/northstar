import { Activity, BadgeAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import type { IncidentAnalysis } from "@/types/incident";

export function IncidentOverview({ analysis }: { analysis: IncidentAnalysis }) {
  const toneMap = {
    Critical: "bg-rose-100 text-rose-700 ring-rose-200",
    High: "bg-orange-100 text-orange-700 ring-orange-200",
    Medium: "bg-amber-100 text-amber-700 ring-amber-200",
    Low: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  };

  const ConfidenceIcon = analysis.confidence === "High" ? ShieldCheck : analysis.confidence === "Medium" ? Activity : BadgeAlert;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.08em] text-slate-500">Incident overview</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">{analysis.incidentTitle}</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${toneMap[analysis.severity]}`}>
            <TriangleAlert className="h-3.5 w-3.5" />
            {analysis.severity}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
            <ConfidenceIcon className="h-3.5 w-3.5" />
            {analysis.confidence} confidence
          </span>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-600">{analysis.executiveSummary}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total entries</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">{analysis.totalEntries}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Errors</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">{analysis.errors}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Warnings</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">{analysis.warnings}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Source</p>
          <p className="mt-2 text-xl font-semibold text-slate-900 capitalize">{analysis.source}</p>
        </div>
      </div>
    </div>
  );
}
