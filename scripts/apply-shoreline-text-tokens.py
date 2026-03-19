#!/usr/bin/env python3
"""Substitui cores de texto hardcoded por tokens CSS do Shoreline (var(--sl-...))."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Ordem: strings mais longas / específicas primeiro
REPLACEMENTS: list[tuple[str, str]] = [
    # Hex — neutros (tipografia)
    ("text-[#1f1f1f]", "text-[color:var(--sl-fg-base)]"),
    ("text-[#707070]", "text-[color:var(--sl-fg-base-soft)]"),
    ("text-[#414651]", "text-[color:var(--sl-fg-muted)]"),
    ("text-[#535862]", "text-[color:var(--sl-color-gray-10)]"),
    ("text-[#333333]", "text-[color:var(--sl-fg-muted)]"),
    ("text-[#727272]", "text-[color:var(--sl-color-gray-8)]"),
    ("text-[#505050]", "text-[color:var(--sl-color-gray-10)]"),
    ("text-[#9b9b9b]", "text-[color:var(--sl-color-gray-7)]"),
    ("text-[#a0a0a0]", "text-[color:var(--sl-color-gray-6)]"),
    ("text-[#b0b0b0]", "text-[color:var(--sl-color-gray-6)]"),
    ("text-[#c0c0c0]", "text-[color:var(--sl-color-gray-5)]"),
    ("text-[#171717]", "text-[color:var(--sl-fg-base)]"),
    ("text-[#0a0a0a]", "text-[color:var(--sl-color-gray-13)]"),
    ("text-[#999]", "text-[color:var(--sl-fg-base-disabled)]"),
    ("text-[#666]", "text-[color:var(--sl-color-gray-8)]"),
    ("text-[#333]", "text-[color:var(--sl-fg-muted)]"),
    # Acento / feedback (mantém semântica Shoreline)
    ("text-[#0366dd]", "text-[color:var(--sl-fg-accent)]"),
    ("hover:text-[#0366dd]", "hover:text-[color:var(--sl-fg-accent-hover)]"),
    ("text-[#016810]", "text-[color:var(--sl-color-green-11)]"),
    ("text-[#067647]", "text-[color:var(--sl-color-green-10)]"),
    ("text-[#b42318]", "text-[color:var(--sl-fg-critical)]"),
    ("text-[#d92d20]", "text-[color:var(--sl-fg-critical)]"),
    ("hover:text-[#b42318]", "hover:text-[color:var(--sl-fg-critical-hover)]"),
    ("text-[#b40202]", "text-[color:var(--sl-color-red-11)]"),
    ("text-[#715401]", "text-[color:var(--sl-color-yellow-11)]"),
    ("hover:text-[#414651]", "hover:text-[color:var(--sl-fg-muted-hover)]"),
    ("hover:text-[#252b37]", "hover:text-[color:var(--sl-fg-muted-pressed)]"),
    ("placeholder:text-[#b0b0b0]", "placeholder:text-[color:var(--sl-color-gray-6)]"),
    ("placeholder:text-[#c0c0c0]", "placeholder:text-[color:var(--sl-color-gray-5)]"),
    ("placeholder:text-[#bbb]", "placeholder:text-[color:var(--sl-color-gray-6)]"),
    ("placeholder:text-gray-400", "placeholder:text-[color:var(--sl-color-gray-6)]"),
    # Tailwind gray → tokens
    ("text-black", "text-[color:var(--sl-color-gray-13)]"),
    ("text-gray-900", "text-[color:var(--sl-fg-base)]"),
    ("text-gray-800", "text-[color:var(--sl-color-gray-11)]"),
    ("text-gray-700", "text-[color:var(--sl-color-gray-10)]"),
    ("text-gray-600", "text-[color:var(--sl-color-gray-8)]"),
    ("text-gray-500", "text-[color:var(--sl-color-gray-8)]"),
    ("text-gray-400", "text-[color:var(--sl-color-gray-6)]"),
    ("text-gray-300", "text-[color:var(--sl-color-gray-5)]"),
    ("text-gray-200", "text-[color:var(--sl-color-gray-4)]"),
    # Caret (inputs monetários)
    ("caret-[#0a0a0a]", "caret-[color:var(--sl-color-gray-13)]"),
]


def main() -> None:
    exts = {".tsx", ".ts", ".css"}
    changed = 0
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or path.suffix not in exts:
            continue
        if "node_modules" in path.parts or "scripts" in path.parts and path.name == "apply-shoreline-text-tokens.py":
            continue
        text = path.read_text(encoding="utf-8")
        orig = text
        for old, new in REPLACEMENTS:
            text = text.replace(old, new)
        if text != orig:
            path.write_text(text, encoding="utf-8")
            changed += 1
            print(path.relative_to(ROOT))
    print(f"OK: {changed} files updated")


if __name__ == "__main__":
    main()
