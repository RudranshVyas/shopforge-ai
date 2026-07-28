from app.agents.validator import validator

REVIEW = {
    "review_id": "B001-abc123",
    "text": "The battery drains fast and the charger gets uncomfortably hot after an hour.",
    "rating": 2.0,
    "helpful_vote": 4,
}


def run(citations, strength="strong", confidence="high"):
    state = {
        "evidence": [REVIEW],
        "strength": strength,
        "insight": {"answer": "a", "citations": citations, "confidence": confidence},
        "agent_trace": [],
    }
    return validator(state)


def test_fabricated_review_id_is_dropped():
    out = run(
        [
            {"review_id": "does-not-exist", "quote": "battery drains fast", "rating": 2},
            {"review_id": REVIEW["review_id"], "quote": "battery drains fast", "rating": 2},
        ]
    )
    assert [c["review_id"] for c in out["insight"]["citations"]] == [REVIEW["review_id"]]
    assert out["dropped_citations"][0]["reason"] == "review_id not in evidence"


def test_close_quote_passes_fuzzy_check():
    out = run([{"review_id": REVIEW["review_id"], "quote": "battery drains fast!", "rating": 2}])
    assert len(out["insight"]["citations"]) == 1


def test_wildly_wrong_quote_is_dropped_and_forces_fallback():
    out = run(
        [
            {
                "review_id": REVIEW["review_id"],
                "quote": "the camera takes stunning night photos",
                "rating": 2,
            }
        ]
    )
    assert out["response_type"] == "fallback"
    assert out["fallback_used"] is True


def test_rating_mismatch_is_corrected_from_source():
    out = run([{"review_id": REVIEW["review_id"], "quote": "battery drains fast", "rating": 5}])
    assert out["insight"]["citations"][0]["rating"] == 2


def test_mixed_retrieval_caps_confidence_at_medium():
    out = run(
        [{"review_id": REVIEW["review_id"], "quote": "battery drains fast", "rating": 2}],
        strength="mixed",
    )
    assert out["insight"]["confidence"] == "medium"


def test_dropped_citation_prevents_high_confidence():
    out = run(
        [
            {"review_id": REVIEW["review_id"], "quote": "battery drains fast", "rating": 2},
            {"review_id": "nope", "quote": "battery drains fast", "rating": 2},
        ]
    )
    assert out["insight"]["confidence"] == "medium"
