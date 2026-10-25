import os
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Settings:
    catalog_path: Path
    database_path: Path
    web_origin: str
    owner_key: str | None
    ai_enabled: bool = False
    aws_region: str = "us-east-1"
    model_id: str = "anthropic.claude-opus-5-5"
    ai_timeout_seconds: float = 10.0


def load_settings() -> Settings:
    return Settings(
        catalog_path=Path(os.environ.get("CATALOG_PATH", REPO_ROOT / "shared" / "catalog.json")),
        database_path=Path(os.environ.get("DATABASE_PATH", "data/orders.db")),
        web_origin=os.environ.get("WEB_ORIGIN", "http://localhost:3000"),
        owner_key=os.environ.get("OWNER_KEY") or None,
        ai_enabled=os.environ.get("AI_ENABLED", "false").lower() in ("1", "true", "yes"),
        aws_region=os.environ.get("AWS_REGION", "us-east-1"),
        model_id=os.environ.get("MODEL_ID", "anthropic.claude-opus-5-5"),
        ai_timeout_seconds=float(os.environ.get("AI_TIMEOUT_SECONDS", "10")),
    )
