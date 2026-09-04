/**
 * /mcp — the MCP endpoint Gemini Spark connects to.
 *
 * Paste this URL into the Gemini web app under Connected Apps, and give it
 * the agent token when it asks for credentials (this server does not do
 * Dynamic Client Registration, which is the case Spark's "Advanced
 * features" panel exists for).
 *
 * The tools behind it are the same functions the studio API uses, called
 * directly rather than looped back over HTTP. What they cannot do is the
 * whole security model: there is no approve, no schedule, no post and no
 * delete here, because Spark researches the open web and anything it reads
 * can try to instruct it. A credential that cannot reach those states is
 * what stops that becoming a post.
 *
 * Dual-era, so it answers both a modern (2026-07-28) client and one that
 * opens with an `initialize` handshake. See lib/mcp.js for why.
 */

import {
  MODERN, SUPPORTED, SERVER_INFO, TOOLS, INSTRUCTIONS, CAPABILITIES,
  eraOf, headerMismatch, rpcError, rpcResult, toolResult, toolFailed,
  PARSE_ERROR, INVALID_REQUEST, METHOD_NOT_FOUND, INVALID_PARAMS,
  INTERNAL_ERROR, HEADER_MISMATCH, UNSUPPORTED_VERSION,
} from '../lib/mcp.js';
import { timingSafeEqual } from '../lib/auth.js';
import { readToken, resourceUri, SCOPE } from '../lib/oauth.js';
import { SITE } from '../lib/templates.js';
import { designBrief, planDesign, fileDesign, designQueue, designStatus,
         hasDesignColumns, MIGRATION_MESSAGE } from '../lib/designer.js';
import {
  brief, agentQueue, getCarousel, listCarousels, setSlides,
  uniqueSlug, slugify, MIN_SLIDES, MAX_SLIDES,
} from '../lib/carousels.js';
import { problems as brandProblems } from '../assets/js/brand.js';
import { send as sendMail } from '../lib/mail.js';
import { gather, compose } from '../lib/digest.js';
import { runDue } from '../lib/publish.js';
import { addReference } from '../lib/references.js';
import { progress } from '../lib/progress.js';
import { refreshStats } from '../lib/insights.js';
import { drawCarousel } from '../lib/draw.js';
import { apiKey, imageModel, drawProvider } from '../lib/imagen.js';
import { getSetting } from '../lib/tokens.js';
import {
  writingBrief, voiceRules, checkDraft, writeArticle, publishArticle,
  findPhotos, keepPhoto,
} from '../lib/writing.js';
import { purgeArticle } from '../lib/articles.js';

const MAX_IMAGE = 25 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const clean = (v, max = 400) => String(v ?? '').trim().slice(0, max);
const asJson = (v) => {
  if (v === undefined || v === null || v === '') return '';
  try { return JSON.stringify(v).slice(0, 40_000); } catch { return ''; }
};

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
  });

/* ----------------------------------------------------------------- tools */

async function runTool(name, args, env) {
  const db = env.DB;
  if (!db) return toolFailed('The database is not configured on this deployment.');

  switch (name) {
    case 'brief':
      return toolResult(await brief(db, { site: SITE }));

    case 'queue':
      return toolResult(await agentQueue(db));

    case 'list_carousels':
      return toolResult({ carousels: await listCarousels(db, { status: args.status || null }) });

    case 'plan_carousel': {
      const title = clean(args.title) || clean(args.topic) || 'Untitled carousel';
      const slides = Array.isArray(args.slides) ? args.slides : [];
      if (slides.length < MIN_SLIDES) {
        return toolFailed(`A carousel needs at least ${MIN_SLIDES} slides; got ${slides.length}.`);
      }
      const slug = await uniqueSlug(db, args.slug || title);
      await db
        .prepare(
          `INSERT INTO carousels (slug, pillar, title, topic, research, caption,
                                  hashtags, status, targets, author, last_editor)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'planned', ?8, 'Spark', 'Spark')`
        )
        .bind(
          slug,
          slugify(args.pillar || '') === 'carousel' ? '' : clean(args.pillar),
          title,
          clean(args.topic, 8000),
          asJson(args.research),
          clean(args.caption, 2200),
          clean(args.hashtags, 8000),
          clean(Array.isArray(args.targets) ? args.targets.join(',') : args.targets)
            || 'tiktok'
        )
        .run();
      const row = await db.prepare('SELECT id FROM carousels WHERE slug = ?1').bind(slug).first();
      const n = await setSlides(db, row.id, slides);

      // Reported, not refused. The plan is filed either way, because
      // losing a researched plan over a stray "we" is worse than fixing
      // it — but approval will refuse it later, so saying so now is the
      // cheapest moment to correct it, before any slide is drawn.
      const offVoice = brandProblems(await getCarousel(db, slug));

      return toolResult({
        slug,
        status: 'planned',
        slides: n,
        cut: slides.length > MAX_SLIDES ? slides.length - MAX_SLIDES : 0,
        ...(offVoice.length ? { fix_before_drawing: offVoice } : {}),
        next: offVoice.length
          ? 'fix the copy above with plan_carousel again or a caption edit, then deliver_slide'
          : 'deliver_slide for each position, then hand_over',
      });
    }

    case 'deliver_slide': {
      if (!env.MEDIA) return toolFailed('No R2 bucket is bound on this deployment.');
      const carousel = await getCarousel(db, clean(args.carousel, 120));
      if (!carousel) return toolFailed(`No carousel called ${args.carousel}.`);
      if (!['planned', 'generating', 'changes', 'review'].includes(carousel.status)) {
        return toolFailed(
          `That carousel is "${carousel.status}". Slides can only be delivered while it is being made.`
        );
      }
      const pos = Number(args.position);
      const slide = carousel.slides.find((s) => s.position === pos);
      if (!slide) return toolFailed(`No slide at position ${pos}.`);

      // bytes, from whichever way they were sent
      let bytes = null;
      let mime = clean(args.mime, 60) || 'image/jpeg';
      if (args.image_base64) {
        try {
          const raw = String(args.image_base64).replace(/^data:[^;]+;base64,/, '');
          bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
        } catch {
          return toolFailed('image_base64 is not valid base64.');
        }
      } else if (args.image_url) {
        try {
          const res = await fetch(String(args.image_url));
          if (!res.ok) return toolFailed(`Could not fetch image_url: ${res.status}.`);
          // What came back has to be an image. Trusting the caller's `mime`
          // here would store an HTML error page as a JPEG, which looks fine
          // in the studio and is refused at the moment it is posted.
          const ct = (res.headers.get('content-type') || '').split(';')[0].trim();
          if (!ct.startsWith('image/')) {
            return toolFailed(`image_url returned ${ct || 'no content type'}, not an image.`);
          }
          mime = ct;
          bytes = new Uint8Array(await res.arrayBuffer());
        } catch (e) {
          return toolFailed(`Could not fetch image_url: ${String(e.message || e)}`);
        }
      } else {
        return toolFailed('Send either image_url or image_base64.');
      }

      if (!IMAGE_TYPES.has(mime)) return toolFailed(`Unsupported type: ${mime}`);
      if (bytes.byteLength > MAX_IMAGE) return toolFailed('Larger than 25MB.');

      const ext = mime === 'image/png' ? '.png' : mime === 'image/webp' ? '.webp' : '.jpg';
      const key =
        `carousels/${carousel.slug}/${String(pos).padStart(2, '0')}-${crypto.randomUUID().slice(0, 8)}${ext}`;
      const int = (v) => Math.max(0, Math.min(50_000, Number(v) || 0));
      const width = int(args.width);
      const height = int(args.height);

      await env.MEDIA.put(key, bytes, {
        httpMetadata: { contentType: mime, cacheControl: 'public, max-age=31536000, immutable' },
      });
      await db
        .prepare(
          `INSERT OR REPLACE INTO media (key, filename, content_type, bytes, width, height, alt)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
        )
        .bind(key, `${carousel.slug}-${pos}${ext}`, mime, bytes.byteLength,
              width, height, clean(slide.copy, 400))
        .run();
      await db
        .prepare(
          `UPDATE slides SET media_key = ?1, width = ?2, height = ?3, state = 'ready',
                             note = '', qc = ?5, attempts = attempts + 1,
                             updated_at = datetime('now')
           WHERE id = ?4`
        )
        .bind(key, width, height, slide.id, asJson(args.qc))
        .run();
      if (carousel.status === 'planned') {
        await db
          .prepare(`UPDATE carousels SET status = 'generating', updated_at = datetime('now') WHERE id = ?1`)
          .bind(carousel.id)
          .run();
      }

      const after = await getCarousel(db, carousel.slug);
      const left = after.slides.filter((s) => s.state !== 'ready');
      return toolResult({
        ok: true,
        position: pos,
        url: `${SITE}/media/${key}`,
        bytes: bytes.byteLength,
        attempts: slide.attempts + 1,
        slides_left: left.length,
        next: left.length ? `${left.length} slide(s) still to draw` : 'ready for hand_over',
      });
    }

    case 'hand_over': {
      const carousel = await getCarousel(db, clean(args.carousel, 120));
      if (!carousel) return toolFailed(`No carousel called ${args.carousel}.`);
      if (!['planned', 'generating', 'changes'].includes(carousel.status)) {
        return toolFailed(
          carousel.status === 'review'
            ? 'That one is already with a person.'
            : `That carousel is "${carousel.status}" and is no longer yours to move.`
        );
      }
      const undrawn = carousel.slides.filter((s) => s.state !== 'ready');
      if (undrawn.length) {
        const which = undrawn.map((s) => s.position).join(', ');
        return toolFailed(
          undrawn.length === 1
            ? `Slide ${which} is not drawn yet.`
            : `Slides ${which} are not drawn yet.`
        );
      }
      await db
        .prepare(
          `UPDATE carousels SET status = 'review', qc = ?1, last_editor = 'Spark',
                                updated_at = datetime('now') WHERE id = ?2`
        )
        .bind(asJson(args.qc), carousel.id)
        .run();
      return toolResult({
        ok: true,
        slug: carousel.slug,
        status: 'review',
        next: 'a person reviews it. send_digest once the day\'s batch is all handed over.',
      });
    }

    case 'post_due': {
      const out = await runDue({ ...env, SITE });
      return toolResult({
        ...out,
        note: out.ran
          ? 'Anything that failed is back in Approved with the reason against it.'
          : 'Nothing was due.',
      });
    }

    case 'draw': {
      const { provider } = await drawProvider(db, env, { getSetting });

      // only the paid path needs a key; the free one draws on Cloudflare
      let key = null;
      let model = null;
      if (provider === 'gemini') {
        ({ key } = await apiKey(db, env, { getSetting }));
        if (!key) {
          return toolFailed(
            'No Gemini API key is set, so nothing can be drawn. A person sets it in '
            + 'the studio under Social, Accounts.'
          );
        }
        ({ model } = await imageModel(db, env, { getSetting }));
      } else if (!env.AI) {
        return toolFailed(
          'Workers AI is not bound on this deployment, so nothing can be drawn. '
          + 'A person deploys it, or switches to Google in the studio.'
        );
      }

      const out = await drawCarousel({ ...env, SITE }, clean(args.carousel, 120), {
        key,
        model,
        provider,
        only: Array.isArray(args.positions) ? args.positions.map(Number) : null,
      });
      if (out.error) return toolFailed(out.error);
      return toolResult(out);
    }

    case 'add_reference': {
      const out = await addReference({ ...env, SITE }, args);
      if (out.error) return toolFailed(out.error);
      return toolResult({
        ...out,
        url: `${SITE}/media/${out.key}`,
        next: out.kit.likeness
          ? 'It is in the kit and brief will hand it over from now on.'
          : 'Add at least one likeness reference too, or the image model has no face to work from.',
      });
    }

    case 'progress':
      return toolResult(await progress(db, env, { site: SITE }));

    case 'performance': {
      // an hour is long enough that a poll is cheap and short enough that
      // a post from this morning is still moving
      const stale = args.refresh ? 0 : 3600;
      const out = await refreshStats({ ...env, SITE }, {
        slug: args.carousel ? clean(args.carousel, 120) : null,
        limit: Number(args.limit) || 20,
        stale,
      });
      if (out.error) return toolFailed(out.error);
      return toolResult({
        ...out,
        note: 'A null count was not readable, not zero — the reason is on the platform.',
      });
    }


    case 'design_brief':
      return toolResult(designBrief());

    case 'design_carousel': {
      const title = clean(args.title) || clean(args.topic) || 'Untitled carousel';
      const panels = Array.isArray(args.panels) ? args.panels : [];
      const spec = {
        title,
        slug: args.slug || title,
        seed: Number.isInteger(args.seed) ? args.seed : undefined,
        panels,
      };

      // validated before anything is written, so a refusal costs nothing
      // and can be fixed in the same turn it was made in
      const checked = await planDesign(env, spec);
      if (!checked.ok) {
        return toolFailed(
          `This spec cannot be drawn:\n- ${checked.errors.join('\n- ')}`
        );
      }
      if (args.check === true) {
        return toolResult({ ok: true, checked_only: true, ...checked });
      }

      // asked before the carousel row is created, so a database that has
      // not been set up does not end up holding a plan with no slides
      if (!(await hasDesignColumns(env))) return toolFailed(MIGRATION_MESSAGE);

      const slug = await uniqueSlug(db, args.slug || title);
      await db
        .prepare(
          `INSERT INTO carousels (slug, pillar, title, topic, research, caption,
                                  hashtags, status, targets, author, last_editor)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'planned', ?8, 'Spark', 'Spark')`
        )
        .bind(
          slug,
          slugify(args.pillar || '') === 'carousel' ? '' : clean(args.pillar),
          title,
          clean(args.topic, 8000),
          asJson(args.research),
          clean(args.caption, 2200),
          clean(args.hashtags, 8000),
          clean(Array.isArray(args.targets) ? args.targets.join(',') : args.targets)
            || 'tiktok'
        )
        .run();
      const row = await db.prepare('SELECT id FROM carousels WHERE slug = ?1').bind(slug).first();
      const filed = await fileDesign(env, { ...spec, slug }, { carouselId: row.id, slug });
      if (!filed.ok) return toolFailed(`This spec cannot be drawn:\n- ${filed.errors.join('\n- ')}`);

      const offVoice = brandProblems(await getCarousel(db, slug));
      return toolResult({
        slug,
        status: 'planned',
        panels: filed.slides,
        seed: filed.seed,
        plan: filed.plan,
        ...(offVoice.length ? { fix_before_drawing: offVoice } : {}),
        next: 'the studio draws these on the next visit; design_status to watch it',
      });
    }

    /* ------------------------------------------------------- the journal */
    case 'writing_brief':
      return toolResult(writingBrief());

    case 'voice_rules':
      return toolResult(await voiceRules());

    case 'check_draft':
      return toolResult(checkDraft({
        title: args.title, description: args.description,
        body: args.body, tags: args.tags,
      }));

    case 'find_photo': {
      const count = Math.min(12, Math.max(1, Number(args.count) || 6));
      const found = await findPhotos(env, args.query, count);
      if (!found.photos.length) return toolFailed(found.note);
      return toolResult(found);
    }

    case 'keep_photo': {
      if (!env.MEDIA) return toolFailed('No R2 bucket is bound, so there is nowhere to put it.');
      const photo = args.photo;
      if (!photo || typeof photo !== 'object' || !photo.url) {
        return toolFailed('Pass the whole photo object from find_photo, not just its URL.');
      }
      const kept = await keepPhoto(env, photo, { slug: clean(args.slug, 80) || 'cover' });
      return kept.ok ? toolResult(kept) : toolFailed(kept.error);
    }

    case 'write_article': {
      const written = await writeArticle(env, args);
      // A refusal is a normal outcome here, not a fault: the point of the
      // check is that the model reads it and rewrites. Returned as a
      // result rather than an error so the reasons survive intact.
      return toolResult(written, { isError: !written.ok });
    }

    case 'publish_article': {
      const done = await publishArticle(env, args.slug);
      if (!done.ok) return toolResult(done, { isError: true });
      // the journal index, the article, the sitemap and the feed all
      // cache at the edge; a post nobody can see is not published
      await purgeArticle(SITE, done.slug);
      return toolResult({ ...done, url: `${SITE}/journal/${done.slug}` });
    }

    case 'design_status': {
      if (args.carousel) {
        const one = await designStatus(db, clean(args.carousel));
        return one ? toolResult(one) : toolFailed(`No carousel "${clean(args.carousel)}".`);
      }
      return toolResult(await designQueue(db));
    }

    case 'send_digest': {
      const mail = compose(await gather(db), SITE);
      if (!mail.count) {
        return toolResult({ sent: false, count: 0, reason: 'Nothing is waiting on a person.' });
      }
      const out = await sendMail(env, { subject: mail.subject, text: mail.text, html: mail.html });
      return out.sent
        ? toolResult({ sent: true, count: mail.count, subject: mail.subject })
        : toolFailed(out.reason || 'The mail did not send.');
    }

    default:
      return null;   // unknown tool -> a protocol error, not a tool error
  }
}

/* ------------------------------------------------------------- dispatch */

async function dispatch(method, params, env) {
  switch (method) {
    case 'server/discover':
      return {
        resultType: 'complete',
        supportedVersions: SUPPORTED,
        capabilities: CAPABILITIES,
        instructions: INSTRUCTIONS,
        _meta: { 'io.modelcontextprotocol/serverInfo': SERVER_INFO },
      };

    case 'tools/list':
      return { tools: TOOLS };

    case 'ping':
      return {};

    case 'tools/call': {
      const name = params?.name;
      const known = TOOLS.some((t) => t.name === name);
      if (!known) return { __rpcError: [METHOD_NOT_FOUND, `Unknown tool: ${name}`] };
      try {
        const out = await runTool(name, params?.arguments || {}, env);
        return out ?? { __rpcError: [METHOD_NOT_FOUND, `Unknown tool: ${name}`] };
      } catch (e) {
        // a thrown tool is a tool failure, not a broken server
        return toolFailed(String(e?.message || e));
      }
    }

    default:
      return { __rpcError: [METHOD_NOT_FOUND, `Unknown method: ${method}`] };
  }
}

/* ------------------------------------------------------------ the route */

export async function onRequest({ request, env }) {
  const method = request.method.toUpperCase();

  // DNS rebinding: an Origin at all means a browser sent this, and no
  // browser page has business here
  const browserOrigin = request.headers.get('origin');
  if (browserOrigin && new URL(browserOrigin).origin !== new URL(SITE).origin) {
    return json(rpcError(null, INVALID_REQUEST, 'Origin not allowed.'), 403);
  }

  // The modern revision dropped the GET stream and DELETE session teardown.
  if (method === 'GET' || method === 'DELETE') {
    return json(rpcError(null, INVALID_REQUEST, 'This endpoint accepts POST.'), 405,
                { allow: 'POST' });
  }
  if (method !== 'POST') {
    return json(rpcError(null, INVALID_REQUEST, 'This endpoint accepts POST.'), 405,
                { allow: 'POST' });
  }

  /*
   * Two ways in, checked before anything is parsed.
   *
   * An OAuth access token is the real one — it is what Gemini Spark will
   * present, because the MCP authorization spec is OAuth 2.1 and Spark's
   * connected-app panel asks for a client ID and secret rather than
   * offering a place to paste a static token.
   *
   * AGENT_TOKEN still works, for curl and for the check suites. It is a
   * deployment-wide secret rather than a granted one, so it is second.
   *
   * A 401 must point at the Protected Resource Metadata document (RFC
   * 9728) or a client has no way to discover where to authorize. That
   * header is how the whole flow starts.
   */
  const origin = new URL(request.url).origin;
  const challenge =
    `Bearer realm="web3ashley-studio", ` +
    `resource_metadata="${origin}/.well-known/oauth-protected-resource", ` +
    `scope="${SCOPE}"`;

  const auth = request.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!bearer) {
    return json(rpcError(null, INVALID_REQUEST, 'Authorization is required.'), 401, {
      'www-authenticate': challenge,
    });
  }

  const granted = await readToken(env, bearer, { resource: resourceUri(origin) });
  const isStatic = env.AGENT_TOKEN && timingSafeEqual(bearer, env.AGENT_TOKEN);
  if (!granted && !isStatic) {
    return json(
      rpcError(null, INVALID_REQUEST, 'That token is not valid for this server.'),
      401,
      { 'www-authenticate': `${challenge}, error="invalid_token"` }
    );
  }
  if (granted && !String(granted.scope || '').split(/\s+/).includes(SCOPE)) {
    return json(rpcError(null, INVALID_REQUEST, 'That token does not carry the required scope.'), 403, {
      'www-authenticate': `${challenge}, error="insufficient_scope"`,
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json(rpcError(null, PARSE_ERROR, 'Body is not JSON.'), 400);
  }
  if (!body || body.jsonrpc !== '2.0' || typeof body.method !== 'string') {
    return json(rpcError(body?.id, INVALID_REQUEST, 'Not a JSON-RPC 2.0 message.'), 400);
  }

  const headerVersion = request.headers.get('mcp-protocol-version');
  const { era, version } = eraOf(body, headerVersion);
  const isNotification = body.id === undefined || body.id === null;

  /* ------------------------------------------------------------ modern */
  if (era === 'modern') {
    if (!SUPPORTED.includes(version)) {
      return json(
        rpcError(body.id, UNSUPPORTED_VERSION, 'Unsupported protocol version',
                 { supported: SUPPORTED, requested: version }),
        400
      );
    }
    const bad = headerMismatch(request.headers, body, version);
    if (bad) return json(rpcError(body.id, HEADER_MISMATCH, `Header mismatch: ${bad}`), 400);

    if (isNotification) return new Response(null, { status: 202 });

    const out = await dispatch(body.method, body.params, env);
    if (out?.__rpcError) {
      const [code, message] = out.__rpcError;
      // the spec asks for 404 on an unimplemented method, so a client can
      // tell a modern server apart from one that does not host /mcp at all
      return json(rpcError(body.id, code, message), code === METHOD_NOT_FOUND ? 404 : 400);
    }
    return json(rpcResult(body.id, out));
  }

  /* ------------------------------------------------------------ legacy */
  if (body.method === 'initialize') {
    const asked = body.params?.protocolVersion;
    // answer in the client's version when it is one we speak, else our newest
    const speak = SUPPORTED.includes(asked) ? asked : '2025-06-18';
    return json(
      rpcResult(body.id, {
        protocolVersion: speak,
        capabilities: CAPABILITIES,
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      })
    );
  }

  if (isNotification) return new Response(null, { status: 202 });

  const out = await dispatch(body.method, body.params, env);
  if (out?.__rpcError) {
    const [code, message] = out.__rpcError;
    return json(rpcError(body.id, code, message));
  }
  return json(rpcResult(body.id, out));
}
