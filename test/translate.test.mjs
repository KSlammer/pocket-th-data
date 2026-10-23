// Runs translate() against a fake client: good answers are kept, a dropped {n} is retried, then reported.
import assert from 'node:assert/strict';
import { translate, valid, examples } from '../scripts/translate.mjs';
import { parseJSON } from '../scripts/llm.mjs';

assert.ok(valid('Heal {n} damage from [W].', 'ฟื้นฟู HP {n} จาก [W]'));
assert.ok(!valid('Heal {n} damage.', 'ฟื้นฟู HP'));
assert.ok(!valid('Discard a [R] Energy.', 'ทิ้งพลังงาน [W]'));

const answers = {
  'Big Flame': 'เปลวไฟใหญ่',
  'Do {n} more damage.': 'สร้างความเสียหายเพิ่ม {n}',
  'Flip {n} coins.': 'ทอยเหรียญ', // always drops {n} → must be rejected twice
};
let calls = 0;
const llm = async (req) => {
  calls++;
  assert.ok(req.system.includes('Glossary'));
  const keys = JSON.parse(req.user.split('\n').slice(1).join('\n'));
  return { items: keys.map((key) => ({ key, th: answers[key] })) };
};

const th = { names: {}, text: {} }, auto = { names: [], text: [] };
const left = await translate({ llm, th, auto, missing: { names: ['Big Flame'], text: ['Do {n} more damage.', 'Flip {n} coins.'] } });
assert.deepEqual(left, ['Flip {n} coins.']);
assert.equal(th.text['Do {n} more damage.'], 'สร้างความเสียหายเพิ่ม {n}');
assert.deepEqual(auto, { names: ['Big Flame'], text: ['Do {n} more damage.'] });
assert.equal(calls, 3); // names, text, text retry
// Examples: entries sharing words with the batch come first.
assert.deepEqual(examples({ 'Heal {n} damage.': 'a', 'Discard a card.': 'b', 'Heal all damage from this Pokémon.': 'c' }, ['Heal {n} damage from 1 of your Pokémon.'], 2).map((e) => e[1]), ['c', 'a']);
assert.deepEqual(parseJSON('Sure!\n```json\n{"items": []}\n```'), { items: [] });
console.log('translate ok');
