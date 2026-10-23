// Runs translate() against a fake client: good answers are kept, a dropped {n} is retried, then reported.
import assert from 'node:assert/strict';
import { translate, valid } from '../scripts/translate.mjs';

assert.ok(valid('Heal {n} damage from [W].', 'ฟื้นฟู HP {n} จาก [W]'));
assert.ok(!valid('Heal {n} damage.', 'ฟื้นฟู HP'));
assert.ok(!valid('Discard a [R] Energy.', 'ทิ้งพลังงาน [W]'));

const answers = {
  'Big Flame': 'เปลวไฟใหญ่',
  'Do {n} more damage.': 'สร้างความเสียหายเพิ่ม {n}',
  'Flip {n} coins.': 'ทอยเหรียญ', // always drops {n} → must be rejected twice
};
let calls = 0;
const client = { beta: { messages: { create: async (req) => {
  calls++;
  assert.equal(req.model, 'claude-opus-5-5');
  assert.equal(req.fallbacks, 'default');
  const keys = JSON.parse(req.messages[0].content.split('\n').slice(1).join('\n'));
  const items = keys.map((key) => ({ key, th: answers[key] }));
  return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ items }) }] };
} } } };

const th = { names: {}, text: {} }, auto = { names: [], text: [] };
const left = await translate({ client, th, auto, missing: { names: ['Big Flame'], text: ['Do {n} more damage.', 'Flip {n} coins.'] } });
assert.deepEqual(left, ['Flip {n} coins.']);
assert.equal(th.text['Do {n} more damage.'], 'สร้างความเสียหายเพิ่ม {n}');
assert.deepEqual(auto, { names: ['Big Flame'], text: ['Do {n} more damage.'] });
assert.equal(calls, 3); // names, text, text retry
console.log('translate ok');
