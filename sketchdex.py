# Community drawings from Sketchdex (sketchdex.app), shown on Pokémon pages in
# place of the sprite, credited to their author. Used with the author's consent.
#
# Two steps, with a human triage in between:
#   python sketchdex.py [ids...]          scrape the most-liked drawings of each
#                                         Pokémon (default: all of pokemons.json)
#                                         and write sketchdex-report.html
#   -> open the report, pick one drawing (or the sprite) per Pokémon, Export
#   python sketchdex.py --apply sketchdex-picks.json
#                                         download the picks to monsters/sketch/
#                                         and write data/sketchdex.json
#
# Scraped lists are cached in .sketchdex-cache/<id>.json (delete to refresh).
# Requires Python 3 + Pillow.

import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from PIL import Image

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/130.0 Safari/537.36"}
CACHE = ".sketchdex-cache"
DATA = "data/sketchdex.json"
OUT_DIR = "monsters/sketch"
TOP = 6      # candidates shown per Pokémon in the report
SIZE = 256   # same canvas as the sprites


def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def community_url(pid):
    return f"https://www.sketchdex.app/community?sort=popular&pokemonId={pid}"


def drawings(pid):
    """Most-liked drawings of a Pokémon, from the page's Next.js RSC payload."""
    path = f"{CACHE}/{pid}.json"
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    page = fetch(community_url(pid)).decode("utf-8")
    chunks = re.findall(r'self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)', page)
    payload = "".join(json.loads(c) for c in chunks)
    i = payload.find('"initialDrawings":')
    if i < 0:
        raise RuntimeError("initialDrawings not found (page layout changed?)")
    items, _ = json.JSONDecoder().raw_decode(payload, i + len('"initialDrawings":'))
    items = [d for d in items if d.get("pokemon_id") == pid and d.get("image_url")]
    items.sort(key=lambda d: -(d.get("likes_count") or 0))
    for d in items:
        d["image_url"] = urllib.parse.urljoin("https://www.sketchdex.app/", d["image_url"])
    keep = [{k: d.get(k) for k in ("id", "username", "image_url", "likes_count",
                                   "dislikes_count", "drawing_mode")} for d in items[:TOP]]
    os.makedirs(CACHE, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(keep, f, ensure_ascii=False)
    time.sleep(1)  # be gentle: only uncached pages hit the site
    return keep


def load_current():
    try:
        with open(DATA, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}


def scrape(ids):
    with open("data/pokemons.json", encoding="utf-8") as f:
        pokemons = json.load(f)
    if ids:
        pokemons = [p for p in pokemons if p["id"] in ids]
    current = load_current()
    rows = []
    for p in pokemons:
        try:
            ds = drawings(p["id"])
            print(f"  [ok]   #{p['id']:>4} {p['imageName']} ({len(ds)})")
        except Exception as e:
            ds = []
            print(f"  [FAIL] #{p['id']:>4} {p['imageName']}: {e}")
        rows.append({"pid": p["id"], "name": p["name"]["fr"], "img": p["imageName"],
                     "current": (current.get(p["imageName"]) or {}).get("id"), "drawings": ds})
    write_report(rows)
    print(f"\n{len(rows)} Pokémon -> sketchdex-report.html")


def write_report(rows):
    data = json.dumps(rows, ensure_ascii=False).replace("</", "<\\/")
    with open("sketchdex-report.html", "w", encoding="utf-8") as f:
        f.write(REPORT.replace("__DATA__", data))


def apply(picks_path):
    with open(picks_path, encoding="utf-8") as f:
        picks = json.load(f)
    current = load_current()
    os.makedirs(OUT_DIR, exist_ok=True)
    for name, pick in picks.items():
        out = f"{OUT_DIR}/{name}.webp"
        if not pick:
            if current.pop(name, None) and os.path.exists(out):
                os.remove(out)
                print(f"  [del]  {name} (back to sprite)")
            continue
        if (current.get(name) or {}).get("id") == pick["id"] and os.path.exists(out):
            continue
        try:
            # Daily-challenge drawings come as site-relative /api/daily/... URLs.
            url = urllib.parse.urljoin("https://www.sketchdex.app/", pick["url"])
            im = Image.open(io.BytesIO(fetch(url))).convert("RGBA")
            bbox = im.getbbox()  # trim the empty canvas so every drawing fills the disc
            if bbox:
                im = im.crop(bbox)
            im.thumbnail((SIZE, SIZE), Image.LANCZOS)
            canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
            canvas.paste(im, ((SIZE - im.width) // 2, (SIZE - im.height) // 2), im)
            canvas.save(out, quality=90, method=6)
            current[name] = {"by": pick["by"], "id": pick["id"]}
            if "/api/daily/" in url:  # not on the community page: link to the artist's dailies
                current[name]["link"] = f"https://www.sketchdex.app/users/{urllib.parse.quote(pick['by'])}/daily"
            print(f"  [ok]   {name} <- {pick['by']}")
        except Exception as e:
            print(f"  [FAIL] {name}: {e}")
    with open(DATA, "w", encoding="utf-8") as f:
        json.dump(dict(sorted(current.items())), f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"\n{len(current)} drawings in {DATA} — run node build.js")


REPORT = r"""<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Triage Sketchdex</title>
<style>
  :root { --bg: #f6f3ec; --card: #fff; --ink: #1c1a16; --muted: #6b665c; --line: #ddd6c8; --pick: #e2483d; }
  @media (prefers-color-scheme: dark) { :root { --bg: #18171a; --card: #232227; --ink: #eee; --muted: #9a96a0; --line: #38363d; } }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.4 system-ui, sans-serif; }
  header { position: sticky; top: 0; z-index: 1; display: flex; gap: 16px; align-items: center; flex-wrap: wrap;
           padding: 12px 16px; background: var(--card); border-bottom: 1px solid var(--line); }
  header h1 { font-size: 16px; margin: 0; }
  button { font: inherit; padding: 6px 14px; border-radius: 8px; border: 1px solid var(--line); background: var(--pick); color: #fff; cursor: pointer; }
  .muted { color: var(--muted); }
  section { padding: 14px 16px; border-bottom: 1px solid var(--line); }
  section h2 { font-size: 15px; margin: 0 0 8px; }
  .opts { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px; }
  label { flex: 0 0 150px; display: flex; flex-direction: column; gap: 4px; padding: 6px; border-radius: 10px;
          border: 2px solid transparent; background: var(--card); cursor: pointer; font-size: 12px; }
  label:has(input:checked) { border-color: var(--pick); }
  label input { position: absolute; opacity: 0; }
  label:has(input:focus-visible) { outline: 2px solid var(--ink); }
  label img { width: 136px; height: 136px; object-fit: contain; background: #e9e3d6; border-radius: 6px; }
  .user { font-weight: 600; overflow-wrap: anywhere; }
</style></head><body>
<header><h1>Triage Sketchdex</h1><span id="count" class="muted"></span>
<button id="export">Exporter sketchdex-picks.json</button>
<span class="muted">puis <code>python sketchdex.py --apply sketchdex-picks.json</code></span></header>
<main id="list"></main>
<script>
const ROWS = __DATA__;
const KEY = 'sketchdex-picks';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch {}
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const list = document.getElementById('list');
for (const r of ROWS) {
  // Saved triage > drawing already on the site > most liked.
  const def = r.img in saved ? saved[r.img] : (r.current ?? r.drawings[0]?.id ?? '');
  const opt = (val, img, body) => `<label><input type="radio" name="${r.img}" value="${val}"${val === (def || '') ? ' checked' : ''}>
    <img src="${img}" alt="" loading="lazy">${body}</label>`;
  list.insertAdjacentHTML('beforeend', `<section><h2>#${String(r.pid).padStart(3, '0')} ${esc(r.name)}
    <a class="muted" href="https://www.sketchdex.app/community?sort=popular&pokemonId=${r.pid}" target="_blank">sketchdex ↗</a></h2>
    <div class="opts">${opt('', `monsters/${r.img}.webp`, '<span class="user">Garder le sprite</span>')}${r.drawings.map(d =>
      opt(d.id, esc(d.image_url), `<span class="user">${esc(d.username)}${d.id === r.current ? ' · en ligne' : ''}</span>
      <span class="muted">♥ ${d.likes_count ?? 0} · ✕ ${d.dislikes_count ?? 0} · ${esc(d.drawing_mode)}</span>`)).join('')}
    ${r.drawings.length ? '' : '<span class="muted">aucun dessin</span>'}</div></section>`);
}
function picks() {
  const out = {};
  for (const r of ROWS) {
    const v = document.querySelector(`input[name="${r.img}"]:checked`)?.value;
    const d = r.drawings.find(x => x.id === v);
    out[r.img] = d ? { id: d.id, by: d.username, url: d.image_url } : null;
  }
  return out;
}
function count() {
  const n = Object.values(picks()).filter(Boolean).length;
  document.getElementById('count').textContent = `${n} dessins / ${ROWS.length} Pokémon`;
}
list.addEventListener('change', e => {
  saved[e.target.name] = e.target.value;
  try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch {}
  count();
});
document.getElementById('export').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(picks(), null, 2)], { type: 'application/json' }));
  a.download = 'sketchdex-picks.json';
  a.click();
};
count();
</script></body></html>
"""

if __name__ == "__main__":
    args = sys.argv[1:]
    if args[:1] == ["--apply"]:
        apply(args[1] if len(args) > 1 else "sketchdex-picks.json")
    else:
        scrape({int(a) for a in args})
