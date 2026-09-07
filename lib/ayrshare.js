/**
 * ayrshare.js — posting through one broker instead of three platform apps.
 *
 * WHY IT EXISTS. TikTok's app review has been open for a week and there
 * is no telling how long it runs. Ayrshare holds the platform apps
 * itself, so a post goes out under their review rather than ours, and
 * TikTok, Instagram and Facebook all go in ONE call. That is the point:
 * it is not a fourth platform, it is a different road to the same three.
 *
 * WHAT IT COSTS, because a comment is the right place for the number
 * somebody will otherwise rediscover in a year: there is no free plan.
 * New accounts get a 28-day trial and then it is $149 a month for one
 * social profile. It is switched on by a setting so that the day TikTok
 * approves the app, going back to posting direct is one field in the
 * studio and not a deploy.
 *
 * WHAT IT DOES NOT CHANGE. Nothing about who may post. This is reached
 * from publish.js, which only ever reads carousels a person moved to
 * `scheduled`, and the agent's credential cannot reach that state. A
 * broker that makes posting easier must not make approving easier.
 *
 * Read off https://www.ayrshare.com/docs/rest-api/endpoints/post and the
 * Instagram page under it:
 *   `post`          the caption
 *   `platforms`     an array of network names
 *   `mediaUrls`     an array; more than one IS the carousel, up to 10
 *   `scheduleDate`  UTC, YYYY-MM-DDThh:mm:ssZ. A past date posts now.
 */

const ENDPOINT = 'https://api.ayrshare.com/api/post';

/** Ayrshare's names for the three we post to. Ours already match. */
const NETWORKS = { instagram: 'instagram', tiktok: 'tiktok', facebook: 'facebook' };

/** Instagram's ceiling, and the lowest of the three, so it is the rule. */
const MAX_MEDIA = 10;

/**
 * Post one carousel to every target in a single call.
 *
 * Returns the same per-target shape the direct posters return, so a
 * carousel's results read identically whichever road it took and
 * nothing downstream has to know which was used.
 */
export async function toAyrshare(env, { urls, caption, targets, scheduleFor = null }) {
  const key = env.AYRSHARE_API_KEY;
  const want = (targets ?? []).filter((t) => NETWORKS[t]);

  if (!key) {
    return skipAll(want, 'Ayrshare is selected but AYRSHARE_API_KEY is not set.');
  }
  if (!want.length) {
    return {};
  }
  if (!urls?.length) {
    return skipAll(want, 'No slides to post.');
  }

  /* Refused rather than trimmed. Silently dropping slide eleven posts a
     carousel that is missing its ending, and the ending is usually the
     instruction. */
  if (urls.length > MAX_MEDIA) {
    return skipAll(want,
      `${urls.length} slides, and ${MAX_MEDIA} is the most a carousel takes. `
      + 'Drop one before this can go out.');
  }

  const body = {
    post: caption,
    platforms: want.map((t) => NETWORKS[t]),
    mediaUrls: urls,
  };
  /* Ayrshare posts immediately for a date in the past, which is exactly
     what we want for "post this now" and exactly wrong to send by
     accident, so only a future time is passed at all. */
  if (scheduleFor && Date.parse(scheduleFor) > Date.now()) {
    body.scheduleDate = new Date(scheduleFor).toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  let res;
  let json = null;
  let text = '';
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    text = await res.text();
    try { json = JSON.parse(text); } catch { /* the message is the text */ }
  } catch (e) {
    return failAll(want, `Ayrshare could not be reached: ${String(e?.message || e)}`);
  }

  if (!res.ok) {
    return failAll(want, reason(res, json, text));
  }

  /*
   * One call, but the answer is per platform.
   *
   * Ayrshare returns `postIds`, one entry per network, and a network can
   * fail on its own inside a call that returned 200 — a TikTok account
   * set to private, an Instagram token that has lapsed. Reading only the
   * status line would record all three as posted when one of them was
   * not, which is the failure that matters here because nobody is
   * watching when this runs.
   */
  const byNetwork = new Map(
    (json?.postIds ?? []).map((p) => [String(p.platform || '').toLowerCase(), p])
  );

  const out = {};
  for (const target of want) {
    const hit = byNetwork.get(NETWORKS[target]);
    if (!hit) {
      out[target] = {
        ok: false,
        error: json?.errors?.find?.((e) => e.platform === NETWORKS[target])?.message
          || 'Ayrshare accepted the post but said nothing about this platform.',
      };
      continue;
    }
    if (hit.status && String(hit.status).toLowerCase() !== 'success') {
      out[target] = { ok: false, error: hit.message || `Ayrshare said ${hit.status}.` };
      continue;
    }
    out[target] = { ok: true, id: hit.id || hit.postUrl || json?.id || 'posted', via: 'ayrshare' };
  }
  return out;
}

/** Their real reason is in `message`, not in the status line. */
const reason = (res, json, text) =>
  json?.message
    ? `${json.message}${json.code ? ` (code ${json.code})` : ''}`
    : `HTTP ${res.status}: ${text.slice(0, 300)}`;

const skipAll = (targets, error) =>
  Object.fromEntries(targets.map((t) => [t, { ok: false, skipped: true, error }]));

const failAll = (targets, error) =>
  Object.fromEntries(targets.map((t) => [t, { ok: false, error }]));

/**
 * Which road this deployment posts by.
 *
 * A setting rather than "is the key present", because the key stays set
 * through the trial and after it, and the day TikTok approves the app
 * the switch back has to be a decision somebody makes rather than a
 * side effect of deleting a secret.
 */
export async function postingRoute(db, getSetting) {
  const v = String((await getSetting(db, 'post.route')) ?? 'direct').toLowerCase();
  return v === 'ayrshare' ? 'ayrshare' : 'direct';
}
