#!/usr/bin/env python3
"""List acceptance criteria that no test names (spec constitution §1, NFR-2).

Tests name criteria as AC_3_3 (pytest) or "AC-3.3" (Vitest/Playwright titles).

    python3 scripts/ac_coverage.py [spec-folder] [--strict]

--strict exits with status 1 when any criterion has no test.
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEST_GLOBS = ["api/tests/**/*.py", "web/src/**/*.test.ts", "web/src/**/*.test.tsx", "web/e2e/**/*.ts"]


def criteria(requirements: Path) -> list[str]:
    found = re.findall(r"\*\*(AC-\d+\.\d+|NFR-\d+)\*\*", requirements.read_text())
    return list(dict.fromkeys(found))


def tested() -> set[str]:
    names: set[str] = set()
    for pattern in TEST_GLOBS:
        for path in ROOT.glob(pattern):
            text = path.read_text()
            names.update(f"AC-{a}.{b}" for a, b in re.findall(r"AC_(\d+)_(\d+)", text))
            names.update(re.findall(r"AC-\d+\.\d+", text))
            names.update(f"NFR-{n}" for n in re.findall(r"NFR_(\d+)", text))
            names.update(re.findall(r"NFR-\d+", text))
    return names


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    spec = ROOT / "specs" / (args[0] if args else "001-sweet-ordering")
    wanted = criteria(spec / "requirements.md")
    have = tested()
    missing = [c for c in wanted if c not in have]
    print(f"{len(wanted) - len(missing)}/{len(wanted)} criteria have tests")
    for c in missing:
        print(f"  missing: {c}")
    return 1 if missing and "--strict" in sys.argv else 0


if __name__ == "__main__":
    sys.exit(main())
