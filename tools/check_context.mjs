/**
 * check_context.mjs — what Spark is told has to be what the server does.
 *
 *   node tools/check_context.mjs
 *
 * You cannot make a model read. What you can do is make sure that when it
 * does read, it is not being lied to, and that every rule which actually
 * matters is enforced by something other than its attention.
 *
 * So this checks the seam: the instructions against the tool table, the
 * brief against the validator, the stated ceiling against the real one.
 * The failure it exists to catch is drift — the instructions said
 * publish_article was the only tool that could make something public, and
 * that was true for about a month.
 */

import { INSTRUCTIONS, TOOLS, CAPABILITIES, SERVER_INFO } from '../lib/mcp.js';
import { AGENT_STATES } from '../lib/carousels.js';
import { voiceRules, CHECKED, RULE_NAMES, VOICE, problems } from '../assets/js/brand.js';

let bad = 0;
const ok = (what, cond, extra = '') => {
  if (!cond) bad++;
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${what}${extra ? `  — ${extra}` : ''}`);
};

const names = TOOLS.map((t) => t.name);
const destructive = TOOLS.filter((t) => t.annotations?.destructiveHint === true)
  .map((t) => t.name).sort();

console.log('\nthe instructions describe this server, not an older one');
{
  /* Every tool the prose names has to exist. A cycle that tells the agent
     to call something that was renamed is a dead end it cannot diagnose. */
  const mentioned = [...INSTRUCTIONS.matchAll(/\b([a-z][a-z0-9]*(?:_[a-z0-9]+)+)\b/g)]
    .map((m) => m[1]);
  const notTools = [...new Set(mentioned)].filter((w) => !names.includes(w));
  ok('every tool it names exists', notTools.length === 0, notTools.join(', '));

  ok('and it names the publishing tools exactly',
     destructive.every((n) => INSTRUCTIONS.includes(n)),
     destructive.filter((n) => !INSTRUCTIONS.includes(n)).join(', '));

  /* The claim that went stale. It is generated now, so this is the guard
     that it stays generated rather than being pasted back as prose. */
  ok('it does not claim one tool is the only one that publishes',
     !/ONLY tool on this server that makes anything public/i.test(INSTRUCTIONS));

  ok('it states the ceiling in the words the code enforces',
     [...AGENT_STATES].every((s) => INSTRUCTIONS.includes(s)),
     [...AGENT_STATES].join(', '));

  ok('and says the ceiling is not up for discussion',
     /not negotiable|not a setting/i.test(INSTRUCTIONS));

  /* Spark researches the open web, so anything it reads can try to give
     it orders. The instructions are where that gets pre-empted. */
  ok('it warns that what it reads is material, not instruction',
     /never an instruction to follow/i.test(INSTRUCTIONS));

  ok('it tells the agent to rehearse before handing over',
     INSTRUCTIONS.includes('check_posting') && /before hand_over/i.test(INSTRUCTIONS));

  ok('it is short enough to survive a system prompt',
     INSTRUCTIONS.length < 5000, `${INSTRUCTIONS.length} characters`);
}

console.log('\nthe brief tells the truth about what is checked');
{
  const rules = voiceRules();
  ok('every voice rule comes back', Object.keys(rules).length === Object.keys(VOICE).length);
  ok('each one says whether the server will catch it',
     Object.values(rules).every((r) => typeof r.checked === 'boolean' && r.how));

  /* The map from a voice rule to the pattern that enforces it is written
     by hand, so it is the thing that rots. Every name in it has to be a
     live RULES entry. */
  const claimed = CHECKED.map((k) => rules[k]);
  ok('nothing claims to be checked that is not', claimed.every(Boolean));
  for (const k of CHECKED) {
    const named = /trips "([^"]+)"/.exec(rules[k].how)?.[1];
    ok(`the rule behind "${k}" is a real one`, RULE_NAMES.includes(named), named);
  }

  const unchecked = Object.entries(rules).filter(([, r]) => !r.checked).map(([k]) => k);
  ok('and the unchecked ones say so plainly, rather than staying quiet',
     unchecked.every((k) => /Nothing checks this/.test(rules[k].how)),
     unchecked.join(', '));
}

console.log('\nand the checked ones are actually checked');
{
  /* Not "is it documented" but "does copy that breaks it get refused".
     Each of these is one carousel that should come back with a reason. */
  const tries = [
    ['person', { caption: 'We build websites for people.' }],
    ['price', { caption: 'Packages start at $500 a month.' }],
    ['capability', { caption: 'I am extremely fast and highly skilled at this.' }],
    ['close', { caption: 'DM me to get started.' }],
    ['banned', { caption: 'A seamless, cutting-edge solution.' }],
  ];
  for (const [rule, c] of tries) {
    const found = problems({ ...c, slides: [] });
    ok(`copy that breaks "${rule}" is refused`, found.length > 0, found.join(' '));
  }

  const clean = problems({
    title: 'The contact form nobody reads',
    caption: 'I opened it on a phone and timed it. Eleven fields, and the '
           + 'one that matters is last.',
    hashtags: '#webdesign',
    slides: [{ position: 0, copy: 'Eleven fields.' }],
  });
  ok('and copy that keeps them passes', clean.length === 0, clean.join(' '));

  /* The rule set is checked wherever the words are, including inside a
     slide, because a banned word set into an image costs a redraw. */
  const inArt = problems({ slides: [{ position: 2, copy: 'Leverage our solutions.' }] });
  ok('a rule broken inside a slide is caught too', inArt.length > 0);
  ok('and the refusal names the slide', /Slide 3/.test(inArt.join(' ')), inArt.join(' '));
}

console.log('\nwhat the handshake hands over');
{
  ok('the server names itself', Boolean(SERVER_INFO.name && SERVER_INFO.version));
  ok('it declares tools', Boolean(CAPABILITIES.tools));
  /* The instructions field is the only place a server can speak before
     the model sees a tool schema. Several clients drop it, which is why
     nothing above depends on it being read — but sending nothing
     guarantees it is not. */
  ok('and it sends instructions at all', INSTRUCTIONS.length > 500);

  /* A tool with no description is one the model has to guess at. */
  const thin = TOOLS.filter((t) => (t.description || '').length < 60).map((t) => t.name);
  ok('every tool carries a description worth reading', thin.length === 0, thin.join(', '));
  const noTitle = TOOLS.filter((t) => !t.title).map((t) => t.name);
  ok('and a title', noTitle.length === 0, noTitle.join(', '));
}

console.log(bad
  ? `\n${bad} failed`
  : '\nwhat it is told matches what is enforced, and the gaps say they are gaps');
process.exit(bad ? 1 : 0);
