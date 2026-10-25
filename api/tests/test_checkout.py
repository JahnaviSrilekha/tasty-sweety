import pytest
from pydantic import ValidationError

from app.checkout import Customer


def test_AC_4_1_shared_checkout_cases(checkout_cases):
    for case in checkout_cases:
        if case["valid"]:
            customer = Customer.model_validate(case["customer"])
            assert customer.model_dump(exclude_none=True) == case["normalised"], case["name"]
        else:
            with pytest.raises(ValidationError):
                Customer.model_validate(case["customer"])


def test_AC_4_1_pickup_customer_json_has_no_address_field():
    customer = Customer(name="Asha", phone="9876543210", fulfilment="pickup")
    assert "address" not in customer.model_dump(mode="json")
