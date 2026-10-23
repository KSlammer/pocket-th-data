// Fills i18n/th.json with Claude translations for whatever build left in i18n/missing.json.
// Machine-translated keys are listed in i18n/auto.json so the site can label them and people can review them.
// Run: ANTHROPIC_API_KEY=... node scripts/translate.mjs   (then `npm run build` again)
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const BATCH = 80;
const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: { key: { type: 'string' }, th: { type: 'string' } },
        required: ['key', 'th'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};

const marks = (s) => (s.match(/\{n\}|\[[A-Z]\]/g) || []).sort().join();
// A translation must keep every {n} number slot and [X] energy mark; build fills numbers back in order.
export const valid = (en, th) => typeof th === 'string' && th.trim() !== '' && marks(en) === marks(th);

function system(th) {
  return `You translate Pokémon TCG Pocket card text from English to Thai for a fan site.
Rules:
- "names" are attack/ability names: translate them to natural Thai, short like the examples.
- "text" are card effects. Keep every {n} placeholder (each stands for a number, filled back in the same order) and every energy mark like [R] [W] exactly. Keep {n} in the same order as the English.
- Pokémon names, card names and attack names quoted inside effect text stay in English.
- Use exactly the terminology of the existing translations below; match their tone.
Existing translations (JSON):
${JSON.stringify(th)}`;
}

async function ask(client, sys, kind, keys) {
  const msg = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
    system: [{ type: 'text', text: sys, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: `Translate these ${kind} (return one item per key, key copied exactly):\n${JSON.stringify(keys)}` }],
  });
  if (msg.stop_reason === 'refusal') throw new Error('Model refused the batch');
  if (msg.stop_reason === 'max_tokens') throw new Error('Output cut off; lower BATCH');
  const out = JSON.parse(msg.content.find((b) => b.type === 'text').text);
  return new Map(out.items.map((i) => [i.key, i.th]));
}

// Returns the keys it could not translate (after one retry) so the caller can fail loudly.
export async function translate({ client, th, missing, auto }) {
  const sys = system(th);
  const left = [];
  for (const kind of ['names', 'text']) {
    let todo = missing[kind].filter((k) => !th[kind][k]);
    for (let attempt = 0; attempt < 2 && todo.length; attempt++) {
      const retry = [];
      for (let i = 0; i < todo.length; i += BATCH) {
        const keys = todo.slice(i, i + BATCH);
        const got = await ask(client, sys, kind, keys);
        for (const k of keys) {
          const t = got.get(k);
          if (kind === 'names' ? t?.trim() : valid(k, t)) {
            th[kind][k] = t.trim();
            if (!auto[kind].includes(k)) auto[kind].push(k);
          } else retry.push(k);
        }
      }
      todo = retry;
    }
    left.push(...todo);
  }
  return left;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const th = JSON.parse(readFileSync('i18n/th.json', 'utf8'));
  const auto = JSON.parse(readFileSync('i18n/auto.json', 'utf8'));
  const missing = JSON.parse(readFileSync('i18n/missing.json', 'utf8'));
  const n = missing.names.length + missing.text.length;
  if (!n) { console.log('Nothing to translate'); process.exit(0); }
  const left = await translate({ client: new Anthropic(), th, missing, auto });
  writeFileSync('i18n/th.json', JSON.stringify(th, null, 1));
  writeFileSync('i18n/auto.json', JSON.stringify(auto, null, 1) + '\n');
  console.log(`Translated ${n - left.length}/${n}`);
  if (left.length) { console.error('Still missing:\n' + left.join('\n')); process.exit(1); }
}
