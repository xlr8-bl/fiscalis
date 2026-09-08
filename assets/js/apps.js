/**
 * apps.js — brand marks, and the one thing they may be used for.
 *
 * Separate from the icon packs on purpose. An icon means something; a
 * mark NAMES something, and naming somebody else's product on a
 * commercial post is a different question from drawing a cursor.
 *
 * assets/icons/apps/SOURCES.md carries the licence and the reasoning.
 * The short version is in USE_A_MARK below, which is what Spark reads.
 */

/** What a person calls it, which is rarely what the slug calls it. */
export const APP_LABELS = {
  figma: 'Figma', canva: 'Canva', framer: 'Framer', webflow: 'Webflow',
  wordpress: 'WordPress', shopify: 'Shopify', squarespace: 'Squarespace',
  wix: 'Wix',
  googleanalytics: 'Analytics', googlesearchconsole: 'Search Console',
  pagespeedinsights: 'PageSpeed', googlechrome: 'Chrome',
  googlefonts: 'Google Fonts', safari: 'Safari', firefox: 'Firefox',
  instagram: 'Instagram', tiktok: 'TikTok', whatsapp: 'WhatsApp',
  openai: 'ChatGPT', anthropic: 'Claude', googlegemini: 'Gemini',
  cloudflare: 'Cloudflare', vercel: 'Vercel', netlify: 'Netlify',
  github: 'GitHub', stripe: 'Stripe', notion: 'Notion', slack: 'Slack',
};

export const APP_NAMES = Object.keys(APP_LABELS);

/** Grouped, because Spark picks a mark by what the slide is about. */
export const APP_GROUPS = {
  building: ['figma', 'canva', 'framer', 'webflow', 'wordpress', 'shopify',
             'squarespace', 'wix'],
  measuring: ['googleanalytics', 'googlesearchconsole', 'pagespeedinsights',
              'googlechrome', 'googlefonts', 'safari', 'firefox'],
  posting: ['instagram', 'tiktok', 'whatsapp'],
  models: ['openai', 'anthropic', 'googlegemini'],
  running: ['cloudflare', 'vercel', 'netlify', 'github', 'stripe', 'notion', 'slack'],
};

export const appUrl = (name) => `/assets/icons/apps/${name}.png`;

/**
 * Read by Spark before it puts a mark on a sheet. Deliberately short
 * and deliberately absolute: the failure mode is a post that reads as a
 * partnership with a company that has never heard of him.
 */
export const USE_A_MARK = {
  what_they_are_for: 'Naming a product THIS slide is about. A slide about '
    + 'what Search Console tells you may carry the Search Console mark.',
  never: [
    'On a slide that does not discuss that product.',
    'Anywhere a logo sits: the rail, the corner, beside the handle.',
    'Recoloured, stretched, rotated or drawn on. They stay monochrome.',
    'Beside a claim the brand has not made, or in any arrangement that '
    + 'reads as "I work with these people" or "these people use me".',
    'As a stand-in for an idea. A mark is not an illustration; the icon '
    + 'packs are there for that.',
  ],
  the_licence: 'The files are CC0. The trademarks are not, and CC0 on a '
    + 'file is not permission from the brand. Simple Icons removes a mark '
    + 'when a brand asks: linkedin and adobe are already gone. If a '
    + 'brand\'s own guidelines say something stricter, they win.',
  groups: APP_GROUPS,
};
