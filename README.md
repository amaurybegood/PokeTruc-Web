# PokéTruc — Language- & Region-Exclusive Pokémon TCG Card Illustrations

A free, fan-made, ad-free catalogue of Pokémon Trading Card Game illustrations that were **only ever printed in a single language, or released in a single region** — Japanese-only promos, Chinese-market exclusives, Western-only sets like *Call of Legends*, and more. The kind of rare artwork most collectors have never seen.

**Live site → https://poketruc.com/**

Each Pokémon has its own page listing its exclusive cards, grouped by exclusivity category, with year, artist and a source link. Fully localised in 5 languages.

---

## Features

- Catalogue of **language- and region-exclusive** cards across Gen 1 and beyond
- Per-Pokémon pages plus a flat "all cards" view, filterable by exclusivity category (🇯🇵 🇬🇧 🇨🇳 🌍 …)
- Search by Pokémon name/number, **set, or artist**
- Separate gallery for exclusive **Trainer** cards
- Light / dark theme, fully responsive
- Available in EN / FR / JA / KO / ZH

## Tech

Pure HTML / CSS / vanilla JS, **zero npm dependencies**. A small Node script
(`build.js`, Node 18+) generates 5 fully-localised URL trees from the JSON in
`data/`, along with `sitemap.xml`, hreflang + JSON-LD metadata, and an `llms.txt`.
Hosted on GitHub Pages.

## Adding content

### Add a Pokémon (any generation)

The catalogue started as Gen 1 only, but Pokémon from any generation can be added
on request. A helper script fetches the localised names (en/fr/jp/ko/zh), the
generation, and the sprite from [PokéAPI](https://pokeapi.co/):

```sh
node add-pokemon.js 172              # by National Pokédex number (Pichu)
node add-pokemon.js victini          # or by English name
node add-pokemon.js 494 --status coming_soon
```

It downloads the sprite into `monsters/` and inserts a sorted entry into
`data/pokemons.json`. Then add that Pokémon's cards to `data/pokemon_cards.json`
(`pokemonId` = its dex number) with the images in `cards/`, run
`python make-thumbs.py` (generates the grid thumbnails in `cards/thumbs/` —
the build fails if one is missing), and run `node build.js`.

> Sprites come from PokéAPI's **Pokémon HOME** renders, normalised to a 256×256
> transparent PNG plus a `.webp` derivative the site serves (needs Python +
> Pillow; without it the native-size sprite is kept). To re-pull **every** sprite from one source — e.g. after deciding on a
> consistent style — run `python refresh-sprites.py` (defaults to `home`;
> `--source official-artwork` / `--size 0` also available).

### Add Trainer cards

Trainer cards are not tied to a Pokémon, so they live in their own flat gallery at
`/trainers/`. Add entries to `data/trainer_cards.json` (images in `cards/`), then
run `node build.js`. Put the card number in parentheses at the end of `title`
(`"Rika (CSV4 159)"`): the build splits it into the name and the number shown
on the card, unless the entry has its own `setNumber`.

```json
{
  "title": "Misty",
  "name": "Gym Heroes",
  "imageName": "misty_gym_heroes_18",
  "rarity": "Rare",
  "description": "",
  "languages": ["🇯🇵"],
  "year": 2000,
  "artist": "Ken Sugimori"
}
```

`title` is what the card depicts (shown as the heading); `name` is the set. Like
Pokémon cards, a single `languages` flag — or `region: "western" | "asian"` for
multi-language releases — sets the exclusivity group the card appears under.

### Home page "News" block

`data/news.json` powers the curated "latest exclusive cards released" block at the
top of the home page. It's independent from the catalogue — list whatever 2-3
real-world releases you want to highlight (they don't need a page on the site).
Edit the file and run `node build.js`:

```json
[
  {
    "title": "Carmine SAR",
    "code": "CSV8C 255/207",
    "set": "Brilliant Illusions",
    "imageName": "carmine_csv8c_255",
    "languages": ["🇨🇳"],
    "year": 2026,
    "link": "/trainers/#carmine_csv8c_255"
  }
]
```

All fields are optional except `title`. Put the set code in `code`, not in the
title (they are shown on separate lines). `imageName` points to `cards/<name>.avif`
(or use `"image": "https://…"` for an off-site image); when it's a catalogue card,
its exclusivity tag (`CN ONLY`, `CN · TH`…) comes from the catalogue, otherwise
from `languages`. `link` makes the item clickable — an internal path written for
the English site (`/trainers/`, localised automatically on /fr/, /ja/…) or an
external URL (opens in a new tab). `note` is kept for your own reference but is no
longer displayed. The block is hidden automatically when the file is empty (`[]`).

### Home page hero

`data/hero.json` picks the 3 fanned cards on the yellow panel at the top of the
home page, front card first, then the left and right ones:

```json
{ "cards": ["25_Pikachu_jpn_unp_207", "25_Pikachu_jpn_mcdemp_10", "25_Pikachu_jpn_vses3_42"] }
```

They must be catalogue cards (the build fails otherwise). The caption (Pokémon
name + year range) and the tag are derived from them.

**Deep-linking to a specific card.** Every card on a Pokémon page and on the
Trainers page has an `id` equal to its `imageName`. So a `link` can point straight
at one card: `"/trainers/#carmine_csv8c_255"` or `"/pokemon/pikachu/#25_Pikachu_jpn_unp_13"`.
On arrival the page scrolls to that card and briefly flashes a highlight ring.

## Disclaimer

This site is unofficial and fan-made. Pokémon and Pokémon character names are trademarks of Nintendo / Creatures Inc. / GAME FREAK inc. Card images and Pokémon sprites are the property of their respective owners and are used here for non-commercial, fan purposes only.

## License

The source code (HTML, CSS, JS) is available under the [MIT License](LICENSE).
Assets (card images, Pokémon sprites) are **not** covered by this license and remain the property of their respective owners.
