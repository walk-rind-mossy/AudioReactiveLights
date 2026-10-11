#!/usr/bin/env python3
"""Bundle css + js into ONE self-contained HTML file: dist/music_map_lab.html
Usage: python3 build.py
Script order comes from the <script src> tags in index.html."""
import re, pathlib

root = pathlib.Path(__file__).parent
html = (root / "index.html").read_text(encoding="utf-8")

html = re.sub(
    r'<link rel="stylesheet" href="([^"]+)" />',
    lambda m: "<style>\n" + (root / m.group(1)).read_text(encoding="utf-8") + "</style>",
    html,
)

def inline(m):
    js = (root / m.group(1)).read_text(encoding="utf-8")
    assert "</script" not in js, m.group(1)
    return "<script>\n" + js + "</script>"

html = re.sub(r'<script src="([^"]+)"></script>', inline, html)

out = root / "dist" / "music_map_lab.html"
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding="utf-8")
print("wrote", out, f"{out.stat().st_size / 1024:.0f} KB")
