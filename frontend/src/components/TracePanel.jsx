import { useState } from "react";

export default function TracePanel({ result }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-7 py-5 text-left transition-colors hover:bg-card-sunk"
      >
        <span className="label text-ink">
          How this answer was built · {result.agent_trace.length} steps · {result.latency_ms} ms
        </span>
        <span className="label flex items-center gap-2.5">
          <span
            className={
              result.llm_called ? "text-[color:var(--color-moss)]" : "text-[color:var(--color-honey)]"
            }
          >
            {result.llm_called ? "model used" : "no model call"}
          </span>
          <span
            className="inline-block transition-transform duration-300"
            style={{ transform: open ? "rotate(180deg)" : "none" }}
          >
            ⌄
          </span>
        </span>
      </button>

      {open && (
        <ol className="reveal space-y-0 px-7 pb-6">
          {result.agent_trace.map((step, i) => (
            <li key={i} className="relative py-4 pl-7">
              {i < result.agent_trace.length - 1 && (
                <span className="absolute top-6 bottom-0 left-[5px] w-px bg-[var(--color-line)]" />
              )}
              <span className="absolute top-[1.35rem] left-0 h-2.5 w-2.5 rounded-full border-2 border-[var(--color-clay)] bg-card" />
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-xs font-medium text-ink">{step.agent}</span>
                <span className="font-mono text-xs tabular-nums text-ink-soft opacity-70">
                  {step.duration_ms} ms
                </span>
              </div>
              <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft italic">
                {step.summary}
              </p>
              {Object.keys(step.details).length > 0 && (
                <details className="mt-2">
                  <summary className="label inline cursor-pointer hover:text-ink">
                    details
                  </summary>
                  <pre className="card-sunk mt-2 overflow-x-auto p-3 font-mono text-[11px] leading-relaxed text-ink-soft">
                    {JSON.stringify(step.details, null, 2)}
                  </pre>
                </details>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
