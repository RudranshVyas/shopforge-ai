import { useState } from "react";

const CONFIDENCE_STAMP = {
  high: "stamp-high",
  medium: "stamp-medium",
  low: "stamp-low",
};

function Highlighted({ text, quote }) {
  const at = quote ? text.toLowerCase().indexOf(quote.toLowerCase()) : -1;
  if (at === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, at)}
      <mark className="evidence-mark">{text.slice(at, at + quote.length)}</mark>
      {text.slice(at + quote.length)}
    </span>
  );
}

function ReviewBody({ review, quote }) {
  return (
    <div className="mt-2 rounded border border-dashed border-[var(--color-rule)] bg-paper p-3 font-body text-[13px] leading-relaxed text-ink-soft">
      <p className="field-label mb-1.5 normal-case">
        {review.title || "(no title)"} — ★{review.rating} · {review.helpful_vote} helpful
      </p>
      <Highlighted text={review.text} quote={quote} />
    </div>
  );
}

export default function AnswerCard({ result }) {
  // Keyed by position, not review_id: the model may cite two different quotes
  // from the same review.
  const [openIdx, setOpenIdx] = useState(null);
  const reviewById = Object.fromEntries(result.reviews.map((r) => [r.review_id, r]));

  if (result.response_type === "fallback") {
    return (
      <div className="paper-card paper-card--fold reveal overflow-hidden p-6">
        <div className="flex items-start justify-between gap-4">
          <p className="field-label">Field report</p>
          <span className="stamp-reject stamp-animate shrink-0">Insufficient evidence</span>
        </div>
        <p className="lede mt-5 font-body text-[15px] leading-relaxed text-ink">{result.answer}</p>
        <p className="field-label mt-4">No model was consulted for this response.</p>
      </div>
    );
  }

  if (result.response_type === "retrieval_only") {
    return (
      <div className="paper-card paper-card--fold reveal p-6">
        <p className="field-label mb-1">Exhibits on file</p>
        <p className="font-display text-lg text-ink italic">
          {result.reviews.length} matching reviews
        </p>
        <div className="ruled-divider mt-3 space-y-2 pt-3">
          {result.reviews.map((r) => (
            <ReviewBody key={r.review_id} review={r} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="paper-card paper-card--fold reveal p-6">
      <div className="flex items-start justify-between gap-4">
        <p className="field-label">Field report</p>
        <span className={`stamp stamp-animate ${CONFIDENCE_STAMP[result.confidence] ?? ""}`}>
          {result.confidence} confidence
        </span>
      </div>

      <p className="lede mt-3 font-body text-[15px] leading-relaxed text-ink">{result.answer}</p>

      <div className="ruled-divider mt-5 grid gap-5 pt-5 sm:grid-cols-2">
        <div>
          <p className="field-label mb-1.5 flex items-center gap-1.5 text-[color:var(--color-stamp-green)]">
            <span className="inline-block h-2 w-2 bg-[color:var(--color-stamp-green)]" />
            Exhibit: strengths
          </p>
          <ul className="space-y-1 text-sm text-ink-soft">
            {result.positives.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="field-label mb-1.5 flex items-center gap-1.5 text-[color:var(--color-stamp-red)]">
            <span className="inline-block h-2 w-2 bg-[color:var(--color-stamp-red)]" />
            Exhibit: weaknesses
          </p>
          <ul className="space-y-1 text-sm text-ink-soft">
            {result.complaints.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      {result.recommendation && (
        <p className="ruled-divider mt-5 pt-4 text-sm text-ink-soft">
          <span className="field-label mr-2 text-ink">Field recommendation —</span>
          {result.recommendation}
        </p>
      )}

      <div className="ruled-divider mt-5 pt-4">
        <p className="field-label mb-2">Verified citations ({result.citations.length})</p>
        <div className="flex flex-wrap gap-2">
          {result.citations.map((c, i) => (
            <button
              key={`${c.review_id}-${i}`}
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
              className={`tag-btn ${openIdx === i ? "is-active" : ""}`}
            >
              {c.review_id} ★{c.rating}
            </button>
          ))}
        </div>
        {openIdx !== null && reviewById[result.citations[openIdx].review_id] && (
          <ReviewBody
            review={reviewById[result.citations[openIdx].review_id]}
            quote={result.citations[openIdx].quote}
          />
        )}
      </div>
    </div>
  );
}
