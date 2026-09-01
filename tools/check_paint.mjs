/**
 * check_paint.mjs — the free drawing path, without spending an allowance.
 *
 *   node tools/check_paint.mjs
 *
 * This is the path that exists because the paid one needs a card. What
 * matters is that it asks for a picture with no words in it, that it is
 * honest when Cloudflare says no, and that a background is never mistaken
 * for a finished slide — because a slide with no copy on it that claims
 * to be ready is one that gets approved and posted blank.
 *
 * Shapes from:
 *   https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/
 *   https://developers.cloudflare.com/workers-ai/platform/pricing/
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

const paint = await import(new URL('../lib/paint.js', import.meta.url).href);
const imagen = await import(new URL('../lib/imagen.js', import.meta.url).href);

const PIXEL = Uint8Array.from([255, 216, 255, 224]);            // a JPEG header
const B64 = btoa(String.fromCharCode(...PIXEL));

/** Stub the binding and keep what it was asked for. */
const runner = (answer, sent = []) => ({
  run: async (model, input) => { sent.push({ model, input }); return answer; },
});

const slide = { prompt: 'a stopwatch on concrete', copy: '11 SECONDS', kind: 'hook' };

/* --------------------------------------------------------- the request */

await step('it runs Flux Schnell, the one inside the free allowance', async () => {
  const sent = [];
  const out = await paint.paintGround({}, { slide, runner: runner({ image: B64 }, sent) });
  is(sent[0].model, '@cf/black-forest-labs/flux-1-schnell', 'model');
  is(out.mime, 'image/jpeg', 'mime');
  is(out.bytes.length, PIXEL.length, 'decoded');
});

await step('it asks for no words in the picture', async () => {
  const sent = [];
  await paint.paintGround({}, { slide, runner: runner({ image: B64 }, sent) });
  const asked = sent[0].input.prompt;
  // whatever it writes ends up under the real copy and reads as a smudge
  if (!/no text/i.test(asked)) throw new Error(asked);
  if (!/no letters|no words/i.test(asked)) throw new Error(asked);
  if (!/no logos|no watermarks/i.test(asked)) throw new Error(asked);
});

await step("the slide's own prompt still gets through", async () => {
  const sent = [];
  await paint.paintGround({}, { slide, runner: runner({ image: B64 }, sent) });
  if (!sent[0].input.prompt.includes('a stopwatch on concrete')) throw new Error(sent[0].input.prompt);
});

await step('the copy is never sent to be drawn', async () => {
  const sent = [];
  await paint.paintGround({}, { slide, runner: runner({ image: B64 }, sent) });
  // this is the whole point of the split: typeset.js sets the words, so
  // asking Flux for them too would put a misspelled ghost underneath
  if (sent[0].input.prompt.includes('11 SECONDS')) {
    throw new Error('the copy was sent to the image model');
  }
});

await step('steps stay inside what the model accepts', async () => {
  const sent = [];
  await paint.paintGround({}, { slide, steps: 99, runner: runner({ image: B64 }, sent) });
  is(sent[0].input.steps, 8, 'clamped to the maximum');
  await paint.paintGround({}, { slide, steps: -5, runner: runner({ image: B64 }, sent) });
  is(sent[1].input.steps, 1, 'clamped to the minimum');
  await paint.paintGround({}, { slide, runner: runner({ image: B64 }, sent) });
  is(sent[2].input.steps, 4, 'the default, which is what it is priced at');
  // 0 reads as "not given" rather than "one step": a single-step render
  // is noise, so nobody asking for zero meant that
  await paint.paintGround({}, { slide, steps: 0, runner: runner({ image: B64 }, sent) });
  is(sent[3].input.steps, 4, 'zero falls to the default');
});

/* ---------------------------------------------------------- the answer */

await step('a stream is read as well as a base64 string', async () => {
  const stream = new Response(PIXEL).body;
  const out = await paint.paintGround({}, { slide, runner: { run: async () => stream } });
  is(out.mime, 'image/png', 'mime');
  is(out.bytes.length, PIXEL.length, 'bytes');
});

await step('no binding is said plainly, not thrown', async () => {
  const out = await paint.paintGround({}, { slide });
  if (!/not bound/i.test(out.error)) throw new Error(out.error);
  if (!/wrangler/i.test(out.error)) throw new Error('does not say how to fix it');
});

await step('running out of the free allowance says so, and that it resets', async () => {
  const out = await paint.paintGround({}, {
    slide,
    runner: { run: async () => { throw new Error('Rate limit exceeded (429)'); } },
  });
  if (!/10,000|allowance/i.test(out.error)) throw new Error(out.error);
  if (!/resets/i.test(out.error)) throw new Error(out.error);
});

await step('any other failure is passed through as it came', async () => {
  const out = await paint.paintGround({}, {
    slide,
    runner: { run: async () => { throw new Error('socket hang up'); } },
  });
  is(out.error, 'socket hang up', 'error');
});

await step('an answer with no image in it is an error, not a stored file', async () => {
  const out = await paint.paintGround({}, { slide, runner: { run: async () => ({ nope: 1 }) } });
  if (out.bytes) throw new Error('kept something that was not an image');
  if (!/No image came back/.test(out.error)) throw new Error(out.error);
});

/* ------------------------------------------------------- what it costs */

await step('the free path is cheap enough that the sums are not close', () => {
  const perDay = paint.NEURONS * 25;              // five carousels, five slides
  if (perDay >= paint.FREE_DAILY_NEURONS) {
    throw new Error(`${perDay} neurons a day against ${paint.FREE_DAILY_NEURONS} free`);
  }
  // not just under it, comfortably under: an allowance that runs out on a
  // busy day is a path that fails exactly when it is being relied on
  if (perDay > paint.FREE_DAILY_NEURONS / 4) {
    throw new Error(`${perDay} is too close to ${paint.FREE_DAILY_NEURONS}`);
  }
});

/* ------------------------------------------------------- which path runs */

const fake = (rows) => ({ db: {}, getSetting: async (_d, k) => rows[k] ?? null });

await step('the default is the one that needs no card', async () => {
  const out = await imagen.drawProvider(fake({}).db, {}, { getSetting: fake({}).getSetting });
  is(out.provider, 'workers', 'provider');
  is(out.source, 'default', 'source');
});

await step('the studio can switch to the paid one', async () => {
  const f = fake({ 'draw.provider': 'gemini' });
  const out = await imagen.drawProvider(f.db, {}, { getSetting: f.getSetting });
  is(out.provider, 'gemini', 'provider');
  is(out.source, 'studio', 'source');
});

await step('a provider nobody implements falls back rather than breaking', async () => {
  const f = fake({ 'draw.provider': 'midjourney' });
  const out = await imagen.drawProvider(f.db, {}, { getSetting: f.getSetting });
  is(out.provider, 'workers', 'provider');
});

/* --------------------------------------------- the frame both paths make */

const { WIDTH, HEIGHT } = await import(new URL('../assets/js/typeset.js', import.meta.url).href)
  .then((m) => m, () => ({ WIDTH: 0, HEIGHT: 0 }));

await step('the typeset frame is the frame the platforms take', async () => {
  const { problems: platformProblems } =
    await import(new URL('../assets/js/platforms.js', import.meta.url).href);
  const said = platformProblems({
    title: 'x', caption: 'y', hashtags: '', targets: ['instagram', 'tiktok'],
    slides: [0, 1].map((i) => ({
      position: i, media_key: 'k', width: WIDTH, height: HEIGHT,
      content_type: 'image/jpeg', bytes: 700 * 1024,
    })),
  });
  is(said.length, 0, `problems: ${said.join(' | ')}`);
  // and it is the same frame imagen.js asks Google for, so approval has
  // one shape to check rather than one per path
  is(`${WIDTH}x${HEIGHT}`, '1024x1280', 'the frame');
});

console.log(
  problems.length
    ? `\n${problems.length} failed: ${problems.join(', ')}`
    : '\nit draws a wordless picture for nothing, and never calls one a finished slide'
);
process.exit(problems.length ? 1 : 0);
