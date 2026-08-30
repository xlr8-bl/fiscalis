/**
 * /api/studio/content/* — everything on the site that is not an article.
 *
 *   GET    /api/studio/content/schema                  the content model
 *   GET    /api/studio/content/settings                every setting
 *   PUT    /api/studio/content/settings   { key: value, … }
 *   GET    /api/studio/content/:collection             list, drafts included
 *   POST   /api/studio/content/:collection   { …fields }
 *   GET    /api/studio/content/:collection/:slug
 *   PUT    /api/studio/content/:collection/:slug
 *   DELETE /api/studio/content/:collection/:slug
 *   POST   /api/studio/content/:collection/reorder  { slugs: [...] }
 *   POST   /api/studio/content/:collection/:slug/status { status }
 *
 * Same two identities as the articles API. The agent may add and edit, and
 * what it adds arrives as a draft; publishing, deleting and reordering are a
 * person's job.
 */

import { json } from '../../../../lib/respond.js';
import { identify, AGENT_ALLOWED } from '../../../../lib/auth.js';
import { COLLECTIONS, SETTINGS, SETTING_FIELDS, collection, missingRequired }
  from '../../../../lib/collections.js';
import {
  getSettings, setSetting, listEntries, getEntry,
  createEntry, updateEntry, deleteEntry, setEntryStatus, reorder,
} from '../../../../lib/content.js';
import { SITE } from '../../../../lib/templates.js';

/** The home page is what these feed, so drop it from the edge on any change. */
async function purgeHome() {
  await caches.default.delete(new Request(`${SITE}/`)).catch(() => {});
}

export async function onRequest({ request, env, params }) {
  if (!env.DB) return json({ error: 'The database is not configured yet.' }, 503);

  const segments = (Array.isArray(params.route) ? params.route : [params.route]).filter(Boolean);
  const method = request.method.toUpperCase();

  const who = await identify(request, env);
  if (!who) return json({ error: 'Not signed in.' }, 401);

  const guard = (action) => {
    if (who.kind === 'studio') return null;
    if (!AGENT_ALLOWED.has(action)) {
      return json({ error: `The agent token cannot ${action}. A person has to do that.` }, 403);
    }
    return null;
  };

  const [head, ...rest] = segments;

  /* ---------------------------------------------------------------- schema */
  // The studio builds every form from this, so a new content type needs no
  // front-end change at all.
  if (head === 'schema' && method === 'GET') {
    return json({ collections: COLLECTIONS, settings: SETTINGS });
  }

  /* -------------------------------------------------------------- settings */
  if (head === 'settings') {
    if (method === 'GET') return json({ settings: await getSettings(env.DB) });

    if (method === 'PUT') {
      const denied = guard('settings');
      if (denied) return denied;

      const input = await request.json().catch(() => ({}));
      const unknown = Object.keys(input).filter((k) => !SETTING_FIELDS[k]);
      if (unknown.length) {
        return json({ error: `Not settings: ${unknown.join(', ')}` }, 400);
      }
      for (const [key, value] of Object.entries(input)) {
        await setSetting(env.DB, key, value, who.name);
      }
      await purgeHome();
      return json({ ok: true, saved: Object.keys(input).length });
    }
    return json({ error: 'Method not allowed.' }, 405);
  }

  /* ----------------------------------------------------------- collections */
  const name = head;
  const def = collection(name);
  if (!def) return json({ error: `There is no "${name}" collection.` }, 404);

  const slug = rest[0] || null;
  const action = rest[1] || null;

  // list
  if (!slug && method === 'GET') {
    return json({
      collection: name,
      definition: def,
      entries: await listEntries(env.DB, name, { includeDrafts: true }),
    });
  }

  // create
  if (!slug && method === 'POST') {
    const denied = guard('create');
    if (denied) return denied;

    const input = await request.json().catch(() => ({}));
    const missing = missingRequired(name, input);
    if (missing.length) return json({ error: `Still needs: ${missing.join(', ')}` }, 400);

    // the agent's work always lands as a draft, whatever it asked for
    const status = who.kind === 'agent' ? 'draft' : (input.status === 'draft' ? 'draft' : 'published');
    const created = await createEntry(env.DB, name, input, who.name, status);
    if (status === 'published') await purgeHome();
    return json(created, 201);
  }

  // reorder — a person only; it is a layout decision
  if (slug === 'reorder' && method === 'POST') {
    const denied = guard('reorder');
    if (denied) return denied;
    const { slugs } = await request.json().catch(() => ({}));
    if (!Array.isArray(slugs)) return json({ error: 'Send { slugs: [...] }.' }, 400);
    await reorder(env.DB, name, slugs.map(String));
    await purgeHome();
    return json({ ok: true });
  }

  const existing = await getEntry(env.DB, name, slug);
  if (!existing) return json({ error: 'Nothing here with that name.' }, 404);

  if (!action && method === 'GET') return json({ entry: existing, definition: def });

  if (!action && method === 'PUT') {
    const denied = guard('update');
    if (denied) return denied;
    if (who.kind === 'agent' && existing.status === 'published') {
      return json({ error: 'The agent token cannot edit something already live.' }, 403);
    }
    const input = await request.json().catch(() => ({}));
    const updated = await updateEntry(env.DB, name, slug, input, who.name);
    if (existing.status === 'published') await purgeHome();
    return json(updated);
  }

  if (action === 'status' && method === 'POST') {
    const denied = guard('status');
    if (denied) return denied;
    const { status } = await request.json().catch(() => ({}));
    if (!['draft', 'review', 'published'].includes(status)) {
      return json({ error: 'Unknown status.' }, 400);
    }
    await setEntryStatus(env.DB, name, slug, status, who.name);
    await purgeHome();
    return json({ ok: true, status });
  }

  if (!action && method === 'DELETE') {
    const denied = guard('delete');
    if (denied) return denied;
    await deleteEntry(env.DB, name, slug);
    await purgeHome();
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed.' }, 405);
}
