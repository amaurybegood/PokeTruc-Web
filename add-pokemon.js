// Authoring helper: add a Pokémon of any generation to the catalogue.
//
// Given a National Pokédex number (or English slug/name), this fetches the
// localised names (en/fr/jp/ko/zh) and generation from PokéAPI, downloads the
// official-artwork sprite into monsters/, and upserts a sorted entry into
// data/pokemons.json. It does NOT touch cards — add those in
// data/pokemon_cards.json (+ images in cards/) afterwards, then run build.js.
//
// Requires Node 18+ (global fetch). No npm dependencies.
//
// Usage:
//   node add-pokemon.js <dexNumber|name> [--status done|in_progress|coming_soon]
// Examples:
//   node add-pokemon.js 172            # Pichu
//   node add-pokemon.js victini --status coming_soon

const fs = require('fs');
const { execFileSync } = require('child_process');

const POKEMONS_PATH = 'data/pokemons.json';
const SPRITES_DIR = 'monsters';
const SPRITE_SIZE = 256; // match the existing sprites (square transparent PNG)
const VALID_STATUS = new Set(['done', 'in_progress', 'coming_soon']);

// Mirror of build.js slugify() — keep in sync so imageName / detail-page slug match.
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/♀/g, 'f')
    .replace(/♂/g, 'm')
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// PokéAPI species.names[] use these language codes; map to our name fields.
// jp ← katakana (ja-Hrkt) to match existing data (e.g. "ピカチュウ"); zh ← simplified.
const NAME_LANG = {
  en: ['en'],
  fr: ['fr'],
  jp: ['ja-hrkt', 'ja'],
  ko: ['ko'],
  zh: ['zh-hans', 'zh-hant'],
};

const ROMAN_TO_GEN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 };

function parseArgs(argv) {
  const args = { query: null, status: 'done' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--status') {
      args.status = argv[++i];
    } else if (a.startsWith('--status=')) {
      args.status = a.slice('--status='.length);
    } else if (!args.query) {
      args.query = a;
    }
  }
  return args;
}

function pickName(names, langCodes) {
  for (const code of langCodes) {
    const hit = names.find(n => n.language.name === code);
    if (hit) return hit.name;
  }
  return null;
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function main() {
  const { query, status } = parseArgs(process.argv.slice(2));

  if (!query) {
    console.error('Usage: node add-pokemon.js <dexNumber|name> [--status done|in_progress|coming_soon]');
    process.exit(1);
  }
  if (!VALID_STATUS.has(status)) {
    console.error(`Invalid --status "${status}". Use one of: ${[...VALID_STATUS].join(', ')}`);
    process.exit(1);
  }

  const key = String(query).toLowerCase();

  console.log(`→ Fetching species data for "${query}"…`);
  const species = await fetchJSON(`https://pokeapi.co/api/v2/pokemon-species/${key}`);

  const id = species.id;
  const name = {};
  for (const [field, codes] of Object.entries(NAME_LANG)) {
    name[field] = pickName(species.names, codes) || species.name;
  }

  const genSlug = (species.generation?.name || '').replace('generation-', '');
  const generation = ROMAN_TO_GEN[genSlug] || null;
  if (!generation) {
    console.warn(`⚠ Could not parse generation from "${species.generation?.name}" — leaving it unset, fix it manually.`);
  }

  const slug = slugify(name.en);
  const imageName = slug;

  console.log(`→ Fetching sprite for #${id} ${name.en}…`);
  const pokemon = await fetchJSON(`https://pokeapi.co/api/v2/pokemon/${id}`);
  const spriteUrl = pokemon.sprites?.other?.home?.front_default
    || pokemon.sprites?.other?.['official-artwork']?.front_default
    || pokemon.sprites?.front_default;
  if (!spriteUrl) throw new Error(`No sprite found for #${id} ${name.en}`);

  const spritePath = `${SPRITES_DIR}/${imageName}.png`;
  const spriteRes = await fetch(spriteUrl);
  if (!spriteRes.ok) throw new Error(`HTTP ${spriteRes.status} downloading sprite ${spriteUrl}`);
  const buf = Buffer.from(await spriteRes.arrayBuffer());
  fs.writeFileSync(spritePath, buf);
  console.log(`✓ Sprite saved → ${spritePath} (${(buf.length / 1024).toFixed(0)} KB)`);

  // Normalise to a square transparent SPRITE_SIZE canvas (matches the other
  // sprites) via Python/Pillow. Graceful: if Python/Pillow is missing the
  // native-size artwork is kept and we just warn.
  try {
    const py = `from PIL import Image
im = Image.open(r'${spritePath}').convert('RGBA')
im.thumbnail((${SPRITE_SIZE}, ${SPRITE_SIZE}), Image.LANCZOS)
c = Image.new('RGBA', (${SPRITE_SIZE}, ${SPRITE_SIZE}), (0, 0, 0, 0))
c.paste(im, ((${SPRITE_SIZE} - im.width) // 2, (${SPRITE_SIZE} - im.height) // 2), im)
c.save(r'${spritePath}')`;
    execFileSync('python', ['-c', py], { stdio: 'ignore' });
    const kb = (fs.statSync(spritePath).size / 1024).toFixed(0);
    console.log(`✓ Sprite resized to ${SPRITE_SIZE}×${SPRITE_SIZE} (${kb} KB)`);
  } catch {
    console.warn(`⚠ Could not resize (Python/Pillow missing?) — sprite kept at native size. Run: python refresh-sprites.py`);
  }

  // Upsert into pokemons.json, kept sorted by id (idempotent on re-run).
  const data = JSON.parse(fs.readFileSync(POKEMONS_PATH, 'utf8'));
  const entry = { id, name, imageName, generation, researchStatus: status };
  const existingIdx = data.findIndex(p => p.id === id);
  if (existingIdx !== -1) {
    data[existingIdx] = entry;
    console.log(`✓ Updated existing entry #${id} ${name.en}`);
  } else {
    data.push(entry);
    console.log(`✓ Added new entry #${id} ${name.en} (Gen ${generation ?? '?'})`);
  }
  data.sort((a, b) => a.id - b.id);
  fs.writeFileSync(POKEMONS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');

  console.log('');
  console.log(`  Names: ${name.en} / ${name.fr} / ${name.jp} / ${name.ko} / ${name.zh}`);
  console.log(`  imageName: ${imageName}  ·  detail page: /pokemon/${slug}/`);
  console.log('');
  console.log('Next steps:');
  console.log(`  1. Add this Pokémon's cards to data/pokemon_cards.json (pokemonId: ${id}) + images in cards/`);
  console.log('  2. Run: node build.js');
  console.log('');
  console.log('Note: the sprite is the PokéAPI Pokémon HOME render, normalised to 256×256 to match the others.');
  console.log('      To re-pull every sprite from one source, run: python refresh-sprites.py');
}

main().catch(err => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
