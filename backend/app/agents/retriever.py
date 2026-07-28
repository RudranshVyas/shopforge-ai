"""Hybrid retrieval node: BM25 + FAISS merged by RRF, optionally product-filtered."""

from dataclasses import asdict

from app.agents.state import WorkflowState
from app.agents.trace import timed
from app.services.index_store import get_store


@timed("Retriever")
def retriever(state: WorkflowState) -> WorkflowState:
    top_k = state.get("top_k") or 12
    parent_asin = state.get("parent_asin")
    hits = get_store().search(state["query"], parent_asin=parent_asin, top_k=top_k)
    candidates = [asdict(hit) for hit in hits]

    dense_only = sum(1 for c in candidates if c["sparse_rank"] is None)
    sparse_only = sum(1 for c in candidates if c["dense_rank"] is None)
    return {
        "candidates": candidates,
        "_trace": {
            "summary": f"{len(candidates)} candidates via RRF"
            + (f", filtered to {parent_asin}" if parent_asin else " over full corpus"),
            "details": {
                "top_k": top_k,
                "parent_asin": parent_asin,
                "dense_only": dense_only,
                "sparse_only": sparse_only,
                "both_retrievers": len(candidates) - dense_only - sparse_only,
            },
        },
    }
