"""Rule-based order parser (spec 001, design §5). No AI and no randomness: the same message
always gives the same RawProposal. Used when the AI parser is off or fails (AC-3.6)."""

import re
from difflib import SequenceMatcher

from app.catalog import Catalog, SizeId
from app.proposal import RawLine, RawProposal

FUZZY_THRESHOLD = 0.8

SEPARATORS = re.compile(r"\s*(?:,|\+|&|;|\n|\band\b)\s*")
GRAMS = re.compile(r"(\d+)\s*(?:g|gm|gms|gram|grams)\b")

NUMBER_WORDS = {
    word: n
    for n, word in enumerate(
        [
            "zero",
            "one",
            "two",
            "three",
            "four",
            "five",
            "six",
            "seven",
            "eight",
            "nine",
            "ten",
            "eleven",
            "twelve",
            "thirteen",
            "fourteen",
            "fifteen",
            "sixteen",
            "seventeen",
            "eighteen",
            "nineteen",
            "twenty",
        ]
    )
} | {"a": 1, "an": 1}

SIZE_WORDS: dict[str, SizeId] = {
    **dict.fromkeys(["small", "mini", "little", "quarter", "250g"], "small"),
    **dict.fromkeys(["medium", "med", "regular", "half", "500g"], "medium"),
    **dict.fromkeys(["large", "big", "kg", "kgs", "1kg", "kilo", "1000g", "family"], "large"),
}

FILLERS = {
    "the",
    "of",
    "box",
    "boxes",
    "pack",
    "packs",
    "packet",
    "packets",
    "please",
    "pls",
    "plz",
    "i",
    "want",
    "need",
    "would",
    "like",
    "to",
    "me",
    "give",
    "get",
    "some",
    "order",
    "for",
    "with",
    "can",
    "have",
    "also",
    "more",
    "x",
}

NOTHING_FOUND = (
    "I couldn't find any of our sweets in that. Please name the sweets you want, "
    'for example "2 large kaju katli".'
)
FOUND = "Here is what I understood from your message."


def _candidates(catalog: Catalog) -> list[tuple[str, str]]:
    """(phrase, sweet id) in catalog order, so ties go to the earliest sweet."""
    out = []
    for sweet in catalog.sweets:
        for phrase in [sweet.id.replace("-", " "), sweet.name.lower(), *sweet.aliases]:
            out.append((phrase.lower(), sweet.id))
    return out


def _match(words: list[str], candidates: list[tuple[str, str]]) -> str | None:
    if not words:
        return None
    phrase = " ".join(words)
    padded = f" {phrase} "

    for cand, sweet_id in candidates:
        if cand == phrase:
            return sweet_id

    contained = [(len(c), -i, sid) for i, (c, sid) in enumerate(candidates) if f" {c} " in padded]
    if contained:
        return max(contained)[2]

    best_score, best_id = 0.0, None
    for cand, sweet_id in candidates:
        n = len(cand.split())
        grams = [" ".join(words[i : i + n]) for i in range(max(1, len(words) - n + 1))]
        score = max(SequenceMatcher(None, g, cand).ratio() for g in grams)
        if score > best_score:
            best_score, best_id = score, sweet_id
    return best_id if best_score >= FUZZY_THRESHOLD else None


def _parse_part(part: str, candidates) -> RawLine | None | str:
    """A RawLine, None for an empty part, or the part's text when nothing matches."""
    tokens = re.findall(r"[a-z0-9]+", GRAMS.sub(r"\1g", part.lower()))

    qty = next((int(t) for t in tokens if t.isdigit()), None)
    if qty is None:
        qty = next((NUMBER_WORDS[t] for t in tokens if t in NUMBER_WORDS), 1)
    size = next((SIZE_WORDS[t] for t in tokens if t in SIZE_WORDS), None)

    words = [
        t
        for t in tokens
        if not t.isdigit() and t not in NUMBER_WORDS and t not in SIZE_WORDS and t not in FILLERS
    ]
    if not words:
        return None
    sweet_id = _match(words, candidates)
    if sweet_id is None:
        return part.strip()
    return RawLine(sweet_id=sweet_id, size=size, qty=qty)


def parse_rules(message: str, catalog: Catalog) -> RawProposal:
    candidates = _candidates(catalog)
    lines: list[RawLine] = []
    not_understood: list[str] = []
    for part in SEPARATORS.split(message.strip()):
        result = _parse_part(part, candidates)
        if isinstance(result, RawLine):
            lines.append(result)
        elif result:
            not_understood.append(result)
    return RawProposal(
        lines=lines, not_understood=not_understood, reply=FOUND if lines else NOTHING_FOUND
    )
