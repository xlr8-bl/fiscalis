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

export const MODEL = 'gemini-3-pro-image';   // Nano Banana Pro

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
export async function drawSlide(env, { key, slide, refs = [], fetcher = fetch } = {}) {
  const apiKeyValue = key || String(env.GEMINI_API_KEY || '').trim();
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
      `${HOST}/v1beta/models/${model(env)}:generateContent`,
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
    return { bytes: unb64(found.data), mime: found.mime_type || found.mimeType || 'image/png' };
  } catch {
    return { error: 'The image data was not valid base64.' };
  }
}
