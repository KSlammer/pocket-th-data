// Physical Pokémon TCG market prices, every set, for the site's "real card prices" tab.
//   English  – TCGplayer (USD) via tcgcsv.com category 3, plus Cardmarket's public price guide (EUR) for sealed products
//   Japanese – TCGplayer "Pokemon Japan" (USD) via tcgcsv.com category 85
//   Thai market – TCG Thailand (tcgthailand.com) listings: lowest asking price in THB per product, for its Thai,
//              Japanese and English Pokémon categories. Its terms don't restrict automated access and robots.txt allows
//              these pages; we read the public category pages once a day, one page every 1.5 s. (SASOM's terms forbid
//              automated collection, so SASOM is only linked.) Thai sets from TCGdex keep a Japanese reference price.
// Output goes to out/prices/ and is force-pushed to the `prices` branch (one commit, no history: prices change daily).
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const TCGCSV = 'https://tcgcsv.com/tcgplayer';
const CM = 'https://downloads.s3.cardmarket.com/productCatalog';
const UA = { 'user-agent': 'pocket-th-prices/1.0 (+https://pokedex-th.slammer.work)' };
// tcgcsv's publishedOn is the release date ("2026-11-06T00:00:00") for most groups, but a bulk-republish timestamp
// ("2026-10-26T20:00:06.0248517Z") for many old ones; only the former is a usable date.
export const releaseDate = (g) => (/T00:00:00$/.test(g.publishedOn || '') ? g.publishedOn.slice(0, 10) : '');
const TCGTH = 'https://www.tcgthailand.com';
const TCGTH_CATS = { th: /โปเกมอน/, jp: /Pok[eé]mon TCG \(Japanese\)/, en: /Pok[eé]mon TCG \(English\)/ };
const SKIP = /code card|jumbo|oversized|deck box|sleeve|playmat|binder|portfolio/i;

const ext = (p, key) => p.extendedData?.find((e) => e.name === key)?.value;
// A product with a card number is a single card; everything else in a set group is sealed (pack, box, ETB, bundle…).
export const isCard = (p) => !!ext(p, 'Number');
// Normalised names for matching TCGplayer and Cardmarket sealed products ("Delta Reign Booster Box" on both).
export const norm = (s) => s.toLowerCase().replace(/pok[eé]mon|tcg|[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();

// TCGplayer rows → compact lists. Prices per printing ("Normal", "Holofoil", "Reverse Holofoil"…), highest market first.
export function group(products, prices) {
  const by = new Map();
  for (const r of prices) {
    if (r.marketPrice == null && r.midPrice == null) continue;
    (by.get(r.productId) || by.set(r.productId, []).get(r.productId)).push([r.subTypeName, r.marketPrice ?? r.midPrice, r.lowPrice]);
  }
  const cards = [], sealed = [];
  for (const p of products) {
    const pr = (by.get(p.productId) || []).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
    if (isCard(p)) cards.push([p.productId, p.name, ext(p, 'Number'), ext(p, 'Rarity') || '', pr]);
    else if (!SKIP.test(p.name)) sealed.push([p.productId, p.name, pr]);
  }
  cards.sort((a, b) => (b[4][0]?.[1] ?? 0) - (a[4][0]?.[1] ?? 0));
  sealed.sort((a, b) => (b[2][0]?.[1] ?? 0) - (a[2][0]?.[1] ?? 0));
  return { cards, sealed };
}

// "SV07: Stellar Crown" → "SV07"; used to pair Thai sets (TCGdex ids like "SV7a") with Japanese groups.
export const code = (name) => (name.match(/^([A-Z]+-?[A-Z]?\d*[a-zA-Z]?)\s*:/)?.[1] || '').toUpperCase().replace(/^([A-Z]+)0+(\d)/, '$1$2');

// Nuxt page payload (devalue format): a flat array where objects/arrays hold indexes into it, with
// ["Reactive", i]-style wrappers. Returns the root value.
export function revive(a) {
  const memo = new Map();
  const r = (i) => {
    if (typeof i !== 'number' || i < 0) return i;
    if (memo.has(i)) return memo.get(i);
    const v = a[i];
    if (Array.isArray(v)) {
      if (typeof v[0] === 'string' && /^(Shallow)?(Reactive|Ref)$|^EmptyRef$|^Date$|^Set$|^Map$|^NuxtError$/.test(v[0])) {
        const x = v[0] === 'Date' ? v[1] : r(v[1]);
        memo.set(i, x);
        return x;
      }
      const out = [];
      memo.set(i, out);
      for (const j of v) out.push(r(j));
      return out;
    }
    if (v && typeof v === 'object') {
      const out = {};
      memo.set(i, out);
      for (const [k, j] of Object.entries(v)) out[k] = r(j);
      return out;
    }
    memo.set(i, v);
    return v;
  };
  return r(0);
}
export const nuxt = (html) => {
  const raw = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  return raw ? revive(JSON.parse(raw)) : null;
};
// One TCG Thailand set's listings → { date, items } with items [id, name, englishName, number, rarity, lowestAskTHB,
// inStock, sealed, image], sealed first then by price; listings without a price are dropped.
export function marketSet(products) {
  let date = '';
  const items = [];
  for (const p of products) {
    const price = +p.min_price;
    if (!(price > 0)) continue;
    const sealed = /^\[(กล่อง|ซอง|box|pack|bundle|deck|ชุด)/i.test(p.name) || /booster|box|bundle|elite trainer/i.test(p.alternative_name || '');
    const img = [p.image_urls].flat().find((u) => typeof u === 'string' && u.startsWith('https://')) || '';
    items.push([p.id, p.name, p.alternative_name || '', p.product_code || '', p.rarity && p.rarity !== '-' ? p.rarity : '', price, p.stock_quantity || 0, sealed ? 1 : 0, img]);
    if ((p.sell_date || '') > date) date = p.sell_date.slice(0, 10);
  }
  items.sort((a, b) => b[7] - a[7] || b[5] - a[5]);
  return { date, items };
}

async function json(url) {
  for (let i = 0; i < 3; i++) {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60000) }).catch(() => null);
    if (res?.ok) return res.json();
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`failed ${url}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = 'out/prices';
  mkdirSync(`${out}/en`, { recursive: true });
  mkdirSync(`${out}/jp`, { recursive: true });
  const fx = (await json('https://api.frankfurter.app/latest?from=USD&to=THB,EUR,JPY')).rates;

  // Cardmarket sealed (EN names) → EUR trend, matched to TCGplayer sealed by normalised name.
  let cm = new Map();
  try {
    const [cat, guide] = await Promise.all([json(`${CM}/productList/products_nonsingles_6.json`), json(`${CM}/priceGuide/price_guide_6.json`)]);
    const price = new Map(guide.priceGuides.map((g) => [g.idProduct, g.trend ?? g.avg]));
    cm = new Map(cat.products.filter((p) => price.get(p.idProduct)).map((p) => [norm(p.name), [p.idProduct, price.get(p.idProduct)]]));
  } catch (e) { console.warn(`Cardmarket skipped: ${e.message}`); }

  const index = { updated: new Date().toISOString(), fx: { THB: fx.THB, EUR: fx.EUR, JPY: fx.JPY }, sets: { en: [], jp: [] }, th: [] };
  // Every sealed product per language in one file, for the "all packs/boxes" view: [groupId, set, id, name, prices, cardmarket?]
  const sealedAll = { en: [], jp: [] };
  mkdirSync(`${out}/sealed`, { recursive: true });
  for (const [lang, cat] of [['en', 3], ['jp', 85]]) {
    const groups = (await json(`${TCGCSV}/${cat}/groups`)).results;
    console.log(`${lang}: ${groups.length} groups`);
    let matched = 0, sealedN = 0;
    for (const g of groups) {
      const [products, prices] = await Promise.all([json(`${TCGCSV}/${cat}/${g.groupId}/products`), json(`${TCGCSV}/${cat}/${g.groupId}/prices`)]);
      const { cards, sealed } = group(products.results, prices.results);
      if (lang === 'en') for (const s of sealed) { const m = cm.get(norm(s[1])); sealedN++; if (m) { s.push(m); matched++; } }
      writeFileSync(`${out}/${lang}/${g.groupId}.json`, JSON.stringify({ name: g.name, cards, sealed }));
      index.sets[lang].push({ id: g.groupId, name: g.name, code: code(g.name), date: releaseDate(g), cards: cards.length, sealed: sealed.length });
      for (const x of sealed) if (x[2].length) sealedAll[lang].push([g.groupId, g.name, ...x]);
      await new Promise((r) => setTimeout(r, 300)); // be gentle with tcgcsv
    }
    if (lang === 'en') console.log(`Cardmarket sealed matches: ${matched}/${sealedN}`);
    // Dated sets newest first; undated (old) ones after, newest TCGplayer group first.
    index.sets[lang].sort((a, b) => (b.date || '0').localeCompare(a.date || '0') || b.id - a.id);
    const order = new Map(index.sets[lang].map((x, i) => [x.id, i]));
    sealedAll[lang].sort((a, b) => order.get(a[0]) - order.get(b[0]) || (b[4][0]?.[1] ?? 0) - (a[4][0]?.[1] ?? 0));
    writeFileSync(`${out}/sealed/${lang}.json`, JSON.stringify(sealedAll[lang]));
    console.log(`${lang}: ${sealedAll[lang].length} priced sealed products`);
  }

  // Thai sets (names in Thai) from TCGdex, paired with a Japanese group by set code when possible.
  try {
    const jp = new Map(index.sets.jp.map((s) => [s.code, s.id]));
    for (const s of await json('https://api.tcgdex.net/v2/th/sets')) {
      const c = s.id.toUpperCase();
      index.th.push({ id: s.id, name: s.name, total: s.cardCount?.total, jp: jp.get(c) ?? jp.get(c.replace(/[SKDTA]$/, '')) ?? null });
    }
    console.log(`th: ${index.th.length} sets, ${index.th.filter((t) => t.jp).length} paired with a Japanese set`);
  } catch (e) { console.warn(`Thai sets skipped: ${e.message}`); }

  // Thai market (TCG Thailand), set by set: a whole-category listing stops after a few pages, and pages sometimes
  // come back empty, so an empty page is retried up to twice more after a longer pause. One request every 1.5 s or slower.
  index.market = {};
  try {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const listing = async (q) => {
      for (let t = 0; t < 3; t++) {
        const res = await fetch(`${TCGTH}/product?${q}`, { headers: UA, signal: AbortSignal.timeout(30000) }).catch(() => null);
        const d = res?.ok ? nuxt(await res.text())?.data : null;
        await sleep(t ? 4000 : 1500);
        if (d?.['product-listing']?.total || t === 2) return d;
      }
    };
    const home = await listing('page=1');
    const cats = Object.values(home || {}).flatMap((v) => (Array.isArray(v?.data) ? v.data : [])).filter((c) => c?.id && c?.name);
    for (const [lang, re] of Object.entries(TCGTH_CATS)) {
      const cat = cats.find((c) => re.test(c.name));
      if (!cat) { console.warn(`TCG Thailand: no category for ${lang}`); continue; }
      mkdirSync(`${out}/market/${lang}`, { recursive: true });
      const sets = [];
      let listings = 0;
      for (const set of cat.sets || []) {
        const products = [];
        for (let n = 1; n <= 50; n++) {
          const l = (await listing(`category_ids=${cat.id}&set_ids=${set.id}&page=${n}`))?.['product-listing'];
          if (!l?.products?.length) break;
          products.push(...l.products);
          if (products.length >= l.total) break;
        }
        listings += products.length;
        const m = marketSet(products);
        if (m.items.length) sets.push({ name: set.name, ...m });
      }
      sets.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
      index.market[lang] = sets.map((s, i) => {
        writeFileSync(`${out}/market/${lang}/${i}.json`, JSON.stringify(s.items));
        return { file: i, name: s.name, date: s.date, items: s.items.length };
      });
      // All sealed listings of this language, newest set first: [set, ...item]
      writeFileSync(`${out}/sealed/market-${lang}.json`, JSON.stringify(sets.flatMap((x) => x.items.filter((i) => i[7]).map((i) => [x.name, ...i]))));
      console.log(`TCG Thailand ${lang} (${cat.name}): ${cat.sets?.length} sets, ${listings} listings → ${sets.length} sets with prices, ${sets.reduce((a, s) => a + s.items.length, 0)} priced items`);
    }
  } catch (e) { console.warn(`TCG Thailand skipped: ${e.message}`); }

  writeFileSync(`${out}/index.json`, JSON.stringify(index));
  console.log(`done: en ${index.sets.en.length}, jp ${index.sets.jp.length}, th ${index.th.length}`);
}
