import type { IncidentAnalysis } from "@/types/incident";

export function RootCauseAnalysis({ analysis }: { analysis: IncidentAnalysis }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Root cause analysis</h3>
      <div className="mt-4 space-y-4">
        {analysis.probableRootCauses.length ? (
          analysis.probableRootCauses.map((cause, index) => (
            <div key={`${cause.cause}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-semibold text-slate-900">{cause.cause}</h4>
                <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-700">{cause.confidence}</span>
              </div>
              <p className="mt-2 text-sm text-slate-600"><span className="font-medium text-slate-800">Evidence:</span> {cause.evidence}</p>
              <p className="mt-2 text-sm text-slate-600"><span className="font-medium text-slate-800">Hypothesis:</span> {cause.hypothesis}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-600">No concrete root cause could be inferred from the current logs alone.</p>
        )}
      </div>
    </div>
  );
}
