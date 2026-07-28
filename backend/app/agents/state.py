"""Typed state passed between LangGraph nodes."""

from typing import Any, Literal, TypedDict

QueryType = Literal[
    "product_summary", "aspect_question", "complaint_mining", "retrieval_only", "unknown"
]
Strength = Literal["strong", "mixed", "weak"]


class TraceEntry(TypedDict):
    agent: str
    summary: str
    details: dict[str, Any]
    duration_ms: float


class WorkflowState(TypedDict, total=False):
    # input
    query: str
    parent_asin: str | None
    top_k: int

    # QueryPlanner
    query_type: QueryType
    aspect: str | None

    # Retriever / EvidenceSelector
    candidates: list[dict[str, Any]]
    evidence: list[dict[str, Any]]
    strength: Strength

    # InsightGenerator / Validator
    insight: dict[str, Any] | None
    dropped_citations: list[dict[str, Any]]

    # output plumbing
    response_type: Literal["generated_insight", "retrieval_only", "fallback"]
    fallback_reason: str | None
    llm_called: bool
    fallback_used: bool
    agent_trace: list[TraceEntry]
