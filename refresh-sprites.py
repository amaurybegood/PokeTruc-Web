# Bulk-refresh every Pokémon sprite from PokéAPI.
#
# Re-downloads the sprite for each entry in data/pokemons.json, resizes it to a
# square transparent canvas (default 256x256, matching the existing sprites) and
# overwrites monsters/<imageName>.png. Idempotent — safe to re-run.
#
# Requires Python 3 + Pillow. No npm deps.
#
# Usage:
#   python refresh-sprites.py                          # home renders, 256px
#   python refresh-sprites.py --source official-artwork
#   python refresh-sprites.py --source home --size 0   # native size
#
# Sources (PokeAPI sprites.other.<source>.front_default): home | official-artwork
# A Pokémon that lacks the chosen source is skipped (its current sprite is kept).

import io
import json
import sys
import urllib.request
from PIL import Image

# Windows consoles default to cp1252; force UTF-8 so output never crashes.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

SOURCE = "home"
SIZE = 256

args = sys.argv[1:]
i = 0
while i < len(args):
    if args[i] == "--source" and i + 1 < len(args):
        SOURCE = args[i + 1]; i += 2
    elif args[i] == "--size" and i + 1 < len(args):
        SIZE = int(args[i + 1]); i += 2
    else:
        i += 1

UA = {"User-Agent": "PokeTruc-sprite-refresh"}


def fetch_json(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def fetch_bytes(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def sprite_url(sprites):
    # Only the chosen source — no silent fallback, so a Pokémon that lacks it is
    # skipped (its existing sprite is left untouched) rather than mixed in.
    other = sprites.get("other", {}) or {}
    src = other.get(SOURCE, {}) or {}
    return src.get("front_default")


with open("data/pokemons.json", encoding="utf-8") as f:
    pokemons = json.load(f)

size_note = f" @ {SIZE}x{SIZE}" if SIZE > 0 else " (native size)"
print(f"Refreshing sprites from '{SOURCE}'{size_note} — {len(pokemons)} Pokémon\n")

ok = 0
skipped = []
failed = []
for p in pokemons:
    pid, name = p["id"], p["imageName"]
    try:
        data = fetch_json(f"https://pokeapi.co/api/v2/pokemon/{pid}")
        url = sprite_url(data.get("sprites", {}) or {})
        if not url:
            skipped.append((pid, name))
            print(f"  [skip] #{pid:>4} {name} (no '{SOURCE}' sprite)")
            continue
        im = Image.open(io.BytesIO(fetch_bytes(url))).convert("RGBA")
        if SIZE > 0:
            im.thumbnail((SIZE, SIZE), Image.LANCZOS)
            canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
            canvas.paste(im, ((SIZE - im.width) // 2, (SIZE - im.height) // 2), im)
            im = canvas
        im.save(f"monsters/{name}.png")
        ok += 1
        print(f"  [ok]   #{pid:>4} {name}")
    except Exception as e:
        failed.append((pid, name, str(e)))
        print(f"  [FAIL] #{pid:>4} {name}: {e}")

print(f"\nDone: {ok} updated, {len(skipped)} skipped (kept), {len(failed)} failed")
for pid, name, err in failed:
    print(f"  - #{pid} {name}: {err}")
