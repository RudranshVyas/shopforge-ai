import { useState } from "react";
import ProductSearch from "./ProductSearch.jsx";

const CONFIDENCE_STYLE = {
  high: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-rose-100 text-rose-800",
};

const SUGGESTIONS = [
  "Which one is better built?",
  "Which charges faster?",
  "Which has fewer complaints?",
];

function Side({ side, label }) {
  const [openIdx, setOpenIdx] = useState(null);
  const reviewById = Object.fromEntries(side.reviews.map((r) => [r.review_id, r]));
  const open = openIdx === null ? null : side.citations[openIdx];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">{label}</p>
      <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-900">
        {side.title ?? side.parent_asin}
      </p>

      <p className="mt-3 text-xs font-semibold tracking-wide text-emerald-700 uppercase">
        Strengths
      </p>
      <ul className="mt-1 space-y-1 text-sm text-slate-700">
        {side.strengths.length === 0 && <li className="text-slate-400">—</li>}
        {side.strengths.map((s, i) => (
          <li key={i}>+ {s}</li>
        ))}
      </ul>

      <p className="mt-3 text-xs font-semibold tracking-wide text-rose-700 uppercase">
        Weaknesses
      </p>
      <ul className="mt-1 space-y-1 text-sm text-slate-700">
        {side.weaknesses.length === 0 && <li className="text-slate-400">—</li>}
        {side.weaknesses.map((s, i) => (
          <li key={i}>− {s}</li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {side.citations.map((c, i) => (
          <button
            key={`${c.review_id}-${i}`}
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
            className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${
              openIdx === i
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 text-slate-600 hover:border-slate-400"
            }`}
          >
            {c.review_id} ★{c.rating}
          </button>
        ))}
      </div>

      {open && reviewById[open.review_id] && (
        <p className="mt-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
          {reviewById[open.review_id].text}
        </p>
      )}
    </div>
  );
}

export default function CompareView({ onResult, loading, result }) {
  const [a, setA] = useState(null);
  const [b, setB] = useState(null);
  const [question, setQuestion] = useState("");

  function ask(text) {
    if (!a || !b || !text.trim() || loading) return;
    setQuestion(text);
    onResult(text, a.parent_asin, b.parent_asin);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ["Product A", a, setA],
          ["Product B", b, setB],
        ].map(([label, value, setValue]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
              {label}
            </p>
            {value ? (
              <div className="mt-2">
                <p className="line-clamp-2 text-sm text-slate-800">{value.title}</p>
                <button
                  onClick={() => setValue(null)}
                  className="mt-1 text-xs text-slate-500 underline hover:text-slate-800"
                >
                  change
                </button>
              </div>
            ) : (
              <div className="mt-2">
                <ProductSearch onSelect={setValue} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
          className="flex gap-2"
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={a && b ? "Ask a comparison question…" : "Pick both products first"}
            disabled={!a || !b}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm outline-none focus:border-slate-900 disabled:bg-slate-50"
          />
          <button
            type="submit"
            disabled={!a || !b || loading}
            className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? "Comparing…" : "Compare"}
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              disabled={!a || !b || loading}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:border-slate-400 hover:text-slate-900 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {result && result.response_type === "fallback" && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-medium text-slate-700">Not enough evidence to compare</p>
          <p className="mt-1 text-sm text-slate-600">{result.verdict}</p>
          <p className="mt-2 text-xs text-slate-400">No comparison was generated.</p>
        </div>
      )}

      {result && result.response_type === "comparison" && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm leading-relaxed text-slate-800">{result.verdict}</p>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  CONFIDENCE_STYLE[result.confidence] ?? "bg-slate-100 text-slate-700"
                }`}
              >
                {result.confidence} confidence
              </span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Side side={result.product_a} label="Product A" />
            <Side side={result.product_b} label="Product B" />
          </div>
        </>
      )}
    </div>
  );
}
