import { useEffect, useState } from "react";

const PIPELINE = [
  "QueryPlanner",
  "Retriever",
  "EvidenceSelector",
  "Gate",
  "InsightGenerator",
  "Validator",
];

const PRINCIPLES = [
  {
    title: "Retrieval before generation",
    body: "A strength gate blocks the model entirely when the evidence is thin — weak retrieval returns a deterministic answer instead of a confident guess.",
  },
  {
    title: "Hybrid search, fused by rank",
    body: "FAISS dense vectors and BM25 keyword scores are merged with Reciprocal Rank Fusion, because their raw scores are not on comparable scales.",
  },
  {
    title: "Every quote is checked",
    body: "Each citation is fuzzy-matched back to its source review. What cannot be verified gets dropped, and the confidence is capped when it is.",
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
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-slate-900">
          Ask a question. Get an answer you can check.
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          ShopForge reads real Amazon reviews and answers questions about a product — then
          shows you the reviews it used, the quote it pulled from each one, and every decision
          the pipeline made on the way there.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-1.5">
          {PIPELINE.map((step, i) => (
            <span key={step} className="flex items-center gap-1.5">
              <span
                className={`rounded-md px-2 py-1 font-mono text-[11px] ${
                  step === "Gate"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {step}
              </span>
              {i < PIPELINE.length - 1 && <span className="text-slate-300">→</span>}
            </span>
          ))}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {PRINCIPLES.map((p) => (
          <div key={p.title} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-900">{p.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{p.body}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Start with one of these
        </p>
        {featured.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Loading products from the corpus…</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {featured.map((p) => (
              <li key={p.parent_asin}>
                <button
                  onClick={() => onSelect(p)}
                  className="h-full w-full rounded-lg border border-slate-200 p-3 text-left hover:border-slate-400 hover:bg-slate-50"
                >
                  <span className="line-clamp-2 text-sm text-slate-800">{p.title}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    ★ {p.average_rating ?? "—"} · {p.rating_number ?? 0} ratings
                    {p.price ? ` · $${p.price}` : ""}
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
