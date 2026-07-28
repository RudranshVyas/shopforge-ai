import pytest

from app.services.index_store import get_store, resolve_corpus_dir
from app.services.metrics import metrics


@pytest.fixture(scope="session")
def store():
    """Skip index-backed tests when no corpus has been built yet."""
    try:
        resolve_corpus_dir()
    except FileNotFoundError as exc:
        pytest.skip(str(exc))
    return get_store()


@pytest.fixture(autouse=True)
def clean_metrics():
    metrics.reset()
    yield
