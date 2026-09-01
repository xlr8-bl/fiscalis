/**
 * draw.js — turning a planned carousel into drawn slides.
 *
 * One call for the whole carousel, which is the difference between a day
 * of automation and a day of round trips. Before this, Spark had to
 * generate each picture in its own chat and carry it back as base64, per
 * slide, per carousel, five times a day. Now it plans in words and says
 * "draw it", and the site does the drawing with the brand kit that never
 * leaves it.
 *
 * Only slides that need it: `pending` because they were never drawn, and
 * `redo` because a person asked for that one again. A slide already
 * `ready` is left alone, so asking for one again does not cost the nine
 * that were right — the same rule the whole feedback loop is built on.
 */

import { drawSlide, costOf } from './imagen.js';
import { paintGround, MODEL as PAINT_MODEL } from './paint.js';
import { getCarousel } from './carousels.js';

const MAX_REFS = 10;   // what the kit is for; more is averaging, not steering

/** The brand kit as bytes, ready to hand to the model. */
async function kit(env, { limit = MAX_REFS } = {}) {
  const { results } = await env.DB
    .prepare(
      `SELECT r.media_key, r.role FROM brand_refs r
       WHERE r.active = 1 ORDER BY r.role, r.position`
    )
    .all();

  const out = [];
  for (const row of (results ?? []).slice(0, limit)) {
    const object = await env.MEDIA.get(row.media_key);
    if (!object) continue;              // a reference whose file is gone
    out.push({
      bytes: new Uint8Array(await object.arrayBuffer()),
      mime: object.httpMetadata?.contentType || 'image/jpeg',
      role: row.role,
    });
  }
  return out;
}

/**
 * Draw what a carousel still needs.
 *
 * Sequential rather than parallel: five slides at once is five times the
 * rate limit and, on a failure, no way to say which ones were already
 * paid for. One at a time is slower and reports honestly.
 */
export async function drawCarousel(
  env, slug, { only = null, fetcher, key, model, provider = 'gemini', runner } = {}
) {
  const free = provider === 'workers';
  const carousel = await getCarousel(env.DB, slug);
  if (!carousel) return { error: `No carousel called ${slug}.` };
  if (!['planned', 'generating', 'changes', 'review'].includes(carousel.status)) {
    return { error: `That carousel is "${carousel.status}". Slides can only be drawn while it is being made.` };
  }
  if (!env.MEDIA) return { error: 'No R2 bucket is bound on this deployment.' };

  const wanted = carousel.slides.filter(
    (s) => (only ? only.includes(s.position) : s.state === 'pending' || s.state === 'redo')
  );
  if (!wanted.length) {
    return { slug, drawn: 0, note: 'Every slide is already drawn. Ask for one again to redraw it.' };
  }

  // the kit steers a likeness, which only the paid path can use: Flux
  // Schnell takes a prompt and nothing else, so fetching ten images from
  // R2 to send nowhere is only a slower way to draw the same picture
  const refs = free ? [] : await kit(env);
  const drawn = [];
  const failed = [];

  for (const slide of wanted) {
    const brief = { prompt: slide.prompt, copy: slide.copy, kind: slide.kind };
    const out = free
      ? await paintGround(env, { slide: brief, model, runner })
      : await drawSlide(env, { key, model, fetcher, slide: brief, refs });

    if (out.error) {
      failed.push({ position: slide.position, error: out.error });
      await env.DB
        .prepare(
          `UPDATE slides SET state = 'failed', note = ?2, attempts = attempts + 1,
                             updated_at = datetime('now') WHERE id = ?1`
        )
        .bind(slide.id, String(out.error).slice(0, 1000))
        .run();
      continue;
    }

    const ext = out.mime === 'image/png' ? '.png' : out.mime === 'image/webp' ? '.webp' : '.jpg';
    const key2 = `carousels/${carousel.slug}/${String(slide.position).padStart(2, '0')}`
               + `-${crypto.randomUUID().slice(0, 8)}${ext}`;

    await env.MEDIA.put(key2, out.bytes, {
      httpMetadata: { contentType: out.mime, cacheControl: 'public, max-age=31536000, immutable' },
    });
    await env.DB
      .prepare(
        `INSERT OR REPLACE INTO media (key, filename, content_type, bytes, width, height, alt)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
      )
      .bind(key2, `${carousel.slug}-${slide.position}${ext}`, out.mime, out.bytes.byteLength,
            1024, 1280, String(slide.copy || '').slice(0, 400))
      .run();
    /*
     * On the paid path this picture is the slide, so it is finished.
     *
     * On the free path it is only the background: Flux draws no type, so
     * the copy still has to be set over it, which happens in the studio
     * where the fonts and a canvas already are. Until then the slide
     * stays `pending` and carries its ground. Calling it ready would let
     * a carousel with no words on it reach approval looking complete.
     *
     * Its size is left at 0 for the same reason. The finished slide is
     * measured in the browser at the moment it is uploaded, and a size
     * recorded here would be a claim about an image that does not exist
     * yet.
     */
    if (free) {
      await env.DB
        .prepare(
          `UPDATE slides SET ground_key = ?1, state = 'pending', note = '',
                             attempts = attempts + 1, updated_at = datetime('now')
           WHERE id = ?2`
        )
        .bind(key2, slide.id)
        .run();
    } else {
      // 1024x1280 is what 1K at 4:5 comes back as. It is recorded because
      // approval checks the size, and a slide with no size passes both
      // platform checks by being unknown and then fails at its slot.
      await env.DB
        .prepare(
          `UPDATE slides SET media_key = ?1, width = 1024, height = 1280, state = 'ready',
                             note = '', attempts = attempts + 1, updated_at = datetime('now')
           WHERE id = ?2`
        )
        .bind(key2, slide.id)
        .run();
    }
    drawn.push({ position: slide.position, bytes: out.bytes.byteLength });
  }

  if (drawn.length && carousel.status === 'planned') {
    await env.DB
      .prepare(`UPDATE carousels SET status = 'generating', updated_at = datetime('now') WHERE id = ?1`)
      .bind(carousel.id)
      .run();
  }

  const after = await getCarousel(env.DB, carousel.slug);
  const left = after.slides.filter((s) => s.state !== 'ready');

  // what it cost, said out loud. On the paid path a run that quietly
  // draws twelve slides is money spent without anyone deciding to spend
  // it; on the free path the honest answer is that it was free.
  const drewWith = drawn.length ? (model || (free ? PAINT_MODEL : null)) : null;
  const spent = drawn.length && !free && drewWith ? costOf(drewWith, drawn.length) : null;

  // slides needing type are not "left to draw" — the picture is paid for
  // and done. They are waiting on a canvas, which is a different problem
  // with a different answer, so it is reported as its own number.
  const needType = after.slides.filter((s) => s.ground_key && !s.media_key).length;
  const undrawn = left.length - needType;

  return {
    slug: carousel.slug,
    drawn: drawn.length,
    slides: drawn,
    ...(failed.length ? { failed } : {}),
    ...(drewWith ? { model: drewWith } : {}),
    ...(free ? { cost_usd: 0, free: true } : {}),
    ...(spent === null ? {} : { cost_usd: Number(spent.toFixed(3)) }),
    references_used: refs.length,
    slides_left: left.length,
    ...(needType ? { awaiting_type: needType } : {}),
    next: needType
      ? `${needType} background(s) drawn — a person opens the carousel in the studio `
        + 'and the copy is set over them there'
      : undrawn > 0
      ? `${undrawn} slide(s) still to draw — call draw again, or deliver_slide by hand`
      : 'ready for hand_over',
  };
}
