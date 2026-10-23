// Fills i18n/th.json with machine translations (see scripts/llm.mjs: OpenRouter free models or Claude)
// for whatever build left in i18n/missing.json. Translated keys are listed in i18n/auto.json so the site
// can label them and people can review them.
// Run: OPENROUTER_API_KEY=... node scripts/translate.mjs   (then `npm run build` again)
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const BATCH = 40; // small enough for free models' output limits
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

// Shared terminology, from the glossary table in README.md (single source of truth).
const GLOSSARY = (() => {
  try {
    const md = readFileSync('README.md', 'utf8');
    return md.slice(md.indexOf('## อภิธานศัพท์')).split('\n## ')[0].split('\n').filter((l) => /^\| [^-]/.test(l)).slice(1).join('\n');
  } catch { return ''; }
})();
const words = (s) => new Set(s.toLowerCase().match(/[a-z]{4,}/g) || []);
// The existing translations that share the most words with this batch: a style guide small enough for free models.
export function examples(dict, keys, n) {
  const want = new Set(keys.flatMap((k) => [...words(k)]));
  return Object.entries(dict)
    .map(([en, t]) => [en, t, [...words(en)].filter((w) => want.has(w)).length])
    .sort((a, b) => b[2] - a[2])
    .slice(0, n)
    .map(([en, t]) => [en, t]);
}

function system(th, kind, keys) {
  return `You translate Pokémon TCG Pocket card text from English to Thai for a fan site.
Rules:
- "names" are attack/ability names: translate them to natural Thai, short like the examples.
- "text" are card effects. Keep every {n} placeholder (each stands for a number, filled back in the same order) and every energy mark like [R] [W] exactly. Keep {n} in the same order as the English.
- Pokémon names, card names and attack names quoted inside effect text stay in English.
- Use exactly this terminology and match the tone of the examples.
Glossary (English | Thai):
${GLOSSARY}
Existing translations ([English, Thai]):
${JSON.stringify(examples(th[kind], keys, kind === 'names' ? 150 : 80))}`;
}

async function ask(llm, th, kind, keys) {
  const out = await llm({
    system: system(th, kind, keys),
    user: `Translate these ${kind} (return one item per key, key copied exactly):\n${JSON.stringify(keys)}`,
    schema: SCHEMA,
    maxTokens: 16000,
  });
  return new Map((out.items || []).map((i) => [i.key, i.th]));
}

// Returns the keys it could not translate (after one retry) so the caller can fail loudly.
export async function translate({ llm, th, missing, auto }) {
  const left = [];
  for (const kind of ['names', 'text']) {
    let todo = missing[kind].filter((k) => !th[kind][k]);
    for (let attempt = 0; attempt < 2 && todo.length; attempt++) {
      const retry = [];
      for (let i = 0; i < todo.length; i += BATCH) {
        const keys = todo.slice(i, i + BATCH);
        const got = await ask(llm, th, kind, keys);
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { llm } = await import('./llm.mjs');
  const th = JSON.parse(readFileSync('i18n/th.json', 'utf8'));
  const auto = JSON.parse(readFileSync('i18n/auto.json', 'utf8'));
  const missing = JSON.parse(readFileSync('i18n/missing.json', 'utf8'));
  const n = missing.names.length + missing.text.length;
  if (!n) { console.log('Nothing to translate'); process.exit(0); }
  if (!llm()) { console.log('No OPENROUTER_API_KEY or ANTHROPIC_API_KEY; skipping translation'); process.exit(1); }
  const left = await translate({ llm: llm(), th, missing, auto });
  writeFileSync('i18n/th.json', JSON.stringify(th, null, 1));
  writeFileSync('i18n/auto.json', JSON.stringify(auto, null, 1) + '\n');
  console.log(`Translated ${n - left.length}/${n}`);
  if (left.length) { console.error('Still missing:\n' + left.join('\n')); process.exit(1); }
}
