// Interim card data for a released set that the pokemon-tcg-pocket-cards package doesn't have yet, read from the
// Limitless TCG Pocket card database (https://pocket.limitlesstcg.com; robots.txt allows it). Writes extra/<set>.json
// in the package's card format. build.mjs translates these cards ahead of time but doesn't publish them (no images);
// once the package ships the set (with images) the translations are already there and this script deletes the file.
// Only the card text is taken (no images); cards carry no deckBuilderNr, so the site can't put them in deck codes yet.
// One request every 1.5 s; a set is fetched again only when Limitless lists more cards than we have.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const BASE = 'https://pocket.limitlesstcg.com/cards';
const UA = { 'user-agent': 'pocket-th/1.0 (+https://pokedex-th.slammer.work)' };

const decode = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const clean = (s) => decode(s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const between = (h, a, b) => { const i = h.indexOf(a); if (i < 0) return ''; const j = h.indexOf(b, i + a.length); return h.slice(i + a.length, j < 0 ? undefined : j); };
const all = (h, re) => [...h.matchAll(re)];

// "C1" on Limitless → "c1" in the package; "B4b" → "b4b".
export const limitlessCode = (code) => code[0].toUpperCase() + code.slice(1);

// One card page → a card in the package's format (only the fields build.mjs reads).
export function parseCard(html, { set, setName, release, number }) {
  const main = between(html, 'class="card-page-main"', 'class="card-prints"');
  const name = clean(between(main, 'class="card-text-name">', '</span>'));
  const title = clean(between(main, 'class="card-text-title">', '</p>'));
  const kind = clean(between(main, 'class="card-text-type">', '</p>')); // "Pokémon - Stage 1 - Evolves from Bulbasaur" / "Trainer - Supporter"
  const trainer = /^Trainer/.test(kind);
  const [, types = ''] = title.match(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*-\\s*([^-]+?)\\s*-\\s*\\d+ HP`)) || [];
  const hp = +(title.match(/(\d+) HP/)?.[1] || 0) || null;
  const stage = trainer ? null : kind.match(/-\s*(Basic|Stage 1|Stage 2)/)?.[1] || null;
  let sub = trainer ? kind.match(/-\s*(Item|Supporter|Stadium|Pokémon Tool|Tool)/)?.[1] || null : types.split(/\s*[/&,]\s*/)[0] || null;
  if (sub === 'Pokémon Tool') sub = 'Tool';
  const ability = main.includes('card-text-ability')
    ? { exists: true, name: clean(between(main, 'card-text-ability-info">', '</p>')).replace(/^Ability:\s*/, ''), effect: clean(between(main, 'card-text-ability-effect">', '</p>')) || null }
    : { exists: false, name: null, effect: null };
  const attacks = {};
  all(main, /<div class="card-text-attack">([\s\S]*?)<\/div>/g).forEach(([, a], i) => {
    const info = between(a, 'card-text-attack-info">', '</p>');
    const cost = info.match(/ptcg-symbol">([^<]*)</)?.[1].trim() || '0';
    const rest = clean(info.replace(/<span class="ptcg-symbol">[^<]*<\/span>/, ''));
    const [, atk, dmg] = rest.match(/^(.*?)\s*(\d+[+x×]?)?$/) || [, rest];
    // "60+" is stored as 60, like the package does.
    attacks[i + 1] = { cost, name: atk, damage: dmg ? parseInt(dmg, 10) : null, effect: clean(between(a, 'card-text-attack-effect">', '</p>')) || null };
  });
  for (const k of [1, 2]) attacks[k] ||= { cost: null, name: null, damage: null, effect: null };
  // Trainer rules text is the section after the type line.
  const sections = all(main, /<div class="card-text-section[^"]*">([\s\S]*?)<\/div>/g).map((m) => m[1]);
  const cardText = trainer ? clean(sections[1] || '') || null : null;
  const wrr = clean(all(main, /card-text-wrr">([\s\S]*?)<\/p>/g).map((m) => m[1]).join(' '));
  const weakness = wrr.match(/Weakness:\s*([A-Za-z]+)/)?.[1];
  const current = clean(between(html, 'prints-current-details">', '</div>')); // "Dual Fusion (C1) #1 · ◊ · Pikachu pack"
  const rarity = current.match(/#\d+\s*·\s*([◊☆]+|Crown Rare|Promo)/)?.[1] || null;
  const pack = current.match(/·\s*([^·]+?) pack\s*$/)?.[1];
  return {
    id: `${set}-${String(number).padStart(3, '0')}`,
    name,
    set_code: set,
    set_name: setName,
    pack: pack || `Shared(${setName})`,
    release_date: release,
    type: trainer ? 'Trainer' : 'Pokémon',
    subtype: sub,
    stage,
    evolves_from: kind.match(/Evolves from\s+(.+)$/)?.[1].trim() || null,
    rarity,
    ex: / ex$/.test(name),
    mega: /^Mega /.test(name),
    health: hp,
    retreat: trainer ? null : +(wrr.match(/Retreat:\s*(\d+)/)?.[1] ?? 0),
    weakness: trainer ? null : weakness && weakness !== 'none' ? weakness : 'none',
    ability,
    card_text: cardText,
    attacks,
    points: trainer ? null : / ex$/.test(name) ? (/^Mega /.test(name) ? 3 : 2) : 1,
    tradable: !!rarity && !/☆☆☆|Crown|Promo/.test(rarity),
    trade_cost: null, // filled in by build.mjs from the newest packaged set's costs per rarity
    deckBuilderNr: null,
    artist: clean(between(main, 'card-text-artist">', '</div>')).replace(/^Illustrated by\s*/, '') || null,
    image: null,
    source: 'limitless',
  };
}

async function get(url) {
  for (let t = 0; t < 3; t++) {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) }).catch(() => null);
    if (res?.ok) return res.text();
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`failed ${url}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const have = new Set(JSON.parse(readFileSync('node_modules/pokemon-tcg-pocket-cards/data/v5/cards.json', 'utf8')).map((c) => c.set_code));
  mkdirSync('extra', { recursive: true });
  // The package has caught up: drop our interim copy.
  for (const f of readdirSync('extra')) if (have.has(f.replace(/\.json$/, ''))) { rmSync(`extra/${f}`); console.log(`extra/${f}: removed, the package has this set now`); }
  const upcoming = JSON.parse(readFileSync('upcoming.json', 'utf8'));
  for (const u of upcoming.filter((x) => !have.has(x.code) && Date.parse(x.date) <= Date.now())) {
    const code = limitlessCode(u.code);
    const list = await get(`${BASE}/${code}`);
    const numbers = [...new Set(all(list, new RegExp(`href="/cards/${code}/(\\d+)"`, 'g')).map((m) => +m[1]))].sort((a, b) => a - b);
    const file = `extra/${u.code}.json`;
    const old = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
    if (!numbers.length || numbers.length <= old.length) { console.log(`${code}: ${numbers.length} cards listed, ${old.length} kept; nothing new`); continue; }
    const cards = [];
    for (const n of numbers) {
      try {
        cards.push(parseCard(await get(`${BASE}/${code}/${n}`), { set: u.code, setName: u.name, release: u.date.slice(0, 10), number: n }));
      } catch (e) { console.warn(`${code}/${n}: ${e.message}`); }
      await new Promise((r) => setTimeout(r, 1500));
    }
    if (cards.length > old.length) writeFileSync(file, JSON.stringify(cards, null, 1));
    console.log(`${code}: ${cards.length}/${numbers.length} cards from Limitless → ${file}`);
  }
}
