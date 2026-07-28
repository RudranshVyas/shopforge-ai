import time

from fastapi import APIRouter

from app.schemas.request import QueryRequest
from app.schemas.response import QueryResponse, ReviewOut
from app.services.metrics import metrics
from app.workflows.review_workflow import run_workflow

router = APIRouter(prefix="/api/v1/assistant", tags=["assistant"])


@router.post("/query", response_model=QueryResponse)
def query(body: QueryRequest) -> QueryResponse:
    started = time.perf_counter()
    state = run_workflow(body.query, body.parent_asin, body.top_k)
    latency_ms = round((time.perf_counter() - started) * 1000, 1)

    insight = state.get("insight") or {}
    response_type = state.get("response_type", "fallback")
    # The selected evidence is always returned: retrieval-only renders it as a list, and
    # the insight view needs the full text to expand a citation chip.
    reviews = [
        ReviewOut(**{k: r[k] for k in ReviewOut.model_fields}) for r in state.get("evidence", [])
    ]

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
