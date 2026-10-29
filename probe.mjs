const get = (u) => fetch(u, { headers: { 'user-agent': 'pocket-th/1.0 (+https://pokedex-th.slammer.work)' }, signal: AbortSignal.timeout(30000) }).then(async (r) => [r.status, await r.text()]).catch((e) => [0, e.message]);
for (const u of ['https://pocket.limitlesstcg.com/robots.txt', 'https://limitlesstcg.com/robots.txt', 'https://play.limitlesstcg.com/robots.txt']) { const [s, t] = await get(u); console.log('==', u, s); console.log(t.slice(0, 800)); }
const [, home] = await get('https://pocket.limitlesstcg.com/');
console.log('links', [...new Set([...home.matchAll(/href="([^"]*(terms|privacy|legal|about|api|tos)[^"]*)"/gi)].map((m) => m[1]))].join(' '));
for (const u of ['https://limitlesstcg.com/terms', 'https://limitlesstcg.com/legal', 'https://pocket.limitlesstcg.com/terms', 'https://play.limitlesstcg.com/terms', 'https://limitlesstcg.com/about']) {
  const [s, t] = await get(u); const txt = t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  console.log('==', u, s, (txt.match(/.{0,300}(scrap|automat|crawl|robot|copy|reproduc|commercial|data)[^.]{0,300}/gi) || []).slice(0, 6).join(' || ').slice(0, 2000));
}
const [s, t] = await get('https://pocket.limitlesstcg.com/cards/C1');
console.log('C1 page', s, (t.match(/(\d+) cards/) || [''])[0], [...t.matchAll(/\/cards\/C1\/(\d+)/g)].length);
