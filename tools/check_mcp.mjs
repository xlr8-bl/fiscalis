/**
 * check_mcp.mjs — the MCP endpoint, driven as a real client of each era.
 *
 *   npx wrangler pages dev --port 8801 \
 *     --binding STUDIO_PASSWORD=… SESSION_SECRET=… AGENT_TOKEN=…
 *   node tools/check_mcp.mjs
 *
 * Two things are being checked. The protocol, because Spark will simply
 * fail to connect if the handshake is wrong and the error will be on
 * Google's side of the wire where it cannot be read. And the ceiling,
 * because the whole reason this endpoint is safe to expose to an agent
 * that reads the open web is that it has no tool for approving, posting
 * or deleting — which is worth asserting rather than assuming.
 */

const BASE = process.env.BASE || 'http://127.0.0.1:8801';
const TOKEN = process.env.TOKEN || 'sparktoken123';
const PW = process.env.PW || 'hunter2';
const MCP = `${BASE}/mcp`;
const MODERN = '2026-07-28';

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

let n = 0;

/** A modern request: version in _meta, mirrored into the headers. */
async function modern(method, params = {}, { version = MODERN, headers = {}, notify = false } = {}) {
  const body = {
    jsonrpc: '2.0',
    ...(notify ? {} : { id: ++n }),
    method,
    params: {
      ...params,
      _meta: {
        'io.modelcontextprotocol/protocolVersion': version,
        'io.modelcontextprotocol/clientInfo': { name: 'check_mcp', version: '1.0.0' },
        'io.modelcontextprotocol/clientCapabilities': {},
      },
    },
  };
  const h = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    authorization: `Bearer ${TOKEN}`,
    'mcp-protocol-version': version,
    'mcp-method': method,
    ...(method === 'tools/call' && params.name ? { 'mcp-name': params.name } : {}),
    ...headers,
  };
  const res = await fetch(MCP, { method: 'POST', headers: h, body: JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

/** A legacy request: initialize first, no _meta. */
async function legacy(method, params = {}) {
  const res = await fetch(MCP, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++n, method, params }),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const call = (name, args = {}) => modern('tools/call', { name, arguments: args });
const structured = (r) => {
  if (r.body?.error) throw new Error(`rpc error: ${JSON.stringify(r.body.error)}`);
  const res = r.body?.result;
  if (res?.isError) throw new Error(`tool error: ${res.content?.[0]?.text}`);
  return res?.structuredContent ?? JSON.parse(res.content[0].text);
};

/* ------------------------------------------------------------------ run */

// the tables have to exist
{
  const login = await fetch(`${BASE}/api/studio/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'studio', password: PW }),
  });
  if (!login.ok) { console.error(`Cannot sign in at ${BASE}. Is the dev server up?`); process.exit(1); }
  const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
  await fetch(`${BASE}/api/studio/setup`, { method: 'POST', headers: { cookie } });
  globalThis.__cookie = cookie;
}

const made = [];

/* ------------------------------------------------------------- protocol */

await step('unauthenticated, it refuses and says how to authenticate', async () => {
  const res = await fetch(MCP, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'mcp-protocol-version': MODERN, 'mcp-method': 'ping' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping', params: {} }),
  });
  is(res.status, 401, 'status');
  if (!/Bearer/.test(res.headers.get('www-authenticate') || '')) {
    throw new Error('no WWW-Authenticate header');
  }
});

await step('a wrong token is refused', async () => {
  const res = await fetch(MCP, {
    method: 'POST',
    headers: {
      'content-type': 'application/json', authorization: 'Bearer nope',
      'mcp-protocol-version': MODERN, 'mcp-method': 'ping',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping', params: {} }),
  });
  is(res.status, 401, 'status');
});

await step('server/discover answers, as the spec requires of every server', async () => {
  const r = await modern('server/discover');
  is(r.status, 200, 'status');
  const d = r.body.result;
  if (!d.supportedVersions?.includes(MODERN)) throw new Error('does not offer 2026-07-28');
  if (!d.capabilities?.tools) throw new Error('does not declare tools');
  if (!d._meta?.['io.modelcontextprotocol/serverInfo']?.name) throw new Error('no serverInfo');
  if (!d.instructions) throw new Error('no instructions');
});

await step('a version it does not speak gets the error that lists what it does', async () => {
  const r = await modern('tools/list', {}, { version: '1900-01-01' });
  is(r.status, 400, 'status');
  is(r.body.error.code, -32022, 'code');
  if (!Array.isArray(r.body.error.data?.supported)) throw new Error('no supported list');
  is(r.body.error.data.requested, '1900-01-01', 'echoes what was asked');
});

await step('a header that disagrees with the body is refused', async () => {
  const r = await modern('tools/list', {}, { headers: { 'mcp-method': 'tools/call' } });
  is(r.status, 400, 'status');
  is(r.body.error.code, -32020, 'code');
});

await step('a missing protocol header is refused', async () => {
  const res = await fetch(MCP, {
    method: 'POST',
    headers: {
      'content-type': 'application/json', authorization: `Bearer ${TOKEN}`,
      'mcp-method': 'tools/list',
    },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'tools/list',
      params: { _meta: { 'io.modelcontextprotocol/protocolVersion': MODERN } },
    }),
  });
  is(res.status, 400, 'status');
  is((await res.json()).error.code, -32020, 'code');
});

await step('an unknown method is 404 with a JSON-RPC body', async () => {
  const r = await modern('nonsense/method');
  is(r.status, 404, 'status');
  is(r.body.error.code, -32601, 'code');
});

await step('GET and DELETE are 405 — this revision has neither', async () => {
  for (const m of ['GET', 'DELETE']) {
    const res = await fetch(MCP, { method: m, headers: { authorization: `Bearer ${TOKEN}` } });
    is(res.status, 405, m);
  }
});

await step('a notification is accepted with no body', async () => {
  const r = await modern('notifications/whatever', {}, { notify: true });
  is(r.status, 202, 'status');
  is(r.body, null, 'body');
});

await step('a legacy client can still initialize', async () => {
  const r = await legacy('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'old-client', version: '0.1.0' },
  });
  is(r.status, 200, 'status');
  is(r.body.result.protocolVersion, '2025-06-18', 'answers in the version asked for');
  if (!r.body.result.serverInfo?.name) throw new Error('no serverInfo');
});

await step('and can then list tools with no _meta at all', async () => {
  const r = await legacy('tools/list');
  is(r.status, 200, 'status');
  if (!r.body.result.tools.length) throw new Error('no tools');
});

/* ---------------------------------------------------------------- tools */

await step('tools/list describes every tool with a schema', async () => {
  const r = await modern('tools/list');
  const tools = r.body.result.tools;
  for (const t of tools) {
    if (!t.name || !t.description) throw new Error(`${t.name}: missing description`);
    if (t.inputSchema?.type !== 'object') throw new Error(`${t.name}: no object inputSchema`);
  }
  const names = tools.map((t) => t.name).sort();
  is(names.join(','),
     'brief,deliver_slide,hand_over,list_carousels,plan_carousel,post_due,queue,send_digest',
     'the tool set');
});

await step('there is no tool for approving, posting, scheduling or deleting', async () => {
  const names = (await modern('tools/list')).body.result.tools.map((t) => t.name);
  // `post_due` is a trigger, not an authority: it publishes only what a
  // person already approved and gave a slot to, and cannot reach anything
  // else. The ceiling is about deciding, not about firing.
  for (const forbidden of ['approve', 'publish', 'schedule', 'delete']) {
    const found = names.filter((x) => x.includes(forbidden));
    if (found.length) throw new Error(`exposes ${found.join(', ')}`);
  }
});

await step('an unknown tool is a protocol error, not a tool error', async () => {
  const r = await call('approve_everything');
  is(r.status, 404, 'status');
  is(r.body.error.code, -32601, 'code');
});

await step('brief returns the pillars and the kit', async () => {
  const b = structured(await call('brief'));
  if (!Array.isArray(b.pillars)) throw new Error('no pillars');
  if (!Array.isArray(b.references)) throw new Error('no references');
  is(b.slides.max, 10, 'the ceiling');
  if (!/topic/i.test(b.slides.note || '')) throw new Error('no length guidance');
});

await step('the brief hands over the voice, not just the pillars', async () => {
  const b = structured(await call('brief'));
  if (!b.voice?.person?.includes('never "we build"')) throw new Error('no person rule');
  if (!b.voice?.price) throw new Error('no price rule');
  if (!b.voice?.capability) throw new Error('no capability rule');
  if (!b.research?.needs?.length) throw new Error('no evidence standard');
  if (!b.self_check?.length) throw new Error('no self check');
  is(b.signature, 'This is the kind of thing I fix.', 'the signature line');
  if (!b.anchors?.length) throw new Error('no anchor rotation');
});

await step('off-voice copy is named the moment a plan is filed', async () => {
  const out = structured(await call('plan_carousel', {
    title: 'Our seamless solutions',
    caption: 'DM me for pricing.',
    slides: [{ kind: 'hook', copy: 'We deliver' }, { kind: 'cta', copy: 'b' }],
  }));
  made.push(out.slug);
  const said = (out.fix_before_drawing || []).join(' ');
  if (!said) throw new Error('filed an off-voice plan without a word');
  for (const want of ['seamless', 'Our', 'DM me', 'pricing', 'We']) {
    if (!said.includes(want)) throw new Error(`did not catch "${want}": ${said}`);
  }
  // it is still filed — losing a researched plan over a stray word is worse
  is(out.status, 'planned', 'status');
});

let slug = '';

await step('plan_carousel files a plan of the length it was given', async () => {
  const out = structured(await call('plan_carousel', {
    title: 'The eleven second booking page',
    pillar: 'teardowns',
    topic: 'Booking pages that take eleven seconds to load on a phone',
    research: { source: 'https://example.com/study', who: 'named researcher', year: 2025 },
    caption: 'Eleven seconds. Most people are gone before it finishes.',
    hashtags: '#webdesign #pagespeed',
    slides: [
      { kind: 'hook', copy: '11 SECONDS', prompt: 'a stopwatch' },
      { kind: 'slide', copy: 'That is the load time', prompt: 'a phone, waiting' },
      { kind: 'cta', copy: 'This is the kind of thing I fix', prompt: 'the wordmark' },
    ],
  }));
  is(out.status, 'planned', 'status');
  is(out.slides, 3, 'slides');
  slug = out.slug;
  made.push(slug);
});

await step('a plan of two slides is filed too — length follows the topic', async () => {
  const out = structured(await call('plan_carousel', {
    title: 'One number',
    slides: [{ kind: 'hook', copy: '30%' }, { kind: 'cta', copy: 'Gone to the platform' }],
  }));
  is(out.slides, 2, 'slides');
  made.push(out.slug);
});

await step('a plan of one slide is refused, and says why', async () => {
  const r = await call('plan_carousel', { title: 'Too short', slides: [{ copy: 'only one' }] });
  const res = r.body.result;
  is(res.isError, true, 'isError');
  if (!/at least 2/.test(res.content[0].text)) throw new Error(res.content[0].text);
});

await step('queue names the three slides that need drawing', async () => {
  const q = structured(await call('queue'));
  is(q.slides.filter((s) => s.carousel === slug).length, 3, 'slides queued');
});

// a real 1x1 JPEG, so the bytes and the content type are not a fiction
const JPEG_B64 =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a'
  + 'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA'
  + 'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

await step('deliver_slide takes base64 and reports what is left', async () => {
  for (const pos of [0, 1]) {
    const out = structured(await call('deliver_slide', {
      carousel: slug, position: pos,
      image_base64: JPEG_B64, mime: 'image/jpeg',
      width: 2160, height: 2700,
      qc: { likeness: 'ok', legible: true },
    }));
    is(out.ok, true, `slide ${pos}`);
    if (!out.url.includes('/media/carousels/')) throw new Error(`bad url: ${out.url}`);
  }
  const out = structured(await call('deliver_slide', {
    carousel: slug, position: 1, image_base64: JPEG_B64, width: 2160, height: 2700,
  }));
  is(out.attempts, 2, 'a redraw counts as another take');
  is(out.slides_left, 1, 'slides left');
});

await step('deliver_slide can fetch a URL instead', async () => {
  const out = structured(await call('deliver_slide', {
    carousel: slug, position: 2,
    image_url: `${BASE}/assets/stock/stock-18.jpg`,
    width: 2160, height: 2700,
  }));
  is(out.ok, true, 'ok');
  is(out.slides_left, 0, 'slides left');
  if (out.bytes < 1000) throw new Error(`suspiciously small: ${out.bytes}`);
});

await step('a URL that is not an image is refused', async () => {
  const r = await call('deliver_slide', {
    carousel: slug, position: 0, image_url: `${BASE}/book`,
  });
  is(r.body.result.isError, true, 'isError');
});

await step('hand_over moves it to review', async () => {
  const out = structured(await call('hand_over', { carousel: slug, qc: { pass: true } }));
  is(out.status, 'review', 'status');
});

await step('handing over twice says it is already with a person', async () => {
  const r = await call('hand_over', { carousel: slug });
  is(r.body.result.isError, true, 'isError');
  if (!/already with a person/.test(r.body.result.content[0].text)) {
    throw new Error(r.body.result.content[0].text);
  }
});

await step('a carousel with an undrawn slide cannot be handed over', async () => {
  const out = structured(await call('plan_carousel', {
    title: 'Half drawn',
    slides: [{ copy: 'a' }, { copy: 'b' }],
  }));
  made.push(out.slug);
  await call('deliver_slide', { carousel: out.slug, position: 0, image_base64: JPEG_B64 });
  const r = await call('hand_over', { carousel: out.slug });
  is(r.body.result.isError, true, 'isError');
  if (!/Slide 1 is not drawn/.test(r.body.result.content[0].text)) {
    throw new Error(r.body.result.content[0].text);
  }
});

await step('once a person approves it, Spark cannot touch it', async () => {
  const cookie = globalThis.__cookie;
  const me = (p, i = {}) => fetch(`${BASE}/api/studio${p}`, {
    ...i, headers: { 'content-type': 'application/json', cookie, ...(i.headers || {}) } });
  const ok = await me(`/carousels/${slug}/status`, {
    method: 'POST', body: JSON.stringify({ status: 'approved' }),
  });
  if (!ok.ok) throw new Error(`could not approve: ${await ok.text()}`);

  const r = await call('deliver_slide', {
    carousel: slug, position: 0, image_base64: JPEG_B64,
  });
  is(r.body.result.isError, true, 'delivering into an approved carousel');
  const h = await call('hand_over', { carousel: slug });
  is(h.body.result.isError, true, 'handing over an approved carousel');
});

await step('send_digest does not send a mail that would say nothing', async () => {
  const cookie = globalThis.__cookie;
  const list = await (await fetch(`${BASE}/api/studio/carousels?status=review`, { headers: { cookie } })).json();
  for (const c of list.carousels) {
    await fetch(`${BASE}/api/studio/carousels/${c.slug}/status`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ status: 'changes' }),
    });
  }
  const out = structured(await call('send_digest'));
  is(out.sent, false, 'sent');
  is(out.count, 0, 'count');
});

/* -------------------------------------------------------------- cleanup */

await step('what this run made is cleaned up', async () => {
  const cookie = globalThis.__cookie;
  for (const s of made) {
    await fetch(`${BASE}/api/studio/carousels/${s}`, { method: 'DELETE', headers: { cookie } });
  }
  const list = await (await fetch(`${BASE}/api/studio/carousels`, { headers: { cookie } })).json();
  const left = list.carousels.filter((c) => made.includes(c.slug));
  is(left.length, 0, 'left behind');
});

console.log(
  problems.length
    ? `\n${problems.length} failed: ${problems.join(', ')}`
    : '\nthe endpoint speaks both eras, and exposes nothing that can publish'
);
process.exit(problems.length ? 1 : 0);
