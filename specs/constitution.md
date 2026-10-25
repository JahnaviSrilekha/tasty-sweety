# Tasty Sweety: project constitution

These principles apply to every feature spec. A spec or a change that breaks one must say so and why.

## 1. Spec first
- No feature code is written until its spec folder (`specs/NNN-name/`) has `requirements.md`,
  `design.md` and `tasks.md`, and the owner has approved them.
- Every requirement has an ID (`REQ-x.y`) and acceptance criteria. Every task names the
  requirement IDs it satisfies. Every test names the acceptance criterion it checks.
- When the code and the spec disagree, the spec is fixed first, then the code.

## 2. Deterministic core
- Prices, totals, stock, order state and validation are plain code, the same input always
  gives the same output, and they are covered by unit tests.
- Money is stored as integers in the smallest unit (paise). No floating point for money.
- The server recomputes every price and total. Client-side totals are for display only.
- Order state changes only through the transitions listed in the design's state machine.

## 3. AI proposes, code decides
- AI is used where it helps people: understanding free-text orders, suggestions, descriptions.
- Every AI output is parsed into a schema and checked against the catalog by plain code before
  anything uses it. Anything that fails the check is dropped and reported, never guessed.
- AI never changes the cart or an order by itself. A person confirms every AI proposal.
- Every AI feature has a non-AI fallback, so the shop still works when the model is off or fails.

## 4. Mobile first, one codebase
- Designed for a 360 px wide phone first, then scaled up to tablet and desktop.
- Shipped as an installable PWA. The same web code can later be wrapped for app stores.
- Touch targets are at least 44 px. Pages meet WCAG 2.1 AA.

## 5. Open protocols
- Agent to UI traffic uses AG-UI events over Server-Sent Events.
- Backend HTTP APIs are described in OpenAPI in the spec's `contracts/` folder.

## 6. Privacy and safety
- Only the free-text order and the catalog are sent to the model. No names, phone numbers or
  addresses.
- No secrets in the repo. Configuration comes from environment variables.
