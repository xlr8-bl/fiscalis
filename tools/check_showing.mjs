/**
 * check_showing.mjs — the switch that turns the site into a booking page.
 *
 * This is the one setting that changes what a visitor is allowed to see,
 * which makes it the one setting whose failure is silent in both
 * directions. Left on by accident it hides a finished site; failing to
 * take hold it shows a site that was meant to be hidden. Neither of those
 * announces itself, so both are asserted here.
 *
 * Four things have to move together, and they live in four files:
 *
 *   the home page      drops five sections and every link into them
 *   the journal        answers 302, and keeps answering a preview link
 *   the sitemap        stops offering crawlers URLs that redirect
 *   turning it off     puts all of it back, immediately rather than
 *                      whenever the edge cache happens to expire
 *
 * It leaves the setting as it found it, including when an assertion
 * throws, because a check that can leave a site hidden is worse than no
 * check at all.
 *
 *     ./tools/dev.sh
 *     node tools/check_showing.mjs
 *
 *   BASE   where the site is       (default http://127.0.0.1:8801)
 *   PW     the studio password     (default hunter2)
 */
const BASE = process.env.BASE || 'http://127.0.0.1:8801';
const PW = process.env.PW || 'hunter2';
const API = `${BASE}/api/studio`;

let cookie = '';
const problems = [];

const step = async (name, fn) => {
  try { await fn(); console.log('  ok    ' + name); }
  catch (e) {
    console.log('  FAIL  ' + name + ' — ' + String(e.message).split('\n')[0]);
    problems.push(name);
  }
};
const has = (hay, needle, what) => {
  if (!hay.includes(needle)) throw new Error(`${what}: no ${needle}`);
};
const hasnt = (hay, needle, what) => {
  if (hay.includes(needle)) throw new Error(`${what}: still has ${needle}`);
};

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
await fetch(`${API}/setup`, { method: 'POST', headers: { cookie } });

const setMode = (value) =>
  fetch(`${API}/content/settings`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ 'site.bookingOnly': value }),
  });

const get = async (path, init = {}) => {
  const res = await fetch(BASE + path, { redirect: 'manual', ...init });
  return { status: res.status, to: res.headers.get('location'), text: await res.text() };
};

// whatever it was before this ran, that is what it goes back to
const before = await fetch(`${API}/content/settings`, { headers: { cookie } })
  .then((r) => r.json())
  .then((j) => j.settings?.['site.bookingOnly'] ?? 'off')
  .catch(() => 'off');

try {
  console.log('\nshowing everything');
  await setMode('off');
  await step('the home page has the work, the services and the process', async () => {
    const { text } = await get('/');
    has(text, 'works_home_wrap', 'home');
    has(text, 'services_home_wrap', 'home');
    has(text, 'process_home_wrap', 'home');
    has(text, 'href="#work"', 'home');
  });
  await step('the journal answers', async () => {
    const { status } = await get('/journal/');
    if (status !== 200) throw new Error(`journal: ${status}`);
  });
  await step('the sitemap lists it', async () => {
    const { text } = await get('/sitemap.xml');
    has(text, '/journal/', 'sitemap');
  });

  console.log('\nshowing the booking page only');
  await setMode('on');
  await step('the five sections are gone', async () => {
    const { text } = await get('/');
    for (const gone of ['works_home_wrap', 'services_home_wrap', 'process_home_wrap',
                        'problems_home_wrap', 'ash-statement']) {
      hasnt(text, gone, 'home');
    }
  });
  await step('and so is every link that pointed at one', async () => {
    const { text } = await get('/');
    for (const gone of ['href="#work"', 'href="#services"', 'href="#process"', 'href="/journal/"']) {
      hasnt(text, gone, 'home');
    }
  });
  await step('what makes someone book is still there', async () => {
    const { text } = await get('/');
    has(text, 'hero_home_wrap', 'home');     // who he is
    has(text, 'faq_home_wrap', 'home');      // the objections
    has(text, 'cta_home_wrap', 'home');      // the ask
    has(text, 'href="/book"', 'home');       // the way in
  });
  await step('an empty list item does not leave a gap in the nav', async () => {
    const { text } = await get('/');
    has(text, 'li:empty', 'home');
  });
  await step('the journal redirects to the booking page, temporarily', async () => {
    const { status, to } = await get('/journal/');
    if (status !== 302) throw new Error(`journal: ${status}, wanted 302`);
    if (to !== '/book') throw new Error(`journal went to ${to}`);
  });
  await step('so does an article', async () => {
    const { status, to } = await get('/journal/anything');
    if (status !== 302 || to !== '/book') throw new Error(`article: ${status} ${to}`);
  });
  await step('a redirect is never cached, or it outlives the mode', async () => {
    const res = await fetch(`${BASE}/journal/`, { redirect: 'manual' });
    const cache = res.headers.get('cache-control') || '';
    if (!cache.includes('no-store')) throw new Error(`cache-control: ${cache || 'none'}`);
  });
  await step('the preview link still works, so he can read a draft', async () => {
    const { status } = await get(`/journal/anything?preview=${PW}`);
    // 404 means it got past the redirect and looked for the article
    if (status === 302) throw new Error('the preview link redirected too');
  });
  await step('the sitemap stops offering the journal', async () => {
    const { text } = await get('/sitemap.xml');
    hasnt(text, '/journal', 'sitemap');
    has(text, '/book', 'sitemap');
  });

  console.log('\nturning it back off');
  await setMode('off');
  await step('the sections come back without waiting for a cache', async () => {
    const { text } = await get('/');
    has(text, 'works_home_wrap', 'home');
    has(text, 'href="#work"', 'home');
  });
  await step('and the journal answers again', async () => {
    const { status } = await get('/journal/');
    if (status !== 200) throw new Error(`journal: ${status}`);
  });
} finally {
  await setMode(before);
}

console.log(
  problems.length
    ? `\n${problems.length} wrong: ${problems.join(', ')}`
    : '\nthe site hides down to one page and comes back'
);
process.exit(problems.length ? 1 : 0);
