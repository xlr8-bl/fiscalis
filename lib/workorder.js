/**
 * workorder.js — one call that says exactly what to make next.
 *
 * The problem this solves: everything Spark needs is written down
 * somewhere, and "write a carousel" leaves it to decide the pillar, the
 * shape, which hook sheet, which outro and which rail — five decisions
 * before a word is written, taken differently every time. So the sets
 * stopped looking like one set, and half of them opened on a teaching
 * panel because that was the first template in the list.
 *
 * The server takes those five. It knows what has gone out lately, so it
 * can rotate rather than repeat, which is the one thing a model with no
 * memory between sessions cannot do for itself.
 *
 * What is left to Spark is the part only it can do: the research and the
 * words.
 */

import { CHOSEN } from '../assets/js/hooks/chosen.js';
import { hookCatalogue } from '../assets/js/hooks/guide.js';
import { TEMPLATE_GUIDE, HOW_TO_OPEN, HOW_TO_CLOSE } from './slides/guide.js';
import { RESEARCH, SELF_CHECK, voiceRules } from '../assets/js/brand.js';

const HANDLE = '@web3ashley';
const SERIES = 'SITE CHECKS';

/** The outros, in the order they should be reached for. */
const OUTROS = ['bookend', 'recap', 'calling'];

/**
 * How to come at it, rotated separately from the pillar.
 *
 * A pillar says what the subject is; without an angle the same pillar
 * produces the same shape of post every time — here is a fault, here is
 * why, here is the check. Rotating both means two carousels from one
 * pillar do not read as the same post rewritten.
 */
const ANGLES = [
  { name: 'take one real thing apart',
    what: 'One page, one form, one listing, examined in public. Name it or '
        + 'describe it exactly; never a composite of several.' },
  { name: 'two ways, side by side',
    what: 'Two approaches to the same problem and which one wins, with the '
        + 'reason. The compare template is built for this.' },
  { name: 'something that changed',
    what: 'A real change with a date and a source: a browser default, a '
        + 'platform rule, a tool that arrived or died. What it means for a '
        + 'small business by the end. Never a prediction.' },
  { name: 'the thing everyone repeats that is wrong',
    what: 'A piece of received advice, why it is wrong, and what is true '
        + 'instead. Be specific about who says it and generous about why.' },
  { name: 'a number and what is behind it',
    what: 'One measured figure, traced to a named method, and what it means '
        + 'for somebody with one site and no technical background.' },
  { name: 'the checklist to run today',
    what: 'Three or four checks, each doable on a phone in a minute. The '
        + 'steps template is built for this.' },
];

/** What has gone out lately, so nothing repeats within the rotation. */
async function lately(db) {
  const { results } = await db
    .prepare(
      `SELECT c.slug, c.topic, c.pillar, s.design
       FROM carousels c LEFT JOIN slides s ON s.carousel_id = c.id AND s.position = 0
       WHERE c.status != 'rejected'
       ORDER BY COALESCE(c.posted_at, c.scheduled_for, c.updated_at) DESC
       LIMIT 20`
    )
    .all()
    .catch(() => ({ results: [] }));

  const rows = results ?? [];
  const hooks = [];
  for (const r of rows) {
    try {
      const d = JSON.parse(r.design || '{}');
      if (d.hook) hooks.push(d.hook);
    } catch { /* a row without a parseable design tells us nothing */ }
  }
  return {
    topics: rows.map((r) => r.topic).filter(Boolean),
    pillars: rows.map((r) => r.pillar).filter(Boolean),
    hooks,
  };
}

/**
 * The one used least recently. `used` is newest first, so a bigger index
 * means longer ago and absent means never — which wins outright.
 */
const leastRecent = (all, used) => {
  const age = (x) => { const i = used.indexOf(x); return i === -1 ? Infinity : i; };
  return all.reduce((best, x) => (age(x) > age(best) ? x : best), all[0]);
};

/**
 * @returns a work order: what to write about, in what shape, with which
 *   sheet and which outro, and the exact fields each one takes.
 */
export async function workOrder(db, { pillar = null, topic = null } = {}) {
  const { results: pillars } = await db
    .prepare('SELECT slug, name, brief FROM pillars WHERE active = 1 ORDER BY position, name')
    .all()
    .catch(() => ({ results: [] }));
  const all = pillars ?? [];
  const past = await lately(db);

  const chosenPillar = pillar
    ? all.find((p) => p.slug === pillar) ?? all[0]
    : all.find((p) => !past.pillars.includes(p.slug)) ?? all[0];

  const hook = leastRecent(CHOSEN, past.hooks);
  const sheet = hookCatalogue().find((h) => h.id === hook);
  const outro = OUTROS[past.topics.length % OUTROS.length];
  const angle = ANGLES[past.topics.length % ANGLES.length];

  const templates = TEMPLATE_GUIDE();
  const only = (names) => templates.filter((t) => names.includes(t.name));

  return {
    make: 'one carousel, six slides',
    about: topic
      ? { topic, angle: angle.name, angle_is: angle.what,
          note: 'The subject was named. Research it before writing.' }
      : {
          pillar: chosenPillar?.slug ?? null,
          pillar_is: chosenPillar?.brief ?? chosenPillar?.name ?? null,
          angle: angle.name,
          angle_is: angle.what,
          note: 'The pillar is the subject and the angle is how to come at '
              + 'it. Both are rotated, so a pillar you have used before '
              + 'should not produce the post you wrote last time.',
        },
    /* Every carousel, not only the ones that went out. A subject written
       this morning and still in review is exactly the one most likely to
       be written again this afternoon. */
    do_not_repeat: past.topics.slice(0, 20),
    and_do_not_narrow_to: [
      'page speed', 'contact forms', 'load times',
      'anything already in do_not_repeat',
    ],

    the_shape: [
      { slide: 1, use: 'hook', sheet: hook,
        why: 'A poster, not a panel. It earns the swipe and carries no instruction.' },
      { slide: 2, use: 'template', pick_from: ['open', 'reasons'] },
      { slide: 3, use: 'template', pick_from: ['reasons', 'steps', 'proof'] },
      { slide: 4, use: 'template', pick_from: ['steps', 'proof', 'compare'] },
      { slide: 5, use: 'template', pick_from: ['portrait', 'proof', 'reasons'] },
      { slide: 6, use: 'template', template: outro,
        why: 'The outro. One ask, written out of this carousel\'s own subject.' },
    ],

    the_rail: { handle: HANDLE, series: SERIES,
      note: 'The same on every teaching slide. A refusal follows if it changes.' },

    slide_1: sheet,
    templates_you_may_use: only([
      'open', 'reasons', 'steps', 'proof', 'compare', 'portrait', ...OUTROS,
    ]),

    the_rules_that_will_refuse_you: {
      opening: HOW_TO_OPEN,
      closing: HOW_TO_CLOSE.the_rule ?? HOW_TO_CLOSE,
      voice: voiceRules(),
      evidence: RESEARCH,
    },
    before_you_hand_over: SELF_CHECK,

    then: [
      'teach_carousel with all six slides. It validates before it writes, so '
      + 'a refusal costs nothing — read it, fix the copy, call it again.',
      'check_posting with the slug, to rehearse the post without making it.',
      'hand_over. A person draws, reviews and posts it; you do not.',
    ],
  };
}
