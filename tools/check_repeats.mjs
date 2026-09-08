/**
 * check_repeats.mjs — the two things that come back every session.
 *
 *   node tools/check_repeats.mjs
 *
 * A model with no memory between sessions repeats the sheet it used
 * last time and the subject it wrote last time, and next_carousel
 * rotating both is an instruction. Instructions have not been enough
 * here three times running — the hook sheet, the outro, the location —
 * so this checks the refusals rather than the guidance.
 */

import assert from 'node:assert';
import { recent, repeats, tooClose, HOOK_COOLDOWN } from '../lib/repeats.js';
import { CHOSEN } from '../assets/js/hooks/chosen.js';

let bad = 0;
const ok = (what, fn) => {
  try { fn(); console.log(`  ok   ${what}`); }
  catch (e) { bad++; console.log(`  FAIL ${what}\n       ${e.message}`); }
};

const was = (hook, topic, slug = 'x') => ({ hook, topic, title: topic, slug });

console.log('\nthe same poster twice\n');

ok('a sheet used in the last five is refused, and free ones are named', () => {
  const before = [was('h051', 'a'), was('h024', 'b'), was('h009', 'c')];
  const out = repeats({ hook: 'h024' }, before, CHOSEN);
  assert.equal(out.length, 1, out.join(' | '));
  assert.match(out[0], /h024/);
  assert.match(out[0], /Free right now/);
  // and it does not offer one that is itself in the cooldown
  assert.ok(!/Free right now:[^.]*h051/.test(out[0]), 'it offered a sheet just used');
});

ok('a sheet that has gone longer than the cooldown is allowed back', () => {
  const before = Array.from({ length: 8 }, (_, i) => was(CHOSEN[i + 1] ?? 'hZ', `t${i}`));
  assert.equal(repeats({ hook: CHOSEN[7] }, before, CHOSEN).length, 0,
    'a sheet six carousels back was still refused');
});

ok('the cooldown leaves enough sheets to actually rotate', () => {
  /* The failure this catches: raising the cooldown past the pack size
     would refuse every sheet and there would be no way to file at all. */
  assert.ok(CHOSEN.length > HOOK_COOLDOWN + 1,
    `${CHOSEN.length} sheets and a cooldown of ${HOOK_COOLDOWN} leaves nothing free`);
});

ok('a first carousel is not refused for repeating nothing', () => {
  assert.equal(repeats({ hook: 'h051', topic: 'The contact form' }, [], CHOSEN).length, 0);
});

console.log('\nthe same subject twice\n');

ok('the same topic in different words is caught, and named', () => {
  const before = [was('h009', 'The contact form that emails nobody', 'form-emails-nobody')];
  const out = repeats({ topic: 'Contact forms that email nobody' }, before, CHOSEN);
  assert.equal(out.length, 1, out.join(' | '));
  assert.match(out[0], /form-emails-nobody/);
  assert.match(out[0], /contact/);
  // it says what to do rather than only what is wrong
  assert.match(out[0], /angle/);
});

ok('a genuinely different subject passes', () => {
  const before = [was('h009', 'The contact form that emails nobody', 'a'),
                  was('h024', 'Hours on Google nobody updated', 'b')];
  for (const topic of ['Why one site looks expensive and another looks cheap',
                       'What a favicon is and why yours is the grey globe',
                       'Two weights of one typeface beats four faces']) {
    assert.equal(repeats({ topic }, before, CHOSEN).length, 0, `"${topic}" was refused`);
  }
});

ok('shared filler words alone do not trip it', () => {
  /* "your site", "the page", "how to" are in every topic he writes. If
     those counted, the second carousel of the account would be refused. */
  const before = [was('h009', 'How to check your own site page by page', 'a')];
  assert.equal(repeats({ topic: 'How to read what Google says about your site' },
                       before, CHOSEN).length, 0);
});

ok('a two-word topic is left alone rather than guessed at', () => {
  // too little to compare; refusing on one shared word would be noise
  assert.equal(tooClose('Favicons', [was('h009', 'Favicon', 'a')]), null);
});

console.log('\nwhat the refusal is worth\n');

ok('both refusals name the carousel or the sheet, not just the fault', () => {
  const before = [was('h051', 'The contact form that emails nobody', 'the-form')];
  const out = repeats({ hook: 'h051', topic: 'A contact form emailing nobody' },
                      before, CHOSEN);
  assert.equal(out.length, 2, 'both should trip');
  assert.ok(out.every((m) => m.length > 80), 'a refusal that does not explain itself');
  assert.match(out.join(' '), /next_carousel/);
});

console.log(bad ? `\n${bad} failed` : '\nthe rotation is enforced, not requested');
process.exit(bad ? 1 : 0);
