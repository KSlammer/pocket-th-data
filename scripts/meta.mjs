// Tournament meta from the Limitless TCG public API (https://play.limitlesstcg.com, game POCKET) → data/meta.json:
// archetype share and win rate, archetype-vs-archetype results, each archetype's signature cards (to match a user's deck),
// and one real list per archetype (the best finish) so the site can show it and turn it into an in-game QR code.
// Per-tournament summaries are cached in meta-cache.json so each run only downloads new events.
// Unauthenticated limit is 50 requests / 5 min, so requests are spaced 6.5 s apart and capped per run.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const API = 'https://play.limitlesstcg.com/api';
const DAYS = 14, MIN_PLAYERS = 32, MAX_NEW = 20, GAP_MS = 6500;
const TOP = 40; // archetypes kept in the output

// One tournament → { decks: {arch: players}, games: [[a, b, w, l, t]], lists: {arch: {card: lists containing it}}, n: {arch: lists},
//   best: {arch: {placing, players, list: [[count, set, number, name]]}} }.
export function summarize(standings, pairings) {
  const deckOf = new Map(), decks = {}, lists = {}, n = {}, best = {};
  for (const s of standings) {
    const arch = s.deck?.name;
    if (!arch) continue;
    deckOf.set(s.player, arch);
    decks[arch] = (decks[arch] || 0) + 1;
    const entries = [...(s.decklist?.pokemon || []), ...(s.decklist?.trainer || [])];
    const cards = new Set(entries.map((c) => c.name));
    if (!cards.size) continue;
    if (s.placing && (!best[arch] || s.placing < best[arch].placing)) {
      best[arch] = { placing: s.placing, players: standings.length, player: s.name || s.player, list: entries.map((c) => [c.count, c.set, c.number, c.name]) };
    }
    n[arch] = (n[arch] || 0) + 1;
    const l = (lists[arch] ||= {});
    for (const c of cards) l[c] = (l[c] || 0) + 1;
  }
  const games = new Map();
  const add = (a, b, i) => { const k = `${a}\t${b}`; const g = games.get(k) || [0, 0, 0]; g[i]++; games.set(k, g); };
  for (const p of pairings) {
    const a = deckOf.get(p.player1), b = deckOf.get(p.player2);
    if (!a || !b || p.winner === -1 || p.winner === '-1') continue; // byes, unknown decks, double losses
    if (p.winner === 0 || p.winner === '0') { add(a, b, 2); add(b, a, 2); }
    else if (p.winner === p.player1) { add(a, b, 0); add(b, a, 1); }
    else if (p.winner === p.player2) { add(a, b, 1); add(b, a, 0); }
  }
  return { decks, lists, n, best, games: [...games].map(([k, g]) => [...k.split('\t'), ...g]) };
}

// Limitless set/number → our card id ("A3a", 12 → "a3a-012"; promo "P-A" → "pa").
export const cardId = (set, number) => `${String(set).toLowerCase().replace(/^p-/, 'p')}-${String(number).padStart(3, '0')}`;

// Many tournament summaries → the published table. `known(id)` says whether a card id exists in our data.
export function combine(events, known = () => true) {
  const decks = {}, lists = {}, n = {}, games = new Map(), best = {};
  for (const e of events) {
    for (const [a, c] of Object.entries(e.decks)) decks[a] = (decks[a] || 0) + c;
    for (const [a, c] of Object.entries(e.n)) n[a] = (n[a] || 0) + c;
    for (const [a, l] of Object.entries(e.lists)) for (const [card, c] of Object.entries(l)) (lists[a] ||= {})[card] = (lists[a][card] || 0) + c;
    // Best finish relative to field size (1st of 188 beats 1st of 33); only lists whose every card we know.
    for (const [a, b] of Object.entries(e.best || {})) {
      const list = b.list.map(([count, set, number, name]) => [count, cardId(set, number), name]);
      if (!list.every(([, id]) => known(id))) continue;
      const score = b.placing / b.players;
      if (!best[a] || score < best[a].score) best[a] = { score, placing: b.placing, players: b.players, player: b.player, event: e.name, date: e.date, list };
    }
    for (const [a, b, w, l, t] of e.games) {
      const g = games.get(`${a}\t${b}`) || [0, 0, 0];
      games.set(`${a}\t${b}`, [g[0] + w, g[1] + l, g[2] + t]);
    }
  }
  const players = Object.values(decks).reduce((x, y) => x + y, 0);
  const top = Object.entries(decks).sort((x, y) => y[1] - x[1]).slice(0, TOP).map(([a]) => a);
  const keep = new Set(top);
  return {
    players,
    decks: top.map((a) => ({
      name: a,
      players: decks[a],
      share: +(decks[a] / players).toFixed(4),
      // Cards in at least half of this archetype's lists, most common first.
      cards: Object.entries(lists[a] || {}).map(([c, k]) => [c, +(k / n[a]).toFixed(2)]).filter(([, f]) => f >= 0.5).sort((x, y) => y[1] - x[1]).slice(0, 15),
      sample: best[a] && { placing: best[a].placing, players: best[a].players, player: best[a].player, event: best[a].event, date: best[a].date, list: best[a].list.map(([c, id]) => [c, id]) },
    })),
    matchups: [...games].map(([k, g]) => [...k.split('\t'), ...g]).filter(([a, b]) => keep.has(a) && keep.has(b)),
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let last = 0;
async function api(path) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(Math.max(0, last + GAP_MS - Date.now()));
    last = Date.now();
    const res = await fetch(API + path, { headers: { accept: 'application/json', 'user-agent': 'pocket-th-meta/1.0 (+https://pokedex-th.slammer.work)' } });
    if (res.status === 429 || res.status >= 500) { await sleep(30000); continue; }
    if (!res.ok) throw new Error(`${res.status} ${path}`);
    return res.json();
  }
  throw new Error(`gave up on ${path}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let cache = {};
  try { cache = JSON.parse(readFileSync('meta-cache.json', 'utf8')); } catch {}
  const since = new Date(Date.now() - DAYS * 864e5).toISOString();
  const list = (await api('/tournaments?game=POCKET&limit=100')).filter((t) => t.date >= since && t.players >= MIN_PLAYERS);
  // Only the current format: a new set changes the meta, so mixing formats would blur it.
  const format = list.sort((a, b) => b.date.localeCompare(a.date))[0]?.format ?? null;
  const recent = list.filter((t) => t.format === format);
  console.log(`${list.length} recent events ≥${MIN_PLAYERS} players; format ${format}: ${recent.length}; formats seen: ${[...new Set(list.map((t) => t.format))].join(', ')}`);
  let fetched = 0;
  for (const t of recent) {
    if (cache[t.id]?.best || fetched >= MAX_NEW) continue; // entries cached before lists were kept get refetched
    try {
      const standings = await api(`/tournaments/${t.id}/standings`);
      const pairings = await api(`/tournaments/${t.id}/pairings`);
      cache[t.id] = { date: t.date, name: t.name, players: t.players, format: t.format, ...summarize(standings, pairings) };
      fetched++;
      console.log(`+ ${t.date.slice(0, 10)} ${t.name} (${t.players}): ${Object.keys(cache[t.id].decks).length} decks, ${cache[t.id].games.length} matchups`);
    } catch (e) {
      console.warn(`skip ${t.id}: ${e.message}`);
    }
  }
  for (const [id, e] of Object.entries(cache)) if (e.date < since) delete cache[id];
  const events = Object.values(cache).filter((e) => e.format === format);
  if (!events.length) { console.log('No tournament data; meta.json unchanged'); process.exit(0); }
  writeFileSync('meta-cache.json', JSON.stringify(cache));
  const ids = new Set(JSON.parse(readFileSync('data/cards.json', 'utf8')).cards.map((c) => c.id));
  const missingIds = new Set(Object.values(cache).flatMap((e) => Object.values(e.best || {}).flatMap((b) => b.list.map(([, set, num]) => cardId(set, num)))).filter((id) => !ids.has(id)));
  if (missingIds.size) console.log(`card ids not in our data: ${[...missingIds].slice(0, 20).join(' ')}`);
  const dates = events.map((e) => e.date).sort();
  writeFileSync('data/meta.json', JSON.stringify({
    source: 'Limitless TCG',
    sourceUrl: 'https://play.limitlesstcg.com/tournaments?game=POCKET',
    updated: new Date().toISOString(),
    format,
    from: dates[0],
    to: dates.at(-1),
    tournaments: events.length,
    ...combine(events, (id) => ids.has(id)),
  }));
  console.log(`meta.json: ${events.length} events, fetched ${fetched} new`);
}
