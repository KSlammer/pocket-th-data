// Graded-card prices (PSA, BGS, CGC, TAG, SGC) from the eBay Browse API: asking prices of active fixed-price
// listings on eBay US, not sold prices (eBay's sold data API is restricted). Called by prices.mjs with the most
// valuable English / Japanese cards of the day; needs EBAY_CLIENT_ID and EBAY_CLIENT_SECRET (a free eBay developer
// app, Production keyset). Default Browse quota is 5,000 calls a day; one call per card.
const API = 'https://api.ebay.com';
const CATEGORY = 183454; // Pokémon Individual Cards (eBay US)
export const GRADERS = ['PSA', 'BGS', 'CGC', 'TAG', 'SGC'];
const GRADES = ['10', '9.5', '9', '8.5', '8'];

// "… PSA 10 GEM MINT" / "BGS 9.5" / "CGC Pristine 10" / "BGS Black Label 10" → "PSA 10" etc.; null when not one clear grade.
const GRADE_RE = new RegExp(`\\b(${GRADERS.join('|')})\\s*(?:gem\\s*mint|gem\\s*mt|mint|pristine|black\\s*label|perfect)?\\s*(10|9\\.5|9|8\\.5|8)(?![\\d.])`, 'gi');
export function gradeOf(title) {
  const found = new Set([...title.matchAll(GRADE_RE)].map((m) => `${m[1].toUpperCase()} ${m[2]}`));
  return found.size === 1 ? [...found][0] : null;
}
// Lots, fakes and slab-only listings would skew the numbers.
const JUNK = /\b(lot|lots|bundle|proxy|custom|reprint|replica|fake|orica|empty|slab only|case only|label only|pick|choose|you pick|mystery|repack)\b/i;

// "Charizard - 4/102 (Shadowless)" → "Charizard"
export const baseName = (n) => n.replace(/\s*[-([].*$/, '').trim();
// A title names this card when it has the Pokémon's first word and, if the card has a number, that number.
export function sameCard(title, name, number) {
  const t = title.toLowerCase();
  const word = baseName(name).toLowerCase().split(/\s+/)[0];
  if (word && !t.includes(word)) return false;
  if (!number) return true;
  const [a, b] = number.split('/');
  const n = a.replace(/^0+(?=\d)/, '');
  if (b) return new RegExp(`(^|[^\\d])0*${n}\\s*/\\s*0*${b.replace(/^0+(?=\d)/, '')}($|[^\\d])`).test(t) || new RegExp(`#\\s*0*${n}($|[^\\d])`).test(t);
  return t.includes(number.toLowerCase());
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
// Listings → { "PSA 10": [median USD, lowest USD, listings], … } in GRADERS × GRADES order.
export function summarize(items, name, number) {
  const by = {};
  for (const i of items) {
    if (i.price?.currency !== 'USD' || JUNK.test(i.title) || !sameCard(i.title, name, number)) continue;
    const g = gradeOf(i.title);
    if (g) (by[g] ||= []).push(+i.price.value);
  }
  const out = {};
  for (const gr of GRADERS) for (const n of GRADES) {
    const p = by[`${gr} ${n}`];
    if (p?.length) out[`${gr} ${n}`] = [+median(p).toFixed(2), Math.min(...p), p.length];
  }
  return out;
}

async function token(id, secret) {
  const res = await fetch(`${API}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: { authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
  });
  if (!res.ok) throw new Error(`eBay token ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).access_token;
}

// cards: [{ lang, id, name, number, set, market }] → [[id, name, number, set, market, grades], …] for cards with any graded listing.
export async function graded(cards, { id, secret }) {
  const auth = `Bearer ${await token(id, secret)}`;
  const rows = [];
  let calls = 0, failed = 0;
  for (const c of cards) {
    const q = `${baseName(c.name)} ${c.number || ''} (${GRADERS.join(',')})${c.lang === 'jp' ? ' japanese' : ' -japanese'}`.replace(/\s+/g, ' ');
    const url = `${API}/buy/browse/v1/item_summary/search?${new URLSearchParams({ q, category_ids: CATEGORY, filter: 'buyingOptions:{FIXED_PRICE}', limit: 200 })}`;
    const res = await fetch(url, { headers: { authorization: auth, 'x-ebay-c-marketplace-id': 'EBAY_US' }, signal: AbortSignal.timeout(30000) }).catch(() => null);
    calls++;
    if (res?.status === 429) { console.warn('eBay: daily quota reached'); break; }
    if (!res?.ok) { if (++failed > 20) { console.warn('eBay: too many errors, stopping'); break; } continue; }
    const g = summarize((await res.json()).itemSummaries || [], c.name, c.number);
    if (Object.keys(g).length) rows.push([c.id, c.name, c.number, c.set, c.market, g]);
    await new Promise((r) => setTimeout(r, 250));
  }
  console.log(`eBay graded: ${calls} searches, ${failed} failed, ${rows.length} cards with graded listings`);
  return rows;
}
