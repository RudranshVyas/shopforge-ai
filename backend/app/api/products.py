from fastapi import APIRouter, HTTPException, Query

from app.schemas.response import ProductDetail, ProductSummary
from app.services.index_store import get_store

router = APIRouter(prefix="/api/v1/products", tags=["products"])


def _clean(value):
    return None if value is None or value != value else value  # NaN != NaN


def _summary(row) -> ProductSummary:
    return ProductSummary(
        parent_asin=row["parent_asin"],
        title=row["title"],
        average_rating=_clean(row["average_rating"]),
        rating_number=_clean(row["rating_number"]),
        price=_clean(row["price"]),
    )


@router.get("", response_model=list[ProductSummary])
def featured(limit: int = 6) -> list[ProductSummary]:
    """Most-reviewed products in the corpus -- what the landing screen shows."""
    products = get_store().products.sort_values("n_reviews", ascending=False).head(limit)
    return [_summary(row) for _, row in products.iterrows()]


@router.get("/search", response_model=list[ProductSummary])
def search(q: str = Query(min_length=2), limit: int = 10) -> list[ProductSummary]:
    products = get_store().products
    matches = products[products["title"].str.contains(q, case=False, regex=False, na=False)]
    matches = matches.sort_values("rating_number", ascending=False).head(limit)
    return [_summary(row) for _, row in matches.iterrows()]


@router.get("/{parent_asin}", response_model=ProductDetail)
def detail(parent_asin: str) -> ProductDetail:
    store = get_store()
    match = store.products[store.products["parent_asin"] == parent_asin]
    if match.empty:
        raise HTTPException(status_code=404, detail="product not found")
    row = match.iloc[0]

    reviews = store.reviews[store.reviews["parent_asin"] == parent_asin]
    histogram = reviews["rating"].round().astype(int).value_counts().to_dict()
    return ProductDetail(
        parent_asin=row["parent_asin"],
        title=row["title"],
        average_rating=_clean(row["average_rating"]),
        rating_number=_clean(row["rating_number"]),
        price=_clean(row["price"]),
        main_category=_clean(row["main_category"]),
        description=_clean(row["description"]),
        n_reviews=len(reviews),
        rating_histogram={star: int(histogram.get(star, 0)) for star in range(1, 6)},
    )
