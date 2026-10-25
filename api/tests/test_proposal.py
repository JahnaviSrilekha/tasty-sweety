from app.catalog import load_catalog
from app.proposal import RawLine, RawProposal, validate


def raw(*lines, not_understood=()):
    return RawProposal(
        lines=[RawLine(sweet_id=s, size=z, qty=q) for s, z, q in lines],
        not_understood=list(not_understood),
        reply="ok",
    )


def closed_catalog(sweet_id):
    catalog = load_catalog()
    return catalog.model_copy(
        update={
            "sweets": [
                s.model_copy(update={"available": False}) if s.id == sweet_id else s
                for s in catalog.sweets
            ]
        }
    )


def test_AC_3_2_valid_lines_are_priced():
    p = validate(raw(("kaju-katli", "large", 2), ("rasgulla", "small", 1)), load_catalog(), "rules")
    assert [(pl.sweet_id, pl.size, pl.qty, pl.line_total) for pl in p.lines] == [
        ("kaju-katli", "large", 2, 240000),
        ("rasgulla", "small", 1, 15000),
    ]
    assert p.total == 255000 and p.rejected == [] and p.parser == "rules"


def test_AC_3_3_unknown_sweet_is_rejected():
    p = validate(raw(("jalebi", "large", 1)), load_catalog(), "ai")
    assert p.lines == []
    assert [(r.text, r.reason) for r in p.rejected] == [("jalebi", "unknown_sweet")]


def test_AC_3_3_unavailable_sweet_is_rejected():
    p = validate(raw(("rasgulla", "small", 1)), closed_catalog("rasgulla"), "ai")
    assert [(r.text, r.reason) for r in p.rejected] == [("Rasgulla", "unavailable")]


def test_AC_3_3_quantity_outside_1_to_99_is_rejected():
    p = validate(raw(("rasgulla", "small", 0), ("rasgulla", "large", 100)), load_catalog(), "ai")
    assert p.lines == []
    assert [r.reason for r in p.rejected] == ["bad_quantity", "bad_quantity"]


def test_AC_3_3_merged_quantity_above_99_is_rejected():
    p = validate(raw(("rasgulla", "small", 60), ("rasgulla", "small", 50)), load_catalog(), "ai")
    assert p.lines == []
    assert [(r.text, r.reason) for r in p.rejected] == [("110 × Rasgulla", "bad_quantity")]


def test_AC_3_3_not_understood_text_is_listed():
    p = validate(raw(not_understood=["some pizza", "  "]), load_catalog(), "rules")
    assert [(r.text, r.reason) for r in p.rejected] == [("some pizza", "not_understood")]


def test_AC_3_4_missing_size_becomes_medium_and_is_marked():
    p = validate(raw(("gulab-jamun", None, 2)), load_catalog(), "rules")
    line = p.lines[0]
    assert (line.size, line.size_assumed, line.line_total) == ("medium", True, 60000)


def test_AC_3_4_explicit_medium_is_not_marked_assumed():
    p = validate(raw(("gulab-jamun", "medium", 1), ("gulab-jamun", None, 1)), load_catalog(), "ai")
    assert len(p.lines) == 1
    assert (p.lines[0].qty, p.lines[0].size_assumed) == (2, False)


def test_AC_3_5_proposal_json_matches_the_design():
    p = validate(raw(("kaju-katli", None, 1), ("jalebi", "small", 1)), load_catalog(), "ai")
    data = p.model_dump(mode="json", by_alias=True)
    assert set(data) == {"parser", "lines", "rejected", "total"}
    assert set(data["lines"][0]) == {
        "sweetId",
        "name",
        "size",
        "qty",
        "unitPrice",
        "lineTotal",
        "sizeAssumed",
    }
