/**
 * photos.js — finding a real photograph, and keeping it.
 *
 * The journal's covers are drawn from each headline. They look
 * deliberate and they are not photographs, and a blog whose every
 * picture is typography is still a blog with no pictures in it.
 *
 * So: search a stock library, fetch the file, store it in R2 next to
 * everything else the studio holds, and record where it came from.
 *
 * Two sources, in this order:
 *
 *   Unsplash    better pictures, and the site already uses five of them.
 *               Needs UNSPLASH_ACCESS_KEY, which is a Cloudflare secret.
 *               The agent never sees it — it calls a tool, the Worker
 *               holds the key.
 *   Wikimedia   no key at all, so this works on a deployment nobody has
 *   Commons     configured. Freely licensed, traceable, and the pictures
 *               are an archive rather than a stock library, so they are
 *               more variable.
 *
 * Both were checked from this environment before being written down:
 * api.unsplash.com answers (401 without a key, which is the point),
 * images.unsplash.com serves, and the Commons API and upload host both
 * answer with a real User-Agent and 429 without one. Openverse would
 * have been the better keyless source and is not reachable from here at
 * all, so it is not in this file.
 *
 * Attribution is recorded even where the licence does not require it,
 * which is the rule assets/stock/scene/SOURCES.md already set: a source
 * that cannot be traced is a source that cannot be defended later.
 */

// Wikimedia asks for a User-Agent that identifies the caller and gives
// someone to contact. Without one the upload host returns 429.
const UA = 'web3ashley/1.0 (https://web3ashley.com; ashleymbaht@gmail.com)';

/** The cover size the journal uses everywhere. */
export const COVER = { width: 1200, height: 630 };

const clean = (v) => String(v ?? '').replace(/<[^>]*>/g, '').trim();

/**
 * Ask Unsplash.
 *
 * The orientation is asked for rather than assumed. A journal cover is
 * 1200x630 and a portrait photograph cropped to that loses whatever it was
 * of; a hook sheet is 1080x1350 and a landscape photograph cropped to
 * that loses the face. `crop=faces` first, because when the subject is a
 * person, entropy will happily keep the busiest corner of the frame and
 * throw the head away.
 */
async function fromUnsplash(query, key, count, shape = 'wide') {
  const size = shape === 'tall' ? { width: 1080, height: 1350 } : COVER;
  const url =
    'https://api.unsplash.com/search/photos'
    + `?query=${encodeURIComponent(query)}&per_page=${count}`
    + `&orientation=${shape === 'tall' ? 'portrait' : 'landscape'}&content_filter=high`;

  const res = await fetch(url, {
    headers: { authorization: `Client-ID ${key}`, 'accept-version': 'v1' },
  });
  if (!res.ok) throw new Error(`Unsplash said ${res.status}.`);
  const data = await res.json();

  return (data.results ?? []).map((p) => ({
    source: 'unsplash',
    id: p.id,
    // the CDN takes the crop in the URL, so the bytes that arrive are
    // already the size the page wants rather than a 4000px original
    url: `${p.urls.raw}&w=${size.width}&h=${size.height}&fit=crop&crop=faces,entropy&q=80&fm=jpg`,
    page: p.links?.html ?? '',
    // Unsplash's own description first; the alt_description is generated
    // and reads like a caption written by a machine, because it was
    alt: clean(p.description || p.alt_description || query),
    by: clean(p.user?.name ?? ''),
    byLink: p.user?.links?.html ?? '',
    licence: 'Unsplash Licence',
    width: size.width,
    height: size.height,
  }));
}

/*
 * Wikimedia Commons is an archive, not a stock library, and searching it
 * naively gives you an archive's results. The first version of this
 * returned nothing at all for "menu on a table" — the single most
 * obvious query for this journal's subject matter — and answered "phone
 * in hand" with a photograph of a Japanese handset from 1997.
 *
 * Three things fixed that, all learned by running the queries:
 *
 *   Commons matches words, not phrases. A natural four-word request
 *   finds nothing, so the query is stripped to its nouns and then
 *   shortened, pass by pass, until something comes back.
 *
 *   Commons mirrors a large set of CC0 Unsplash photographs, and they
 *   are the only genuinely editorial pictures in there. Searching
 *   `"unsplash"` WITH the quotes finds them; without the quotes it finds
 *   nothing, which is the sort of thing you only learn by trying it.
 *   That mirror is the first pass.
 *
 *   What comes back still has to be ranked. An archive will hand you a
 *   head-on scan of a menu at 1200x1619 before it hands you a
 *   photograph of a menu on a table, and the scan cannot be cropped to
 *   a 1200x630 cover and still be of anything.
 */

/** Words that carry no search weight and cost a pass when included. */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'on', 'in', 'at', 'to', 'for', 'with', 'and',
  'or', 'is', 'are', 'from', 'by', 'into', 'over', 'under', 'up', 'down',
  'some', 'any', 'that', 'this', 'it', 'its', 'your', 'my', 'their',
]);

const keywords = (query) =>
  String(query).toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

/**
 * The searches to try, best first.
 *
 * Each pass is cheaper in specificity than the one before it, so the
 * first that returns anything is the most specific answer available.
 */
function passes(query) {
  const words = keywords(query);
  if (!words.length) return [];
  const out = [];
  // the Unsplash mirror, narrowing to the two strongest words if the
  // full set is too specific for it
  out.push(`filetype:bitmap "unsplash" ${words.join(' ')}`);
  if (words.length > 2) out.push(`filetype:bitmap "unsplash" ${words.slice(0, 2).join(' ')}`);
  out.push(`filetype:bitmap "unsplash" ${words[0]}`);
  // then the rest of the archive
  out.push(`filetype:bitmap ${words.join(' ')}`);
  if (words.length > 2) out.push(`filetype:bitmap ${words.slice(0, 2).join(' ')}`);
  if (words.length > 1) out.push(`filetype:bitmap ${words[0]}`);
  return out;
}

/** Titles on Commons carry their filing, not a description. */
function tidyTitle(title) {
  return clean(
    String(title)
      .replace(/^File:/i, '')
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/_/g, ' ')
      .replace(/\s*\(Unsplash\)\s*$/i, '')
      // "- geograph.org.uk - 1234567", "HC08164", "2024-07-11", "- 03"
      .replace(/\s*-\s*geograph[^-]*(-\s*\d+)?$/i, '')
      .replace(/\s+\d{4}-\d{2}-\d{2}\s*$/, '')
      .replace(/\s+[A-Z]{2}\d{4,}\s*$/, '')
      .replace(/\s*-\s*\d{1,3}\s*$/, '')
      .trim()
  );
}

async function askCommons(search, count) {
  const url =
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*'
    + `&generator=search&gsrsearch=${encodeURIComponent(search)}`
    + `&gsrlimit=${Math.min(30, count * 4)}&gsrnamespace=6`
    + '&prop=imageinfo&iiprop=url|size|extmetadata'
    + `&iiurlwidth=${COVER.width}`;

  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`Commons said ${res.status}.`);
  const data = await res.json();

  return Object.values(data?.query?.pages ?? {})
    .map((p) => {
      const info = p.imageinfo?.[0];
      if (!info?.thumburl) return null;
      const meta = info.extmetadata ?? {};
      const licence = clean(meta.LicenseShortName?.value ?? 'see the file page');
      const raw = String(p.title);
      return {
        source: 'commons',
        id: String(p.pageid),
        url: info.thumburl,
        page: info.descriptionurl ?? '',
        alt: tidyTitle(raw),
        by: clean(meta.Artist?.value ?? ''),
        byLink: info.descriptionurl ?? '',
        licence,
        width: info.thumbwidth ?? COVER.width,
        height: info.thumbheight ?? 0,
        // scoring only; stripped before the caller sees it
        _unsplash: /\(unsplash\)/i.test(raw),
        _free: /^(cc0|public domain)/i.test(licence),
      };
    })
    .filter(Boolean);
}

/**
 * What shape the caller wants, and how a candidate is judged against it.
 *
 * This used to be a constant, and the constant was the blog cover: score
 * landscape highly, and throw away anything taller than 1.1 outright. That
 * is right for a 1200x630 cover and exactly wrong for a hook sheet, which
 * is 1080x1350 and whose portrait slot wants a face. The filter meant the
 * `portrait` role could not receive a portrait-orientation photograph at
 * all — every one was deleted before scoring — so it was filled with
 * landscape scenes that happened to have a person somewhere in them.
 *
 * `floor` is what gets thrown away; `prefers` is what wins.
 */
export const SHAPES = {
  // 1.9 is the cover's own ratio; anything at or past it crops without loss
  wide: {
    assume: 1.9,
    keeps: (r) => r >= 1.1,
    points: (r) => (r >= 1.6 ? 40 : r >= 1.3 ? 20 : r >= 1.1 ? 5 : 0),
  },
  // 0.8 is the hook sheet's. A face wants to arrive already upright rather
  // than be found inside a landscape and cropped out of it.
  tall: {
    assume: 0.75,
    keeps: (r) => r <= 1.15,
    points: (r) => (r <= 0.72 ? 40 : r <= 0.9 ? 25 : r <= 1.15 ? 5 : 0),
  },
  any: { assume: 1, keeps: () => true, points: () => 10 },
};

/**
 * Score a candidate against the shape asked for.
 *
 * Aspect does most of the work either way, because the failure it fixes is
 * the wrong orientation winning on subject alone: a portrait scan taking a
 * search for a cover, or a wide landscape taking a search for a face.
 */
function score(p, shape = 'wide') {
  const rule = SHAPES[shape] ?? SHAPES.wide;
  let s = 0;
  if (p._unsplash) s += 60;          // an actual photographer's photograph
  if (p._free) s += 15;              // CC0 or public domain: no credit line owed
  const ratio = p.height ? p.width / p.height : rule.assume;
  s += rule.keeps(ratio) ? rule.points(ratio) : -40;
  if (p.width >= 1200) s += 10;
  // a title that is a catalogue number tells a reader nothing, and it is
  // what the alt text would become
  if (/^\s*$/.test(p.alt) || /^[A-Z0-9\s-]{6,}$/.test(p.alt)) s -= 15;
  return s;
}

async function fromCommons(query, count, shape = 'wide') {
  const rule = SHAPES[shape] ?? SHAPES.wide;
  const seen = new Set();
  const pool = [];

  for (const search of passes(query)) {
    let batch = [];
    try {
      batch = await askCommons(search, count);
    } catch (err) {
      // one pass failing is not the search failing; the next may work,
      // and only an empty pool is worth reporting
      if (!pool.length && search === passes(query).at(-1)) throw err;
      continue;
    }
    for (const p of batch) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      pool.push(p);
    }
    // enough good ones to choose from: stop paying for more passes
    if (pool.filter((p) => score(p, shape) >= 60).length >= count) break;
  }

  return pool
    .filter((p) => !p.height || rule.keeps(p.width / p.height))
    .sort((a, b) => score(b, shape) - score(a, shape))
    .slice(0, count)
    .map(({ _unsplash, _free, ...p }) => p);
}

/**
 * Find candidates. Never throws for "no key" or "one source is down" —
 * a caller wants pictures or a reason, not an exception.
 *
 * @returns {Promise<{photos: object[], searched: string[], note?: string}>}
 */
export async function findPhotos(env, query, count = 6, { shape = 'wide' } = {}) {
  const q = String(query ?? '').trim().slice(0, 120);
  if (!q) return { photos: [], searched: [], note: 'Nothing to search for.' };

  const searched = [];
  const problems = [];
  let photos = [];

  if (env.UNSPLASH_ACCESS_KEY) {
    searched.push('unsplash');
    try {
      photos = await fromUnsplash(q, env.UNSPLASH_ACCESS_KEY, count, shape);
    } catch (err) {
      problems.push(`Unsplash: ${err.message}`);
    }
  }

  if (!photos.length) {
    searched.push('commons');
    try {
      photos = await fromCommons(q, count, shape);
    } catch (err) {
      problems.push(`Commons: ${err.message}`);
    }
  }

  const note = photos.length
    ? (problems.length ? problems.join(' ') : undefined)
    : (problems.join(' ')
       || `Nothing came back for "${q}". Try fewer words, or a thing rather than an idea — `
          + '"a menu on a table" finds a photograph, "digital transformation" does not.');

  return { photos, searched, note };
}

/**
 * Fetch one of those and put it in R2, as a row in `media` like any
 * other picture.
 *
 * Deliberately not a redirect-follower into arbitrary hosts: the URL has
 * to be one of the two libraries' own, because this runs with the
 * studio's credentials and "fetch whatever URL the agent hands you" is
 * how a tool becomes a proxy for someone else's traffic.
 */
const ALLOWED_HOSTS = new Set([
  'images.unsplash.com',
  'upload.wikimedia.org',
  'thumb.wikimedia.org',
  'commons.wikimedia.org',
]);

const MAX_BYTES = 8 * 1024 * 1024;

export async function keepPhoto(env, photo, { slug = 'cover' } = {}) {
  let host;
  try {
    host = new URL(photo.url).hostname;
  } catch {
    return { ok: false, error: 'That is not a URL.' };
  }
  if (!ALLOWED_HOSTS.has(host)) {
    return {
      ok: false,
      error: `${host} is not one of the libraries this can fetch from. `
             + 'Use a photo from find_photo rather than a URL of your own.',
    };
  }

  const res = await fetch(photo.url, { headers: { 'user-agent': UA } });
  if (!res.ok) return { ok: false, error: `The file would not download (${res.status}).` };

  const type = res.headers.get('content-type') || 'image/jpeg';
  if (!/^image\/(jpeg|png|webp)$/.test(type)) {
    return { ok: false, error: `That came back as ${type}, which is not a photograph.` };
  }

  const bytes = await res.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) {
    return { ok: false, error: 'Over 8MB. Ask the library for a smaller one.' };
  }

  const ext = type === 'image/png' ? '.png' : type === 'image/webp' ? '.webp' : '.jpg';
  const stamp = new Date().toISOString().slice(0, 10);
  const key = `${stamp}/${slug}-${photo.source}-${crypto.randomUUID().slice(0, 8)}${ext}`;

  await env.MEDIA.put(key, bytes, {
    httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' },
  });

  // The credit goes in the alt text's neighbour, not the alt text: alt
  // says what the picture is of, for somebody who cannot see it, and
  // "Photo by X on Unsplash" tells them nothing about the picture.
  const alt = photo.alt || '';
  await env.DB
    .prepare(
      `INSERT INTO media (key, filename, content_type, bytes, width, height, alt)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
    )
    .bind(
      key,
      `${slug}-${photo.source}-${photo.id}${ext}`,
      type,
      bytes.byteLength,
      photo.width || 0,
      photo.height || 0,
      alt
    )
    .run();

  return {
    ok: true,
    key,
    url: `/media/${key}`,
    alt,
    credit: photo.by
      ? `${photo.by} (${photo.licence})`
      : photo.licence,
    source: photo.page || photo.url,
  };
}
