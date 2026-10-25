# 001 Sweet ordering: tasks

Status: **Approved** (2026-10-25)
Each task is done when its tests (named after the ACs) pass and the box is ticked.
Write the tests first. `[P]` marks tasks that can run at the same time as the others in the same phase.

## Phase 0: Foundations
- [x] T0.1 Create the Next.js 16 app in `web/` (TypeScript, Tailwind, App Router).
- [x] T0.2 Write `shared/catalog.json` with the six starting sweets. Add a test that checks it
      against `catalog.schema.json`. — AC-1.5
- [x] T0.3 Write `shared/pricing-cases.json` (at least 8 cases: one line, many lines, qty 99,
      every size). — AC-2.3
- [x] T0.4 [P] Create `api/` with uv, FastAPI, pytest, ruff and a `/health` endpoint.
- [x] T0.5 [P] Add Vitest and `scripts/sync-catalog.mjs` (runs before `dev` and `build`) to `web/`.
- [x] T0.6 Add `scripts/ac-coverage` that lists every AC in `requirements.md` with no test. — NFR-2

## Phase 1: Deterministic core (no UI, no AI)
- [x] T1.1 [P] `api/app/pricing.py` + `web/src/lib/pricing.ts` + `money.ts`; both pass the shared
      cases. — AC-1.2, AC-2.3
- [x] T1.2 [P] `web/src/lib/cart.ts` reducer: add, setQty, remove, addMany, clear, reconcile.
      — AC-2.1, AC-2.2, AC-2.5
- [x] T1.3 [P] `api/app/orders.py`: transition table, `InvalidTransition`, history. — AC-5.2, AC-5.3
- [x] T1.4 Order storage in SQLite: daily order numbers, idempotency keys. — AC-4.4, AC-4.5
- [x] T1.5 [P] Checkout validation: Zod (web) and Pydantic (api), same rules, both run
      `shared/checkout-cases.json`. — AC-4.1

## Phase 2: HTTP API
- [x] T2.1 `GET /catalog`, `POST /quote`. — REQ-1, AC-4.3
- [x] T2.2 `POST /orders` with expectedTotal check (409) and Idempotency-Key. — AC-4.2–4.5
- [x] T2.3 `GET /orders/{id}`, public view without customer details. — AC-5.1, AC-5.5
- [x] T2.4 Owner routes with `X-Owner-Key` (constant-time compare, 503 when not set). — AC-5.2–5.4
- [x] T2.5 Check the responses against `contracts/openapi.yaml` in the API tests.

## Phase 3: Order assistant
- [ ] T3.1 `parser_rules.py` with a table of at least 20 example sentences and expected
      results. — AC-3.2, AC-3.4
- [ ] T3.2 `proposal.py` validator. — AC-3.3, AC-3.4
- [ ] T3.3 `parser_ai.py`: Bedrock client, structured output, catalog in a cached system prompt,
      10 s timeout. Tests use a fake client: wrong schema, refusal, timeout → rules. — AC-3.6, AC-3.7
- [ ] T3.4 `POST /agent` AG-UI stream; a test checks the event order from design §5. — AC-3.1
- [ ] T3.5 Suggestions ("for 20 people at Diwali"), AI only; rules reply "Please name the sweets". — AC-3.8

## Phase 4: Web UI (mobile first)
- [ ] T4.1 App shell: header, bottom cart bar on phones, colour tokens, light and dark. — AC-6.1, AC-6.5
- [ ] T4.2 Catalog page: cards, size picker, Add, search, unavailable state. — REQ-1, AC-2.1
- [ ] T4.3 Cart page: quantity stepper, remove, totals, saved cart, reconcile notice. — REQ-2
- [ ] T4.4 Assistant panel: `agui.ts` client, streamed reply, proposal card with
      Add / remove line / dismiss. — REQ-3
- [ ] T4.5 Checkout page: form, quote, changed-total confirm, idempotency key, offline block. — REQ-4
- [ ] T4.6 Order status page. — AC-5.1
- [ ] T4.7 Owner page: enter key, list orders, allowed stage buttons only. — AC-5.2–5.4

## Phase 5: PWA
- [ ] T5.1 `manifest.ts`, icons, apple-touch-icon. — AC-6.2
- [ ] T5.2 `public/sw.js` with the caching rules in design §7 and registration. — AC-6.3
- [ ] T5.3 `useOnline()` hook, offline banner, disable assistant and checkout. — AC-4.6, AC-6.3, AC-6.4

## Phase 6: Verify
- [ ] T6.1 Playwright end to end at 360 × 800 and 1280 × 800. — AC-6.1 and the main flow
- [ ] T6.2 Accessibility check (axe) on every page. — NFR-3
- [ ] T6.3 Lighthouse: PWA installable, LCP < 2.5 s on mobile. — NFR-1, AC-6.2
- [ ] T6.4 `scripts/ac-coverage` reports no missing ACs. Update the README with how to run.
