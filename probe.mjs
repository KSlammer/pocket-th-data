const get = (u) => fetch(u, { headers: { 'user-agent': 'pocket-th/1.0 (+https://pokedex-th.slammer.work)' } }).then((r) => r.text());
const list = await get('https://pocket.limitlesstcg.com/cards/C1');
const i = list.indexOf('/cards/C1/1"');
console.log('LIST', list.slice(Math.max(0, i - 600), i + 900));
console.log('SETINFO', (list.match(/<div class="set-info[\s\S]{0,1500}/) || [''])[0]);
for (const n of [1, 60, 150, 200, 217]) {
  const h = await get(`https://pocket.limitlesstcg.com/cards/C1/${n}`);
  const a = h.indexOf('<div class="card-page-main'), b = h.indexOf('<div class="card-prints');
  console.log(`\n==== C1/${n}\n`, h.slice(a, b > a ? Math.min(b, a + 5000) : a + 5000));
  await new Promise((r) => setTimeout(r, 1000));
}
