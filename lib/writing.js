/**
 * writing.js — the journal, for the agent.
 *
 * Spark could already plan and design carousels. This is the same shape
 * for articles: a brief it reads, a check it can run before it commits,
 * a write, and — new — a publish.
 *
 * PUBLISHING IS THE ONE THING THAT LEAVES THE BUILDING. Everything else
 * here is reversible from the studio in a tap. So publish is the tool
 * that is declared destructive, which is what makes a client ask before
 * it runs; the rest are declared additive and do not interrupt anybody.
 * The social side is unchanged and still cannot approve, schedule, post
 * or delete a carousel — an article on your own site and a post on
 * somebody else's platform are not the same risk, and only one of them
 * is why that ceiling exists.
 *
 * The voice rules are not advice. writeArticle() runs the same detector
 * the repository's own scanner runs and refuses a draft that trips a
 * hard pattern, the way designer.js refuses a panel that cannot be
 * drawn. A brief the model may or may not have read is a hope; a refusal
 * with the line number in it is a fact it has to deal with.
 */

import { judge } from '../assets/js/tells.js';
import { slugify, uniqueSlug, getBySlug } from './articles.js';
import { findPhotos, keepPhoto } from './photos.js';

const clean = (v, max = 400) => String(v ?? '').trim().slice(0, max);
const today = () => new Date().toISOString().slice(0, 10);

/**
 * What the journal is, how it sounds, and what will be refused.
 *
 * Written as the brief a person would give, not as a schema: the model
 * reads this once at the start of a cycle and writes from it. The rules
 * that are enforced say so, because a rule the model believes is
 * optional is a rule it will break under pressure.
 */
/*
 * The subject bank.
 *
 * Spark kept writing the same article because nothing told it what had
 * already been written or where else to look. A bank of angles plus the
 * list of what exists fixes both: it can see what is taken and it has
 * somewhere specific to go next.
 *
 * `id` is matched against existing slugs and tags to work out what is
 * covered. `look_for` is the research instruction — a thing to go and
 * find out, not a topic to summarise, because "research local SEO"
 * returns the same eleven blog posts every time and "find out what a
 * plumber's listing looks like when the hours are wrong at Christmas"
 * does not.
 */
const SUBJECTS = [
  { id: 'listing', angle: 'The business listing, not the website, is what most people actually see first.',
    look_for: 'Open three listings in one trade in one town. Note what is missing, wrong or blank on each. Write from those three.' },
  { id: 'hours', angle: 'Opening hours that are wrong on the one week they matter.',
    look_for: 'Check a few local listings against a bank holiday. Find out what the platform does when hours are unset versus wrong.' },
  { id: 'form', angle: 'Contact forms that accept a message and send nothing.',
    look_for: 'Find out the current rules on sending mail from a domain you do not own: SPF, DKIM, DMARC, and what a receiving provider does with a fail.' },
  { id: 'speed', angle: 'The page is slow for the visitor and fast for the owner.',
    look_for: 'Get the current thresholds for the loading metrics Google actually reports, and what one unresized photograph weighs against a whole page budget.' },
  { id: 'fold', angle: 'What survives the first screen on a phone.',
    look_for: 'Find current phone viewport heights and work out how much of a real home page fits above the fold on the commonest one.' },
  { id: 'onejob', angle: 'A page asked to do four things does none of them.',
    look_for: 'Find three small-business pages that ask for more than one thing at once and describe exactly what the competing asks are.' },
  { id: 'photos', angle: 'Stock photography that tells the reader you are not real.',
    look_for: 'Find out what a business photograph has to show for somebody to believe the business exists. Look at what real ones have that stock ones do not.' },
  { id: 'reviews', angle: 'Reviews you never asked for, and the ask that works.',
    look_for: 'Find the current platform rules on soliciting reviews: what is allowed, what gets a listing suspended.' },
  { id: 'copy', angle: 'Words the owner uses versus words the customer searches.',
    look_for: 'Take one trade and find the gap between the term the trade uses and the term people type. Name both.' },
  { id: 'mobile', angle: 'The site was checked on a laptop and lives on a phone.',
    look_for: 'Find out the actual share of small-business traffic that is phone, from a source you can name, and what breaks first when it is not tested.' },
  { id: 'analytics', angle: 'The number in the report is not the number that pays.',
    look_for: 'Find out what a small business can measure without a tag manager and without consent friction. Name the actual tools.' },
  { id: 'booking', angle: 'The gap between wanting to book and being able to.',
    look_for: 'Count the steps, taps and fields on three real booking flows in one trade. Write from the counts.' },
  { id: 'trust', angle: 'The four things a stranger checks before they call.',
    look_for: 'Find out what people say they look for before contacting a business they have not used. Prefer a source that surveyed people over one that guessed.' },
  { id: 'maps', angle: 'The map pin on the wrong side of the street.',
    look_for: 'Find out how a pin gets placed, who can move it, and how long a correction takes to show.' },
  { id: 'accessibility', angle: 'The customers a site quietly turns away.',
    look_for: 'Find the current legal position in the UK for a small business website, and the three faults that matter most in practice.' },
  { id: 'domain', angle: 'The email address that costs you the job.',
    look_for: 'Find out what a free-provider address does to a quote in a trade where price is close. Look for something written by buyers, not sellers.' },
  { id: 'rebuild', angle: 'The redesign that gets redone in eighteen months.',
    look_for: 'Find out what a rebuild usually replaces and what it usually leaves alone. Look at what changed and what did not.' },
  { id: 'brief', angle: 'What a workable brief actually contains.',
    look_for: 'Find out what makes projects go round twice. Look for people describing their own, not agencies describing clients.' },
];

/** Case-insensitive: has anything already been written about this? */
const covered = (subject, written) => written.some(
  (a) => `${a.slug} ${a.tags} ${a.title}`.toLowerCase().includes(subject.id)
);

/**
 * What the journal is, how it sounds, what has already been said, and
 * what to go and find out next.
 *
 * Takes the database because a brief that cannot see the journal is how
 * you get the same article three times. `already_written` is the whole
 * list, and `subjects_left` is the bank with the covered ones removed.
 */
export async function writingBrief(db) {
  let written = [];
  try {
    const rows = await db.prepare(
      `SELECT slug, title, tags, status, published_at FROM articles
       ORDER BY COALESCE(published_at, updated_at) DESC LIMIT 200`
    ).all();
    written = rows?.results ?? [];
  } catch { written = []; }

  const left = SUBJECTS.filter((x) => !covered(x, written));
  const done = SUBJECTS.filter((x) => covered(x, written)).map((x) => x.id);

  return {
    what_this_is:
      'The journal on web3ashley.com. Each post takes one specific way a small '
      + 'business loses customers online, says what it costs, and says how to check '
      + 'and fix it. The reader is the owner, not a developer.',

    /* ---- the two things that stop it writing the same post again ---- */

    already_written: written.map((a) => ({
      title: a.title, slug: a.slug, tags: a.tags, status: a.status, on: a.published_at,
    })),

    do_not_repeat:
      'Read already_written before anything else. Do not write another post on a '
      + 'subject that is in there, and do not write the same post under a different '
      + 'title. If the closest thing to your idea is already in the list, either '
      + 'take a genuinely different angle on it and say in the opening what is '
      + 'different, or pick something out of subjects_left instead.',

    subjects_left: left.map((x) => ({ id: x.id, angle: x.angle, research: x.look_for })),
    subjects_covered: done,

    how_to_pick:
      'Take the first subject in subjects_left unless you have a reason not to. It '
      + 'is a list, not a menu — working down it is what stops the journal being '
      + 'four versions of the same article. If the list is empty, go back through '
      + 'already_written and find one where something has actually changed since it '
      + 'was written, and say what changed.',

    /* ------------------------------------------------------ research --- */

    research: {
      the_rule:
        'Go and find something out. Do not summarise the subject — the subject is '
        + 'already understood, that is why it is on the list. Every post needs at '
        + 'least one thing in it you had to look up or count, and the reader has to '
        + 'be able to tell which part that was.',
      what_counts: [
        'A rule, threshold or limit from the people who set it, quoted with the date you read it.',
        'Something you counted yourself: steps in a flow, fields on a form, seconds to load.',
        'Three real examples looked at side by side, described specifically.',
        'A change: what this used to be, what it is now, and when it changed.',
      ],
      what_does_not: [
        'Another blog post about the same subject. If your source is somebody else\'s '
        + 'listicle, you have not researched anything.',
        'A statistic with no origin. If you cannot name who counted it and when, leave it out.',
        'General advice that would have been true five years ago and will be in five more.',
      ],
      where:
        'The people who set the rule first: the platform\'s own documentation, the '
        + 'standard, the regulator, the changelog. Then real examples in the open. '
        + 'Forums and communities are useful for what people actually hit, not for '
        + 'what is true.',
      say_where_you_looked:
        'Name the source in the sentence rather than in a footnote: "Google\'s own '
        + 'documentation says", "I opened three of them and". A claim with no '
        + 'visible origin reads as invented, because usually it is.',
    },

    /* --------------------------------------------------------- title --- */

    title: {
      shape: 'Under 70 characters, six to twelve words. Longer wraps badly on a phone.',
      must_do: [
        'Say what the reader gets. A title is a promise, not a label — "Local SEO tips" labels, "The four listing fields that decide whether you show up" promises.',
        'Be specific enough to be falsifiable. A number, a noun, a place, a thing.',
        'Carry the words somebody would actually search, in the order they would say them.',
        'Have one angle that is yours. If the title would fit on ten other sites, it is not a title yet.',
      ],
      numbers:
        'A count is good and it has to be the real one. If the post has three '
        + 'things in it the title says three. Never round up to make it a listicle.',
      never: [
        'A colon followed by a subtitle that repeats the first half.',
        'A power word doing the work of a fact: ultimate, essential, game-changing, must-know, unlock, master.',
        'A question you do not answer in the first two paragraphs.',
        'Your own name or the business name. They are already on the page.',
        'The word "guide" unless it genuinely walks somebody through a procedure.',
      ],
      test:
        'Read the title next to the ones already in already_written. If a reader who '
        + 'had seen those would not be able to tell what is new about this one, it '
        + 'is the wrong title, and it is usually the wrong post.',
    },

    voice: {
      person: 'First person singular. I, not we. There is one person here.',
      tense: 'Present. "Your menu is a photograph", not "menus have historically been".',
      stance:
        'You have seen this happen. Say what you have seen. Where you have not, '
        + 'say what is true and leave it there.',
      length: '900 to 1,400 words. Long enough to be worth the click, short enough to finish.',
      headings: 'Sentence case. Four to seven of them. Each one says something.',
      never: [
        'No price or package language anywhere. Not a number, not a tier, not "from".',
        'Nothing invented. No statistic, date, name, quote or study that you cannot point at.',
        'No "we" and no company voice.',
        'No em dashes and no en dashes. A comma, a colon, a full stop or brackets.',
      ],
    },

    shape: {
      description:
        '140 to 165 characters. This is the search result. It has to make sense on '
        + 'its own, to somebody who has not seen the title.',
      opening:
        'Two or three lines, no heading. The situation, from the reader\'s side, in '
        + 'the concrete. Not a definition of the subject and not why it matters.',
      body:
        'Sections under sentence-case ## headings. One pulled line as a > quote, at '
        + 'most. Put the thing you looked up in the first third, not the last.',
      close: 'The last useful fact. Not a summary and not a send-off.',
      tags: 'One or two, lower case, from what already exists where it fits.',
    },

    the_check:
      'write_article runs a detector over your draft before it stores anything. '
      + 'It is built from Wikipedia\'s "Signs of AI writing" by way of the humanizer '
      + 'skill. Some patterns are refused and some are only reported. Read voice_rules '
      + 'for the full list. A refusal comes back with the line and the phrase, so fix '
      + 'that and call it again; nothing is stored until it passes.',

    the_picture:
      'Every post needs a photograph. find_photo searches a stock library and returns '
      + 'candidates; keep_photo stores the one you pick and gives you the path to set '
      + 'as `cover`. Search for a thing, not an idea: "menu on a table" finds a '
      + 'photograph and "digital transformation" does not.',

    the_cycle: [
      'writing_brief, once. Read already_written and subjects_left before you decide anything.',
      'Do the research the subject asks for. Come back with something you did not know.',
      'voice_rules, once, so you know what will be refused.',
      'find_photo for the subject, then keep_photo on the one you want.',
      'write_article with the draft and the cover. Fix any refusal and call it again.',
      'publish_article for one, publish_articles for several at once, or '
      + 'schedule_articles to put a batch out over the next few days. Those are '
      + 'the calls that ask the account holder to confirm, and each of them asks '
      + 'ONCE for the whole list.',
    ],

    on_a_schedule:
      'If a run started with writing_run rather than with somebody asking, the '
      + 'answer it gave says how many to write, which subjects to take and what to '
      + 'do at the end. Follow that rather than this list. set_writing_schedule is '
      + 'how the cadence gets set in the first place.',

    scheduling:
      'When the ask is "write a few and put them out over the next N days", write '
      + 'all the drafts first, then make ONE schedule_articles call with every '
      + 'slug in it. Do not publish them one at a time and do not schedule them '
      + 'one at a time. It spreads them at plausible times inside a daily window, '
      + 'refuses the whole batch if any slug is unknown, already published or has '
      + 'no cover, and hands back the timetable. scheduled_articles shows what is '
      + 'already queued, so read it first rather than stacking two batches onto '
      + 'the same afternoon.',
  };
}

/**
 * What to do on a scheduled writing run.
 *
 * One call for a recurring task to make. It answers three questions in
 * one round trip — is this due, what am I writing about, and what do I
 * do with it when it is written — because a task that has to make five
 * calls before it knows whether it should be running is a task that
 * burns its budget deciding not to.
 */
export async function writingRun(db, { force = false } = {}) {
  const { writingPlan, isDue, inWords, markRun } = await import('./routine.js');
  const plan = await writingPlan(db);
  const due = isDue(plan, { force });
  if (!due.due) return { run: false, plan, in_words: inWords(plan), why: due.why };

  const brief = await writingBrief(db);
  const take = brief.subjects_left.slice(0, plan.count);
  await markRun(db);

  return {
    run: true,
    why: due.why,
    in_words: inWords(plan),
    write: plan.count,
    subjects: take,
    nothing_left: take.length < plan.count
      ? 'The subject bank is shorter than this run asked for. Use already_written '
        + 'to find one where something has actually changed, and say what changed.'
      : '',
    already_written: brief.already_written,
    title: brief.title,
    research: brief.research,
    voice: brief.voice,
    shape: brief.shape,
    then: plan.then === 'publish'
      ? 'When all of them pass write_article, make ONE publish_articles call with '
        + 'every slug in it. Not one call each.'
      : plan.then === 'schedule'
        ? `When all of them pass write_article, make ONE schedule_articles call with `
          + `every slug in it, across_days: ${plan.across}. Not one call each.`
        : 'Leave them in review. A person reads them and publishes from the studio.',
    remember:
      'Do the research before you write. A run that skips it produces the article '
      + 'that was already there, which is the whole reason this is scheduled rather '
      + 'than asked for.',
  };
}

/**
 * The rules, in full, with what happens when each is broken.
 *
 * Generated from the detector rather than written out beside it, so the
 * brief cannot describe a rule the code does not enforce or miss one it
 * does.
 */
export function voiceRules() {
  // imported lazily so the brief does not drag the table in when unused
  return import('../assets/js/tells.js').then(({ TELLS }) => ({
    source:
      'Wikipedia: "Signs of AI writing", maintained by WikiProject AI Cleanup, '
      + 'by way of the humanizer skill (github.com/blader/humanizer, MIT).',
    refused: TELLS.filter((t) => t.weight === 'hard').map((t) => ({ rule: t.id, why: t.say })),
    reported: TELLS.filter((t) => t.weight === 'soft').map((t) => ({ rule: t.id, why: t.say })),
    what_is_not_a_tell: [
      'Perfect grammar. Polish is not AI.',
      'One "however". These are tells when they pile up, not in isolation.',
      'A formal word that is the right word.',
      'One short sentence for emphasis. A row of them is the tell.',
      'A repeated opening that is building rhythm on purpose.',
      'The words above inside a quotation, a title, or an example.',
    ],
    the_harder_half:
      'The detector finds phrases. It cannot find the two things that matter most: '
      + 'a claim you invented, and a paragraph that says nothing. Those are yours.',
  }));
}

/**
 * Check a draft without storing it.
 *
 * The same function write_article calls, exposed on its own so a refusal
 * costs nothing — Spark can rewrite and re-check inside one turn instead
 * of finding out after it has committed.
 */
export function checkDraft({ title, description, body, tags }) {
  const problems = [];
  const t = clean(title, 200);
  const d = clean(description, 400);
  const b = String(body ?? '');

  if (!t) problems.push('There is no title.');
  else if (t.length > 70) problems.push(`The title is ${t.length} characters; keep it under 70.`);

  if (!d) problems.push('There is no description. It is the search result, so it is not optional.');
  else if (d.length < 100) problems.push(`The description is ${d.length} characters; aim for 140 to 165.`);
  else if (d.length > 180) problems.push(`The description is ${d.length} characters and will be cut off in a result.`);

  const words = b.split(/\s+/).filter(Boolean).length;
  if (words < 500) problems.push(`The body is ${words} words. Under 500 there is not enough here to be worth a click.`);
  if (words > 2200) problems.push(`The body is ${words} words. Over about 1,400 the reader stops finishing it.`);

  if (!/^##\s+\S/m.test(b)) problems.push('There are no ## headings. Four to seven, sentence case.');

  // The price rule is the brand's, not the humanizer's, and it is
  // absolute: nothing public on this site names a number or a tier.
  const money = b.match(/\b(£|\$|€)\s?\d|(\bpackages?\b|\bpricing tiers?\b|\bstarting (?:from|at)\s*(?:£|\$|€)?\d)/i);
  if (money) problems.push(`Price language: "${money[0]}". Nothing public on this site names a price or a package.`);

  const verdict = judge(`${t}\n${d}\n${b}`);

  return {
    ok: problems.length === 0 && verdict.ok,
    problems: [...problems, ...verdict.refuse],
    consider: verdict.consider,
    words,
    reading_minutes: Math.max(1, Math.round(words / 220)),
  };
}

/**
 * Store a draft as an article in `review`.
 *
 * Review, not draft: `review` is the state the studio's overview surfaces
 * as "waiting for you to read", which is where something written by an
 * agent belongs. And not `published` — that is publishArticle's job, and
 * keeping them apart is what makes one of them the tool that asks.
 */
export async function writeArticle(env, args) {
  const checked = checkDraft(args);
  if (!checked.ok) {
    return {
      ok: false,
      stored: false,
      problems: checked.problems,
      consider: checked.consider,
      note: 'Nothing was stored. Fix these and call write_article again.',
    };
  }

  const db = env.DB;
  const title = clean(args.title, 200);
  const wanted = clean(args.slug, 120) || slugify(title);
  const existing = await getBySlug(db, wanted, { publishedOnly: false });

  const tags = (Array.isArray(args.tags) ? args.tags : String(args.tags ?? '').split(','))
    .map((t) => clean(t, 40).toLowerCase())
    .filter(Boolean)
    .slice(0, 3)
    .join(', ');

  const cover = clean(args.cover, 300);
  if (cover && !cover.startsWith('/media/') && !cover.startsWith('/assets/')) {
    return { ok: false, stored: false,
             problems: [`cover "${cover}" is not a path on this site. Use the url keep_photo gave you.`] };
  }

  if (existing) {
    // An article a person has already published is not something an
    // agent rewrites underneath them. Rewriting its own draft is fine.
    if (existing.status === 'published') {
      return {
        ok: false,
        stored: false,
        problems: [`"${wanted}" is already published. Pick another slug, or ask a person to unpublish it.`],
      };
    }
    await db
      .prepare(
        `UPDATE articles
            SET title = ?1, description = ?2, body = ?3, tags = ?4, cover = ?5,
                status = 'review', last_editor = 'spark', updated_at = datetime('now')
          WHERE id = ?6`
      )
      .bind(title, clean(args.description, 400), String(args.body ?? ''), tags, cover, existing.id)
      .run();
    return { ok: true, stored: true, slug: wanted, replaced: true,
             status: 'review', words: checked.words, consider: checked.consider,
             preview: `/journal/${wanted}?preview=1`,
             note: 'Rewritten. It is waiting for a read; publish_article puts it on the site.' };
  }

  const slug = await uniqueSlug(db, wanted);
  await db
    .prepare(
      `INSERT INTO articles (slug, title, description, body, tags, cover,
                             status, source, author, last_editor)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'review', 'spark', 'spark', 'spark')`
    )
    .bind(slug, title, clean(args.description, 400), String(args.body ?? ''), tags, cover)
    .run();

  return {
    ok: true,
    stored: true,
    slug,
    status: 'review',
    words: checked.words,
    consider: checked.consider,
    preview: `/journal/${slug}?preview=1`,
    note: 'Stored and waiting for a read. publish_article puts it on the site.',
  };
}

/**
 * Put it on the site.
 *
 * The checks run again rather than trusting that write_article ran them:
 * the row may have been edited in the studio since, and this is the last
 * gate before something is public.
 */
export async function publishArticle(env, slug) {
  const db = env.DB;
  const row = await getBySlug(db, clean(slug, 120), { publishedOnly: false });
  if (!row) return { ok: false, error: `There is no article called "${slug}".` };
  if (row.status === 'published') {
    return { ok: true, already: true, slug: row.slug, url: `/journal/${row.slug}`,
             note: 'It was already live. Nothing changed.' };
  }

  const checked = checkDraft(row);
  if (!checked.ok) {
    return {
      ok: false,
      error: 'This does not pass the checks, so it is not going on the site.',
      problems: checked.problems,
    };
  }
  if (!row.cover) {
    return {
      ok: false,
      error: 'No cover picture. find_photo, then keep_photo, then write_article with the cover set.',
    };
  }

  await db
    .prepare(
      `UPDATE articles
          SET status = 'published',
              published_at = COALESCE(published_at, ?1),
              last_editor = 'spark',
              updated_at = datetime('now')
        WHERE id = ?2`
    )
    .bind(today(), row.id)
    .run();

  return {
    ok: true,
    slug: row.slug,
    url: `/journal/${row.slug}`,
    published_at: row.published_at || today(),
    note: 'Live. It is in the sitemap and the feed on the next fetch of either.',
  };
}

/**
 * Publish several at once.
 *
 * Sequential rather than batched into one statement, because
 * publishArticle re-runs every check against each stored row and a batch
 * that skipped that would be a way round the checks rather than a
 * convenience. Everything is attempted: one refusal does not stop the
 * rest, and the answer says what happened to each.
 *
 * Unlike scheduling, this does NOT refuse the whole batch up front. A
 * schedule that half-applies leaves a timetable nobody can read; a
 * publish that half-applies leaves some articles live and a list saying
 * which, which is the truth and is actionable.
 */
export async function publishArticles(env, slugs = []) {
  const want = [...new Set(slugs.map((x) => clean(x, 120)).filter(Boolean))];
  if (!want.length) return { ok: false, error: 'No slugs given.' };
  if (want.length > 25) return { ok: false, error: 'Twenty-five at a time is the limit.' };

  const published = [];
  const refused = [];
  for (const slug of want) {
    const out = await publishArticle(env, slug);
    if (out.ok) published.push({ slug, url: out.url, already: !!out.already });
    else refused.push({ slug, why: out.error, problems: out.problems });
  }
  return {
    ok: refused.length === 0,
    published,
    refused,
    note: refused.length
      ? `${published.length} live, ${refused.length} refused. The refused ones are `
        + 'untouched: fix what is listed and call it again with just those slugs.'
      : `${published.length} live. In the sitemap and the feed on the next fetch of either.`,
  };
}

export { findPhotos, keepPhoto };
