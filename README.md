# ShopForge AI

Multi-agent RAG over real Amazon product reviews. Ask a question about a product and get a
citation-backed answer where every quote is verified against the source review — with the
whole agent pipeline visible in the UI.

Python · FastAPI · LangGraph · FAISS · BM25 · Gemini · React

---

## Why this exists

Most "AI shopping assistant" demos ask an LLM a question and print whatever comes back.
This one doesn't trust the model:

- Retrieval runs **before** any LLM call, and a **retrieval-strength gate** blocks the model
  entirely when the evidence is thin — weak evidence returns a deterministic fallback rather
  than a confident-sounding guess.
- The LLM is constrained to a **Pydantic schema** through Gemini native structured output —
  no JSON fences, no regex parsing.
- A **Validator agent** fuzzy-matches every quoted span back to its source review. Citations
  that don't match get dropped; if none survive, the whole answer is replaced by the fallback.
- The **agent trace** ships in every API response and renders in the UI, so the pipeline's
  decisions are inspectable rather than asserted.

## Architecture

```
User query (+ optional parent_asin)
    |
    v
QueryPlanner        rule-based intent + aspect detection (no LLM)
    |
    v
Retriever           BM25 (rank-bm25) + FAISS (MiniLM, IndexFlatIP)
    |               merged with Reciprocal Rank Fusion, filtered by parent_asin
    v
EvidenceSelector    length + generic-text filter, near-duplicate collapse (rapidfuzz),
    |               aspect preference, rating diversity, helpful_vote tie-break
    v
Retrieval-strength gate
    |-- retrieval_only --> reviews returned verbatim          (no LLM call)
    |-- weak           --> deterministic fallback             (no LLM call)
    `-- strong / mixed --> InsightGenerator (Gemini, structured output)
                              |
                              v
                          Validator   citation ids, fuzzy quote match >= 85,
                                      rating correction, confidence cap
    |
    v
answer + citations + confidence + agent_trace + latency
```

Built as a LangGraph `StateGraph` over a typed state dict. The gate is a conditional edge
after `EvidenceSelector`, which is what makes "the LLM is never called on weak evidence" a
structural property rather than a prompt instruction.

Design notes worth calling out:

- **RRF, not weighted sums.** BM25 scores and cosine similarities are on incompatible
  scales, so the merge uses `score(d) = Σ 1 / (60 + rank_i(d))` over each retriever's ranks.
- **`parent_asin` is the product key** everywhere, including the API — Amazon variants share
  it, and joining on `asin` would split one product into many.
- **Rating mismatches are corrected, not dropped.** A wrong star rating in a citation is a
  copy error; an unverifiable quote is a fabrication. Only the second one gets dropped.

## Quickstart

The repo ships a small demo corpus **with its prebuilt indexes**, so a fresh clone runs
without touching Hugging Face.

```bash
cp .env.example .env          # add GEMINI_API_KEY (optional — see below)
cd backend
python -m venv .venv && .venv\Scripts\activate    # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app
```

```bash
cd frontend && npm install && npm run dev
```

Open the Vite URL. Search a product ("wireless charger", "case", "screen protector"), pick
one, then ask a question.

**Without a Gemini key the app still runs** — product search, retrieval-only queries and the
fallback path all work; only the generated-insight path is skipped.

### Rebuilding the corpus (optional)

```bash
python scripts/ingest_reviews.py --demo      # ~2k reviews / 50 products -> data/demo/
python scripts/ingest_reviews.py             # full corpus -> data/processed/
python scripts/build_index.py --demo         # FAISS + BM25 + id map
```

Ingestion streams `McAuley-Lab/Amazon-Reviews-2023` (category
`Cell_Phones_and_Accessories`) and stops early — the multi-GB category files are never
downloaded in full.

## Sample queries

| Query | Path taken |
| --- | --- |
| `Most common complaints?` | complaint mining → Gemini → validated citations |
| `Is the charging speed good?` | aspect question (`charging`) → Gemini |
| `Show reviews mentioning overheating` | retrieval only — **never** calls the LLM |
| `How is the camera lens zoom quality` | no aspect evidence → gate blocks LLM → fallback |
| `Which one is better built?` (compare mode) | dual retrieval → per-side validated citations |

## Comparing two products

Compare mode retrieves for each product separately and asks for a `ProductComparison`
schema — a verdict plus strengths, weaknesses and citations per side. Two rules carry over
from the single-product path and one is new:

- The gate requires evidence on **both** sides; if either is weak, no comparison is generated.
- Each side's citations are validated against **that product's own evidence**, so a review of
  product A cannot be used to support a claim about product B. If the model tries it, the
  citation is dropped — and if nothing survives, the whole comparison falls back.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/assistant/query` | main pipeline: answer + citations + agent trace |
| `POST` | `/api/v1/assistant/compare` | two-product comparison, citations validated per side |
| `GET` | `/api/v1/products` | most-reviewed products (landing screen) |
| `GET` | `/api/v1/products/search?q=` | product title search |
| `GET` | `/api/v1/products/{parent_asin}` | metadata, review count, rating histogram |
| `GET` | `/api/v1/metrics` | in-memory counters and rates |
| `GET` | `/health` | liveness |

Metrics are counters only: queries, LLM calls, fallbacks, citation pass/drop, and a rolling
window of the last 100 latencies. Nothing is persisted; there is no token or cost accounting.

## Tests

```bash
cd backend && pytest
```

Covers retrieval relevance, the validator's drop/correct rules (fabricated `review_id`,
paraphrased quote, wrong quote, rating mismatch, all-citations-invalid → fallback), and the
workflow invariants — retrieval-only and weak-evidence queries never reach the LLM, mixed
retrieval caps confidence at medium, and a trace is present on every path. The Gemini client
is stubbed, so the suite makes no network calls.

## Layout

```
backend/
  app/
    agents/       query_planner, retriever, evidence_selector,
                  insight_generator, validator, state, trace
    workflows/    review_workflow.py     # LangGraph assembly + gate
    services/     index_store.py (hybrid search), llm.py (Gemini), metrics.py
    api/          assistant.py, products.py, metrics.py
    resources/    aspects.json           # 14 aspects, keyword lists
  scripts/        ingest_reviews.py, build_index.py
  tests/
data/
  demo/           committed corpus + prebuilt FAISS/BM25 indexes
  processed/      full corpus (git-ignored)
frontend/src/     App + 5 components
```

## License

MIT
