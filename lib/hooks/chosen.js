/**
 * chosen.js — the hooks Ashley picked, and the only ones that ship.
 *
 * Sixty-one layouts were built off the reference sheets. He went through
 * the ones carrying his own photographs and marked thirteen. The rest
 * are scrapped: still in layouts.js, because git keeps them either way
 * and a layout is cheaper to un-scrap than to rebuild, but out of the
 * corpus. Nothing renders them and nothing offers them to Spark.
 *
 * Every one of these is a carousel's FIRST page, which is what a hook
 * is. They carry the handle and the swipe cue that no other page does.
 */

export const CHOSEN = [
  'h004', 'h005', 'h006', 'h009', 'h012',
  'h020', 'h024', 'h028', 'h030',
  'h035', 'h051', 'h054',
  'h077',
];

/** What he asked for on three of them, kept here so it is not folklore. */
export const NOTES = {
  h006: 'Photograph mirrored and taken to the left edge of the sheet. It was '
      + 'floating in the middle of its own box.',
  h024: 'Was a question, a figure and nothing else, which is restraint at '
      + 'reference size and an empty poster at posting size. Now carries the '
      + 'answer as a caption beside the figure, a floor rule and the series.',
  h051: 'Photograph mirrored, stood on the floor rule and moved to the left, '
      + 'scaled to fill that side. `pin: false` on the slot, because the '
      + 'layout has decided where this one goes and the automatic corner '
      + 'pinning must not fight it.',
};

export const isChosen = (id) => CHOSEN.includes(id);
