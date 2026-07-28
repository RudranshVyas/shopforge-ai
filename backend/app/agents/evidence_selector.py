"""Picks the reviews the LLM is allowed to see, then grades retrieval strength."""

import re

from rapidfuzz import fuzz

from app.agents.query_planner import load_aspects
from app.agents.state import Strength, WorkflowState
from app.agents.trace import timed

MAX_EVIDENCE = 6
MIN_TEXT_LEN = 40
NEAR_DUPLICATE_RATIO = 90
GENERIC_TEXTS = {
    "good",
    "good product",
    "nice",
    "nice product",
    "works fine",
    "works great",
    "works as expected",
    "bad",
    "great",
    "great product",
    "as described",
    "love it",
    "ok",
    "okay",
}


def mentions_aspect(text: str, aspect: str) -> bool:
    lowered = text.lower()
    return any(
        re.search(rf"\b{re.escape(keyword)}\b", lowered) for keyword in load_aspects()[aspect]
    )


def _is_generic(text: str) -> bool:
    stripped = re.sub(r"[^a-z ]", "", text.lower()).strip()
    return stripped in GENERIC_TEXTS


def _dedupe(candidates: list[dict]) -> list[dict]:
    """Near-identical texts collapse to the one with more helpful votes."""
    kept: list[dict] = []
    for cand in candidates:
        duplicate_of = next(
            (
                k
                for k in kept
                if fuzz.ratio(cand["text"], k["text"]) > NEAR_DUPLICATE_RATIO
            ),
            None,
        )
        if duplicate_of is None:
            kept.append(cand)
        elif cand["helpful_vote"] > duplicate_of["helpful_vote"]:
            kept[kept.index(duplicate_of)] = cand
    return kept


def _add_rating_diversity(picked: list[dict], pool: list[dict]) -> list[dict]:
    """Aim for at least one critical and one positive review when both exist."""
    for predicate in (lambda r: r["rating"] <= 2, lambda r: r["rating"] >= 4):
        if any(predicate(r) for r in picked):
            continue
        extra = next((r for r in pool if predicate(r) and r not in picked), None)
        if extra is not None:
            picked = picked[: MAX_EVIDENCE - 1] + [extra]
    return picked


def grade(evidence: list[dict], query_type: str, aspect: str | None) -> Strength:
    aspect_hits = (
        sum(1 for r in evidence if mentions_aspect(r["text"], aspect)) if aspect else 0
    )
    if query_type == "aspect_question" and aspect_hits == 0:
        return "weak"
    if len(evidence) < 2:
        return "weak"
    if len(evidence) >= 4 and (query_type != "aspect_question" or aspect_hits >= 3):
        return "strong"
    return "mixed"


@timed("EvidenceSelector")
def evidence_selector(state: WorkflowState) -> WorkflowState:
    candidates = state.get("candidates", [])
    aspect = state.get("aspect")
    query_type = state.get("query_type", "unknown")

    pool = [
        c for c in candidates if len(c["text"]) >= MIN_TEXT_LEN and not _is_generic(c["text"])
    ]
    pool = _dedupe(pool)

    if query_type == "aspect_question" and aspect:
        # Prefer reviews that actually discuss the aspect, but keep the rest as filler.
        on_aspect = [c for c in pool if mentions_aspect(c["text"], aspect)]
        off_aspect = [c for c in pool if c not in on_aspect]
        pool = on_aspect + off_aspect

    picked = pool[:MAX_EVIDENCE]
    picked = _add_rating_diversity(picked, pool)
    picked.sort(key=lambda r: (r["rrf_score"], r["helpful_vote"]), reverse=True)

    strength = grade(picked, query_type, aspect)
    return {
        "evidence": picked,
        "strength": strength,
        "_trace": {
            "summary": f"{len(picked)} reviews selected from {len(candidates)} candidates "
            f"-> retrieval {strength}",
            "details": {
                "selected": len(picked),
                "dropped_short_or_generic": len(candidates) - len(pool),
                "strength": strength,
                "aspect_matches": (
                    sum(1 for r in picked if mentions_aspect(r["text"], aspect)) if aspect else None
                ),
                "review_ids": [r["review_id"] for r in picked],
            },
        },
    }
