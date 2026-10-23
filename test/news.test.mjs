// Feed parsing (Google News RSS + Reddit Atom), official detection, and merge/dedupe.
import assert from 'node:assert/strict';
import { parse, merge } from '../scripts/news.mjs';

const rss = `<rss><channel><item><title>Dual Fusion arrives Oct 29 &amp; more - Pokemon.com</title>
<link>https://news.google.com/rss/articles/abc</link><pubDate>Thu, 23 Oct 2026 01:00:00 GMT</pubDate>
<source url="https://www.pokemon.com">Pokemon.com</source></item>
<item><title><![CDATA[Best Mewtwo deck - Game8]]></title><link>https://news.google.com/rss/articles/def</link>
<pubDate>Wed, 22 Oct 2026 01:00:00 GMT</pubDate><source url="https://game8.co">Game8</source></item></channel></rss>`;
const g = parse(rss, { kind: 'news' });
assert.deepEqual(g.map((i) => [i.title, i.source, i.kind]), [
  ['Dual Fusion arrives Oct 29 & more', 'Pokemon.com', 'official'],
  ['Best Mewtwo deck', 'Game8', 'news'],
]);

const atom = `<feed><entry><title>I finally pulled the Crown Mew!</title><link href="https://www.reddit.com/r/PTCGP/comments/x/"/>
<updated>2026-10-22T10:00:00+00:00</updated><content type="html">&lt;p&gt;body&lt;/p&gt;</content></entry></feed>`;
const r = parse(atom, { kind: 'community', source: 'r/PTCGP' });
assert.deepEqual(r[0], { title: 'I finally pulled the Crown Mew!', link: 'https://www.reddit.com/r/PTCGP/comments/x/', date: '2026-10-22T10:00:00.000Z', source: 'r/PTCGP', kind: 'community' });

const now = Date.parse('2026-10-23T12:00:00Z');
const old = [{ ...g[1], th: 'เด็ค Mewtwo ที่ดีที่สุด' }, { title: 'Ancient', link: 'https://x.test/a', date: '2026-08-01T00:00:00.000Z' }];
const m = merge(old, [...g, { ...g[0], link: 'https://other/dup' }, ...r], now);
assert.deepEqual(m.map((i) => i.title), ['Dual Fusion arrives Oct 29 & more', 'I finally pulled the Crown Mew!', 'Best Mewtwo deck']);
assert.equal(m[2].th, 'เด็ค Mewtwo ที่ดีที่สุด'); // translation carried over, too-old item dropped, same headline deduped
console.log('news ok');
