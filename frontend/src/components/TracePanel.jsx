import { useState } from "react";

export default function TracePanel({ result }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <span className="text-sm font-medium text-slate-800">
          Agent trace · {result.agent_trace.length} steps · {result.latency_ms} ms
        </span>
        <span className="text-xs text-slate-500">
          {result.llm_called ? "LLM called" : "no LLM call"} {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <ol className="border-t border-slate-100 px-5 py-3">
          {result.agent_trace.map((step, i) => (
            <li key={i} className="relative border-l border-slate-200 pb-4 pl-5 last:pb-0">
              <span className="absolute top-1.5 -left-[5px] h-2.5 w-2.5 rounded-full bg-slate-900" />
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-xs font-semibold text-slate-900">{step.agent}</span>
                <span className="text-xs text-slate-400">{step.duration_ms} ms</span>
              </div>
              <p className="text-xs text-slate-600">{step.summary}</p>
              {Object.keys(step.details).length > 0 && (
                <pre className="mt-1 overflow-x-auto rounded bg-slate-50 p-2 text-[11px] text-slate-500">
                  {JSON.stringify(step.details, null, 2)}
                </pre>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
