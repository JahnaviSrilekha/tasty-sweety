"""HTTP API for spec 001. Contract: specs/001-sweet-ordering/contracts/openapi.yaml."""

import hmac
import logging
import uuid
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Annotated

from ag_ui.core import RunAgentInput
from ag_ui.encoder import EventEncoder
from fastapi import Depends, FastAPI, Header, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.agent import run_events
from app.catalog import Catalog, read_catalog
from app.checkout import Customer
from app.orders import InvalidTransition, Order, Stage, transition
from app.parser_ai import AiParser, bedrock_parser
from app.pricing import CamelModel, Line, PricedLine, Quote, price_lines
from app.settings import Settings, load_settings
from app.store import OrderStore

log = logging.getLogger(__name__)


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, **extra: object):
        super().__init__(message)
        self.status, self.code, self.message, self.extra = status, code, message, extra


class LinesRequest(CamelModel):
    lines: list[Line] = Field(min_length=1)


class PlaceOrderRequest(CamelModel):
    lines: list[Line] = Field(min_length=1)
    customer: Customer
    expected_total: int = Field(ge=0)


class StageChange(CamelModel):
    to: Stage


class PublicOrder(CamelModel):
    """What anyone with the order number may see (AC-5.5)."""

    id: str
    lines: list[PricedLine]
    total: int
    fulfilment: str
    stage: Stage
    history: list
    created_at: datetime

    @classmethod
    def of(cls, order: Order) -> "PublicOrder":
        return cls(
            id=order.id,
            lines=order.lines,
            total=order.total,
            fulfilment=order.customer.fulfilment,
            stage=order.stage,
            history=order.history,
            created_at=order.created_at,
        )


def _json(model: BaseModel | list[BaseModel], status: int = 200) -> JSONResponse:
    if isinstance(model, list):
        content = [m.model_dump(mode="json", by_alias=True) for m in model]
    else:
        content = model.model_dump(mode="json", by_alias=True)
    return JSONResponse(content, status_code=status)


def _error(status: int, code: str, message: str, **extra: object) -> JSONResponse:
    return JSONResponse({"error": {"code": code, "message": message}, **extra}, status_code=status)


def quote_for(lines: list[Line], catalog: Catalog) -> Quote:
    """Server-side prices (AC-4.2). Unknown or unavailable sweets are errors (AC-1.3)."""
    for line in lines:
        try:
            sweet = catalog.sweet(line.sweet_id)
        except KeyError:
            raise ApiError(422, "unknown_sweet", f"{line.sweet_id} is not in the catalog") from None
        if not sweet.available:
            raise ApiError(422, "unavailable", f"{sweet.name} is not available right now")
    return price_lines(lines, catalog)


def make_ai_parser(settings: Settings) -> AiParser | None:
    if not settings.ai_enabled:
        return None
    try:
        return bedrock_parser(settings.aws_region, settings.model_id, settings.ai_timeout_seconds)
    except Exception:
        log.exception("AI parser could not be set up; the assistant will use rules only")
        return None


def create_app(
    settings: Settings | None = None,
    clock: Callable[[], datetime] | None = None,
    ai_parser: AiParser | None = None,
) -> FastAPI:
    settings = settings or load_settings()
    now = clock or (lambda: datetime.now(UTC))
    catalog = read_catalog(settings.catalog_path)
    store = OrderStore(settings.database_path)
    ai = ai_parser if ai_parser is not None else make_ai_parser(settings)

    app = FastAPI(title="Tasty Sweety API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.web_origin],
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "Idempotency-Key", "X-Owner-Key"],
    )

    @app.exception_handler(ApiError)
    async def api_error(_: Request, exc: ApiError) -> JSONResponse:
        return _error(exc.status, exc.code, exc.message, **exc.extra)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(_: Request, exc: RequestValidationError) -> JSONResponse:
        first = exc.errors()[0]
        where = ".".join(str(p) for p in first["loc"])
        return _error(422, "invalid_request", f"{where}: {first['msg']}")

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return _error(exc.status_code, "http_error", str(exc.detail))

    def require_owner(x_owner_key: Annotated[str | None, Header()] = None) -> None:
        if settings.owner_key is None:
            raise ApiError(503, "owner_disabled", "Owner access is not set up on this server")
        if x_owner_key is None or not hmac.compare_digest(
            x_owner_key.encode(), settings.owner_key.encode()
        ):
            raise ApiError(401, "unauthorized", "A valid owner key is needed")

    def find_order(order_id: str) -> Order:
        order = store.get(order_id)
        if order is None:
            raise ApiError(404, "not_found", f"No order {order_id}")
        return order

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/catalog")
    def get_catalog() -> JSONResponse:
        return _json(catalog)

    @app.post("/quote")
    def post_quote(body: LinesRequest) -> JSONResponse:
        return _json(quote_for(body.lines, catalog))

    @app.post("/orders")
    def place_order(
        body: PlaceOrderRequest, idempotency_key: Annotated[uuid.UUID, Header()]
    ) -> JSONResponse:
        key = str(idempotency_key)
        if existing := store.get_by_idempotency_key(key):
            return _json(existing)  # a retry of an order already placed (AC-4.5)
        quote = quote_for(body.lines, catalog)
        if quote.total != body.expected_total:
            raise ApiError(
                409,
                "total_changed",
                "The total has changed. Please check the new total.",
                quote=quote.model_dump(mode="json", by_alias=True),
            )
        order, created = store.create_order(
            quote.lines, quote.total, body.customer, idempotency_key=key, now=now()
        )
        return _json(order, 201 if created else 200)

    @app.get("/orders/{order_id}")
    def get_order(order_id: str) -> JSONResponse:
        return _json(PublicOrder.of(find_order(order_id)))

    @app.get("/owner/orders", dependencies=[Depends(require_owner)])
    def owner_orders() -> JSONResponse:
        return _json(store.list_orders())

    @app.post("/owner/orders/{order_id}/stage", dependencies=[Depends(require_owner)])
    def owner_change_stage(order_id: str, body: StageChange) -> JSONResponse:
        order = find_order(order_id)
        try:
            updated = transition(order, body.to, by="owner", now=now())
        except InvalidTransition as exc:
            raise ApiError(409, "invalid_transition", str(exc)) from None
        store.save(updated)
        return _json(updated)

    @app.post("/agent")
    def agent(run: RunAgentInput) -> StreamingResponse:
        encoder = EventEncoder()
        stream = (encoder.encode(event) for event in run_events(run, catalog, ai))
        return StreamingResponse(
            stream,
            media_type=encoder.get_content_type(),
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    return app


app = create_app()
