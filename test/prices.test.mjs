// Real-card prices: card vs sealed split, printings sorted by price, name matching, set codes.
import assert from 'node:assert/strict';
import { group, norm, code, LATEST, revive, marketSet } from '../scripts/prices.mjs';

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
// Nuxt payload: indexes resolve, wrappers unwrap, shared refs stay shared.
const root = revive([['ShallowReactive', 1], { data: 2 }, { list: 3, n: 4 }, [5, 5], 7, 'x']);
assert.deepEqual(root, { data: { list: ['x', 'x'], n: 7 } });

// TCG Thailand listings of one set: sealed first then by price, unpriced dropped, newest listing date kept.
const m = marketSet([
  { id: 'a', name: 'พิคาชู ex', alternative_name: 'Pikachu ex', product_code: '036/130', rarity: 'RR', min_price: '100.00', stock_quantity: 3, sell_date: '2026-09-16T00:00:00+07:00', image_urls: ['https://img.test/a.webp'] },
  { id: 'b', name: '[กล่อง] 30th Celebration', rarity: '-', min_price: '2090.00', stock_quantity: 1, sell_date: '2026-09-10T00:00:00+07:00' },
  { id: 'c', name: 'มิวทู ex', min_price: '0.00' },
]);
assert.equal(m.date, '2026-09-16');
assert.deepEqual(m.items.map((i) => i[0]), ['b', 'a']);
assert.deepEqual(m.items[1], ['a', 'พิคาชู ex', 'Pikachu ex', '036/130', 'RR', 100, 3, 0, 'https://img.test/a.webp']);
console.log('prices ok');
