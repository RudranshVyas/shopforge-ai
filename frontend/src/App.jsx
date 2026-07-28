import { useState } from "react";
import AnswerCard from "./components/AnswerCard.jsx";
import ProductHeader from "./components/ProductHeader.jsx";
import ProductSearch from "./components/ProductSearch.jsx";
import QuestionBox from "./components/QuestionBox.jsx";
import TracePanel from "./components/TracePanel.jsx";

export default function App() {
  const [product, setProduct] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function selectProduct(summary) {
    setResult(null);
    setError(null);
    const res = await fetch(`/api/v1/products/${summary.parent_asin}`);
    setProduct(await res.json());
  }

  async function ask(question) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/assistant/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: question, parent_asin: product?.parent_asin ?? null }),
      });
      if (!res.ok) throw new Error(`backend returned ${res.status}`);
      setResult(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 py-4">
          <h1 className="text-lg font-semibold text-slate-900">ShopForge AI</h1>
          <p className="text-xs text-slate-500">
            Citation-backed product insights from real Amazon reviews
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-6 py-6">
        <ProductSearch onSelect={selectProduct} />

        {product && <ProductHeader product={product} />}
        {product && <QuestionBox onAsk={ask} loading={loading} />}

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

        {result && !loading && (
          <>
            <AnswerCard result={result} />
            <TracePanel result={result} />
          </>
        )}
      </main>
    </div>
  );
}
