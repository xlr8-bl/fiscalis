/**
 * check_type.mjs — the type system is two faces, and headings carry both.
 *
 * It was fifteen families, one per reference sheet, which is how you
 * reproduce fifteen posters and not how you have a typeface. These are
 * the rules that stopped that, held where they cannot drift back.
 */
import assert from 'node:assert';
import { FACES } from '../assets/js/compose.js';
import { TYPE, M } from '../assets/js/slides.js';

let pass = 0;
const ok = (name, fn) => {
  try { fn(); console.log(`  ok   ${name}`); pass++; }
  catch (e) { console.log(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1; }
};

console.log('\nthe type system:\n');

ok('two faces, and only two, across both engines', () => {
  const used = new Set(Object.values(FACES));
  assert.deepEqual([...used].sort(), ['Helvetica', 'NeueBit'],
    `the hook engine names ${[...used].join(', ')}`);
  const slides = new Set(Object.values(TYPE).map((t) => t.family));
  assert.deepEqual([...slides].sort(), ['NeueBit', 'NeueMontreal'],
    `the slide engine names ${[...slides].join(', ')}`);
  /* NeueMontreal is the licensed name the slides ask for and Helvetica
     is what stands in until it is bought. Both are neo-grotesques on
     Helvetica's proportions, which is why the measured tracking holds
     across the swap. */
});

ok('the bitmap is on both, because the pairing is the identity', () => {
  assert.equal(FACES.pixel, 'NeueBit');
  assert.equal(TYPE.titleAlt.family, 'NeueBit');
  assert.equal(TYPE.rail.family, 'NeueBit');
});

ok('a swapped letter is scaled, or it reads as a subscript', () => {
  /* NeueBit's x-height is 71 units where the grotesque's is 108,
     measured on both faces at 200px. Unscaled, the swapped letter in
     "So" came out sitting on the baseline at half the size. */
  assert.ok(TYPE.titleAlt.scale >= 1.45 && TYPE.titleAlt.scale <= 1.6,
    `titleAlt scale is ${TYPE.titleAlt.scale} and should be about 1.52`);
});

ok('headings are tracked tight and paragraphs are not', () => {
  assert.ok(TYPE.title.track <= -0.06, `title track is ${TYPE.title.track}`);
  assert.equal(TYPE.say.track, 0, 'the paragraph is tracked, and should not be');
  assert.equal(TYPE.action.track, 0);
  /* And the swapped face is NOT pulled: Chrome puts letter-spacing after
     each character, so the heading's pull drags the next letter into a
     bitmap glyph, which has no sidebearing to give. */
  assert.equal(TYPE.titleAlt.track, 0,
    'the bitmap face is tracked, which collides it with its neighbour');
});

ok('the headline size and leading are the measured ones', () => {
  // caps 0.0816 of frame = 0.113 em; lines 0.0893 apart, ie under one em
  assert.ok(Math.abs(M.title.size - 0.1133) < 0.002, `title size is ${M.title.size}`);
  assert.ok(M.title.lead < 1, 'the headline leads at more than one em');
});

console.log(`\n${pass} checks passed\n`);
