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
    <div className="min-h-screen">
      <div className="folder-strip">
        <div className="mx-auto max-w-3xl px-6 pt-2">
          <p className="field-label text-ink-faint">ShopForge · Evidence Review Division</p>
        </div>
        <div className="mx-auto flex max-w-3xl flex-wrap items-end justify-between gap-4 px-6 pt-2">
          <div>
            <h1 className="font-display text-[2.15rem] leading-none font-medium text-ink italic">
              ShopForge
            </h1>
            <p className="field-label mt-1.5 text-ink-soft">
              Product intelligence, verified against the source review
            </p>
          </div>
          <nav className="-mb-px flex gap-1">
            {MODES.map(([value, label]) => (
              <button
                key={value}
                onClick={() => switchMode(value)}
                className={`folder-tab ${mode === value ? "is-active" : ""}`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="mx-auto max-w-3xl space-y-5 px-6 py-8">
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
          <div className="paper-card reveal p-5 font-mono text-xs text-ink-soft">
            <span className="text-ink">PROCESSING</span> — planner{" "}
            <span className="text-ink-faint">→</span> retriever{" "}
            <span className="text-ink-faint">→</span> evidence selector{" "}
            <span className="text-ink-faint">→</span> validator{" "}
            <span className="blink-cursor">▮</span>
          </div>
        )}
        {error && (
          <div className="paper-card reveal border-stamp-red/40 p-5 text-sm text-stamp-red">
            <span className="stamp stamp-low mb-2">Request failed</span>
            <p className="mt-2 font-mono text-xs">{error}</p>
          </div>
        )}

        {mode === "ask" && result && !loading && <AnswerCard result={result} />}
        {result && !loading && <TracePanel result={result} />}
      </main>

      <footer className="mx-auto max-w-3xl px-6 pb-10">
        <p className="ruled-divider field-label pt-3 text-ink-faint">
          Amazon Reviews 2023 (McAuley Lab) · Cell Phones &amp; Accessories corpus
        </p>
      </footer>
    </div>
  );
}
