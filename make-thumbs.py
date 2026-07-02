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
for f in sorted(os.listdir(CARDS)):
    if not f.endswith(".avif"):
        continue
    src = os.path.join(CARDS, f)
    dst = os.path.join(THUMBS, f)
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
        skipped += 1
        continue
    im = Image.open(src)
    if im.width > MAX_W:
        im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
    im.save(dst, quality=60)
    made += 1
    print(f"  [ok] {f} ({im.width}x{im.height})")

print(f"\nDone: {made} generated, {skipped} up to date")
