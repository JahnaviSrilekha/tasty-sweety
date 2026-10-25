# tasty-sweety
wholesale shop that sells tasty sweets

Built spec first: start with [specs/](specs/README.md).

| Folder | What |
|---|---|
| `specs/` | Constitution and feature specs (requirements, design, contracts, tasks) |
| `shared/` | Catalog and test cases used by both web and api |
| `web/` | Next.js 16 PWA (mobile first) |
| `api/` | FastAPI backend (Python, uv) |
| `scripts/` | `ac_coverage.py`: lists acceptance criteria with no test |

## Run the tests

```bash
cd api && uv sync && uv run pytest
```

```bash
cd web && npm install && npm test
```

```bash
python3 scripts/ac_coverage.py
```
