BATTERY_TERMS = ("battery", "charge", "charging", "charger", "power", "drain", "dies", "mah")


def test_battery_query_returns_relevant_hits(store):
    hits = store.search("battery drains fast", top_k=12)
    assert len(hits) >= 5
    for hit in hits[:5]:
        assert any(term in hit.text.lower() for term in BATTERY_TERMS), hit.text[:120]


def test_product_filter_restricts_results(store):
    parent_asin = store.products.iloc[0]["parent_asin"]
    hits = store.search("good quality", parent_asin=parent_asin, top_k=10)
    assert hits
    assert {hit.parent_asin for hit in hits} == {parent_asin}


def test_rrf_keeps_per_retriever_ranks(store):
    hits = store.search("cheap plastic broke", top_k=10)
    assert any(hit.dense_rank is not None for hit in hits)
    assert any(hit.sparse_rank is not None for hit in hits)
    assert all(hit.rrf_score > 0 for hit in hits)


def test_unknown_product_returns_nothing(store):
    assert store.search("battery", parent_asin="NOT_A_REAL_ASIN") == []
