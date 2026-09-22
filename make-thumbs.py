# Generate grid thumbnails for every card image.
#
# Creates cards/thumbs/<name>.avif (max width 480px) for each cards/*.avif.
# The site serves thumbnails in the card grids via srcset; the fullscreen
# viewer still loads the original. Idempotent: existing up-to-date thumbs are
# skipped, so run it after adding new cards (build.js fails if one is missing).
#
# Requires Python 3 + Pillow with AVIF support (Pillow >= 11.2).
#
# Usage:
#   python make-thumbs.py

import json
import os
import sys
from PIL import Image

# Windows consoles default to cp1252; force UTF-8 so output never crashes.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

CARDS = "cards"
THUMBS = os.path.join(CARDS, "thumbs")
MAX_W = 480
os.makedirs(THUMBS, exist_ok=True)

made = skipped = 0
def thumb(f, dst_dir, max_w):
    global made, skipped
    src = os.path.join(CARDS, f)
    dst = os.path.join(dst_dir, f)
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
        skipped += 1
        return
    im = Image.open(src)
    if im.width > max_w:
        im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
    im.save(dst, quality=60)
    made += 1
    print(f"  [ok] {dst} ({im.width}x{im.height})")

for f in sorted(os.listdir(CARDS)):
    if f.endswith(".avif"):
        thumb(f, THUMBS, MAX_W)

# Home "latest cards" block shows cards at 56px CSS: a 200px thumb covers 3x.
# Only the cards listed in data/news.json get one (cards/thumbs/news/).
NEWS_THUMBS = os.path.join(THUMBS, "news")
os.makedirs(NEWS_THUMBS, exist_ok=True)
with open(os.path.join("data", "news.json"), encoding="utf-8") as fh:
    for n in json.load(fh):
        if n.get("imageName"):
            thumb(n["imageName"] + ".avif", NEWS_THUMBS, 200)

print(f"\nDone: {made} generated, {skipped} up to date")
