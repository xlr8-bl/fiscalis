/**
 * designer.js — the design half of the pipeline, on the edge.
 *
 * Spark files a design spec: the words, panel by panel, and optionally
 * which device or ground it wants. This checks the spec against the
 * rules, works out what each panel will be made of, and stores it. The
 * drawing happens later in the studio, on a canvas, the same way
 * typeset.js already works and for the same reason — rasterising type in
 * a Worker means shipping a WASM renderer and the font files inside the
 * bundle, and nothing can post until a person opens the studio anyway.
 *
 * What is new is that the spec is refused at the door rather than three
 * hours later. validateSpec() runs here, against the same table the
 * browser draws from, so a payoff too long to set large or a paragraph
 * on the display-only red comes back as an error Spark can act on while
 * it still has the context to fix it.
 *
 * The credential ceiling is unchanged. This writes plans and slides in
 * the making states; it cannot approve, schedule, post or delete, and
 * the state machine in carousels.js is what enforces that, not this.
 */

import { validateSpec, DEVICE_CATALOGUE, GROUNDS, hash } from '../assets/js/design-spec.js';
import { slideCatalogue } from '../assets/js/slides.js';
import { slideGuide } from './slides/guide.js';
import { validateSlides } from './slides/spec.js';
import { recent, repeats } from './repeats.js';
import { CHOSEN } from '../assets/js/hooks/chosen.js';
import { getCarousel, setSlides, uniqueSlug, parseJson } from './carousels.js';

/**
 * The design columns arrived after the first release, so a database that
 * predates them raises "no column named design" from deep inside D1.
 *
 * That error reaching the agent as-is is useless to it: it is a schema
 * problem a person fixes in ten seconds, not a spec problem the agent
 * can do anything about. So it is caught and turned into the sentence
 * that actually helps, which matters more here than anywhere else in
 * this file — an agent given SQLITE_ERROR will conclude the tool is
 * broken and go and make the pictures itself, which is exactly what we
 * are trying to stop.
 */
const NEEDS_MIGRATION =
  'This database does not have the design columns yet. Open the studio and '
  + 'press Set up — it takes a few seconds and needs no terminal. '
  + '(Or run migrations/005_design_specs.sql against D1.) '
  + 'Nothing is lost; file the same spec again afterwards.';

const isMissingColumn = (err) =>
  /no column named (design|design_seed)|no such column: ?s?\.?design/i.test(String(err?.message ?? err));

/**
 * Does this database have the design columns?
 *
 * Asked before anything is written, so a database that has not been set
 * up yet is reported rather than left with a carousel row and no slides
 * under it. Cheap: it reads one row and looks at the shape of it.
 */
export async function hasDesignColumns(env) {
  try {
    await env.DB.prepare('SELECT design FROM slides LIMIT 1').all();
    await env.DB.prepare('SELECT design_seed FROM carousels LIMIT 1').all();
    return true;
  } catch (err) {
    if (isMissingColumn(err)) return false;
    throw err;
  }
}

export const MIGRATION_MESSAGE = NEEDS_MIGRATION;

/** How many scene photographs and cut-outs the site has to draw with. */
export async function palette(env) {
  const scenes = [];
  const cutouts = [];
  try {
    const { results } = await env.DB
      .prepare(`SELECT media_key, role FROM brand_refs WHERE active = 1`)
      .all();
    for (const r of results ?? []) {
      (r.role === 'likeness' ? cutouts : scenes).push(r.media_key);
    }
  } catch { /* a deployment without the table yet */ }
  return { scenes, cutouts };
}

/**
 * The catalogue Spark reads before it writes a spec: what devices exist,
 * what each needs, which grounds can carry body copy and which cannot.
 *
 * It is generated from the tables rather than written out, so it cannot
 * describe a device that no longer exists or miss one that was added.
 */
export function designBrief() {
  return {
    frame: { width: 1024, height: 1280, note: '4:5 — Instagram\'s tallest feed carousel, inside TikTok\'s 1080 cap.' },
    devices: Object.entries(DEVICE_CATALOGUE).map(([name, d]) => ({
      name,
      what: d.what,
      needs: d.needs,
    })),
    grounds: Object.entries(GROUNDS).map(([name, g]) => ({
      name,
      contrast: `${g.ratio}:1`,
      body: g.body,
      note: g.body ? 'can carry a paragraph'
                   : 'display type only — a paragraph on this is refused',
    })),
    writing: {
      setup: 'The first half of the sentence, at most 44 characters. It exists to move the eye into the payoff.',
      payoff: 'The second half, broken into up to 4 lines of at most 22 characters. Set as large as the panel allows, so a long line is refused rather than shrunk.',
      body: 'Two or three lines of about 48 characters. Omit it entirely to use the statement device on a display-only ground.',
      voice: 'Second person, present tense, a command or a question. Third-person findings are true and inert.',
    },
    /*
     * A pointer, not the other engine's whole brief.
     *
     * The teaching catalogue and guide used to be inlined here, which
     * made this one tool call 86KB — around twenty-one thousand tokens
     * spent before a word was written, on top of the work order and the
     * tool list. That is where the carousels were timing out. The choice
     * between the two engines still belongs here; everything after the
     * choice belongs to whichever one was picked.
     */
    teaching: {
      use_when: 'The post explains something: a check somebody can run, why a '
              + 'thing goes wrong, what two options actually differ by. A hook '
              + 'sheet stops a scroll; a teaching slide explains something to '
              + 'somebody who has already stopped.',
      then: 'Call `next_carousel`. It picks the subject, the angle and the hook '
          + 'sheet, and sends the arrangements that angle needs with their copy '
          + 'budgets. Do not read this brief for it; they are different engines.',
      tool: 'teach_carousel',
      never: 'Give a coordinate. The geometry is measured and yours to fill, '
           + 'not to invent.',
    },
    rules: [
      'A payoff line over 22 characters is refused: it could only be set below the size a feed can read.',
      'Body copy on a display-only ground is refused, not warned about.',
      'The device and ground are chosen from the seed unless you name them. Naming neither is normal.',
      'The same spec and seed always produce the same set. Change the seed to re-roll.',
    ],
  };
}

/**
 * Check a spec and say what it will produce, without producing anything.
 *
 * This is what makes the loop cheap: Spark can file, read the plan, and
 * fix a refusal in the same turn, instead of discovering at render time
 * that panel three could never have worked.
 */
export async function planDesign(env, spec) {
  const { scenes, cutouts } = await palette(env);
  const checked = validateSpec(spec, {
    hasScene: scenes.length > 0,
    hasCutout: cutouts.length > 0,
  });
  return {
    ...checked,
    plan: checked.plan.map((p) => ({
      ...p,
      ground_contrast: `${GROUNDS[p.ground].ratio}:1`,
      carries_body: GROUNDS[p.ground].body,
    })),
    assets: { scenes: scenes.length, cutouts: cutouts.length },
  };
}

/**
 * Store a validated spec as slides ready for the studio to draw.
 *
 * The design travels in the slide's `design` column as JSON. `prompt` is
 * left alone: it belongs to the image-model path, and a slide is drawn
 * by one route or the other, never both.
 */
export async function fileDesign(env, spec, { carouselId, slug }) {
  const checked = await planDesign(env, spec);
  if (!checked.ok) return { ok: false, errors: checked.errors };

  const panels = spec.panels.slice(0, 10);
  const slides = panels.map((p, i) => ({
    kind: i === 0 ? 'hook' : (i === panels.length - 1 ? 'cta' : 'slide'),
    copy: [p.setup, ...(p.payoff ?? [])].filter(Boolean).join(' '),
    prompt: '',
    design: JSON.stringify({
      ...p,
      ...checked.plan[i],
      seed: checked.seed + i * 977,
    }),
  }));

  try {
    await setSlides(env.DB, carouselId, slides);
    await env.DB
      .prepare(`UPDATE carousels SET design_seed = ?1, updated_at = datetime('now') WHERE id = ?2`)
      .bind(checked.seed, carouselId)
      .run()
      .catch((err) => { if (!isMissingColumn(err)) throw err; });
  } catch (err) {
    if (isMissingColumn(err)) return { ok: false, errors: [NEEDS_MIGRATION] };
    throw err;
  }

  return { ok: true, slug, seed: checked.seed, plan: checked.plan, slides: slides.length };
}

/** Everything waiting for the studio to draw it, with its design. */
export async function designQueue(db) {
  const got = await db
    .prepare(
      `SELECT c.slug AS carousel, c.title, c.status, c.design_seed,
              s.position, s.kind, s.copy, s.design, s.state, s.note
       FROM slides s JOIN carousels c ON c.id = s.carousel_id
       WHERE s.state IN ('pending', 'redo', 'failed')
         AND s.design <> ''
         AND c.status IN ('planned', 'generating', 'changes')
       ORDER BY c.created_at, s.position`
    )
    .all()
    .catch((err) => {
      if (isMissingColumn(err)) return { results: [], migrate: true };
      throw err;
    });
  // the flag was computed and then dropped by destructuring in the first
  // version of this, which turned "your database needs setting up" into
  // "there is nothing waiting"
  if (got.migrate) return { carousels: [], setup_needed: NEEDS_MIGRATION };
  const results = got.results;

  const byCarousel = new Map();
  for (const row of results ?? []) {
    if (!byCarousel.has(row.carousel)) {
      byCarousel.set(row.carousel, {
        carousel: row.carousel, title: row.title, status: row.status,
        seed: row.design_seed, panels: [],
      });
    }
    byCarousel.get(row.carousel).panels.push({
      position: row.position, kind: row.kind, state: row.state,
      note: row.note || null, design: parseJson(row.design, {}),
    });
  }
  return { carousels: [...byCarousel.values()] };
}

/** What has been drawn, what has not, and what the checks said. */
export async function designStatus(db, slug) {
  const row = await getCarousel(db, slug);
  if (!row) return null;
  const panels = (row.slides ?? []).map((s) => ({
    position: s.position,
    state: s.state,
    drawn: Boolean(s.media_key),
    design: parseJson(s.design, null),
    findings: parseJson(s.qc, null)?.findings ?? null,
  }));
  return {
    carousel: row.slug,
    status: row.status,
    seed: row.design_seed ?? hash(row.slug),
    drawn: panels.filter((p) => p.drawn).length,
    total: panels.length,
    waiting_on_studio: panels.some((p) => !p.drawn),
    panels,
  };
}


/**
 * File a teaching carousel: named templates, copy per block.
 *
 * It rides the same `slides.design` column the hook path uses, marked
 * `engine: 'slides'`, so everything downstream — the queue, the redo
 * loop, the per-slide feedback — keeps working without a second table
 * and a second set of state rules to get wrong. The studio looks at that
 * mark and draws with slides.js instead of compose.js.
 */
export async function fileTeaching(env, spec, { carouselId, slug }) {
  const checked = validateSlides(spec);
  if (!checked.ok) return { ok: false, errors: checked.problems };

  /*
   * A carousel opens on a hook SHEET and ends on an outro. Asked for
   * three times, written into the instructions and into next_carousel,
   * and still every set came back six teaching panels — so it is a
   * refusal now rather than a request. The shape is the format, not a
   * preference: a panel as slide one is a page of a document with no
   * cover, and `close` as slide six is another paragraph rather than an
   * ending.
   */
  const given = spec.slides ?? [];
  const shape = [];
  if (given.length && !given[0].hook) {
    shape.push(
      'Slide 1 has to be a hook SHEET, not a teaching template. It is the only '
      + 'slide most people see and it is a poster, not a panel. next_carousel '
      + 'names which sheet to use and sends it in full; `template` returns any '
      + 'of the other eleven by id, with the slots it takes.'
    );
  }
  /* The two things a model with no memory between sessions repeats:
     the sheet it used last time and the subject it wrote last time.
     next_carousel rotates both and hands over do_not_repeat, and that
     is an instruction — which has not been enough for the hook sheet,
     the outro or the location. Checked against the database instead. */
  const before = await recent(env.DB);
  shape.push(...repeats(
    { hook: given[0]?.hook, topic: spec.topic ?? spec.title },
    before,
    CHOSEN,
  ));

  if (shape.length) return { ok: false, errors: shape };

  const list = spec.slides.slice(0, 10);
  const slides = list.map((slide, i) => ({
    kind: i === 0 ? 'hook' : (i === list.length - 1 ? 'cta' : 'slide'),
    /* `copy` is what a person reads in the studio's list and what the
       brand check runs over, so it has to be the words, not the spec.
       A hook sheet's words live in its own named slots. */
    copy: (slide.hook
      ? Object.entries(slide).filter(([k, v]) =>
          typeof v === 'string' && !['hook', 'handle', 'series', 'ground'].includes(k))
        .map(([, v]) => v)
      : [slide.title, slide.say, slide.say2, ...(slide.chips ?? []), slide.action])
      .filter(Boolean).join(' '),
    prompt: '',
    /* Which renderer draws it. The studio branches on this: a hook sheet
       goes to compose.js with its absolute measured boxes, everything
       else to the flowing column in slides.js. */
    design: JSON.stringify(slide.hook
      ? { engine: 'hooks', ...slide }
      : { engine: 'slides', ...slide }),
  }));

  try {
    await setSlides(env.DB, carouselId, slides);
  } catch (err) {
    if (isMissingColumn(err)) return { ok: false, errors: [NEEDS_MIGRATION] };
    throw err;
  }
  return { ok: true, slug, plan: checked.plan, slides: slides.length };
}

/** Check a teaching spec without filing it. */
export const planTeaching = (spec) => validateSlides(spec);
