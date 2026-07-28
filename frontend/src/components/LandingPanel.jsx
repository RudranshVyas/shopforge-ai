import { useEffect, useState } from "react";

const PIPELINE = [
  ["QueryPlanner", false],
  ["Retriever", false],
  ["EvidenceSelector", false],
  ["Gate", true],
  ["InsightGenerator", false],
  ["Validator", false],
];

const PRINCIPLES = [
  {
    title: "Retrieval before generation",
    body: "A strength gate blocks the model entirely when the evidence is thin — weak retrieval returns a deterministic answer instead of a confident guess.",
    rotate: -1.1,
  },
  {
    title: "Hybrid search, fused by rank",
    body: "FAISS dense vectors and BM25 keyword scores are merged with Reciprocal Rank Fusion, because their raw scores are not on comparable scales.",
    rotate: 0.7,
  },
  {
    title: "Every quote is checked",
    body: "Each citation is fuzzy-matched back to its source review. What cannot be verified gets dropped, and the confidence is capped when it is.",
    rotate: -0.5,
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
      <section className="paper-card paper-card--fold reveal p-7">
        <p className="field-label mb-2">Case overview</p>
        <h2 className="font-display text-[1.7rem] leading-[1.15] font-medium text-ink italic">
          Ask a question. Get an answer you can check.
        </h2>
        <p className="lede mt-3 max-w-2xl font-body text-[15px] leading-relaxed text-ink-soft">
          ShopForge reads real Amazon reviews and answers questions about a product — then
          shows you the reviews it used, the quote it pulled from each one, and every decision
          the pipeline made on the way there.
        </p>

        <div className="ruled-divider mt-6 flex flex-wrap items-center gap-1.5 pt-5">
          {PIPELINE.map(([step, isGate], i) => (
            <span key={step} className="flex items-center gap-1.5">
              <span
                className={`rounded px-2 py-1 font-mono text-[11px] tracking-wide uppercase ${
                  isGate
                    ? "border border-stamp-amber text-stamp-amber"
                    : "border border-[var(--color-rule)] text-ink-soft"
                }`}
              >
                {step}
              </span>
              {i < PIPELINE.length - 1 && <span className="text-ink-faint">···&gt;</span>}
            </span>
          ))}
        </div>
      </section>

      <section className="grid gap-4 pt-2 sm:grid-cols-3">
        {PRINCIPLES.map((p, i) => (
          <div
            key={p.title}
            className="paper-card reveal relative p-4"
            style={{
              transform: `rotate(${p.rotate}deg)`,
              animationDelay: `${100 + i * 90}ms`,
            }}
          >
            <span
              className="absolute -top-1.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-stamp-red shadow-[0_1px_2px_rgba(32,28,18,0.4)]"
              aria-hidden
            />
            <p className="font-display text-[15px] font-medium text-ink italic">{p.title}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{p.body}</p>
          </div>
        ))}
      </section>

      <section className="paper-card reveal p-6" style={{ animationDelay: "260ms" }}>
        <p className="field-label mb-3">Docket — start with one of these</p>
        {featured.length === 0 ? (
          <p className="font-body text-sm text-ink-faint italic">Loading products from the corpus…</p>
        ) : (
          <ul className="ruled-divider divide-y divide-dashed divide-[var(--color-rule)] pt-1">
            {featured.map((p, i) => (
              <li key={p.parent_asin}>
                <button
                  onClick={() => onSelect(p)}
                  className="group flex w-full items-center gap-4 py-3 text-left transition-colors hover:bg-paper"
                >
                  <span className="field-label w-10 shrink-0 text-ink-faint">
                    №{String(i + 1).padStart(3, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 block text-sm text-ink">{p.title}</span>
                    <span className="field-label mt-0.5 block normal-case">
                      ★ {p.average_rating ?? "—"} · {p.rating_number ?? 0} ratings
                      {p.price ? ` · $${p.price}` : ""}
                    </span>
                  </span>
                  <span className="field-label shrink-0 text-stamp-red opacity-0 transition-opacity group-hover:opacity-100">
                    Open file →
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
