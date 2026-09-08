/**
 * check_slides.mjs — the teaching carousel, without drawing one.
 *
 * The property that matters is that the budget and the renderer agree.
 * A validator that passes a slide the renderer then overflows is worse
 * than no validator, because the overflow is silent: the instruction
 * ends up under a paragraph and the carousel still posts.
 *
 * tools/build_slides.mjs is the other half — it draws every template and
 * fails on any overflow. This one is the arithmetic, which is what Spark
 * actually hits.
 */
import assert from 'node:assert';
import { validateSlides, PER_LINE, LIMITS, RECAP_MAX } from '../lib/slides/spec.js';
import { TEMPLATES, TEMPLATE_NAMES, BLOCKS, SLIDE_GROUND_NAMES, M, recapPitch } from '../assets/js/slides.js';
import { ICON_NAMES, ICONS, PIXEL_NAMES, iconUrl } from '../assets/js/icons.js';
import { EXAMPLE_SLIDES } from '../lib/slides/examples.js';
import { slideGuide, probeSlide } from '../lib/slides/guide.js';
import { CUTOUTS, placementOf } from '../assets/js/cutouts.js';
import { designBrief } from '../lib/designer.js';
import { TOOLS } from '../lib/mcp.js';

let pass = 0;
const ok = (name, fn) => {
  try { fn(); console.log(`  ok   ${name}`); pass++; }
  catch (e) { console.log(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1; }
};

const base = () => ({
  template: 'reasons', ground: 'paper', handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
  title: 'Why nobody calls',
  say: 'The enquiries are not missing because the site is ugly.',
  chips: ['the number is a picture', 'the form emails nowhere'],
  icons: ['message', 'no'],
  action: 'Send yourself an enquiry and wait a day for it to arrive.',
});
const one = (over = {}) => validateSlides({ slides: [ { ...base(), ...over }, base() ] });

/* recap has neither chips nor icons, so spreading base() over it and
   changing the template leaves fields that template cannot draw — which
   the validator now refuses by name, correctly. Built properly instead. */
const recapBase = () => ({
  template: 'recap', ground: 'paper', handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
  title: 'The whole check',
  action: 'Send yourself an enquiry and wait a day for it to arrive.',
});

console.log('\nthe teaching carousel:\n');

ok('every example slide validates', () => {
  const r = validateSlides({ slides: EXAMPLE_SLIDES });
  assert.ok(r.ok, r.problems.join('; '));
  assert.equal(r.plan.length, EXAMPLE_SLIDES.length);
});

ok('every template has an example, so none is untested geometry', () => {
  const used = new Set(EXAMPLE_SLIDES.map((s) => s.template));
  for (const t of TEMPLATE_NAMES) assert.ok(used.has(t), `${t} has no example`);
});

ok('every block a template names actually exists', () => {
  for (const [name, t] of Object.entries(TEMPLATES)) {
    for (const b of t.blocks) assert.ok(BLOCKS[b], `${name} names a missing block: ${b}`);
  }
});

ok('a made-up template is refused, and the real ones are listed', () => {
  const r = one({ template: 'explainer' });
  assert.ok(!r.ok);
  assert.match(r.problems[0], /not a template/);
  for (const t of TEMPLATE_NAMES) assert.match(r.problems[0], new RegExp(t));
});

ok('a ground that cannot carry a paragraph is refused', () => {
  // red is display-only in the hook engine, and a teaching slide is all paragraph
  const r = one({ ground: 'red' });
  assert.ok(!r.ok);
  assert.match(r.problems.join(' '), /not a ground for a teaching slide/);
  assert.ok(!SLIDE_GROUND_NAMES.includes('red'));
});

ok('a made-up icon is refused rather than silently dropped', () => {
  const r = one({ icons: ['message', 'sparkles'] });
  assert.ok(!r.ok);
  assert.match(r.problems.join(' '), /no icon called sparkles/);
});

ok('every icon the pack holds is accepted', () => {
  for (const name of ICON_NAMES) {
    const r = one({ icons: [name, 'no'] });
    assert.ok(r.ok, `${name} was refused: ${r.problems.join('; ')}`);
  }
});

ok('one chip is refused: a stack of one is not a set', () => {
  assert.ok(!one({ chips: ['only this'] }).ok);
  assert.ok(one({ chips: ['one', 'two'] }).ok);
  assert.ok(!one({ chips: ['a', 'b', 'c', 'd', 'e'] }).ok);
});

ok('duo takes exactly two, and says why', () => {
  const r = validateSlides({ slides: [
    { ...base(), template: 'compare', say2: 'Two fixes.',
      duo: [{ head: 'Slow', tail: 'the server is thinking' }] },
    base(),
  ] });
  assert.ok(!r.ok);
  assert.match(r.problems.join(' '), /exactly two/);
  assert.match(r.problems.join(' '), /use chips/);
});

ok('a rail that changes mid-carousel is refused', () => {
  const r = validateSlides({ slides: [base(), { ...base(), series: 'SOMETHING ELSE' }] });
  assert.ok(!r.ok);
  assert.match(r.problems.join(' '), /same on all of them/);
});

ok('copy too long is refused in lines, and points at the paragraphs', () => {
  const r = one({ say: 'wondering about the '.repeat(30) });
  assert.ok(!r.ok);
  assert.match(r.problems.join(' '), /lines? too long/);
  assert.match(r.problems.join(' '), /paragraphs/);
});

ok('the plan says how full each slide is, before anything is drawn', () => {
  const r = validateSlides({ slides: EXAMPLE_SLIDES });
  for (const p of r.plan) assert.match(p.fills, /^\d+% of the room it has$/);
});

ok('the characters-a-line figures are wrapped ones, not average advance', () => {
  /* The distinction that cost twenty false passes: dividing the column
     by an average character over-counts, because greedy wrapping leaves
     a ragged gap at the end of every line. If one of these ever creeps
     back up to the average-advance value, the budget silently loosens. */
  assert.ok(PER_LINE.say <= 58, `say is ${PER_LINE.say}; the average-advance value was 67.7`);
  assert.ok(PER_LINE.title <= 15.5, `title is ${PER_LINE.title}; average advance was 16.4`);
  assert.ok(PER_LINE.action <= 36.5, `action is ${PER_LINE.action}; average advance was 40.5`);
});

ok('the brief tells Spark about the templates, and names the tool', () => {
  const b = designBrief();
  assert.ok(b.teaching, 'no teaching section in the brief');
  assert.equal(b.teaching.tool, 'teach_carousel');
  assert.equal(b.teaching.templates.length, TEMPLATE_NAMES.length);
  for (const t of b.teaching.templates) assert.ok(t.what, `${t.name} has no description`);
  for (const i of b.teaching.icons) assert.ok(i.means, `${i.name} has no meaning`);
});

ok('the tool has no coordinate in it anywhere', () => {
  /* The whole point. If a box, x, y or size ever appears in this schema,
     Spark is composing again and the templates have stopped meaning
     anything. */
  const tool = TOOLS.find((t) => t.name === 'teach_carousel');
  assert.ok(tool, 'teach_carousel is not registered');
  const json = JSON.stringify(tool.inputSchema);
  for (const word of ['"box"', '"x"', '"y"', '"size"', '"width"', '"height"']) {
    assert.ok(!json.includes(word), `the schema lets Spark set ${word}`);
  }
});

ok('a slide must carry an instruction: that is the format\'s promise', () => {
  const tool = TOOLS.find((t) => t.name === 'teach_carousel');
  const req = tool.inputSchema.properties.slides.items.required;
  assert.ok(req.includes('action'), 'action is not required');
  assert.ok(req.includes('template'), 'template is not required');
});

ok('the packs sum, no name collides, and the brief agrees', () => {
  /* Was asserting a magic 16 and broke the moment a second pack landed.
     What matters is that the two packs add up, that no name appears in
     both (iconUrl picks the folder by name, so a collision would serve
     the wrong file), and that the brief counts the same. */
  assert.equal(ICON_NAMES.length, Object.keys(ICONS).length + PIXEL_NAMES.length);
  const both = PIXEL_NAMES.filter((n) => n in ICONS);
  assert.equal(both.length, 0, `these names are in both packs: ${both.join(', ')}`);
  for (const n of PIXEL_NAMES) assert.match(iconUrl(n), /\/pixel\//);
  assert.equal(designBrief().teaching.icons.length, ICON_NAMES.length);
});

ok('the guide\'s room figures come from the validator, not from a second sum', () => {
  /* The figures said `open` holds twelve lines of paragraph when the
     validator refuses it well before that, because the guide did the
     arithmetic again instead of asking. Two sums of the same thing is
     how a guide starts lying to the agent reading it. */
  const g = slideGuide();
  for (const t of g.templates) {
    const n = t.paragraph_lines_total;
    // 0 is legal, and only for a template that has no paragraph at all
    assert.ok(n >= 1 || !TEMPLATES[t.name].blocks.includes('say'),
      `${t.name} claims room for ${n} lines and does have a paragraph`);
    /* Measured on the guide's OWN probe, imported rather than rebuilt.
       A check that builds its own probe is a second definition, and it
       found `portrait` failing at two lines only because its probe
       carried no photograph. */
    const at = (count) => {
      const one = probeSlide(t.name, count);
      return validateSlides({ slides: [one, one] }).ok;
    };
    /* A template with no paragraph reports 0, and the two assertions
       below do not apply to it: there is nothing to overflow, so every
       count "fits" and the figure could never be too low. */
    if (n === 0) {
      assert.ok(!TEMPLATES[t.name].blocks.includes('say'),
        `${t.name} claims no paragraph room and has a paragraph block`);
      continue;
    }
    assert.ok(at(n), `${t.name} claims ${n} lines and the validator refuses ${n}`);
    assert.ok(!at(n + 1),
      `${t.name} claims ${n} lines but ${n + 1} also fits, so the figure is low`);
  }
});

ok('a recap can list the longest carousel that is allowed to exist', () => {
  /* The one that matters, and the reason the cap is measured instead of
     chosen. A carousel runs to LIMITS.slides.max, and if the recap holds
     fewer than that there is a legal carousel it cannot list. Nothing
     tells the writer which lines to drop, so they drop some quietly,
     which is the worst outcome available. */
  assert.ok(RECAP_MAX.n >= LIMITS.slides.max,
    `a carousel may be ${LIMITS.slides.max} slides and a recap holds ${RECAP_MAX.n}`);
  assert.equal(LIMITS.recap.max, RECAP_MAX.n, 'the cap is not the measured ceiling');

  // and it is measured, not written down: it follows the metrics
  const items = (n) => Array.from({ length: n }, () => 'Read what Google says your hours');
  const slide = (n) => ({ ...recapBase(), recap: items(n) });
  assert.ok(validateSlides({ slides: [slide(RECAP_MAX.n), base()] }).ok,
    `${RECAP_MAX.n} lines is the measured ceiling and the validator refuses it`);
  assert.ok(!validateSlides({ slides: [slide(RECAP_MAX.n + 1), base()] }).ok,
    `${RECAP_MAX.n + 1} lines also fits, so the ceiling is low`);

  /* The lines share a budget rather than each taking a fixed pitch, so
     the block stays inside one band whatever it holds. At a fixed pitch
     ten lines took 0.490 of the sheet against four at 0.196, and the
     instruction went off the bottom. */
  const band = (n) => n * recapPitch(n);
  for (let n = 2; n <= RECAP_MAX.n; n++) {
    assert.ok(band(n) <= M.recap.budget * 1.06,
      `${n} recap lines take ${band(n).toFixed(3)} of a ${M.recap.budget} budget`);
  }
  assert.ok(band(RECAP_MAX.n) < RECAP_MAX.n * M.recap.pitch * 0.7,
    'the pitch is not tightening as the list grows');
  // and never past the point where it stops being readable
  assert.ok(recapPitch(RECAP_MAX.n) >= M.recap.size * 1.4,
    'the longest recap is set tighter than ordinary leading');
});

ok('engagement bait is refused, not just advised against', () => {
  /* It was a list in the guide, which held for as long as whoever was
     writing had read the guide. These are the lines every account posts. */
  for (const line of ['Save this for later.', 'Tag a friend who needs this.',
                      'Link in bio.', 'Follow for more like this.']) {
    const r = one({ action: line });
    assert.ok(!r.ok, `"${line}" was accepted as an instruction`);
    assert.match(r.problems.join(' '), /read THIS carousel/);
  }
  // and the replacements for the same jobs are not caught by it
  for (const line of ['Keep this. It is the list to run before you rebuild.',
                      'Send it to whoever built the site.']) {
    assert.ok(one({ action: line }).ok, `"${line}" was refused and should not be`);
  }
  const q = { question: 'Save this for later?', options: ['yes', 'no'] };
  assert.ok(!validateSlides({ slides: [
    { ...recapBase(), prompt: q, recap: ['one thing', 'another thing'] }, base()] }).ok,
    'bait in a prompt question was accepted');
});

ok('a prompt carries answers, because that is what makes it answerable', () => {
  const mk = (prompt) => validateSlides({ slides: [
    { ...recapBase(), prompt, recap: ['one thing', 'another thing'] }, base()] });
  assert.ok(!mk({ question: 'What did you find?' }).ok, 'no answers was accepted');
  assert.match(mk({ question: 'What did you find?' }).problems.join(' '), /cost a letter/);
  assert.ok(!mk({ question: 'What did you find?', options: ['a', 'b', 'c', 'd'] }).ok,
    'four answers was accepted');
  assert.ok(mk({ question: 'What did you find?', options: ['the phone', 'the form'] }).ok);
});

ok('a first slide that labels a topic instead of naming a thing is refused', () => {
  /* The fault: "Leads going nowhere" could sit on anybody's post about
     anything, so a scroller has to decode it at feed speed, which they
     do not do. Name the thing and hold back what it costs. */
  const opener = (title) => validateSlides({ slides: [{ ...base(), title }, base()] });
  for (const vague of ['Leads going nowhere', 'Fix your online presence',
                       'Growth is a system', 'Nothing looks broken',
                       // counting is not enough: "leaks" is still a metaphor
                       'Three quiet leaks', 'Unlock your potential',
                       // a concrete noun does not rescue an abstraction
                       'Your site presence', 'Better results, faster']) {
    const r = opener(vague);
    assert.ok(!r.ok, `"${vague}" was accepted`);
    assert.match(r.problems.join(' '), /label on a topic|describes the work/);
  }
  // named object, or something counted, and it passes
  for (const good of ['Your contact form emails nobody', 'Eleven fields before anyone asks',
                      'Your hours on Google are wrong', 'Three checks your site fails',
                      'Nobody sees your best photo', 'The phone audit']) {
    assert.ok(opener(good).ok, `"${good}" was refused`);
  }
  // and the refusal points at where the examples are
  assert.match(opener('Leads going nowhere').problems.join(' '), /design_brief/);
});

ok('a field the template has not got is refused, not silently dropped', () => {
  /* The failure this catches: Spark filed slides carrying its own
     invented fields — an ACTION DIRECTIVE label and a slide number — and
     every check passed. They were dropped at render, so the writer
     believed they were set and the sheet said otherwise. Silence is the
     worst answer here: a refusal naming the field is the only way it
     finds out. */
  const r = one({ actionDirective: 'AUDIT', slideNumber: '01 / 04' });
  assert.ok(!r.ok, 'invented fields were accepted');
  assert.match(r.problems.join(' '), /"actionDirective"/);
  assert.match(r.problems.join(' '), /"slideNumber"/);
  // and it says what the template DOES take, so the fix is in the refusal
  assert.match(r.problems.join(' '), /It takes .*chips.*say.*title/);
  // a note to a person is not a field and does not trip it
  assert.ok(one({ _name: 'the slow one' }).ok, '_name was refused');
});

ok('a template is a choice, not a starting point', () => {
  // dropping an optional block is fine; adding one the template has not
  // got is composing a layout, which is what templates exist to stop
  const added = one({ blocks: ['title', 'say', 'chips', 'icons', 'action', 'duo'] });
  assert.ok(!added.ok, 'a foreign block was accepted');
  assert.match(added.problems.join(' '), /has no "duo"/);
  assert.match(added.problems.join(' '), /do not add one/);

  const gutted = one({ blocks: ['say', 'action'] });
  assert.ok(!gutted.ok, 'a required block was dropped');
  assert.match(gutted.problems.join(' '), /needs/);
});

ok('a photograph is only snapped to an edge it was actually cut on', () => {
  /* The rule the whole placement table rests on, and the one that reads
     as a mistake the moment it slips: a straight cut against the sheet's
     edge is the frame, the same cut hanging mid-sheet is an amputation.
     Measured off the key, coverage of each border of its own frame:
       blue-flat    right 0.18, bottom 0.71
       sky-arms     bottom 0.38, nothing else
       phone-chair  nothing, on any side  */
  const CUT_ON = {
    'blue-flat': ['right', 'bottom'],
    'sky-arms': ['bottom'],
    'phone-chair': [],
  };
  for (const [name, cut] of Object.entries(CUT_ON)) {
    for (const context of ['cta', 'hook', 'middle']) {
      const p = placementOf(name, context);
      if (!p) continue;
      for (const side of ['left', 'right', 'top', 'bottom']) {
        if (!p.snap?.includes(side)) continue;
        assert.ok(cut.includes(side),
          `${name} is snapped ${side} in ${context} and is not cut on its ${side}`);
      }
      assert.ok(p.h > 0 && p.h < 1, `${name}/${context} has no subject height`);
      assert.ok(!('bleed' in p), `${name}/${context} still bleeds: nothing may be cut off`);
    }
  }
  // the one that takes no treatment must never be snapped to anything
  for (const c of ['cta', 'hook', 'middle']) {
    assert.ok(!placementOf('phone-chair', c)?.snap, `phone-chair is snapped in ${c}`);
  }
  assert.equal(CUTOUTS['phone-chair'].style, 'clean', 'phone-chair took a paper cut');
  assert.ok(!CUTOUTS['blue-flat'].style, 'blue-flat stopped being a scissors cut');
});

ok('the guide tells Spark how to use icons and pictures, not just that they exist', () => {
  const g = slideGuide();
  assert.ok(g.icons.rules.length >= 3, 'no rules for icons');
  assert.equal(g.icons.pack.length, ICON_NAMES.length);
  assert.ok(g.pictures.when && g.pictures.never, 'pictures have no when and no never');
  assert.match(JSON.stringify(g.pictures), /recognisable face/,
    'the likeness rule is missing from what Spark reads');
  for (const key of ['headline', 'paragraph', 'chips', 'duo', 'instruction']) {
    assert.ok(g.writing[key]?.length, `nothing written about ${key}`);
  }
});

console.log(`\n${pass} checks passed\n`);
