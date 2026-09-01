/**
 * check_social.mjs — the social pipeline, driven the way it will actually
 * be driven: as Spark over a bearer token, and as a person over a cookie.
 *
 *   npx wrangler pages dev --port 8801 \
 *     --binding STUDIO_PASSWORD=… SESSION_SECRET=… AGENT_TOKEN=…
 *   node tools/check_social.mjs
 *
 * The point of most of these is the ceiling on the agent. Spark researches
 * the open web, so anything it reads can try to instruct it; what stops
 * that reaching an audience is that its credential cannot approve, cannot
 * schedule, cannot delete, and cannot touch a carousel a person has already
 * cleared. Those four are checked here against the running API rather than
 * asserted in a comment, because that is the whole security model.
 *
 *   BASE   where the site is   (default http://127.0.0.1:8801)
 *   PW     the studio password (default hunter2)
 *   TOKEN  the agent token     (default sparktoken123)
 */

const BASE = process.env.BASE || 'http://127.0.0.1:8801';
const PW = process.env.PW || 'hunter2';
const TOKEN = process.env.TOKEN || 'sparktoken123';
const API = `${BASE}/api/studio`;

let cookie = '';
const problems = [];
const made = [];

const step = async (name, fn) => {
  try { await fn(); console.log('  ok   ' + name); }
  catch (e) {
    console.log('  FAIL ' + name + ' — ' + String(e.message).split('\n')[0]);
    problems.push(name);
  }
};
const is = (got, want, what) => {
  if (got !== want) throw new Error(`${what}: expected ${want}, got ${got}`);
};

/** As a person. */
async function person(path, init = {}) {
  const res = await fetch(API + path, {
    ...init,
    headers: { 'content-type': 'application/json', cookie, ...(init.headers || {}) },
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

/** As Spark. */
async function spark(path, init = {}) {
  const res = await fetch(API + path, {
    ...init,
    headers: {
      authorization: `Bearer ${TOKEN}`,
      ...(init.body instanceof FormData ? {} : { 'content-type': 'application/json' }),
      ...(init.headers || {}),
    },
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

/** A 1x1 PNG, so an upload is a real multipart request with real bytes. */
const PNG = Uint8Array.from(atob(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
), (c) => c.charCodeAt(0));

/* ------------------------------------------------------------------ run */

const login = await fetch(`${API}/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name: 'studio', password: PW }),
});
if (!login.ok) {
  console.error(`Cannot sign in at ${BASE}: ${login.status}. Is the dev server up?`);
  process.exit(1);
}
cookie = (login.headers.get('set-cookie') || '').split(';')[0];

// the tables have to exist before any of this means anything
await person('/setup', { method: 'POST' });

const slug = { value: '' };

await step('Spark reads the brief', async () => {
  const { status, body } = await spark('/carousels/-/brief');
  is(status, 200, 'status');
  if (!Array.isArray(body.pillars)) throw new Error('no pillars array');
  if (!Array.isArray(body.references)) throw new Error('no references array');
  if (body.slots !== 5) throw new Error(`slots: ${body.slots}`);
});

await step('a person sets the pillars', async () => {
  const { status } = await person('/carousels/-/pillars', {
    method: 'PUT',
    body: JSON.stringify({
      pillars: [
        { name: 'Teardowns', brief: 'Pull a real site apart and show the leak.' },
        { name: 'Proof', brief: 'Numbers from work that shipped.' },
      ],
    }),
  });
  is(status, 200, 'status');
  const after = await spark('/carousels/-/brief');
  is(after.body.pillars.length, 2, 'pillars in the brief');
});

await step('the agent cannot set the pillars', async () => {
  const { status } = await spark('/carousels/-/pillars', {
    method: 'PUT',
    body: JSON.stringify({ pillars: [] }),
  });
  is(status, 403, 'status');
});

await step('Spark files a plan', async () => {
  const { status, body } = await spark('/carousels', {
    method: 'POST',
    body: JSON.stringify({
      title: 'The eleven second booking page',
      pillar: 'teardowns',
      topic: 'Booking pages that take eleven seconds on a phone',
      research: { sources: ['https://example.com/one'], why: 'trending this week' },
      caption: 'Eleven seconds. That is the whole post.',
      slides: [
        { kind: 'hook', copy: '11 SECONDS', prompt: 'a stopwatch, brutalist' },
        { kind: 'slide', copy: 'That is the load time', prompt: 'a phone, waiting' },
        { kind: 'cta', copy: 'Fix yours', prompt: 'the wordmark' },
      ],
    }),
  });
  is(status, 201, 'status');
  is(body.slides, 3, 'slides filed');
  is(body.status, 'planned', 'status');
  slug.value = body.slug;
  made.push(body.slug);
});

await step('it is not on the site anywhere', async () => {
  for (const path of ['/journal/', '/sitemap.xml', '/feed.xml', '/']) {
    const res = await fetch(BASE + path);
    const text = await res.text();
    if (text.includes(slug.value)) throw new Error(`${path} mentions it`);
  }
});

await step('the agent cannot approve its own work', async () => {
  const { status } = await spark(`/carousels/${slug.value}/status`, {
    method: 'POST',
    body: JSON.stringify({ status: 'approved' }),
  });
  is(status, 400, 'status');
});

await step('the agent cannot schedule', async () => {
  const { status } = await spark(`/carousels/${slug.value}/schedule`, {
    method: 'POST',
    body: JSON.stringify({ slot: 1 }),
  });
  is(status, 403, 'status');
});

await step('the agent cannot delete', async () => {
  const { status } = await spark(`/carousels/${slug.value}`, { method: 'DELETE' });
  is(status, 403, 'status');
});

await step('the queue names every slide that needs drawing', async () => {
  const { body } = await spark('/carousels/-/queue');
  const mine = body.slides.filter((s) => s.carousel === slug.value);
  is(mine.length, 3, 'slides queued');
});

await step('Spark delivers the three images', async () => {
  for (const pos of [0, 1, 2]) {
    const form = new FormData();
    form.set('file', new File([PNG], `slide-${pos}.png`, { type: 'image/png' }));
    form.set('width', '1080');
    form.set('height', '1350');
    form.set('qc', JSON.stringify({ likeness: 'ok', legible: true }));
    const { status } = await spark(`/carousels/${slug.value}/slides/${pos}`, {
      method: 'PUT',
      body: form,
    });
    is(status, 201, `slide ${pos}`);
  }
  const { body } = await person(`/carousels/${slug.value}`);
  is(body.carousel.status, 'generating', 'carousel status');
  is(body.carousel.slides.filter((s) => s.state === 'ready').length, 3, 'ready slides');
});

await step('a qc field full of nonsense does not lose the upload', async () => {
  const form = new FormData();
  form.set('file', new File([PNG], 'slide-0.png', { type: 'image/png' }));
  form.set('qc', 'not json at all {{{');
  const { status } = await spark(`/carousels/${slug.value}/slides/0`, {
    method: 'PUT',
    body: form,
  });
  is(status, 201, 'status');
});

await step('Spark hands it over for review', async () => {
  const { status } = await spark(`/carousels/${slug.value}/status`, {
    method: 'POST',
    body: JSON.stringify({ status: 'review', qc: { pass: true } }),
  });
  is(status, 200, 'status');
});

await step('it shows up in what is waiting on a person', async () => {
  const { body } = await person('/carousels?status=review');
  if (!body.carousels.some((c) => c.slug === slug.value)) throw new Error('not in the review list');
});

await step('asking for one slide again does not touch the others', async () => {
  const before = await person(`/carousels/${slug.value}`);
  const keys = before.body.carousel.slides.map((s) => s.media_key);

  const { status } = await person(`/carousels/${slug.value}/slides/1/redo`, {
    method: 'POST',
    body: JSON.stringify({ note: 'the type is unreadable on the dark half' }),
  });
  is(status, 200, 'status');

  const after = await person(`/carousels/${slug.value}`);
  const slides = after.body.carousel.slides;
  is(after.body.carousel.status, 'changes', 'carousel follows the slide');
  is(slides[1].state, 'redo', 'the flagged slide');
  is(slides[0].state, 'ready', 'slide 0 untouched');
  is(slides[2].state, 'ready', 'slide 2 untouched');
  if (slides[0].media_key !== keys[0]) throw new Error('slide 0 lost its picture');
  if (slides[2].media_key !== keys[2]) throw new Error('slide 2 lost its picture');
});

await step('Spark finds exactly that slide, with the note', async () => {
  const { body } = await spark('/carousels/-/queue');
  const mine = body.slides.filter((s) => s.carousel === slug.value);
  is(mine.length, 1, 'slides queued');
  is(mine[0].position, 1, 'which slide');
  if (!mine[0].note.includes('unreadable')) throw new Error('the note did not reach it');
});

await step('a half-drawn batch cannot be approved', async () => {
  const { status, body } = await person(`/carousels/${slug.value}/status`, {
    method: 'POST',
    body: JSON.stringify({ status: 'approved' }),
  });
  is(status, 400, 'status');
  if (!/not ready/.test(body.error || '')) throw new Error(`unhelpful: ${body.error}`);
});

await step('Spark redraws it and hands it back', async () => {
  const form = new FormData();
  form.set('file', new File([PNG], 'slide-1.png', { type: 'image/png' }));
  form.set('width', '1080');
  form.set('height', '1350');
  await spark(`/carousels/${slug.value}/slides/1`, { method: 'PUT', body: form });
  const { status } = await spark(`/carousels/${slug.value}/status`, {
    method: 'POST',
    body: JSON.stringify({ status: 'review' }),
  });
  is(status, 200, 'status');
  const { body } = await person(`/carousels/${slug.value}`);
  is(body.carousel.slides[1].state, 'ready', 'slide 1');
  is(body.carousel.slides[1].attempts, 2, 'attempts counted');
});

await step('a carousel with no caption cannot be approved', async () => {
  await person(`/carousels/${slug.value}`, {
    method: 'PUT',
    body: JSON.stringify({ caption: '' }),
  });
  const { status, body } = await person(`/carousels/${slug.value}/status`, {
    method: 'POST',
    body: JSON.stringify({ status: 'approved' }),
  });
  is(status, 400, 'status');
  if (!/caption/i.test(body.error || '')) throw new Error(`unhelpful: ${body.error}`);
  await person(`/carousels/${slug.value}`, {
    method: 'PUT',
    body: JSON.stringify({ caption: 'Eleven seconds. That is the whole post.' }),
  });
});

/*
 * What the platforms themselves refuse. Every number checked here came off
 * the platform's own reference page — see assets/js/platforms.js for the
 * URLs. The point of catching them at approval is that the alternative is
 * a batch that looks finished for hours and fails at its slot.
 */

await step('Instagram will not take a PNG, and it is said at approval', async () => {
  // the three slides were uploaded as PNG, which is what the masters are
  const { status, body } = await person(`/carousels/${slug.value}/status`, {
    method: 'POST',
    body: JSON.stringify({ status: 'approved' }),
  });
  is(status, 400, 'status');
  if (!/JPEG/.test(body.error || '')) throw new Error(`does not name the format: ${body.error}`);
  if (!Array.isArray(body.problems)) throw new Error('no problems array to show');
});

await step('the same batch is fine once Instagram is not a target', async () => {
  await person(`/carousels/${slug.value}`, {
    method: 'PUT',
    body: JSON.stringify({ targets: 'facebook' }),
  });
  const { status } = await person(`/carousels/${slug.value}/status`, {
    method: 'POST',
    body: JSON.stringify({ status: 'approved' }),
  });
  is(status, 200, 'status');
  // back to review for the checks below
  await person(`/carousels/${slug.value}/status`, {
    method: 'POST', body: JSON.stringify({ status: 'changes' }),
  });
  await person(`/carousels/${slug.value}/status`, {
    method: 'POST', body: JSON.stringify({ status: 'review' }),
  });
});

await step('a caption longer than Instagram allows is cut at the field', async () => {
  await person(`/carousels/${slug.value}`, {
    method: 'PUT',
    body: JSON.stringify({ targets: 'instagram', caption: 'x'.repeat(4000) }),
  });
  const { body } = await person(`/carousels/${slug.value}`);
  is(body.carousel.caption.length, 2200, 'stored caption length');
});

await step('too many hashtags is refused, with the count', async () => {
  await person(`/carousels/${slug.value}`, {
    method: 'PUT',
    body: JSON.stringify({
      caption: 'Eleven seconds.',
      hashtags: Array.from({ length: 35 }, (_, i) => `#tag${i}`).join(' '),
    }),
  });
  const { status, body } = await person(`/carousels/${slug.value}/status`, {
    method: 'POST',
    body: JSON.stringify({ status: 'approved' }),
  });
  is(status, 400, 'status');
  if (!/30 hashtags/.test((body.problems || []).join(' '))) {
    throw new Error(`does not name the limit: ${JSON.stringify(body.problems)}`);
  }
  await person(`/carousels/${slug.value}`, {
    method: 'PUT',
    body: JSON.stringify({ hashtags: '#webdesign #pagespeed' }),
  });
});

await step('a shape Instagram will not take is refused, with the size', async () => {
  // 9:16 is a Reel or a Story. A feed carousel stops at 4:5.
  const form = new FormData();
  form.set('file', new File([PNG], 's0.jpg', { type: 'image/jpeg' }));
  form.set('width', '1080');
  form.set('height', '1920');
  await spark(`/carousels/${slug.value}/slides/0`, { method: 'PUT', body: form });
  const { status, body } = await person(`/carousels/${slug.value}/status`, {
    method: 'POST',
    body: JSON.stringify({ status: 'approved' }),
  });
  is(status, 400, 'status');
  const said = (body.problems || []).join(' ');
  if (!/1080×1920/.test(said)) throw new Error(`does not say the size: ${said}`);
  if (!/4:5/.test(said)) throw new Error(`does not say the limit: ${said}`);
});

await step('a 4:5 JPEG passes every one of them', async () => {
  for (const pos of [0, 1, 2]) {
    const form = new FormData();
    form.set('file', new File([PNG], `s${pos}.jpg`, { type: 'image/jpeg' }));
    // 1080 wide because TikTok caps photos at 1080p and does not resize,
    // and 4:5 because that is the tallest a feed carousel takes. One file
    // that both platforms accept.
    form.set('width', '1080');
    form.set('height', '1350');
    const { status } = await spark(`/carousels/${slug.value}/slides/${pos}`, {
      method: 'PUT', body: form,
    });
    is(status, 201, `slide ${pos}`);
  }
  await person(`/carousels/${slug.value}`, {
    method: 'PUT',
    body: JSON.stringify({ targets: 'instagram,tiktok' }),
  });
  const { status, body } = await person(`/carousels/${slug.value}/status`, {
    method: 'POST',
    body: JSON.stringify({ status: 'approved' }),
  });
  if (status !== 200) throw new Error(`refused: ${JSON.stringify(body)}`);
  // put it back for the approval step below
  await person(`/carousels/${slug.value}/status`, {
    method: 'POST', body: JSON.stringify({ status: 'changes' }),
  });
  await person(`/carousels/${slug.value}/status`, {
    method: 'POST', body: JSON.stringify({ status: 'review' }),
  });
});

await step('a 4K master is refused while TikTok is one of the targets', async () => {
  // Instagram downscales a 4K file happily. TikTok caps photos at 1080p
  // and does not, so a master that reads as "better" is the one that
  // silently fails at the slot.
  const form = new FormData();
  form.set('file', new File([PNG], 's0.jpg', { type: 'image/jpeg' }));
  form.set('width', '2160');
  form.set('height', '2700');
  await spark(`/carousels/${slug.value}/slides/0`, { method: 'PUT', body: form });
  const { status, body } = await person(`/carousels/${slug.value}/status`, {
    method: 'POST',
    body: JSON.stringify({ status: 'approved' }),
  });
  is(status, 400, 'status');
  const said = (body.problems || []).join(' ');
  if (!/1080p/.test(said)) throw new Error(`does not name the cap: ${said}`);

  // put it back, or every step after this one fails on a slide this one left
  const good = new FormData();
  good.set('file', new File([PNG], 's0.jpg', { type: 'image/jpeg' }));
  good.set('width', '1080');
  good.set('height', '1350');
  await spark(`/carousels/${slug.value}/slides/0`, { method: 'PUT', body: good });
});

await step('off-voice copy cannot be approved either', async () => {
  await person(`/carousels/${slug.value}`, {
    method: 'PUT',
    body: JSON.stringify({ caption: 'We deliver seamless solutions. DM me.' }),
  });
  const { status, body } = await person(`/carousels/${slug.value}/status`, {
    method: 'POST',
    body: JSON.stringify({ status: 'approved' }),
  });
  is(status, 400, 'status');
  const said = (body.problems || []).join(' ');
  if (!/seamless|DM me|plural/.test(said)) throw new Error(`unhelpful: ${said}`);
  await person(`/carousels/${slug.value}`, {
    method: 'PUT',
    body: JSON.stringify({ caption: 'Eleven seconds. Most people are gone before it finishes.' }),
  });
});

await step('a person approves it', async () => {
  const { status } = await person(`/carousels/${slug.value}/status`, {
    method: 'POST',
    body: JSON.stringify({ status: 'approved' }),
  });
  is(status, 200, 'status');
});

await step('the agent cannot touch it once approved', async () => {
  const { status } = await spark(`/carousels/${slug.value}`, {
    method: 'PUT',
    body: JSON.stringify({ caption: 'something else entirely' }),
  });
  is(status, 403, 'status');
});

await step('editing a caption does not wipe the pictures', async () => {
  const { status } = await person(`/carousels/${slug.value}`, {
    method: 'PUT',
    body: JSON.stringify({ caption: 'Eleven seconds, and they are gone.' }),
  });
  is(status, 200, 'status');
  const { body } = await person(`/carousels/${slug.value}`);
  is(body.carousel.slides.length, 3, 'slides');
  is(body.carousel.slides.filter((s) => s.media_key).length, 3, 'slides with pictures');
});

await step('it takes a slot', async () => {
  const { status, body } = await person(`/carousels/${slug.value}/schedule`, {
    method: 'POST',
    body: JSON.stringify({ slot: 2, at: '2026-09-01T17:00:00Z' }),
  });
  is(status, 200, 'status');
  is(body.status, 'scheduled', 'status');
});

await step('a second post cannot take the same slot that day', async () => {
  const other = await person('/carousels', {
    method: 'POST',
    body: JSON.stringify({ title: 'Another one', caption: 'x' }),
  });
  made.push(other.body.slug);
  await person(`/carousels/${other.body.slug}/status`, {
    method: 'POST', body: JSON.stringify({ status: 'review' }),
  });
  // it has no slides, so approving must fail before the slot is even asked
  const approve = await person(`/carousels/${other.body.slug}/status`, {
    method: 'POST', body: JSON.stringify({ status: 'approved' }),
  });
  is(approve.status, 400, 'approving an empty carousel');

  const clash = await person(`/carousels/${other.body.slug}/schedule`, {
    method: 'POST',
    body: JSON.stringify({ slot: 2, at: '2026-09-01T18:00:00Z' }),
  });
  // not approved, so it is refused for that first — the slot clash is
  // checked separately below on one that is
  is(clash.status, 400, 'status');
});

await step('a slot clash is refused with the name of what has it', async () => {
  const rival = await person('/carousels', {
    method: 'POST',
    body: JSON.stringify({ title: 'The rival', caption: 'x' }),
  });
  made.push(rival.body.slug);
  // it was created by a person, so it has no slides until they are sent
  await person(`/carousels/${rival.body.slug}`, {
    method: 'PUT',
    body: JSON.stringify({
      slides: [{ kind: 'hook', copy: 'a' }, { kind: 'cta', copy: 'b' }],
    }),
  });
  // JPEG at 4:5, or the platform check refuses the approval this needs
  for (const pos of [0, 1]) {
    const form = new FormData();
    form.set('file', new File([PNG], `s${pos}.jpg`, { type: 'image/jpeg' }));
    form.set('width', '1080');
    form.set('height', '1350');
    await spark(`/carousels/${rival.body.slug}/slides/${pos}`, { method: 'PUT', body: form });
  }
  await person(`/carousels/${rival.body.slug}/status`, {
    method: 'POST', body: JSON.stringify({ status: 'review' }),
  });
  await person(`/carousels/${rival.body.slug}/status`, {
    method: 'POST', body: JSON.stringify({ status: 'approved' }),
  });
  const { status, body } = await person(`/carousels/${rival.body.slug}/schedule`, {
    method: 'POST',
    body: JSON.stringify({ slot: 2, at: '2026-09-01T18:00:00Z' }),
  });
  is(status, 409, 'status');
  if (!body.error.includes(slug.value)) throw new Error(`does not say what has it: ${body.error}`);
});

/*
 * How long a carousel runs is the topic's call. A teardown with four
 * findings is longer than a single statistic, and padding both to the
 * same length is how a set of posts starts to look like a template.
 */
await step('a carousel is as long as its topic needs', async () => {
  const lengths = [2, 5, 10];
  for (const n of lengths) {
    const { status, body } = await spark('/carousels', {
      method: 'POST',
      body: JSON.stringify({
        title: `A ${n} slide idea`,
        slides: Array.from({ length: n }, (_, i) => ({
          kind: i === 0 ? 'hook' : i === n - 1 ? 'cta' : 'slide',
          copy: `line ${i}`,
          prompt: `picture ${i}`,
        })),
      }),
    });
    is(status, 201, `filing ${n}`);
    is(body.slides, n, `slides kept for ${n}`);
    made.push(body.slug);
    const got = await person(`/carousels/${body.slug}`);
    is(got.body.carousel.slides.length, n, `slides read back for ${n}`);
  }
});

await step('past ten it is cut to what Instagram takes', async () => {
  const { body } = await spark('/carousels', {
    method: 'POST',
    body: JSON.stringify({
      title: 'A very long idea',
      slides: Array.from({ length: 16 }, (_, i) => ({ copy: `line ${i}` })),
    }),
  });
  made.push(body.slug);
  is(body.slides, 10, 'slides kept');
});

await step('the brief says the length is the topic\'s call', async () => {
  const { body } = await spark('/carousels/-/brief');
  is(body.slides.min, 2, 'min');
  is(body.slides.max, 10, 'max');
  if (!/topic/i.test(body.slides.note || '')) {
    throw new Error(`no guidance on length: ${JSON.stringify(body.slides)}`);
  }
});

/* --------------------------------------------------------------- the mail */

await step('the digest can be read without sending it', async () => {
  const { status, body } = await person('/carousels/-/digest');
  is(status, 200, 'status');
  if (!body.subject) throw new Error('no subject');
  if (typeof body.count !== 'number') throw new Error('no count');
});

await step('it names what is waiting, and links to each one', async () => {
  const one = await spark('/carousels', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Something to look at',
      pillar: 'teardowns',
      slides: [{ kind: 'hook', copy: 'a' }, { kind: 'cta', copy: 'b' }],
    }),
  });
  made.push(one.body.slug);
  await spark(`/carousels/${one.body.slug}/status`, {
    method: 'POST', body: JSON.stringify({ status: 'review' }),
  });

  const { body } = await person('/carousels/-/digest');
  if (body.count < 1) throw new Error(`counted ${body.count}`);
  if (!/\d+ carousels? to review/.test(body.subject)) {
    throw new Error(`subject does not say how many: ${body.subject}`);
  }
  if (!body.text.includes(`#/social/${one.body.slug}`)) {
    throw new Error('the text has no link to it');
  }
  if (!body.html.includes(`#/social/${one.body.slug}`)) {
    throw new Error('the html has no link to it');
  }
  if (!body.text.includes('Something to look at')) throw new Error('it is not named');
  // 2 slides, so the mail should say so rather than making you open it
  if (!/2 slides/.test(body.text)) throw new Error(`no slide count: ${body.text}`);
});

await step('Spark can ask for the mail — it ends its own cycle', async () => {
  // no RESEND_API_KEY in dev, so this reports why rather than pretending
  const { status, body } = await spark('/carousels/-/digest', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  if (status !== 502 && status !== 200) throw new Error(`unexpected ${status}`);
  if (status === 502 && !/RESEND_API_KEY/.test(body.reason || '')) {
    throw new Error(`does not say what is missing: ${body.reason}`);
  }
});

await step('a mail that would say nothing is not sent', async () => {
  // put everything back where it is not waiting on a person
  const { body: list } = await person('/carousels?status=review');
  for (const c of list.carousels) {
    await person(`/carousels/${c.slug}/status`, {
      method: 'POST', body: JSON.stringify({ status: 'changes' }),
    });
  }
  const { body } = await person('/carousels/-/digest', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  is(body.sent, false, 'sent');
  is(body.count, 0, 'count');
  if (!/[Nn]othing/.test(body.reason || '')) throw new Error(`unclear: ${body.reason}`);
});

await step('signed out, none of it answers', async () => {
  for (const path of ['/carousels', '/carousels/-/brief', '/carousels/-/queue',
                      '/carousels/-/digest']) {
    const res = await fetch(API + path);
    is(res.status, 401, path);
  }
});

/* ------------------------------------------------------------- accounts */

await step('the platform tokens are a person\'s, not the agent\'s', async () => {
  const read = await spark('/carousels/-/accounts');
  is(read.status, 403, 'the agent reading them');
  const write = await spark('/carousels/-/accounts', {
    method: 'PUT', body: JSON.stringify({ ig_token: 'stolen' }),
  });
  is(write.status, 403, 'the agent writing them');
});

await step('a token can be pasted, and reads back as connected', async () => {
  const before = await person('/carousels/-/accounts');
  is(before.status, 200, 'status');
  const { status, body } = await person('/carousels/-/accounts', {
    method: 'PUT',
    body: JSON.stringify({ ig_user_id: '1784100', ig_token: 'IGQV-test-token' }),
  });
  is(status, 200, 'saving');
  is(body.instagram.connected, true, 'connected');
  is(body.instagram.user_id, '1784100', 'user id');
  // freshly pasted means a full 60 days, not an unknown
  is(body.instagram.expires_in_days, 60, 'days left');
});

await step('an empty field does not wipe what is already there', async () => {
  const { body } = await person('/carousels/-/accounts', {
    method: 'PUT',
    body: JSON.stringify({ ig_token: '   ', tiktok_refresh_token: 'rft-test' }),
  });
  is(body.saved.includes('ig.token'), false, 'the blank one was skipped');
  is(body.instagram.connected, true, 'instagram still connected');
  is(body.tiktok.connected, true, 'tiktok now connected');
});

/* -------------------------------------------------------------- clean up */

await step('what this run made is cleaned up', async () => {
  for (const s of made) await person(`/carousels/${s}`, { method: 'DELETE' });
  const { body } = await person('/carousels');
  const left = body.carousels.filter((c) => made.includes(c.slug));
  is(left.length, 0, 'carousels left behind');
});

console.log(
  problems.length
    ? `\n${problems.length} failed: ${problems.join(', ')}`
    : '\nthe pipeline works, and the agent cannot reach past its ceiling'
);
process.exit(problems.length ? 1 : 0);
