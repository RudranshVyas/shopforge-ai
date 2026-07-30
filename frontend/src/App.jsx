import { useState } from "react";
import AnswerCard from "./components/AnswerCard.jsx";
import CompareView from "./components/CompareView.jsx";
import LandingPanel from "./components/LandingPanel.jsx";
import ProductHeader from "./components/ProductHeader.jsx";
import ProductSearch from "./components/ProductSearch.jsx";
import QuestionBox from "./components/QuestionBox.jsx";
import TracePanel from "./components/TracePanel.jsx";

const MODES = [
  ["ask", "Ask"],
  ["compare", "Compare"],
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
    <div className="min-h-screen">
      <header className="mx-auto max-w-3xl px-6 pt-9 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-[2.4rem] leading-none font-medium text-ink italic">
              ShopForge
            </h1>
            <p className="mt-2 text-sm text-ink-soft">
              Product answers you can trace back to the review they came from
            </p>
          </div>
          <nav className="tabs">
            {MODES.map(([value, label]) => (
              <button
                key={value}
                onClick={() => switchMode(value)}
                className={`tab ${mode === value ? "is-active" : ""}`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-6 pb-10">
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
          <div className="card reveal flex items-center gap-3 p-6">
            <span className="pulse-dot h-2 w-2 shrink-0 rounded-full bg-clay" />
            <p className="text-sm text-ink-soft italic">
              Retrieving evidence, then deciding whether it's strong enough to answer…
            </p>
          </div>
        )}
        {error && (
          <div className="card reveal p-6">
            <span className="stamp stamp-low">Request failed</span>
            <p className="mt-3 font-mono text-xs text-ink-soft">{error}</p>
          </div>
        )}

        {mode === "ask" && result && !loading && <AnswerCard result={result} />}
        {result && !loading && <TracePanel result={result} />}
      </main>

      <footer className="mx-auto max-w-3xl px-6 pb-10">
        <hr className="hairline" />
        <p className="label mt-4 text-center">
          Amazon Reviews 2023 · Cell Phones &amp; Accessories
        </p>
      </footer>
    </div>
  );
}
