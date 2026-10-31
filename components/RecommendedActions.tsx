import type { IncidentAnalysis } from "@/types/incident";

export function RecommendedActions({ analysis }: { analysis: IncidentAnalysis }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Recommended actions</h3>
      <div className="mt-4 space-y-3">
        {analysis.recommendedActions.map((action) => (
          <div key={`${action.priority}-${action.action}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">{action.priority}</span>
              <span className="text-sm font-medium text-slate-900">{action.action}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{action.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
