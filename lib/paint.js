/**
 * paint.js — drawing backgrounds on Cloudflare, for nothing.
 *
 * The other half of the generation layer. imagen.js calls Google and asks
 * for a finished slide, type and all. This asks Cloudflare's own models
 * for a *background* only, and the type is set over it afterwards by
 * typeset.js.
 *
 * Why there are two.
 *
 * Every Gemini image model is pay as you go. There is no free tier, and
 * since March 2026 the $300 Cloud trial credit cannot be spent on the
 * Gemini API either. The $10 a month of Cloud credit that comes with a
 * Google AI Pro subscription is real, but Google requires a payment
 * method on the billing account before promotional credits will unlock,
 * so it cannot be reached without giving them a card.
 *
 * Workers AI needs no new billing relationship at all, because this site
 * is already on Cloudflare. The Workers Free plan includes 10,000
 * Neurons a day. Flux Schnell costs 4.80 neurons per 512x512 tile plus
 * 9.60 per step, so one 4-step 1024x1024 image is about 58 neurons:
 * twenty-five slides a day is around 14% of the free allowance. And on
 * the Free plan, going past it fails with an error rather than billing
 * anything, so there is no bill to be surprised by.
 *
 * What it costs in quality, and why that is not a loss.
 *
 * Flux Schnell is poor at rendering text, and these slides have the copy
 * set into them. So it does not draw the copy: it draws the picture
 * behind it, and the words are typeset afterwards in the site's own
 * fonts. That is the better arrangement regardless of price. imagen.js
 * has to *ask* the model to spell the copy correctly and hope; type set
 * from the string is right every time, at a size and weight chosen
 * rather than negotiated.
 *
 * Read off:
 *   https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/
 *   https://developers.cloudflare.com/workers-ai/platform/pricing/
 */

/*
 * Flux Schnell takes `prompt` and `steps` and nothing else. There is no
 * width or height on this model, so it comes back square and typeset.js
 * fits it to the 4:5 frame. That is fine for a background, and it is the
 * cheapest thing on the list by two orders of magnitude:
 *
 *   flux-1-schnell     4.80 neurons/tile + 9.60/step   ~58 a picture
 *   phoenix-1.0        530 neurons/tile                ~2,120 a picture
 *   lucid-origin       636 neurons/tile                ~2,544 a picture
 *
 * The two Leonardo models render text well and would not need typeset.js
 * at all, but at ~2,000 neurons each the free daily allowance is four
 * pictures. They are not offered here because a model that runs out on
 * the fifth slide of the first carousel is not a choice, it is a trap.
 */
export const MODEL = '@cf/black-forest-labs/flux-1-schnell';

/*
 * Four is this model's default and eight is its maximum. Schnell is a
 * distilled model built for few steps; the difference between four and
 * eight is small and the cost doubles, since steps are charged
 * individually. Four.
 */
export const STEPS = 4;

/** About 58 neurons: 4 tiles at 4.80, plus 4 steps at 9.60. */
export const NEURONS = 58;
export const FREE_DAILY_NEURONS = 10_000;

const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/**
 * What the model is told.
 *
 * Deliberately different from imagen.js. That one has to describe the
 * type, because the model is setting it. This one has to make sure there
 * is *no* type, because anything it writes will end up underneath the
 * real copy and read as a smudge.
 */
function instructions({ prompt, kind }) {
  return [
    prompt || 'An abstract textured background.',
    'A background image with no text, no letters, no words, no numbers,',
    'no logos and no watermarks anywhere in the frame.',
    // the copy is set over the middle, so the middle wants to be quiet
    kind === 'hook'
      ? 'Bold and high contrast, with a calm uncluttered centre.'
      : 'An uncluttered centre with room for text over it.',
  ].filter(Boolean).join(' ');
}

/**
 * Draw one background.
 *
 * @returns {Promise<{bytes?:Uint8Array, mime?:string, model?:string, error?:string}>}
 */
export async function paintGround(env, { slide, model: pick, steps, runner } = {}) {
  const ai = runner || env.AI;
  if (!ai) {
    return {
      error: 'Workers AI is not bound on this deployment. Add an [ai] binding '
           + 'called AI to wrangler.toml and deploy again.',
    };
  }

  const using = String(pick || '').trim() || MODEL;
  let out;
  try {
    out = await ai.run(using, {
      prompt: instructions(slide || {}).slice(0, 2048),   // the model's own cap
      steps: Math.min(Math.max(Number(steps) || STEPS, 1), 8),
    });
  } catch (e) {
    const said = String(e?.message || e);
    // the one failure worth naming, because it is the only one that is
    // about the plan rather than the request, and it clears by itself
    return {
      error: /capacity|quota|limit|429/i.test(said)
        ? `Workers AI would not run: ${said}. The free allowance is `
          + `${FREE_DAILY_NEURONS.toLocaleString()} neurons a day and resets daily.`
        : said,
    };
  }

  /*
   * Flux returns { image: "<base64>" }; other models on the platform hand
   * back a ReadableStream instead. Both are read, because the model is
   * settable and the next one may not be a Flux.
   */
  if (out && typeof out.image === 'string') {
    try {
      return { bytes: unb64(out.image), mime: 'image/jpeg', model: using };
    } catch {
      return { error: 'What came back was not valid base64.' };
    }
  }
  if (out instanceof ReadableStream) {
    const bytes = new Uint8Array(await new Response(out).arrayBuffer());
    return bytes.byteLength
      ? { bytes, mime: 'image/png', model: using }
      : { error: 'The image stream was empty.' };
  }

  return {
    error: `No image came back from ${using}`
         + (out && typeof out === 'object' ? `: ${Object.keys(out).join(', ')}` : '.'),
  };
}
