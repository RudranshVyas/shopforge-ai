"""Phase 8: product comparison. Gemini is stubbed; no live calls."""

import pytest

from app.schemas.insight import ComparisonSide, ProductComparison, ReviewCitation
from app.workflows import comparison_workflow


def _two_products(store):
    return store.products.iloc[0]["parent_asin"], store.products.iloc[1]["parent_asin"]


def _first_citation(block: str) -> ReviewCitation:
    review_id = block.split("[", 1)[1].split("]", 1)[0]
    quote = block.split("): ", 1)[1][:50]
    return ReviewCitation(review_id=review_id, quote=quote, rating=3)


@pytest.fixture
def fake_llm(monkeypatch):
    calls = []

    def _generate(prompt: str) -> ProductComparison:
        calls.append(prompt)
        block_a, block_b = prompt.split("Product B (")
        return ProductComparison(
            verdict="Product A edges it out.",
            product_a=ComparisonSide(
                parent_asin="A", strengths=["holds up"], weaknesses=[],
                citations=[_first_citation(block_a)],
            ),
            product_b=ComparisonSide(
                parent_asin="B", strengths=[], weaknesses=["mixed reports"],
                citations=[_first_citation(block_b)],
            ),
            confidence="high",
        )

    monkeypatch.setattr("app.workflows.comparison_workflow.generate_comparison", _generate)
    return calls


def test_comparison_validates_each_side_against_its_own_evidence(store, fake_llm):
    asin_a, asin_b = _two_products(store)
    out = comparison_workflow.run_comparison("which is better built", asin_a, asin_b)
    if out["response_type"] == "fallback":
        pytest.skip(f"weak retrieval: {out.get('strength_a')}/{out.get('strength_b')}")

    ids_a = {r["review_id"] for r in out["evidence_a"]}
    ids_b = {r["review_id"] for r in out["evidence_b"]}
    assert all(c["review_id"] in ids_a for c in out["comparison"]["product_a"]["citations"])
    assert all(c["review_id"] in ids_b for c in out["comparison"]["product_b"]["citations"])
    assert out["comparison"]["product_a"]["parent_asin"] == asin_a
    assert out["comparison"]["product_b"]["parent_asin"] == asin_b


def test_citation_from_the_wrong_side_is_dropped(store, monkeypatch):
    """A review of product A must not be usable as evidence about product B."""
    asin_a, asin_b = _two_products(store)

    def _cross_cite(prompt: str) -> ProductComparison:
        block_a = prompt.split("Product B (")[0]
        stolen = _first_citation(block_a)  # an A review, cited under B
        return ProductComparison(
            verdict="B wins.",
            product_a=ComparisonSide(parent_asin="A", strengths=[], weaknesses=[], citations=[]),
            product_b=ComparisonSide(
                parent_asin="B", strengths=["better"], weaknesses=[], citations=[stolen]
            ),
            confidence="high",
        )

    monkeypatch.setattr("app.workflows.comparison_workflow.generate_comparison", _cross_cite)
    out = comparison_workflow.run_comparison("which is better built", asin_a, asin_b)
    assert out["response_type"] == "fallback"
    assert out["fallback_used"] is True


def test_trace_present_and_llm_flagged(store, fake_llm):
    asin_a, asin_b = _two_products(store)
    out = comparison_workflow.run_comparison("which lasts longer", asin_a, asin_b)
    agents = [step["agent"] for step in out["agent_trace"]]
    assert agents[:3] == ["QueryPlanner", "DualRetriever", "DualEvidenceSelector"]
    assert out["llm_called"] is True


def test_weak_side_blocks_the_llm(store, fake_llm):
    asin_a, _ = _two_products(store)
    # A product with no reviews at all cannot be compared -- gate must fire first.
    out = comparison_workflow.run_comparison("which is better", asin_a, "NOT_A_REAL_ASIN")
    assert out["response_type"] == "fallback"
    assert out["llm_called"] is False
    assert fake_llm == []
