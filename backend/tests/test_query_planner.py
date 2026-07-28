import pytest

from app.agents.query_planner import classify, detect_aspect


@pytest.mark.parametrize(
    "query,expected",
    [
        ("Is the battery good?", "battery"),
        ("does the mic pick up my voice", "mic"),
        ("how is the sound quality", "sound"),
        ("did it arrive on time", "delivery"),
        ("nothing relevant here", None),
    ],
)
def test_detect_aspect(query, expected):
    assert detect_aspect(query) == expected


@pytest.mark.parametrize(
    "query,parent_asin,expected",
    [
        ("show reviews mentioning overheating", "B01", "retrieval_only"),
        ("what are the most common complaints", "B01", "complaint_mining"),
        ("is the battery good", "B01", "aspect_question"),
        ("what do people say about this", "B01", "product_summary"),
        ("what do people say about this", None, "unknown"),
    ],
)
def test_classify(query, parent_asin, expected):
    assert classify(query, parent_asin)[0] == expected
