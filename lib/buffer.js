/**
 * buffer.js — one broker instead of three platform apps.
 *
 * Replaces Ayrshare, which had no free plan and would not take the card.
 * Buffer's API key is a plain account key from Settings, API — no OAuth
 * app, no review, no per-profile subscription to fail at checkout.
 *
 * Changes nothing about who may post. publish.js still reads `scheduled`
 * only, which the agent's credential cannot reach.
 *
 * From https://developers.buffer.com:
 *   POST https://api.buffer.com, GraphQL, `Authorization: Bearer KEY`
 *   account { organizations { id } }        the org the channels hang off
 *   channels(input: { organizationId })     id, service, isDisconnected
 *   createPost(input: { channelId, ... })   ONE channel per call
 *
 * The last one is the shape difference that matters. Ayrshare took every
 * platform in a single call, so the lowest media limit in the call was
 * the limit for all of them. Buffer posts per channel, so each gets its
 * own call and its own answer, and a carousel too long for Instagram can
 * still go to TikTok.
 */

import { PLATFORMS } from '../assets/js/platforms.js';

const ENDPOINT = 'https://api.buffer.com';

/** Buffer's `Service` enum names for the three we post to. */
const SERVICE = { instagram: 'instagram', tiktok: 'tiktok', facebook: 'facebook' };

const MAX_MEDIA = { instagram: 10, tiktok: 35, facebook: 10 };

/**
 * One GraphQL call. Their errors arrive three ways and all three have to
 * be read: a bad status, a 200 carrying `errors`, and a 200 whose payload
 * is the MutationError half of a union.
 */
async function graphql(key, query, variables, fetcher = fetch) {
  let res;
  let text = '';
  let json = null;
  try {
    res = await fetcher(ENDPOINT, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    text = await res.text();
    try { json = JSON.parse(text); } catch { /* the message is the text */ }
  } catch (e) {
    return { error: `Buffer could not be reached: ${String(e?.message || e)}` };
  }
  if (!res.ok) {
    return { error: json?.errors?.[0]?.message || `HTTP ${res.status}: ${text.slice(0, 300)}` };
  }
  if (json?.errors?.length) return { error: json.errors.map((e) => e.message).join('; ') };
  return { data: json?.data ?? null };
}

const ORGS = 'query GetOrganizations { account { organizations { id } } }';

const CHANNELS = `query GetChannels($organizationId: OrganizationId!) {
  channels(input: { organizationId: $organizationId }) {
    id service name isDisconnected
  }
}`;

const CREATE = `mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    ... on PostActionSuccess { post { id dueAt } }
    ... on MutationError { message }
  }
}`;

/**
 * The organization and its channels, in two calls.
 *
 * Cached in settings rather than re-asked per post: a carousel going to
 * three places would otherwise cost six extra round trips at the moment
 * it is trying to publish. A channel that has since been disconnected is
 * caught by the post failing, which says so.
 */
export async function channelsOf(env, { fetcher = fetch, getSetting, putSetting } = {}) {
  const key = env.BUFFER_API_KEY;
  if (!key) return { error: 'BUFFER_API_KEY is not set.' };

  let org = getSetting ? await getSetting(env.DB, 'buffer.org_id') : null;
  if (!org) {
    const got = await graphql(key, ORGS, {}, fetcher);
    if (got.error) return { error: got.error };
    org = got.data?.account?.organizations?.[0]?.id;
    if (!org) return { error: 'No organization on this Buffer account.' };
    if (putSetting) await putSetting(env.DB, 'buffer.org_id', org);
  }

  const got = await graphql(key, CHANNELS, { organizationId: org }, fetcher);
  if (got.error) return { error: got.error };

  const byTarget = {};
  for (const c of got.data?.channels ?? []) {
    const target = Object.keys(SERVICE).find((t) => SERVICE[t] === c.service);
    if (target && !c.isDisconnected) byTarget[target] = { id: c.id, name: c.name };
  }
  return { org, channels: byTarget };
}

/**
 * Post one carousel to every target, one call each.
 *
 * Returns the same per-target shape the direct posters return, so a
 * carousel's results read identically whichever road it took.
 */
export async function toBuffer(env, {
  urls, caption, targets, scheduleFor = null, fetcher = fetch, getSetting, putSetting,
} = {}) {
  const key = env.BUFFER_API_KEY;
  const want = (targets ?? []).filter((t) => SERVICE[t]);

  if (!key) return skipAll(want, 'Buffer is selected but BUFFER_API_KEY is not set.');
  if (!want.length) return {};
  if (!urls?.length) return skipAll(want, 'No slides to post.');

  /* TikTok takes WebP and JPEG, not PNG, and the sheets draw as PNG.
     Through a broker that accepts the post and fails later. platforms.js
     holds the rules; do not copy them here. */
  const badFormat = [];
  for (const t of want) {
    const rules = PLATFORMS[t];
    if (!rules?.formats) continue;
    for (const url of urls) {
      const mime = mimeOf(url);
      if (mime && !rules.formats.includes(mime)) {
        badFormat.push(`${t} does not take ${mime.replace('image/', '')}`);
        break;
      }
    }
  }
  if (badFormat.length) {
    return skipAll(want,
      `${[...new Set(badFormat)].join('; ')}. Draw the slides as JPEG before posting.`);
  }

  const found = await channelsOf(env, { fetcher, getSetting, putSetting });
  if (found.error) return failAll(want, found.error);

  /* A future time is scheduled; anything else goes now. Buffer publishes
     a past dueAt at its next sweep rather than immediately, which is the
     wrong answer for a slot that has already come round. */
  const future = scheduleFor && Date.parse(scheduleFor) > Date.now();

  const out = {};
  for (const target of want) {
    const channel = found.channels[target];
    if (!channel) {
      out[target] = {
        ok: false, skipped: true,
        error: `No connected ${target} channel on this Buffer account. Connect it in Buffer, then post again.`,
      };
      continue;
    }

    /* Refused rather than trimmed. Dropping slide eleven posts a carousel
       missing its ending, and the ending is the instruction. Per channel
       now, so one platform's limit no longer speaks for the others. */
    const max = MAX_MEDIA[target] ?? 10;
    if (urls.length > max) {
      out[target] = {
        ok: false, skipped: true,
        error: `${urls.length} slides, and ${target} takes ${max}. Drop one, or leave ${target} off this one.`,
      };
      continue;
    }

    const input = {
      channelId: channel.id,
      text: caption,
      assets: urls.map((url) => ({ image: { url } })),
      schedulingType: 'automatic',
      mode: future ? 'customScheduled' : 'shareNow',
      ...(future ? { dueAt: new Date(scheduleFor).toISOString() } : {}),
    };

    const got = await graphql(key, CREATE, { input }, fetcher);
    if (got.error) { out[target] = { ok: false, error: got.error }; continue; }

    const said = got.data?.createPost;
    if (said?.message) { out[target] = { ok: false, error: said.message }; continue; }
    if (!said?.post?.id) {
      out[target] = { ok: false, error: 'Buffer answered without a post id.' };
      continue;
    }
    out[target] = { ok: true, id: said.post.id, via: 'buffer', as: channel.name };
  }
  return out;
}

/** What a slide's URL says it is. Unknown extensions are not guessed at. */
const mimeOf = (url) => {
  const ext = String(url).split('?')[0].split('.').pop().toLowerCase();
  return { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
           webp: 'image/webp' }[ext] ?? null;
};

const skipAll = (targets, error) =>
  Object.fromEntries(targets.map((t) => [t, { ok: false, skipped: true, error }]));

const failAll = (targets, error) =>
  Object.fromEntries(targets.map((t) => [t, { ok: false, error }]));

/** A setting rather than "is the key present": switching back has to be
    a decision, not a side effect of deleting a secret. */
export async function postingRoute(db, getSetting) {
  const v = String((await getSetting(db, 'post.route')) ?? 'direct').toLowerCase();
  return v === 'buffer' ? 'buffer' : 'direct';
}
