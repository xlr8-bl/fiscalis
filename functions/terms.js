/** /terms — see functions/privacy.js. */

import { TERMS, UPDATED } from '../lib/legal.js';
import { renderLegalPage } from '../lib/templates.js';

export const onRequestGet = () =>
  new Response(renderLegalPage(TERMS, UPDATED), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
