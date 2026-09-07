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

/**
 * The pixel set, keyed out of Ashley's reference sheets. Drawn the same
 * way as the kit and chosen the same way, by meaning.
 *
 * 17 more were extracted and are NOT here: Nintendo's mushroom,
 * Pusheen, a Tamagotchi, an Oreo, Chrome's dino and Microsoft's Windows
 * 95 set. They sit in assets/icons/pixel-flagged with the reasons in
 * SOURCES.md, because these posts are commercial and each of those is
 * somebody's mark.
 *
 * Six more were cut and thrown away, listed in SOURCES.md. An icon that
 * needs a caption to be recognised is not an icon.
 */
export const PIXEL = {
  arcade:       { means: 'an arcade cabinet: play, an old machine' },
  biscuit:      { means: 'a cookie, a treat, tracking' },
  card:         { means: 'a gamble, a bet, chance' },
  coin:         { means: 'money, what a thing costs or earns' },
  crt:          { means: 'an old computer, a legacy site, something dated' },
  cup:          { means: 'a coffee, an afternoon of work' },
  cursor:       { means: 'a click, a tap, somebody doing the thing' },
  'cursor-line':  { means: 'a click, outlined' },
  'folder-open':  { means: 'files, a project, something opened' },
  heart:        { means: 'a like, being liked, engagement' },
  joystick:     { means: 'steering something, hands-on control' },
  lives:        { means: 'three hearts: attempts left, chances' },
  loading:      { means: 'a progress bar: waiting, load time' },
  menu:         { means: 'a MENU button: navigation, the nav bar' },
  pad:          { means: 'a game controller: play, control, input' },
  plant:        { means: 'growth, tending something over time' },
  'sparkle-gold': { means: 'new, clean, just fixed' },
  start:        { means: 'a START button: begin here' },
  sunflower:    { means: 'growth, something planted paying off' },
};

export const PIXEL_NAMES = Object.keys(PIXEL);

/** Both packs, one lookup. Names do not collide. */
export const ALL_ICONS = { ...ICONS, ...PIXEL };
export const ICON_NAMES = Object.keys(ALL_ICONS);

/** Where the file lives, for both runtimes. */
export const iconUrl = (name) =>
  (name in PIXEL ? `/assets/icons/pixel/${name}.png` : `/assets/icons/kit/${name}.png`);

/** For the brief, not the tool schema: an enum says what MAY be written
    and nothing about what to write. */
export const iconCatalogue = () =>
  ICON_NAMES.map((n) => ({ name: n, means: ALL_ICONS[n].means }));
