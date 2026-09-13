/**
 * check_lint.mjs — variables that do not exist.
 *
 *   node tools/check_lint.mjs
 *
 * One rule, no-undef, and it is here because of one afternoon.
 *
 * `drawTheDesigns` referred to a bare `slides` that was never declared in
 * it. Perfectly valid JavaScript: `node --check` passed, the Functions
 * bundled, all thirty-three suites went green. It threw only when a
 * person pressed Draw the panels on a carousel of teaching slides —
 * which is the one path this whole project exists for — and came back as
 * "Can't find variable: slides".
 *
 * Running the rule once found two more the same afternoon, both in the
 * MCP router: publish_articles and set_writing_schedule read `a.slugs`
 * and `a.every` where the parameter is `args`. Neither had ever been
 * called. Both would have thrown on the first real use, and no suite
 * touched them because the journal tools are out of the default scope.
 *
 * Style is deliberately not linted. This repo has a voice and a
 * formatter would fight it. What is checked is whether a name exists.
 */

import { execFileSync } from 'node:child_process';

let bad = 0;

console.log('\nnames that do not exist\n');

/*
 * JSON, not the human summary.
 *
 * The first version of this read eslint's closing prose for "N error",
 * and the line "0 errors and 1 warning potentially fixable with the
 * --fix option" matched its own guard against false positives. So it
 * reported "every name resolves" over a real undefined variable — a
 * check that lied about the exact bug it was written for, which is worse
 * than not having it.
 */
let report = [];
try {
  const out = execFileSync('npx', ['eslint', '.', '--format', 'json'],
                           { stdio: 'pipe', encoding: 'utf8', timeout: 300_000 });
  report = JSON.parse(out);
} catch (e) {
  // eslint exits non-zero when it finds errors, and still prints the JSON
  const said = String(e.stdout ?? '').trim();
  try { report = JSON.parse(said); }
  catch {
    bad++;
    console.log(`  FAIL eslint could not run\n       ${String(e.stderr ?? e.message).slice(0, 500)}`);
  }
}

const errors = report.flatMap((f) =>
  f.messages.filter((m) => m.severity === 2)
    .map((m) => `${f.filePath.replace(`${process.cwd()}/`, '')}:${m.line} ${m.message}`));

if (!bad) {
  if (errors.length) {
    bad++;
    console.log(`  FAIL ${errors.length} name(s) used that are not declared anywhere\n`);
    console.log(errors.map((l) => `       ${l}`).join('\n'));
  } else {
    console.log(`  ok   every name resolves, across ${report.length} files`);
  }
}

console.log(bad
  ? `\n${bad} failed — a name that does not exist throws only when that line runs`
  : '\nno undeclared names, so nothing waits to throw on first use');
process.exit(bad ? 1 : 0);
