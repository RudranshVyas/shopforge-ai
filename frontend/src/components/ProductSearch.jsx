import { useState } from "react";

export default function ProductSearch({ onSelect }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  async function search(event) {
    event.preventDefault();
    if (term.trim().length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/v1/products/search?q=${encodeURIComponent(term)}`);
      setResults(await res.json());
    } finally {
      setSearching(false);
    }
  }

  return (
    <div>
      <p className="field-label mb-1.5">Search the corpus</p>
      <form onSubmit={search} className="flex items-end gap-3">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="case, charger, headphones…"
          className="dossier-input"
        />
        <button type="submit" className="btn-stamp" disabled={searching}>
          {searching ? "Searching…" : "Search"}
        </button>
      </form>

      {results.length > 0 && (
        <ul className="reveal paper-card mt-3 divide-y divide-dashed divide-[var(--color-rule)]">
          {results.map((p) => (
            <li key={p.parent_asin}>
              <button
                onClick={() => {
                  onSelect(p);
                  setResults([]);
                }}
                className="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-paper"
              >
                <div className="min-w-0">
                  <span className="line-clamp-1 text-sm text-ink">{p.title}</span>
                  <span className="field-label mt-0.5 block normal-case">
                    ★ {p.average_rating ?? "—"} · {p.rating_number ?? 0} ratings
                    {p.price ? ` · $${p.price}` : ""}
                  </span>
                </div>
                <span className="field-label shrink-0 text-stamp-red opacity-0 transition-opacity group-hover:opacity-100">
                  Open →
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
