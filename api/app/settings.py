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


def load_settings() -> Settings:
    return Settings(
        catalog_path=Path(os.environ.get("CATALOG_PATH", REPO_ROOT / "shared" / "catalog.json")),
        database_path=Path(os.environ.get("DATABASE_PATH", "data/orders.db")),
        web_origin=os.environ.get("WEB_ORIGIN", "http://localhost:3000"),
        owner_key=os.environ.get("OWNER_KEY") or None,
    )
