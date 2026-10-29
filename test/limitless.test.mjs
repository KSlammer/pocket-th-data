// Limitless card page → package card format (structure as on pocket.limitlesstcg.com; text shortened).
import assert from 'node:assert/strict';
import { parseCard, limitlessCode } from '../scripts/limitless.mjs';

const page = (body, current) => `<section class="card-page-main"><div class="card-text">${body}</div></section>
  <div class="card-prints"><div class="card-prints-current"><div class="prints-current-details"><span>Dual Fusion (C1)</span><span>${current}</span></div></div></div>`;
const meta = { set: 'c1', setName: 'Dual Fusion', release: '2026-10-29', number: 2 };

const mon = parseCard(page(`
  <div class="card-text-section"><p class="card-text-title"><span class="card-text-name"><a>Ivysaur</a></span> - Grass - 100 HP </p>
    <p class="card-text-type"> Pokémon - Stage 1 - Evolves from <a>Bulbasaur</a> </p></div>
  <div class="card-text-section"><div class="card-text-attack"><p class="card-text-attack-info"><span class="ptcg-symbol">GCC</span> Leaf Drain 50+ </p>
    <p class="card-text-attack-effect"> Heal 20 damage from this Pokémon. </p></div></div>
  <div class="card-text-section"><p class="card-text-wrr"> Weakness: Fire <br> Retreat: 3 <br></p></div>
  <div class="card-text-section card-text-artist"> Illustrated by <a>Kagemaru Himeno</a></div>`, '#2 · ◊ · Pikachu pack'), meta);
assert.equal(mon.id, 'c1-002');
assert.deepEqual([mon.type, mon.subtype, mon.stage, mon.evolves_from, mon.health, mon.retreat, mon.weakness, mon.rarity, mon.pack, mon.points], ['Pokémon', 'Grass', 'Stage 1', 'Bulbasaur', 100, 3, 'Fire', '◊', 'Pikachu', 1]);
assert.deepEqual(mon.attacks[1], { cost: 'GCC', name: 'Leaf Drain', damage: 50, effect: 'Heal 20 damage from this Pokémon.' });
assert.equal(mon.attacks[2].name, null);
assert.equal(mon.artist, 'Kagemaru Himeno');
assert.equal(mon.deckBuilderNr, null);

const sup = parseCard(page(`
  <div class="card-text-section"><p class="card-text-title"><span class="card-text-name"><a>Rising Star</a></span></p><p class="card-text-type"> Trainer - Supporter </p></div>
  <div class="card-text-section"> You can use this card only if you have 3 or more different Pokémon types in play.<br><br>Switch your Active Pokémon. </div>`, '#170 · ☆☆ · Mega Mewtwo X pack'), { ...meta, number: 170 });
assert.deepEqual([sup.type, sup.subtype, sup.health, sup.points, sup.tradable], ['Trainer', 'Supporter', null, null, true]);
assert.equal(sup.card_text, 'You can use this card only if you have 3 or more different Pokémon types in play. Switch your Active Pokémon.');

const crown = parseCard(page(`<div class="card-text-section"><p class="card-text-title"><span class="card-text-name"><a>Mega Dragonite ex</a></span> - Dragon - 240 HP </p><p class="card-text-type"> Pokémon - Stage 2 </p></div>
  <div class="card-text-section"><p class="card-text-wrr"> Weakness: none <br> Retreat: 4 </p></div>`, '#217 · Crown Rare'), { ...meta, number: 217 });
assert.deepEqual([crown.ex, crown.mega, crown.points, crown.weakness, crown.pack, crown.tradable], [true, true, 3, 'none', 'Shared(Dual Fusion)', false]);
assert.equal(limitlessCode('b4b'), 'B4b');
console.log('limitless ok');
