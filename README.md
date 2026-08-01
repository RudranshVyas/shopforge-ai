# ShopForge AI

**[Live demo](https://54-206-5-99.sslip.io)**

Ask a question about a product, get an answer built from real Amazon reviews. Every claim
links back to the review it came from, and clicking a citation expands the full review with
the quoted span highlighted.

Python · FastAPI · LangGraph · FAISS · BM25 · Gemini · React

## How it works

```
Query -> QueryPlanner -> Retriever -> EvidenceSelector -> gate -> InsightGenerator -> Validator
                         BM25 + FAISS                     |
                         merged by RRF                    `-- weak evidence: skip the LLM
```

Retrieval runs before the model does. If the evidence is thin, a gate returns a plain answer
and the LLM is never called. When it does run, Gemini is constrained to a Pydantic schema,
and a validator checks every quote against its source review, dropping the ones that don't
match. The pipeline trace ships with each response and renders in the UI.

Dense and sparse results merge with Reciprocal Rank Fusion rather than a weighted sum, since
BM25 scores and cosine similarities aren't on a comparable scale.

Compare mode runs the same pipeline against two products, validating each side's citations
against that product's own reviews.

## Running it

A demo corpus with prebuilt indexes is committed, so a fresh clone works right away.

```bash
cp .env.example .env          # add GEMINI_API_KEY
cd backend
python -m venv .venv && .venv\Scripts\activate    # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app
```

```bash
cd frontend && npm install && npm run dev
```

Tests: `cd backend && pytest` (34 tests, Gemini stubbed, runs offline).

Rebuilding the corpus is optional. `scripts/ingest_reviews.py` streams
`McAuley-Lab/Amazon-Reviews-2023` and stops early; `scripts/build_index.py` builds the FAISS
and BM25 indexes.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/assistant/query` | answer + citations + trace |
| `POST` | `/api/v1/assistant/compare` | two-product comparison |
| `GET` | `/api/v1/products/search?q=` | product search |
| `GET` | `/api/v1/products/{parent_asin}` | metadata + rating histogram |
| `GET` | `/api/v1/metrics` | query counts, LLM call rate, citation pass rate |

Deployed on AWS EC2 behind nginx. Setup scripts in `deploy/`.

## License

MIT
