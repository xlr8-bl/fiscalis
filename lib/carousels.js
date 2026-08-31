/**
 * carousels.js — the social pipeline's data, and the rules about who may
 * move it where.
 *
 * The shape of the day, once round:
 *
 *   Spark reads /brief          the pillars, the brand kit, what has been
 *                               posted lately so it does not repeat itself
 *   Spark POSTs a plan          five carousels, each with its slides written
 *                               out as copy and prompts        -> planned
 *   Spark PUTs each image       one call per slide, the master into R2
 *                               and the row to `ready`          -> generating
 *   Spark files its own check   the multimodal pass             -> review
 *   a person looks              approves, or marks slides `redo` with a note
 *                                                               -> approved
 *                                                                  / changes
 *   Spark reads /queue          the slides marked `redo`, regenerates only
 *                               those                           -> review
 *   a person approves           a slot is claimed               -> scheduled
 *   the scheduler posts                                         -> posted
 *
 * The state machine below is the whole of it. Two rules hold it together:
 *
 *   A person can move a carousel anywhere the machine allows. The agent
 *   can only move it forward through the making of it — never to
 *   `approved`, `scheduled` or `posted`, and never at all once a person
 *   has approved it. Approval is the point where a human is on the hook
 *   for what goes out, and no token gets to stand in for that.
 *
 *   Feedback is per slide. Asking for one slide again must not cost the
 *   other nine, in generation time or in the four that were already right.
 */

/** Where each state may go next, for a person. */
export const NEXT = {
  planned:    ['generating', 'review', 'rejected'],
  generating: ['review', 'planned', 'rejected'],
  review:     ['changes', 'approved', 'rejected'],
  changes:    ['review', 'approved', 'rejected'],
  approved:   ['scheduled', 'changes', 'rejected'],
  scheduled:  ['posted', 'approved', 'rejected'],
  posted:     [],
  rejected:   ['planned'],
};

/**
 * The agent's ceiling, stated as states rather than as endpoints, because
 * an endpoint list drifts and a state list does not. Spark researches the
 * open web, so anything it reads can try to instruct it; what stops that
 * turning into a post is that its credential cannot reach the states that
 * put something in front of an audience.
 */
export const AGENT_STATES = new Set(['planned', 'generating', 'review', 'changes']);

/** May the agent write to this carousel at all? */
export function agentMayTouchCarousel(row) {
  return !row || AGENT_STATES.has(row.status);
}

/** May this identity move it from `from` to `to`? */
export function mayMove(kind, from, to) {
  if (!NEXT[from]?.includes(to)) return false;
  if (kind === 'studio') return true;
  // the agent may only move it around inside the making of it
  return AGENT_STATES.has(from) && AGENT_STATES.has(to);
}

export const SLOTS = 5;
export const MAX_SLIDES = 10;   // Instagram's ceiling for a carousel
export const MIN_SLIDES = 2;    // below this it is not a carousel

const clean = (v, max = 400) => String(v ?? '').trim().slice(0, max);

/** Parse a JSON column without letting a bad row take down the request. */
export function parseJson(value, fallback = null) {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

export function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 70) || 'carousel';
}

/** A slug nothing else is using. */
export async function uniqueSlug(db, wanted, exceptId = null) {
  const base = slugify(wanted);
  for (let n = 0; n < 50; n++) {
    const slug = n ? `${base}-${n + 1}` : base;
    const row = await db
      .prepare('SELECT id FROM carousels WHERE slug = ?1')
      .bind(slug)
      .first();
    if (!row || row.id === exceptId) return slug;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

/* ------------------------------------------------------------------ reads */

const CAROUSEL_COLUMNS = `id, slug, pillar, title, topic, research, caption,
  hashtags, status, slot, scheduled_for, targets, feedback, qc, posted_at,
  results, author, last_editor, created_at, updated_at`;

/** Every carousel, newest first, with a count of what its slides are doing. */
export async function listCarousels(db, { status = null, limit = 200 } = {}) {
  const where = status ? 'WHERE c.status = ?1' : '';
  const { results } = await db
    .prepare(
      `SELECT c.id, c.slug, c.pillar, c.title, c.topic, c.status, c.slot,
              c.scheduled_for, c.targets, c.posted_at, c.updated_at,
              count(s.id)                                        AS slides,
              sum(CASE WHEN s.state = 'ready' THEN 1 ELSE 0 END) AS ready,
              sum(CASE WHEN s.state = 'redo'  THEN 1 ELSE 0 END) AS redo,
              sum(CASE WHEN s.state = 'failed' THEN 1 ELSE 0 END) AS failed
       FROM carousels c LEFT JOIN slides s ON s.carousel_id = c.id
       ${where}
       GROUP BY c.id
       ORDER BY c.scheduled_for IS NULL, c.scheduled_for, c.updated_at DESC
       LIMIT ${Math.min(500, Math.max(1, limit))}`
    )
    .bind(...(status ? [status] : []))
    .all();
  return (results ?? []).map((r) => ({
    ...r,
    slides: r.slides ?? 0,
    ready: r.ready ?? 0,
    redo: r.redo ?? 0,
    failed: r.failed ?? 0,
  }));
}

/** One carousel and its slides, in order. */
export async function getCarousel(db, slug) {
  const row = await db
    .prepare(`SELECT ${CAROUSEL_COLUMNS} FROM carousels WHERE slug = ?1`)
    .bind(String(slug))
    .first();
  if (!row) return null;

  const { results } = await db
    .prepare(
      `SELECT id, position, kind, copy, prompt, media_key, width, height,
              state, note, qc, attempts, updated_at
       FROM slides WHERE carousel_id = ?1 ORDER BY position`
    )
    .bind(row.id)
    .all();

  return {
    ...row,
    research: parseJson(row.research, null),
    qc: parseJson(row.qc, null),
    results: parseJson(row.results, null),
    targets: String(row.targets || '').split(',').map((t) => t.trim()).filter(Boolean),
    slides: (results ?? []).map((s) => ({
      ...s,
      qc: parseJson(s.qc, null),
      url: s.media_key ? `/media/${s.media_key}` : '',
    })),
  };
}

/* ----------------------------------------------------------------- writes */

/**
 * Replace a carousel's slides with the ones given. Used when a plan is
 * filed and when a person reorders — never on a regeneration, which
 * touches one row so the other slides keep their images.
 */
export async function setSlides(db, carouselId, slides) {
  const rows = (Array.isArray(slides) ? slides : []).slice(0, MAX_SLIDES);
  await db.prepare('DELETE FROM slides WHERE carousel_id = ?1').bind(carouselId).run();
  if (!rows.length) return 0;

  const stmt = db.prepare(
    `INSERT INTO slides (carousel_id, position, kind, copy, prompt, state)
     VALUES (?1, ?2, ?3, ?4, ?5, 'pending')`
  );
  await db.batch(
    rows.map((s, i) =>
      stmt.bind(
        carouselId,
        i,
        ['hook', 'slide', 'cta'].includes(s.kind) ? s.kind : 'slide',
        clean(s.copy, 2000),
        clean(s.prompt, 8000)
      )
    )
  );
  return rows.length;
}

/**
 * What the agent should work on next. Slides it must regenerate, and the
 * carousels whose plans have no images yet — one call, so a poll is one
 * round trip rather than a list plus a fetch per item.
 */
export async function agentQueue(db) {
  const { results: redo } = await db
    .prepare(
      `SELECT c.slug AS carousel, c.status AS carousel_status, c.title,
              s.position, s.kind, s.copy, s.prompt, s.note, s.attempts
       FROM slides s JOIN carousels c ON c.id = s.carousel_id
       WHERE s.state IN ('redo', 'pending', 'failed')
         AND c.status IN ('planned', 'generating', 'changes')
       ORDER BY c.updated_at, s.position
       LIMIT 200`
    )
    .all();

  const { results: waiting } = await db
    .prepare(
      `SELECT slug, title, pillar, status, feedback, updated_at
       FROM carousels WHERE status IN ('planned', 'generating', 'changes')
       ORDER BY updated_at LIMIT 50`
    )
    .all();

  return { slides: redo ?? [], carousels: waiting ?? [] };
}

/**
 * Everything the agent needs to start a cycle: what to write about, what
 * the pictures should look like, and what not to repeat.
 */
export async function brief(db, { site = '' } = {}) {
  const { results: pillars } = await db
    .prepare(
      `SELECT slug, name, brief, position FROM pillars
       WHERE active = 1 ORDER BY position, name`
    )
    .all();

  const { results: refs } = await db
    .prepare(
      `SELECT r.media_key, r.role, r.position, r.note,
              m.width, m.height, m.content_type
       FROM brand_refs r LEFT JOIN media m ON m.key = r.media_key
       WHERE r.active = 1 ORDER BY r.role, r.position`
    )
    .all();

  // what has gone out lately, so the same topic is not proposed again
  const { results: recent } = await db
    .prepare(
      `SELECT slug, pillar, topic, title, status, scheduled_for, posted_at
       FROM carousels
       WHERE status IN ('approved', 'scheduled', 'posted', 'rejected')
       ORDER BY COALESCE(posted_at, scheduled_for, updated_at) DESC
       LIMIT 40`
    )
    .all();

  const references = (refs ?? []).map((r) => ({
    role: r.role,
    url: site ? `${site}/media/${r.media_key}` : `/media/${r.media_key}`,
    key: r.media_key,
    note: r.note,
    width: r.width ?? 0,
    height: r.height ?? 0,
    content_type: r.content_type ?? '',
  }));

  return {
    pillars: pillars ?? [],
    references,
    counts: {
      likeness: references.filter((r) => r.role === 'likeness').length,
      aesthetic: references.filter((r) => r.role === 'aesthetic').length,
    },
    recent: recent ?? [],
    slots: SLOTS,
    slides: { min: MIN_SLIDES, max: MAX_SLIDES },
  };
}
