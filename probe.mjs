import { nuxt } from './scripts/prices.mjs';
const UA = { 'user-agent': 'pocket-th-prices/1.0 (+https://pokedex-th.slammer.work)' };
const j = (u) => fetch(u, { headers: UA }).then((r) => r.json());
for (const g of [23720, 24791, 24499]) {
  const p = (await j(`https://tcgcsv.com/tcgplayer/85/${g}/products`)).results;
  const keys = {}; for (const x of p) for (const e of x.extendedData || []) keys[e.name] = (keys[e.name] || 0) + 1;
  console.log('JP', g, p.length, JSON.stringify(keys));
  console.log('  no-number:', p.filter((x) => !(x.extendedData || []).some((e) => e.name === 'Number')).slice(0, 12).map((x) => `${x.name} [${(x.extendedData || []).map((e) => e.name).join(',')}]`).join(' | '));
}
const T = 'https://www.tcgthailand.com';
const page = async (q) => { for (let t = 0; t < 4; t++) { const d = await fetch(`${T}/product?${q}`, { headers: UA, signal: AbortSignal.timeout(40000) }).then(async (r) => r.ok ? nuxt(await r.text())?.data : null).catch(() => null); if (d?.['product-listing']?.total) return d; await new Promise((r) => setTimeout(r, 5000)); } return null; };
const home = await page('page=1');
console.log('home keys', Object.keys(home || {}));
const cats = Object.values(home || {}).flatMap((v) => (Array.isArray(v?.data) ? v.data : [])).filter((c) => c?.id && c?.name);
for (const c of cats) console.log('CAT', c.id, c.name, 'sets', c.sets?.length, Object.keys(c).join(','));
const sample = home?.['product-listing']?.products?.[0];
console.log('product keys', sample && JSON.stringify(sample).slice(0, 1500));
const th = cats.find((c) => /โปเกมอน/.test(c.name));
for (const q of ['keyword=%E0%B8%81%E0%B8%A5%E0%B9%88%E0%B8%AD%E0%B8%87', 'keyword=box', 'keyword=%E0%B8%8B%E0%B8%AD%E0%B8%87']) {
  const d = await page(`category_ids=${th.id}&${q}&page=1`);
  const l = d?.['product-listing'];
  console.log('SEARCH', q, 'total', l?.total, (l?.products || []).slice(0, 15).map((p) => `${p.name} / ${p.alternative_name} / ${p.min_price} / type=${p.product_type ?? p.type ?? ''}`).join(' | '));
}
let zero = 0;
for (const s of th.sets) {
  const d = await page(`category_ids=${th.id}&set_ids=${s.id}&page=1`);
  const l = d?.['product-listing'];
  if (!l?.total) zero++;
  console.log('SET', s.name, 'total', l?.total ?? 'none', 'perPage', l?.products?.length, Object.keys(s).join(','));
  await new Promise((r) => setTimeout(r, 1500));
}
console.log('zero sets', zero);
