// Real-card prices: card vs sealed split, printings sorted by price, name matching, set codes.
import assert from 'node:assert/strict';
import { group, norm, code, releaseDate, revive, marketSet } from '../scripts/prices.mjs';

const products = [
  { productId: 1, name: 'Pikachu ex', extendedData: [{ name: 'Number', value: '057/191' }, { name: 'Rarity', value: 'Double Rare' }] },
  { productId: 2, name: 'Delta Reign Booster Box', extendedData: [] },
  { productId: 3, name: 'Delta Reign Code Card', extendedData: [] }, // skipped
  { productId: 4, name: 'Pikachu', extendedData: [{ name: 'Number', value: '001' }] },
  // Old Japanese sets: single cards without a Number are still cards; a box with only a Description is sealed.
  { productId: 5, name: 'Shining Gyarados', extendedData: [{ name: 'Rarity', value: 'Holo Rare' }, { name: 'CardType', value: 'Water' }] },
  { productId: 6, name: 'Storm Emeralda Booster Pack', extendedData: [{ name: 'Description', value: '5 cards' }] },
];
const prices = [
  { productId: 1, subTypeName: 'Normal', marketPrice: 2.5, lowPrice: 2 },
  { productId: 1, subTypeName: 'Holofoil', marketPrice: 9, lowPrice: 8 },
  { productId: 2, subTypeName: 'Normal', marketPrice: 235.91, lowPrice: 230 },
  { productId: 4, subTypeName: 'Normal', marketPrice: null, midPrice: null },
  { productId: 5, subTypeName: 'Holofoil', marketPrice: 40, lowPrice: 35 },
  { productId: 6, subTypeName: 'Normal', marketPrice: 3, lowPrice: 2 },
];
const { cards, sealed } = group(products, prices);
assert.deepEqual(cards[0], [5, 'Shining Gyarados', '', 'Holo Rare', [['Holofoil', 40, 35]]]);
assert.deepEqual(cards[1], [1, 'Pikachu ex', '057/191', 'Double Rare', [['Holofoil', 9, 8], ['Normal', 2.5, 2]]]);
assert.deepEqual(cards[2], [4, 'Pikachu', '001', '', []]); // no price yet, still listed, sorted last
assert.deepEqual(sealed, [[2, 'Delta Reign Booster Box', [['Normal', 235.91, 230]]], [6, 'Storm Emeralda Booster Pack', [['Normal', 3, 2]]]]);

assert.equal(norm('Pokémon TCG: Delta Reign — Booster Box'), norm('Delta Reign Booster Box'));
assert.equal(code('SV07: Stellar Crown'), 'SV7');
assert.equal(code('M1L: Mega Brave'), 'M1L');
assert.equal(code('ME02: Phantasmal Flames'), 'ME2');
assert.equal(releaseDate({ publishedOn: '2026-11-06T00:00:00' }), '2026-11-06');
assert.equal(releaseDate({ publishedOn: '2026-10-26T20:00:06.0248517Z' }), ''); // bulk republish, not a release date
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
// Cards whose names mention boxes/boosters are not sealed products.
const sealedOf = (name, alt = '') => marketSet([{ id: 'x', name, alternative_name: alt, min_price: '1' }]).items[0][7];
assert.equal(sealedOf('[ซอง] การ์ดโปรโม อัคคีสีคราม'), 1);
assert.equal(sealedOf('Destined Rivals', 'Destined Rivals Booster Box'), 1);
assert.equal(sealedOf('กล่องตกใจ', 'Surprise Box'), 0);
assert.equal(sealedOf('บูสต์เอนเนอร์จี้ อนาคต', 'Future Booster Energy Capsule'), 0);
console.log('prices ok');
