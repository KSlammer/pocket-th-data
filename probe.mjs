import { writeFileSync, mkdirSync } from 'node:fs';
const get = (u) => fetch(u, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; pocket-th/1.0; +https://pokedex-th.slammer.work)' }, signal: AbortSignal.timeout(30000) }).then(async (r) => [r.status, await r.text()]).catch((e) => [0, e.message]);
mkdirSync('html', { recursive: true });
for (const [f, u] of [['snkr-terms.html', 'https://snkrdunk.com/terms'], ['snkr-robots.txt', 'https://snkrdunk.com/robots.txt'], ['snkr-en-terms.html', 'https://snkrdunk.com/en/terms']]) {
  const [s, t] = await get(u); console.log(u, s, t.length); writeFileSync(`html/${f}`, t);
}
