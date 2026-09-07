/**
 * icons.js — Ashley's icon pack, named by what each one means.
 *
 * Sixteen cut-outs from one supplied sheet, sliced on its own 4x4 grid
 * and squared so every one draws into the same box. They are real
 * transparent PNGs, not glyphs: the pack is 73% alpha, which is why they
 * sit on cream and on a photograph equally well.
 *
 * WHY THEY ARE NAMED FOR MEANING RATHER THAN FOR SHAPE. Spark picks
 * these, and it picks them for a slide about page speed or about being
 * ignored. "bolt" and "eye" are choosable; "row 2, column 1" is not.
 * The `means` line is what it reads, so a wrong pick is a wrong sentence
 * rather than a wrong lookup.
 *
 * THE ACCENT IS ALREADY OURS. The pack's red-orange sits within a few
 * points of the site's #D93B0F, so nothing is recoloured. An icon that
 * had to be tinted to belong would stop being a photograph of an object
 * and start being a shape, which is the whole reason the pack works.
 */

export const ICONS = {
  orbit:   { means: 'a site, the web, something live and worldwide' },
  click:   { means: 'a click, a tap, somebody actually doing the thing' },
  browser: { means: 'a page in a browser, a visit, a link out' },
  folder:  { means: 'files, a project, something being added to' },
  bolt:    { means: 'speed, or the lack of it. Load time, a fast fix' },
  server:  { means: 'hosting, a database, the machinery underneath' },
  target:  { means: 'who it is for, aim, a goal being hit or missed' },
  rise:    { means: 'growth, a number going up over time' },
  message: { means: 'an enquiry, a reply, being contacted' },
  eye:     { means: 'views, being seen, being looked at and not read' },
  code:    { means: 'the build itself, markup, what is under the design' },
  no:      { means: 'the wrong way, a mistake, what not to do' },
  idea:    { means: 'the insight, the thing worth knowing' },
  shout:   { means: 'promotion, announcing, being loud about something' },
  chart:   { means: 'a measurement, evidence, a figure you can point at' },
  ring:    { means: 'a cycle, doing it again, something that repeats' },
};

export const ICON_NAMES = Object.keys(ICONS);

/** Where the file lives, for both runtimes. */
export const iconUrl = (name) => `/assets/icons/kit/${name}.png`;

/**
 * The catalogue as Spark reads it, one line each.
 *
 * It goes in the design brief rather than in the tool schema: an enum of
 * sixteen names tells an agent what it MAY write and nothing about what
 * to write, and picking an icon is a judgement about the sentence it
 * sits under.
 */
export const iconCatalogue = () =>
  ICON_NAMES.map((n) => ({ name: n, means: ICONS[n].means }));
