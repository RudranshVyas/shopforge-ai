"""Checks the model's citations against the evidence it was given.

Anything that cannot be traced back to a real review is dropped; if nothing
survives, the whole answer is replaced by the deterministic fallback.
"""

import re

from rapidfuzz import fuzz

from app.agents.state import WorkflowState
from app.agents.trace import timed
from app.services.metrics import metrics

QUOTE_MATCH_THRESHOLD = 85


def normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9 ]", "", text.lower()).strip()


def _check(citation: dict, source: dict) -> tuple[bool, str | None]:
    score = fuzz.partial_ratio(normalize(citation.get("quote", "")), normalize(source["text"]))
    if score < QUOTE_MATCH_THRESHOLD:
        return False, f"quote match {score:.0f} < {QUOTE_MATCH_THRESHOLD}"
    return True, None


def verify_citations(
    citations: list[dict], by_id: dict[str, dict]
) -> tuple[list[dict], list[dict], int]:
    """Returns (kept, dropped, ratings_corrected). Shared with the comparison workflow."""
    kept: list[dict] = []
    dropped: list[dict] = []
    ratings_fixed = 0

    for citation in citations:
        source = by_id.get(citation.get("review_id"))
        if source is None:
            dropped.append({**citation, "reason": "review_id not in evidence"})
            continue
        ok, reason = _check(citation, source)
        if not ok:
            dropped.append({**citation, "reason": reason})
            continue
        # A wrong rating is a copy error, not a fabrication -- correct it from source.
        if int(citation.get("rating", 0)) != round(source["rating"]):
            citation = {**citation, "rating": round(source["rating"])}
            ratings_fixed += 1
        kept.append(citation)

    metrics.record_citations(passed=len(kept), dropped=len(dropped))
    return kept, dropped, ratings_fixed


@timed("Validator")
def validator(state: WorkflowState) -> WorkflowState:
    insight = dict(state.get("insight") or {})
    by_id = {r["review_id"]: r for r in state.get("evidence", [])}
    kept, dropped, ratings_fixed = verify_citations(insight.get("citations", []), by_id)

    if not kept:
        return {
            "response_type": "fallback",
            "fallback_used": True,
            "fallback_reason": "no citation survived validation",
            "insight": None,
            "dropped_citations": dropped,
            "_trace": {
                "summary": f"all {len(dropped)} citations invalid -> fallback",
                "details": {"kept": 0, "dropped": len(dropped), "reasons": dropped},
            },
        }

    confidence = insight.get("confidence", "low")
    if state.get("strength") == "mixed" and confidence == "high":
        confidence = "medium"
    if dropped and confidence == "high":
        confidence = "medium"

    insight["citations"] = kept
    insight["confidence"] = confidence
    return {
        "insight": insight,
        "dropped_citations": dropped,
        "response_type": "generated_insight",
        "_trace": {
            "summary": f"{len(kept)} citations verified, {len(dropped)} dropped, "
            f"confidence {confidence}",
            "details": {
                "kept": len(kept),
                "dropped": len(dropped),
                "ratings_corrected": ratings_fixed,
                "confidence": confidence,
                "drop_reasons": [d["reason"] for d in dropped],
            },
        },
    }
