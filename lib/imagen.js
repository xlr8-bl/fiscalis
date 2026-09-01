/**
 * imagen.js — drawing the slides.
 *
 * The generation layer. Spark plans a carousel in words; this turns each
 * slide's prompt into a picture, on the site, using Nano Banana Pro.
 *
 * Why here and not in Spark: Spark can make an image in its own chat, but
 * it cannot hand one to an MCP tool without carrying megabytes of base64
 * back through the conversation, per slide, every day. Moving the drawing
 * to the site turns a day's work into two calls — plan it, draw it — and
 * means the brand kit never leaves the server it lives on.
 *
 * Read off:
 *   https://ai.google.dev/gemini-api/docs/image-generation
 *   https://ai.google.dev/api/generate-content
 *
 * Two things worth knowing about the shape:
 *
 *   `responseModalities: ['IMAGE']` is what makes it return a picture
 *   rather than a description of one.
 *
 *   `imageConfig.aspectRatio` takes "4:5", which is exactly the ratio
 *   both platforms accept, so the slides come out postable rather than
 *   needing a crop nobody is watching.
 *
 * Google's own docs describe a second, newer request shape at
 * /v1beta/interactions. This uses generateContent, which is the one the
 * REST reference documents and the one whose response path — candidates
 * → content → parts → inline_data — both pages agree on. The endpoint
 * and model are configurable so a move does not need a code change.
 */

const HOST = 'https://generativelanguage.googleapis.com';

/*
 * Which model draws, and what it costs.
 *
 * There is no free tier on any of these. Google's pricing page lists no
 * free allowance for image generation, and since March 2026 the $300
 * Cloud trial credit cannot be spent on the Gemini API either. A Google
 * AI Pro subscription is for the Gemini app and buys nothing here. So
 * every slide is money, and the model is the biggest lever there is.
 *
 * Per 1K image, off the pricing page, and per month at five slides a
 * carousel over thirty days:
 *
 *                                 per slide   1/day   2/day   5/day
 *   gemini-3-pro-image              $0.134   $20.10  $40.20  $100.50
 *   gemini-3.1-flash-image          $0.067   $10.05  $20.10   $50.25
 *   gemini-3.1-flash-lite-image     $0.0336   $5.04  $10.08   $25.20
 *
 * The default is the middle one. Pro is twice the price for a picture
 * that will be looked at on a phone for two seconds, which is not where
 * its advantage shows. Lite is half again cheaper and worth trying, but
 * lite models fumble small type first and these slides have the copy set
 * into them, so a slide that comes back misspelled is redrawn and the
 * saving goes backwards. Middle is the one that does not need watching.
 *
 * All of it is switchable from the studio without a deployment, because
 * the right answer here is found by looking at the slides, not by
 * reasoning about it.
 *
 * https://ai.google.dev/gemini-api/docs/pricing
 */
export const MODEL = 'gemini-3.1-flash-image';   // Nano Banana 2

/** What the studio offers, cheapest last so the order reads as a price. */
export const MODELS = [
  { id: 'gemini-3-pro-image', name: 'Nano Banana Pro', per_image: 0.134 },
  { id: 'gemini-3.1-flash-image', name: 'Nano Banana 2', per_image: 0.067 },
  { id: 'gemini-3.1-flash-lite-image', name: 'Nano Banana 2 Lite', per_image: 0.0336 },
];

/*
 * 1K at 4:5 is 1024x1280: inside TikTok's 1080p cap, past Instagram's 320
 * minimum, and the right ratio for both. 2K would be 1536 wide and TikTok
 * would refuse it — bigger is not better when one platform does not
 * resize.
 */
export const SIZE = '1K';
export const RATIO = '4:5';

const b64 = (bytes) => {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(s);
};

const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** The key, from the studio first so it can be set without a deployment. */
export async function apiKey(db, env, { getSetting } = {}) {
  if (db && getSetting) {
    const stored = (await getSetting(db, 'gemini.api_key')) || '';
    if (stored.trim()) return { key: stored.trim(), source: 'studio' };
  }
  return { key: String(env.GEMINI_API_KEY || '').trim(), source: 'environment' };
}

export const model = (env) => String(env.GEMINI_IMAGE_MODEL || '').trim() || MODEL;

/**
 * The model, from the studio first, for the same reason as the key: the
 * one that suits these slides is found by drawing a carousel and looking
 * at it, and that loop should cost a tap rather than a deployment.
 *
 * An unknown id is passed through rather than refused. Google ships
 * models faster than this list is edited, and being unable to use one
 * that exists is worse than being able to type one that does not: the
 * first call says so plainly.
 */
export async function imageModel(db, env, { getSetting } = {}) {
  if (db && getSetting) {
    const stored = String((await getSetting(db, 'gemini.model')) || '').trim();
    if (stored) return { model: stored, source: 'studio' };
  }
  const fromEnv = String(env.GEMINI_IMAGE_MODEL || '').trim();
  return fromEnv
    ? { model: fromEnv, source: 'environment' }
    : { model: MODEL, source: 'default' };
}

/** What one carousel costs to draw, for a model and a slide count. */
export const costOf = (id, slides) => {
  const known = MODELS.find((m) => m.id === id);
  return known ? known.per_image * slides : null;
};

/**
 * What the model is told, over and above the slide's own prompt.
 *
 * The references do most of the work — a likeness the model can see beats
 * any description of a face — so this says the few things a picture
 * cannot: the ratio, that the type has to be legible and spelled right,
 * and that it must not invent a logo or a watermark, which image models
 * do unprompted and which is the fastest way to look like a fake brand.
 */
function instructions({ copy, kind }) {
  return [
    'Make one social slide, portrait 4:5.',
    copy
      ? `Set this text into the image, spelled exactly and legible at phone size: "${copy}".`
      : 'No text in this one.',
    kind === 'hook' ? 'It is the first slide, so it has to stop a scroll.' : '',
    kind === 'cta' ? 'It is the last slide, so it closes.' : '',
    'Match the look of the reference images: their palette, grain and the way type sits.',
    'The person in it, if any, is the person in the likeness references.',
    'No logos, no watermarks, no invented brand marks, no borders or frames.',
  ].filter(Boolean).join(' ');
}

/**
 * Draw one slide.
 *
 * @param {object}   opts.slide  { prompt, copy, kind }
 * @param {Array}    opts.refs   [{ bytes, mime }] — the brand kit
 * @returns {Promise<{bytes?:Uint8Array, mime?:string, error?:string}>}
 */
export async function drawSlide(env, { key, model: pick, slide, refs = [], fetcher = fetch } = {}) {
  const apiKeyValue = key || String(env.GEMINI_API_KEY || '').trim();
  const using = String(pick || '').trim() || model(env);
  if (!apiKeyValue) {
    return { error: 'No Gemini API key. Set it in the studio under Social, Accounts.' };
  }

  const parts = [
    { text: [instructions(slide), slide.prompt || ''].filter(Boolean).join('\n\n') },
    // the kit, as pictures rather than adjectives
    ...refs.map((r) => ({ inline_data: { mime_type: r.mime, data: b64(r.bytes) } })),
  ];

  let json;
  try {
    const res = await fetcher(
      `${HOST}/v1beta/models/${using}:generateContent`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // the header, not ?key= — a key on the URL ends up in logs
          'x-goog-api-key': apiKeyValue,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            responseModalities: ['IMAGE'],
            imageConfig: { aspectRatio: RATIO, imageSize: SIZE },
          },
        }),
      }
    );
    json = await res.json().catch(() => ({}));
    if (json?.error) {
      return { error: `${json.error.status || res.status}: ${json.error.message || 'no message'}` };
    }
  } catch (e) {
    return { error: String(e.message || e) };
  }

  /*
   * The picture is a part among parts — the model can return prose beside
   * it — so this looks for the inline data rather than assuming part 0.
   * Both spellings, because the REST wire format is snake_case and the
   * SDKs hand back camelCase.
   */
  const found = (json?.candidates?.[0]?.content?.parts || [])
    .map((p) => p.inline_data || p.inlineData)
    .find((d) => d?.data);

  if (!found) {
    const said = (json?.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text).filter(Boolean).join(' ').slice(0, 300);
    const why = json?.candidates?.[0]?.finishReason;
    return {
      error: said ? `No image came back. It said: ${said}`
           : why ? `No image came back (${why}).`
           : 'No image came back.',
    };
  }

  try {
    return {
      bytes: unb64(found.data),
      mime: found.mime_type || found.mimeType || 'image/png',
      model: using,
    };
  } catch {
    return { error: 'The image data was not valid base64.' };
  }
}
