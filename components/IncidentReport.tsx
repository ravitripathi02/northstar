import { Download, Copy } from "lucide-react";
import type { IncidentAnalysis } from "@/types/incident";

export function IncidentReport({ analysis }: { analysis: IncidentAnalysis }) {
  const handleCopy = async () => {
    await navigator.clipboard.writeText(analysis.incidentReport);
  };

  const handleDownload = () => {
    const blob = new Blob([analysis.incidentReport], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${analysis.incidentTitle.replace(/\s+/g, "-").toLowerCase()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-900">Incident report</h3>
        <div className="flex gap-2">
          <button type="button" onClick={handleCopy} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Copy className="h-4 w-4" />
            Copy Report
          </button>
          <button type="button" onClick={handleDownload} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
            <Download className="h-4 w-4" />
            Download Report
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700 whitespace-pre-wrap">
        {analysis.incidentReport}
      </div>
    </div>
  );
}
