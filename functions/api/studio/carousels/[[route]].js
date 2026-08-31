/**
 * /api/studio/carousels/* — the social pipeline.
 *
 * Studio-only. Nothing here is rendered by a public route; this is the
 * back of the house, where Spark files what it made and a person says
 * yes, no, or do that one again.
 *
 * What a person uses:
 *
 *   GET    /api/studio/carousels                     -> the board
 *   GET    /api/studio/carousels/:slug               -> one, with its slides
 *   POST   /api/studio/carousels    { title, … }     -> start one by hand
 *   PUT    /api/studio/carousels/:slug { caption, … }
 *   POST   /api/studio/carousels/:slug/status { status, feedback }
 *   POST   /api/studio/carousels/:slug/schedule { slot, at }
 *   POST   /api/studio/carousels/:slug/slides/:pos/redo { note }
 *   DELETE /api/studio/carousels/:slug
 *   GET    /api/studio/carousels/-/pillars           -> the pillars
 *   PUT    /api/studio/carousels/-/pillars  { pillars: [...] }
 *   GET    /api/studio/carousels/-/refs              -> the brand kit
 *   PUT    /api/studio/carousels/-/refs     { refs: [...] }
 *
 * What Spark uses, over its bearer token:
 *
 *   GET    /api/studio/carousels/-/brief             -> pillars, kit, recent
 *   GET    /api/studio/carousels/-/queue             -> what needs work
 *   POST   /api/studio/carousels    { …, slides: [] } -> file a plan
 *   PUT    /api/studio/carousels/:slug/slides/:pos   (multipart) -> an image
 *   POST   /api/studio/carousels/:slug/status { status: 'review', qc }
 *
 * `-` stands in for a slug on the collection-level routes, so a carousel
 * can never be named in a way that shadows one of them.
 */

import { json } from '../../../../lib/respond.js';
import { identify } from '../../../../lib/auth.js';
import { SITE } from '../../../../lib/templates.js';
import {
  listCarousels, getCarousel, setSlides, agentQueue, brief,
  uniqueSlug, slugify, mayMove, agentMayTouchCarousel,
  MIN_SLIDES, MAX_SLIDES, SLOTS,
} from '../../../../lib/carousels.js';
import { problems as platformProblems, INSTAGRAM } from '../../../../assets/js/platforms.js';
import { send as sendMail } from '../../../../lib/mail.js';
import { gather, compose } from '../../../../lib/digest.js';

const MAX_FIELD = 400;
const MAX_TEXT = 8_000;
// Instagram's own cap is 2200 characters including the hashtags. Storing
// more than the strictest destination accepts only defers the failure to
// the moment it was supposed to post, so it is refused at the field.
const MAX_CAPTION = INSTAGRAM.maxCaption;
const MAX_IMAGE = 25 * 1024 * 1024;   // a 4K master, before any derivative
// The master is kept in whatever it arrives as — Instagram wants JPEG and
// says so at approval, where it can still be fixed, rather than here where
// a rejected upload loses the take.
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const clean = (v, max = MAX_FIELD) => String(v ?? '').trim().slice(0, max);
const today = () => new Date().toISOString().slice(0, 10);

/** JSON in, JSON out — but never a column full of something unparseable. */
const asJson = (v) => {
  if (v === undefined || v === null || v === '') return '';
  try { return JSON.stringify(v).slice(0, 40_000); } catch { return ''; }
};

export async function onRequest({ request, env, params }) {
  if (!env.DB) return json({ error: 'The database is not configured yet.' }, 503);

  const seg = (Array.isArray(params.route) ? params.route : [params.route]).filter(Boolean);
  const method = request.method.toUpperCase();

  const who = await identify(request, env);
  if (!who) return json({ error: 'Not signed in.' }, 401);
  const agent = who.kind === 'agent';

  /** The agent may read and make; approving, scheduling and deleting are ours. */
  const people = (action) =>
    agent
      ? json({ error: `The agent token cannot ${action}. A person has to do that.` }, 403)
      : null;

  const [first, ...rest] = seg.map(String);

  /* ------------------------------------------------------ collection routes */
  if (first === '-') {
    const what = rest[0] || '';

    if (what === 'brief' && method === 'GET') {
      return json(await brief(env.DB, { site: SITE }));
    }

    if (what === 'queue' && method === 'GET') {
      return json(await agentQueue(env.DB));
    }

    /*
     * The one mail a day. Spark asks for it when the batch is actually
     * ready rather than a clock firing while the images are still
     * rendering — which is also why nothing here is scheduled.
     *
     * GET previews it without sending, so the wording can be checked
     * without waiting for a real batch.
     */
    if (what === 'digest') {
      if (method === 'GET') {
        const mail = compose(await gather(env.DB), SITE);
        return json({ ...mail, configured: Boolean(env.RESEND_API_KEY) });
      }
      if (method === 'POST') {
        const { force } = await request.json().catch(() => ({}));
        const mail = compose(await gather(env.DB), SITE);
        // a mail that says "nothing" trains you to stop opening them
        if (!mail.count && !force) {
          return json({ sent: false, reason: 'Nothing is waiting on a person.', count: 0 });
        }
        const out = await sendMail(env, {
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
        });
        return json({ ...out, count: mail.count, subject: mail.subject }, out.sent ? 200 : 502);
      }
    }

    if (what === 'pillars') {
      if (method === 'GET') {
        const { results } = await env.DB
          .prepare('SELECT slug, name, brief, position, active FROM pillars ORDER BY position, name')
          .all();
        return json({ pillars: results ?? [] });
      }
      if (method === 'PUT') {
        const denied = people('change the pillars');
        if (denied) return denied;
        const { pillars } = await request.json().catch(() => ({}));
        if (!Array.isArray(pillars)) return json({ error: 'Send { pillars: [...] }.' }, 400);

        // replace wholesale: the list is short, and an edit that renames one
        // and drops another is a single intent, not three requests
        await env.DB.prepare('DELETE FROM pillars').run();
        const rows = pillars.slice(0, 40).filter((p) => clean(p.name));
        if (rows.length) {
          const stmt = env.DB.prepare(
            `INSERT INTO pillars (slug, name, brief, position, active)
             VALUES (?1, ?2, ?3, ?4, ?5)`
          );
          await env.DB.batch(
            rows.map((p, i) =>
              stmt.bind(slugify(p.slug || p.name), clean(p.name), clean(p.brief, MAX_TEXT),
                        i, p.active === false ? 0 : 1)
            )
          );
        }
        return json({ ok: true, pillars: rows.length });
      }
    }

    if (what === 'refs') {
      if (method === 'GET') {
        const { results } = await env.DB
          .prepare(
            `SELECT r.id, r.media_key, r.role, r.position, r.note, r.active,
                    m.filename, m.width, m.height
             FROM brand_refs r LEFT JOIN media m ON m.key = r.media_key
             ORDER BY r.role, r.position`
          )
          .all();
        return json({
          refs: (results ?? []).map((r) => ({ ...r, url: `/media/${r.media_key}` })),
        });
      }
      if (method === 'PUT') {
        const denied = people('change the brand kit');
        if (denied) return denied;
        const { refs } = await request.json().catch(() => ({}));
        if (!Array.isArray(refs)) return json({ error: 'Send { refs: [...] }.' }, 400);

        await env.DB.prepare('DELETE FROM brand_refs').run();
        // a picture can only be a reference once, whatever the caller sent
        const seen = new Set();
        const rows = refs
          .filter((r) => r.media_key && !seen.has(r.media_key) && seen.add(r.media_key))
          .filter((r) => r.role === 'likeness' || r.role === 'aesthetic')
          .slice(0, 40);
        if (rows.length) {
          const stmt = env.DB.prepare(
            `INSERT INTO brand_refs (media_key, role, position, note, active)
             VALUES (?1, ?2, ?3, ?4, ?5)`
          );
          await env.DB.batch(
            rows.map((r, i) =>
              stmt.bind(String(r.media_key), r.role, i, clean(r.note),
                        r.active === false ? 0 : 1)
            )
          );
        }
        return json({ ok: true, refs: rows.length });
      }
    }

    return json({ error: 'Unknown endpoint.' }, 404);
  }

  /* ------------------------------------------------------------------ list */
  if (!first && method === 'GET') {
    const status = new URL(request.url).searchParams.get('status');
    return json({ carousels: await listCarousels(env.DB, { status }) });
  }

  /* ---------------------------------------------------------------- create */
  if (!first && method === 'POST') {
    const input = await request.json().catch(() => ({}));
    const title = clean(input.title) || clean(input.topic) || 'Untitled carousel';
    const slug = await uniqueSlug(env.DB, input.slug || title);

    const slides = Array.isArray(input.slides) ? input.slides : [];
    if (agent && slides.length && slides.length < MIN_SLIDES) {
      return json({ error: `A carousel needs at least ${MIN_SLIDES} slides.` }, 400);
    }

    await env.DB
      .prepare(
        `INSERT INTO carousels (slug, pillar, title, topic, research, caption,
                                hashtags, status, targets, qc, author, last_editor)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)`
      )
      .bind(
        slug,
        slugify(input.pillar || '') === 'carousel' ? '' : clean(input.pillar),
        title,
        clean(input.topic, MAX_TEXT),
        asJson(input.research),
        clean(input.caption, MAX_CAPTION),
        clean(input.hashtags, MAX_TEXT),
        'planned',
        clean(Array.isArray(input.targets) ? input.targets.join(',') : input.targets)
          || 'instagram,facebook,tiktok',
        asJson(input.qc),
        who.name
      )
      .run();

    const created = await env.DB
      .prepare('SELECT id FROM carousels WHERE slug = ?1')
      .bind(slug)
      .first();
    const n = await setSlides(env.DB, created.id, slides);

    return json({ slug, status: 'planned', slides: n }, 201);
  }

  if (!first) return json({ error: 'Method not allowed.' }, 405);

  /* ------------------------------------------------------------------- one */
  const slug = first;
  const existing = await getCarousel(env.DB, slug);
  if (!existing) return json({ error: 'No carousel with that slug.' }, 404);

  const action = rest[0] || null;

  if (!action && method === 'GET') return json({ carousel: existing });

  /* ---------------------------------------------------------------- update */
  if (!action && method === 'PUT') {
    if (agent && !agentMayTouchCarousel(existing)) {
      return json({ error: 'The agent token cannot edit this carousel.' }, 403);
    }
    const input = await request.json().catch(() => ({}));
    const keep = (given, current, max) =>
      given === undefined ? current : clean(given, max);

    await env.DB
      .prepare(
        `UPDATE carousels SET title = ?1, pillar = ?2, topic = ?3, caption = ?4,
                              hashtags = ?5, targets = ?6, research = ?7,
                              last_editor = ?9, updated_at = datetime('now')
         WHERE id = ?8`
      )
      .bind(
        keep(input.title, existing.title),
        keep(input.pillar, existing.pillar),
        keep(input.topic, existing.topic, MAX_TEXT),
        keep(input.caption, existing.caption, MAX_CAPTION),
        keep(input.hashtags, existing.hashtags, MAX_TEXT),
        input.targets === undefined
          ? existing.targets.join(',')
          : clean(Array.isArray(input.targets) ? input.targets.join(',') : input.targets),
        input.research === undefined ? asJson(existing.research) : asJson(input.research),
        existing.id,
        who.name
      )
      .run();

    // slides are only replaced when they are actually sent, so a caption
    // edit cannot quietly wipe ten generated images
    if (Array.isArray(input.slides)) {
      await setSlides(env.DB, existing.id, input.slides);
    }
    return json({ ok: true, slug });
  }

  /* ---------------------------------------------------------------- status */
  if (action === 'status' && method === 'POST') {
    const input = await request.json().catch(() => ({}));
    const to = String(input.status || '');
    if (!mayMove(who.kind, existing.status, to)) {
      return json(
        { error: `Cannot move this from ${existing.status} to ${to || '(nothing)'}.` },
        400
      );
    }
    // approving something whose slides are not all there is how a half-made
    // batch reaches an audience, so it is refused rather than warned about
    if (to === 'approved') {
      const bad = existing.slides.filter((s) => s.state !== 'ready');
      if (existing.slides.length < MIN_SLIDES) {
        return json({ error: `Only ${existing.slides.length} slides — needs ${MIN_SLIDES}.` }, 400);
      }
      if (bad.length) {
        return json(
          { error: `${bad.length} slide${bad.length > 1 ? 's are' : ' is'} not ready yet.` },
          400
        );
      }
      if (!existing.caption) return json({ error: 'Write a caption first.' }, 400);

      // What the platforms themselves will refuse, checked here rather
      // than at the slot — a batch that fails at the moment it was due to
      // go out has already missed the slot, with nobody watching.
      const wrong = platformProblems(existing);
      if (wrong.length) return json({ error: wrong[0], problems: wrong }, 400);
    }

    await env.DB
      .prepare(
        `UPDATE carousels SET status = ?1, feedback = ?2, qc = ?3,
                              last_editor = ?5, updated_at = datetime('now')
         WHERE id = ?4`
      )
      .bind(
        to,
        input.feedback === undefined ? existing.feedback : clean(input.feedback, MAX_TEXT),
        input.qc === undefined ? asJson(existing.qc) : asJson(input.qc),
        existing.id,
        who.name
      )
      .run();

    return json({ ok: true, slug, status: to });
  }

  /* -------------------------------------------------------------- schedule */
  if (action === 'schedule' && method === 'POST') {
    const denied = people('schedule a post');
    if (denied) return denied;
    if (existing.status !== 'approved' && existing.status !== 'scheduled') {
      return json({ error: 'Approve it first.' }, 400);
    }
    const input = await request.json().catch(() => ({}));
    const slot = Number(input.slot);
    if (!Number.isInteger(slot) || slot < 1 || slot > SLOTS) {
      return json({ error: `Slot must be 1 to ${SLOTS}.` }, 400);
    }
    const at = clean(input.at, 40);
    if (at && Number.isNaN(Date.parse(at))) {
      return json({ error: 'That time is not a date I can read.' }, 400);
    }
    // two posts in one slot is one of them silently not going out
    const clash = await env.DB
      .prepare(
        `SELECT slug FROM carousels
         WHERE slot = ?1 AND id != ?2 AND status IN ('scheduled', 'posted')
           AND substr(COALESCE(scheduled_for, ''), 1, 10) = ?3`
      )
      .bind(slot, existing.id, (at || '').slice(0, 10) || today())
      .first();
    if (clash) return json({ error: `Slot ${slot} that day is taken by ${clash.slug}.` }, 409);

    await env.DB
      .prepare(
        `UPDATE carousels SET slot = ?1, scheduled_for = ?2, status = 'scheduled',
                              last_editor = ?4, updated_at = datetime('now')
         WHERE id = ?3`
      )
      .bind(slot, at || null, existing.id, who.name)
      .run();
    return json({ ok: true, slug, slot, scheduled_for: at || null, status: 'scheduled' });
  }

  /* ---------------------------------------------------------------- slides */
  if (action === 'slides') {
    const pos = Number(rest[1]);
    if (!Number.isInteger(pos)) return json({ error: 'Which slide?' }, 400);
    const slide = existing.slides.find((s) => s.position === pos);
    if (!slide) return json({ error: `No slide at position ${pos}.` }, 404);
    const verb = rest[2] || null;

    // a person asks for one again — this is the whole feedback loop
    if (verb === 'redo' && method === 'POST') {
      const denied = people('ask for a slide again');
      if (denied) return denied;
      const { note } = await request.json().catch(() => ({}));
      await env.DB
        .prepare(
          `UPDATE slides SET state = 'redo', note = ?1, updated_at = datetime('now')
           WHERE id = ?2`
        )
        .bind(clean(note, MAX_TEXT), slide.id)
        .run();
      // the carousel follows the slide, so Spark's queue picks it up
      if (existing.status === 'review' || existing.status === 'approved') {
        await env.DB
          .prepare(
            `UPDATE carousels SET status = 'changes', last_editor = ?2,
                                  updated_at = datetime('now') WHERE id = ?1`
          )
          .bind(existing.id, who.name)
          .run();
      }
      return json({ ok: true, position: pos, state: 'redo' });
    }

    // Spark delivers the image for one slide
    if (!verb && method === 'PUT') {
      if (agent && !agentMayTouchCarousel(existing)) {
        return json({ error: 'The agent token cannot edit this carousel.' }, 403);
      }
      if (!env.MEDIA) return json({ error: 'No R2 bucket is bound.' }, 503);

      const form = await request.formData().catch(() => null);
      const file = form?.get('file');
      if (!file || typeof file === 'string') return json({ error: 'No file.' }, 400);
      if (file.size > MAX_IMAGE) return json({ error: 'Larger than 25MB.' }, 413);
      if (!IMAGE_TYPES.has(file.type)) {
        return json({ error: `Unsupported type: ${file.type || 'unknown'}` }, 415);
      }

      const ext = file.type === 'image/png' ? '.png' : file.type === 'image/webp' ? '.webp' : '.jpg';
      const key = `carousels/${slug}/${String(pos).padStart(2, '0')}-${crypto.randomUUID().slice(0, 8)}${ext}`;
      const int = (v) => Math.max(0, Math.min(50_000, Number(v) || 0));
      const width = int(form.get('width'));
      const height = int(form.get('height'));

      await env.MEDIA.put(key, file.stream(), {
        httpMetadata: {
          contentType: file.type,
          cacheControl: 'public, max-age=31536000, immutable',
        },
      });
      // the master is listed like any other upload, so it can be picked and
      // deleted through the library rather than being invisible in the bucket
      await env.DB
        .prepare(
          `INSERT OR REPLACE INTO media (key, filename, content_type, bytes,
                                         width, height, alt)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
        )
        .bind(key, `${slug}-${pos}${ext}`, file.type, file.size, width, height,
              clean(form.get('alt') ?? slide.copy, 400))
        .run();

      // the agent's own check on this slide, if it sent one. A field it
      // filled with something unparseable must not take down the upload
      // that already put the bytes in R2.
      let slideQc = existing.slides.find((s) => s.position === pos)?.qc;
      if (form.get('qc') != null) {
        try { slideQc = JSON.parse(String(form.get('qc'))); } catch { slideQc = { raw: clean(form.get('qc'), 2000) }; }
      }

      // the previous master is not deleted: a regeneration you dislike has
      // to be recoverable, and R2 is cheap next to losing the better take
      await env.DB
        .prepare(
          `UPDATE slides SET media_key = ?1, width = ?2, height = ?3,
                             state = 'ready', note = '', qc = ?5,
                             attempts = attempts + 1, updated_at = datetime('now')
           WHERE id = ?4`
        )
        .bind(key, width, height, slide.id, asJson(slideQc))
        .run();

      // the first image moves the carousel out of planning on its own
      if (existing.status === 'planned') {
        await env.DB
          .prepare(`UPDATE carousels SET status = 'generating', updated_at = datetime('now') WHERE id = ?1`)
          .bind(existing.id)
          .run();
      }
      return json({ ok: true, position: pos, key, url: `/media/${key}`, state: 'ready' }, 201);
    }

    return json({ error: 'Method not allowed.' }, 405);
  }

  /* ---------------------------------------------------------------- delete */
  if (!action && method === 'DELETE') {
    const denied = people('delete a carousel');
    if (denied) return denied;
    await env.DB.prepare('DELETE FROM slides WHERE carousel_id = ?1').bind(existing.id).run();
    await env.DB.prepare('DELETE FROM carousels WHERE id = ?1').bind(existing.id).run();
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed.' }, 405);
}
