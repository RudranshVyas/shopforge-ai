"""Loads the review corpus + retrieval indexes once, and serves hybrid search.

Dense (FAISS over MiniLM embeddings) and sparse (BM25) rankings are merged with
Reciprocal Rank Fusion. RRF is used instead of a weighted sum because BM25 scores
and cosine similarities live on incompatible scales.
"""

import pickle
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import faiss
import numpy as np
import pandas as pd

from app.config import settings

RRF_K = 60
TOKEN_RE = re.compile(r"[a-z0-9']+")


def tokenize(text: str) -> list[str]:
    return TOKEN_RE.findall(text.lower())


@dataclass
class Hit:
    review_id: str
    parent_asin: str
    text: str
    title: str
    rating: float
    helpful_vote: int
    rrf_score: float
    dense_rank: int | None
    sparse_rank: int | None


class IndexStore:
    def __init__(self, corpus_dir: Path):
        self.corpus_dir = corpus_dir
        self.reviews = pd.read_parquet(corpus_dir / "reviews.parquet")
        self.products = pd.read_parquet(corpus_dir / "products.parquet")
        self.index = faiss.read_index(str(corpus_dir / "faiss.index"))
        self.vectors = np.load(corpus_dir / "embeddings.npy")
        with open(corpus_dir / "bm25.pkl", "rb") as fh:
            self.bm25 = pickle.load(fh)

        id_map = pd.read_parquet(corpus_dir / "id_map.parquet")
        self.row_ids: list[str] = id_map["review_id"].tolist()
        self.reviews = self.reviews.set_index("review_id", drop=False).loc[self.row_ids]
        self.rows_by_product: dict[str, np.ndarray] = {
            asin: np.asarray(idx, dtype=np.int64)
            for asin, idx in self.reviews.reset_index(drop=True)
            .groupby("parent_asin")
            .groups.items()
        }
        self._encoder = None

    @property
    def encoder(self):
        if self._encoder is None:
            from sentence_transformers import SentenceTransformer

            self._encoder = SentenceTransformer(settings.embedding_model)
        return self._encoder

    def embed(self, text: str) -> np.ndarray:
        vec = self.encoder.encode([text], normalize_embeddings=True)
        return np.asarray(vec, dtype=np.float32)

    def search(self, query: str, parent_asin: str | None = None, top_k: int = 12) -> list[Hit]:
        subset = self.rows_by_product.get(parent_asin) if parent_asin else None
        if parent_asin and subset is None:
            return []
        # Over-fetch before fusion so a document ranked well by only one retriever
        # still survives into the merged list.
        fetch = max(top_k * 5, 50)

        dense_rank = self._dense_ranks(query, subset, fetch)
        sparse_rank = self._sparse_ranks(query, subset, fetch)

        fused: dict[int, float] = {}
        for ranks in (dense_rank, sparse_rank):
            for row, rank in ranks.items():
                fused[row] = fused.get(row, 0.0) + 1.0 / (RRF_K + rank)

        ordered = sorted(fused.items(), key=lambda kv: kv[1], reverse=True)[:top_k]
        return [
            self._to_hit(row, score, dense_rank.get(row), sparse_rank.get(row))
            for row, score in ordered
        ]

    def _dense_ranks(self, query: str, subset: np.ndarray | None, fetch: int) -> dict[int, int]:
        vec = self.embed(query)
        if subset is None:
            _, ids = self.index.search(vec, min(fetch, self.index.ntotal))
            rows = [int(r) for r in ids[0] if r != -1]
        else:
            # Small per-product subsets: score them directly instead of building
            # a filtered index.
            scores = self.vectors[subset] @ vec[0]
            order = np.argsort(-scores)[:fetch]
            rows = [int(subset[i]) for i in order]
        return {row: rank for rank, row in enumerate(rows, start=1)}

    def _sparse_ranks(self, query: str, subset: np.ndarray | None, fetch: int) -> dict[int, int]:
        tokens = tokenize(query)
        if not tokens:
            return {}
        scores = self.bm25.get_scores(tokens)
        pool = np.arange(len(scores)) if subset is None else subset
        pool_scores = scores[pool]
        order = np.argsort(-pool_scores)[:fetch]
        rows = [int(pool[i]) for i in order if pool_scores[i] > 0]
        return {row: rank for rank, row in enumerate(rows, start=1)}

    def _to_hit(self, row: int, score: float, dense: int | None, sparse: int | None) -> Hit:
        r = self.reviews.iloc[row]
        return Hit(
            review_id=r["review_id"],
            parent_asin=r["parent_asin"],
            text=r["text"],
            title=r["title"],
            rating=float(r["rating"]),
            helpful_vote=int(r["helpful_vote"]),
            rrf_score=score,
            dense_rank=dense,
            sparse_rank=sparse,
        )


def resolve_corpus_dir() -> Path:
    """Prefer the full corpus; fall back to the committed demo corpus."""
    for candidate in (settings.data_dir / "processed", settings.data_dir / "demo"):
        if (candidate / "faiss.index").exists():
            return candidate
    raise FileNotFoundError(
        "No index found. Run scripts/ingest_reviews.py --demo then scripts/build_index.py --demo"
    )


@lru_cache(maxsize=1)
def get_store() -> IndexStore:
    return IndexStore(resolve_corpus_dir())
