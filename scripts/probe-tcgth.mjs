// Temporary: TCG Thailand robots, terms and whether Pokémon is listed. Run on GitHub Actions.
const UA = { 'user-agent': 'Mozilla/5.0 (compatible; pocket-th-prices/0.1; +https://pokedex-th.slammer.work)' };
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
async function show(label, url, fn = (t) => t.slice(0, 1200)) {
  try { const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) }); const t = await r.text(); console.log(`\n=== ${label} ${r.status} ${t.length}B\n${fn(t)}`); }
  catch (e) { console.log(`\n=== ${label} ERROR ${e.message}`); }
}
await show('robots', 'https://www.tcgthailand.com/robots.txt', (t) => t.slice(0, 2500));
for (const l of ['en', 'th']) {
  await show(`terms ${l}`, `https://www.tcgthailand.com/${l}/term-condition`, (h) => {
    const t = strip(h);
    const hits = [...t.matchAll(/.{0,300}(scrap|crawl|robot|\bbots?\b|automat|data mining|spider|harvest|copy|reproduc|commercial|intellectual|ดึงข้อมูล|คัดลอก|ทำซ้ำ|อัตโนมัติ|บอท|ทรัพย์สินทางปัญญา|เชิงพาณิชย์|ลิขสิทธิ์).{0,300}/gi)].map((m) => '• ' + m[0].trim());
    return `${t.length} chars\n${[...new Set(hits)].slice(0, 14).join('\n')}`;
  });
}
await show('pokemon on home?', 'https://www.tcgthailand.com/th', (h) => {
  const t = strip(h);
  const games = [...new Set([...t.matchAll(/([A-Za-z][A-Za-z' ]{2,40}) Latest Sets|([^\s]{2,30}) ชุดล่าสุด/g)].map((m) => m[1] || m[2]))];
  return `games: ${games.join(' | ')}\npokemon mentions: ${(t.match(/pok[eé]mon|โปเกม่อน|โปเกมอน/gi) || []).length}\n${(t.match(/.{0,120}(pok[eé]mon|โปเกม่อน|โปเกมอน).{0,200}/i) || [''])[0]}`;
});
await show('product search pokemon', 'https://www.tcgthailand.com/product?search=pokemon', (h) => {
  const t = strip(h);
  return `${(t.match(/pok[eé]mon|โปเกม่อน|โปเกมอน/gi) || []).length} mentions; ${t.slice(0, 700)}`;
});
