from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.settings import load_settings

settings = load_settings()

app = FastAPI(title="Tasty Sweety API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.web_origin],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Idempotency-Key", "X-Owner-Key"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
