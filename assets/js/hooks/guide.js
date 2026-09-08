/**
 * guide.js — the hook sheets, as something Spark can pick from.
 *
 * The sheets existed and were invisible: sixty-one built layouts, twelve
 * chosen, and no tool, no brief entry, nothing. Spark opened every
 * carousel on a teaching panel because a teaching panel was the only
 * thing it could name.
 *
 * A hook sheet is the FIRST slide and only the first. It is drawn by a
 * different renderer from the teaching panels — absolute measured boxes
 * off a reference, rather than a flowing column — which is why it can
 * carry his photograph cut out and snapped to an edge, and why its
 * copy budgets are per slot rather than per line.
 */

import { LAYOUTS } from './layouts.js';
import { CHOSEN, NOTES } from './chosen.js';
import { HOOK_BUDGETS } from './budgets.js';
import { FAMILIES } from './catalogue.js';

/** Which of his photographs a layout has been pinned to, if any. */
const ownOf = (spec) =>
  spec.slots.filter((s) => s.own).map((s) => s.own)[0] ?? null;

const artOf = (spec) => {
  const art = spec.slots.filter((s) => s.t === 'art');
  if (!art.length) return 'none: the type is the whole design';
  const roles = [...new Set(art.map((s) => s.role || s.id))];
  return roles.join(', ');
};

/**
 * Every chosen sheet, with what it is for and exactly what it takes.
 *
 * `slots` carries the measured ceiling for each one. A `shrink` slot sets
 * ONE line and shrinks to fit, so its number is hard: one character more
 * and the type comes out smaller than the sheet was designed at. A `wrap`
 * slot flows inside its box, so its number is the whole box.
 */
export const hookCatalogue = () => CHOSEN.map((id) => {
  const spec = LAYOUTS[id];
  if (!spec) return null;
  const budgets = HOOK_BUDGETS[id] ?? {};
  return {
    id,
    family: spec.family,
    family_is: FAMILIES[spec.family]?.what ?? '',
    does: spec.does,
    avoid: spec.avoid,
    picture: artOf(spec),
    ...(ownOf(spec) ? { his_photograph: ownOf(spec) } : {}),
    note: NOTES?.[id],
    slots: spec.slots.filter((s) => s.t === 'type').map((s) => ({
      name: s.id,
      wants: s.wants,
      characters: budgets[s.id] ?? null,
      sets: s.fit === 'wrap' ? 'wraps inside its box'
        : 'one line, shrunk to fit — the number is a hard ceiling',
    })),
  };
}).filter(Boolean);

export const HOW_TO_USE_A_HOOK = {
  what_it_is:
    'The first slide of a carousel and only the first. It is a poster: '
    + 'one idea, set large, with a picture that is part of the design '
    + 'rather than an illustration beside it. Everything after it is a '
    + 'teaching panel.',

  how_to_pick: [
    'Pick by what the carousel is doing, not by what looks good in the '
    + 'list. `does` says what each sheet is for and `avoid` says when it '
    + 'is the wrong one; the second is the more useful sentence.',
    'A sheet that names `his_photograph` is built around that exact '
    + 'picture, in that exact position. It is not a slot to fill with '
    + 'something else.',
    'Do not use the same sheet twice in a week. The set has twelve.',
  ],

  the_copy: [
    'Every slot has a measured ceiling in `characters`, taken off the '
    + 'real renderer rather than estimated. Over it, the type shrinks '
    + 'below the size the sheet was designed at and the sheet stops '
    + 'looking like the reference.',
    'A one-line slot is a hard ceiling. Write to about four fifths of it '
    + 'so a longer word later does not push it over.',
    'The headline rules are the same as a teaching slide: name the thing '
    + 'and hold back what it costs. See `opening`.',
  ],

  never: [
    'Do not invent a slot. A sheet takes the names listed and nothing '
    + 'else, and a name that is not there is refused rather than dropped.',
    'Do not put the instruction on the hook. The hook earns the swipe; '
    + 'the panels carry the work.',
    'Do not number it.',
  ],
};
