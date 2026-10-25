# 001 Sweet ordering: requirements

Status: **Approved** (2026-10-25)
Principles: [../constitution.md](../constitution.md)

## Summary
Customers browse the sweets catalog on their phone or computer. Each sweet comes in three box
sizes: small, medium and large. Customers build a cart by tapping or by typing what they want
in plain words ("2 large kaju katli and a small box of ladoo"), check out, and track the order.
The shop works as an installable PWA.

## Users
- **Customer**: a shop or person buying sweets, usually on a phone.
- **Shop owner**: keeps the catalog up to date and moves orders through their stages.

## Glossary
| Term | Meaning |
|---|---|
| Sweet | A catalog product, e.g. Kaju Katli |
| Size | `small`, `medium` or `large`, a box of a fixed weight with its own price |
| Line | One sweet in one size with a quantity, in the cart or an order |
| Proposal | Lines the assistant suggests from free text, which the customer has not accepted yet |

Acceptance criteria use the EARS format: *WHEN / WHILE / IF ... THE SYSTEM SHALL ...*

---

## REQ-1 Catalog
**Story:** As a customer, I want to see every sweet with its sizes and prices so that I can choose.

- **AC-1.1** THE SYSTEM SHALL list every available sweet with its name, photo, short description
  and the weight and price of each of its three sizes.
- **AC-1.2** THE SYSTEM SHALL show prices in Indian rupees with no decimals (for example "₹450").
- **AC-1.3** WHEN a sweet is marked unavailable, THE SYSTEM SHALL show it greyed out and SHALL NOT
  let it be added to the cart.
- **AC-1.4** WHEN the customer types in the search box, THE SYSTEM SHALL show only sweets whose
  name or tags contain the text, ignoring case.
- **AC-1.5** THE SYSTEM SHALL read all sweets, sizes and prices from one catalog file that both
  the web app and the backend use.

## REQ-2 Cart
**Story:** As a customer, I want a cart I can change so that I order exactly what I need.

- **AC-2.1** WHEN the customer picks a size and taps "Add", THE SYSTEM SHALL add one box of that
  sweet and size to the cart, or add one to the quantity if that line is already there.
- **AC-2.2** THE SYSTEM SHALL let the customer change a line's quantity between 1 and 99 and
  remove a line.
- **AC-2.3** THE SYSTEM SHALL show each line's total (unit price × quantity) and the cart total,
  calculated in whole paise.
- **AC-2.4** WHEN the page is reloaded or the app is reopened, THE SYSTEM SHALL keep the cart as it was.
- **AC-2.5** IF a cart line refers to a sweet or size that is no longer in the catalog, THEN THE
  SYSTEM SHALL remove the line and tell the customer which item was removed.
- **AC-2.6** WHILE the cart is empty, THE SYSTEM SHALL disable checkout.

## REQ-3 Order assistant (AI)
**Story:** As a customer, I want to type my order in my own words so that I don't have to tap
through the catalog.

- **AC-3.1** WHEN the customer sends a message to the assistant, THE SYSTEM SHALL stream the
  assistant's reply and progress to the screen as it is produced.
- **AC-3.2** THE SYSTEM SHALL turn the message into a proposal: a list of lines that each name
  a catalog sweet, a size and a quantity.
- **AC-3.3** THE SYSTEM SHALL check every proposed line against the catalog and REQ-2 limits in
  plain code. IF a line names an unknown sweet, an unknown size, an unavailable sweet or a
  quantity outside 1–99, THEN THE SYSTEM SHALL leave it out of the proposal and list it as
  "not understood" with the reason.
- **AC-3.4** IF the message does not give a size, THEN THE SYSTEM SHALL propose `medium` and mark
  that line "size assumed".
- **AC-3.5** THE SYSTEM SHALL show the proposal with its prices and SHALL NOT change the cart until
  the customer taps "Add to cart". The customer can also remove lines or dismiss the whole proposal.
- **AC-3.6** IF the AI model is not configured, times out after 10 seconds or returns output that
  does not fit the schema, THEN THE SYSTEM SHALL use the built-in rule-based parser instead and
  say that it did.
- **AC-3.7** THE SYSTEM SHALL send only the customer's message and the catalog names to the model,
  never customer details.
- **AC-3.8** WHEN the customer asks for a suggestion (for example "something for Diwali for 20
  people"), THE SYSTEM SHALL propose lines from the catalog under the same rules as AC-3.3–3.5.

## REQ-4 Checkout
**Story:** As a customer, I want to place my order and get a reference number.

- **AC-4.1** THE SYSTEM SHALL ask for a name (2–60 characters), a 10-digit Indian mobile number,
  and either pickup or delivery; for delivery, an address (10–300 characters).
- **AC-4.2** WHEN the customer places the order, THE SYSTEM SHALL send only the sweet IDs, sizes
  and quantities. The server SHALL work out the prices and total from the catalog.
- **AC-4.3** IF the server's total differs from the total the customer saw, THEN THE SYSTEM SHALL
  show the new total and ask the customer to confirm again before placing the order.
- **AC-4.4** WHEN the order is accepted, THE SYSTEM SHALL show an order number in the form
  `TS-YYYYMMDD-NNNN`, empty the cart and open the order status page.
- **AC-4.5** WHEN the same order is submitted twice with the same request key (for example a
  double tap or a retry), THE SYSTEM SHALL create only one order.
- **AC-4.6** WHILE the device is offline, THE SYSTEM SHALL disable "Place order" and say why.

## REQ-5 Order status
**Story:** As a customer, I want to see where my order is. As the owner, I want to move it along.

- **AC-5.1** THE SYSTEM SHALL show an order's lines, total, and current stage, which is one of
  `placed`, `confirmed`, `ready`, `completed` or `cancelled`.
- **AC-5.2** THE SYSTEM SHALL allow only these stage changes: placed→confirmed, placed→cancelled,
  confirmed→ready, confirmed→cancelled, ready→completed. Any other change SHALL be rejected
  with an error.
- **AC-5.3** WHEN the owner changes a stage, THE SYSTEM SHALL record who changed it and when.
- **AC-5.4** The owner's controls SHALL need an owner access key. Customers SHALL NOT see them.

## REQ-6 Mobile and PWA
- **AC-6.1** THE SYSTEM SHALL be fully usable at 360 px width with no sideways scrolling, and
  every button SHALL be at least 44 × 44 px.
- **AC-6.2** THE SYSTEM SHALL be installable to the home screen on Android and iOS, with a name,
  icons, theme colour and full-screen display.
- **AC-6.3** WHILE offline, THE SYSTEM SHALL still show the catalog and cart from the last visit
  and show an "You're offline" banner.
- **AC-6.4** WHILE offline, THE SYSTEM SHALL disable the assistant and checkout, and say why.
- **AC-6.5** THE SYSTEM SHALL follow the device's light or dark setting.

## Non-functional
- **NFR-1** The catalog page loads in under 2.5 s (Largest Contentful Paint) on a mid-range phone
  over 4G.
- **NFR-2** Pricing, cart, validation and the order state machine have unit tests that cover every
  acceptance criterion they implement.
- **NFR-3** Pages meet WCAG 2.1 AA: contrast, labels, keyboard use, screen readers.
- **NFR-4** The assistant's first streamed event arrives within 1.5 s of sending.

## Out of scope for 001
Online payment, customer accounts and login, stock counts, discounts and coupons, delivery
charges, notifications, multiple languages, app-store packaging.

## Decisions (open questions, answered by the owner on 2026-10-25)
1. Box weights? [small 250 g, medium 500 g, large 1 kg]
2. The repo README says *wholesale*. Is there a minimum order? [No minimum in 001]
3. Delivery area or charge? [Not in 001; delivery is free and confirmed by phone]
4. Which sweets and prices to start with? [The six sweets in `design.md`, as placeholders]
5. Order storage? [SQLite file for 001, swappable for DynamoDB later]
