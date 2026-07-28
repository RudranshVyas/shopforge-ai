import { useState } from "react";

const CONFIDENCE_STYLE = {
  high: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-rose-100 text-rose-800",
};

function Highlighted({ text, quote }) {
  const at = quote ? text.toLowerCase().indexOf(quote.toLowerCase()) : -1;
  if (at === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, at)}
      <mark className="bg-amber-200">{text.slice(at, at + quote.length)}</mark>
      {text.slice(at + quote.length)}
    </span>
  );
}

function ReviewBody({ review, quote }) {
  return (
    <div className="mt-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
      <p className="mb-1 font-medium text-slate-900">
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
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm font-medium text-slate-700">Not enough evidence</p>
        <p className="mt-1 text-sm text-slate-600">{result.answer}</p>
        <p className="mt-2 text-xs text-slate-400">No LLM call was made.</p>
      </div>
    );
  }

  if (result.response_type === "retrieval_only") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-medium text-slate-900">
          {result.reviews.length} matching reviews
        </p>
        <div className="mt-3 space-y-2">
          {result.reviews.map((r) => (
            <ReviewBody key={r.review_id} review={r} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm leading-relaxed text-slate-800">{result.answer}</p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            CONFIDENCE_STYLE[result.confidence] ?? "bg-slate-100 text-slate-700"
          }`}
        >
          {result.confidence} confidence
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-emerald-700 uppercase">
            What works
          </p>
          <ul className="mt-1 space-y-1 text-sm text-slate-700">
            {result.positives.map((item, i) => (
              <li key={i}>+ {item}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-rose-700 uppercase">Complaints</p>
          <ul className="mt-1 space-y-1 text-sm text-slate-700">
            {result.complaints.map((item, i) => (
              <li key={i}>− {item}</li>
            ))}
          </ul>
        </div>
      </div>

      {result.recommendation && (
        <p className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-700">
          <span className="font-medium">Recommendation: </span>
          {result.recommendation}
        </p>
      )}

      <div className="mt-4">
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Verified citations ({result.citations.length})
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {result.citations.map((c, i) => (
            <button
              key={`${c.review_id}-${i}`}
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
              className={`rounded-full border px-3 py-1 font-mono text-xs ${
                openIdx === i
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 text-slate-600 hover:border-slate-400"
              }`}
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
