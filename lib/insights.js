/**
 * insights.js — what happened after it went out.
 *
 * Posting is only half of a content machine. The other half is knowing
 * which of the five posts a day was worth making, and that only exists
 * if the numbers come back and are kept.
 *
 * Both platforms were read off their own reference pages, because both
 * of them are stranger than they look:
 *
 *   Instagram  `like_count` and `comments_count` are ordinary fields on
 *              the media object and need only instagram_business_basic.
 *              Everything else — reach, saves, shares, views — is the
 *              insights edge and needs instagram_business_manage_insights
 *              as well, so it is asked for separately and its absence is
 *              a note rather than a failure.
 *              `like_count` is omitted entirely when the account hides
 *              like counts, which is a setting, not an error.
 *              https://developers.facebook.com/docs/instagram-platform/
 *                reference/instagram-media/
 *              https://developers.facebook.com/docs/instagram-platform/
 *                reference/instagram-media/insights/
 *
 *   TikTok     the publish call returns a `publish_id`, which is a
 *              receipt for the upload and not a post. The real post id
 *              only appears from the status endpoint, and only "if the
 *              post is published for public viewership and has been
 *              approved by the TikTok moderation process" — so an
 *              unaudited client, whose posts are private by policy, has
 *              no numbers to read at all. That is worth saying plainly
 *              rather than showing as a zero.
 *              Reading them also needs the `video.list` scope, which is
 *              a different scope from the one that posts.
 *              https://developers.tiktok.com/doc/
 *                content-posting-api-reference-get-video-status
 *              https://developers.tiktok.com/doc/tiktok-api-v2-video-query
 *
 * Nothing here writes 0 for a number it could not read. A counter it
 * does not know stays null and `note` says why, because "no likes" and
 * "not allowed to see likes" are opposite facts and one of them being
 * shown as the other is how you end up rewriting a voice that was
 * working.
 */

import { instagramToken, tiktokToken } from './tokens.js';

const IG_VERSION = 'v21.0';

/** A number, or null when the platform did not give one. */
const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

const blank = () => ({
  post_id: '', permalink: '',
  likes: null, comments: null, shares: null, saves: null, views: null, reach: null,
  state: 'unavailable', note: '', extra: null,
});

/* ------------------------------------------------------------ instagram */

/**
 * The counts first, then the insights. Two calls rather than one because
 * they need different permissions, and losing the likes because reach was
 * not granted would be the wrong trade.
 */
export async function readInstagram(mediaId, token, { fetcher = fetch } = {}) {
  const out = blank();
  out.post_id = String(mediaId || '');
  if (!mediaId) return { ...out, note: 'No Instagram media id was recorded for this post.' };
  if (!token) return { ...out, note: 'Instagram is not connected.' };

  const base = `https://graph.instagram.com/${IG_VERSION}`;
  const fields = 'id,media_type,permalink,timestamp,like_count,comments_count';

  let json;
  try {
    const res = await fetcher(
      `${base}/${mediaId}?fields=${fields}&access_token=${encodeURIComponent(token)}`
    );
    json = await res.json().catch(() => ({}));
  } catch (e) {
    return { ...out, note: `Instagram did not answer: ${String(e.message || e)}` };
  }
  if (json?.error) {
    return { ...out, note: `Instagram: ${json.error.message || 'unknown error'}` };
  }

  out.state = 'ok';
  out.permalink = String(json.permalink || '');
  out.likes = num(json.like_count);
  out.comments = num(json.comments_count);
  // the field is absent, not zero, when the account hides its like counts
  if (out.likes === null) out.note = 'Instagram did not return a like count — the account may be hiding them.';

  const insights = await instagramInsights(base, mediaId, token, fetcher);
  Object.assign(out, insights.values);
  if (insights.note) out.note = [out.note, insights.note].filter(Boolean).join(' ');
  out.extra = { media_type: json.media_type || '', timestamp: json.timestamp || '' };
  return out;
}

/**
 * The insights edge. Asked for as one batch, then retried with the one
 * metric every surface has — a single unsupported name fails the whole
 * request, and which names a given media supports moves with the API
 * version and the media type.
 */
async function instagramInsights(base, mediaId, token, fetcher) {
  const wanted = 'reach,saved,shares,views,total_interactions';
  const ask = async (metric) => {
    const res = await fetcher(
      `${base}/${mediaId}/insights?metric=${metric}&access_token=${encodeURIComponent(token)}`
    );
    return res.json().catch(() => ({}));
  };

  let json;
  try {
    json = await ask(wanted);
    if (json?.error) json = await ask('reach');
  } catch (e) {
    return { values: {}, note: `Reach and saves could not be read: ${String(e.message || e)}` };
  }
  if (json?.error) {
    return {
      values: {},
      note: 'Reach, saves and views were not readable — the token is missing '
        + 'instagram_business_manage_insights. Likes and comments above are still real.',
    };
  }

  const by = {};
  for (const row of json?.data ?? []) {
    const value = row?.values?.[0]?.value ?? row?.total_value?.value;
    if (value !== undefined) by[row.name] = Number(value);
  }
  const values = {};
  if (by.reach !== undefined) values.reach = by.reach;
  if (by.saved !== undefined) values.saves = by.saved;
  if (by.shares !== undefined) values.shares = by.shares;
  if (by.views !== undefined) values.views = by.views;
  return { values, note: '' };
}

/* --------------------------------------------------------------- tiktok */

/**
 * Two calls, and the first one is the interesting one: it says whether
 * the post actually completed, which the publish call cannot know
 * because it returns the moment the upload is accepted.
 */
export async function readTikTok(publishId, token, { fetcher = fetch } = {}) {
  const out = blank();
  if (!publishId) return { ...out, note: 'No TikTok publish id was recorded for this post.' };
  if (!token) return { ...out, note: 'TikTok is not connected.' };

  let status;
  try {
    const res = await fetcher('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({ publish_id: String(publishId) }),
    });
    status = await res.json().catch(() => ({}));
  } catch (e) {
    return { ...out, note: `TikTok did not answer: ${String(e.message || e)}` };
  }
  if (status?.error?.code && status.error.code !== 'ok') {
    return { ...out, note: `TikTok: ${status.error.message || status.error.code}` };
  }

  const data = status?.data || {};
  out.extra = { status: data.status || '', fail_reason: data.fail_reason || '' };

  if (data.status === 'FAILED') {
    return { ...out, note: `TikTok rejected the post: ${data.fail_reason || 'no reason given'}` };
  }

  // the docs spell this field two ways on the same page
  const ids = data.publicly_available_post_id || data.publicaly_available_post_id || [];
  const postId = Array.isArray(ids) ? ids[0] : ids;
  if (!postId) {
    return {
      ...out,
      state: 'pending',
      note: data.status === 'PUBLISH_COMPLETE'
        ? 'TikTok has no public post id for this yet. Until the client passes its audit, '
          + 'posts are private, and private posts have no readable numbers.'
        : `TikTok is still working on this one (${data.status || 'no status'}).`,
    };
  }

  out.post_id = String(postId);
  const fields = 'id,like_count,comment_count,share_count,view_count,share_url,title';
  let videos;
  try {
    const res = await fetcher(`https://open.tiktokapis.com/v2/video/query/?fields=${fields}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({ filters: { video_ids: [String(postId)] } }),
    });
    videos = await res.json().catch(() => ({}));
  } catch (e) {
    return { ...out, state: 'pending', note: `TikTok numbers could not be read: ${String(e.message || e)}` };
  }
  if (videos?.error?.code && videos.error.code !== 'ok') {
    return {
      ...out,
      state: 'pending',
      note: `TikTok numbers could not be read (${videos.error.code}). Reading them needs `
        + 'the video.list scope, which is separate from the one that posts.',
    };
  }

  const video = videos?.data?.videos?.[0];
  if (!video) return { ...out, state: 'pending', note: 'TikTok returned no video for that id yet.' };

  out.state = 'ok';
  out.likes = num(video.like_count);
  out.comments = num(video.comment_count);
  out.shares = num(video.share_count);
  out.views = num(video.view_count);
  out.permalink = String(video.share_url || '');
  return out;
}

/* ---------------------------------------------------------------- store */

async function saveStat(db, carouselId, platform, s) {
  await db
    .prepare(
      `INSERT INTO post_stats (carousel_id, platform, post_id, permalink, likes,
                               comments, shares, saves, views, reach, state, note,
                               extra, checked_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, datetime('now'))
       ON CONFLICT(carousel_id, platform) DO UPDATE SET
         post_id = ?3, permalink = ?4, likes = ?5, comments = ?6, shares = ?7,
         saves = ?8, views = ?9, reach = ?10, state = ?11, note = ?12,
         extra = ?13, checked_at = datetime('now')`
    )
    .bind(
      carouselId, platform, s.post_id || '', s.permalink || '',
      s.likes, s.comments, s.shares, s.saves, s.views, s.reach,
      s.state, String(s.note || '').slice(0, 1000),
      s.extra ? JSON.stringify(s.extra).slice(0, 4000) : ''
    )
    .run();
}

/** Everything already known, without asking a platform anything. */
export async function statsFor(db, carouselIds) {
  const ids = (carouselIds ?? []).filter((n) => Number.isFinite(Number(n)));
  if (!ids.length) return {};
  const { results } = await db
    .prepare(
      `SELECT carousel_id, platform, post_id, permalink, likes, comments, shares,
              saves, views, reach, state, note, checked_at
       FROM post_stats WHERE carousel_id IN (${ids.map(() => '?').join(',')})`
    )
    .bind(...ids)
    .all();

  const by = {};
  for (const r of results ?? []) {
    (by[r.carousel_id] ||= {})[r.platform] = r;
  }
  return by;
}

/** The posts that went out, and whatever is already known about each. */
export async function storedStats(db, { slug = null, limit = 40 } = {}) {
  const where = slug ? 'AND c.slug = ?2' : '';
  const { results } = await db
    .prepare(
      `SELECT c.id, c.slug, c.title, c.pillar, c.posted_at, c.results
       FROM carousels c
       WHERE c.status = 'posted' AND c.results != '' ${where}
       ORDER BY c.posted_at DESC
       LIMIT ?1`
    )
    .bind(Math.min(100, Math.max(1, limit)), ...(slug ? [String(slug)] : []))
    .all();

  const rows = results ?? [];
  const known = await statsFor(db, rows.map((r) => r.id));
  return {
    checked: 0,
    posts: rows.map((r) => {
      const platforms = known[r.id] || {};
      return {
        slug: r.slug,
        title: r.title,
        pillar: r.pillar,
        posted_at: r.posted_at,
        platforms,
        totals: total(platforms),
      };
    }),
  };
}

/**
 * Go and ask. Only carousels that actually went out, and only the
 * platforms that reported an id, because everything else has nothing to
 * be asked about.
 *
 * `stale` exists so a poll every hour does not become one API call per
 * post per hour forever — a post from three weeks ago is not moving.
 */
export async function refreshStats(env, { slug = null, limit = 20, stale = 0, fetcher = fetch } = {}) {
  const db = env.DB;
  if (!db) return { checked: 0, posts: [], error: 'No database bound.' };

  const where = slug ? 'AND c.slug = ?2' : '';
  const { results } = await db
    .prepare(
      `SELECT c.id, c.slug, c.title, c.posted_at, c.results
       FROM carousels c
       WHERE c.status = 'posted' AND c.results != '' ${where}
       ORDER BY c.posted_at DESC
       LIMIT ?1`
    )
    .bind(Math.min(100, Math.max(1, limit)), ...(slug ? [String(slug)] : []))
    .all();

  const rows = results ?? [];
  const known = await statsFor(db, rows.map((r) => r.id));
  const cutoff = stale ? Date.now() - stale * 1000 : 0;
  const posts = [];
  let checked = 0;

  const creds = {};
  for (const row of rows) {
    let posted;
    try { posted = JSON.parse(row.results); } catch { continue; }

    const platforms = {};
    for (const [platform, result] of Object.entries(posted || {})) {
      if (!result?.ok || !result.id) continue;

      const seen = known[row.id]?.[platform];
      // a settled number that was read recently is not worth another call
      // SQLite writes "YYYY-MM-DD HH:MM:SS" in UTC, which is not ISO until
      // the space is a T and the zone is spelled out
      const at = Date.parse(String(seen?.checked_at || '').replace(' ', 'T') + 'Z');
      if (seen && cutoff && seen.state === 'ok' && at > cutoff) {
        platforms[platform] = seen;
        continue;
      }

      if (platform === 'instagram') {
        creds.instagram ??= await instagramToken(db, env);
        const stat = await readInstagram(result.id, creds.instagram.token, { fetcher });
        await saveStat(db, row.id, platform, stat);
        platforms[platform] = stat;
        checked += 1;
      } else if (platform === 'tiktok') {
        creds.tiktok ??= await tiktokToken(db, env);
        const stat = await readTikTok(result.id, creds.tiktok.token, { fetcher });
        await saveStat(db, row.id, platform, stat);
        platforms[platform] = stat;
        checked += 1;
      }
    }

    posts.push({
      slug: row.slug,
      title: row.title,
      posted_at: row.posted_at,
      platforms,
      totals: total(platforms),
    });
  }

  return { checked, posts };
}

/**
 * The one line a person or an agent actually wants: how it did, summed
 * across the platforms that answered.
 */
export function total(platforms) {
  const sum = (field) => {
    const seen = Object.values(platforms || {})
      .map((p) => p?.[field])
      .filter((v) => v !== null && v !== undefined);
    return seen.length ? seen.reduce((a, b) => a + Number(b), 0) : null;
  };
  return {
    likes: sum('likes'),
    comments: sum('comments'),
    shares: sum('shares'),
    saves: sum('saves'),
    views: sum('views'),
    reach: sum('reach'),
  };
}
