import { Paperclip, PlayCircle, Trash2, UploadCloud, Wand2 } from "lucide-react";
import { useRef, useState } from "react";

interface LogInputProps {
  value: string;
  onChange: (text: string) => void;
  onAnalyze: () => void;
  onLoadSample: (name: string) => void;
  onClear: () => void;
  isLoading: boolean;
  totalEntries: number;
  errorText?: string;
}

const sampleOptions = [
  { label: "Payment API failures", value: "payment-errors" },
  { label: "Database connectivity", value: "database-errors" },
  { label: "Healthy application", value: "healthy-logs" },
];

export function LogInput({ value, onChange, onAnalyze, onLoadSample, onClear, isLoading, totalEntries, errorText }: LogInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedSample, setSelectedSample] = useState("payment-errors");

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/\.(log|txt)$/i.test(file.name)) {
      alert("Unsupported file type. Please upload a .log or .txt file.");
      return;
    }

    const text = await file.text();
    onChange(text);
    event.target.value = "";
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Log input</h2>
          <p className="text-sm text-slate-500">Paste logs or upload a file for analysis</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-700">{totalEntries} entries</span>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {sampleOptions.map((sample) => (
          <button
            key={sample.value}
            type="button"
            onClick={() => {
              setSelectedSample(sample.value);
              onLoadSample(sample.value);
            }}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              selectedSample === sample.value
                ? "border-sky-200 bg-sky-50 text-sky-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {sample.label}
          </button>
        ))}
      </div>

      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Paste log lines here..."
        className="min-h-[280px] w-full rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
      />

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <UploadCloud className="h-4 w-4" />
            Upload .log/.txt
          </button>
          <input ref={inputRef} type="file" accept=".log,.txt,text/plain" className="hidden" onChange={handleFileUpload} />
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </button>
        </div>

        <button
          type="button"
          onClick={onAnalyze}
          disabled={isLoading || !value.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isLoading ? <Wand2 className="h-4 w-4 animate-pulse" /> : <PlayCircle className="h-4 w-4" />}
          {isLoading ? "Analyzing..." : "Start analysis"}
        </button>
      </div>

      {errorText ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorText}</div> : null}
      <div className="mt-3 text-xs text-slate-500">Supports timestamps, INFO/WARN/ERROR/DEBUG, services, HTTP status codes, exceptions, and related failure patterns.</div>
    </div>
  );
}
