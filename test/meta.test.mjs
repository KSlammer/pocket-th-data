// Tournament summaries: deck counts, signature cards, and pairings → per-side matchup results.
import assert from 'node:assert/strict';
import { summarize, combine } from '../scripts/meta.mjs';

const list = (...names) => ({ pokemon: names.map((name) => ({ name, count: 2 })), trainer: [{ name: 'Professor\'s Research', count: 2 }] });
const standings = [
  { player: 'a', deck: { name: 'Mewtwo ex' }, decklist: list('Mewtwo ex', 'Ralts') },
  { player: 'b', deck: { name: 'Mewtwo ex' }, decklist: list('Mewtwo ex') },
  { player: 'c', deck: { name: 'Pikachu ex' }, decklist: list('Pikachu ex') },
  { player: 'd' }, // no deck reported
];
const pairings = [
  { player1: 'a', player2: 'c', winner: 'a' },
  { player1: 'c', player2: 'b', winner: 'c' },
  { player1: 'a', player2: 'b', winner: 0 },
  { player1: 'c', player2: 'd', winner: 'c' }, // unknown deck: ignored
  { player1: 'b', winner: 'b' }, // bye
  { player1: 'a', player2: 'c', winner: -1 }, // double loss
];
const s = summarize(standings, pairings);
assert.deepEqual(s.decks, { 'Mewtwo ex': 2, 'Pikachu ex': 1 });
const g = Object.fromEntries(s.games.map(([a, b, ...r]) => [`${a}|${b}`, r]));
assert.deepEqual(g, { 'Mewtwo ex|Pikachu ex': [1, 1, 0], 'Pikachu ex|Mewtwo ex': [1, 1, 0], 'Mewtwo ex|Mewtwo ex': [0, 0, 2] });

const m = combine([s, s]);
assert.equal(m.players, 6);
assert.equal(m.decks[0].name, 'Mewtwo ex');
assert.equal(m.decks[0].share, 0.6667);
// Ralts is in 1 of 2 Mewtwo lists (0.5) → kept; Professor's Research in all.
assert.deepEqual(m.decks[0].cards.map(([c]) => c).sort(), ["Mewtwo ex", "Professor's Research", 'Ralts']);
assert.deepEqual(m.matchups.find(([a, b]) => a === 'Mewtwo ex' && b === 'Pikachu ex'), ['Mewtwo ex', 'Pikachu ex', 2, 2, 0]);
console.log('meta ok');
