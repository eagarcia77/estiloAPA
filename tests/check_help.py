#!/usr/bin/env python3
"""Verify help integration and keep user-facing changes documented."""
from pathlib import Path
import os
import re
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
errors = []
index = (root / "index.html").read_text(encoding="utf-8")
help_html = (root / "help.html").read_text(encoding="utf-8")
changelog = (root / "HELP_CHANGELOG.md").read_text(encoding="utf-8")
if not re.search(r'href=["\']help\.html["\']', index):
    errors.append("index.html must link to help.html")
for term in ("importar", "APA 7", "Gemini", "accesibilidad", "exportar", "regla"):
    if term.casefold() not in help_html.casefold():
        errors.append(f"Help section missing: {term}")
if "Regla obligatoria de mantenimiento" not in changelog:
    errors.append("Missing maintenance policy in HELP_CHANGELOG.md")
base = os.getenv("HELP_CHECK_BASE", "").strip()
if base:
    diff = subprocess.run(["git", "diff", "--name-only", f"{base}...HEAD"], cwd=root, capture_output=True, text=True)
    if diff.returncode:
        errors.append("Unable to compare PR files with base: " + diff.stderr.strip())
    else:
        changed = set(diff.stdout.splitlines())
        user_facing = {p for p in changed if p.endswith((".js", ".css", ".html")) and not p.startswith(("tests/", ".github/")) and p != "help.html"}
        if user_facing and not {"help.html", "HELP_CHANGELOG.md"}.issubset(changed):
            errors.append("User-facing changes require BOTH help.html and HELP_CHANGELOG.md in the same PR. A documentation-only exception must be handled by a separate review.")
if errors:
    for err in errors:
        print("ERROR:", err, file=sys.stderr)
    sys.exit(1)
print("PASS: Help navigation, topics, maintenance policy and PR documentation are consistent.")
