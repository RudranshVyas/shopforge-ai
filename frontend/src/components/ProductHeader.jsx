export default function ProductHeader({ product }) {
  const total = Object.values(product.rating_histogram).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="paper-card paper-card--fold reveal p-6">
      <p className="field-label mb-1">Subject of inquiry</p>
      <h2 className="font-display text-xl leading-snug font-medium text-ink italic">
        {product.title}
      </h2>
      <p className="field-label mt-2 normal-case">
        ★ {product.average_rating ?? "—"} · {product.n_reviews} reviews on file
        {product.price ? ` · $${product.price}` : ""}
      </p>

      <div className="ruled-divider mt-4 space-y-1.5 pt-4">
        {[5, 4, 3, 2, 1].map((star) => (
          <div key={star} className="flex items-center gap-3 font-mono text-xs text-ink-soft">
            <span className="w-8 tabular-nums">{star}★</span>
            <div className="ledger-track h-2.5 flex-1">
              <div
                className="ledger-fill h-full"
                style={{ width: `${(product.rating_histogram[star] / total) * 100}%` }}
              />
            </div>
            <span className="w-8 text-right tabular-nums">{product.rating_histogram[star]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
