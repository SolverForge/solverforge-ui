#!/usr/bin/env python3

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def rewrite(path: str, pattern: str, replacement: str) -> None:
    file_path = ROOT / path
    original = file_path.read_text()
    updated, count = re.subn(pattern, replacement, original, count=1, flags=re.MULTILINE)
    if count != 1:
        raise SystemExit(f"failed to update {path}")
    file_path.write_text(updated)


def rewrite_cargo_lock(old: str, new: str) -> None:
    path = ROOT / "Cargo.lock"
    original = path.read_text()
    pattern = (
        r'(name = "solverforge-ui"\nversion = ")'
        + re.escape(old)
        + r'("\ndependencies = \[\n)'
    )
    updated, count = re.subn(pattern, rf"\g<1>{new}\2", original, count=1)
    if count != 1:
        raise SystemExit("failed to update Cargo.lock root package version")
    path.write_text(updated)


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: sync-version.py OLD_VERSION NEW_VERSION")

    old, new = sys.argv[1], sys.argv[2]

    rewrite("Cargo.toml", rf'^version = "{re.escape(old)}"$', f'version = "{new}"')
    rewrite(
        "js-src/00-core.js",
        rf"const sf = \{{ version: '{re.escape(old)}' \}};",
        f"const sf = {{ version: '{new}' }};",
    )
    rewrite(
        "README.md",
        rf"- Current crate release: `{re.escape(old)}`\.",
        f"- Current crate release: `{new}`.",
    )
    rewrite_cargo_lock(old, new)


if __name__ == "__main__":
    main()
