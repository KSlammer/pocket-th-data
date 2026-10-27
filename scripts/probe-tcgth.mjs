// Temporary: why pagination stops at 300 and JP/EN return nothing. Run on GitHub Actions.
import { nuxt } from './prices.mjs';
const UA = { 'user-agent': 'pocket-th-prices/1.0 (+https://pokedex-th.slammer.work)' };
const get = async (q) => {
  const r = await fetch(`https://www.tcgthailand.com/product?${q}`, { headers: UA, signal: AbortSignal.timeout(30000) });
  const d = nuxt(await r.text());
  const l = d?.data?.['product-listing'];
  return `${r.status} keys=${Object.keys(d?.data || {}).join(',')} total=${l?.total} page=${l?.page} n=${l?.products?.length} first=${l?.products?.[0]?.name}`;
};
const wait = () => new Promise((r) => setTimeout(r, 1500));
const th = '26ad5178-3814-4505-a3f8-2cd0add6193d', jp = '3e0af926-88e5-415d-82e6-e8ec183fb359', en = 'd00f490e-b032-4169-a215-c274bbd4617f';
for (const q of [`category_ids=${th}&page=5`, `category_ids=${th}&page=6`, `category_ids=${th}&page=50`, `category_ids=${th}&page=6&sort=newest`,
  `category_ids=${jp}`, `category_ids=${jp}&page=1`, `category_ids=${en}`, `category_ids=${jp}&type=products`,
  `category_ids=${th}&set_ids=01a0a605-21ca-7f90-98ee-8225ee0a4861`, `category_ids=${th}&set_ids=01a0a605-21ca-7f90-98ee-8225ee0a4861&page=2`,
  `category_ids=${jp}&set_ids=d88c6fde-8fb8-46d2-aae9-3ecc254af473`]) {
  console.log(`${q}\n  → ${await get(q).catch((e) => 'ERR ' + e.message)}`);
  await wait();
}
