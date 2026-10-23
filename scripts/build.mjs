// Builds data/cards.json from the pokemon-tcg-pocket-cards package + i18n/th.json.
// Card text is matched as a template: numbers become {n}, then are put back in order.
// `--check` fails if any text is untranslated or a translation drops/adds a {n}.
import { readFileSync, writeFileSync } from 'node:fs';

const src = JSON.parse(readFileSync('node_modules/pokemon-tcg-pocket-cards/data/v5/cards.json', 'utf8'));
const th = JSON.parse(readFileSync('i18n/th.json', 'utf8'));
// Keys machine-translated by scripts/translate.mjs and not yet reviewed; cards show them as "AI".
const auto = JSON.parse(readFileSync('i18n/auto.json', 'utf8'));
const ai = { names: new Set(auto.names), text: new Set(auto.text) };
const check = process.argv.includes('--check');

const tpl = (s) => s.replace(/\[\s*([A-Z])\s*\]/g, '[$1]').replace(/\d+/g, '{n}');
const count = (s) => (s.match(/\{n\}/g) || []).length;

const missing = { names: new Set(), text: new Set() };
const bad = [];
for (const [en, t] of Object.entries(th.text)) if (count(en) !== count(t)) bad.push(en);

function text(s) {
  if (!s) return null;
  const key = tpl(s);
  const t = th.text[key];
  if (!t) { missing.text.add(key); return { en: s, th: null }; }
  const nums = s.match(/\d+/g) || [];
  let i = 0;
  return { en: s.replace(/\[\s*([A-Z])\s*\]/g, '[$1]'), th: t.replace(/\{n\}/g, () => nums[i++]), ai: ai.text.has(key) };
}
function name(s) {
  if (!s) return null;
  if (!th.names[s]) missing.names.add(s);
  return { en: s, th: th.names[s] || null, ai: ai.names.has(s) };
}

const IMG = 'https://raw.githubusercontent.com/PocketDecks/pokemon-tcg-pocket-cards/refs/heads/main/images/webp/cards';
const cards = src.map((c) => ({
  id: c.id,
  nr: c.deckBuilderNr, // game entity id / 10 — what deck codes store
  name: c.name,
  set: c.set_code,
  pack: c.pack,
  type: c.type === 'Trainer' ? 'trainer' : 'pokemon',
  sub: c.subtype,
  stage: c.stage,
  from: c.evolves_from,
  rarity: c.rarity,
  hp: c.health,
  retreat: c.retreat,
  weak: c.weakness && c.weakness !== 'none' ? c.weakness : null,
  ex: c.ex,
  points: c.points > 1 ? c.points : null,
  tc: c.tradable ? c.trade_cost : null, // trade token cost; absent = can't be traded (☆☆☆, Crown, Promo)
  mega: c.mega,
  ability: c.ability.exists ? { name: name(c.ability.name), text: text(c.ability.effect) } : null,
  attacks: Object.values(c.attacks).filter((a) => a.name).map((a) => ({
    cost: a.cost && a.cost !== '0' ? a.cost : '',
    name: name(a.name),
    dmg: a.damage,
    text: text(a.effect),
  })),
  text: text(c.card_text),
  artist: c.artist,
  // Image URLs follow one pattern; only keep ones that don't, so the app can derive the rest.
  img: c.image === `${IMG}/${c.set_code}/${c.id.split('-')[1]}.webp` ? null : c.image,
}));

// Group prints of the same card (same name and rules text); `g` links versions, `dup` marks all but the first.
const groups = new Map();
for (const c of cards) {
  const key = JSON.stringify([c.name, c.hp, c.ability, c.attacks, c.text]);
  c.dup = groups.has(key);
  if (!c.dup) groups.set(key, groups.size);
  c.g = groups.get(key);
}

const expansions = JSON.parse(readFileSync('node_modules/pokemon-tcg-pocket-cards/data/v5/expansions.json', 'utf8'));
const PACKS = 'https://raw.githubusercontent.com/PocketDecks/pokemon-tcg-pocket-cards/refs/heads/main/images';
const sets = [...new Map(src.map((c) => [c.set_code, { code: c.set_code, name: c.set_name, date: c.release_date }])).values()];
for (const s of sets) {
  const e = expansions.find((x) => x.id === s.code);
  s.total = cards.filter((c) => c.set === s.code).length;
  // Pack art lives at ${PACKS}/webp/packs/<id>.webp; `name` matches cards' `pack` (single-pack sets use "Booster").
  s.packs = (e?.packs || []).map((p) => ({ id: p.id, name: p.name }));
  // Promo "packs" are distribution channels with no (or missing) art; the repo has one cover per promo set.
  if (/^p[a-z]$/.test(s.code)) s.packs = [{ id: `promo-${s.code[1]}`, name: 'Promo' }];
}
// Announced sets (hand-edited upcoming.json) drop off once their cards arrive in the source data.
const upcoming = JSON.parse(readFileSync('upcoming.json', 'utf8')).filter((u) => !sets.some((s) => s.code === u.code));
const total = missing.names.size + missing.text.size;
console.log(`${cards.length} cards, ${sets.length} sets; untranslated: ${missing.names.size} names, ${missing.text.size} texts; bad {n}: ${bad.length}`);

if (check) {
  if (bad.length) console.error('Placeholder mismatch:\n' + bad.join('\n'));
  if (total) console.error('Untranslated (first 20):\n' + [...missing.names, ...missing.text].slice(0, 20).join('\n'));
  process.exit(bad.length || total ? 1 : 0);
}
const compact = (k, v) => (v === null || v === false || v === '' ? undefined : v);
writeFileSync('data/cards.json', JSON.stringify({ img: IMG, packImg: `${PACKS}/webp/packs`, sets, upcoming, cards }, compact));
// Tiny index for the Worker's link previews (it has ~10 ms CPU, so it can't parse cards.json).
writeFileSync('data/og.json', JSON.stringify({
  cardImg: IMG.replace('/webp/', '/png/'),
  packImg: `${PACKS}/png/packs`,
  sets: Object.fromEntries(sets.map((s) => [s.code, [s.name, s.total, s.packs[0]?.id || null]])),
  cards: Object.fromEntries(cards.map((c) => [c.id, [c.name, c.hp || 0, c.type === 'trainer' ? c.sub : c.ex ? 'ex' : '']])),
}));
writeFileSync('i18n/missing.json', JSON.stringify({ names: [...missing.names], text: [...missing.text] }, null, 1));
