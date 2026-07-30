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
    <div className="card-sunk reveal mt-3 p-4 text-[13.5px] leading-relaxed text-ink-soft">
      <p className="label mb-1.5 text-ink">
        {review.title || "(no title)"} · ★{review.rating} · {review.helpful_vote} helpful
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
      <div className="card reveal p-7">
        <div className="flex items-start justify-between gap-4">
          <p className="label-caps">Answer</p>
          <span className="stamp-reject stamp-animate shrink-0">Not enough evidence</span>
        </div>
        <p className="lede mt-5 text-[15px] leading-relaxed text-ink">{result.answer}</p>
        <p className="label mt-5">The model was never called for this one.</p>
      </div>
    );
  }

  if (result.response_type === "retrieval_only") {
    return (
      <div className="card reveal p-7">
        <p className="label-caps">Matching reviews</p>
        <p className="mt-1.5 font-display text-xl text-ink italic">
          {result.reviews.length} found
        </p>
        <div className="mt-4 space-y-2.5">
          {result.reviews.map((r) => (
            <ReviewBody key={r.review_id} review={r} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card reveal p-7">
      <div className="flex items-start justify-between gap-4">
        <p className="label-caps">Answer</p>
        <span className={`stamp stamp-animate shrink-0 ${CONFIDENCE_STAMP[result.confidence] ?? ""}`}>
          {result.confidence} confidence
        </span>
      </div>

      <p className="lede mt-4 text-[15.5px] leading-relaxed text-ink">{result.answer}</p>

      <hr className="hairline my-6" />

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="label-caps mb-2 flex items-center gap-2 text-[color:var(--color-moss)]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--color-moss)]" />
            What works
          </p>
          <ul className="space-y-1.5 text-sm leading-relaxed text-ink-soft">
            {result.positives.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="label-caps mb-2 flex items-center gap-2 text-[color:var(--color-clay)]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--color-clay)]" />
            What doesn't
          </p>
          <ul className="space-y-1.5 text-sm leading-relaxed text-ink-soft">
            {result.complaints.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      {result.recommendation && (
        <>
          <hr className="hairline my-6" />
          <p className="text-sm leading-relaxed text-ink-soft">
            <span className="label-caps mr-2 text-ink">Verdict</span>
            {result.recommendation}
          </p>
        </>
      )}

      <hr className="hairline my-6" />

      <p className="label-caps mb-2.5">
        Verified citations · {result.citations.length}
      </p>
      <div className="flex flex-wrap gap-2">
        {result.citations.map((c, i) => (
          <button
            key={`${c.review_id}-${i}`}
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
            className={`tag ${openIdx === i ? "is-active" : ""}`}
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
  );
}
