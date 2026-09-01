/**
 * RFC 9728. The document a 401 from /mcp points at, so a client can find
 * out which authorization server to go to. The MCP spec makes this
 * mandatory for every protected server.
 */
import { protectedResourceMetadata, originOf } from '../../lib/oauth.js';

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, mcp-protocol-version',
};

export function onRequest({ request }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  return new Response(JSON.stringify(protectedResourceMetadata(originOf(request)), null, 2), {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300', ...cors },
  });
}
