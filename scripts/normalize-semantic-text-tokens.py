#!/usr/bin/env python3
"""
Restringe cores de texto aos 3 tokens semânticos Shoreline:
  --sl-fg-base, --sl-fg-base-soft, --sl-fg-base-muted
Mapeia cinzas e tokens antigos para o tom mais próximo.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXT = {".tsx", ".ts", ".css"}

# Ordem: strings mais longas primeiro
ORDERED_REPLACEMENTS: list[tuple[str, str]] = [
    ("var(--sl-fg-accent-pressed)", "var(--sl-fg-base-soft)"),
    ("var(--sl-fg-accent-hover)", "var(--sl-fg-base-soft)"),
    ("var(--sl-fg-accent)", "var(--sl-fg-base-soft)"),
    ("var(--sl-fg-critical-pressed)", "var(--sl-fg-base)"),
    ("var(--sl-fg-critical-hover)", "var(--sl-fg-base)"),
    ("var(--sl-fg-critical)", "var(--sl-fg-base)"),
    ("var(--sl-fg-muted-pressed)", "var(--sl-fg-base)"),
    ("var(--sl-fg-muted-hover)", "var(--sl-fg-base)"),
    ("var(--sl-fg-muted)", "var(--sl-fg-base)"),
    # Não substituir --sl-fg-base-disabled → base-muted: quebraria o alias em index.css.
    ("var(--sl-fg-informational)", "var(--sl-fg-base-soft)"),
    ("var(--sl-fg-success)", "var(--sl-fg-base-soft)"),
    ("var(--sl-fg-warning)", "var(--sl-fg-base-soft)"),
]

# gray-N: escala Shoreline (maior N = mais escuro)
GRAY_TO_TOKEN = {
    13: "base",
    12: "base",
    11: "base",
    10: "base",
    9: "base-soft",
    8: "base-soft",
    7: "base-muted",
    6: "base-muted",
    5: "base-muted",
    4: "base-muted",
    3: "base-muted",
    2: "base-muted",
    1: "base-muted",
    0: "base-muted",
}

PALETTE_SUFFIX = {
    "base": "var(--sl-fg-base)",
    "base-soft": "var(--sl-fg-base-soft)",
    "base-muted": "var(--sl-fg-base-muted)",
}


def map_palette_step(hue: str, n: int) -> str:
    """Cores de paleta (green, red, …): tom mais escuro → base, médio → soft, claro → muted."""
    if n >= 10:
        return PALETTE_SUFFIX["base"]
    if n >= 7:
        return PALETTE_SUFFIX["base-soft"]
    return PALETTE_SUFFIX["base-muted"]


def replace_color_vars(s: str) -> str:
    for old, new in ORDERED_REPLACEMENTS:
        s = s.replace(old, new)

    def gray_repl(m: re.Match[str]) -> str:
        n = int(m.group(1))
        key = GRAY_TO_TOKEN.get(n, "base-muted")
        return f"var(--sl-fg-{key})"

    s = re.sub(r"var\(--sl-color-gray-(\d+)\)", gray_repl, s)

    def palette_repl(m: re.Match[str]) -> str:
        hue, n = m.group(1), int(m.group(2))
        if hue == "gray":
            return m.group(0)
        return map_palette_step(hue, n)

    s = re.sub(r"var\(--sl-color-([a-z]+)-(\d+)\)", palette_repl, s)
    return s


# Tailwind text-* semânticos → um dos 3 tokens (tom de cinza aproximado)
TAILWIND_TEXT = [
    (r"\btext-gray-900\b", "text-[color:var(--sl-fg-base)]"),
    (r"\btext-gray-800\b", "text-[color:var(--sl-fg-base)]"),
    (r"\btext-gray-700\b", "text-[color:var(--sl-fg-base)]"),
    (r"\btext-gray-600\b", "text-[color:var(--sl-fg-base-soft)]"),
    (r"\btext-gray-500\b", "text-[color:var(--sl-fg-base-soft)]"),
    (r"\btext-gray-400\b", "text-[color:var(--sl-fg-base-muted)]"),
    (r"\btext-gray-300\b", "text-[color:var(--sl-fg-base-muted)]"),
    (r"\btext-black\b", "text-[color:var(--sl-fg-base)]"),
]

# Cores: escuro 700+ → base, 500-600 → soft, 400- → muted
for prefix, (hi, mid, lo) in [
    ("blue", ("base-soft", "base-soft", "base-muted")),
    ("red", ("base", "base-soft", "base-muted")),
    ("green", ("base", "base-soft", "base-muted")),
    ("yellow", ("base", "base-soft", "base-muted")),
    ("orange", ("base", "base-soft", "base-muted")),
]:
    TAILWIND_TEXT.append(
        (rf"\btext-{prefix}-900\b", f"text-[color:var(--sl-fg-{hi})]")
    )
    TAILWIND_TEXT.append(
        (rf"\btext-{prefix}-800\b", f"text-[color:var(--sl-fg-{hi})]")
    )
    TAILWIND_TEXT.append(
        (rf"\btext-{prefix}-700\b", f"text-[color:var(--sl-fg-{hi})]")
    )
    TAILWIND_TEXT.append(
        (rf"\btext-{prefix}-600\b", f"text-[color:var(--sl-fg-{mid})]")
    )
    TAILWIND_TEXT.append(
        (rf"\btext-{prefix}-500\b", f"text-[color:var(--sl-fg-{mid})]")
    )
    TAILWIND_TEXT.append(
        (rf"\btext-{prefix}-400\b", f"text-[color:var(--sl-fg-{lo})]")
    )

# hover:text-* e placeholder:text-*
for pattern, repl in list(TAILWIND_TEXT):
    if pattern.startswith(r"\btext-"):
        hp = pattern.replace(r"\btext-", r"\bhover:text-")
        TAILWIND_TEXT.append((hp, repl.replace("text-[", "hover:text-[")))
        pp = pattern.replace(r"\btext-", r"\bplaceholder:text-")
        TAILWIND_TEXT.append((pp, repl.replace("text-[", "placeholder:text-[")))


def apply_tailwind_replacements(s: str) -> str:
    # Ordenar por comprimento do padrão descendente para evitar colisões
    for pattern, repl in sorted(TAILWIND_TEXT, key=lambda x: len(x[0]), reverse=True):
        s = re.sub(pattern, repl, s)
    return s


def should_skip(path: Path) -> bool:
    p = str(path)
    return "node_modules" in p or "dist" in p or ".git" in p


def main() -> int:
    updated = 0
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or path.suffix not in EXT:
            continue
        if should_skip(path):
            continue
        text = path.read_text(encoding="utf-8")
        new = replace_color_vars(text)
        new = apply_tailwind_replacements(new)
        if new != text:
            path.write_text(new, encoding="utf-8")
            print(path.relative_to(ROOT))
            updated += 1
    print(f"OK: {updated} files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
