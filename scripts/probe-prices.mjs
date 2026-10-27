// Temporary: look at what each price source returns (run on GitHub Actions; the dev sandbox can't reach these hosts).
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; pocket-th-prices/0.1; +https://pokedex-th.slammer.work)' };
async function show(label, url, fn = (t) => t.slice(0, 1500)) {
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) });
    const text = await res.text();
    console.log(`\n=== ${label} ${res.status} ${res.headers.get('content-type')} ${text.length}B\n${fn(text, res)}`);
  } catch (e) { console.log(`\n=== ${label} ERROR ${e.message}`); }
}
const j = (f) => (t) => { try { return f(JSON.parse(t)); } catch (e) { return 'not json: ' + t.slice(0, 300); } };
await show('tcgcsv categories', 'https://tcgcsv.com/tcgplayer/categories', j((d) => JSON.stringify(d.results.filter((c) => /pok/i.test(c.name)))));
await show('tcgcsv pokemon groups', 'https://tcgcsv.com/tcgplayer/3/groups', j((d) => `${d.results.length} groups; newest: ` + JSON.stringify(d.results.sort((a, b) => b.publishedOn.localeCompare(a.publishedOn)).slice(0, 8))));
await show('tcgcsv pokemon japan groups', 'https://tcgcsv.com/tcgplayer/85/groups', j((d) => `${d.results.length} groups; newest: ` + JSON.stringify(d.results.sort((a, b) => b.publishedOn.localeCompare(a.publishedOn)).slice(0, 8))));
// one group's products + prices (newest EN group)
const g = await fetch('https://tcgcsv.com/tcgplayer/3/groups', { headers: UA }).then((r) => r.json()).then((d) => d.results.sort((a, b) => b.publishedOn.localeCompare(a.publishedOn))[0]).catch(() => null);
if (g) {
  await show(`tcgcsv products ${g.name}`, `https://tcgcsv.com/tcgplayer/3/${g.groupId}/products`, j((d) => `${d.results.length} products; sample: ` + JSON.stringify(d.results.slice(0, 2)) + '\nsealed-ish: ' + JSON.stringify(d.results.filter((p) => /booster|box|pack|elite/i.test(p.name)).slice(0, 6).map((p) => [p.productId, p.name]))));
  await show(`tcgcsv prices ${g.name}`, `https://tcgcsv.com/tcgplayer/3/${g.groupId}/prices`, j((d) => `${d.results.length} prices; sample: ` + JSON.stringify(d.results.slice(0, 3))));
}
await show('cardmarket price guide', 'https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_6.json', j((d) => `version ${d.version} created ${d.createdAt} n=${d.priceGuides.length} sample ${JSON.stringify(d.priceGuides.slice(0, 2))}`));
await show('cardmarket singles catalog', 'https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_6.json', j((d) => `keys ${Object.keys(d)} n=${d.products?.length} sample ${JSON.stringify(d.products?.slice(0, 2))}`));
await show('cardmarket nonsingles catalog', 'https://downloads.s3.cardmarket.com/productCatalog/productList/products_nonsingles_6.json', j((d) => `keys ${Object.keys(d)} n=${d.products?.length} sample ${JSON.stringify(d.products?.slice(0, 3))}`));
await show('tcgdex th sets', 'https://api.tcgdex.net/v2/th/sets', j((d) => `${d.length} sets; last: ${JSON.stringify(d.slice(-6))}`));
await show('tcgdex ja sets', 'https://api.tcgdex.net/v2/ja/sets', j((d) => `${d.length} sets; last: ${JSON.stringify(d.slice(-4))}`));
await show('tcgdex en card pricing', 'https://api.tcgdex.net/v2/en/cards/sv03.5-001', j((d) => JSON.stringify({ name: d.name, pricing: d.pricing })));
await show('frankfurter', 'https://api.frankfurter.app/latest?from=USD&to=THB,EUR,JPY');
await show('sasom robots', 'https://sasom.co.th/robots.txt');
await show('sasom page', 'https://sasom.co.th/en/brand/trading-card-box-and-pack/pokemon/mega-brave', (t) => {
  const terms = [...t.matchAll(/href="([^"]*(?:term|policy|condition)[^"]*)"/gi)].map((m) => m[1]);
  const next = t.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  const apis = [...new Set([...t.matchAll(/https?:\/\/[a-z0-9.-]*sasom[a-z0-9.-]*\/[^"' )]{0,60}/gi)].map((m) => m[0]))].slice(0, 15);
  return `terms links: ${[...new Set(terms)].slice(0, 8)}\n__NEXT_DATA__: ${next ? next.slice(0, 1200) : 'none'}\napi-ish urls: ${apis.join(' ')}\nhead: ${t.slice(0, 400)}`;
});
