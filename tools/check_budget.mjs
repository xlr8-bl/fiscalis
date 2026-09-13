/**
 * check_budget.mjs — what one carousel costs Spark before it writes a word.
 *
 *   node tools/check_budget.mjs
 *
 * A carousel was timing out and burning a session's usage without
 * producing anything. Measured, the opening was:
 *
 *   design_brief    85,894 bytes   the design engine's brief, with the
 *                                  whole teaching catalogue and guide
 *                                  inlined inside it
 *   tools/list      21,454
 *   next_carousel   33,282
 *                  ---------
 *                  140,630 bytes, roughly 35,000 tokens, before the
 *                  first sentence was written.
 *
 * design_brief is a pointer now and the total is about 58,000. What has
 * NOT changed much is the opening pair, tools/list plus the work order: the
 * rules that lived in design_brief had to go somewhere and the work
 * order is the only road a teaching carousel is written on. That is the
 * honest number below, not a target that was hit.
 *
 * These ceilings are held by a test because a guide grows by one useful
 * paragraph at a time and nothing ever says stop. Four bytes a token is
 * the rough conversion throughout; it is not exact and does not need to
 * be, since what is being caught is a doubling.
 */

import assert from 'node:assert';
import { toolsFor } from '../lib/mcp.js';
import { workOrder, ANGLES } from '../lib/workorder.js';

const ANGLE_COUNT = ANGLES.length;
import { designBrief } from '../lib/designer.js';

let bad = 0;
const ok = (what, fn) => {
  try { fn(); console.log(`  ok   ${what}`); }
  catch (e) { bad++; console.log(`  FAIL ${what}\n       ${e.message}`); }
};
const okAsync = async (what, fn) => {
  try { await fn(); console.log(`  ok   ${what}`); }
  catch (e) { bad++; console.log(`  FAIL ${what}\n       ${e.message}`); }
};

const size = (x) => JSON.stringify(x).length;
const tokens = (n) => Math.round(n / 4);
const under = (what, got, ceiling) => {
  assert.ok(got <= ceiling,
    `${what} is ${got} bytes (~${tokens(got)} tokens), over the ${ceiling} ceiling`);
  console.log(`       ${what}: ${got} bytes, ~${tokens(got)} tokens`);
};

/** Nothing in the work order needs a real database to be measured. */
const emptyDb = {
  prepare: () => ({
    all: async () => ({ results: [] }),
    first: async () => null,
    bind: () => ({ all: async () => ({ results: [] }), first: async () => null }),
  }),
};

console.log('\nwhat arrives before the first sentence\n');

await okAsync('the tool list a carousel session gets', async () => {
  under('tools/list, carousel scope', size(toolsFor('carousel')), 23_000);
});

/**
 * The order rotates its angle, and each angle sends a different set of
 * arrangements in full, so one measurement is one angle. The ceiling is
 * against the heaviest of them.
 */
const heaviestOrder = async () => {
  let worst = 0;
  for (let i = 0; i < ANGLE_COUNT; i++) {
    // the angle is picked off how many topics are behind it
    const db = { ...emptyDb, prepare: (sql) => ({
      ...emptyDb.prepare(sql),
      all: async () => ({ results: /FROM carousels/.test(sql)
        ? Array.from({ length: i }, (_, n) => ({ topic: `t${n}` })) : [] }),
    }) };
    worst = Math.max(worst, size(await workOrder(db, {})));
  }
  return worst;
};

await okAsync('the work order, on whichever angle sends the most', async () => {
  under('next_carousel', await heaviestOrder(), 34_000);
});

await okAsync('and the two together, which is the real opening cost', async () => {
  under('the opening', size(toolsFor('carousel')) + await heaviestOrder(), 56_000);
});

console.log('\nwhat a retry costs\n');

ok('the schema paid again on every refused call', () => {
  const teach = toolsFor('carousel').find((t) => t.name === 'teach_carousel');
  under('teach_carousel', size(teach), 5_800);
});

await okAsync('the design brief, which is the OTHER engine and had this one inside it', async () => {
  /* 85,894 bytes: the teaching catalogue and the whole slide guide were
     inlined in the design engine's brief, so a carousel paid for both
     engines and then timed out. It is a pointer now. */
  under('design_brief', size(designBrief()), 5_000);
});

console.log('\nnothing was lost in the cutting\n');

await okAsync('every template is still reachable, named, and says what it is for', async () => {
  const order = await workOrder(emptyDb, {});
  const named = [
    ...(order.templates_you_may_use ?? []).map((t) => t.name),
    ...Object.keys(order.the_other_templates ?? {}),
  ];
  for (const want of ['open', 'reasons', 'steps', 'proof', 'compare', 'portrait',
                      'checklist', 'shot', 'annotated', 'chart', 'figure', 'numbers',
                      'define', 'quote', 'tools', 'roundup', 'myth', 'swap', 'signoff']) {
    assert.ok(named.includes(want), `${want} is not offered anywhere`);
  }
});

await okAsync('the fields a template takes are still findable', async () => {
  /* Factored out of all 23 templates into one list, which is where the
     duplication was. If the common list goes missing the per-template
     `and_also` is a lie by omission. */
  const order = await workOrder(emptyDb, {});
  const common = order.what_every_slide_takes;
  assert.ok(Array.isArray(common) && common.includes('ground') && common.includes('handle'),
            'the common field list is gone');
  const one = order.templates_you_may_use.find((t) => t.and_also);
  assert.ok(one, 'no template says which fields it adds');
  for (const f of one.and_also) {
    assert.ok(!common.includes(f), `${f} is in both lists`);
  }
});

await okAsync('the rules that refuse are still all stated', async () => {
  const order = await workOrder(emptyDb, {});
  const voice = order.the_rules_that_will_refuse_you.voice;
  for (const want of ['person', 'price', 'place', 'numbering', 'doable', 'banned']) {
    assert.ok(voice.rules[want], `the ${want} rule is gone`);
  }
  // said once, not once per rule
  assert.ok(voice.what_checked_means, 'the two verdicts are not explained anywhere');
});

console.log(bad ? `\n${bad} failed` : '\nthe opening cost is inside its budget');
process.exit(bad ? 1 : 0);
