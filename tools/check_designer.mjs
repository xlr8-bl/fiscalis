/**
 * check_designer.mjs — the design spec, its refusals, and its tools.
 *
 * The point of validating on the edge is that Spark finds out
 * immediately. So what is tested here is mostly the refusals: a spec
 * that cannot be drawn has to come back saying why, not get filed and
 * fail three hours later in a browser nobody has opened yet.
 *
 *   node tools/check_designer.mjs
 */

import {
  validateSpec, choose, usableDevices, hash, rng,
  GROUNDS, GROUND_NAMES, DEVICE_CATALOGUE, DEVICE_NAMES,
} from '../assets/js/design-spec.js';
import { TOOLS } from '../lib/mcp.js';

let failed = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { console.log(`  ok    ${name}`); return; }
  failed++;
  console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
};

const panel = (over = {}) => ({
  setup: 'They ordered eleven times.',
  payoff: ['You never', 'got their', 'name.'],
  body: ['The apps keep the customer.', 'No name, no email, no number.'],
  ...over,
});
const spec = (over = {}) => ({ title: 'Delivery apps', panels: [panel(), panel()], ...over });

console.log('\ngrounds');
for (const name of GROUND_NAMES) {
  const g = GROUNDS[name];
  ok(`${name} declares a ratio and a body flag`,
     typeof g.ratio === 'number' && typeof g.body === 'boolean');
  ok(`${name} body flag agrees with its ratio`,
     g.body === (g.ratio >= 7),
     `${g.ratio}:1 but body=${g.body}`);
}

console.log('\ndevices');
ok('every device declares what it needs',
   DEVICE_NAMES.every((n) => DEVICE_CATALOGUE[n].needs && DEVICE_CATALOGUE[n].what));
ok('statement is the only device that takes no body',
   DEVICE_NAMES.filter((n) => DEVICE_CATALOGUE[n].needs.body === false).join() === 'statement');
ok('a panel with body copy cannot reach statement',
   !usableDevices(panel()).includes('statement'));
ok('a panel without body copy reaches only statement',
   usableDevices({ setup: 'a', payoff: ['b'] }).join() === 'statement');
ok('photo needs a scene',
   !usableDevices(panel()).includes('photo')
   && usableDevices(panel(), { hasScene: true }).includes('photo'));

console.log('\ndeterminism');
const a = choose(panel(), 12345);
const b = choose(panel(), 12345);
ok('the same seed gives the same design', a.device === b.device && a.ground === b.ground);
ok('a different seed can give a different one',
   [1, 2, 3, 4, 5, 6, 7, 8].some((n) => choose(panel(), n).device !== a.device));
ok('hash is stable', hash('delivery-apps') === hash('delivery-apps'));
// draw both sequences up front: building the comparison array inside
// every() advances the second generator three extra times per iteration,
// which is what the first version of this test did
const r = rng(7);
const r2 = rng(7);
const first = [r(), r(), r()];
const again = [r2(), r2(), r2()];
ok('rng is reproducible', first.every((v, i) => v === again[i]));

console.log('\nrefusals');
ok('a good spec passes', validateSpec(spec()).ok);
ok('a payoff line over 22 characters is refused',
   !validateSpec(spec({ panels: [panel({ payoff: ['You never got their name at all'] }), panel()] })).ok);
ok('a setup over 44 characters is refused',
   !validateSpec(spec({ panels: [panel({ setup: 'x'.repeat(45) }), panel()] })).ok);
ok('body copy on a display-only ground is refused',
   !validateSpec(spec({ panels: [panel({ ground: 'red' }), panel()] })).ok);
ok('body copy on a body-carrying ground is fine',
   validateSpec(spec({ panels: [panel({ ground: 'navy' }), panel()] })).ok);
ok('an unknown device is refused',
   !validateSpec(spec({ panels: [panel({ device: 'collage' }), panel()] })).ok);
ok('one panel is not a carousel', !validateSpec(spec({ panels: [panel()] })).ok);
ok('eleven panels is past the ceiling',
   !validateSpec(spec({ panels: Array.from({ length: 11 }, () => panel()) })).ok);
ok('a missing title is refused', !validateSpec(spec({ title: '' })).ok);
ok('a refusal explains itself',
   validateSpec(spec({ panels: [panel({ ground: 'red' }), panel()] }))
     .errors.some((e) => e.includes('4.31')));

console.log('\nthe plan');
const planned = validateSpec(spec());
ok('every panel gets a device and a ground',
   planned.plan.length === 2 && planned.plan.every((p) => p.device && p.ground));
ok('no planned panel puts body copy on a ground that cannot hold it',
   planned.plan.every((p) => GROUNDS[p.ground].body));

console.log('\nmcp tools');
const byName = Object.fromEntries(TOOLS.map((t) => [t.name, t]));
for (const n of ['design_brief', 'design_carousel', 'design_status']) {
  ok(`${n} exists`, Boolean(byName[n]));
}
ok('every tool is annotated', TOOLS.every((t) => t.annotations));
ok('read-only tools say so',
   ['brief', 'queue', 'progress', 'performance', 'list_carousels',
    'design_brief', 'design_status'].every((n) => byName[n]?.annotations?.readOnlyHint === true));
ok('the writing tools are additive, not destructive',
   ['plan_carousel', 'deliver_slide', 'draw', 'add_reference', 'design_carousel']
     .every((n) => byName[n]?.annotations?.destructiveHint === false));
ok('post_due is still declared destructive',
   byName.post_due?.annotations?.destructiveHint === true);
ok('nothing claims to be read-only and destructive at once',
   TOOLS.every((t) => !(t.annotations.readOnlyHint && t.annotations.destructiveHint)));
ok('design_carousel takes panels, not slides',
   Boolean(byName.design_carousel?.inputSchema?.properties?.panels));

/*
 * The failure that actually happened in the field: the code shipped
 * before the database had the columns, D1 raised SQLITE_ERROR, and the
 * agent — given a raw driver error — decided the tool was broken and
 * went off and designed the slides itself in a chat canvas. So what is
 * tested here is not the SQL, it is what the agent is told.
 */
console.log('\na database that has not been set up');
{
  const missing = (sql) => {
    const err = new Error('D1_ERROR: table slides has no column named design: SQLITE_ERROR');
    return { prepare: () => ({ all: () => Promise.reject(err),
                               bind: () => ({ run: () => Promise.reject(err) }),
                               first: () => Promise.reject(err) }) };
  };
  const env = { DB: missing() };
  const { hasDesignColumns, MIGRATION_MESSAGE, designQueue } =
    await import('../lib/designer.js');

  ok('the missing columns are detected rather than thrown',
     (await hasDesignColumns(env)) === false);
  ok('the message tells a person what to press',
     /Set up/.test(MIGRATION_MESSAGE) && /studio/i.test(MIGRATION_MESSAGE));
  ok('the message does not leak SQLITE_ERROR',
     !/SQLITE|D1_ERROR/.test(MIGRATION_MESSAGE));
  const q = await designQueue(env.DB);
  ok('the queue says setup is needed rather than reporting nothing waiting',
     Boolean(q.setup_needed) && q.carousels.length === 0);
}

console.log('\nthe instructions');
{
  const { INSTRUCTIONS } = await import('../lib/mcp.js');
  ok('the agent is told not to design slides itself',
     /do not design a slide yourself/i.test(INSTRUCTIONS));
  ok('the agent is told not to render in a canvas',
     /canvas/i.test(INSTRUCTIONS));
  ok('design_carousel is named as the usual path',
     /design_carousel for each/i.test(INSTRUCTIONS));
}

console.log(failed ? `\n${failed} failed\n` : '\nall good\n');
process.exit(failed ? 1 : 0);
