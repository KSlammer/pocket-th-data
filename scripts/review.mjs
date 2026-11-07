// Translation review helper (report only, changes nothing): lists the machine translations still marked AI
// (i18n/auto.json) and flags reviewed text that breaks the glossary, drops an energy symbol or {n}, or loses an
// English card/Pokémon name. Used by the monthly review; a person decides what to fix.  Run: node scripts/review.mjs
import { readFileSync } from 'node:fs';

const th = JSON.parse(readFileSync('i18n/th.json', 'utf8'));
const auto = JSON.parse(readFileSync('i18n/auto.json', 'utf8'));

// English term → the Thai the glossary (README) requires.
const GLOSSARY = [[/Active Spot/, /ตำแหน่งต่อสู้/], [/\bBench(ed)?\b/, /เบนช์/], [/Knocked Out/, /หมดสภาพ/], [/discard pile/, /กองทิ้ง/],
  [/Energy Zone/, /โซนพลังงาน/], [/\bheads\b/, /หัว/], [/\btails\b/, /ก้อย/], [/\bAsleep\b/, /นอนหลับ/], [/\bParalyzed\b/, /อัมพาต/],
  [/\bPoisoned\b/, /ติดพิษ/], [/\bBurned\b/, /ติดไหม้/], [/\bConfused\b/, /สับสน/], [/Special Condition/, /สภาวะพิเศษ/],
  [/\bSupporter\b/, /ซัพพอร์ตเตอร์/], [/Pokémon Tool/, /เครื่องมือโปเกมอน/], [/\bStadium\b/, /สเตเดียม/]];
// Capitalised words that are game terms (translated), not names (kept in English).
const TERMS = new Set(`A An Pokémon Pokemon Energy Zone Active Spot Bench Benched Basic Stage Supporter Supporters Item Items Stadium Tool Tools
  Knocked Knock Knocks Out Special Condition Conditions Asleep Paralyzed Poisoned Burned Confused Ability Abilities ex Mega If This Your You
  Flip Heal Discard Put Look Draw Choose Switch Take Move During Once As At When Whenever Each For Attacks Attach Shuffle Then That The It
  Its Both All Reveal Search Play Until Do Before After Produce Retreat Cost Weakness HP Ultra Beast Beasts Ancient Future Fossil Checkup
  In Otherwise Also Return Defending Attacking Trainer Evolution Evolutions Change Halve Use Any Prevent Existing Fire Water Grass
  Lightning Psychic Fighting Darkness Metal Dragon Colorless Rare Candy Teal Mask Shiny`.split(/\s+/));

const symbols = (s) => (s.match(/\[\s*[A-Z]\s*\]/g) || []).map((x) => x.replace(/\s/g, '')).sort().join('');
const slots = (s) => (s.match(/\{n\}/g) || []).length;
const flags = [];
for (const [en, t] of Object.entries(th.text)) {
  for (const [a, b] of GLOSSARY) if (a.test(en) && !b.test(t)) flags.push(['glossary', a.source, en, t]);
  if (symbols(en) !== symbols(t)) flags.push(['energy symbol', '', en, t]);
  if (slots(en) !== slots(t)) flags.push(['{n} count', '', en, t]);
  for (const w of new Set(en.match(/(?<![\p{L}'])\p{Lu}[\p{L}'.-]*/gu) || [])) {
    const name = w.replace(/'s$/, '').replace(/\.$/, '');
    if (!TERMS.has(name) && !t.includes(name)) flags.push(['English name missing', name, en, t]);
  }
}

console.log(`AI translations awaiting review: ${auto.names.length} names, ${auto.text.length} texts`);
for (const n of auto.names) console.log(`  name  ${n} → ${th.names[n]}`);
for (const x of auto.text) console.log(`  text  ${x}\n        → ${th.text[x]}`);
console.log(`\nChecks over all ${Object.keys(th.text).length} texts: ${flags.length} to look at`);
for (const [kind, what, en, t] of flags) console.log(`  [${kind}${what ? `: ${what}` : ''}] ${en}\n        → ${t}`);
