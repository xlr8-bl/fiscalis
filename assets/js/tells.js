/**
 * tells.js — the signs of AI writing, as a thing code can check.
 *
 * The patterns come from the humanizer skill in .claude/skills/humanizer,
 * which is built from Wikipedia's "Signs of AI writing" (WikiProject AI
 * Cleanup). This is not a copy of the skill: the skill is the reasoning
 * and the rewrite process, and it is what Spark is handed to read. This
 * is the subset that a regular expression can honestly find, so that a
 * draft can be refused at the door rather than published and noticed.
 *
 * No DOM and no Node built-ins, so the same file runs in the Worker, in
 * the browser, and under `node tools/ai_tells.mjs`.
 *
 * Two things this file knows about itself:
 *
 *   It cannot tell a tell from ordinary English. The skill's own list of
 *   what not to flag is half its length — "however" is not a tell, one
 *   em dash proves nothing, a writer may repeat an opening on purpose.
 *   So each pattern carries a weight, and `judge()` refuses on the ones
 *   that are mechanical (a dash, an emoji, a chatbot artifact) while only
 *   warning on the ones that need a reader.
 *
 *   Case matters for exactly the two patterns about capitalisation.
 *   Compiling the whole list case-insensitively is what made the
 *   title-case rule match every sentence-case heading in the journal the
 *   first time this was written, 40 findings out of 47.
 */

/**
 * `hard` patterns are refused: they are mechanical, they have no
 * legitimate reading in this site's prose, and a person fixes each one
 * in seconds. `soft` patterns are reported and not refused: they are
 * words that are also just words.
 */
export const TELLS = [
  // --- hard: mechanical, and always wrong here -------------------------
  { id: 'em-dash', weight: 'hard', rx: /[—–]/g, case: true,
    say: 'An em or en dash. Use a comma, a colon, a full stop, or brackets.' },
  { id: 'curly-quote', weight: 'hard', rx: /[“”‘’]/g, case: true,
    say: 'A curly quote. This site sets straight quotes.' },
  { id: 'emoji', weight: 'hard', rx: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, case: true,
    say: 'An emoji. Not in the journal.' },
  { id: 'chatbot-artifact', weight: 'hard',
    rx: /\b(I hope this helps|Of course!|Certainly!|You'?re absolutely right|let me know if you|Would you like me to|Should I continue)\b/g,
    say: 'A line addressed to whoever asked for the draft. Cut it.' },
  { id: 'knowledge-limit', weight: 'hard',
    rx: /\b(as of my last|up to my last training|while specific details (?:are|about)|based on (?:the )?available information|it is believed that)\b/g,
    say: 'A disclaimer about what you could not find. Say what the source does not show, or cut the sentence.' },
  { id: 'title-case-heading', weight: 'hard',
    rx: /^#{2,6}\s+\b[A-Z][a-z]+\b(?:\s+\b[A-Z][a-z]+\b){2,}\s*$/gm, case: true,
    say: 'A heading in Title Case. Headings here are sentence case.' },
  { id: 'bold-mini-heading', weight: 'hard', rx: /^\s*[-*]\s+\*\*[^*\n]+:\*\*/gm,
    say: 'A list where every item opens with a bold label and a colon. Write it as prose.' },

  // --- hard: the stock phrases, which are never the right words --------
  { id: 'inflated-importance', weight: 'hard',
    rx: /\b(stands as a|serves as a|is a testament to|a pivotal moment|underscor(?:es|ing) the importance|evolving landscape|indelible mark|marking a (?:pivotal|significant|key))\b/g,
    say: 'A claim that an ordinary fact marks a turning point. State the fact.' },
  { id: 'sales-language', weight: 'hard',
    rx: /\b(boasts a|nestled in|in the heart of|breathtaking|must-visit|a rich tapestry|showcasing (?:its|the)|exemplifies (?:its|the)|commitment to excellence)\b/g,
    say: 'Advertising copy. Say what the thing is.' },
  { id: 'deeper-truth', weight: 'hard',
    rx: /\b(the real question is|at its core,|what really matters is|the heart of the matter|the deeper issue)\b/g,
    say: 'A phrase that dresses an ordinary point as a hidden truth.' },
  { id: 'announcing', weight: 'hard',
    rx: /\b(let'?s (?:dive|explore|break this down|take a look)|here'?s what you need to know|without further ado)\b/g,
    say: 'Announcing the next point instead of making it.' },
  { id: 'fake-candour', weight: 'hard', case: true,
    rx: /(?:^|[.!?]\s+)(Honestly[?,]|Look,|Here'?s the thing|Let'?s be honest|Real talk)/g,
    say: 'A staged pause before a routine point. State the point.' },
  { id: 'generic-ending', weight: 'hard',
    rx: /\b(the future looks bright|exciting times (?:lie )?ahead|a step in the right direction|journey toward)\b/g,
    say: 'A send-off instead of a last fact. End on the fact.' },
  { id: 'fake-alternative', weight: 'hard',
    rx: /\b(a tempting (?:option|approach) would be|one might be tempted to|an obvious approach would be|it would be easy to just)\b/g,
    say: 'An option no reader would consider, raised so it can be dismissed.' },
  { id: 'answering-nobody', weight: 'hard',
    rx: /\b(don'?t get me wrong|this is not to say|I'?m not (?:saying|arguing) that|some might say)\b/g,
    say: 'Answering an objection nobody made.' },

  // --- soft: words that are also just words ----------------------------
  { id: 'stock-word', weight: 'soft',
    rx: /\b(delve|intricate|intricacies|interplay|tapestry|testament|robust|seamless|holistic|myriad|plethora|garner|utilize|facilitate|paradigm|synerg\w+|leverage|crucial|pivotal|vibrant|profound|underscore)\b/g,
    say: 'A word AI writing reaches for more than people do. Fine once, in the right place.' },
  { id: 'avoiding-is', weight: 'soft',
    rx: /\b(serves as|stands as|represents a|features a|offers a range of)\b/g,
    say: 'A long phrase where "is" or "has" would do.' },
  { id: 'not-x-but-y', weight: 'soft',
    rx: /\b(?:it'?s |this is )?not (?:just|only|merely) [^.,;\n]{2,40}[,;] (?:it'?s |this is )?(?:also )?/g,
    say: '"Not just X, it\'s Y." Say Y.' },
  { id: 'shallow-ing', weight: 'soft',
    rx: /,\s+(highlighting|underscoring|emphasi[sz]ing|ensuring|reflecting|symboli[sz]ing|contributing to|fostering|showcasing|encompassing)\s/g,
    say: 'An -ing clause added to make a simple fact sound deeper.' },
  { id: 'vague-source', weight: 'soft',
    rx: /\b(industry reports (?:show|suggest)|observers have|experts (?:argue|believe|say)|some critics|studies show that)\b/g,
    say: 'A claim assigned to nobody in particular. Name the source or drop the claim.' },
  { id: 'filler', weight: 'soft',
    rx: /\b(in order to|due to the fact that|at this point in time|in the event that|has the ability to|it is important to note that)\b/g,
    say: 'Filler. There is a shorter way to say this.' },
  { id: 'over-qualified', weight: 'soft',
    rx: /\b(could potentially|might arguably|it'?s also possible that|in some cases it may)\b/g,
    say: 'Two hedges where one would do.' },
];

const compiled = TELLS.map((t) => ({
  ...t,
  re: new RegExp(t.rx.source, t.case ? t.rx.flags : `${t.rx.flags}i`),
}));

/** Where in the text a match sits, as a line number and its surroundings. */
function place(text, index, length) {
  const line = text.slice(0, index).split('\n').length;
  const from = Math.max(0, index - 45);
  const before = text.slice(from, index).replace(/\s+/g, ' ');
  const after = text.slice(index + length, index + length + 45).replace(/\s+/g, ' ');
  return { line, context: `…${before}«${text.substr(index, length)}»${after}…` };
}

/**
 * Every pattern this text trips, in order.
 *
 * Front matter is stripped because it is metadata, and fenced code is
 * stripped because a dash inside a code block is code — the skill's own
 * file mode says to leave code alone.
 */
export function findTells(input) {
  let text = String(input ?? '')
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/[^\n]/g, ' '));

  const found = [];
  for (const t of compiled) {
    const re = new RegExp(t.re.source, t.re.flags.includes('g') ? t.re.flags : `${t.re.flags}g`);
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m[0] === '') { re.lastIndex++; continue; }
      found.push({ id: t.id, weight: t.weight, say: t.say, match: m[0], ...place(text, m.index, m[0].length) });
      if (found.length >= 200) return found.sort((a, b) => a.line - b.line);
    }
  }
  return found.sort((a, b) => a.line - b.line);
}

/**
 * Is this publishable?
 *
 * `ok` false means a hard pattern is present, and the caller should
 * refuse. Soft findings come back either way, because they are a reading
 * list and not a verdict.
 */
export function judge(text) {
  const found = findTells(text);
  const hard = found.filter((f) => f.weight === 'hard');
  const soft = found.filter((f) => f.weight === 'soft');
  return {
    ok: hard.length === 0,
    refuse: hard.map((f) => `line ${f.line}: ${f.say} ${f.context}`),
    consider: soft.map((f) => `line ${f.line}: ${f.say} ${f.context}`),
    counts: { hard: hard.length, soft: soft.length },
  };
}
