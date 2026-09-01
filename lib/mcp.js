/**
 * mcp.js — the protocol layer for the MCP endpoint.
 *
 * Gemini Spark connects to a third-party app by MCP server URL; it does
 * not call REST endpoints. So this is the doorway, and everything behind
 * it is the API that check_social.mjs already drives.
 *
 * It is **dual-era**, because the spec has two:
 *
 *   modern  (2026-07-28)  every request carries its own protocol version
 *                         in `_meta`, mirrored into headers. No handshake,
 *                         no session. `server/discover` is mandatory.
 *   legacy  (2025-06-18,  an `initialize` handshake opens a session, and
 *            2025-11-25)  the version is agreed once.
 *
 * Spark's help page says "standard MCP specifications" without naming a
 * revision, so guessing one and being wrong means it simply will not
 * connect. Serving both costs one branch — the spec's own compatibility
 * matrix says a dual-era server works with every client era — and the
 * branch is chosen by how the client opens: a request carrying modern
 * `_meta` is served modern, an `initialize` selects legacy.
 *
 * Spec pages this was written from:
 *   https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http
 *   https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning
 *   https://modelcontextprotocol.io/specification/2026-07-28/server/discover
 *   https://modelcontextprotocol.io/specification/2025-06-18/server/tools
 */

export const MODERN = '2026-07-28';
export const SUPPORTED = [MODERN, '2025-11-25', '2025-06-18'];
export const LEGACY = new Set(['2025-11-25', '2025-06-18', '2025-03-26']);

export const SERVER_INFO = { name: 'web3ashley-studio', version: '1.0.0' };

/** The `_meta` key every modern request carries its version in. */
const V_KEY = 'io.modelcontextprotocol/protocolVersion';

/* --------------------------------------------------------------- errors */

// JSON-RPC, plus the two codes the MCP spec allocates for itself
export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INVALID_PARAMS = -32602;
export const INTERNAL_ERROR = -32603;
export const HEADER_MISMATCH = -32020;
export const UNSUPPORTED_VERSION = -32022;

export const rpcError = (id, code, message, data) => ({
  jsonrpc: '2.0',
  id: id ?? null,
  error: { code, message, ...(data ? { data } : {}) },
});

export const rpcResult = (id, result) => ({ jsonrpc: '2.0', id, result });

/* ---------------------------------------------------------------- tools */

/**
 * A tool result. Structured content is sent as well as the text, because
 * the spec says a tool returning structured data SHOULD also serialise it
 * into a text block — older clients read only the text.
 */
export function toolResult(value, { isError = false } = {}) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  const out = { content: [{ type: 'text', text }], isError };
  if (typeof value === 'object' && value !== null) out.structuredContent = value;
  return out;
}

export const toolFailed = (message) => toolResult({ error: message }, { isError: true });

/* --------------------------------------------------------------- shapes */

const str = (description, extra = {}) => ({ type: 'string', description, ...extra });
const int = (description, extra = {}) => ({ type: 'integer', description, ...extra });

/**
 * What Spark can do. Deliberately the making of a carousel and nothing
 * past it: there is no approve, no schedule, no post and no delete here,
 * and there is none behind it either — the same ceiling the bearer token
 * has in the REST API, which check_social.mjs asserts against the running
 * server rather than trusting this list.
 *
 * The descriptions are the only brief the model gets at call time, so
 * they carry the rules that matter: length is the topic's call, Instagram
 * takes JPEG at 4:5.
 */
export const TOOLS = [
  {
    name: 'brief',
    title: 'Read the day\'s brief',
    description:
      'Start every cycle here. Returns the content pillars and what each is for, '
      + 'the brand kit as fetchable image URLs split into likeness (the operator) '
      + 'and aesthetic (the look), the last 40 topics so the same one is not '
      + 'proposed twice, and the slide count limits. Takes no arguments.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'plan_carousel',
    title: 'File a carousel plan',
    description:
      'File one planned carousel with its slides written out. How many slides is '
      + 'the topic\'s call — a teardown with four findings runs longer than a single '
      + 'statistic, and padding everything to one length makes a set of posts look '
      + 'like a template. Two is the floor, ten is Instagram\'s ceiling. Lands in '
      + '"planned"; it is not visible to anyone until a person approves it.',
    inputSchema: {
      type: 'object',
      properties: {
        title: str('Short internal name for this carousel.'),
        pillar: str('Which pillar slug this belongs to, from the brief.'),
        topic: str('What was researched, in a sentence or two.'),
        research: {
          type: 'object',
          description:
            'Where this came from: sources, named people, dates, the measured number. '
            + 'Kept alongside the carousel so a claim can be traced later.',
        },
        caption: str('The post caption. 2200 characters maximum including hashtags.'),
        hashtags: str('Hashtags, space separated. 30 maximum.'),
        targets: {
          type: 'array',
          items: { type: 'string', enum: ['instagram', 'facebook', 'tiktok'] },
          description: 'Where it should go. Defaults to all three.',
        },
        slides: {
          type: 'array',
          minItems: 2,
          maxItems: 10,
          description: 'The slides in order.',
          items: {
            type: 'object',
            properties: {
              kind: str('hook, slide, or cta.', { enum: ['hook', 'slide', 'cta'] }),
              copy: str('The words that get set into the image.'),
              prompt: str('The prompt for the image model.'),
            },
            required: ['copy'],
          },
        },
      },
      required: ['title', 'slides'],
    },
  },
  {
    name: 'queue',
    title: 'What needs drawing',
    description:
      'Every slide waiting on a picture, and every slide a person has asked for '
      + 'again with the note explaining why. Draw only what this names — asking for '
      + 'one slide again must not cost the others their images or their takes. '
      + 'Takes no arguments.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'deliver_slide',
    title: 'Deliver one slide\'s picture',
    description:
      'Put the generated image on one slide. Send either image_url (fetched server '
      + 'side, must be publicly reachable) or image_base64. Instagram takes JPEG '
      + 'only, at an aspect ratio between 4:5 and 1.91:1 — 4:5 is the tallest a feed '
      + 'carousel accepts, so 9:16 is refused — and at most 8MB. Delivering again '
      + 'is how a redraw is sent; the previous take is kept.',
    inputSchema: {
      type: 'object',
      properties: {
        carousel: str('The carousel slug.'),
        position: int('Which slide, counting from 0.', { minimum: 0 }),
        image_url: str('A publicly reachable URL to fetch the image from.'),
        image_base64: str('The image bytes, base64 encoded. Use for smaller files.'),
        mime: str('image/jpeg, image/png or image/webp. Defaults to image/jpeg.'),
        width: int('Pixel width.'),
        height: int('Pixel height.'),
        qc: { type: 'object', description: 'Your own check on this slide.' },
      },
      required: ['carousel', 'position'],
    },
  },
  {
    name: 'hand_over',
    title: 'Hand the batch to a person',
    description:
      'Move a carousel to "review" once every slide is drawn and checked. This is '
      + 'as far as this credential goes: approving, scheduling and posting are a '
      + 'person\'s, and are refused here.',
    inputSchema: {
      type: 'object',
      properties: {
        carousel: str('The carousel slug.'),
        qc: { type: 'object', description: 'The multimodal check over the whole set.' },
      },
      required: ['carousel'],
    },
  },
  {
    name: 'list_carousels',
    title: 'List carousels',
    description:
      'The board: what is planned, being made, waiting on a person, approved, '
      + 'scheduled or posted, with slide counts.',
    inputSchema: {
      type: 'object',
      properties: {
        status: str('Narrow to one state.', {
          enum: ['planned', 'generating', 'review', 'changes',
                 'approved', 'scheduled', 'posted', 'rejected'],
        }),
      },
    },
  },
  {
    name: 'post_due',
    title: 'Post whatever is due',
    description:
      'Publish any carousel whose slot has passed. Call this at each of the day\'s '
      + 'posting times. It only touches carousels a person has approved and given a '
      + 'slot to — it cannot cause anything unapproved to go out, and it will not post '
      + 'the same one twice. Returns what went where, and what failed.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'send_digest',
    title: 'Send the review mail',
    description:
      'Send the one mail a day: what is waiting, and a link to each. Ask for it '
      + 'when the batch is actually ready. A mail that would say "nothing is '
      + 'waiting" is not sent.',
    inputSchema: { type: 'object', properties: {} },
  },
];

/** Natural-language guidance a client may show the model. */
export const INSTRUCTIONS =
  'The back of house for one person\'s social pipeline. A cycle is: brief, then '
  + 'plan_carousel for each of the day\'s posts, then deliver_slide for every slide, '
  + 'then hand_over, then send_digest. Poll queue to find slides a person has asked '
  + 'for again and redraw only those. Nothing here is public and nothing posts '
  + 'itself: approving, scheduling and posting belong to a person and are not '
  + 'available through this server.';

export const CAPABILITIES = { tools: { listChanged: false } };

/* ----------------------------------------------------------- era + heads */

/**
 * Which era this request is. A body carrying `_meta` with the version key,
 * or a modern version header, is modern; `initialize` is legacy.
 */
export function eraOf(body, headerVersion) {
  const inBody = body?.params?._meta?.[V_KEY];
  if (inBody) return { era: 'modern', version: inBody };
  if (headerVersion && !LEGACY.has(headerVersion)) return { era: 'modern', version: headerVersion };
  if (body?.method === 'initialize') return { era: 'legacy', version: null };
  if (headerVersion && LEGACY.has(headerVersion)) return { era: 'legacy', version: headerVersion };
  return { era: 'legacy', version: null };
}

/** Decode the `=?base64?…?=` sentinel the spec uses for unsafe header values. */
export function decodeHeaderValue(raw) {
  const v = String(raw ?? '');
  const m = /^=\?base64\?(.*)\?=$/.exec(v);
  if (!m) return v;
  try {
    return new TextDecoder().decode(
      Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0))
    );
  } catch {
    return v;
  }
}

/**
 * The header/body agreement a modern request has to satisfy. Returns a
 * message when it does not, so the caller can answer 400 + HeaderMismatch.
 *
 * The point of the rule is that a load balancer routing on the header and
 * a server executing on the body must not be able to disagree.
 */
export function headerMismatch(headers, body, version) {
  const get = (n) => headers.get(n);

  const hv = get('mcp-protocol-version');
  if (!hv) return 'MCP-Protocol-Version header is required.';
  if (hv !== version) {
    return `MCP-Protocol-Version header '${hv}' does not match the version in _meta '${version}'.`;
  }

  const hm = get('mcp-method');
  if (!hm) return 'Mcp-Method header is required.';
  if (hm !== body.method) {
    return `Mcp-Method header '${hm}' does not match body method '${body.method}'.`;
  }

  const needsName = ['tools/call', 'resources/read', 'prompts/get'].includes(body.method);
  if (needsName) {
    const wanted = body.method === 'resources/read' ? body?.params?.uri : body?.params?.name;
    const hn = get('mcp-name');
    if (!hn) return 'Mcp-Name header is required for this method.';
    if (decodeHeaderValue(hn) !== wanted) {
      return `Mcp-Name header does not match body value '${wanted}'.`;
    }
  }
  return null;
}
