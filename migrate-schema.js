// Schema migration: convert from {displayLanguage, releasedIn} to {languages, region}.
//
// Re-runnable / idempotent. Reads the current shape, writes the new one with a
// stable key order.
//
// Final schema per card:
//   languages: [flag, ...]    // ≥1 release language, always an array
//   region:    "western"      // only for multi-language Western releases
//            | "asian"        // only for multi-language Asian releases
//            | (absent)       // mono-language: language is the exclusivity
//
// Known Western multi-language sets (released in EN/DE/FR/IT/ES, never in JP):
//   - Call of Legends
//   - My First Battle: {Bulbasaur, Charmander, Squirtle, Pikachu} Deck

const fs = require('fs');
const path = 'data/pokemon_cards.json';

const WEST_FLAGS = new Set(['🇬🇧', '🇩🇪', '🇫🇷', '🇮🇹', '🇪🇸', '🇵🇹', '🇵🇱']);
const ASIA_FLAGS = new Set(['🇯🇵', '🇨🇳', '🇰🇷', '🇮🇩']);

function regionFor(languages) {
  if (languages.length === 1) return undefined;
  if (languages.every(f => WEST_FLAGS.has(f))) return 'western';
  if (languages.every(f => ASIA_FLAGS.has(f))) return 'asian';
  return undefined;
}

const data = JSON.parse(fs.readFileSync(path, 'utf8'));

let migrated = 0;
let regionAdded = 0;
for (let i = 0; i < data.length; i++) {
  const c = data[i];
  // Accept any of the historical shapes:
  //   {language}                          (original)
  //   {displayLanguage, releasedIn}       (intermediate)
  //   {languages, region?}                (current target — idempotent)
  let languages = c.languages
    || c.releasedIn
    || (c.displayLanguage ? [c.displayLanguage] : null)
    || (c.language ? [c.language] : null);

  if (!languages || !languages.length) {
    throw new Error(`Card #${i} (${c.imageName || c.name}) has no language info`);
  }

  const region = c.region !== undefined ? c.region : regionFor(languages);

  if (!c.languages) migrated++;
  if (region && !c.region) regionAdded++;

  const next = {
    pokemonId: c.pokemonId,
    name: c.name,
    imageName: c.imageName,
    rarity: c.rarity,
    description: c.description,
    languages,
    year: c.year,
    artist: c.artist,
  };
  if (region) next.region = region;
  data[i] = next;
}

fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`✓ ${data.length} cards processed`);
console.log(`✓ ${migrated} converted to {languages, region?} shape`);
console.log(`✓ ${regionAdded} tagged with a region (western/asian)`);
