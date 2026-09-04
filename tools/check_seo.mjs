/**
 * check_seo.mjs — the things that make a page findable, and the ones
 * that quietly stop it.
 *
 * Written after two of them were wrong at once and neither showed up
 * anywhere: /book carried noindex while the sitemap listed it, and the
 * home page's og:image was a relative path, which most scrapers do not
 * resolve — so the site's only share card never appeared on any card.
 * Both are invisible from the page itself, which is why they are here.
 *
 *   node tools/check_seo.mjs
 */
const BASE = process.env.BASE || 'http://127.0.0.1:8801';

let failed = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { console.log(`  ok    ${name}`); return; }
  failed++;
  console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
};
const get = async (path) => {
  const res = await fetch(BASE + path);
  return { status: res.status, body: await res.text() };
};
const ld = (html) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => { try { return JSON.parse(m[1]); } catch { return null; } })
    .filter(Boolean);

console.log('\nthe home page');
{
  const { body } = await get('/');
  ok('has a canonical', /<link rel="canonical" href="https:\/\/web3ashley\.com\/"/.test(body));
  ok('is not noindexed', !/name="robots"[^>]*noindex/.test(body));
  // a relative og:image is the failure this suite was written for
  const og = /<meta property="og:image" content="([^"]+)"/.exec(body)?.[1];
  ok('names its share card absolutely', Boolean(og?.startsWith('https://')), og);
  ok('gives the card its size', /og:image:width/.test(body) && /og:image:height/.test(body));
  ok('names its own URL', /<meta property="og:url"/.test(body));

  const blocks = ld(body);
  const org = blocks.find((b) => /Organization|ProfessionalService|LocalBusiness/.test(b['@type']));
  ok('declares an organisation', Boolean(org));
  // Google reads `logo` off this to decide what mark to show beside the
  // site; without it Search Console has nothing to use
  ok('and gives it a logo', Boolean(org?.logo?.url || org?.logo), JSON.stringify(org?.logo));
  const faq = blocks.find((b) => b['@type'] === 'FAQPage');
  ok('carries the FAQs as structured data', Boolean(faq?.mainEntity?.length >= 2),
     faq ? `${faq.mainEntity.length} questions` : 'none');
}

console.log('\nthe booking page');
{
  const { body } = await get('/book');
  ok('is indexable', !/name="robots"[^>]*noindex/.test(body));
  ok('has a canonical', /<link rel="canonical" href="https:\/\/web3ashley\.com\/book"/.test(body));
  ok('has a description', /<meta name="description" content="[^"]{50,}"/.test(body));
  ok('carries the site footer', /site_footer_grid/.test(body));
}

console.log('\nthe journal');
{
  const { body: index } = await get('/journal/');
  ok('the index has a visible breadcrumb', /jr_crumbs/.test(index));
  ok('and a Blog block', ld(index).some((b) => b['@type'] === 'Blog'));

  const { body: article } = await get('/journal/menu-saved-as-an-image');
  const blocks = ld(article);
  const post = blocks.find((b) => /BlogPosting|Article/.test(b['@type']));
  ok('an article declares itself', Boolean(post));
  ok('with an image', Boolean(post?.image?.length || post?.image));
  ok('with a publisher that has a logo', Boolean(post?.publisher?.logo));
  ok('with an author', Boolean(post?.author?.name));
  ok('and a breadcrumb trail', blocks.some((b) => b['@type'] === 'BreadcrumbList'));
  ok('the trail is on the page too', /jr_crumbs/.test(article));
  ok('the cover is above the article', /jr_hero/.test(article));
  ok('the card image is the cover, not the site card',
     /og:image" content="https:\/\/web3ashley\.com\/assets\/covers\//.test(article));
}

console.log('\nthe sitemap and robots');
{
  const { body: map } = await get('/sitemap.xml');
  ok('lists the booking page', map.includes('/book</loc>'));
  ok('lists the journal', map.includes('/journal/</loc>'));
  ok('carries the covers as images', /<image:loc>/.test(map));
  ok('declares the image namespace', /sitemap-image\/1\.1/.test(map));
  ok('every article has a lastmod',
     (map.match(/journal\/[a-z0-9-]+<\/loc>/g) ?? []).length
     <= (map.match(/<lastmod>/g) ?? []).length);

  const { body: robots } = await get('/robots.txt');
  ok('robots points at the sitemap', /Sitemap: https:\/\/web3ashley\.com\/sitemap\.xml/.test(robots));
  ok('robots keeps crawlers out of the API', /Disallow: \/api\//.test(robots));
  ok('and out of the studio', /Disallow: \/studio/.test(robots));
}

console.log('\nthe 404');
{
  const res = await fetch(BASE + '/no-such-page-at-all');
  ok('a wrong URL is a real 404, not the home page with a 200', res.status === 404,
     `got ${res.status}`);
}

console.log(failed ? `\n${failed} failed\n` : '\nthe site says what it is, everywhere it should\n');
process.exit(failed ? 1 : 0);
