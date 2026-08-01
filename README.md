# ShopForge AI

**[Live demo](https://54-206-5-99.sslip.io)**

Ask a question about a product and get an answer built from real Amazon reviews, with every
claim traced back to the review it came from. Click any citation and it expands to the full
review with the quoted span highlighted.

Python · FastAPI · LangGraph · FAISS · BM25 · Gemini · React

## What makes it different

The model never sees a question until retrieval has already run. If the evidence is thin, a
gate in the pipeline returns a plain answer and the model is skipped entirely. When the model
does run, it is constrained to a Pydantic schema through Gemini's structured output, and a
validator then checks every quote it produced against the source review. Quotes that don't
match get dropped.

The full pipeline trace ships with every response and renders in the UI, so you can see which
path a question took and why.

## Architecture

```
User query (+ optional product)
    |
    v
QueryPlanner        rule-based intent + aspect detection (no LLM)
    |
    v
Retriever           BM25 (rank-bm25) + FAISS (MiniLM, IndexFlatIP)
    |               merged with Reciprocal Rank Fusion
    v
EvidenceSelector    dedupe, aspect preference, rating diversity
    |
    v
Retrieval-strength gate
    |-- retrieval_only --> reviews returned as-is          (no LLM call)
    |-- weak           --> deterministic fallback          (no LLM call)
    `-- strong / mixed --> InsightGenerator (Gemini, structured output)
                              |
                              v
                          Validator   citation ids, fuzzy quote match,
                                      rating correction, confidence cap
    |
    v
answer + citations + confidence + trace
```

Built as a LangGraph `StateGraph`. The gate is a conditional edge, so "the LLM is never
called on weak evidence" holds structurally instead of depending on a prompt.

Two decisions worth noting. Dense and sparse results are merged with Reciprocal Rank Fusion
(`score = Σ 1 / (60 + rank)`) because BM25 scores and cosine similarities aren't on a
comparable scale, so summing them directly would be meaningless. And products are keyed on
`parent_asin` throughout, since Amazon variants share it and keying on `asin` would split one
product into several.

## Running it

A small demo corpus with prebuilt indexes is committed, so a fresh clone works immediately.

```bash
cp .env.example .env          # add your GEMINI_API_KEY
cd backend
python -m venv .venv && .venv\Scripts\activate    # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app
```

```bash
cd frontend && npm install && npm run dev
```

Search a product, pick one, ask a question. The app also runs without an API key, using
retrieval-only queries and the fallback path.

Rebuilding the corpus from scratch is optional:

```bash
python scripts/ingest_reviews.py --demo    # ~2k reviews / 50 products
python scripts/ingest_reviews.py           # full corpus
python scripts/build_index.py --demo       # FAISS + BM25 + id map
```

Ingestion streams `McAuley-Lab/Amazon-Reviews-2023` and stops early, so the multi-GB category
files are never downloaded in full.

## Sample queries

| Query | What happens |
| --- | --- |
| `Most common complaints?` | complaint mining, Gemini, validated citations |
| `Is the charging speed good?` | aspect question routed on `charging` |
| `Show reviews mentioning overheating` | retrieval only, no LLM call |
| `How is the camera lens zoom quality` | no matching evidence, gate blocks the LLM |
| `Which one is better built?` | compare mode, dual retrieval |

## Comparing two products

Compare mode retrieves for each product separately and returns a verdict with strengths,
weaknesses and citations per side. Both sides need evidence before a comparison is generated,
and each side's citations are validated against that product's own reviews, so a review of
product A can't be used to support a claim about product B.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/assistant/query` | answer + citations + trace |
| `POST` | `/api/v1/assistant/compare` | two-product comparison |
| `GET` | `/api/v1/products` | most-reviewed products |
| `GET` | `/api/v1/products/search?q=` | product title search |
| `GET` | `/api/v1/products/{parent_asin}` | metadata, review count, rating histogram |
| `GET` | `/api/v1/metrics` | query counts, LLM call rate, citation pass rate |
| `GET` | `/health` | liveness |

## Tests

```bash
cd backend && pytest
```

34 tests covering retrieval relevance, the validator's drop and correct rules (fabricated
review ids, paraphrased quotes, wrong quotes, rating mismatches), and the workflow invariants:
retrieval-only and weak-evidence queries never reach the LLM, mixed retrieval caps confidence
at medium, and a trace is present on every path. The Gemini client is stubbed, so the suite
runs offline.

## Layout

```
backend/
  app/
    agents/       query_planner, retriever, evidence_selector,
                  insight_generator, validator, state, trace
    workflows/    review_workflow.py, comparison_workflow.py
    services/     index_store.py, llm.py, metrics.py
    api/          assistant.py, products.py, metrics.py
    resources/    aspects.json
  scripts/        ingest_reviews.py, build_index.py
  tests/
data/demo/        committed corpus + prebuilt indexes
frontend/src/     App + components
deploy/           EC2 + nginx setup
```

Deployed on AWS EC2 behind nginx. Setup scripts are in `deploy/`.

## License

MIT
