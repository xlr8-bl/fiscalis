/**
 * check_setup.mjs — what Set up is allowed to contain.
 *
 *   node tools/check_setup.mjs
 *
 * SCHEMA is applied statement by statement and ANY failure in it is
 * returned as "Could not create the tables" with a 500, so a database
 * that was half migrated stays half migrated and the seed never runs.
 * That makes SCHEMA the one place in this project where a clever
 * statement is expensive, and this is the list of things it may not do.
 *
 * The failure this was written after: a data fix went into SCHEMA as an
 * UPDATE with a LIKE in it, D1 answered "LIKE or GLOB pattern too
 * complex", and pressing Set up did nothing at all. Data fixes belong in
 * corrections.js, which is parameterised and swallows its own failures.
 */
import { readFileSync } from 'node:fs';
import { SCHEMA, SEED } from '../lib/seed.js';
import { CORRECTIONS, applyCorrections } from '../lib/corrections.js';

let bad = 0;
const ok = (what, cond, extra = '') => {
  if (!cond) bad++;
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${what}${extra ? `  — ${extra}` : ''}`);
};

console.log('\nSCHEMA is structure, and only structure');
{
  const allowed = /^\s*(CREATE TABLE|CREATE INDEX|CREATE UNIQUE INDEX|ALTER TABLE|CREATE VIEW|DROP INDEX)\b/i;
  const wrong = SCHEMA.filter((s) => !allowed.test(s));
  ok('every statement creates or alters something',
     wrong.length === 0, wrong.map((s) => s.slice(0, 60)).join(' | '));

  const likes = SCHEMA.filter((s) => /\b(LIKE|GLOB)\b/i.test(s));
  ok('no LIKE or GLOB anywhere in it',
     likes.length === 0, likes.map((s) => s.slice(0, 60)).join(' | '));

  const writes = SCHEMA.filter((s) => /^\s*(INSERT|UPDATE|DELETE)\b/i.test(s));
  ok('no row is written by it', writes.length === 0,
     writes.map((s) => s.slice(0, 60)).join(' | '));

  ok('every ALTER adds a column, so re-running is a duplicate-column no-op',
     SCHEMA.filter((s) => /^\s*ALTER/i.test(s)).every((s) => /ADD COLUMN/i.test(s)));

  ok('the scheduling column is in there',
     SCHEMA.some((s) => /ALTER TABLE articles ADD COLUMN publish_at/i.test(s)));
  ok('and its index', SCHEMA.some((s) => /idx_articles_due/i.test(s)));
}

console.log('\nSEED only ever inserts, and never over anything');
{
  const wrong = SEED.filter((s) => !/^\s*INSERT\b/i.test(s));
  ok('every seed statement is an INSERT', wrong.length === 0,
     wrong.map((s) => s.slice(0, 50)).join(' | '));
  const unguarded = SEED.filter((s) => !/WHERE NOT EXISTS|ON CONFLICT/i.test(s));
  ok('and every one of them is guarded', unguarded.length === 0,
     unguarded.map((s) => s.slice(0, 50)).join(' | '));
}

console.log('\ncorrections repair without walking over an edit');
{
  const title = CORRECTIONS.find((c) => c.key === 'seo.title');
  ok('the home page title is corrected', !!title);
  ok('away from the em dash', /[—–]/.test(title.was));
  ok('and towards something with none', !/[—–]/.test(title.now));

  /* A stub that answers with the number of rows a real UPDATE would have
     touched, so the two cases that matter can be told apart: the value is
     still the wrong one, or somebody has edited it. */
  const db = (changes) => ({
    prepare: () => ({ bind: () => ({ run: async () => ({ meta: { changes } }) }) }),
  });
  ok('a stored value that still matches is put right',
     (await applyCorrections(db(1))).includes('seo.title'));
  ok('an edited one is left alone', (await applyCorrections(db(0))).length === 0);

  const broken = { prepare: () => { throw new Error('no such table: settings'); } };
  ok('a database with no settings table does not take Set up down',
     (await applyCorrections(broken)).length === 0);
}

console.log('\nand it can be reached at any time');
{
  /* The failure this catches: Set up was only ever shown when the
     database looked broken, so it hid itself the moment it succeeded —
     and a correction shipped later could never be applied, because the
     only way to the button was a database that needed it for a different
     reason. It is a menu entry now. */
  const studio = readFileSync('assets/js/studio.js', 'utf8');
  ok('there is a permanent link to it in the menu',
     /group\('Maintenance', \[\['#\/setup'/.test(studio));
  ok('and a route that answers it', /area === 'setup'/.test(studio));
  ok('an up-to-date database gets its own wording, not the first-run one',
     /The database is up to date/.test(studio));
  ok('and the button says what pressing it again means',
     /Run it again/.test(studio));
  ok('a run that changed nothing says so rather than just "done"',
     /nothing needed putting right/.test(studio));
}

console.log(bad ? `\n${bad} failed` : '\nSet up creates tables, seeds rows, and repairs values, and is always reachable');
process.exit(bad ? 1 : 0);
