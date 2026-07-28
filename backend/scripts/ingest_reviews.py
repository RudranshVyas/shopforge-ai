"""Stream Amazon Reviews 2023 (McAuley Lab) and write a filtered corpus to parquet.

The category files are multi-GB, so both the metadata and the review split are
streamed and stopped early -- nothing is downloaded in full.

    python scripts/ingest_reviews.py --demo
    python scripts/ingest_reviews.py --target-reviews 32000
"""

import argparse
import hashlib
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app  # noqa: F401, E402  -- fixes torch/pyarrow DLL load order on Windows
import pandas as pd  # noqa: E402
from datasets import load_dataset  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[2]
DATASET = "McAuley-Lab/Amazon-Reviews-2023"
CATEGORY = "Cell_Phones_and_Accessories"

MIN_TEXT_LEN = 40
MIN_RATING_NUMBER = 30
MAX_REVIEWS_PER_PRODUCT = 120


def collect_products(max_products: int, meta_scan: int) -> dict[str, dict]:
    """First pass: stream item metadata, keep the most-reviewed products.

    Selecting by review volume (rather than taking the first N that clear the
    threshold) keeps the candidate set dense, so the review pass finds matches
    without scanning the whole category.
    """
    stream = load_dataset(
        DATASET, f"raw_meta_{CATEGORY}", split="full", streaming=True, trust_remote_code=True
    )
    products: dict[str, dict] = {}
    for scanned, item in enumerate(stream, start=1):
        if scanned % 100_000 == 0:
            print(f"  metadata scanned {scanned:,} | candidates {len(products):,}", flush=True)
        if scanned >= meta_scan:
            break
        title = (item.get("title") or "").strip()
        if not title or (item.get("rating_number") or 0) < MIN_RATING_NUMBER:
            continue
        parent_asin = item["parent_asin"]
        if parent_asin in products:
            continue
        products[parent_asin] = {
            "parent_asin": parent_asin,
            "title": title,
            "main_category": item.get("main_category"),
            "average_rating": item.get("average_rating"),
            "rating_number": item.get("rating_number"),
            "price": _to_price(item.get("price")),
            "categories": ", ".join(item.get("categories") or []),
            "description": " ".join(item.get("description") or [])[:2000],
        }

    ranked = sorted(products.values(), key=lambda p: p["rating_number"], reverse=True)
    return {p["parent_asin"]: p for p in ranked[:max_products]}


def _to_price(raw) -> float | None:
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def review_id(row: dict) -> str:
    digest = hashlib.sha1(
        f"{row['user_id']}|{row['timestamp']}|{row['text'][:200]}".encode()
    ).hexdigest()[:10]
    return f"{row['parent_asin']}-{digest}"


def collect_reviews(
    candidates: set[str], target: int, min_per_product: int, want_products: int, max_scan: int
) -> dict[str, list[dict]]:
    """Second pass: stream reviews, keep the ones belonging to candidate products."""
    stream = load_dataset(
        DATASET, f"raw_review_{CATEGORY}", split="full", streaming=True, trust_remote_code=True
    )
    by_product: dict[str, list[dict]] = defaultdict(list)
    seen_texts: dict[str, set[str]] = defaultdict(set)
    kept = scanned = 0

    for row in stream:
        scanned += 1
        if scanned % 250_000 == 0:
            ready = sum(1 for v in by_product.values() if len(v) >= min_per_product)
            print(f"  scanned {scanned:,} | kept {kept:,} | products ready {ready}", flush=True)

        parent_asin = row.get("parent_asin")
        if parent_asin not in candidates:
            continue
        text = (row.get("text") or "").strip()
        if len(text) < MIN_TEXT_LEN:
            continue
        bucket = by_product[parent_asin]
        if len(bucket) >= MAX_REVIEWS_PER_PRODUCT:
            continue
        fingerprint = text.lower()
        if fingerprint in seen_texts[parent_asin]:
            continue
        seen_texts[parent_asin].add(fingerprint)

        row = {
            "parent_asin": parent_asin,
            "asin": row.get("asin"),
            "user_id": row.get("user_id"),
            "rating": float(row.get("rating") or 0),
            "title": (row.get("title") or "").strip(),
            "text": text,
            "timestamp": row.get("timestamp"),
            "helpful_vote": int(row.get("helpful_vote") or 0),
            "verified_purchase": bool(row.get("verified_purchase")),
        }
        row["review_id"] = review_id(row)
        bucket.append(row)
        kept += 1

        ready = sum(1 for v in by_product.values() if len(v) >= min_per_product)
        if kept >= target and ready >= want_products:
            break
        if scanned >= max_scan:
            print(f"  hit --max-scan ({max_scan:,}), stopping early", flush=True)
            break

    return by_product


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target-reviews", type=int, default=32000)
    parser.add_argument("--min-reviews-per-product", type=int, default=20)
    parser.add_argument("--max-products", type=int, default=800)
    parser.add_argument("--candidate-products", type=int, default=2000)
    parser.add_argument("--meta-scan", type=int, default=400_000)
    parser.add_argument("--max-scan", type=int, default=8_000_000)
    parser.add_argument(
        "--demo",
        action="store_true",
        help="small committed corpus: ~3k reviews / ~50 products into data/demo/",
    )
    args = parser.parse_args()

    if args.demo:
        args.target_reviews = min(args.target_reviews, 3000)
        args.max_products = 50
        args.candidate_products = 150
        out_dir = REPO_ROOT / "data" / "demo"
    else:
        out_dir = REPO_ROOT / "data" / "processed"
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"[1/3] streaming product metadata (cap {args.candidate_products})...", flush=True)
    products = collect_products(args.candidate_products, args.meta_scan)
    print(f"      {len(products)} candidate products", flush=True)

    print(f"[2/3] streaming reviews (target {args.target_reviews:,})...", flush=True)
    by_product = collect_reviews(
        candidates=set(products),
        target=args.target_reviews,
        min_per_product=args.min_reviews_per_product,
        want_products=args.max_products,
        max_scan=args.max_scan,
    )

    kept_products = sorted(
        (p for p, rows in by_product.items() if len(rows) >= args.min_reviews_per_product),
        key=lambda p: len(by_product[p]),
        reverse=True,
    )[: args.max_products]
    if not kept_products:
        print("no product reached the review threshold -- raise --max-scan", file=sys.stderr)
        return 1

    reviews_df = pd.DataFrame([r for p in kept_products for r in by_product[p]])
    counts = reviews_df.groupby("parent_asin").size()
    products_df = pd.DataFrame([products[p] for p in kept_products])
    products_df["n_reviews"] = products_df["parent_asin"].map(counts)

    print("[3/3] writing parquet...", flush=True)
    reviews_df.to_parquet(out_dir / "reviews.parquet", index=False)
    products_df.to_parquet(out_dir / "products.parquet", index=False)

    print(
        f"\nreviews:            {len(reviews_df):,}"
        f"\nproducts:           {len(products_df):,}"
        f"\navg reviews/product {len(reviews_df) / len(products_df):.1f}"
        f"\nmin/max per product {counts.min()} / {counts.max()}"
        f"\nmean rating         {reviews_df['rating'].mean():.2f}"
        f"\nout                 {out_dir}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
