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
import { ICON_NAMES } from '../assets/js/icons.js';
import { EXAMPLE_SLIDES } from '../lib/slides/examples.js';
import { slideGuide, probeSlide } from '../lib/slides/guide.js';
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

ok('the limits and the pack are stated once, not copied', () => {
  assert.equal(LIMITS.icons.max, 6);
  assert.equal(ICON_NAMES.length, 16);
  const b = designBrief();
  assert.equal(b.teaching.icons.length, ICON_NAMES.length,
    'the brief has its own idea of how many icons there are');
});

ok('the guide\'s room figures come from the validator, not from a second sum', () => {
  /* The figures said `open` holds twelve lines of paragraph when the
     validator refuses it well before that, because the guide did the
     arithmetic again instead of asking. Two sums of the same thing is
     how a guide starts lying to the agent reading it. */
  const g = slideGuide();
  for (const t of g.templates) {
    const n = t.paragraph_lines_total;
    assert.ok(n >= 1, `${t.name} claims room for ${n} lines`);
    /* Measured on the guide's OWN probe, imported rather than rebuilt.
       A check that builds its own probe is a second definition, and it
       found `portrait` failing at two lines only because its probe
       carried no photograph. */
    const at = (count) => {
      const one = probeSlide(t.name, count);
      return validateSlides({ slides: [one, one] }).ok;
    };
    assert.ok(at(n), `${t.name} claims ${n} lines and the validator refuses ${n}`);
    assert.ok(!at(n + 1),
      `${t.name} claims ${n} lines but ${n + 1} also fits, so the figure is low`);
  }
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
