/**
 * check_draw.mjs — which slides an image model is allowed near.
 *
 *   node tools/check_draw.mjs
 *
 * `drawCarousel` had no test at all, which is how this survived: it
 * picked every pending slide and handed it to the image model, without
 * ever looking at whether the slide carried a `design`.
 *
 * A slide with a design is a teaching panel or a hook sheet. It is drawn
 * on a canvas in the studio — measured geometry, real type, his
 * photograph cut out — and needs no model.
 *
 * With nothing bound, sending one to a model surfaced as "Workers AI is
 * not bound" on a carousel that never needed it. That is the confusing
 * outcome and it is the harmless one. The expensive outcome is the other
 * way round: with a model bound, every panel comes back a wordless AI
 * picture, gets written over the design, and is marked drawn. So what is
 * checked here is not the error message but that the model is never
 * reached.
 */

import assert from 'node:assert';
import { drawCarousel } from '../lib/draw.js';

let bad = 0;
const okAsync = async (what, fn) => {
  try { await fn(); console.log(`  ok   ${what}`); }
  catch (e) { bad++; console.log(`  FAIL ${what}\n       ${e.message}`); }
};

/** A carousel and its slides, enough for getCarousel to read back. */
const fakeEnv = (slides, drew) => ({
  SITE: 'https://web3ashley.com',
  MEDIA: { put: async () => {}, get: async () => null },
  AI: {
    run: async () => {
      drew.push('the model was called');
      // a 1x1 PNG is enough; nothing here looks at the bytes
      return { image: 'iVBORw0KGgo=' };
    },
  },
  DB: {
    prepare: (sql) => ({
      bind: () => ({
        first: async () => (/FROM carousels/.test(sql)
          ? { id: 1, slug: 'the-form', status: 'review', title: 'T' } : null),
        all: async () => ({
          results: /FROM slides/.test(sql) ? slides
            : /brand_refs/.test(sql) ? []
            : [],
        }),
        run: async () => ({}),
      }),
      first: async () => (/FROM carousels/.test(sql)
        ? { id: 1, slug: 'the-form', status: 'review', title: 'T' } : null),
      all: async () => ({ results: [] }),
      run: async () => ({}),
    }),
  },
});

const panel = (position) => ({
  id: position + 1, position, kind: 'slide', copy: 'Words.', prompt: '',
  media_key: '', ground_key: '', state: 'pending',
  design: JSON.stringify({ engine: 'slides', template: 'reasons', title: 'A' }),
});

const picture = (position) => ({
  id: position + 1, position, kind: 'slide', copy: 'Words.',
  prompt: 'a quiet desk', media_key: '', ground_key: '', state: 'pending',
  design: null,
});

console.log('\nwhat an image model is allowed near\n');

await okAsync('a teaching carousel never reaches the model at all', async () => {
  const drew = [];
  const out = await drawCarousel(fakeEnv([panel(0), panel(1), panel(2)], drew),
                                 'the-form', { provider: 'workers' });
  assert.equal(drew.length, 0, 'the model was called on a designed slide');
  assert.equal(out.drawn, 0);
  assert.equal(out.not_for_this_tool, 3);
});

await okAsync('and it says a person draws those, rather than reporting a failure',
  async () => {
    const out = await drawCarousel(fakeEnv([panel(0), panel(1)], []), 'the-form',
                                   { provider: 'workers' });
    assert.ok(!out.error, `it failed instead of explaining: ${out.error}`);
    assert.match(out.note, /studio/);
    assert.match(out.note, /canvas/);
    // and names what this tool IS for, so the next call is not the same one
    assert.match(out.note, /generated picture/);
  });

await okAsync('with nothing bound it still does not mention the model', async () => {
  /* The whole confusion: "Workers AI is not bound" on a carousel that
     never needed it. The binding is irrelevant to this carousel and the
     answer must not mention it. */
  const env = fakeEnv([panel(0), panel(1)], []);
  delete env.AI;
  const out = await drawCarousel(env, 'the-form', { provider: 'workers' });
  assert.ok(!/Workers AI/i.test(JSON.stringify(out)),
            'it still blames the missing binding');
});

await okAsync('a picture carousel still draws, which is what the tool is for',
  async () => {
    const drew = [];
    const out = await drawCarousel(fakeEnv([picture(0), picture(1)], drew),
                                   'the-form', { provider: 'workers' });
    assert.equal(drew.length, 2, `the model was called ${drew.length} times`);
    assert.equal(out.drawn, 2);
  });

await okAsync('a mixed carousel draws only the pictures and says what it left',
  async () => {
    const drew = [];
    const out = await drawCarousel(fakeEnv([picture(0), panel(1), panel(2)], drew),
                                   'the-form', { provider: 'workers' });
    assert.equal(drew.length, 1, 'it drew a designed slide');
    assert.equal(out.drawn, 1);
    assert.equal(out.left_for_the_studio, 2);
  });

await okAsync('naming a designed slide by position does not force it either', async () => {
  /* `positions` skips the state filter, so it was the other way in. */
  const drew = [];
  await drawCarousel(fakeEnv([panel(0), panel(1)], drew), 'the-form',
                     { provider: 'workers', only: [0, 1] });
  assert.equal(drew.length, 0, 'asking by position reached the model');
});

console.log('\nand the fork is not offered at all\n');

await okAsync('the image-model path is out of the default scope', async () => {
  /* Spark was told which path was the old one and called it anyway,
     which is this project's one recurring lesson. Out of scope is the
     refusal. Neither tool is deleted: both answer under `everything`. */
  const { CAROUSEL_TOOLS, TOOLS } = await import('../lib/mcp.js');
  for (const gone of ['plan_carousel', 'draw']) {
    assert.ok(!CAROUSEL_TOOLS.includes(gone), `${gone} is still in the default scope`);
    assert.ok(TOOLS.some((t) => t.name === gone), `${gone} was deleted rather than moved`);
  }
  // and the one road is still there
  assert.ok(CAROUSEL_TOOLS.includes('teach_carousel'));
  assert.ok(CAROUSEL_TOOLS.includes('hand_over'));
});

await okAsync('and nothing tells Spark to take it', async () => {
  const { INSTRUCTIONS } = await import('../lib/mcp.js');
  assert.ok(!/plan_carousel then draw/.test(INSTRUCTIONS),
            'the instructions still advertise the older path');
  assert.match(INSTRUCTIONS, /ONE road/);
});

console.log(bad
  ? `\n${bad} failed`
  : '\na measured panel is never handed to an image model');
process.exit(bad ? 1 : 0);
