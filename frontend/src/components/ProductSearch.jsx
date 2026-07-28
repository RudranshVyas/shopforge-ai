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
      <form onSubmit={search} className="flex gap-2">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search products — try 'case', 'charger', 'headphones'"
          className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm outline-none focus:border-slate-900"
        />
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          disabled={searching}
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </form>

      {results.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {results.map((p) => (
            <li key={p.parent_asin}>
              <button
                onClick={() => {
                  onSelect(p);
                  setResults([]);
                }}
                className="w-full px-4 py-3 text-left text-sm hover:bg-slate-50"
              >
                <span className="line-clamp-1 font-medium text-slate-800">{p.title}</span>
                <span className="text-xs text-slate-500">
                  ★ {p.average_rating ?? "—"} · {p.rating_number ?? 0} ratings
                  {p.price ? ` · $${p.price}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
