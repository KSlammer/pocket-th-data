// Temporary: TCG Thailand Pokémon category listing structure (Nuxt payload). Run on GitHub Actions.
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; pocket-th-prices/0.1; +https://pokedex-th.slammer.work)' };
async function page(url) {
  const h = await (await fetch(url, { headers: UA, signal: AbortSignal.timeout(25000) })).text();
  const raw = h.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  return raw ? revive(JSON.parse(raw)) : null;
}
// Nuxt payload (devalue): a flat array; objects/arrays hold indexes into it; ["Reactive", i] style wrappers.
function revive(a) {
  const memo = new Map();
  const r = (i) => {
    if (typeof i !== 'number' || i < 0) return i;
    if (memo.has(i)) return memo.get(i);
    const v = a[i];
    if (Array.isArray(v)) {
      if (typeof v[0] === 'string' && /^(Shallow)?(Reactive|Ref)$|^EmptyRef$|^Date$|^Set$|^Map$|^NuxtError$/.test(v[0])) { const x = v[0] === 'Date' ? v[1] : r(v[1]); memo.set(i, x); return x; }
      const out = []; memo.set(i, out); for (const j of v) out.push(r(j)); return out;
    }
    if (v && typeof v === 'object') { const out = {}; memo.set(i, out); for (const [k, j] of Object.entries(v)) out[k] = r(j); return out; }
    memo.set(i, v); return v;
  };
  return r(0);
}
const shape = (o, d = 0) => (d > 3 || o == null || typeof o !== 'object') ? (typeof o === 'string' ? JSON.stringify(o.slice(0, 60)) : String(o))
  : Array.isArray(o) ? `[${o.length}× ${shape(o[0], d + 1)}]` : `{${Object.entries(o).slice(0, 25).map(([k, v]) => `${k}: ${shape(v, d + 1)}`).join(', ')}}`;

const home = await page('https://www.tcgthailand.com/product');
const cats = Object.values(home.data).flatMap((v) => (Array.isArray(v?.data) ? v.data : [])).filter((c) => c?.name && c?.id);
const pk = cats.filter((c) => /pok[eé]mon|โปเกมอน/i.test(c.name));
console.log(`categories: ${cats.map((c) => c.name).join(' | ')}`);
for (const c of pk) console.log(`POKEMON CAT ${c.id} ${c.name} sets(${c.sets?.length}): ${(c.sets || []).slice(0, 8).map((s) => `${s.id}=${s.name}`).join(' ; ')}`);
const cat = pk.find((c) => /โปเกมอน/.test(c.name)) || pk[0];
const listing = await page(`https://www.tcgthailand.com/product?category_ids=${cat.id}`);
console.log(`\nlisting data keys: ${Object.keys(listing.data)}\nstate keys: ${Object.keys(listing.state || {})}`);
for (const [k, v] of Object.entries(listing.data)) console.log(`\n[${k}] ${shape(v)}`);
const p2 = await page(`https://www.tcgthailand.com/product?category_ids=${cat.id}&page=2`);
for (const [k, v] of Object.entries(p2.data)) if (/list|product/i.test(k)) console.log(`\npage=2 [${k}] first: ${JSON.stringify(v?.data?.[0] ?? v?.data?.data?.[0] ?? v).slice(0, 700)}`);
