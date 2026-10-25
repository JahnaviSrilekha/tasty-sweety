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
