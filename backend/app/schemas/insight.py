"""The schema Gemini is constrained to via native structured output."""

from typing import Literal

from pydantic import BaseModel, Field


class ReviewCitation(BaseModel):
    review_id: str
    quote: str = Field(description="Short verbatim snippet copied from the review, max 25 words")
    rating: int


class ProductInsight(BaseModel):
    answer: str
    positives: list[str]
    complaints: list[str]
    recommendation: str
    citations: list[ReviewCitation]
    confidence: Literal["high", "medium", "low"]
