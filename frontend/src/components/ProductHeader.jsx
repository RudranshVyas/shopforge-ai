export default function ProductHeader({ product }) {
  const total = Object.values(product.rating_histogram).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-slate-900">{product.title}</h2>
      <p className="mt-1 text-sm text-slate-500">
        ★ {product.average_rating ?? "—"} · {product.n_reviews} reviews in corpus
        {product.price ? ` · $${product.price}` : ""}
      </p>

      <div className="mt-4 space-y-1">
        {[5, 4, 3, 2, 1].map((star) => (
          <div key={star} className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-6">{star}★</span>
            <div className="h-2 flex-1 rounded bg-slate-100">
              <div
                className="h-2 rounded bg-amber-400"
                style={{ width: `${(product.rating_histogram[star] / total) * 100}%` }}
              />
            </div>
            <span className="w-8 text-right">{product.rating_histogram[star]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
