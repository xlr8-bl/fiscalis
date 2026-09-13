/**
 * check_build.mjs — do the Functions actually bundle.
 *
 *   node tools/check_build.mjs
 *
 * Run this FIRST. Everything else is downstream of it.
 *
 * The bug that bought this file: a duplicate `import { getSetting }` in
 * one route. esbuild refuses the whole bundle over it, so the Pages
 * build failed, Cloudflare kept serving the PREVIOUS deployment, and the
 * studio went on returning a sentence that had been deleted from the
 * repo. Retrying the deployment rebuilt the same broken commit. It read
 * as a fix that did not work rather than as a build that never ran.
 *
 * Worse, the suites passed. `wrangler pages dev` keeps serving the last
 * good bundle when a rebuild fails, so every check that drives the
 * server was answering from stale code and reporting green. A failure
 * this quiet has to be caught by something that looks at the build
 * itself rather than at what the server says.
 *
 * `node --check` would not have caught it either: the file is valid
 * JavaScript. Only the bundler objects.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = mkdtempSync(join(tmpdir(), 'fn-build-'));
let bad = 0;

console.log('\nthe Functions bundle\n');

try {
  execFileSync('npx', ['wrangler', 'pages', 'functions', 'build', '--outdir', out],
               { stdio: 'pipe', encoding: 'utf8', timeout: 180_000 });
  console.log('  ok   functions/ bundles');
} catch (e) {
  bad++;
  const said = `${e.stdout ?? ''}${e.stderr ?? ''}`.trim();
  console.log('  FAIL functions/ does not bundle, so a deploy would fail and '
    + 'Cloudflare would keep serving the last good one\n');
  console.log(said.split('\n').map((l) => `       ${l}`).join('\n'));
} finally {
  rmSync(out, { recursive: true, force: true });
}

console.log(bad
  ? `\n${bad} failed — fix this before anything else; the other suites will `
    + 'report green against stale code'
  : '\nit builds, so a deploy of this commit would actually replace what is live');
process.exit(bad ? 1 : 0);
