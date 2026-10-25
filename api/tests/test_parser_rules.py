import pytest

from app.catalog import load_catalog
from app.parser_rules import parse_rules

# (message, expected lines as (sweet_id, size or None, qty), expected not_understood)
CASES = [
    ("2 large kaju katli", [("kaju-katli", "large", 2)], []),
    (
        "2 large kaju katli and a small ladoo",
        [("kaju-katli", "large", 2), ("motichoor-ladoo", "small", 1)],
        [],
    ),
    ("one medium gulab jamun", [("gulab-jamun", "medium", 1)], []),
    ("Three SMALL Rasgulla", [("rasgulla", "small", 3)], []),
    ("rasgulla", [("rasgulla", None, 1)], []),
    ("kaju katli 4 large", [("kaju-katli", "large", 4)], []),
    ("2 kg mysore pak", [("mysore-pak", "large", 2)], []),
    ("1 kg soan papdi", [("soan-papdi", "large", 1)], []),
    ("half kg jamun", [("gulab-jamun", "medium", 1)], []),
    ("500 g motichoor", [("motichoor-ladoo", "medium", 1)], []),
    ("250g kaju", [("kaju-katli", "small", 1)], []),
    ("a big box of laddoos", [("motichoor-ladoo", "large", 1)], []),
    ("5 rasgullas", [("rasgulla", None, 5)], []),
    (
        "2 small rasagola, 1 large son papdi",
        [("rasgulla", "small", 2), ("soan-papdi", "large", 1)],
        [],
    ),
    (
        "ladoo + jamun & katli",
        [("motichoor-ladoo", None, 1), ("gulab-jamun", None, 1), ("kaju-katli", None, 1)],
        [],
    ),
    (
        "2 large kaju katli\n3 medium mysore pak",
        [("kaju-katli", "large", 2), ("mysore-pak", "medium", 3)],
        [],
    ),
    ("I want 2 boxes of gulab jamun please", [("gulab-jamun", None, 2)], []),
    ("2 large kaju katly", [("kaju-katli", "large", 2)], []),  # typo, fuzzy match
    ("10 medium mysorepak", [("mysore-pak", "medium", 10)], []),
    ("2 large jalebi", [], ["2 large jalebi"]),
    ("2 kaju katli and some pizza", [("kaju-katli", None, 2)], ["some pizza"]),
    ("0 small ladoo", [("motichoor-ladoo", "small", 0)], []),  # validator rejects later
    ("150 large ladoo", [("motichoor-ladoo", "large", 150)], []),  # validator rejects later
    ("please", [], []),
    ("", [], []),
]


@pytest.mark.parametrize(
    "message,lines,not_understood", CASES, ids=[c[0] or "empty" for c in CASES]
)
def test_AC_3_2_AC_3_4_rule_parser(message, lines, not_understood):
    raw = parse_rules(message, load_catalog())
    assert [(line.sweet_id, line.size, line.qty) for line in raw.lines] == lines
    assert raw.not_understood == not_understood


def test_AC_3_2_rule_parser_is_deterministic():
    catalog = load_catalog()
    text = "2 large kaju katli and a small ladoo, half kg jamun"
    assert len({parse_rules(text, catalog).model_dump_json() for _ in range(20)}) == 1


def test_AC_3_8_rules_ask_for_sweet_names_when_nothing_matches():
    raw = parse_rules("something nice for Diwali for 20 people", load_catalog())
    assert raw.lines == []
    assert "name the sweets" in raw.reply
