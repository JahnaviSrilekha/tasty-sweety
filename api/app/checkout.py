"""Checkout customer details (spec 001, AC-4.1). Same rules as web/src/lib/schemas.ts;
both run shared/checkout-cases.json."""

from typing import Annotated, Literal, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    SerializerFunctionWrapHandler,
    StringConstraints,
    model_serializer,
    model_validator,
)

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=60)]
Phone = Annotated[str, StringConstraints(pattern=r"^[6-9]\d{9}$")]
Address = Annotated[str, StringConstraints(strip_whitespace=True, min_length=10, max_length=300)]


class Customer(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Name
    phone: Phone
    fulfilment: Literal["pickup", "delivery"]
    address: Address | None = None

    @model_validator(mode="after")
    def address_only_for_delivery(self) -> Self:
        if self.fulfilment == "delivery" and self.address is None:
            raise ValueError("address is required for delivery")
        if self.fulfilment == "pickup":
            self.address = None
        return self

    @model_serializer(mode="wrap")
    def omit_missing_address(self, handler: SerializerFunctionWrapHandler) -> dict:
        data = handler(self)
        if data.get("address") is None:
            data.pop("address", None)
        return data
