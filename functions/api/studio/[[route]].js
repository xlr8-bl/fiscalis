/**
 * /api/studio/* — the CMS API.
 *
 * Used by the studio page (cookie session) and by Gemini Spark (bearer
 * token). The two are not equal: the agent may create and edit articles in
 * `review` and nothing else. See lib/auth.js.
 *
 *   POST   /api/studio/login          { name, password }  -> sets the cookie
 *   POST   /api/studio/logout
 *   GET    /api/studio/me                                  -> who is signed in
 *   GET    /api/studio/articles                            -> list
 *   GET    /api/studio/articles/:slug                      -> one, with body
 *   POST   /api/studio/articles       { title, ... }       -> create
 *   PUT    /api/studio/articles/:slug { ... }              -> update
 *   POST   /api/studio/articles/:slug/publish              -> go live
 *   POST   /api/studio/articles/:slug/unpublish
 *   DELETE /api/studio/articles/:slug
 *   GET    /api/studio/articles/:slug/history              -> past versions
 *   GET    /api/studio/articles/:slug/history/:id          -> one, with body
 *   POST   /api/studio/articles/:slug/restore { id }       -> put one back
 *   POST   /api/studio/media          (multipart)          -> upload to R2
 *   GET    /api/studio/media                               -> list uploads
 *   PUT    /api/studio/media/:key     { alt }              -> describe one
 *   DELETE /api/studio/media/:key                          -> remove one
 */

import { listAll, getBySlug, uniqueSlug, slugify, purgeArticle } from '../../../lib/articles.js';
import { json } from '../../../lib/respond.js';
import {
  identify, createSession, sessionCookie, authenticate, accounts,
  AGENT_ALLOWED, agentMayTouch,
} from '../../../lib/auth.js';
import { SITE } from '../../../lib/templates.js';
import * as history from '../../../lib/revisions.js';

/** The fields a revision of an article keeps. */
const snapshot = (a) => ({
  title: a.title, description: a.description, body: a.body,
  // cover included, or restoring an older version quietly drops the
  // article's photograph and puts the drawn one back
  tags: a.tags, cover: a.cover ?? '', slug: a.slug, status: a.status,
});

const MAX_BODY = 200_000;      // an article
const MAX_FIELD = 400;         // title, description, tags
const MAX_UPLOAD = 8 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml']);

const clean = (v, max = MAX_FIELD) => String(v ?? '').trim().slice(0, max);
const today = () => new Date().toISOString().slice(0, 10);

/**
 * "No accounts" almost never means the secret was never set. It means the
 * secret did not reach *this* deployment, and there are only two ways that
 * happens — so say which one is likelier rather than naming the secret again.
 *
 * A deployment carries the variables it was built with, so a secret added
 * afterwards needs a new deployment. And Pages keeps Production and Preview
 * variables in separate lists, so a branch that is not the production branch
 * reads the Preview one. The hostname says which of the two you are on:
 * a preview is served from <deployment>.<project>.pages.dev.
 */
function noAccountsHint(request) {
  const host = new URL(request.url).hostname;
  const preview = host.endsWith('.pages.dev') && host.split('.').length > 3;
  return (
    `No accounts on this deployment (${host}). ` +
    (preview
      ? 'This is a preview deployment, so it reads the Preview variables, not Production. ' +
        'Add STUDIO_PASSWORD under Preview as well. '
      : '') +
    'A deployment keeps the variables it was built with, so after adding the ' +
    'secret under Settings → Variables and Secrets, retry the deployment ' +
    'to pick it up.'
  );
}

/** Drop the edge cache for the pages an article change affects. */
const purge = (article) => purgeArticle(SITE, article?.slug);

export async function onRequest(context) {
  const { request, env, params } = context;
  const segments = Array.isArray(params.route) ? params.route : [params.route].filter(Boolean);
  const [head, ...rest] = segments;
  const method = request.method.toUpperCase();

  if (!env.DB) return json({ error: 'The journal database is not configured yet.' }, 503);

  /* ---------------------------------------------------------- login/logout */
  if (head === 'login' && method === 'POST') {
    if (!Object.keys(accounts(env)).length) {
      return json({ error: noAccountsHint(request) }, 503);
    }
    const { name, password } = await request.json().catch(() => ({}));
    const user = authenticate(env, name, password);
    if (!user) {
      // slow every wrong guess down a little
      await new Promise((r) => setTimeout(r, 600));
      return json({ error: 'That name and password do not match.' }, 401);
    }
    return json({ ok: true, name: user }, 200, {
      'set-cookie': sessionCookie(await createSession(env, user)),
    });
  }

  if (head === 'logout' && method === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', { clear: true }) });
  }

  /* -------------------------------------------------------------- identity */
  const who = await identify(request, env);
  if (!who) return json({ error: 'Not signed in.' }, 401);

  // who am I — the studio asks on load so it can greet you and skip the gate
  if (head === 'me' && method === 'GET') {
    return json({ name: who.name, kind: who.kind });
  }

  const guard = (action) => {
    if (who.kind === 'studio') return null;
    if (!AGENT_ALLOWED.has(action)) {
      return json({ error: `The agent token cannot ${action}. A person has to do that.` }, 403);
    }
    return null;
  };

  /* -------------------------------------------------------------- bookings */
  /*
   * Intro call requests, as they came off the booking form.
   *
   * A person only. The agent token can read and draft the site's
   * content; it has no business reading strangers' email addresses and
   * what they said was broken about their business, and nothing it does
   * needs them.
   */
  if (head === 'bookings') {
    if (who.kind !== 'studio') {
      return json({ error: 'Enquiries are not something the agent token can read.' }, 403);
    }

    if (method === 'GET' && !rest.length) {
      try {
        const { results } = await env.DB
          .prepare(
            `SELECT id, name, email, message, duration, wanted_date, slots,
                    country, referrer, state, note, delivered, created_at
             FROM bookings ORDER BY created_at DESC LIMIT 200`
          )
          .all();
        return json({ bookings: results ?? [] });
      } catch (err) {
        // the table arrives with the schema, so a database that has not
        // been set up since this shipped says so rather than 500ing
        if (/no such table/i.test(String(err?.message ?? err))) {
          return json({ bookings: [], setup_needed: true });
        }
        throw err;
      }
    }

    // mark one read, replied, booked or closed, and keep a note against it
    if (method === 'PUT' && rest.length === 1) {
      const body = await request.json().catch(() => ({}));
      const state = String(body.state ?? '');
      if (!['new', 'read', 'replied', 'booked', 'closed'].includes(state)) {
        return json({ error: 'That is not one of the states.' }, 400);
      }
      await env.DB
        .prepare(`UPDATE bookings SET state = ?1, note = ?2 WHERE id = ?3`)
        .bind(state, String(body.note ?? '').slice(0, 2000), Number(rest[0]))
        .run();
      return json({ ok: true });
    }

    return json({ error: 'Not a bookings route.' }, 404);
  }

  /* ----------------------------------------------------------------- media */
  if (head === 'media') {
    if (!env.MEDIA) return json({ error: 'No R2 bucket is bound.' }, 503);

    // the picker shows every image, so this lists more than a page of them
    if (method === 'GET' && !rest.length) {
      const { results } = await env.DB
        .prepare(
          `SELECT key, filename, content_type, bytes, width, height, alt, created_at
           FROM media ORDER BY created_at DESC, key DESC LIMIT 500`
        )
        .all();
      return json({ media: results ?? [] });
    }

    if (method === 'POST' && !rest.length) {
      const denied = guard('upload');
      if (denied) return denied;

      const form = await request.formData().catch(() => null);
      const file = form?.get('file');
      if (!file || typeof file === 'string') return json({ error: 'No file.' }, 400);
      if (file.size > MAX_UPLOAD) return json({ error: 'Larger than 8MB.' }, 413);
      if (!IMAGE_TYPES.has(file.type)) {
        return json({ error: `Unsupported type: ${file.type || 'unknown'}` }, 415);
      }

      const safe = slugify(String(file.name).replace(/\.[^.]+$/, '')) || 'image';
      const ext = (String(file.name).match(/\.[a-z0-9]+$/i) || [''])[0].toLowerCase();
      const key = `${today()}/${safe}-${crypto.randomUUID().slice(0, 8)}${ext}`;

      // the browser decoded the image to show a preview, so it knows the
      // size already; measuring it again here would mean decoding it twice
      const int = (v) => Math.max(0, Math.min(50_000, Number(v) || 0));
      const width = int(form.get('width'));
      const height = int(form.get('height'));
      const alt = clean(form.get('alt'));

      await env.MEDIA.put(key, file.stream(), {
        httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' },
      });
      await env.DB
        .prepare(
          `INSERT INTO media (key, filename, content_type, bytes, width, height, alt)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
        )
        .bind(key, clean(file.name), file.type, file.size, width, height, alt)
        .run();

      return json({ key, url: `/media/${key}`, width, height, alt }, 201);
    }

    // /media/<key…> — a key contains slashes, so it is the rest of the path
    const mediaKey = rest.map(String).join('/');
    if (mediaKey) {
      if (method === 'PUT') {
        const denied = guard('media');
        if (denied) return denied;
        const { alt } = await request.json().catch(() => ({}));
        await env.DB
          .prepare('UPDATE media SET alt = ?1 WHERE key = ?2')
          .bind(clean(alt), mediaKey)
          .run();
        return json({ ok: true, key: mediaKey, alt: clean(alt) });
      }

      if (method === 'DELETE') {
        const denied = guard('media');
        if (denied) return denied;
        // the row goes first: an orphaned object costs storage, whereas a
        // row pointing at bytes that are gone is a broken image on a page
        await env.DB.prepare('DELETE FROM media WHERE key = ?1').bind(mediaKey).run();
        await env.MEDIA.delete(mediaKey);
        return json({ ok: true });
      }
    }
    return json({ error: 'Method not allowed.' }, 405);
  }

  /* -------------------------------------------------------------- articles */
  if (head !== 'articles') return json({ error: 'Unknown endpoint.' }, 404);

  const slug = rest[0] ? String(rest[0]) : null;
  const action = rest[1] ? String(rest[1]) : null;
  const arg = rest[2] ? String(rest[2]) : null;

  // list
  if (!slug && method === 'GET') {
    const denied = guard('list');
    if (denied) return denied;
    return json({ articles: await listAll(env.DB) });
  }

  // create
  if (!slug && method === 'POST') {
    const denied = guard('create');
    if (denied) return denied;

    const input = await request.json().catch(() => ({}));
    const title = clean(input.title);
    if (!title) return json({ error: 'A title is required.' }, 400);

    // an agent's work always lands in the review queue
    const status = who.kind === 'agent' ? 'review' : 'draft';
    const source = who.kind === 'agent' ? 'spark' : 'studio';
    const newSlug = await uniqueSlug(env.DB, input.slug || title);

    await env.DB
      .prepare(
        `INSERT INTO articles (slug, title, description, body, tags, cover,
                               status, source, author, last_editor)
         VALUES (?1, ?2, ?3, ?4, ?5, ?9, ?6, ?7, ?8, ?8)`
      )
      .bind(newSlug, title, clean(input.description), clean(input.body, MAX_BODY),
            clean(input.tags), status, source, who.name, clean(input.cover))
      .run();

    return json({ slug: newSlug, status, source }, 201);
  }

  if (!slug) return json({ error: 'Method not allowed.' }, 405);

  const existing = await getBySlug(env.DB, slug, { publishedOnly: false });
  if (!existing) return json({ error: 'No article with that slug.' }, 404);

  // read one
  if (!action && method === 'GET') {
    const denied = guard('get');
    if (denied) return denied;
    return json({ article: existing });
  }

  // update
  if (!action && method === 'PUT') {
    const denied = guard('update');
    if (denied) return denied;
    if (who.kind === 'agent' && !agentMayTouch(existing)) {
      return json({ error: 'The agent token cannot edit this article.' }, 403);
    }

    const input = await request.json().catch(() => ({}));
    const title = clean(input.title) || existing.title;
    // renaming a published article throws away its ranking, so the slug is
    // only allowed to move while it is not live
    const nextSlug =
      existing.status !== 'published' && input.slug && slugify(input.slug) !== existing.slug
        ? await uniqueSlug(env.DB, input.slug, existing.id)
        : existing.slug;

    // what it looked like before this save
    await history.record(env.DB, 'article', history.articleRef(existing.slug),
                         snapshot(existing), who.name, 'edited');
    if (nextSlug !== existing.slug) {
      await history.rename(env.DB, 'article', existing.slug, nextSlug);
    }

    await env.DB
      .prepare(
        `UPDATE articles SET slug = ?1, title = ?2, description = ?3, body = ?4,
                             tags = ?5, cover = ?8,
                             last_editor = ?7, updated_at = datetime('now')
         WHERE id = ?6`
      )
      .bind(nextSlug, title,
            input.description === undefined ? existing.description : clean(input.description),
            input.body === undefined ? existing.body : clean(input.body, MAX_BODY),
            input.tags === undefined ? existing.tags : clean(input.tags),
            existing.id, who.name,
            input.cover === undefined ? (existing.cover ?? '') : clean(input.cover))
      .run();

    if (existing.status === 'published') await purge({ slug: nextSlug });
    return json({ slug: nextSlug });
  }

  // publish / unpublish — a person only
  if (action === 'publish' && method === 'POST') {
    const denied = guard('publish');
    if (denied) return denied;
    if (!existing.description) {
      return json({ error: 'Add a description first — it is the search result.' }, 400);
    }
    await history.record(env.DB, 'article', history.articleRef(existing.slug),
                         snapshot(existing), who.name, 'before publishing');
    await env.DB
      .prepare(
        `UPDATE articles SET status = 'published',
                             published_at = COALESCE(published_at, ?1),
                             last_editor = ?3,
                             updated_at = datetime('now')
         WHERE id = ?2`
      )
      .bind(today(), existing.id, who.name)
      .run();
    await purge(existing);
    return json({ slug: existing.slug, status: 'published' });
  }

  if (action === 'unpublish' && method === 'POST') {
    const denied = guard('unpublish');
    if (denied) return denied;
    await env.DB
      .prepare(
        `UPDATE articles SET status = 'draft', last_editor = ?2,
                             updated_at = datetime('now') WHERE id = ?1`
      )
      .bind(existing.id, who.name)
      .run();
    await purge(existing);
    return json({ slug: existing.slug, status: 'draft' });
  }

  /* -------------------------------------------------------------- history */
  if (action === 'history' && method === 'GET') {
    const denied = guard('get');
    if (denied) return denied;
    const ref = history.articleRef(existing.slug);
    if (arg) {
      const rev = await history.get(env.DB, 'article', ref, arg);
      if (!rev) return json({ error: 'No such revision.' }, 404);
      return json({ revision: rev });
    }
    return json({ revisions: await history.list(env.DB, 'article', ref) });
  }

  // Restoring is itself an edit, so the state being replaced is recorded
  // first — which means a restore can be undone by another restore.
  if (action === 'restore' && method === 'POST') {
    const denied = guard('restore');
    if (denied) return denied;
    const { id } = await request.json().catch(() => ({}));
    const ref = history.articleRef(existing.slug);
    const rev = await history.get(env.DB, 'article', ref, id);
    if (!rev) return json({ error: 'No such revision.' }, 404);

    await history.record(env.DB, 'article', ref, snapshot(existing), who.name, 'before restoring');
    const d = rev.data;
    await env.DB
      .prepare(
        `UPDATE articles SET title = ?1, description = ?2, body = ?3, tags = ?4,
                             cover = ?7, last_editor = ?6, updated_at = datetime('now')
         WHERE id = ?5`
      )
      .bind(clean(d.title) || existing.title, clean(d.description),
            clean(d.body, MAX_BODY), clean(d.tags), existing.id, who.name,
            // a revision predating the column restores as no cover, which
            // means the drawn one — not a broken image
            clean(d.cover ?? ''))
      .run();

    if (existing.status === 'published') await purge(existing);
    return json({ ok: true, slug: existing.slug });
  }

  // delete — a person only
  if (!action && method === 'DELETE') {
    const denied = guard('delete');
    if (denied) return denied;
    await env.DB.prepare('DELETE FROM articles WHERE id = ?1').bind(existing.id).run();
    await history.drop(env.DB, 'article', history.articleRef(existing.slug));
    await purge(existing);
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed.' }, 405);
}
