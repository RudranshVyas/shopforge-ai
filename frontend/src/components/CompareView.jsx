import { useState } from "react";
import ProductSearch from "./ProductSearch.jsx";

const CONFIDENCE_STAMP = {
  high: "stamp-high",
  medium: "stamp-medium",
  low: "stamp-low",
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
    <div className="card p-6">
      <p className="label-caps">{label}</p>
      <p className="mt-1.5 line-clamp-2 font-display text-[15px] text-ink italic">
        {side.title ?? side.parent_asin}
      </p>

      <hr className="hairline my-4" />

      <p className="label-caps mb-2 flex items-center gap-2 text-[color:var(--color-moss)]">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--color-moss)]" />
        Strengths
      </p>
      <ul className="space-y-1.5 text-sm leading-relaxed text-ink-soft">
        {side.strengths.length === 0 && <li className="opacity-50">—</li>}
        {side.strengths.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>

      <p className="label-caps mt-4 mb-2 flex items-center gap-2 text-[color:var(--color-clay)]">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--color-clay)]" />
        Weaknesses
      </p>
      <ul className="space-y-1.5 text-sm leading-relaxed text-ink-soft">
        {side.weaknesses.length === 0 && <li className="opacity-50">—</li>}
        {side.weaknesses.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {side.citations.map((c, i) => (
          <button
            key={`${c.review_id}-${i}`}
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
            className={`tag ${openIdx === i ? "is-active" : ""}`}
          >
            {c.review_id} ★{c.rating}
          </button>
        ))}
      </div>

      {open && reviewById[open.review_id] && (
        <p className="card-sunk reveal mt-3 p-4 text-[13.5px] leading-relaxed text-ink-soft">
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
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          ["First product", a, setA],
          ["Second product", b, setB],
        ].map(([label, value, setValue]) => (
          <div key={label} className="card p-6">
            <p className="label-caps">{label}</p>
            {value ? (
              <div className="mt-2">
                <p className="line-clamp-2 font-display text-sm text-ink italic">{value.title}</p>
                <button
                  onClick={() => setValue(null)}
                  className="label mt-2 text-clay hover:opacity-70"
                >
                  change →
                </button>
              </div>
            ) : (
              <div className="mt-3">
                <ProductSearch onSelect={setValue} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card p-7">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
          className="flex items-center gap-2.5"
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={a && b ? "Ask a comparison question…" : "Pick both products first"}
            disabled={!a || !b}
            className="field"
          />
          <button type="submit" disabled={!a || !b || loading} className="btn">
            {loading ? "Comparing…" : "Compare"}
          </button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              disabled={!a || !b || loading}
              className="chip"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {result && result.response_type === "fallback" && (
        <div className="card reveal p-7">
          <div className="flex items-start justify-between gap-4">
            <p className="label-caps">Verdict</p>
            <span className="stamp-reject stamp-animate shrink-0">Not enough evidence</span>
          </div>
          <p className="lede mt-5 text-[15px] leading-relaxed text-ink">{result.verdict}</p>
          <p className="label mt-5">No comparison was generated.</p>
        </div>
      )}

      {result && result.response_type === "comparison" && (
        <>
          <div className="card reveal p-7">
            <div className="flex items-start justify-between gap-4">
              <p className="label-caps">Verdict</p>
              <span
                className={`stamp stamp-animate shrink-0 ${CONFIDENCE_STAMP[result.confidence] ?? ""}`}
              >
                {result.confidence} confidence
              </span>
            </div>
            <p className="lede mt-4 text-[15.5px] leading-relaxed text-ink">{result.verdict}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Side side={result.product_a} label="First product" />
            <Side side={result.product_b} label="Second product" />
          </div>
        </>
      )}
    </div>
  );
}
