/**
 * check_imagen.mjs — the generation layer, without spending a call.
 *
 *   node tools/check_imagen.mjs
 *
 * This is the piece that runs unattended five times a day and costs money
 * every time it runs, so what matters is that it asks for the right thing
 * and is honest when it does not get it. A generation layer that quietly
 * stores a text apology as a JPEG is worse than one that stops.
 *
 * Shapes from:
 *   https://ai.google.dev/gemini-api/docs/image-generation
 *   https://ai.google.dev/api/generate-content
 */

const problems = [];
const step = async (name, fn) => {
  try { await fn(); console.log('  ok   ' + name); }
  catch (e) {
    console.log('  FAIL ' + name + ' — ' + String(e.message).split('\n')[0]);
    problems.push(name);
  }
};
const is = (got, want, what) => {
  if (got !== want) throw new Error(`${what}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
};

const imagen = await import(new URL('../lib/imagen.js', import.meta.url).href);

const ENV = { GEMINI_API_KEY: 'AIzaTESTKEY' };
const PIXEL = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);   // a PNG header
const B64 = btoa(String.fromCharCode(...PIXEL));

/** Stub the endpoint and keep the request for inspection. */
const stub = (body, sent = []) => async (url, init) => {
  sent.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) });
  return { ok: true, status: 200, json: async () => body };
};

const OK = { candidates: [{ content: { parts: [{ inline_data: { mime_type: 'image/png', data: B64 } }] } }] };

const slide = { prompt: 'a stopwatch, brutalist', copy: '11 SECONDS', kind: 'hook' };

/* --------------------------------------------------------- the request */

await step('it calls generateContent on the image model', async () => {
  const sent = [];
  const out = await imagen.drawSlide(ENV, { slide, fetcher: stub(OK, sent) });
  is(out.mime, 'image/png', 'mime');
  is(out.bytes.length, PIXEL.length, 'bytes came back decoded');
  is(sent[0].url,
     'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent',
     'endpoint');
});

await step('the key goes in the header, not on the URL', async () => {
  const sent = [];
  await imagen.drawSlide(ENV, { slide, fetcher: stub(OK, sent) });
  is(sent[0].headers['x-goog-api-key'], 'AIzaTESTKEY', 'header');
  // a key on the query string ends up in every log that records a URL
  if (sent[0].url.includes('key=')) throw new Error('the key is on the URL');
});

await step('it asks for an image at the ratio both platforms take', async () => {
  const sent = [];
  await imagen.drawSlide(ENV, { slide, fetcher: stub(OK, sent) });
  const cfg = sent[0].body.generationConfig;
  is(cfg.responseModalities.join(','), 'IMAGE', 'responseModalities');
  is(cfg.imageConfig.aspectRatio, '4:5', 'aspect ratio');
  // 1K at 4:5 is 1024 wide — inside TikTok's 1080 cap, which does not resize
  is(cfg.imageConfig.imageSize, '1K', 'image size');
});

await step('the slide copy is spelled out for it, verbatim', async () => {
  const sent = [];
  await imagen.drawSlide(ENV, { slide, fetcher: stub(OK, sent) });
  const text = sent[0].body.contents[0].parts[0].text;
  if (!text.includes('"11 SECONDS"')) throw new Error(text);
  if (!/spelled exactly/.test(text)) throw new Error('does not insist on the spelling');
  if (!/no watermarks/i.test(text)) throw new Error('does not rule out invented brand marks');
  if (!text.includes('a stopwatch, brutalist')) throw new Error("the slide's own prompt was dropped");
});

await step('the brand kit is sent as pictures, not adjectives', async () => {
  const sent = [];
  await imagen.drawSlide(ENV, {
    slide,
    refs: [{ bytes: PIXEL, mime: 'image/jpeg' }, { bytes: PIXEL, mime: 'image/png' }],
    fetcher: stub(OK, sent),
  });
  const parts = sent[0].body.contents[0].parts;
  is(parts.length, 3, 'one text part and two pictures');
  is(parts[1].inline_data.mime_type, 'image/jpeg', 'first reference');
  is(parts[1].inline_data.data, B64, 'sent as base64');
});

/* ---------------------------------------------------------- the answer */

await step('camelCase from an SDK-shaped answer is read too', async () => {
  const out = await imagen.drawSlide(ENV, {
    slide,
    fetcher: stub({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: B64 } }] } }] }),
  });
  is(out.mime, 'image/jpeg', 'mime');
});

await step('a picture among prose is still found', async () => {
  const out = await imagen.drawSlide(ENV, {
    slide,
    fetcher: stub({ candidates: [{ content: { parts: [
      { text: 'Here is the slide you asked for.' },
      { inline_data: { mime_type: 'image/png', data: B64 } },
    ] } }] }),
  });
  is(out.bytes.length, PIXEL.length, 'bytes');
});

await step('words instead of a picture is a failure, not a stored file', async () => {
  const out = await imagen.drawSlide(ENV, {
    slide,
    fetcher: stub({ candidates: [{ content: { parts: [{ text: 'I cannot draw that.' }] } }] }),
  });
  if (out.bytes) throw new Error('kept something that was not an image');
  if (!/I cannot draw that/.test(out.error)) throw new Error(out.error);
});

await step('a refusal reports its reason rather than an empty shrug', async () => {
  const out = await imagen.drawSlide(ENV, {
    slide,
    fetcher: stub({ candidates: [{ finishReason: 'IMAGE_SAFETY', content: { parts: [] } }] }),
  });
  if (!/IMAGE_SAFETY/.test(out.error)) throw new Error(out.error);
});

await step("Google's own error is passed through", async () => {
  const out = await imagen.drawSlide(ENV, {
    slide,
    fetcher: stub({ error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' } }),
  });
  if (!/Quota exceeded/.test(out.error)) throw new Error(out.error);
  if (!/RESOURCE_EXHAUSTED/.test(out.error)) throw new Error(out.error);
});

await step('no key is answered without calling out', async () => {
  const out = await imagen.drawSlide({}, {
    slide,
    fetcher: async () => { throw new Error('should not have been called'); },
  });
  if (!/API key/.test(out.error)) throw new Error(out.error);
});

await step('a thrown network is an error, not a crash', async () => {
  const out = await imagen.drawSlide(ENV, {
    slide,
    fetcher: async () => { throw new Error('socket hang up'); },
  });
  if (!/socket hang up/.test(out.error)) throw new Error(out.error);
});

/* --------------------------------------------------------- the key, and
   the model, both settable without a deployment */

const fake = (rows) => ({ db: {}, getSetting: async (_d, k) => rows[k] ?? null });

await step('a key set in the studio wins over the deployment', async () => {
  const f = fake({ 'gemini.api_key': 'AIzaSTUDIO' });
  const out = await imagen.apiKey(f.db, ENV, { getSetting: f.getSetting });
  is(out.key, 'AIzaSTUDIO', 'key');
  is(out.source, 'studio', 'source');
});

await step('with nothing stored the deployment is used', async () => {
  const f = fake({});
  const out = await imagen.apiKey(f.db, ENV, { getSetting: f.getSetting });
  is(out.key, 'AIzaTESTKEY', 'key');
  is(out.source, 'environment', 'source');
});

await step('the model can be moved without a code change', async () => {
  is(imagen.model(ENV), 'gemini-3-pro-image', 'the default');
  is(imagen.model({ GEMINI_IMAGE_MODEL: 'gemini-3.1-flash-image' }),
     'gemini-3.1-flash-image', 'overridden');
});

/* ------------------------------------------------- what the size means */

const { problems: platformProblems } =
  await import(new URL('../assets/js/platforms.js', import.meta.url).href);

await step('what it draws is a size both platforms accept', () => {
  // 1K at 4:5 comes back 1024x1280, and that is what draw.js records
  const said = platformProblems({
    title: 'x', caption: 'y', hashtags: '', targets: ['instagram', 'tiktok'],
    slides: [0, 1].map((i) => ({
      position: i, media_key: 'k', width: 1024, height: 1280,
      content_type: 'image/jpeg', bytes: 900 * 1024,
    })),
  });
  is(said.length, 0, `problems: ${said.join(' | ')}`);
});

console.log(
  problems.length
    ? `\n${problems.length} failed: ${problems.join(', ')}`
    : '\nit asks for the right picture, and never stores an apology as one'
);
process.exit(problems.length ? 1 : 0);
