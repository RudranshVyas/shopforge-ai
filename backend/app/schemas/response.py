from typing import Any, Literal

from pydantic import BaseModel

from app.schemas.insight import ReviewCitation


class TraceEntry(BaseModel):
    agent: str
    summary: str
    details: dict[str, Any] = {}
    duration_ms: float


class ReviewOut(BaseModel):
    review_id: str
    parent_asin: str
    title: str
    text: str
    rating: float
    helpful_vote: int


class QueryResponse(BaseModel):
    response_type: Literal["generated_insight", "retrieval_only", "fallback"]
    answer: str | None = None
    positives: list[str] = []
    complaints: list[str] = []
    recommendation: str | None = None
    confidence: Literal["high", "medium", "low"] | None = None
    citations: list[ReviewCitation] = []
    reviews: list[ReviewOut] = []
    agent_trace: list[TraceEntry]
    latency_ms: float
    llm_called: bool
    fallback_used: bool


class ComparisonSideOut(BaseModel):
    parent_asin: str
    title: str | None = None
    strengths: list[str] = []
    weaknesses: list[str] = []
    citations: list[ReviewCitation] = []
    reviews: list[ReviewOut] = []


class CompareResponse(BaseModel):
    response_type: Literal["comparison", "fallback"]
    verdict: str | None = None
    product_a: ComparisonSideOut | None = None
    product_b: ComparisonSideOut | None = None
    confidence: Literal["high", "medium", "low"] | None = None
    agent_trace: list[TraceEntry]
    latency_ms: float
    llm_called: bool
    fallback_used: bool


class ProductSummary(BaseModel):
    parent_asin: str
    title: str
    average_rating: float | None = None
    rating_number: int | None = None
    price: float | None = None


class ProductDetail(ProductSummary):
    main_category: str | None = None
    description: str | None = None
    n_reviews: int
    rating_histogram: dict[int, int]
