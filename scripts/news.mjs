// Collects TCG Pocket headlines into data/news.json: title, link, date and source only (no article text or images),
// so the site links out to the original. Titles get a Thai translation when ANTHROPIC_API_KEY is set.
// A source that fails is skipped; earlier items are kept. Run: node scripts/news.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const GN = (q, lang = 'hl=en-US&gl=US&ceid=US:en') => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&${lang}`;
export const SOURCES = [
  { url: GN('"TCG Pocket" when:14d'), kind: 'news' },
  { url: GN('"TCG Pocket" site:pokemon.com when:30d'), kind: 'official' },
  { url: GN('"TCG Pocket" when:14d', 'hl=th&gl=TH&ceid=TH:th'), kind: 'news' },
  { url: 'https://www.reddit.com/r/PTCGP/top/.rss?t=week', kind: 'community', source: 'r/PTCGP' },
];
// Sites run by The Pokémon Company / the game's publishers count as official wherever they show up.
const OFFICIAL = /(^|\.)(pokemon\.com|pokemon\.co\.jp|pokemon-tcgp\.com|tcgpocket\.pokemon\.com)$/;
const KEEP = 80, DAYS = 30;

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", nbsp: ' ' };
const decode = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e] ?? m))
  .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const tag = (xml, name) => xml.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`))?.[1];

// RSS <item> (Google News) and Atom <entry> (Reddit).
export function parse(xml, src) {
  return [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/g)].map(([x]) => {
    let title = decode(tag(x, 'title') || '');
    const link = decode(tag(x, 'link') || '') || x.match(/<link[^>]*href="([^"]+)"/)?.[1] || '';
    const date = new Date(tag(x, 'pubDate') || tag(x, 'published') || tag(x, 'updated') || 0);
    const srcUrl = x.match(/<source[^>]*url="([^"]+)"/)?.[1];
    let source = src.source || decode(tag(x, 'source') || '');
    // Google News titles end in " - Source Name".
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -source.length - 3);
    let host = '';
    try { host = new URL(srcUrl || link).hostname.replace(/^www\./, ''); } catch {}
    const kind = OFFICIAL.test(host) ? 'official' : src.kind === 'official' ? 'news' : src.kind;
    return { title, link, date: isNaN(date) ? null : date.toISOString(), source: source || host, kind };
  }).filter((i) => i.title && /^https:\/\//.test(i.link) && i.date);
}

const norm = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
// Newest first, one entry per link and per headline, only the last DAYS days.
export function merge(old, fresh, now = Date.now()) {
  const seen = new Set(), out = [];
  for (const i of [...fresh, ...old].sort((a, b) => b.date.localeCompare(a.date))) {
    const k = norm(i.title);
    if (seen.has(i.link) || seen.has(k) || now - Date.parse(i.date) > DAYS * 864e5) continue;
    seen.add(i.link).add(k);
    // A translation from an earlier run carries over.
    out.push({ ...i, th: i.th ?? old.find((o) => o.link === i.link)?.th });
  }
  return out.slice(0, KEEP);
}

const isThai = (s) => /[฀-๿]/.test(s);
async function translateTitles(items) {
  const todo = items.filter((i) => !i.th && !isThai(i.title));
  if (!todo.length || !process.env.ANTHROPIC_API_KEY) return;
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const msg = await new Anthropic().beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 8000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: { type: 'object', properties: { th: { type: 'array', items: { type: 'string' } } }, required: ['th'], additionalProperties: false } },
    },
    system: 'Translate Pokémon TCG Pocket news headlines to natural, short Thai. Keep Pokémon names, card names, set names and game names in English. Return one translation per input, in the same order.',
    messages: [{ role: 'user', content: JSON.stringify(todo.map((i) => i.title)) }],
  });
  if (msg.stop_reason !== 'end_turn') return console.warn(`Title translation skipped (${msg.stop_reason})`);
  const { th } = JSON.parse(msg.content.find((b) => b.type === 'text').text);
  if (th.length === todo.length) todo.forEach((i, n) => (i.th = th[n]));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  let old = [];
  try { old = JSON.parse(readFileSync('data/news.json', 'utf8')).items; } catch {}
  const fresh = [];
  for (const src of SOURCES) {
    try {
      const res = await fetch(src.url, { headers: { 'user-agent': 'pocket-th-news/1.0 (+https://pokedex-th.slammer.work)' } });
      if (!res.ok) throw new Error(res.status);
      const items = parse(await res.text(), src);
      console.log(`${items.length} from ${src.url}`);
      fresh.push(...items);
    } catch (e) {
      console.warn(`skip ${src.url}: ${e.message}`);
    }
  }
  const items = merge(old, fresh);
  try { await translateTitles(items); } catch (e) { console.warn(`Title translation failed: ${e.message}`); }
  writeFileSync('data/news.json', JSON.stringify({ items }, (k, v) => (v === undefined ? undefined : v), 1));
  console.log(`${items.length} items`);
}
