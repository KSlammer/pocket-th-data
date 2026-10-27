// Physical Pokémon TCG market prices, latest era (Scarlet & Violet / Mega Evolution), for the site's "real card prices" tab.
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
// Latest era only, by set code at the start of the group name ("SV07: Stellar Crown", "ME02: …", "M1L: Mega Brave").
export const LATEST = { en: /^(SV|ME)\d|^SV: |^ME: |^SVE\b|^MEE\b/i, jp: /^(SV|M)\d|^SV-?P\b|^M-?P\b/i };
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
// TCG Thailand listings → sets keyed by set code, each item [id, name, englishName, number, rarity, lowestAskTHB, inStock, sealed].
export function thaiMarket(products, setNames = {}) {
  const sets = new Map();
  for (const p of products) {
    const price = +p.min_price;
    if (!(price > 0)) continue;
    const code = (p.set_code || '').trim() || 'อื่นๆ';
    const s = sets.get(code) || sets.set(code, { code, name: setNames[code] || '', date: '', items: [] }).get(code);
    const sealed = /^\[(กล่อง|ซอง|box|pack|bundle|deck|ชุด)/i.test(p.name) || /booster|box|bundle|elite trainer/i.test(p.alternative_name || '');
    s.items.push([p.id, p.name, p.alternative_name || '', p.product_code || '', p.rarity && p.rarity !== '-' ? p.rarity : '', price, p.stock_quantity || 0, sealed ? 1 : 0]);
    if ((p.sell_date || '') > s.date) s.date = p.sell_date.slice(0, 10);
  }
  for (const s of sets.values()) s.items.sort((a, b) => b[7] - a[7] || b[5] - a[5]);
  return [...sets.values()].sort((a, b) => b.date.localeCompare(a.date) || a.code.localeCompare(b.code));
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
  for (const [lang, cat] of [['en', 3], ['jp', 85]]) {
    const groups = (await json(`${TCGCSV}/${cat}/groups`)).results.filter((g) => LATEST[lang].test(g.name));
    console.log(`${lang}: ${groups.length} groups: ${groups.map((g) => g.name).join(' | ')}`);
    let matched = 0, sealedN = 0;
    for (const g of groups) {
      const [products, prices] = await Promise.all([json(`${TCGCSV}/${cat}/${g.groupId}/products`), json(`${TCGCSV}/${cat}/${g.groupId}/prices`)]);
      const { cards, sealed } = group(products.results, prices.results);
      if (lang === 'en') for (const s of sealed) { const m = cm.get(norm(s[1])); sealedN++; if (m) { s.push(m); matched++; } }
      writeFileSync(`${out}/${lang}/${g.groupId}.json`, JSON.stringify({ name: g.name, cards, sealed }));
      index.sets[lang].push({ id: g.groupId, name: g.name, code: code(g.name), date: (g.publishedOn || '').slice(0, 10), cards: cards.length, sealed: sealed.length });
      await new Promise((r) => setTimeout(r, 300)); // be gentle with tcgcsv
    }
    if (lang === 'en') console.log(`Cardmarket sealed matches: ${matched}/${sealedN}`);
    index.sets[lang].sort((a, b) => b.date.localeCompare(a.date) || b.name.localeCompare(a.name));
  }

  // Thai sets (names in Thai) from TCGdex, paired with a Japanese group by set code when possible.
  try {
    const jp = new Map(index.sets.jp.map((s) => [s.code, s.id]));
    for (const s of await json('https://api.tcgdex.net/v2/th/sets')) {
      if (!/^(SV|M)/i.test(s.id)) continue;
      const c = s.id.toUpperCase();
      index.th.push({ id: s.id, name: s.name, total: s.cardCount?.total, jp: jp.get(c) ?? jp.get(c.replace(/[SKDTA]$/, '')) ?? null });
    }
    console.log(`th: ${index.th.length} sets, ${index.th.filter((t) => t.jp).length} paired with a Japanese set`);
  } catch (e) { console.warn(`Thai sets skipped: ${e.message}`); }

  // Thai market (TCG Thailand): every page of each Pokémon category, gently.
  index.market = {};
  try {
    const page = async (q) => nuxt(await (await fetch(`${TCGTH}/product?${q}`, { headers: UA, signal: AbortSignal.timeout(30000) })).text());
    const cats = Object.values((await page('page=1')).data).flatMap((v) => (Array.isArray(v?.data) ? v.data : [])).filter((c) => c?.id && c?.name);
    for (const [lang, re] of Object.entries(TCGTH_CATS)) {
      const cat = cats.find((c) => re.test(c.name));
      if (!cat) { console.warn(`TCG Thailand: no category for ${lang}`); continue; }
      if (lang === 'th') console.log(`TCG Thailand set fields: ${Object.keys(cat.sets?.[0] || {})}`);
      const setNames = Object.fromEntries((cat.sets || []).filter((x) => x.code).map((x) => [x.code, x.name]));
      const products = [];
      for (let n = 1; n <= 400; n++) {
        const d = (await page(`category_ids=${cat.id}&page=${n}`))?.data?.['product-listing'];
        if (!d?.products?.length) break;
        products.push(...d.products);
        if (products.length >= d.total) break;
        await new Promise((r) => setTimeout(r, 1500));
      }
      const sets = thaiMarket(products, setNames);
      mkdirSync(`${out}/market/${lang}`, { recursive: true });
      index.market[lang] = sets.map((s, i) => {
        writeFileSync(`${out}/market/${lang}/${i}.json`, JSON.stringify(s.items));
        return { file: i, code: s.code, name: s.name, date: s.date, items: s.items.length };
      });
      console.log(`TCG Thailand ${lang} (${cat.name}): ${products.length} listings → ${sets.length} sets with prices`);
    }
  } catch (e) { console.warn(`TCG Thailand skipped: ${e.message}`); }

  writeFileSync(`${out}/index.json`, JSON.stringify(index));
  console.log(`done: en ${index.sets.en.length}, jp ${index.sets.jp.length}, th ${index.th.length}`);
}
