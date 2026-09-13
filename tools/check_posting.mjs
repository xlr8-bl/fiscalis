/**
 * check_posting.mjs — the two ways to post, and what each platform allows.
 *
 *   node tools/check_posting.mjs
 *
 * Posting is the one thing on this project that cannot be undone, and it
 * now has two buttons that differ in exactly that way. So what is
 * checked here is not that a post goes out — no account is touched — but
 * that the quiet road stays quiet and that the platforms' own rules are
 * reported rather than discovered by posting.
 *
 * Three facts from the platforms, each of which shapes a button:
 *
 *   TikTok, unaudited   every post is SELF_ONLY and the ACCOUNT must be
 *                       private. Public is not ours to offer.
 *   TikTok, stories     there is no story endpoint in the Content
 *                       Posting API at all.
 *   Instagram, private  there is no private post. Not in the API and not
 *                       in the app.
 */

import assert from 'node:assert';
import { choosePrivacy } from '../lib/tiktok.js';
import { postOne } from '../lib/publish.js';

let bad = 0;
const ok = (what, fn) => {
  try { fn(); console.log(`  ok   ${what}`); }
  catch (e) { bad++; console.log(`  FAIL ${what}\n       ${e.message}`); }
};
const okAsync = async (what, fn) => {
  try { await fn(); console.log(`  ok   ${what}`); }
  catch (e) { bad++; console.log(`  FAIL ${what}\n       ${e.message}`); }
};

/**
 * A carousel row and nothing else: nothing here reaches a platform.
 *
 * `route` is which road the settings table says to take, and it changes
 * what a rehearsal IS, so these tests name it rather than inheriting the
 * default. Buffer is the default now; direct is the road these
 * TikTok-privacy tests are about.
 */
const fakeEnv = (row, route = 'direct') => ({
  SITE: 'https://web3ashley.com',
  DB: {
    prepare: (sql) => ({
      bind: () => ({
        first: async () => (/FROM settings|settings WHERE/i.test(sql || '')
          ? { value: route } : row),
        all: async () => ({ results: [] }),
        run: async () => ({}),
      }),
      all: async () => ({ results: [] }),
      first: async () => (/FROM settings|settings WHERE/i.test(sql || '')
        ? { value: route } : row),
    }),
  },
});

const approved = {
  id: 1, slug: 'the-form', title: 'T', caption: 'c', hashtags: '',
  targets: 'instagram,tiktok', status: 'approved',
};

console.log('\nwhat a person may post, and when\n');

await okAsync('a carousel that is not approved is refused, and says so', async () => {
  for (const status of ['planned', 'review', 'changes', 'posted']) {
    const out = await postOne(fakeEnv({ ...approved, status }), 'the-form', {});
    assert.ok(out.error, `${status} was posted`);
    assert.match(out.error, /Approve it first/);
  }
});

await okAsync('a slug that does not exist is refused rather than throwing', async () => {
  const out = await postOne(fakeEnv(null), 'nope', {});
  assert.match(out.error, /No carousel by that name/);
});

console.log('\nthe quiet road stays quiet\n');

await okAsync('a rehearsal is TikTok alone, and says that is the design', async () => {
  /* Private means TikTok, because Instagram has no private post of any
     kind. Not a shortfall to apologise for — the two honest options are
     TikTok on its own or a real public post, and posting Instagram in
     public during a rehearsal is the one outcome that cannot be undone. */
  const out = await postOne(fakeEnv(approved), 'the-form', { visibility: 'test' });
  assert.equal(out.visibility, 'test');
  assert.equal(out.results.instagram.skipped, true);
  assert.match(out.results.instagram.error, /no private post/i);
  // and it says what the public button does, so the pair is legible
  assert.match(out.results.instagram.error, /publicly/);
});

await okAsync('and a public post keeps both platforms', async () => {
  const out = await postOne(fakeEnv(approved), 'the-form', { visibility: 'public' });
  assert.equal(out.visibility, 'public');
  // instagram is not filtered out of a real post, whatever else happens to it
  assert.ok(!out.results.instagram?.error?.includes('private test'),
            'Instagram was treated as a rehearsal on a public post');
});

await okAsync('a story is never part of a test post', async () => {
  const out = await postOne(fakeEnv(approved), 'the-form',
                            { visibility: 'test', story: true });
  assert.equal(out.results.story.skipped, true);
  assert.match(out.results.story.error, /public by definition/);
});

await okAsync('a story never goes up when the carousel did not', async () => {
  /* Otherwise the story points at nothing, which is worse than no
     story: it is a story about a post that is not there. */
  const out = await postOne(fakeEnv(approved), 'the-form',
                            { visibility: 'public', story: true });
  assert.equal(out.results.story.ok, false);
  assert.ok(out.results.story.skipped, 'a story was attempted after a failed post');
});

console.log('\nthrough Buffer, which is the road now\n');

await okAsync('a rehearsal is a draft, and it keeps both platforms', async () => {
  /* The difference that matters. Direct, a rehearsal is a private TikTok
     post and Instagram cannot join in. Through Buffer it is a draft,
     which every channel takes, so nothing is set aside and nothing is
     public either. */
  const out = await postOne(fakeEnv(approved, 'buffer'), 'the-form',
                            { visibility: 'test' });
  assert.equal(out.route, 'buffer');
  assert.ok(!out.results.instagram?.skipped,
            'Instagram was set aside on a road where a draft covers it');
});

await okAsync('and a draft is never reported as posted', async () => {
  /* Reporting one as posted would write posted_at, take the row off the
     board, and leave him believing a rehearsal went out. */
  const env = fakeEnv(approved, 'buffer');
  const out = await postOne(env, 'the-form', { visibility: 'test' });
  assert.notEqual(out.posted, true, 'a draft was recorded as a post');
});

console.log('\nwhat TikTok itself decides\n');

ok('an unaudited app gets the quietest level there is', () => {
  /* "All content posted by unaudited clients will be restricted to
     private viewing mode." So SELF_ONLY is not a preference. */
  const offered = ['SELF_ONLY', 'MUTUAL_FOLLOW_FRIENDS'];
  assert.equal(choosePrivacy(offered, 'SELF_ONLY').level, 'SELF_ONLY');
});

ok('asking for public when it is not offered comes back quieter, not louder', () => {
  const offered = ['SELF_ONLY', 'MUTUAL_FOLLOW_FRIENDS'];
  const got = choosePrivacy(offered, 'PUBLIC_TO_EVERYONE');
  assert.equal(got.level, 'SELF_ONLY');
  assert.equal(got.insteadOf, 'PUBLIC_TO_EVERYONE');
  // being quieter than intended is recoverable; louder is not
});

ok('and an account that offers public gets it when it is asked for', () => {
  const offered = ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'];
  assert.equal(choosePrivacy(offered, 'PUBLIC_TO_EVERYONE').level, 'PUBLIC_TO_EVERYONE');
});

ok('with nothing offered it assumes the quietest and flags the assumption', () => {
  const got = choosePrivacy([], null);
  assert.equal(got.level, 'SELF_ONLY');
  assert.equal(got.assumed, true);
});

console.log(bad
  ? `\n${bad} failed`
  : '\nthe rehearsal cannot go public and the platforms\' rules are reported');
process.exit(bad ? 1 : 0);
