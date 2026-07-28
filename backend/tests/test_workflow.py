"""Workflow-level invariants. The Gemini client is never called for real here."""

import pytest

from app.schemas.insight import ProductInsight, ReviewCitation
from app.workflows import review_workflow


@pytest.fixture
def fake_llm(monkeypatch):
    """Cite the first piece of evidence verbatim so the validator has something valid."""
    calls = []

    def _generate(prompt: str) -> ProductInsight:
        calls.append(prompt)
        review_id = prompt.split("[", 1)[1].split("]", 1)[0]
        quote = prompt.split("): ", 1)[1][:60]
        return ProductInsight(
            answer="Customers are mixed on this product.",
            positives=["works as described"],
            complaints=["quality varies"],
            recommendation="Fine for light use.",
            citations=[ReviewCitation(review_id=review_id, quote=quote, rating=3)],
            confidence="high",
        )

    monkeypatch.setattr("app.agents.insight_generator.generate_insight", _generate)
    return calls


def test_retrieval_only_never_calls_llm(store, fake_llm):
    asin = store.products.iloc[0]["parent_asin"]
    out = review_workflow.run_workflow("show reviews mentioning battery", asin)
    assert out["response_type"] == "retrieval_only"
    assert out["llm_called"] is False
    assert fake_llm == []


def test_gibberish_without_product_falls_back_without_llm(fake_llm):
    out = review_workflow.run_workflow("qwertyuiop zxcvbnm asdfgh", None)
    assert out["response_type"] == "fallback"
    assert out["llm_called"] is False
    assert out["fallback_used"] is True
    assert fake_llm == []


def test_trace_is_present_on_every_path(store, fake_llm):
    asin = store.products.iloc[0]["parent_asin"]
    for query in ("show reviews mentioning battery", "what do people say about this"):
        out = review_workflow.run_workflow(query, asin)
        assert out["agent_trace"], query
        assert out["agent_trace"][0]["agent"] == "QueryPlanner"
        assert all(step["duration_ms"] >= 0 for step in out["agent_trace"])


def test_generated_insight_path_validates_citations(store, fake_llm):
    asin = store.products.iloc[0]["parent_asin"]
    out = review_workflow.run_workflow("what do people say about this", asin)
    if out["response_type"] != "generated_insight":
        pytest.skip(f"retrieval was {out.get('strength')} for this product")
    assert out["llm_called"] is True
    assert len(fake_llm) == 1
    evidence_ids = {r["review_id"] for r in out["evidence"]}
    assert all(c["review_id"] in evidence_ids for c in out["insight"]["citations"])
