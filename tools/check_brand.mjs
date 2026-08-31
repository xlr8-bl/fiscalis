/**
 * check_brand.mjs — the copy rules, checked instead of remembered.
 *
 *   node tools/check_brand.mjs
 *
 * The brand spec bans a specific list of words and constructions outright.
 * A list like that is exactly the thing that holds for a week and then
 * drifts, because every individual slip looks harmless in the moment —
 * one "we", one "get in touch". So it runs here, over the shipped markup
 * and over the seed the database is built from.
 *
 * It reads text, not markup: tags, scripts, styles and inline SVG are
 * stripped first, so a class name called `solutions_wrap` is not a
 * finding and a heading that says "Solutions" is.
 *
 * What it deliberately does NOT flag:
 *
 *   ALL CAPS in a `u-text-mono` label. The spec allows caps for "mono
 *   utility labels functioning as system labels" — GMT+1 and WORKING
 *   WORLDWIDE beside it are exactly that, not emphasis.
 *
 *   "we" inside a quoted client sentence, where it is the client speaking.
 *   None exist today; if one is added, quote it and this will need to
 *   learn about it rather than being switched off.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Visible words, with everything that is not copy taken out. */
function copy(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '\n')
    // a mono label is allowed to shout; drop those elements before the
    // caps rule ever sees them
    .replace(/<[^>]*class="[^"]*u-text-mono[^"]*"[^>]*>[\s\S]*?<\/[a-z]+>/gi, '\n')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

const RULES = [
  {
    name: 'banned CTA phrases',
    why: 'the spec bans asking; availability is stated as fact',
    test: (l) =>
      /\b(dm me|let'?s talk|get in touch|book a free|free call|contact us today|reach out)\b/i.exec(l),
  },
  {
    name: 'banned marketing words',
    why: 'the spec lists these as never',
    test: (l) =>
      /\b(passionate|innovative|cutting[- ]edge|seamless|solutions|leverage|empower|world[- ]class|best[- ]in[- ]class)\b/i.exec(l),
  },
  {
    name: 'first person plural',
    why: 'one person. "I build", never "we build"',
    test: (l) => (l.split(' ').length < 30 ? /\b(we|our)\b/i.exec(l) : null),
  },
  {
    name: 'price or package language',
    why: 'no price is stated anywhere, and there are no tiers',
    test: (l) => /[$£€]\s?\d|\bpricing\b|\bpackages?\b|\btiers?\b|\brate card\b|starting at/i.exec(l),
  },
  {
    name: 'emoji',
    why: 'never, in any context',
    test: (l) => /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u.exec(l),
  },
  {
    // The branding doc is explicit that trust is earned by demonstrated
    // diagnosis and consistency, never claimed. A stated-trust phrase is
    // the exact move it says works in reverse.
    name: 'asserted trust or credentials',
    why: 'trust is inferred from the diagnosis, never stated',
    test: (l) =>
      /\b(trusted by|our values|our mission|our promise|why choose|we believe|award[- ]winning|industry[- ]leading|proven track record|years of experience)\b/i.exec(l),
  },
  {
    // A heading over a list of things that are not that thing is worse
    // than a boast: the export shipped "Awards" over a list of principles
    // and "Clients" over a list of services.
    name: 'unbacked credential heading',
    why: 'a heading claiming awards or clients needs awards or clients under it',
    test: (l) => /^(awards?|clients|testimonials|press|as seen in)$/i.exec(l),
  },
  {
    name: 'leftover placeholder',
    why: 'export scaffolding that was never replaced',
    test: (l) => /\b(placehold(er)?|lorem ipsum|your text here|tbd)\b/i.exec(l),
  },
  {
    name: 'ALL CAPS heading',
    why: 'sentence case throughout, outside mono system labels',
    test: (l) =>
      /^[A-Z][A-Z0-9 .,'’&—-]{6,}$/.test(l) && l.split(' ').length > 1 ? [l] : null,
  },
];

/** The pages, and the content the database is built from. */
const SOURCES = ['index.html', 'book.html', 'studio.html'];

const findings = [];
for (const file of SOURCES) {
  for (const line of copy(readFileSync(join(ROOT, file), 'utf8'))) {
    for (const rule of RULES) {
      const hit = rule.test(line);
      if (hit) findings.push({ file, rule: rule.name, why: rule.why, hit: hit[0], line });
    }
  }
}

// the seed carries the same copy into every database, so it is checked too
const seed = readFileSync(join(ROOT, 'lib/seed.js'), 'utf8');
for (const rule of RULES) {
  if (rule.name === 'ALL CAPS heading' || rule.name === 'first person plural') continue;
  for (const m of seed.matchAll(/"(question|answer|value)":\s*"((?:[^"\\]|\\.)*)"/g)) {
    const line = m[2].replace(/\\n/g, ' ');
    const hit = rule.test(line);
    if (hit) findings.push({ file: 'lib/seed.js', rule: rule.name, why: rule.why, hit: hit[0], line });
  }
}

const byRule = new Map();
for (const f of findings) {
  if (!byRule.has(f.rule)) byRule.set(f.rule, []);
  byRule.get(f.rule).push(f);
}

for (const rule of RULES) {
  const hits = byRule.get(rule.name) || [];
  if (!hits.length) { console.log(`  ok   ${rule.name}`); continue; }
  console.log(`  FAIL ${rule.name} — ${rule.why}`);
  for (const h of hits.slice(0, 8)) {
    console.log(`         ${h.file}  "${h.hit}"  in: ${h.line.slice(0, 88)}`);
  }
  if (hits.length > 8) console.log(`         … ${hits.length - 8} more`);
}

console.log(
  findings.length
    ? `\n${findings.length} thing${findings.length === 1 ? '' : 's'} the spec does not allow`
    : '\nthe copy holds to the spec'
);
process.exit(findings.length ? 1 : 0);
