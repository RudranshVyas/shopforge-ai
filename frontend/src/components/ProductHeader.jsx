export default function ProductHeader({ product }) {
  const total = Object.values(product.rating_histogram).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="card reveal p-7">
      <p className="label-caps">Now examining</p>
      <h2 className="mt-2 font-display text-[1.35rem] leading-snug font-medium text-ink italic">
        {product.title}
      </h2>
      <p className="label mt-2.5">
        ★ {product.average_rating ?? "—"} · {product.n_reviews} reviews on file
        {product.price ? ` · $${product.price}` : ""}
      </p>

      <hr className="hairline my-5" />

      <div className="space-y-2">
        {[5, 4, 3, 2, 1].map((star) => (
          <div key={star} className="flex items-center gap-3 font-mono text-xs text-ink-soft">
            <span className="w-7 tabular-nums opacity-70">{star}★</span>
            <div className="bar-track h-2.5 flex-1">
              <div
                className="bar-fill h-full"
                style={{ width: `${(product.rating_histogram[star] / total) * 100}%` }}
              />
            </div>
            <span className="w-9 text-right tabular-nums opacity-70">
              {product.rating_histogram[star]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
