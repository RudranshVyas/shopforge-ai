from fastapi import APIRouter

from app.services.metrics import metrics

router = APIRouter(prefix="/api/v1", tags=["metrics"])


@router.get("/metrics")
def read_metrics() -> dict:
    return metrics.snapshot()
