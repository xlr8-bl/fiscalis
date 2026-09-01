/**
 * references.js — putting a picture into the brand kit.
 *
 * The kit is ten or so images the image model is shown before it draws
 * anything: a few of the operator's face, so the person in the slides is
 * the same person every time, and the rest of the look — the grain, the
 * palette, the way type sits on a page.
 *
 * They arrive through Spark, in a chat, from a phone. So this takes the
 * same two shapes deliver_slide does — a URL to fetch, or the bytes
 * inline — and does the same thing with them: R2 for the master, a
 * `media` row so the library knows about it, a `brand_refs` row so the
 * brief hands it over.
 *
 * What it will not do is remove one. The kit is small enough that a
 * wrong upload is a nuisance rather than a loss, and an agent that reads
 * the open web having a delete is the thing this whole design is built
 * to avoid. Removing one is a person's job, in the studio.
 */

const MAX_IMAGE = 25 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
// The kit is a prompt, not an album. Past a couple of dozen the model is
// being averaged rather than steered, and a loop that uploads forever
// should hit a wall it can read.
export const MAX_REFS = 24;

const clean = (v, max = 400) => String(v ?? '').trim().slice(0, max);

/**
 * Fetch or decode, and insist that what came back is an image. A URL
 * that answers with an HTML error page would otherwise be stored as a
 * JPEG and only fail much later, in front of the image model.
 */
export async function imageFrom({ image_url, image_base64, mime }) {
  if (image_base64) {
    try {
      const raw = String(image_base64).replace(/^data:[^;]+;base64,/, '');
      const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
      const type = clean(mime, 60) || 'image/jpeg';
      if (!IMAGE_TYPES.has(type)) return { error: `Unsupported type: ${type}` };
      return { bytes, mime: type };
    } catch {
      return { error: 'image_base64 is not valid base64.' };
    }
  }
  if (image_url) {
    try {
      const res = await fetch(String(image_url));
      if (!res.ok) return { error: `Could not fetch image_url: ${res.status}.` };
      const ct = (res.headers.get('content-type') || '').split(';')[0].trim();
      if (!ct.startsWith('image/')) {
        return { error: `image_url returned ${ct || 'no content type'}, not an image.` };
      }
      if (!IMAGE_TYPES.has(ct)) return { error: `Unsupported type: ${ct}` };
      return { bytes: new Uint8Array(await res.arrayBuffer()), mime: ct };
    } catch (e) {
      return { error: `Could not fetch image_url: ${String(e.message || e)}` };
    }
  }
  return { error: 'Send either image_url or image_base64.' };
}

export async function addReference(env, args) {
  const db = env.DB;
  const role = args.role === 'likeness' ? 'likeness'
             : args.role === 'aesthetic' ? 'aesthetic'
             : null;
  if (!role) {
    return {
      error: 'role must be "likeness" (a picture of the operator) or "aesthetic" '
        + '(the look: grain, palette, type).',
    };
  }
  if (!env.MEDIA) return { error: 'No R2 bucket is bound on this deployment.' };

  const count = await db
    .prepare('SELECT count(*) AS n FROM brand_refs WHERE active = 1')
    .first();
  if ((count?.n ?? 0) >= MAX_REFS) {
    return {
      error: `The kit already holds ${count.n} references, which is the limit. `
        + 'Remove one in the studio before adding another.',
    };
  }

  const got = await imageFrom(args);
  if (got.error) return { error: got.error };
  if (got.bytes.byteLength > MAX_IMAGE) return { error: 'Larger than 25MB.' };

  const ext = got.mime === 'image/png' ? '.png' : got.mime === 'image/webp' ? '.webp' : '.jpg';
  const key = `brand/${role}/${crypto.randomUUID().slice(0, 8)}${ext}`;
  const note = clean(args.note, 400);
  const int = (v) => Math.max(0, Math.min(50_000, Number(v) || 0));

  await env.MEDIA.put(key, got.bytes, {
    httpMetadata: { contentType: got.mime, cacheControl: 'public, max-age=31536000, immutable' },
  });
  await db
    .prepare(
      `INSERT OR REPLACE INTO media (key, filename, content_type, bytes, width, height, alt)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
    )
    .bind(key, `${role}-${key.split('/').pop()}`, got.mime, got.bytes.byteLength,
          int(args.width), int(args.height), note || `${role} reference`)
    .run();

  // it goes on the end of its own role's run, so an order set in the
  // studio is not rearranged by an upload
  const last = await db
    .prepare('SELECT max(position) AS p FROM brand_refs WHERE role = ?1')
    .bind(role)
    .first();
  await db
    .prepare(
      `INSERT INTO brand_refs (media_key, role, position, note, active)
       VALUES (?1, ?2, ?3, ?4, 1)`
    )
    .bind(key, role, (last?.p ?? -1) + 1, note)
    .run();

  const after = await db
    .prepare(
      `SELECT sum(CASE WHEN role = 'likeness'  THEN 1 ELSE 0 END) AS likeness,
              sum(CASE WHEN role = 'aesthetic' THEN 1 ELSE 0 END) AS aesthetic
       FROM brand_refs WHERE active = 1`
    )
    .first();

  return {
    ok: true,
    key,
    role,
    bytes: got.bytes.byteLength,
    content_type: got.mime,
    kit: { likeness: after?.likeness ?? 0, aesthetic: after?.aesthetic ?? 0 },
  };
}

/** What the kit currently holds, as URLs the image model can fetch. */
export async function listReferences(db, { site = '' } = {}) {
  const { results } = await db
    .prepare(
      `SELECT r.media_key, r.role, r.position, r.note, r.active,
              m.width, m.height, m.content_type, m.bytes
       FROM brand_refs r LEFT JOIN media m ON m.key = r.media_key
       ORDER BY r.role, r.position`
    )
    .all();
  return (results ?? []).map((r) => ({
    role: r.role,
    key: r.media_key,
    url: site ? `${site}/media/${r.media_key}` : `/media/${r.media_key}`,
    note: r.note,
    active: Boolean(r.active),
    width: r.width ?? 0,
    height: r.height ?? 0,
    content_type: r.content_type ?? '',
    bytes: r.bytes ?? 0,
  }));
}
