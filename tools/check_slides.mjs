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
import { validateSlides, PER_LINE, LIMITS } from '../lib/slides/spec.js';
import { TEMPLATES, TEMPLATE_NAMES, BLOCKS, SLIDE_GROUND_NAMES } from '../assets/js/slides.js';
import { ICON_NAMES, ICONS, PIXEL_NAMES, iconUrl } from '../assets/js/icons.js';
import { EXAMPLE_SLIDES } from '../lib/slides/examples.js';
import { slideGuide, probeSlide } from '../lib/slides/guide.js';
import { CUTOUTS, placementOf } from '../lib/slides/cutouts.js';
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
