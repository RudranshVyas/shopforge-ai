# CLAUDE.md

Project-wide notes not already covered in [README.md](README.md). Read that first for
architecture, quickstart, and API shape.

## Windows dev gotchas

- **Import `torch` before `datasets`/`pyarrow`, or it crashes.** `import datasets` (which
  pulls in pyarrow) before `import torch` fails with `OSError: [WinError 1114] A dynamic
  link library (DLL) initialization routine failed` on `torch/lib/c10.dll`. Fixed at the
  root: `backend/app/__init__.py` imports `torch` first, and both `backend/scripts/*.py`
  entry points do `import app` before `pandas`/`datasets`. Keep that ordering in any new
  script that touches both.
- **Cache the `genai.Client`.** A `genai.Client(...)` created fresh per-call gets
  garbage-collected mid-request on this stack, surfacing as `Cannot send a request, as the
  client has been closed`. `app/services/llm.py` wraps the client constructor in
  `@lru_cache(maxsize=1)` — don't remove that.
- Free-tier Gemini keys can have `limit: 0` quota on `gemini-2.0-flash` and `gemini-2.5-flash`
  while `gemini-flash-latest` works fine. If structured-output calls start 429ing, check
  `client.models.list()` for what the key actually has access to before assuming the code
  is broken.

## Git / commits

- **Never add `Co-Authored-By: Claude` (or any Claude/Anthropic reference) to commits.**
  This repo is resume-facing; the trailer's `noreply@anthropic.com` address makes GitHub
  attribute commits to the `claude` account, which then shows up in the Contributors
  sidebar. That sidebar is a cached async index — even rewriting history doesn't clear it
  reliably; recreating the repo at the same name/URL does.

## Corpora

- `data/demo/` (~2k reviews, 50 products) is committed with its prebuilt FAISS/BM25 index —
  this is what a fresh clone runs on. `data/processed/` (full corpus, currently 38,810
  reviews / 800 products) is git-ignored and only exists locally; `index_store.py` prefers
  `processed/` over `demo/` when both are present. Rebuild either with
  `scripts/ingest_reviews.py` + `scripts/build_index.py` (see README Quickstart).
