/**
 * design-spec.js — what a carousel design is, with no way to draw one.
 *
 * The generator runs in a browser, because rasterising type needs a
 * canvas. The validator has to run in the Worker, because a spec Spark
 * files must be refused at the door rather than three hours later when
 * somebody opens the studio. Those are two different runtimes, and the
 * one thing they must not disagree about is the rules.
 *
 * So everything that is a fact rather than a drawing lives here: the
 * grounds and their measured contrast, what each device needs before it
 * can be chosen, the seeded choice, and the validation. No DOM, no
 * canvas, no imports. assets/js/generate.js draws from it and
 * lib/designer.js checks against it, and neither owns it.
 */

/* ------------------------------------------------------------ grounds */

/**
 * `ratio` is measured WCAG contrast of mark on ground. `body` says
 * whether that is enough to set a paragraph in — the hot red is 4.31:1,
 * which carries display type and will not carry body copy, and
 * darkening it until it does turns it to brick.
 */
export const GROUNDS = {
  /* Warm cream, not the cool near-white it was: the reference corpus is
     printed on cream and #EFEDE7 read grey beside it. The accent moved
     with it — a hotter red-orange holds against cream where the old cool
     red went muddy. Ratios recomputed, not guessed. */
  paper: { ground: '#F2ECE0', mark: '#14120F', accent: '#D93B0F', photo: '#14120F', ratio: 15.89, body: true },
  ink:   { ground: '#14120F', mark: '#F2ECE0', accent: '#F26A1B', photo: '#F2ECE0', ratio: 15.89, body: true },
  red:   { ground: '#D93B0F', mark: '#1A0A05', accent: '#F2ECE0', photo: '#1A0A05', ratio: 4.62, body: false },
  blue:  { ground: '#1B3FB8', mark: '#F2ECE0', accent: '#EFC22B', photo: '#F2ECE0', ratio: 7.29, body: true },
  navy:  { ground: '#1E2F55', mark: '#F2ECE0', accent: '#EFC22B', photo: '#F2ECE0', ratio: 11.21, body: true },
  amber: { ground: '#EFC22B', mark: '#14120F', accent: '#1B3FB8', photo: '#14120F', ratio: 11.06, body: true },
};

export const GROUND_NAMES = Object.keys(GROUNDS);

/* ------------------------------------------------------------ devices */

/**
 * What each device is and what it requires. `body: false` means the
 * device sets no paragraph, which is what makes it the only kind that
 * can sit on a display-only ground.
 *
 * The descriptions are here because they are also what Spark reads when
 * it decides what shape a panel should be, and a description that lives
 * beside the rule cannot drift from it.
 */
export const DEVICE_CATALOGUE = {
  field:     { needs: { body: true }, what: 'A whole colour field with the hook set on it. The default.' },
  statement: { needs: { body: false }, what: 'One sentence at display size and nothing else. The only device that fits a display-only ground.' },
  object:    { needs: { body: true }, what: 'The hook with an interface object under it — a phone, a map pack, a spreadsheet, a receipt.' },
  figure:    { needs: { body: true, cutout: true }, what: 'The hook with a screened cut-out figure bled off the corner.' },
  photo:     { needs: { body: true, scene: true }, what: 'A photograph filling the frame with the type on it, darkened by measurement until it reads.' },
  list:      { needs: { body: true, rows: 3 }, what: 'A numbered list of things to do. Needs rows.' },
  chart:     { needs: { body: true, bars: 2 }, what: 'Bars drawn to scale from real numbers. Needs bars.' },
  quad:      { needs: { body: true, cells: 4 }, what: 'Four cells with one picked out. Needs exactly four cells.' },
};

export const DEVICE_NAMES = Object.keys(DEVICE_CATALOGUE);

/* ------------------------------------------------------------ seeding */

/** mulberry32. Small, fast, and identical in both runtimes. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a, so a slug can seed a carousel the same way everywhere. */
export function hash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];

/** Which devices this content can actually support. */
export function usableDevices(panel, { hasScene = false, hasCutout = false } = {}) {
  return DEVICE_NAMES.filter((name) => {
    const n = DEVICE_CATALOGUE[name].needs;
    const hasBody = Array.isArray(panel.body) && panel.body.length > 0;
    if (n.body === true && !hasBody) return false;
    if (n.body === false && hasBody) return false;
    if (n.rows && !(panel.rows?.length >= n.rows)) return false;
    if (n.bars && !(panel.bars?.length >= n.bars)) return false;
    if (n.cells && !(panel.cells?.length >= n.cells)) return false;
    if (n.scene && !hasScene) return false;
    if (n.cutout && !hasCutout) return false;
    return true;
  });
}

/**
 * Pick the design for one panel. Pure, deterministic, and the single
 * definition both runtimes use — the browser to draw, the Worker to say
 * in advance what will be drawn.
 */
export function choose(panel, seed, opts = {}) {
  const usable = usableDevices(panel, opts);
  if (!usable.length) return null;
  const r = rng(seed);

  const device = panel.device && usable.includes(panel.device)
    ? panel.device : pick(r, usable);

  const wantsBody = DEVICE_CATALOGUE[device].needs.body !== false;
  const grounds = GROUND_NAMES.filter((g) => (wantsBody ? GROUNDS[g].body : true));
  const ground = panel.ground && grounds.includes(panel.ground)
    ? panel.ground : pick(r, grounds);

  return { device, ground, seed };
}

/* --------------------------------------------------------- validating */

const MAX_PANELS = 10;
const MIN_PANELS = 2;
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;

/**
 * Check a spec before anything is drawn from it.
 *
 * Returns { ok, errors, plan }. `plan` says, panel by panel, which
 * device and ground the seed will land on, so Spark can be told what it
 * is going to get rather than finding out afterwards.
 *
 * The rules that are refused rather than warned about are the ones a
 * render cannot recover from: a payoff long enough that it can only be
 * set below the size a feed can read, a paragraph on a ground measured
 * too low to carry one, and a panel no device can take.
 */
export function validateSpec(spec, { hasScene = false, hasCutout = false } = {}) {
  const errors = [];
  const panels = Array.isArray(spec?.panels) ? spec.panels : [];

  if (!isStr(spec?.title)) errors.push('title is required');
  if (panels.length < MIN_PANELS) errors.push(`a carousel needs at least ${MIN_PANELS} panels`);
  if (panels.length > MAX_PANELS) errors.push(`${MAX_PANELS} panels is Instagram's ceiling`);

  const base = Number.isInteger(spec?.seed) ? spec.seed : hash(spec?.slug || spec?.title || 'web3ashley');
  const plan = [];

  panels.slice(0, MAX_PANELS).forEach((p, i) => {
    const at = `panel ${i + 1}`;
    if (!isStr(p?.setup)) errors.push(`${at}: setup is required`);
    if (!Array.isArray(p?.payoff) || !p.payoff.length) {
      errors.push(`${at}: payoff must be one or more lines`);
    } else {
      // the payoff is set to the full measure; a line this long can only
      // be fitted by dropping below what a feed can read
      const longest = p.payoff.reduce((n, l) => Math.max(n, String(l).length), 0);
      if (longest > 22) {
        errors.push(`${at}: payoff line of ${longest} characters is too long to set large; break it or shorten it`);
      }
      if (p.payoff.length > 4) errors.push(`${at}: more than four payoff lines will not fit`);
    }
    if (isStr(p?.setup) && p.setup.length > 44) {
      errors.push(`${at}: setup of ${p.setup.length} characters is too long for the run-up line`);
    }

    if (p?.device && !DEVICE_NAMES.includes(p.device)) {
      errors.push(`${at}: unknown device "${p.device}"`);
    }
    if (p?.ground && !GROUND_NAMES.includes(p.ground)) {
      errors.push(`${at}: unknown ground "${p.ground}"`);
    }
    const hasBody = Array.isArray(p?.body) && p.body.length > 0;
    if (p?.ground && GROUNDS[p.ground] && GROUNDS[p.ground].body === false && hasBody) {
      errors.push(`${at}: ${p.ground} measures ${GROUNDS[p.ground].ratio}:1 and cannot carry body copy`);
    }

    const chosen = choose(p ?? {}, base + i * 977, { hasScene, hasCutout });
    if (!chosen) {
      errors.push(`${at}: no device can carry this content`);
    } else {
      plan.push({ position: i, ...chosen });
    }
  });

  return { ok: errors.length === 0, errors, plan, seed: base };
}
