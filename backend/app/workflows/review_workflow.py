"""LangGraph assembly.

    QueryPlanner -> Retriever -> EvidenceSelector -> [gate] -> InsightGenerator -> Validator
                                                        |-> retrieval_only
                                                        `-> fallback (no LLM call)
"""

from langgraph.graph import END, START, StateGraph

from app.agents.evidence_selector import evidence_selector
from app.agents.insight_generator import insight_generator
from app.agents.query_planner import query_planner
from app.agents.retriever import retriever
from app.agents.state import WorkflowState
from app.agents.trace import timed
from app.agents.validator import validator

FALLBACK_ANSWER = (
    "I couldn't find enough reliable review evidence to answer this. Try selecting a "
    "specific product or asking about a broader aspect (battery, durability, sound...)."
)
NO_PRODUCT_ANSWER = (
    "I need a product to look at before I can answer. Search for one above and select it, "
    "then ask again."
)


@timed("Fallback")
def fallback(state: WorkflowState) -> WorkflowState:
    reason = state.get("fallback_reason") or (
        "no product selected" if state.get("query_type") == "unknown" else "weak retrieval"
    )
    return {
        "response_type": "fallback",
        "fallback_used": True,
        "fallback_reason": reason,
        "insight": {
            "answer": NO_PRODUCT_ANSWER if reason == "no product selected" else FALLBACK_ANSWER
        },
        "_trace": {
            "summary": f"deterministic fallback ({reason}), no LLM call",
            "details": {"reason": reason, "evidence_count": len(state.get("evidence", []))},
        },
    }


@timed("RetrievalOnly")
def retrieval_only(state: WorkflowState) -> WorkflowState:
    return {
        "response_type": "retrieval_only",
        "_trace": {
            "summary": f"returning {len(state.get('evidence', []))} reviews verbatim, no LLM call",
            "details": {"review_ids": [r["review_id"] for r in state.get("evidence", [])]},
        },
    }


def route_after_planner(state: WorkflowState) -> str:
    # Nothing to retrieve against and nothing to infer -- stop before touching the index.
    if state.get("query_type") == "unknown" and not state.get("parent_asin"):
        return "fallback"
    return "retriever"


def route_after_selection(state: WorkflowState) -> str:
    """The retrieval-strength gate: this is what keeps the LLM off weak evidence."""
    if state.get("query_type") == "retrieval_only":
        return "retrieval_only"
    if state.get("strength") == "weak":
        return "fallback"
    return "insight_generator"


def route_after_generation(state: WorkflowState) -> str:
    return "validator" if state.get("insight") else "fallback"


def build_workflow():
    graph = StateGraph(WorkflowState)
    graph.add_node("query_planner", query_planner)
    graph.add_node("retriever", retriever)
    graph.add_node("evidence_selector", evidence_selector)
    graph.add_node("insight_generator", insight_generator)
    graph.add_node("validator", validator)
    graph.add_node("fallback", fallback)
    graph.add_node("retrieval_only", retrieval_only)

    graph.add_edge(START, "query_planner")
    graph.add_conditional_edges("query_planner", route_after_planner)
    graph.add_edge("retriever", "evidence_selector")
    graph.add_conditional_edges("evidence_selector", route_after_selection)
    graph.add_conditional_edges("insight_generator", route_after_generation)
    graph.add_edge("validator", END)
    graph.add_edge("fallback", END)
    graph.add_edge("retrieval_only", END)
    return graph.compile()


WORKFLOW = build_workflow()


def run_workflow(query: str, parent_asin: str | None = None, top_k: int = 12) -> WorkflowState:
    return WORKFLOW.invoke(
        {
            "query": query,
            "parent_asin": parent_asin,
            "top_k": top_k,
            "agent_trace": [],
            "llm_called": False,
            "fallback_used": False,
        }
    )
