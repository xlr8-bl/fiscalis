/**
 * RFC 8414. What this authorization server supports: the two endpoints,
 * the one scope, PKCE with S256 only, and the resource indicator and
 * issuer identification the MCP spec asks for.
 */
import { authorizationServerMetadata, originOf } from '../../lib/oauth.js';

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization',
};

export function onRequest({ request }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  return new Response(JSON.stringify(authorizationServerMetadata(originOf(request)), null, 2), {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300', ...cors },
  });
}
