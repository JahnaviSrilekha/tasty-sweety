# 001 Sweet ordering: design

Status: **Approved** (2026-10-25)
Requirements: [requirements.md](requirements.md) · Contracts: [contracts/](contracts/)

## 1. Architecture

```
┌──────────────── web/ (Next.js 16 PWA) ─────────────────┐
│ Pages: catalog · cart · checkout · order · owner        │
│ lib/: money, pricing, cart reducer, AG-UI client        │  deterministic, unit-tested
│ public/sw.js: service worker (offline shell + catalog)  │
└───────────┬──────────────────────────┬─────────────────┘
            │ REST (JSON)              │ AG-UI events (SSE)
┌───────────▼──────────────────────────▼─────────────────┐
│ api/ (FastAPI, Python 3.13)                             │
│  catalog · pricing · orders + state machine · SQLite    │  deterministic, unit-tested
│  agent: AG-UI run ─► parser (AI or rules) ─► validator  │
└───────────────────────────┬────────────────────────────┘
                            │ only the message + catalog names
                    Claude on Amazon Bedrock (optional)
```

`shared/` holds the files both sides use: the catalog, its JSON Schema, and pricing test cases.

## 2. Repository layout

```
tasty-sweety/
  specs/                      constitution and feature specs
  shared/
    catalog.json              the one catalog (AC-1.5)
    catalog.schema.json       its JSON Schema
    pricing-cases.json        input → expected total, run by both test suites
    checkout-cases.json       customer details → valid or not, run by both test suites
  web/
    scripts/sync-catalog.mjs  copies shared/catalog.json into src/generated/ before dev and build
    src/app/                  page.tsx (catalog), cart/, checkout/, orders/[id]/, owner/, manifest.ts
    src/lib/                  money.ts, pricing.ts, cart.ts, catalog.ts, agui.ts, api.ts, schemas.ts
    src/components/
    public/sw.js, public/icons/
  api/
    app/                      main.py, settings.py, catalog.py, pricing.py, orders.py,
                              agent.py, proposal.py, parser_rules.py, parser_ai.py
    tests/
```

## 3. Data model

### Catalog (`shared/catalog.json`)
```json
{
  "currency": "INR",
  "sizes": [
    { "id": "small",  "label": "Small",  "grams": 250 },
    { "id": "medium", "label": "Medium", "grams": 500 },
    { "id": "large",  "label": "Large",  "grams": 1000 }
  ],
  "sweets": [
    {
      "id": "kaju-katli",
      "name": "Kaju Katli",
      "description": "Thin cashew fudge diamonds with silver leaf.",
      "image": "/sweets/kaju-katli.webp",
      "tags": ["cashew", "barfi", "diwali"],
      "aliases": ["kaju", "katli", "kaju barfi"],
      "available": true,
      "prices": { "small": 32000, "medium": 62000, "large": 120000 }
    }
  ]
}
```
Prices are integers in **paise** (32000 = ₹320). Every sweet must have all three sizes.
`aliases` help the rule-based parser.

Starting catalog (placeholder prices, ₹ for small / medium / large):

| id | Name | Small | Medium | Large |
|---|---|---|---|---|
| kaju-katli | Kaju Katli | 320 | 620 | 1,200 |
| motichoor-ladoo | Motichoor Ladoo | 180 | 340 | 650 |
| gulab-jamun | Gulab Jamun | 160 | 300 | 580 |
| rasgulla | Rasgulla | 150 | 280 | 540 |
| soan-papdi | Soan Papdi | 120 | 220 | 420 |
| mysore-pak | Mysore Pak | 220 | 420 | 800 |

### Line, cart, order
```ts
type SizeId = "small" | "medium" | "large";
type Line   = { sweetId: string; size: SizeId; qty: number };   // qty 1..99
type Cart   = { lines: Line[] };                                  // one line per (sweetId, size)
type Order  = {
  id: string;               // TS-YYYYMMDD-NNNN
  lines: (Line & { unitPrice: number; lineTotal: number })[];
  total: number;            // paise, worked out by the server
  customer: { name: string; phone: string; fulfilment: "pickup" | "delivery"; address?: string };
  stage: Stage;
  history: { from: Stage | null; to: Stage; by: "customer" | "owner"; at: string }[];
  createdAt: string;
};
```

## 4. Deterministic core

### Pricing (AC-2.3, AC-4.2)
`lineTotal = prices[sweetId][size] * qty`, and `total = sum(lineTotal)`. Integers only. The TS
(`web/src/lib/pricing.ts`) and Python (`api/app/pricing.py`) versions are each about ten lines
and both must pass every case in `shared/pricing-cases.json`.
Display: `formatINR(paise)` → `"₹1,200"` using `Intl.NumberFormat("en-IN")` (AC-1.2).

### Cart reducer (REQ-2)
A pure function `cartReducer(cart, action) → cart`. Actions: `add`, `setQty`, `remove`,
`addMany` (from an accepted proposal), `clear`, `reconcile(catalog)` (AC-2.5, returns the
removed lines too). Quantities are clamped to 1..99 and lines merge by `(sweetId, size)`.
The cart is saved in `localStorage` under `ts.cart.v1`, with every read and write in try/catch
(AC-2.4).

### Order state machine (REQ-5)
```
placed ──► confirmed ──► ready ──► completed
  │            │
  └──► cancelled ◄┘
```
A transition table in `api/app/orders.py`. `transition(order, to, by)` raises
`InvalidTransition` for anything not in the table (AC-5.2) and appends to `history` (AC-5.3).

### Order numbers and idempotency (AC-4.4, AC-4.5)
- `TS-` + date (Asia/Kolkata) + a 4-digit daily counter, assigned inside the same SQLite
  transaction that saves the order.
- The client creates a UUID `Idempotency-Key` once per checkout attempt. The server stores
  key → order id. A repeated key returns the first order with `200` instead of `201`.

### Validation
- Web: Zod schemas in `web/src/lib/schemas.ts` for the checkout form (AC-4.1).
- API: Pydantic models that match `contracts/openapi.yaml`. The server checks everything again.
- Phone: `^[6-9]\d{9}$`. Name 2–60, address 10–300 characters after trimming.

## 5. Order assistant (REQ-3)

### Flow
```
customer text ─► POST /agent (AG-UI RunAgentInput)
                   │
                   ├─ parser_ai (if configured) ── fails/timeout ─► parser_rules
                   │        returns RawProposal (Pydantic, schema-checked)
                   ▼
                proposal.validate(raw, catalog)      ← plain code (AC-3.3, AC-3.4)
                   │  → accepted lines + rejected items with reasons
                   ▼
           AG-UI events streamed back ─► web shows proposal card ─► customer taps
           "Add to cart" ─► cartReducer(addMany)     (AC-3.5)
```

### AI parser (`parser_ai.py`)
- Anthropic Python SDK with the Bedrock client: `AnthropicBedrockMantle(aws_region=AWS_REGION)`,
  model `anthropic.claude-opus-5-5` by default (env `MODEL_ID`), `output_config.effort = "low"`
  because the task is short.
- Structured output through `client.messages.parse(output_format=RawProposal)`, so the reply is
  always a valid `RawProposal` or an error.
- The system prompt holds the catalog's ids, names, aliases and sizes. This part doesn't change
  between requests, so it is marked for prompt caching. The user's message is the only other
  input (AC-3.7).
- 10 s timeout (AC-3.6). Any error, refusal or timeout → rule-based parser, with
  `parser: "rules"` set in the result.

```python
class RawLine(BaseModel):
    sweet_id: str            # must match a catalog id; the validator checks it
    size: Literal["small", "medium", "large"] | None   # None → "medium", size assumed
    qty: int
class RawProposal(BaseModel):
    lines: list[RawLine]
    not_understood: list[str]   # parts of the text the model could not map
    reply: str                  # one short friendly sentence
```

### Rule-based parser (`parser_rules.py`)
No AI and no randomness, so it is fully repeatable:
1. Lowercase, split on `and`, `,`, `+`, `&` and new lines.
2. In each part, find the quantity (digits or the words one–twenty, default 1) and the size
   (`small|s|250g|quarter`, `medium|m|500g|half`, `large|l|big|1kg|kilo`).
3. Match the remaining words to a sweet by exact id, name or alias, then by
   `difflib.SequenceMatcher` ratio ≥ 0.8. Ties go to the earliest sweet in the catalog.
4. Anything that doesn't match goes into `not_understood`.

### Proposal validator (`proposal.py`)
Drops lines with an unknown id, an unavailable sweet or a qty outside 1–99, with a reason for
each (AC-3.3). Fills `size=None` as `medium` with `sizeAssumed: true` (AC-3.4). Merges
duplicate lines. Adds unit prices and totals from the catalog.

### AG-UI event sequence
Endpoint `POST /agent`, `Accept: text/event-stream`. Body is AG-UI `RunAgentInput`
(`threadId`, `runId`, `messages`, `state`, `tools`, `context`, `forwardedProps`).
Built with the `ag-ui-protocol` Python package (`ag_ui.core` events, `ag_ui.encoder.EventEncoder`).

| # | Event | Payload |
|---|---|---|
| 1 | `RUN_STARTED` | threadId, runId |
| 2 | `STEP_STARTED` | stepName `"understand"` |
| 3 | `STEP_FINISHED` | stepName `"understand"` |
| 4 | `TOOL_CALL_START` | toolCallId, toolCallName `"propose_cart_lines"` |
| 5 | `TOOL_CALL_ARGS` | delta: JSON of `Proposal` (below) |
| 6 | `TOOL_CALL_END` | toolCallId |
| 7–9 | `TEXT_MESSAGE_START` / `_CONTENT` / `_END` | the short reply, streamed |
| 10 | `RUN_FINISHED` | threadId, runId |
| — | `RUN_ERROR` | message, code, sent instead of 10 when something fails unexpectedly |

`propose_cart_lines` is a **frontend tool**: the web app renders it as the proposal card. It does
not start a second run in 001.

```ts
type Proposal = {
  parser: "ai" | "rules";
  lines: { sweetId: string; name: string; size: SizeId; qty: number;
           unitPrice: number; lineTotal: number; sizeAssumed: boolean }[];
  rejected: { text: string; reason: "unknown_sweet" | "unavailable" | "bad_quantity" | "not_understood" }[];
  total: number;
};
```

Web client: `web/src/lib/agui.ts` uses `@ag-ui/client` (`HttpAgent`) if it fits Next 16 and
React 19 when we install it; otherwise a small `fetch` + SSE reader that handles the events above.
Unknown event types are ignored.

## 6. HTTP API
Full contract: [contracts/openapi.yaml](contracts/openapi.yaml).

| Method | Path | Purpose | REQ |
|---|---|---|---|
| GET | `/catalog` | Catalog JSON | 1 |
| POST | `/quote` | Lines → priced lines and total | 4.3 |
| POST | `/orders` | Place an order (`Idempotency-Key` header) | 4 |
| GET | `/orders/{id}` | Order and stage, without customer details | 5.1, 5.5 |
| GET | `/owner/orders` | All orders, newest first (`X-Owner-Key`) | 5.4 |
| POST | `/owner/orders/{id}/stage` | Change stage (`X-Owner-Key`) | 5.2–5.4 |
| POST | `/agent` | AG-UI assistant run (SSE) | 3 |
| GET | `/health` | Liveness | — |

Errors use one shape: `{ "error": { "code": "invalid_transition", "message": "..." } }`.
The web app calls the API at `NEXT_PUBLIC_API_URL`. The API allows that origin through CORS.

## 7. PWA and mobile (REQ-6)
- `web/src/app/manifest.ts`: name "Tasty Sweety", `display: "standalone"`, theme colour,
  192 px, 512 px and maskable icons (AC-6.2). iOS also gets an `apple-touch-icon`.
- `web/public/sw.js`, written by hand and registered from a client component:
  - page navigations: network first, then the cached page, then an offline page;
  - `/_next/static/*` and sweet images: cache first;
  - API calls: network only (the catalog is built into the app, so it works offline).
  The cache name includes the build id, and old caches are deleted on `activate`.
- An `useOnline()` hook (`navigator.onLine` plus `online`/`offline` events) drives the offline
  banner and disables the assistant and checkout (AC-4.6, AC-6.3, AC-6.4).
- Layout: Tailwind, mobile first. Catalog is one column under 640 px, two at `sm`, three at
  `lg`. On phones a bottom bar shows the cart count and total. Colours are CSS variables with a
  `prefers-color-scheme: dark` set (AC-6.5).

## 8. Configuration
| Variable | Where | Default |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | web | `http://localhost:8000` |
| `WEB_ORIGIN` | api | `http://localhost:3000` |
| `DATABASE_PATH` | api | `./data/orders.db` |
| `OWNER_KEY` | api | none; owner routes return 503 until it is set |
| `AI_ENABLED` | api | `false` |
| `AWS_REGION`, `MODEL_ID` | api | `us-east-1`, `anthropic.claude-opus-5-5` |
| `AI_TIMEOUT_SECONDS` | api | `10` |

## 9. Testing
| Level | Tool | Covers |
|---|---|---|
| Unit (web) | Vitest | money, pricing (shared cases), cart reducer, schemas |
| Unit (api) | pytest | pricing (shared cases), state machine, rule parser, validator, order numbers |
| API | pytest + FastAPI TestClient | every endpoint, idempotency, owner key, AG-UI event order |
| AI contract | pytest with a fake client | AI output that breaks the schema, refusal, timeout → rules fallback |
| End to end | Playwright at 360 × 800 and 1280 × 800 | browse → add → assistant → checkout → status; offline banner |

Every test name starts with the acceptance criterion it checks, e.g. `test_AC_3_3_unknown_sweet_rejected`.
A small script lists any AC without a test.

## 10. Risks
- **Next 16 changes.** The generated `web/AGENTS.md` warns that APIs differ from older versions.
  Read `web/node_modules/next/dist/docs/` before writing each part.
- **SSE through proxies.** The web app calls the API directly, not through a Next rewrite, so
  responses are not buffered.
- **iOS PWA limits.** No background sync, and storage may be cleared after long disuse. The cart
  is a convenience, and orders live on the server.
