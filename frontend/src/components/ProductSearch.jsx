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
      <form onSubmit={search} className="flex items-center gap-2.5">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search products — case, charger, headphones…"
          className="field"
        />
        <button type="submit" className="btn" disabled={searching}>
          {searching ? "Searching…" : "Search"}
        </button>
      </form>

      {results.length > 0 && (
        <ul className="card reveal mt-3 overflow-hidden p-1.5">
          {results.map((p) => (
            <li key={p.parent_asin}>
              <button
                onClick={() => {
                  onSelect(p);
                  setResults([]);
                }}
                className="group flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-card-sunk"
              >
                <span className="min-w-0">
                  <span className="line-clamp-1 text-sm text-ink">{p.title}</span>
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
    </div>
  );
}
