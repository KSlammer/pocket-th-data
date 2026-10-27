// Temporary: TCG Thailand Pokémon listings structure. Run on GitHub Actions.
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; pocket-th-prices/0.1; +https://pokedex-th.slammer.work)' };
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
async function get(url) { const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(25000) }); return [r, await r.text()]; }
const [, sm] = await get('https://www.tcgthailand.com/__sitemap__/products-0.xml');
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const pk = locs.filter((u) => /pokemon/i.test(u));
console.log(`sitemap products-0: ${locs.length} urls, pokemon-ish ${pk.length}\n${pk.slice(0, 12).join('\n')}\nother sample: ${locs.slice(0, 5).join(' ')}`);
const [, page] = await get('https://www.tcgthailand.com/product?search=pokemon');
const hrefs = [...new Set([...page.matchAll(/href="([^"]*(?:pokemon|category|game)[^"]*)"/gi)].map((m) => m[1]))].slice(0, 30);
console.log(`\npokemon-related hrefs: ${hrefs.join(' ')}`);
const nuxt = page.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
console.log(`__NUXT_DATA__: ${nuxt ? nuxt.length + 'B ' + nuxt.slice(0, 600) : 'none'}`);
const t = strip(page);
const i = t.search(/Pok[eé]mon TCG/);
console.log(`\ntext around pokemon: ${t.slice(Math.max(0, i - 200), i + 1500)}`);
for (const u of pk.slice(0, 2)) {
  const [r, h] = await get(u);
  const ld = [...h.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1].slice(0, 600));
  console.log(`\n--- ${r.status} ${u}\nld+json: ${ld.join('\n')}\ntext: ${strip(h).slice(0, 700)}`);
}
