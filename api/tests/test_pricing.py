import pytest

from app.catalog import load_catalog
from app.pricing import Line, price_lines


def test_AC_2_3_shared_pricing_cases(pricing_cases):
    catalog = load_catalog()
    for case in pricing_cases:
        lines = [Line.model_validate(raw) for raw in case["lines"]]
        quote = price_lines(lines, catalog)
        assert [pl.line_total for pl in quote.lines] == case["lineTotals"], case["name"]
        assert quote.total == case["total"], case["name"]


def test_AC_2_3_totals_are_integers(pricing_cases):
    quote = price_lines(
        [Line.model_validate(raw) for raw in pricing_cases[-1]["lines"]], load_catalog()
    )
    assert all(type(pl.line_total) is int for pl in quote.lines)
    assert type(quote.total) is int


def test_AC_4_2_priced_line_carries_name_and_unit_price():
    quote = price_lines([Line(sweetId="rasgulla", size="large", qty=2)], load_catalog())
    line = quote.lines[0]
    assert (line.name, line.unit_price, line.line_total) == ("Rasgulla", 54000, 108000)


def test_AC_2_2_quantity_outside_1_to_99_is_rejected():
    with pytest.raises(ValueError):
        Line(sweetId="rasgulla", size="large", qty=0)
    with pytest.raises(ValueError):
        Line(sweetId="rasgulla", size="large", qty=100)


def test_unknown_sweet_cannot_be_priced():
    with pytest.raises(KeyError):
        price_lines([Line(sweetId="no-such-sweet", size="small", qty=1)], load_catalog())
