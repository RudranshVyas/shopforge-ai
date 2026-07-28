"""Rule-based query classification and aspect detection. No LLM here by design."""

import json
import re
from functools import lru_cache
from pathlib import Path

from app.agents.state import QueryType, WorkflowState
from app.agents.trace import timed

ASPECTS_PATH = Path(__file__).resolve().parents[1] / "resources" / "aspects.json"

COMPLAINT_MARKERS = ("complaint", "problem", "issue", "wrong with", "downside", "worst", "fail")
RETRIEVAL_MARKERS = ("show review", "find review", "reviews mentioning", "show me review")
SUMMARY_MARKERS = (
    "what do people say",
    "is it good",
    "worth buying",
    "worth it",
    "summarize",
    "sentiment",
    "overall",
)


@lru_cache(maxsize=1)
def load_aspects() -> dict[str, list[str]]:
    return json.loads(ASPECTS_PATH.read_text(encoding="utf-8"))


def detect_aspect(query: str) -> str | None:
    """Longest keyword match wins, so 'battery life' beats a bare 'life'."""
    lowered = query.lower()
    best: tuple[int, str] | None = None
    for aspect, keywords in load_aspects().items():
        for keyword in keywords:
            if re.search(rf"\b{re.escape(keyword)}\b", lowered) and (
                best is None or len(keyword) > best[0]
            ):
                best = (len(keyword), aspect)
    return best[1] if best else None


def classify(query: str, parent_asin: str | None) -> tuple[QueryType, str | None]:
    lowered = query.lower().strip()
    aspect = detect_aspect(lowered)

    if any(marker in lowered for marker in RETRIEVAL_MARKERS):
        return "retrieval_only", aspect
    if any(marker in lowered for marker in COMPLAINT_MARKERS):
        return "complaint_mining", aspect
    if aspect:
        return "aspect_question", aspect
    if parent_asin and (
        any(marker in lowered for marker in SUMMARY_MARKERS) or len(lowered.split()) <= 12
    ):
        return "product_summary", None
    return "unknown", None


@timed("QueryPlanner")
def query_planner(state: WorkflowState) -> WorkflowState:
    query_type, aspect = classify(state["query"], state.get("parent_asin"))
    return {
        "query_type": query_type,
        "aspect": aspect,
        "_trace": {
            "summary": f"classified as {query_type}" + (f" (aspect: {aspect})" if aspect else ""),
            "details": {"query_type": query_type, "aspect": aspect},
        },
    }
