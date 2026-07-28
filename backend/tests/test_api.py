import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.insight import ProductInsight, ReviewCitation

client = TestClient(app)


@pytest.fixture
def stub_llm(monkeypatch):
    def _generate(prompt: str) -> ProductInsight:
        review_id = prompt.split("[", 1)[1].split("]", 1)[0]
        quote = prompt.split("): ", 1)[1][:60]
        return ProductInsight(
            answer="Mixed feedback overall.",
            positives=["good value"],
            complaints=["inconsistent quality"],
            recommendation="Buy on discount.",
            citations=[ReviewCitation(review_id=review_id, quote=quote, rating=3)],
            confidence="medium",
        )

    monkeypatch.setattr("app.agents.insight_generator.generate_insight", _generate)


def test_health():
    assert client.get("/health").json()["status"] == "ok"


def test_product_search_and_detail(store):
    title_word = store.products.iloc[0]["title"].split()[0]
    results = client.get("/api/v1/products/search", params={"q": title_word}).json()
    assert results
    detail = client.get(f"/api/v1/products/{results[0]['parent_asin']}").json()
    assert detail["n_reviews"] > 0
    assert sum(detail["rating_histogram"].values()) == detail["n_reviews"]


def test_unknown_product_returns_404():
    assert client.get("/api/v1/products/NOT_REAL").status_code == 404


def test_query_returns_full_response_shape(store, stub_llm):
    asin = store.products.iloc[0]["parent_asin"]
    body = {"query": "what do people say about this", "parent_asin": asin}
    payload = client.post("/api/v1/assistant/query", json=body).json()

    assert payload["response_type"] in {"generated_insight", "retrieval_only", "fallback"}
    assert payload["agent_trace"]
    assert payload["latency_ms"] > 0
    assert {"llm_called", "fallback_used"} <= payload.keys()


def test_metrics_reflect_three_queries(store, stub_llm):
    asin = store.products.iloc[0]["parent_asin"]
    for query in ("is the battery good", "show reviews mentioning case", "biggest complaints"):
        client.post("/api/v1/assistant/query", json={"query": query, "parent_asin": asin})

    snapshot = client.get("/api/v1/metrics").json()
    assert snapshot["total_queries"] == 3
    assert 0.0 <= snapshot["llm_call_rate"] <= 1.0
    assert snapshot["avg_latency_ms"] > 0
