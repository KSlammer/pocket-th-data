// One JSON-returning chat call, through whichever key is set:
//   OPENROUTER_API_KEY → OpenRouter, free models (picked at run time, since the free list changes often;
//                        OPENROUTER_MODEL="a,b" pins them). Free tier: 50 requests/day, 20/min.
//   ANTHROPIC_API_KEY  → Claude (paid).
// Returns null when neither is set, so callers can skip translation.

const OR = 'https://openrouter.ai/api/v1';
let freeModels;

async function pickFree() {
  if (process.env.OPENROUTER_MODEL) return process.env.OPENROUTER_MODEL.split(',').map((s) => s.trim());
  const { data } = await (await fetch(`${OR}/models`)).json();
  // Biggest context first (the prompt carries example translations); OpenRouter tries them in order.
  return data
    .filter((m) => m.id.endsWith(':free') && m.context_length >= 32000 && /text/.test(m.architecture?.output_modalities?.join() ?? 'text'))
    .sort((a, b) => b.context_length - a.context_length)
    .slice(0, 3)
    .map((m) => m.id);
}

// Free models often wrap JSON in prose or ``` fences; take the outermost object.
export function parseJSON(text) {
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s < 0 || e < s) throw new Error('No JSON in reply');
  return JSON.parse(text.slice(s, e + 1));
}

async function openrouter({ system, user, schema, maxTokens }) {
  freeModels ??= await pickFree();
  if (!freeModels.length) throw new Error('No free OpenRouter model available right now');
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${OR}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'content-type': 'application/json',
        'http-referer': 'https://pokedex-th.slammer.work',
        'x-title': 'Pocket TH',
      },
      body: JSON.stringify({
        models: freeModels,
        max_tokens: maxTokens,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: `${system}\nReply with only a JSON object matching this JSON Schema:\n${JSON.stringify(schema)}` },
          { role: 'user', content: user },
        ],
      }),
    });
    // 429 = the 20/min free limit or a busy upstream; wait and try again a couple of times.
    if (res.status === 429 && attempt < 2) { await new Promise((r) => setTimeout(r, 30000)); continue; }
    if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const out = await res.json();
    const choice = out.choices?.[0];
    if (choice?.finish_reason === 'length') throw new Error('Output cut off; lower the batch size');
    console.log(`  via ${out.model}`);
    return parseJSON(choice?.message?.content || '');
  }
}

async function claude({ system, user, schema, maxTokens }) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const msg = await new Anthropic().beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: maxTokens,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
    system,
    messages: [{ role: 'user', content: user }],
  });
  if (msg.stop_reason === 'refusal') throw new Error('Model refused');
  if (msg.stop_reason === 'max_tokens') throw new Error('Output cut off; lower the batch size');
  return JSON.parse(msg.content.find((b) => b.type === 'text').text);
}

export function llm() {
  if (process.env.OPENROUTER_API_KEY) return openrouter;
  if (process.env.ANTHROPIC_API_KEY) return claude;
  return null;
}
