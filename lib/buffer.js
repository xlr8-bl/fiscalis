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

/**
 * Every channel's post in ONE document, by alias.
 *
 * GraphQL runs as many root fields as you give it in a single request, so
 * three platforms is three `createPost` calls down one connection rather
 * than three round trips. Each keeps its own variable and its own answer,
 * so a platform can still fail on its own.
 */
const createAll = (n) => {
  const args = Array.from({ length: n }, (_, i) => `$i${i}: CreatePostInput!`).join(', ');
  const fields = Array.from({ length: n }, (_, i) =>
    `p${i}: createPost(input: $i${i}) {
      ... on PostActionSuccess { post { id dueAt } }
      ... on MutationError { message }
    }`).join('\n  ');
  return `mutation CreatePost(${args}) {\n  ${fields}\n}`;
};

/* Buffer's answer to "which channels" changes when he connects or drops
   one, which is rare, so it is cached rather than asked before every
   post. Half a day: long enough that a run costs one request, short
   enough that a channel added in the morning is usable by the evening.
   Any post failure clears it, because a stale id is the likely cause. */
const CACHE_KEY = 'buffer.channels';
const TTL = 12 * 60 * 60 * 1000;

/**
 * The organization and its channels. Two calls the first time, none
 * after that until the cache goes stale.
 */
export async function channelsOf(env, {
  fetcher = fetch, getSetting, putSetting, fresh = false,
} = {}) {
  const key = env.BUFFER_API_KEY;
  if (!key) return { error: 'BUFFER_API_KEY is not set.' };

  if (!fresh && getSetting) {
    const raw = await getSetting(env.DB, CACHE_KEY);
    if (raw) {
      try {
        const held = JSON.parse(raw);
        if (Date.now() - held.at < TTL && held.channels) {
          return { org: held.org, channels: held.channels, cached: true };
        }
      } catch { /* a cache that will not parse is one to replace */ }
    }
  }

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
  if (putSetting) {
    await putSetting(env.DB, CACHE_KEY,
      JSON.stringify({ at: Date.now(), org, channels: byTarget }));
  }
  return { org, channels: byTarget };
}

/** Next run asks again. Called whenever a post failed on a channel id. */
const forget = async (env, putSetting) => {
  if (putSetting) await putSetting(env.DB, CACHE_KEY, '');
};

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
  const send = [];
  const assets = urls.map((url) => ({ image: { url } }));

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
       missing its ending, and the ending is the instruction. Per channel,
       so one platform's limit no longer speaks for the others. */
    const max = MAX_MEDIA[target] ?? 10;
    if (urls.length > max) {
      out[target] = {
        ok: false, skipped: true,
        error: `${urls.length} slides, and ${target} takes ${max}. Drop one, or leave ${target} off this one.`,
      };
      continue;
    }
    send.push({ target, channel, input: {
      channelId: channel.id,
      text: caption,
      assets,
      schedulingType: 'automatic',
      mode: future ? 'customScheduled' : 'shareNow',
      ...(future ? { dueAt: new Date(scheduleFor).toISOString() } : {}),
    } });
  }

  if (!send.length) return out;

  const vars = Object.fromEntries(send.map((s, i) => [`i${i}`, s.input]));
  const got = await graphql(key, createAll(send.length), vars, fetcher);

  if (got.error) {
    await forget(env, putSetting);
    for (const { target } of send) out[target] = { ok: false, error: got.error };
    return out;
  }

  let lost = false;
  send.forEach(({ target, channel }, i) => {
    const said = got.data?.[`p${i}`];
    if (said?.message) { out[target] = { ok: false, error: said.message }; lost = true; return; }
    if (!said?.post?.id) {
      out[target] = { ok: false, error: 'Buffer answered without a post id.' };
      lost = true;
      return;
    }
    out[target] = { ok: true, id: said.post.id, via: 'buffer', as: channel.name };
  });
  // a channel id we held may be the reason; the next run reads them again
  if (lost) await forget(env, putSetting);
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
