// Real-card prices: card vs sealed split, printings sorted by price, name matching, set codes.
import assert from 'node:assert/strict';
import { group, norm, code, LATEST } from '../scripts/prices.mjs';

const products = [
  { productId: 1, name: 'Pikachu ex', extendedData: [{ name: 'Number', value: '057/191' }, { name: 'Rarity', value: 'Double Rare' }] },
  { productId: 2, name: 'Delta Reign Booster Box', extendedData: [] },
  { productId: 3, name: 'Delta Reign Code Card', extendedData: [] }, // skipped
  { productId: 4, name: 'Pikachu', extendedData: [{ name: 'Number', value: '001' }] },
];
const prices = [
  { productId: 1, subTypeName: 'Normal', marketPrice: 2.5, lowPrice: 2 },
  { productId: 1, subTypeName: 'Holofoil', marketPrice: 9, lowPrice: 8 },
  { productId: 2, subTypeName: 'Normal', marketPrice: 235.91, lowPrice: 230 },
  { productId: 4, subTypeName: 'Normal', marketPrice: null, midPrice: null },
];
const { cards, sealed } = group(products, prices);
assert.deepEqual(cards[0], [1, 'Pikachu ex', '057/191', 'Double Rare', [['Holofoil', 9, 8], ['Normal', 2.5, 2]]]);
assert.deepEqual(cards[1], [4, 'Pikachu', '001', '', []]); // no price yet, still listed, sorted last
assert.deepEqual(sealed, [[2, 'Delta Reign Booster Box', [['Normal', 235.91, 230]]]]);

assert.equal(norm('Pokémon TCG: Delta Reign — Booster Box'), norm('Delta Reign Booster Box'));
assert.equal(code('SV07: Stellar Crown'), 'SV7');
assert.equal(code('M1L: Mega Brave'), 'M1L');
assert.equal(code('ME02: Phantasmal Flames'), 'ME2');
assert.ok(LATEST.en.test('SV: Prismatic Evolutions') && LATEST.en.test('ME06: Delta Reign') && !LATEST.en.test('POP Series 1'));
assert.ok(LATEST.jp.test('M1L: Mega Brave') && LATEST.jp.test('SV7a: Paradise Dragona') && !LATEST.jp.test('Gym Challenge'));
console.log('prices ok');
