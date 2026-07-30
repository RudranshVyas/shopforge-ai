import { useEffect, useState } from "react";

const PIPELINE = [
  ["Planner", false],
  ["Retriever", false],
  ["Evidence", false],
  ["Gate", true],
  ["Generator", false],
  ["Validator", false],
];

const PRINCIPLES = [
  {
    title: "Evidence first",
    body: "A strength gate blocks the model when the evidence is thin, so a weak match returns a plain answer instead of a confident guess.",
  },
  {
    title: "Two kinds of search",
    body: "FAISS vectors and BM25 keywords are merged by Reciprocal Rank Fusion — their raw scores aren't on the same scale, so ranks get fused instead.",
  },
  {
    title: "Every quote checked",
    body: "Each citation is matched back to its source review. Anything that can't be verified gets dropped, and the confidence drops with it.",
  },
];

export default function LandingPanel({ onSelect }) {
  const [featured, setFeatured] = useState([]);

  useEffect(() => {
    fetch("/api/v1/products?limit=6")
      .then((r) => r.json())
      .then(setFeatured)
      .catch(() => setFeatured([]));
  }, []);

  return (
    <div className="space-y-5">
      <section className="card reveal p-8">
        <h2 className="max-w-xl font-display text-[2rem] leading-[1.15] font-medium text-ink italic">
          Ask a question. Get an answer you can check.
        </h2>
        <p className="lede mt-4 max-w-2xl text-[15.5px] leading-relaxed text-ink-soft">
          ShopForge reads real Amazon reviews and answers questions about a product, then shows
          you the reviews it used, the exact quote it pulled from each one, and every decision
          it made along the way.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-2">
          {PIPELINE.map(([step, isGate], i) => (
            <span key={step} className="flex items-center gap-2">
              <span className={`pipe-node ${isGate ? "pipe-node-gate" : ""}`}>{step}</span>
              {i < PIPELINE.length - 1 && (
                <span className="text-ink-soft opacity-30">→</span>
              )}
            </span>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {PRINCIPLES.map((p, i) => (
          <div
            key={p.title}
            className="card card-hover reveal p-5"
            style={{ animationDelay: `${90 + i * 80}ms` }}
          >
            <p className="font-display text-[16px] font-medium text-ink italic">{p.title}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{p.body}</p>
          </div>
        ))}
      </section>

      <section className="card reveal p-7" style={{ animationDelay: "260ms" }}>
        <p className="label-caps mb-1">Start with one of these</p>
        {featured.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft italic">Loading products…</p>
        ) : (
          <ul className="mt-3 space-y-1">
            {featured.map((p) => (
              <li key={p.parent_asin}>
                <button
                  onClick={() => onSelect(p)}
                  className="group flex w-full items-center gap-4 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-card-sunk"
                >
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 block text-sm text-ink">{p.title}</span>
                    <span className="label mt-0.5 block">
                      ★ {p.average_rating ?? "—"} · {p.rating_number ?? 0} ratings
                      {p.price ? ` · $${p.price}` : ""}
                    </span>
                  </span>
                  <span className="label shrink-0 text-clay opacity-0 transition-opacity group-hover:opacity-100">
                    Open →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
