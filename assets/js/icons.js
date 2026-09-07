/**
 * icons.js — the pack, named by MEANING rather than by shape, because
 * Spark picks these for a slide about page speed: "bolt" is choosable,
 * "row 2, column 1" is not.
 *
 * Sixteen transparent PNGs sliced off one 4x4 sheet. The pack's red sits
 * within a few points of the site's accent, so nothing is recoloured.
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

/** For the brief, not the tool schema: an enum says what MAY be written
    and nothing about what to write. */
export const iconCatalogue = () =>
  ICON_NAMES.map((n) => ({ name: n, means: ICONS[n].means }));
