/**
 * /api/studio/setup — create the tables and load the site's content.
 *
 *   GET   what state the database is in
 *   POST  apply the schema, then the seed
 *
 * This exists so a first deployment can be finished without a terminal:
 * create the D1 database and the R2 bucket in the Cloudflare dashboard,
 * add the secrets, then sign into the studio and press the button. The
 * alternative is pasting 60KB of SQL into a console, which is unpleasant
 * on a laptop and impractical on a phone.
 *
 * Every statement is `CREATE TABLE IF NOT EXISTS` or `INSERT … WHERE NOT
 * EXISTS`, so running it twice does nothing and it can never overwrite
 * something already edited.
 */

import { json } from '../../../lib/respond.js';
import { identify } from '../../../lib/auth.js';
import { SCHEMA, SEED } from '../../../lib/seed.js';
import { applyCorrections } from '../../../lib/corrections.js';

async function state(db) {
  try {
    const { results } = await db
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name IN
           ('articles','entries','settings','media','revisions')`
      )
      .all();
    const tables = (results ?? []).map((r) => r.name);
    // A database missing one of these is mid-upgrade, not broken. Reporting
    // it as unready puts the Set up button back, which is what applies the
    // rest — and setup is written to be safe to run again.
    if (tables.length < 5) return { ready: false, tables, counts: null };

    const counts = {};
    for (const t of ['articles', 'entries', 'settings']) {
      const row = await db.prepare(`SELECT count(*) AS n FROM ${t}`).first();
      counts[t] = row?.n ?? 0;
    }
    return { ready: true, tables, counts };
  } catch (e) {
    return { ready: false, tables: [], counts: null, error: String(e.message || e) };
  }
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ bound: false, ready: false }, 200);
  const who = await identify(request, env);
  if (!who || who.kind !== 'studio') return json({ error: 'Not signed in.' }, 401);
  return json({ bound: true, ...(await state(env.DB)) });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) {
    return json({ error: 'No D1 database is bound yet. Add the binding first.' }, 503);
  }
  const who = await identify(request, env);
  if (!who || who.kind !== 'studio') {
    return json({ error: 'Only a signed-in person can run setup.' }, 401);
  }

  const before = await state(env.DB);

  // schema first, one at a time: D1's batch is a transaction, and a failed
  // CREATE in the middle of one would roll back the tables that did work
  const problems = [];
  for (const sql of SCHEMA) {
    try {
      await env.DB.prepare(sql).run();
    } catch (e) {
      const message = String(e.message || e);
      // adding a column that is already there is the expected no-op on a
      // database created before that column existed
      if (!/duplicate column/i.test(message)) problems.push(message);
    }
  }
  if (problems.length) {
    return json({ error: `Could not create the tables: ${problems[0]}` }, 500);
  }

  // the rows, in batches small enough to stay well inside a request
  let inserted = 0;
  const SIZE = 20;
  for (let i = 0; i < SEED.length; i += SIZE) {
    const slice = SEED.slice(i, i + SIZE).map((sql) => env.DB.prepare(sql));
    try {
      await env.DB.batch(slice);
      inserted += slice.length;
    } catch (e) {
      return json(
        { error: `Loaded ${inserted} of ${SEED.length} rows, then: ${String(e.message || e)}` },
        500
      );
    }
  }

  // Values seeded from a mistake, put right where they have not been
  // edited since. The seed itself cannot do this: it inserts only where
  // nothing exists, precisely so it never walks over an edit.
  const corrected = await applyCorrections(env.DB);

  const after = await state(env.DB);
  return json({
    ok: true,
    firstRun: !before.ready,
    statements: SEED.length,
    corrected,
    counts: after.counts,
  });
}
