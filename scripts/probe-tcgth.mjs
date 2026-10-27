// Temporary: what TCG Thailand (tcgthailand.com) allows and exposes. Run on GitHub Actions.
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; pocket-th-prices/0.1; +https://pokedex-th.slammer.work)' };
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
async function get(url) { const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) }); return [r, await r.text()]; }
async function show(label, url, fn = (t) => t.slice(0, 1500)) {
  try { const [r, t] = await get(url); console.log(`\n=== ${label} ${r.status} ${r.headers.get('content-type')} ${t.length}B ${r.url}\n${fn(t)}`); }
  catch (e) { console.log(`\n=== ${label} ERROR ${e.message}`); }
}
const links = (t) => [...new Set([...t.matchAll(/href="([^"]+)"/g)].map((m) => m[1]))];
await show('robots', 'https://www.tcgthailand.com/robots.txt');
await show('llms', 'https://www.tcgthailand.com/llms.txt');
await show('home', 'https://www.tcgthailand.com/en', (t) => {
  const l = links(t);
  const next = t.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  return `terms/policy links: ${l.filter((x) => /term|policy|condition|legal|privacy|เงื่อนไข|นโยบาย/i.test(x)).join(' ')}\napi-ish: ${[...new Set([...t.matchAll(/https?:\/\/[a-z0-9.-]+\/(?:api|graphql|v\d)[^"' )]{0,60}/gi)].map((m) => m[0]))].slice(0, 10).join(' ')}\npokemon links: ${l.filter((x) => /pokemon|price|card/i.test(x)).slice(0, 20).join(' ')}\n__NEXT_DATA__: ${next ? next.slice(0, 800) : 'none'}\ntext: ${strip(t).slice(0, 600)}`;
});
for (const path of ['/en/terms', '/terms', '/th/terms', '/en/terms-of-service', '/terms-of-service', '/en/terms-and-conditions', '/privacy', '/en/privacy-policy']) {
  await show(`terms? ${path}`, `https://www.tcgthailand.com${path}`, (h) => {
    const t = strip(h);
    const hits = [...t.matchAll(/.{0,250}(scrap|crawl|robot|bot\b|automat|data mining|spider|copy|reproduc|commercial|ดึงข้อมูล|คัดลอก|ทำซ้ำ|อัตโนมัติ|บอท|ทรัพย์สินทางปัญญา|เชิงพาณิชย์).{0,250}/gi)].map((m) => '• ' + m[0].trim());
    return `${t.length} chars | ${t.slice(0, 160)}\n${[...new Set(hits)].slice(0, 12).join('\n')}`;
  });
}
await show('sitemap', 'https://www.tcgthailand.com/sitemap.xml', (t) => t.slice(0, 1000));
