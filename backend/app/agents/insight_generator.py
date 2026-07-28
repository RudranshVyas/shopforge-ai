"""Turns selected evidence into a structured insight via Gemini."""

from app.agents.state import WorkflowState
from app.agents.trace import timed
from app.services.llm import LLMError, generate_insight

MAX_EVIDENCE_CHARS = 600

TASK_HINTS = {
    "product_summary": "Summarise what customers think of this product overall.",
    "aspect_question": "Answer the question about the specific aspect asked.",
    "complaint_mining": "Identify the most common complaints and how often they recur.",
    "unknown": "Answer the question as directly as the evidence allows.",
}


def build_prompt(state: WorkflowState) -> str:
    blocks = "\n\n".join(
        f"[{r['review_id']}] (rating {r['rating']:.0f}, helpful {r['helpful_vote']}): "
        f"{r['text'][:MAX_EVIDENCE_CHARS]}"
        for r in state["evidence"]
    )
    aspect = state.get("aspect")
    return (
        f"User question: {state['query']}\n"
        f"Task: {TASK_HINTS.get(state.get('query_type', 'unknown'), TASK_HINTS['unknown'])}\n"
        + (f"Aspect in focus: {aspect}\n" if aspect else "")
        + f"Retrieval strength: {state.get('strength')}\n\n"
        f"Review evidence:\n{blocks}"
    )


@timed("InsightGenerator")
def insight_generator(state: WorkflowState) -> WorkflowState:
    try:
        insight = generate_insight(build_prompt(state))
    except LLMError as exc:
        return {
            "insight": None,
            "llm_called": True,
            "fallback_reason": "llm_error",
            "_trace": {"summary": "Gemini call failed after retry", "details": {"error": str(exc)}},
        }

    payload = insight.model_dump()
    return {
        "insight": payload,
        "llm_called": True,
        "_trace": {
            "summary": f"insight generated with {len(payload['citations'])} citations, "
            f"model confidence {payload['confidence']}",
            "details": {
                "evidence_used": len(state["evidence"]),
                "citations_returned": len(payload["citations"]),
                "positives": len(payload["positives"]),
                "complaints": len(payload["complaints"]),
            },
        },
    }
