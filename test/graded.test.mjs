import assert from 'node:assert/strict';
import { gradeOf, sameCard, summarize, baseName } from '../scripts/graded.mjs';

assert.equal(gradeOf('Charizard 4/102 Base Set Holo PSA 10 GEM MINT'), 'PSA 10');
assert.equal(gradeOf('2023 Pokemon Umbreon ex 161/091 BGS 9.5 Gem Mint'), 'BGS 9.5');
assert.equal(gradeOf('Pikachu CGC Pristine 10 Japanese'), 'CGC 10');
assert.equal(gradeOf('Mew ex TAG 10 Gem Mint 232/091'), 'TAG 10');
assert.equal(gradeOf('Blastoise SGC 9 Mint'), 'SGC 9');
assert.equal(gradeOf('Charizard PSA 9 not PSA 10'), null); // two grades: ambiguous
assert.equal(gradeOf('Charizard 4/102 raw near mint'), null);
assert.equal(gradeOf('Charizard PSA 100% authentic'), null);

assert.equal(baseName('Charizard - 4/102 (Shadowless)'), 'Charizard');
assert.ok(sameCard('Charizard 4/102 Base Set PSA 9', 'Charizard', '4/102'));
assert.ok(sameCard('CHARIZARD #004/102 PSA 9', 'Charizard', '4/102'));
assert.ok(!sameCard('Charizard 14/102 PSA 9', 'Charizard', '4/102'));
assert.ok(!sameCard('Blastoise 2/102 PSA 9', 'Charizard', '2/102'));
assert.ok(sameCard('Pikachu SWSH039 promo PSA 10', 'Pikachu', 'SWSH039'));

const it = (title, value, currency = 'USD') => ({ title, price: { value: String(value), currency } });
const s = summarize([
  it('Charizard 4/102 PSA 10', 100), it('Charizard 4/102 PSA 10', 300), it('Charizard 4/102 PSA 10', 200),
  it('Charizard 4/102 BGS 9.5', 150), it('Charizard 4/102 PSA 10 lot of 3', 50), it('Charizard 4/102 PSA 9', 80, 'GBP'),
  it('Blastoise 2/102 PSA 10', 90),
], 'Charizard', '4/102');
assert.deepEqual(s, { 'PSA 10': [200, 100, 3], 'BGS 9.5': [150, 150, 1] });
assert.deepEqual(Object.keys(summarize([it('Charizard 4/102 SGC 10', 1), it('Charizard 4/102 PSA 9', 1), it('Charizard 4/102 PSA 10', 1)], 'Charizard', '4/102')), ['PSA 10', 'PSA 9', 'SGC 10']);
console.log('graded: ok');
