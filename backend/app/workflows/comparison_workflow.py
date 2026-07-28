"""Product-vs-product comparison (post-MVP).

Same guarantees as the single-product pipeline: retrieval happens first, the gate
blocks the LLM when either side lacks evidence, the model is constrained to a
schema, and every citation is verified against the evidence of the side that
claimed it -- a review from product A cannot be used to support a claim about B.
"""

from dataclasses import asdict
from typing import Any, Literal, TypedDict

from langgraph.graph import END, START, StateGraph

from app.agents.evidence_selector import select
from app.agents.query_planner import detect_aspect
from app.agents.state import Strength, TraceEntry
from app.agents.trace import timed
from app.agents.validator import verify_citations
from app.services.index_store import get_store
from app.services.llm import LLMError, generate_comparison

MAX_EVIDENCE_CHARS = 600

WEAK_COMPARISON_ANSWER = (
    "I couldn't find enough review evidence on both products to compare them fairly. "
    "Try a broader question, or pick products with more reviews."
)


class ComparisonState(TypedDict, total=False):
    query: str
    parent_asin_a: str
    parent_asin_b: str
    top_k: int

    aspect: str | None
    candidates_a: list[dict[str, Any]]
    candidates_b: list[dict[str, Any]]
    evidence_a: list[dict[str, Any]]
    evidence_b: list[dict[str, Any]]
    strength_a: Strength
    strength_b: Strength

    comparison: dict[str, Any] | None
    verdict: str | None
    dropped_citations: list[dict[str, Any]]
    response_type: Literal["comparison", "fallback"]
    fallback_reason: str | None
    llm_called: bool
    fallback_used: bool
    agent_trace: list[TraceEntry]


@timed("QueryPlanner")
def planner(state: ComparisonState) -> ComparisonState:
    aspect = detect_aspect(state["query"])
    return {
        "aspect": aspect,
        "_trace": {
            "summary": "comparison query" + (f" (aspect: {aspect})" if aspect else ""),
            "details": {
                "aspect": aspect,
                "products": [state["parent_asin_a"], state["parent_asin_b"]],
            },
        },
    }


@timed("DualRetriever")
def dual_retriever(state: ComparisonState) -> ComparisonState:
    store = get_store()
    top_k = state.get("top_k") or 12
    per_side = {
        side: [asdict(h) for h in store.search(state["query"], parent_asin=asin, top_k=top_k)]
        for side, asin in (("a", state["parent_asin_a"]), ("b", state["parent_asin_b"]))
    }
    return {
        "candidates_a": per_side["a"],
        "candidates_b": per_side["b"],
        "_trace": {
            "summary": f"{len(per_side['a'])} + {len(per_side['b'])} candidates "
            "retrieved per product",
            "details": {
                "top_k": top_k,
                "candidates_a": len(per_side["a"]),
                "candidates_b": len(per_side["b"]),
            },
        },
    }


@timed("DualEvidenceSelector")
def dual_evidence_selector(state: ComparisonState) -> ComparisonState:
    query_type = "aspect_question" if state.get("aspect") else "product_summary"
    aspect = state.get("aspect")
    picked_a, strength_a, _ = select(state.get("candidates_a", []), query_type, aspect)
    picked_b, strength_b, _ = select(state.get("candidates_b", []), query_type, aspect)
    return {
        "evidence_a": picked_a,
        "evidence_b": picked_b,
        "strength_a": strength_a,
        "strength_b": strength_b,
        "_trace": {
            "summary": f"A: {len(picked_a)} reviews ({strength_a}) | "
            f"B: {len(picked_b)} reviews ({strength_b})",
            "details": {
                "strength_a": strength_a,
                "strength_b": strength_b,
                "review_ids_a": [r["review_id"] for r in picked_a],
                "review_ids_b": [r["review_id"] for r in picked_b],
            },
        },
    }


def _evidence_block(rows: list[dict]) -> str:
    return "\n\n".join(
        f"[{r['review_id']}] (rating {r['rating']:.0f}, helpful {r['helpful_vote']}): "
        f"{r['text'][:MAX_EVIDENCE_CHARS]}"
        for r in rows
    )


def build_prompt(state: ComparisonState) -> str:
    aspect = state.get("aspect")
    return (
        f"User question: {state['query']}\n"
        "Task: compare the two products below using only their own reviews. Cite reviews of "
        "product A only under product_a, and reviews of product B only under product_b.\n"
        + (f"Aspect in focus: {aspect}\n" if aspect else "")
        + f"\nProduct A ({state['parent_asin_a']}) reviews:\n{_evidence_block(state['evidence_a'])}"
        + f"\n\nProduct B ({state['parent_asin_b']}) reviews:\n"
        + _evidence_block(state["evidence_b"])
    )


@timed("ComparisonGenerator")
def comparison_generator(state: ComparisonState) -> ComparisonState:
    try:
        comparison = generate_comparison(build_prompt(state))
    except LLMError as exc:
        return {
            "comparison": None,
            "llm_called": True,
            "fallback_reason": "llm_error",
            "_trace": {"summary": "Gemini call failed after retry", "details": {"error": str(exc)}},
        }

    payload = comparison.model_dump()
    payload["product_a"]["parent_asin"] = state["parent_asin_a"]
    payload["product_b"]["parent_asin"] = state["parent_asin_b"]
    return {
        "comparison": payload,
        "llm_called": True,
        "_trace": {
            "summary": "comparison generated, model confidence " + payload["confidence"],
            "details": {
                "citations_a": len(payload["product_a"]["citations"]),
                "citations_b": len(payload["product_b"]["citations"]),
            },
        },
    }


@timed("Validator")
def comparison_validator(state: ComparisonState) -> ComparisonState:
    comparison = dict(state.get("comparison") or {})
    # Each side is validated against its OWN evidence, so a review of product A
    # cannot be smuggled in to support a claim about product B.
    sides = {
        "product_a": {r["review_id"]: r for r in state.get("evidence_a", [])},
        "product_b": {r["review_id"]: r for r in state.get("evidence_b", [])},
    }

    dropped_all: list[dict] = []
    kept_total = 0
    for key, by_id in sides.items():
        side = dict(comparison[key])
        kept, dropped, _ = verify_citations(side.get("citations", []), by_id)
        side["citations"] = kept
        comparison[key] = side
        dropped_all.extend({**d, "side": key} for d in dropped)
        kept_total += len(kept)

    if kept_total == 0:
        return {
            "response_type": "fallback",
            "fallback_used": True,
            "fallback_reason": "no citation survived validation",
            "comparison": None,
            "dropped_citations": dropped_all,
            "_trace": {
                "summary": f"all {len(dropped_all)} citations invalid -> fallback",
                "details": {"kept": 0, "dropped": len(dropped_all)},
            },
        }

    confidence = comparison.get("confidence", "low")
    if "mixed" in (state.get("strength_a"), state.get("strength_b")) and confidence == "high":
        confidence = "medium"
    if dropped_all and confidence == "high":
        confidence = "medium"
    comparison["confidence"] = confidence

    return {
        "comparison": comparison,
        "dropped_citations": dropped_all,
        "response_type": "comparison",
        "_trace": {
            "summary": f"{kept_total} citations verified, {len(dropped_all)} dropped, "
            f"confidence {confidence}",
            "details": {
                "kept": kept_total,
                "dropped": len(dropped_all),
                "confidence": confidence,
                "drop_reasons": [d["reason"] for d in dropped_all],
            },
        },
    }


@timed("Fallback")
def fallback(state: ComparisonState) -> ComparisonState:
    reason = state.get("fallback_reason") or "weak retrieval on at least one product"
    return {
        "response_type": "fallback",
        "fallback_used": True,
        "fallback_reason": reason,
        "comparison": None,
        "verdict": WEAK_COMPARISON_ANSWER,
        "_trace": {
            "summary": f"deterministic fallback ({reason}), no comparison generated",
            "details": {
                "reason": reason,
                "strength_a": state.get("strength_a"),
                "strength_b": state.get("strength_b"),
            },
        },
    }


def route_after_selection(state: ComparisonState) -> str:
    """A comparison is only fair if both sides have evidence."""
    if "weak" in (state.get("strength_a"), state.get("strength_b")):
        return "fallback"
    return "comparison_generator"


def route_after_generation(state: ComparisonState) -> str:
    return "validator" if state.get("comparison") else "fallback"


def build_workflow():
    graph = StateGraph(ComparisonState)
    graph.add_node("planner", planner)
    graph.add_node("dual_retriever", dual_retriever)
    graph.add_node("dual_evidence_selector", dual_evidence_selector)
    graph.add_node("comparison_generator", comparison_generator)
    graph.add_node("validator", comparison_validator)
    graph.add_node("fallback", fallback)

    graph.add_edge(START, "planner")
    graph.add_edge("planner", "dual_retriever")
    graph.add_edge("dual_retriever", "dual_evidence_selector")
    graph.add_conditional_edges("dual_evidence_selector", route_after_selection)
    graph.add_conditional_edges("comparison_generator", route_after_generation)
    graph.add_edge("validator", END)
    graph.add_edge("fallback", END)
    return graph.compile()


WORKFLOW = build_workflow()


def run_comparison(
    query: str, parent_asin_a: str, parent_asin_b: str, top_k: int = 12
) -> ComparisonState:
    return WORKFLOW.invoke(
        {
            "query": query,
            "parent_asin_a": parent_asin_a,
            "parent_asin_b": parent_asin_b,
            "top_k": top_k,
            "agent_trace": [],
            "llm_called": False,
            "fallback_used": False,
        }
    )
