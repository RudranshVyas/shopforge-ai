"""Build the FAISS + BM25 indexes from an ingested corpus.

    python scripts/build_index.py --demo
    python scripts/build_index.py

Writes faiss.index, embeddings.npy, bm25.pkl and id_map.parquet next to the
parquet corpus, so a corpus and its indexes always travel together.
"""

import argparse
import pickle
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app  # noqa: F401, E402  -- fixes torch/pyarrow DLL load order on Windows
import faiss  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from rank_bm25 import BM25Okapi  # noqa: E402
from sentence_transformers import SentenceTransformer  # noqa: E402

from app.config import settings  # noqa: E402
from app.services.index_store import tokenize  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[2]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--demo", action="store_true", help="build against data/demo/")
    parser.add_argument("--batch-size", type=int, default=256)
    args = parser.parse_args()

    corpus_dir = REPO_ROOT / "data" / ("demo" if args.demo else "processed")
    reviews_path = corpus_dir / "reviews.parquet"
    if not reviews_path.exists():
        print(f"missing {reviews_path} -- run ingest_reviews.py first", file=sys.stderr)
        return 1

    reviews = pd.read_parquet(reviews_path)
    # Row order here defines the index ids; id_map.parquet is what pins it down.
    corpus = (reviews["title"].fillna("") + " " + reviews["text"].fillna("")).str.strip().tolist()
    print(f"corpus: {len(corpus):,} reviews from {corpus_dir}")

    print(f"embedding with {settings.embedding_model}...")
    encoder = SentenceTransformer(settings.embedding_model)
    embeddings = encoder.encode(
        corpus,
        batch_size=args.batch_size,
        normalize_embeddings=True,
        show_progress_bar=True,
        convert_to_numpy=True,
    ).astype(np.float32)

    # Inner product over normalized vectors == cosine similarity.
    index = faiss.IndexFlatIP(embeddings.shape[1])
    index.add(embeddings)

    print("building BM25...")
    bm25 = BM25Okapi([tokenize(doc) for doc in corpus])

    faiss.write_index(index, str(corpus_dir / "faiss.index"))
    np.save(corpus_dir / "embeddings.npy", embeddings)
    with open(corpus_dir / "bm25.pkl", "wb") as fh:
        pickle.dump(bm25, fh)
    reviews[["review_id", "parent_asin"]].to_parquet(corpus_dir / "id_map.parquet", index=False)

    print(
        f"\nvectors  {embeddings.shape}"
        f"\nfaiss    {index.ntotal} vectors, IndexFlatIP"
        f"\nout      {corpus_dir}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
