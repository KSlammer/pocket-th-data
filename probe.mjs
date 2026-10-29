import { writeFileSync, mkdirSync } from 'node:fs';
const get = (u) => fetch(u, { headers: { 'user-agent': 'pocket-th/1.0 (+https://pokedex-th.slammer.work)' } }).then((r) => r.text());
mkdirSync('html', { recursive: true });
writeFileSync('html/list.html', await get('https://pocket.limitlesstcg.com/cards/C1'));
for (const n of [1, 2, 30, 60, 100, 150, 170, 190, 200, 210, 217]) {
  writeFileSync(`html/${n}.html`, await get(`https://pocket.limitlesstcg.com/cards/C1/${n}`));
  await new Promise((r) => setTimeout(r, 1500));
}
writeFileSync('html/b4b-28.html', await get('https://pocket.limitlesstcg.com/cards/B4b/28'));
writeFileSync('html/b4b-212.html', await get('https://pocket.limitlesstcg.com/cards/B4b/212'));
