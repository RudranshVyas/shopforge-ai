from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    parent_asin: str | None = None
    top_k: int = Field(default=12, ge=1, le=50)
