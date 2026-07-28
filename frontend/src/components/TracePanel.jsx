import { useState } from "react";

export default function TracePanel({ result }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="paper-card reveal">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left"
      >
        <span className="field-label text-ink">
          Chain of custody — {result.agent_trace.length} steps · {result.latency_ms} ms
        </span>
        <span className="field-label flex items-center gap-2">
          <span
            className={
              result.llm_called ? "text-[color:var(--color-stamp-green)]" : "text-ink-faint"
            }
          >
            {result.llm_called ? "model consulted" : "no model call"}
          </span>
          <span className="text-ink-faint">{open ? "[ – ]" : "[ + ]"}</span>
        </span>
      </button>

      {open && (
        <ol className="ruled-divider space-y-0 px-6 pt-1 pb-5">
          {result.agent_trace.map((step, i) => (
            <li
              key={i}
              className="relative border-l border-dashed border-[var(--color-rule)] py-4 pl-6 last:pb-0"
            >
              <span className="absolute top-[1.4rem] -left-[5px] h-2.5 w-2.5 rotate-45 border border-ink bg-paper-raised" />
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-xs font-semibold tracking-wide text-ink uppercase">
                  {step.agent}
                </span>
                <span className="font-mono text-xs tabular-nums text-ink-faint">
                  {step.duration_ms} ms
                </span>
              </div>
              <p className="mt-0.5 font-body text-[13px] text-ink-soft italic">{step.summary}</p>
              {Object.keys(step.details).length > 0 && (
                <details className="mt-1.5">
                  <summary className="field-label inline cursor-pointer text-ink-faint hover:text-ink">
                    Raw log
                  </summary>
                  <pre className="mt-1 overflow-x-auto rounded border border-[var(--color-rule)] bg-paper p-2.5 font-mono text-[11px] leading-relaxed text-ink-soft">
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
