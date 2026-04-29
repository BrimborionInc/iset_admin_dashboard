#!/usr/bin/env python3
"""Check local Markdown references in the cross-app agent-facing docs trees.

This intentionally focuses on local `.md` references under admin `docs/` and
the sibling public portal `../ISET-intake/docs` docbase. It ignores examples,
globs, command outputs, and explicitly planned-but-not-created deliverables.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PORTAL_ROOT = ROOT.parent / "ISET-intake"
DOCS_ROOTS = [
    ROOT / "docs",
    PORTAL_ROOT / "docs",
]

IGNORE_SUBSTRINGS = (
    "docs/.../",
    "portal/assets/screenshots/",
    "<env-date>.md",
    "npm run ",
    "npx env-cmd ",
    "Cross-reference: ",
)

PLANNED_MISSING = {
    "docs/planning/nform-dependency-map.md",
    "docs/planning/nform-copy-manifest.md",
    "docs/planning/nform-copy-manifest.json",
    "docs/planning/nform-extraction-dry-run.md",
    "docs/planning/nform-prune-manifest.md",
    "docs/planning/nform-prune-log.md",
    "docs/planning/nform-stabilization-notes.md",
    "docs/planning/nform-validation-report.md",
    "docs/planning/nform-cruft-removal-log.md",
    "docs/planning/nform-handoff-summary.md",
    "docs/planning/nform-vite-migration-plan.md",
    "nform-dependency-map.md",
    "nform-copy-manifest.md",
}

ROOT_BARE_REFS = {"AGENTS.md"}
PORTAL_BARE_REFS = {"docs/AGENTS.md"}
PORTAL_DOC_PREFIXES = ("portal/", "system/", "archive/", "meta/")

MARKDOWN_LINK_RE = re.compile(
    r"\[[^\]]*\]\(([^)]+\.md(?:#[^)]+|:\d+(?:-\d+)?)?)\)"
)
CODE_REF_RE = re.compile(r"`([^`]*\.md(?::\d+(?:-\d+)?)?)`")


def strip_target(raw: str) -> str | None:
    target = raw.strip()
    if not target or target.startswith("#") or re.match(r"^[a-z]+:", target, re.I):
        return None
    if any(marker in target for marker in IGNORE_SUBSTRINGS):
        return None
    if "*" in target:
        return None
    if target.startswith("<") and target.endswith(">"):
        target = target[1:-1]
    target = target.split("#", 1)[0]
    target = re.sub(r":\d+(?:-\d+)?$", "", target)
    target = target.strip()
    if not target or target in PLANNED_MISSING:
        return None
    if not re.search(r"\.md$", target, re.I):
        return None
    return target


def resolve_ref(file_path: Path, target: str) -> Path:
    if target in ROOT_BARE_REFS and is_under(file_path, ROOT):
        return ROOT / target
    if target in PORTAL_BARE_REFS and is_under(file_path, PORTAL_ROOT):
        return PORTAL_ROOT / target
    if target.startswith("/"):
        return Path(target)
    if target.startswith("../ISET-intake/"):
        return (ROOT / target).resolve()
    if target.startswith("ISET-intake/"):
        return (ROOT / ".." / target).resolve()
    if target.startswith("../admin-dashboard/"):
        return (PORTAL_ROOT / target).resolve()
    if target.startswith("admin-dashboard/"):
        return (PORTAL_ROOT / ".." / target).resolve()
    if is_under(file_path, PORTAL_ROOT) and target.startswith(PORTAL_DOC_PREFIXES):
        return (PORTAL_ROOT / "docs" / target).resolve()
    if target.startswith("docs/"):
        repo_root = PORTAL_ROOT if is_under(file_path, PORTAL_ROOT) else ROOT
        return (repo_root / target).resolve()
    return (file_path.parent / target).resolve()


def is_under(path: Path, parent: Path) -> bool:
    try:
        path.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def display_path(path: Path) -> str:
    resolved = path.resolve()
    for label, base in (("admin-dashboard", ROOT), ("ISET-intake", PORTAL_ROOT)):
        try:
            return f"{label}/{resolved.relative_to(base.resolve())}"
        except ValueError:
            continue
    return str(path)


def iter_markdown_files() -> list[Path]:
    files: list[Path] = []
    for docs_root in DOCS_ROOTS:
        if docs_root.exists():
            files.extend(docs_root.rglob("*.md"))
    return sorted(files)


def main() -> int:
    misses: list[tuple[Path, str, str, Path]] = []

    for file_path in iter_markdown_files():
        text = file_path.read_text(encoding="utf-8", errors="replace")
        seen: set[tuple[str, str]] = set()

        def add(raw: str, kind: str) -> None:
            target = strip_target(raw)
            if not target:
                return
            key = (kind, target)
            if key in seen:
                return
            seen.add(key)
            resolved = resolve_ref(file_path, target)
            if not resolved.exists():
                misses.append((file_path, kind, target, resolved))

        for match in MARKDOWN_LINK_RE.finditer(text):
            add(match.group(1), "markdown-link")
        for match in CODE_REF_RE.finditer(text):
            add(match.group(1), "code-ref")

    for file_path, kind, target, resolved in misses:
        print(
            f"{display_path(file_path)}: {kind} {target} -> missing ({display_path(resolved)})"
        )

    if misses:
        print(f"missing={len(misses)}", file=sys.stderr)
        return 1

    print("docs link check passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
