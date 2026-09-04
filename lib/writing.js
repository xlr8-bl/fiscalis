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
export function writingBrief() {
  return {
    what_this_is:
      'The journal on web3ashley.com. Each post takes one specific way a small '
      + 'business loses customers online, says what it costs, and says how to check '
      + 'and fix it. The reader is the owner, not a developer.',

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
      title: 'Under 70 characters. A claim or a question, not a topic label.',
      description:
        '140 to 165 characters. This is the search result. It has to make sense on '
        + 'its own, to somebody who has not seen the title.',
      opening: 'Two or three lines, no heading. The situation, from the reader\'s side.',
      body: 'Sections under sentence-case ## headings. One pulled line as a > quote, at most.',
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
      'writing_brief, once, so you know what this is.',
      'voice_rules, once, so you know what will be refused.',
      'find_photo for the subject, then keep_photo on the one you want.',
      'write_article with the draft and the cover. Fix any refusal and call it again.',
      'publish_article when you are happy with it. That one puts it on the site.',
    ],
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

export { findPhotos, keepPhoto };
