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
    <div className="paper-card p-5">
      <p className="field-label">{label}</p>
      <p className="mt-1 line-clamp-2 font-display text-base text-ink italic">
        {side.title ?? side.parent_asin}
      </p>

      <p className="field-label mt-3 flex items-center gap-1.5 text-[color:var(--color-stamp-green)]">
        <span className="inline-block h-1.5 w-1.5 bg-[color:var(--color-stamp-green)]" />
        Strengths
      </p>
      <ul className="mt-1 space-y-1 text-sm text-ink-soft">
        {side.strengths.length === 0 && <li className="text-ink-faint">—</li>}
        {side.strengths.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>

      <p className="field-label mt-3 flex items-center gap-1.5 text-[color:var(--color-stamp-red)]">
        <span className="inline-block h-1.5 w-1.5 bg-[color:var(--color-stamp-red)]" />
        Weaknesses
      </p>
      <ul className="mt-1 space-y-1 text-sm text-ink-soft">
        {side.weaknesses.length === 0 && <li className="text-ink-faint">—</li>}
        {side.weaknesses.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>

      <div className="ruled-divider mt-3 flex flex-wrap gap-1.5 pt-3">
        {side.citations.map((c, i) => (
          <button
            key={`${c.review_id}-${i}`}
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
            className={`tag-btn ${openIdx === i ? "is-active" : ""}`}
          >
            {c.review_id} ★{c.rating}
          </button>
        ))}
      </div>

      {open && reviewById[open.review_id] && (
        <p className="mt-2 rounded border border-dashed border-[var(--color-rule)] bg-paper p-3 text-[13px] leading-relaxed text-ink-soft">
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
          ["Subject A", a, setA],
          ["Subject B", b, setB],
        ].map(([label, value, setValue]) => (
          <div key={label} className="paper-card p-5">
            <p className="field-label">{label}</p>
            {value ? (
              <div className="mt-2">
                <p className="line-clamp-2 font-display text-sm text-ink italic">{value.title}</p>
                <button
                  onClick={() => setValue(null)}
                  className="field-label mt-1.5 text-stamp-red underline decoration-dashed underline-offset-2"
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

      <div className="paper-card p-6">
        <p className="field-label mb-1.5">File a comparison query</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
          className="flex items-end gap-3"
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={a && b ? "Ask a comparison question…" : "Pick both subjects first"}
            disabled={!a || !b}
            className="dossier-input"
          />
          <button type="submit" disabled={!a || !b || loading} className="btn-stamp">
            {loading ? "Comparing…" : "Compare"}
          </button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={s}
              onClick={() => ask(s)}
              disabled={!a || !b || loading}
              className="tag-btn"
              style={{ transform: `rotate(${[-1, 0.6, -0.4][i % 3]}deg)` }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {result && result.response_type === "fallback" && (
        <div className="paper-card paper-card--fold reveal overflow-hidden p-6">
          <div className="flex items-start justify-between gap-4">
            <p className="field-label">Verdict</p>
            <span className="stamp-reject stamp-animate shrink-0">Insufficient evidence</span>
          </div>
          <p className="lede mt-5 text-[15px] leading-relaxed text-ink">{result.verdict}</p>
          <p className="field-label mt-4">No comparison was generated.</p>
        </div>
      )}

      {result && result.response_type === "comparison" && (
        <>
          <div className="paper-card paper-card--fold reveal p-6">
            <div className="flex items-start justify-between gap-4">
              <p className="field-label">Verdict</p>
              <span
                className={`stamp stamp-animate ${CONFIDENCE_STAMP[result.confidence] ?? ""}`}
              >
                {result.confidence} confidence
              </span>
            </div>
            <p className="lede mt-3 text-[15px] leading-relaxed text-ink">{result.verdict}</p>
          </div>
          <div className="reveal grid gap-4 sm:grid-cols-2">
            <Side side={result.product_a} label="Subject A" />
            <Side side={result.product_b} label="Subject B" />
          </div>
        </>
      )}
    </div>
  );
}
