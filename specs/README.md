# Specs

Tasty Sweety is built spec first. Read [constitution.md](constitution.md) for the rules every
feature follows.

## How a feature moves
1. **Requirements**: `requirements.md`, with user stories and numbered acceptance criteria (EARS).
2. **Design**: `design.md`, plus machine-readable contracts in `contracts/`.
3. **Tasks**: `tasks.md`, small steps that each name the ACs they satisfy.
4. **Review**: the owner approves, and the status line changes to *Approved*.
5. **Build**: tests first, named after the ACs, then code. Tick the task when its tests pass.
6. **Change**: if something needs to change, update the spec first, then the code.

## Features
| ID | Feature | Status |
|---|---|---|
| [001](001-sweet-ordering/) | Sweet ordering: catalog, cart, AI order assistant, checkout, order status, PWA | Approved |
