// Collects TCG Pocket headlines into data/news.json: title, link, date and source only (no article text or images),
// so the site links out to the original. Titles get a Thai translation when an LLM key is set (scripts/llm.mjs).
// A source that fails is skipped; earlier items are kept. Run: node scripts/news.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { llm } from './llm.mjs';

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
    // Reddit posts carry a thumbnail; Google News items have none (the site falls back to card art).
    const img = x.match(/<media:thumbnail[^>]*url="(https:\/\/[^"]+)"/)?.[1]?.replace(/&amp;/g, '&');
    return { title, link, date: isNaN(date) ? null : date.toISOString(), source: source || host, kind, img };
  }).filter((i) => i.title && /^https:\/\//.test(i.link) && i.date);
}

// Search feeds also catch forum threads and general Pokémon news; keep headlines about the game itself.
// Reddit posts are already from the game's subreddit.
const relevant = (i) => i.kind === 'community' || /pocket|ptcgp/i.test(i.title);
const norm = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
// Newest first, one entry per link and per headline, only the last DAYS days.
export function merge(old, fresh, now = Date.now()) {
  const seen = new Set(), out = [];
  for (const i of [...fresh, ...old].sort((a, b) => b.date.localeCompare(a.date))) {
    const k = norm(i.title);
    if (!relevant(i) || seen.has(i.link) || seen.has(k) || now - Date.parse(i.date) > DAYS * 864e5) continue;
    seen.add(i.link).add(k);
    // Translation, article URL and picture from an earlier run carry over.
    const prev = old.find((o) => o.link === i.link) || {};
    out.push({ ...i, th: i.th ?? prev.th, url: i.url ?? prev.url, img: i.img ?? prev.img });
  }
  return out.slice(0, KEEP);
}

// ---------- pictures: each article's own cover image (og:image) ----------
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; pocket-th-news/1.0; +https://pokedex-th.slammer.work)' };
const get = (url, init = {}) => fetch(url, { ...init, headers: { ...UA, ...init.headers }, signal: AbortSignal.timeout(10000) });

// Google News links are redirects behind a script; resolve them the way the open-source googlenewsdecoder does.
export async function resolveGoogle(link) {
  const id = new URL(link).pathname.split('/').pop();
  const page = await (await get(`https://news.google.com/rss/articles/${id}`)).text();
  const sig = page.match(/data-n-a-sg="([^"]+)"/)?.[1], ts = page.match(/data-n-a-ts="([^"]+)"/)?.[1];
  if (!sig || !ts) return null;
  const req = [[['Fbv4je', JSON.stringify(['garturlreq', [['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1], 'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0], id, +ts, sig]), null, 'generic']]];
  const res = await get('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: `f.req=${encodeURIComponent(JSON.stringify(req))}`,
  });
  const url = JSON.parse(JSON.parse((await res.text()).split('\n\n')[1])[0][2])[1];
  return /^https:\/\//.test(url) ? url : null;
}
// og:image / twitter:image from an article's HTML, made absolute.
export function ogImage(html, base) {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/(property|name)=["'](og:image(:secure_url)?|twitter:image(:src)?)["']/i.test(tag)) continue;
    const v = tag.match(/content=["']([^"']+)["']/i)?.[1];
    if (!v) continue;
    try {
      const u = new URL(decode(v), base);
      if (u.protocol === 'https:') return u.href;
    } catch {}
  }
  return null;
}
// Items never tried get `img` (or '' when the article has none) and `url` (the article itself), at most `max` per run.
async function addPictures(items, max = 30) {
  const todo = items.filter((i) => i.img === undefined).slice(0, max);
  let found = 0;
  await Promise.all([0, 1, 2, 3].map(async (w) => {
    for (let k = w; k < todo.length; k += 4) {
      const i = todo[k];
      try {
        i.url ??= /news\.google\.com/.test(i.link) ? await resolveGoogle(i.link) : i.link;
        if (i.url) {
          const res = await get(i.url);
          i.img = (res.ok && ogImage(await res.text(), res.url)) || '';
        } else i.img = '';
      } catch (e) {
        i.img = '';
        console.warn(`no picture for ${i.link}: ${e.message}`);
      }
      if (i.img) found++;
    }
  }));
  console.log(`pictures: ${found}/${todo.length} found`);
}

const isThai = (s) => /[฀-๿]/.test(s);
async function translateTitles(items) {
  const todo = items.filter((i) => !i.th && !isThai(i.title)).slice(0, 40);
  const ask = llm();
  if (!todo.length || !ask) return;
  const { th } = await ask({
    system: 'Translate Pokémon TCG Pocket news headlines to natural, short Thai. Keep Pokémon names, card names, set names and game names in English. Return one translation per input, in the same order.',
    user: JSON.stringify(todo.map((i) => i.title)),
    schema: { type: 'object', properties: { th: { type: 'array', items: { type: 'string' } } }, required: ['th'], additionalProperties: false },
    maxTokens: 8000,
  });
  if (Array.isArray(th) && th.length === todo.length) todo.forEach((i, n) => (i.th = String(th[n]).trim() || undefined));
  else console.warn('Title translation skipped: wrong number of results');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
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
  await addPictures(items);
  try { await translateTitles(items); } catch (e) { console.warn(`Title translation failed: ${e.message}`); }
  writeFileSync('data/news.json', JSON.stringify({ items }, (k, v) => (v === undefined ? undefined : v), 1));
  console.log(`${items.length} items`);
}
