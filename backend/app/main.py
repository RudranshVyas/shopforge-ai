from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import assistant, metrics, products
from app.config import settings
from app.services.index_store import get_store


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Load the corpus and the embedding model up front, so the first query is not
    # 20 seconds slower than every subsequent one.
    try:
        get_store().encoder
    except FileNotFoundError:
        pass  # no corpus built yet; endpoints will report it per request
    yield


app = FastAPI(title="ShopForge AI", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(assistant.router)
app.include_router(products.router)
app.include_router(metrics.router)


@app.get("/health")
def health():
    return {"status": "ok", "llm_enabled": settings.llm_enabled}
