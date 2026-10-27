// Temporary: SASOM terms, /api/md, sitemap (run on GitHub Actions; the dev sandbox can't reach these hosts).
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; pocket-th-prices/0.1; +https://pokedex-th.slammer.work)' };
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ');
async function get(url) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) });
  return [res, await res.text()];
}
async function show(label, url, fn = (t) => t.slice(0, 1500)) {
  try { const [res, t] = await get(url); console.log(`\n=== ${label} ${res.status} ${res.headers.get('content-type')} ${t.length}B\n${fn(t)}`); }
  catch (e) { console.log(`\n=== ${label} ERROR ${e.message}`); }
}
await show('terms (keyword hits)', 'https://help.sasom.co.th/en/articles/sasom-terms-conditions-5329840986009', (h) => {
  const t = strip(h);
  const hits = [...t.matchAll(/[^.]{0,300}(scrap|crawl|robot|automat|data mining|spider|harvest|reproduc|copy|intellectual|content of|commercial use)[^.]{0,300}\./gi)].map((m) => '• ' + m[0].trim());
  return `${t.length} chars\n${[...new Set(hits)].slice(0, 25).join('\n')}`;
});
await show('terms TH (keyword hits)', 'https://help.sasom.co.th/th/articles/sasom-terms-conditions-5329840986009', (h) => {
  const t = strip(h);
  const hits = [...t.matchAll(/[^ ]{0,0}.{0,200}(ดึงข้อมูล|คัดลอก|ทำซ้ำ|โปรแกรมอัตโนมัติ|บอท|ทรัพย์สินทางปัญญา|เชิงพาณิชย์).{0,200}/g)].map((m) => '• ' + m[0].trim());
  return `${t.length} chars\n${[...new Set(hits)].slice(0, 15).join('\n')}`;
});
await show('api/md root', 'https://sasom.co.th/api/md');
await show('api/md pokemon page', 'https://sasom.co.th/api/md/en/brand/trading-card-box-and-pack/pokemon/mega-brave');
await show('api/md pokemon page alt', 'https://sasom.co.th/api/md?path=/en/brand/trading-card-box-and-pack/pokemon/mega-brave');
await show('llms.txt', 'https://sasom.co.th/llms.txt');
await show('sitemap', 'https://sasom.co.th/sitemap.xml', (t) => t.slice(0, 1200));
await show('page md accept', 'https://sasom.co.th/en/brand/trading-card-box-and-pack/pokemon/mega-brave', (t) => {
  const ld = [...t.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1].slice(0, 700));
  const prices = [...t.matchAll(/(?:THB|฿)\s?[\d,]+/g)].slice(0, 10).map((m) => m[0]);
  const prod = [...new Set([...t.matchAll(/href="(\/en\/products\/[^"]+)"/g)].map((m) => m[1]))].slice(0, 6);
  return `ld+json blocks: ${ld.length}\n${ld.join('\n---\n')}\nprice strings: ${prices}\nproduct links: ${prod.join(' ')}`;
});
