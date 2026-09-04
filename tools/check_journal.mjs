/**
 * check_journal.mjs — Spark writing, sourcing and publishing.
 *
 * Three things are asserted here and nowhere else:
 *
 *   the voice rules are enforced, not merely described. A draft with an
 *   em dash in it has to come back refused with the line in it, because
 *   a brief the model may or may not have read is a hope.
 *
 *   exactly one tool asks. The whole point of the annotations is that a
 *   prompt still means something when it appears, and a second prompt on
 *   something harmless is how a person learns to click through them.
 *
 *   the photo search returns pictures you could actually put on a post.
 *   Its first version answered "menu on a table" with nothing at all,
 *   which is not a failure any type checker finds.
 *
 *   node tools/check_journal.mjs
 */
import { TOOLS } from '../lib/mcp.js';
import { checkDraft, writingBrief } from '../lib/writing.js';
import { judge, findTells } from '../assets/js/tells.js';
import { findPhotos } from '../lib/photos.js';

let failed = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { console.log(`  ok    ${name}`); return; }
  failed++;
  console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
};

const good = {
  title: 'Your contact form works. The notifications stopped.',
  description:
    'The form submits, the thank-you page appears, and nothing arrives. Here is how '
    + 'to test yours in five minutes, and how to know if it breaks again.',
  body: [
    'You have a contact form. It works, as far as you can tell. Somebody fills it in,',
    'the page says thank you, and that is the last anyone hears of it.',
    '',
    '## Why this fails silently',
    'Form notifications are sent from your website, not from your email account, and',
    'the two are not the same thing. When a mail provider decides your site is not',
    'allowed to send on your behalf, the mail stops. Nothing on the page changes.',
    'The visitor still gets a thank you. You still get nothing.',
    '',
    '## Test yours in five minutes',
    'Do this now, properly, rather than from memory. Open your own site on a phone,',
    'on mobile data rather than your office network. Fill the form in as a customer',
    'would, with a real address you can check. Then wait ten minutes and look, in the',
    'inbox and in the spam folder, and in whatever shared address the form claims to',
    'send to.',
    '',
    '## What it costs to leave',
    'Work out roughly what one customer is worth to you over a year. Multiply it by',
    'the number of people who filled that form in since it broke. That is the number,',
    'and for most of the businesses I have looked at it is larger than the site cost.',
    '',
    'Set a reminder to test it every quarter. It takes five minutes and it turns a',
    'six-month outage into a one-day one.',
  ].join('\n'),
};
// pad to the length floor without changing what it says
good.body += '\n\n' + ('The point is that nothing on the page tells you it broke. '
  + 'That is the whole failure, and it is why testing beats watching. ').repeat(14);

console.log('\nthe checks');
{
  const passed = checkDraft(good);
  ok('a good draft passes', passed.ok, passed.problems.join(' | '));

  const dashed = { ...good, body: good.body.replace('It works, as far as', 'It works — as far as') };
  const r = checkDraft(dashed);
  ok('an em dash is refused', !r.ok && r.problems.some((p) => /dash/i.test(p)));
  ok('and the refusal names the line', r.problems.some((p) => /^line \d+:/.test(p)));

  ok('a missing description is refused', !checkDraft({ ...good, description: '' }).ok);
  ok('a title over 70 characters is refused',
     !checkDraft({ ...good, title: 'x'.repeat(71) }).ok);
  ok('a body with no headings is refused',
     !checkDraft({ ...good, body: 'just words '.repeat(200) }).ok);
  ok('a short body is refused', !checkDraft({ ...good, body: '## a\nshort' }).ok);

  // the brand rule, which is not the humanizer's and is absolute
  const priced = { ...good, body: `${good.body}\n\nPackages start at £500.` };
  const pr = checkDraft(priced);
  ok('price language is refused', !pr.ok && pr.problems.some((p) => /price/i.test(p)));
}

console.log('\nwhat is a tell and what is not');
{
  ok('an emoji heading is a tell', !judge('## 🚀 Launch').ok);
  ok('a curly quote is a tell', !judge('He said “yes”.').ok);
  ok('Title Case In A Heading is a tell', !judge('## Strategic Negotiations And Partnerships').ok);
  ok('sentence case in a heading is not',
     judge('## What to safely ignore\n\nSome words here.').ok);
  ok('one "however" is not a tell', judge('It is slow. However, it works.').ok);
  ok('a formal word that is the right word is not a tell',
     judge('The migration is the hard part.').ok);
  // soft patterns are reported, never refused
  const soft = judge('This is a robust and seamless solution.');
  ok('a stock word is reported, not refused', soft.ok && soft.consider.length > 0);
  ok('a dash inside a code fence is left alone',
     judge('Text.\n\n```\nconst a = 1 — 2;\n```\n\nMore text.').ok);
}

console.log('\nthe brief describes what is enforced');
{
  const b = writingBrief();
  ok('the brief says no dashes', JSON.stringify(b).includes('dash'));
  ok('the brief says no price language', /price|package/i.test(JSON.stringify(b)));
  ok('the brief names the cycle', Array.isArray(b.the_cycle) && b.the_cycle.length >= 4);
  ok('the brief tells you to search for a thing, not an idea',
     /a thing, not an idea|thing rather than an idea/i.test(JSON.stringify(b)));
}

console.log('\nexactly one thing asks');
{
  const byName = Object.fromEntries(TOOLS.map((t) => [t.name, t]));
  ok('every tool is annotated', TOOLS.every((t) => t.annotations));

  // destructiveHint DEFAULTS TO TRUE in the MCP schema, so an unset one
  // is a prompt on a client that reads the fields in the wrong order
  const bare = TOOLS.filter((t) => t.annotations.destructiveHint === undefined);
  ok('no tool leaves destructiveHint unset', bare.length === 0, bare.map((t) => t.name).join(', '));
  ok('no tool leaves openWorldHint unset',
     TOOLS.every((t) => t.annotations.openWorldHint !== undefined));

  const asks = TOOLS.filter((t) => t.annotations.destructiveHint === true).map((t) => t.name).sort();
  ok('only the two publishing tools are destructive',
     asks.join(',') === 'post_due,publish_article', asks.join(', '));

  ok('publish_article is the destructive one on the journal side',
     byName.publish_article?.annotations?.destructiveHint === true);
  ok('write_article is not', byName.write_article?.annotations?.destructiveHint === false);
  ok('keep_photo is not', byName.keep_photo?.annotations?.destructiveHint === false);
  ok('find_photo only looks', byName.find_photo?.annotations?.readOnlyHint === true);
  ok('check_draft stores nothing', byName.check_draft?.annotations?.readOnlyHint === true);
  ok('nothing claims read-only and destructive at once',
     TOOLS.every((t) => !(t.annotations.readOnlyHint && t.annotations.destructiveHint)));
  ok('the tools that reach the open web say so',
     ['find_photo', 'keep_photo'].every((n) => byName[n]?.annotations?.openWorldHint === true));
}

/*
 * The search, against the real service. Skipped rather than failed when
 * the network is not there, because a check suite that goes red on a
 * flaky DNS lookup is a check suite people stop running.
 */
/*
 * The failure this catches: code ships, the column arrives when somebody
 * presses Set up, and in between every page of the journal is a 500 —
 * the index, every article, the sitemap and the feed, all at once, on a
 * site that was working a minute earlier. It was a real 500 here before
 * the fallback went in.
 *
 * A stub rather than a live database, because what is being tested is
 * the retry, and a stub is the only way to hold a database at exactly
 * "one version behind" on demand.
 */
console.log('\na database without the cover column');
{
  const { listPublished, getBySlug } = await import('../lib/articles.js');
  const rows = [{ slug: 'a', title: 'A', description: 'd', status: 'published',
                  published_at: '2026-01-01', tags: '', body: 'x' }];
  let askedForCover = 0;
  const oldDb = {
    prepare: (sql) => {
      const wantsCover = /,\s*cover\b/.test(sql);
      if (wantsCover) askedForCover++;
      const fail = () => Promise.reject(new Error('D1_ERROR: no such column: cover'));
      return {
        bind: () => ({
          all: () => (wantsCover ? fail() : Promise.resolve({ results: rows })),
          first: () => (wantsCover ? fail() : Promise.resolve(rows[0])),
        }),
      };
    },
  };

  const list = await listPublished(oldDb).catch((e) => ({ threw: String(e.message) }));
  ok('the list comes back rather than throwing', Array.isArray(list), list.threw);
  ok('it asked for the column first', askedForCover > 0);
  ok('and every row reads as having no cover',
     Array.isArray(list) && list.every((r) => r.cover === ''));

  const one = await getBySlug(oldDb, 'a').catch((e) => ({ threw: String(e.message) }));
  ok('one article comes back too', one && !one.threw, one?.threw);
  ok('with cover empty, which means the drawn one', one?.cover === '');

  // any other SQL error is still a fault and must not be swallowed
  const brokenDb = {
    prepare: () => ({ bind: () => ({
      all: () => Promise.reject(new Error('D1_ERROR: no such table: articles')),
      first: () => Promise.reject(new Error('D1_ERROR: no such table: articles')),
    }) }),
  };
  let threw = false;
  await listPublished(brokenDb).catch(() => { threw = true; });
  ok('a missing table still throws rather than being hidden', threw);
}

console.log('\nthe photo search');
{
  let live = true;
  const r = await findPhotos({}, 'menu on a table', 4).catch(() => { live = false; return null; });
  if (!live || !r) {
    console.log('  skip  the libraries are not reachable from here');
  } else {
    ok('a natural phrase finds something', r.photos.length > 0, r.note ?? '');
    ok('every candidate is landscape enough to crop to a cover',
       r.photos.every((p) => !p.height || p.width / p.height >= 1.1));
    ok('every candidate says what it is', r.photos.every((p) => p.alt && p.alt.length > 2));
    ok('every candidate carries its licence', r.photos.every((p) => p.licence));
    ok('every candidate carries a page you can check',
       r.photos.every((p) => p.page?.startsWith('http')));

    const one = await findPhotos({}, 'laptop on a desk', 3);
    ok('a second query works too', one.photos.length > 0);

    /*
     * The shape is asked for, not assumed.
     *
     * This scored for a 1200x630 cover and threw away anything taller
     * than 1.1 before ranking, which was right for the journal and meant
     * a hook sheet's portrait slot could not receive an upright
     * photograph at all — it was filled with landscape scenes that
     * happened to have a person somewhere in them.
     */
    const tall = await findPhotos({}, 'portrait of a woman face', 3, { shape: 'tall' });
    ok('asking for an upright picture gets upright pictures',
       tall.photos.length > 0
       && tall.photos.every((p) => !p.height || p.width / p.height <= 1.15),
       tall.photos.map((p) => (p.height ? (p.width / p.height).toFixed(2) : '?')).join(' '));

    const none = await findPhotos({}, '   ', 3);
    ok('an empty query says so rather than throwing',
       none.photos.length === 0 && Boolean(none.note));
  }
}

console.log(failed ? `\n${failed} failed\n` : '\nthe journal writes, sources and publishes, and one thing asks\n');
process.exit(failed ? 1 : 0);
