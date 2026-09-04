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
import { getCarousel, setSlides, uniqueSlug, parseJson } from './carousels.js';

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

  await setSlides(env.DB, carouselId, slides);
  await env.DB
    .prepare(`UPDATE carousels SET design_seed = ?1, updated_at = datetime('now') WHERE id = ?2`)
    .bind(checked.seed, carouselId)
    .run()
    .catch(() => {});     // a database that has not had the migration yet

  return { ok: true, slug, seed: checked.seed, plan: checked.plan, slides: slides.length };
}

/** Everything waiting for the studio to draw it, with its design. */
export async function designQueue(db) {
  const { results } = await db
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
    .catch(() => ({ results: [] }));

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
