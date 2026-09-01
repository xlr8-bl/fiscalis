/**
 * check_oauth.mjs — the authorization flow, walked the way a client walks it.
 *
 *   npx wrangler pages dev --port 8801 --binding … \
 *     MCP_CLIENT_ID=… MCP_CLIENT_SECRET=… MCP_REDIRECT_URIS=…
 *   node tools/check_oauth.mjs
 *
 * This exists because the failure mode is invisible. If any step of the
 * discovery chain is wrong, Gemini shows "could not connect" and the real
 * error is on Google's side of the wire. So each hop is walked here in the
 * order a client walks it: 401 -> resource metadata -> AS metadata ->
 * authorize -> token -> an actual tools/call with the token it minted.
 *
 * The attacks are checked too, since an authorization server that only
 * works on the happy path is not one.
 */

const BASE = process.env.BASE || 'http://127.0.0.1:8801';
const PW = process.env.PW || 'hunter2';
const CLIENT_ID = process.env.MCP_CLIENT_ID || 'gemini-spark';
const CLIENT_SECRET = process.env.MCP_CLIENT_SECRET || 'spark-secret-value';
const REDIRECT = process.env.MCP_REDIRECT || 'https://gemini.google.com/oauth/callback';
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

const b64url = (bytes) =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** PKCE, as a client generates it. */
async function pkce() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(new Uint8Array(digest)) };
}

const form = (o) => new URLSearchParams(o).toString();

/* ------------------------------------------------------------------ run */

const discovered = {};

await step('an unauthenticated /mcp says where to authorize', async () => {
  const res = await fetch(`${BASE}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'mcp-protocol-version': MODERN, 'mcp-method': 'ping' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping', params: {} }),
  });
  is(res.status, 401, 'status');
  const h = res.headers.get('www-authenticate') || '';
  const m = /resource_metadata="([^"]+)"/.exec(h);
  if (!m) throw new Error(`no resource_metadata in: ${h}`);
  if (!/scope="/.test(h)) throw new Error('no scope hint, which the spec asks for');
  discovered.prm = m[1];
});

await step('the protected resource metadata names an authorization server', async () => {
  const doc = await (await fetch(discovered.prm)).json();
  is(doc.resource, `${BASE}/mcp`, 'resource');
  if (!doc.authorization_servers?.length) throw new Error('no authorization_servers');
  if (!doc.scopes_supported?.length) throw new Error('no scopes_supported');
  discovered.as = doc.authorization_servers[0];
});

await step('it is also served with the resource path appended', async () => {
  const res = await fetch(`${BASE}/.well-known/oauth-protected-resource/mcp`);
  is(res.status, 200, 'status');
  is((await res.json()).resource, `${BASE}/mcp`, 'resource');
});

await step('the authorization server metadata is complete', async () => {
  const doc = await (await fetch(`${discovered.as}/.well-known/oauth-authorization-server`)).json();
  is(doc.issuer, BASE, 'issuer');
  if (!doc.authorization_endpoint || !doc.token_endpoint) throw new Error('no endpoints');
  if (!doc.code_challenge_methods_supported?.includes('S256')) {
    throw new Error('S256 not advertised, and OAuth 2.1 requires PKCE');
  }
  if (!doc.grant_types_supported?.includes('authorization_code')) throw new Error('no code grant');
  if (doc.resource_indicators_supported !== true) throw new Error('RFC 8707 not advertised');
  if (doc.authorization_response_iss_parameter_supported !== true) {
    throw new Error('RFC 9207 not advertised, but the server sends iss');
  }
  discovered.authorize = doc.authorization_endpoint;
  discovered.token = doc.token_endpoint;
});

await step('OIDC discovery answers as well, for clients that try it first', async () => {
  const res = await fetch(`${BASE}/.well-known/openid-configuration`);
  is(res.status, 200, 'status');
  is((await res.json()).issuer, BASE, 'issuer');
});

/* ---------------------------------------------------------- the refusals */

const query = (over = {}) => form({
  response_type: 'code',
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT,
  code_challenge: 'x'.repeat(43),
  code_challenge_method: 'S256',
  resource: `${BASE}/mcp`,
  state: 'abc123',
  ...over,
});

await step('an unknown client is shown an error, not redirected', async () => {
  const res = await fetch(`${discovered.authorize}?${query({ client_id: 'somebody-else' })}`,
                          { redirect: 'manual' });
  is(res.status, 400, 'status');
  if (res.headers.get('location')) throw new Error('redirected an unvalidated client');
});

await step('an unregistered redirect is refused, not bounced to', async () => {
  const res = await fetch(`${discovered.authorize}?${query({ redirect_uri: 'https://evil.example/cb' })}`,
                          { redirect: 'manual' });
  is(res.status, 400, 'status');
  const loc = res.headers.get('location') || '';
  if (loc.includes('evil.example')) throw new Error('open redirector');
});

await step('no PKCE challenge is refused', async () => {
  const res = await fetch(`${discovered.authorize}?${query({ code_challenge: '' })}`,
                          { redirect: 'manual' });
  is(res.status, 400, 'status');
});

await step('a plain challenge method is refused', async () => {
  const res = await fetch(`${discovered.authorize}?${query({ code_challenge_method: 'plain' })}`,
                          { redirect: 'manual' });
  is(res.status, 400, 'status');
});

await step('a valid request shows a password page, not a token', async () => {
  const res = await fetch(`${discovered.authorize}?${query()}`, { redirect: 'manual' });
  is(res.status, 200, 'status');
  const html = await res.text();
  if (!/Studio password/i.test(html)) throw new Error('no password field');
  if (!/cannot approve, schedule, post or delete/i.test(html)) {
    throw new Error('does not say what the token cannot do');
  }
});

/* ------------------------------------------------------------- the flow */

const pk = await pkce();
const granted = {};

await step('a wrong password does not issue a code', async () => {
  const res = await fetch(discovered.authorize, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: query({ code_challenge: pk.challenge, password: 'not-the-password' }),
    redirect: 'manual',
  });
  is(res.status, 200, 'status');
  if (res.headers.get('location')) throw new Error('issued a code for a wrong password');
});

await step('the right password redirects back with a code and an iss', async () => {
  const res = await fetch(discovered.authorize, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: query({ code_challenge: pk.challenge, password: PW }),
    redirect: 'manual',
  });
  is(res.status, 302, 'status');
  const to = new URL(res.headers.get('location'));
  is(to.origin + to.pathname, REDIRECT, 'redirected where it was told');
  is(to.searchParams.get('state'), 'abc123', 'state came back');
  is(to.searchParams.get('iss'), BASE, 'iss came back (RFC 9207)');
  granted.code = to.searchParams.get('code');
  if (!granted.code) throw new Error('no code');
});

await step('the token endpoint refuses a wrong client secret', async () => {
  const res = await fetch(discovered.token, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({
      grant_type: 'authorization_code', code: granted.code, redirect_uri: REDIRECT,
      code_verifier: pk.verifier, client_id: CLIENT_ID, client_secret: 'wrong',
    }),
  });
  is(res.status, 401, 'status');
  is((await res.json()).error, 'invalid_client', 'error');
});

await step('a wrong PKCE verifier is refused', async () => {
  const res = await fetch(discovered.token, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({
      grant_type: 'authorization_code', code: granted.code, redirect_uri: REDIRECT,
      code_verifier: 'not-the-verifier', client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
    }),
  });
  is(res.status, 400, 'status');
  is((await res.json()).error, 'invalid_grant', 'error');
});

await step('a mismatched redirect_uri is refused', async () => {
  const res = await fetch(discovered.token, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({
      grant_type: 'authorization_code', code: granted.code,
      redirect_uri: 'https://gemini.google.com/somewhere-else',
      code_verifier: pk.verifier, client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
    }),
  });
  is(res.status, 400, 'status');
});

// a fresh code, because the failed attempts above consumed the first one
await step('the code is single use — a claimed code is gone', async () => {
  const fresh = await pkce();
  const auth = await fetch(discovered.authorize, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: query({ code_challenge: fresh.challenge, password: PW }),
    redirect: 'manual',
  });
  const code = new URL(auth.headers.get('location')).searchParams.get('code');
  const body = form({
    grant_type: 'authorization_code', code, redirect_uri: REDIRECT,
    code_verifier: fresh.verifier, client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
  });
  const h = { 'content-type': 'application/x-www-form-urlencoded' };
  const first = await fetch(discovered.token, { method: 'POST', headers: h, body });
  is(first.status, 200, 'first exchange');
  const out = await first.json();
  granted.access = out.access_token;
  granted.refresh = out.refresh_token;
  is(out.token_type, 'Bearer', 'token_type');
  if (!out.expires_in) throw new Error('no expires_in');

  const second = await fetch(discovered.token, { method: 'POST', headers: h, body });
  is(second.status, 400, 'replaying the same code');
});

await step('basic auth works for the client, as advertised', async () => {
  const fresh = await pkce();
  const auth = await fetch(discovered.authorize, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: query({ code_challenge: fresh.challenge, password: PW }),
    redirect: 'manual',
  });
  const code = new URL(auth.headers.get('location')).searchParams.get('code');
  const res = await fetch(discovered.token, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
    },
    body: form({
      grant_type: 'authorization_code', code, redirect_uri: REDIRECT,
      code_verifier: fresh.verifier,
    }),
  });
  is(res.status, 200, 'status');
});

/* ------------------------------------------------------- using the token */

const callMcp = (token, method = 'tools/list', params = {}) =>
  fetch(`${BASE}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'mcp-protocol-version': MODERN,
      'mcp-method': method,
      ...(method === 'tools/call' && params.name ? { 'mcp-name': params.name } : {}),
    },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method,
      params: { ...params, _meta: { 'io.modelcontextprotocol/protocolVersion': MODERN } },
    }),
  });

await step('the minted token actually works on /mcp', async () => {
  const res = await callMcp(granted.access);
  is(res.status, 200, 'status');
  const body = await res.json();
  if (!body.result?.tools?.length) throw new Error('no tools came back');
});

await step('and can call a tool with it', async () => {
  const res = await callMcp(granted.access, 'tools/call', { name: 'brief', arguments: {} });
  is(res.status, 200, 'status');
  const body = await res.json();
  if (body.result?.isError) throw new Error(body.result.content[0].text);
});

await step('a forged token is refused', async () => {
  const [payload] = granted.access.split('.');
  const res = await callMcp(`${payload}.forgedsignature`);
  is(res.status, 401, 'status');
  if (!/invalid_token/.test(res.headers.get('www-authenticate') || '')) {
    throw new Error('does not say the token was the problem');
  }
});

await step('a refresh token cannot be used as an access token', async () => {
  const res = await callMcp(granted.refresh);
  is(res.status, 401, 'status');
});

await step('the refresh grant returns a new pair', async () => {
  const res = await fetch(discovered.token, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({
      grant_type: 'refresh_token', refresh_token: granted.refresh,
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET, resource: `${BASE}/mcp`,
    }),
  });
  is(res.status, 200, 'status');
  const out = await res.json();
  if (!out.access_token || !out.refresh_token) throw new Error('no rotated pair');
  if (out.refresh_token === granted.refresh) throw new Error('the refresh token was not rotated');
  const use = await callMcp(out.access_token);
  is(use.status, 200, 'the new access token works');
});

await step('an unsupported grant is named as such', async () => {
  const res = await fetch(discovered.token, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({
      grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
    }),
  });
  is(res.status, 400, 'status');
  is((await res.json()).error, 'unsupported_grant_type', 'error');
});

await step('the static agent token still works, for scripts', async () => {
  const res = await callMcp(process.env.TOKEN || 'sparktoken123');
  is(res.status, 200, 'status');
});

console.log(
  problems.length
    ? `\n${problems.length} failed: ${problems.join(', ')}`
    : '\nthe authorization flow works end to end, and refuses what it should'
);
process.exit(problems.length ? 1 : 0);
