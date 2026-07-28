import time

from fastapi import APIRouter

from app.schemas.request import CompareRequest, QueryRequest
from app.schemas.response import (
    CompareResponse,
    ComparisonSideOut,
    QueryResponse,
    ReviewOut,
)
from app.services.index_store import get_store
from app.services.metrics import metrics
from app.workflows.comparison_workflow import WEAK_COMPARISON_ANSWER, run_comparison
from app.workflows.review_workflow import run_workflow

router = APIRouter(prefix="/api/v1/assistant", tags=["assistant"])


def _as_reviews(rows: list[dict]) -> list[ReviewOut]:
    return [ReviewOut(**{k: r[k] for k in ReviewOut.model_fields}) for r in rows]


def _product_title(parent_asin: str) -> str | None:
    products = get_store().products
    match = products[products["parent_asin"] == parent_asin]
    return None if match.empty else match.iloc[0]["title"]


@router.post("/query", response_model=QueryResponse)
def query(body: QueryRequest) -> QueryResponse:
    started = time.perf_counter()
    state = run_workflow(body.query, body.parent_asin, body.top_k)
    latency_ms = round((time.perf_counter() - started) * 1000, 1)

    insight = state.get("insight") or {}
    response_type = state.get("response_type", "fallback")
    # The selected evidence is always returned: retrieval-only renders it as a list, and
    # the insight view needs the full text to expand a citation chip.
    reviews = _as_reviews(state.get("evidence", []))

    metrics.record_query(
        latency_ms=latency_ms,
        llm_called=bool(state.get("llm_called")),
        fallback_used=bool(state.get("fallback_used")),
    )

    return QueryResponse(
        response_type=response_type,
        answer=insight.get("answer"),
        positives=insight.get("positives", []),
        complaints=insight.get("complaints", []),
        recommendation=insight.get("recommendation"),
        confidence=insight.get("confidence"),
        citations=insight.get("citations", []),
        reviews=reviews,
        agent_trace=state.get("agent_trace", []),
        latency_ms=latency_ms,
        llm_called=bool(state.get("llm_called")),
        fallback_used=bool(state.get("fallback_used")),
    )


@router.post("/compare", response_model=CompareResponse)
def compare(body: CompareRequest) -> CompareResponse:
    started = time.perf_counter()
    state = run_comparison(body.query, body.parent_asin_a, body.parent_asin_b, body.top_k)
    latency_ms = round((time.perf_counter() - started) * 1000, 1)

    metrics.record_query(
        latency_ms=latency_ms,
        llm_called=bool(state.get("llm_called")),
        fallback_used=bool(state.get("fallback_used")),
    )

    comparison = state.get("comparison")
    sides = {}
    for key, asin, evidence in (
        ("product_a", body.parent_asin_a, state.get("evidence_a", [])),
        ("product_b", body.parent_asin_b, state.get("evidence_b", [])),
    ):
        side = (comparison or {}).get(key, {})
        sides[key] = ComparisonSideOut(
            parent_asin=asin,
            title=_product_title(asin),
            strengths=side.get("strengths", []),
            weaknesses=side.get("weaknesses", []),
            citations=side.get("citations", []),
            reviews=_as_reviews(evidence),
        )

    return CompareResponse(
        response_type=state.get("response_type", "fallback"),
        verdict=(comparison or {}).get("verdict") or state.get("verdict") or (
            WEAK_COMPARISON_ANSWER if state.get("fallback_used") else None
        ),
        product_a=sides["product_a"],
        product_b=sides["product_b"],
        confidence=(comparison or {}).get("confidence"),
        agent_trace=state.get("agent_trace", []),
        latency_ms=latency_ms,
        llm_called=bool(state.get("llm_called")),
        fallback_used=bool(state.get("fallback_used")),
    )
