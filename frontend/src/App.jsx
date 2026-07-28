import { useState } from "react";
import AnswerCard from "./components/AnswerCard.jsx";
import CompareView from "./components/CompareView.jsx";
import LandingPanel from "./components/LandingPanel.jsx";
import ProductHeader from "./components/ProductHeader.jsx";
import ProductSearch from "./components/ProductSearch.jsx";
import QuestionBox from "./components/QuestionBox.jsx";
import TracePanel from "./components/TracePanel.jsx";

const MODES = [
  ["ask", "Ask about a product"],
  ["compare", "Compare two products"],
];

export default function App() {
  const [mode, setMode] = useState("ask");
  const [product, setProduct] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function switchMode(next) {
    setMode(next);
    setResult(null);
    setError(null);
  }

  async function selectProduct(summary) {
    setResult(null);
    setError(null);
    const res = await fetch(`/api/v1/products/${summary.parent_asin}`);
    setProduct(await res.json());
  }

  async function post(path, body) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`backend returned ${res.status}`);
      setResult(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const ask = (query) =>
    post("/api/v1/assistant/query", { query, parent_asin: product?.parent_asin ?? null });

  const compare = (query, parent_asin_a, parent_asin_b) =>
    post("/api/v1/assistant/compare", { query, parent_asin_a, parent_asin_b });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">ShopForge AI</h1>
            <p className="text-xs text-slate-500">
              Citation-backed product insights from real Amazon reviews
            </p>
          </div>
          <nav className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {MODES.map(([value, label]) => (
              <button
                key={value}
                onClick={() => switchMode(value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  mode === value
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-6 py-6">
        {mode === "ask" ? (
          <>
            <ProductSearch onSelect={selectProduct} />
            {!product && <LandingPanel onSelect={selectProduct} />}
            {product && <ProductHeader product={product} />}
            {product && <QuestionBox onAsk={ask} loading={loading} />}
          </>
        ) : (
          <CompareView onResult={compare} loading={loading} result={result} />
        )}

        {loading && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
            Running pipeline: planner → retriever → evidence selector → validator…
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
            {error}
          </div>
        )}

        {mode === "ask" && result && !loading && <AnswerCard result={result} />}
        {result && !loading && <TracePanel result={result} />}
      </main>
    </div>
  );
}
