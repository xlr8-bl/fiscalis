/**
 * /privacy — rendered rather than a static file, so it and /terms cannot
 * drift out of the same source.
 */

import { PRIVACY, UPDATED } from '../lib/legal.js';
import { renderLegalPage } from '../lib/templates.js';

export const onRequestGet = () =>
  new Response(renderLegalPage(PRIVACY, UPDATED), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
