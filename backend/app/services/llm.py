"""Gemini access, isolated so the rest of the app never touches the SDK.

Uses native structured output: the Pydantic model is handed to the SDK as
`response_schema`, so responses arrive parsed -- no JSON fences, no regex.
"""

from functools import lru_cache

from google import genai
from google.genai import types
from pydantic import BaseModel

from app.config import settings
from app.schemas.insight import ProductComparison, ProductInsight

SYSTEM_INSTRUCTION = """You analyse customer reviews for an e-commerce assistant.

Rules:
- Use ONLY the provided review evidence. Never invent reviews, ratings or claims.
- Every claim in `answer`, `positives` and `complaints` must be supported by at least
  one citation.
- Each quote must be copied verbatim from the cited review text and be 25 words or fewer.
- `review_id` in a citation must be one of the ids given in the evidence block.
- If the evidence is thin, one-sided, or does not really answer the question, say so
  plainly and lower `confidence`.
"""


class LLMError(RuntimeError):
    pass


@lru_cache(maxsize=1)
def _client() -> genai.Client:
    """Cached: a short-lived Client gets garbage-collected mid-request, which
    surfaces as "Cannot send a request, as the client has been closed"."""
    if not settings.gemini_api_key:
        raise LLMError("GEMINI_API_KEY is not set")
    return genai.Client(api_key=settings.gemini_api_key)


def generate_structured(prompt: str, schema: type[BaseModel]) -> BaseModel:
    """One retry, then give up -- the caller falls back to a deterministic response."""
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_INSTRUCTION,
        response_mime_type="application/json",
        response_schema=schema,
        temperature=0.2,
    )
    last_error: Exception | None = None
    for _ in range(2):
        try:
            response = _client().models.generate_content(
                model=settings.gemini_model, contents=prompt, config=config
            )
            if response.parsed is None:
                raise LLMError("Gemini returned no parsable structured output")
            return response.parsed
        except Exception as exc:  # SDK raises a wide range of transport/quota errors
            last_error = exc
    raise LLMError(str(last_error))


def generate_insight(prompt: str) -> ProductInsight:
    return generate_structured(prompt, ProductInsight)


def generate_comparison(prompt: str) -> ProductComparison:
    return generate_structured(prompt, ProductComparison)
