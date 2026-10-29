const get = (u) => fetch(u, { headers: { 'user-agent': 'pocket-th/1.0 (+https://pokedex-th.slammer.work)' }, signal: AbortSignal.timeout(30000) });
const s = await (await get('https://api.tcgdex.net/v2/en/series/tcgp')).json().catch(() => null);
console.log('tcgdex tcgp sets', s?.sets?.slice(-5).map((x) => `${x.id} ${x.name} ${x.cardCount?.total}/${x.cardCount?.official}`));
for (const id of ['C1', 'c1', 'C01']) {
  const r = await get(`https://api.tcgdex.net/v2/en/sets/${id}`);
  const j = r.ok ? await r.json() : null;
  console.log('tcgdex', id, r.status, j && `${j.name} ${j.releaseDate} cards=${j.cards?.length} ${j.cards?.slice(0, 5).map((c) => c.name).join(',')}`);
  if (j?.cards?.length) {
    const c = await (await get(`https://api.tcgdex.net/v2/en/cards/${j.cards[0].id}`)).json();
    console.log('sample card', JSON.stringify(c).slice(0, 1200));
    const th = await get(`https://api.tcgdex.net/v2/th/sets/${id}`); console.log('th', th.status);
    break;
  }
}
for (const u of ['https://pocket.limitlesstcg.com/cards/C1', 'https://pocket.limitlesstcg.com/cards']) {
  const r = await get(u); const t = r.ok ? await r.text() : '';
  console.log(u, r.status, (t.match(/Dual Fusion[^<]{0,80}/) || [''])[0], (t.match(/C1[^<]{0,40}/) || [''])[0]);
}
