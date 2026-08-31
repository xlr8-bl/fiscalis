/**
 * platforms.js — what each place will actually accept.
 *
 * Every number here was read off the platform's own reference page rather
 * than remembered, and each carries the URL it came from. They are checked
 * at approval, because the alternative is a batch that looks finished for
 * hours and then fails at the moment it was supposed to go out — by which
 * time the slot has passed and nobody is watching.
 *
 * Read again when something starts failing: these move.
 *
 *   Instagram  https://developers.facebook.com/docs/instagram-platform/
 *                instagram-graph-api/reference/ig-user/media/
 *              https://developers.facebook.com/docs/instagram-platform/
 *                content-publishing
 *   TikTok     https://developers.tiktok.com/doc/
 *                content-posting-api-reference-photo-post
 *
 * Facebook Pages is deliberately absent. Its photo limits were not
 * verified, and a guessed limit that silently passes is worse than no
 * limit at all — it reads as checked when it is not.
 */

export const INSTAGRAM = {
  name: 'Instagram',
  // "Format: JPEG" — and only JPEG. Extended forms (MPO, JPS) are out too.
  formats: ['image/jpeg'],
  // "File size: 8 MB maximum."
  maxBytes: 8 * 1024 * 1024,
  // "Aspect ratio: Must be within a 4:5 to 1.91:1 range". 4:5 is the
  // tallest a feed carousel takes — 9:16 is a Reel or a Story, not this.
  minRatio: 4 / 5,
  maxRatio: 1.91,
  // "Minimum width: 320 (will be scaled up)", "Maximum width: 1440 (will
  // be scaled down)". So a 4K master is accepted and downscaled; it is
  // the 8MB cap that a 4K file actually runs into, not the width.
  minWidth: 320,
  // "Carousels are limited to 10 images, videos, or a mix of the two."
  minItems: 2,
  maxItems: 10,
  // "Maximum 2200 characters, 30 hashtags, and 20 @ tags."
  maxCaption: 2200,
  maxHashtags: 30,
  maxMentions: 20,
  // "limited to 100 API-published posts within a 24-hour moving period"
  perDay: 100,
};

export const TIKTOK = {
  name: 'TikTok',
  // "up to 35 photo content URLs"
  minItems: 1,
  maxItems: 35,
  // "maximum length for photo posts is 90 in UTF-16 runes"
  maxTitle: 90,
  // "maximum length for photo posts is 4000 in UTF-16 runes"
  maxCaption: 4000,
  // Formats, file size and resolution are not stated on the photo-post
  // reference, so nothing is checked for them here.
};

export const PLATFORMS = { instagram: INSTAGRAM, tiktok: TIKTOK };

/** UTF-16 code units, which is what TikTok counts. */
const runes = (s) => String(s ?? '').length;
const countTags = (s, ch) => (String(s ?? '').match(new RegExp(`\\${ch}[\\w.]+`, 'g')) || []).length;

/**
 * Everything about this carousel that would stop it posting, in the words
 * a person needs to fix it. An empty array means every target will take it.
 *
 * @param {object} c  a carousel as lib/carousels.js getCarousel returns it
 * @returns {string[]}
 */
export function problems(c) {
  const out = [];
  const targets = new Set(c.targets || []);
  const slides = c.slides || [];
  const caption = `${c.caption || ''}${c.hashtags ? `\n${c.hashtags}` : ''}`;

  if (targets.has('instagram')) {
    const ig = INSTAGRAM;
    if (slides.length < ig.minItems || slides.length > ig.maxItems) {
      out.push(
        `Instagram takes ${ig.minItems} to ${ig.maxItems} slides in a carousel; this has ${slides.length}.`
      );
    }
    if (runes(caption) > ig.maxCaption) {
      out.push(`Instagram caps the caption at ${ig.maxCaption} characters; this is ${runes(caption)}.`);
    }
    const tags = countTags(caption, '#');
    if (tags > ig.maxHashtags) out.push(`Instagram allows ${ig.maxHashtags} hashtags; this has ${tags}.`);
    const ats = countTags(caption, '@');
    if (ats > ig.maxMentions) out.push(`Instagram allows ${ig.maxMentions} @ tags; this has ${ats}.`);

    slides.forEach((s) => {
      const no = s.position + 1;
      if (!s.media_key) return;   // "not drawn yet" is reported elsewhere
      if (s.content_type && !ig.formats.includes(s.content_type)) {
        out.push(`Slide ${no} is ${s.content_type}. Instagram only takes JPEG.`);
      }
      if (s.bytes && s.bytes > ig.maxBytes) {
        out.push(
          `Slide ${no} is ${(s.bytes / 1048576).toFixed(1)}MB. Instagram's limit is 8MB.`
        );
      }
      if (s.width && s.height) {
        const ratio = s.width / s.height;
        if (ratio < ig.minRatio - 0.005 || ratio > ig.maxRatio + 0.005) {
          out.push(
            `Slide ${no} is ${s.width}×${s.height}. Instagram wants between 4:5 and 1.91:1 ` +
            `— 4:5 is the tallest a feed carousel takes.`
          );
        }
        if (s.width < ig.minWidth) {
          out.push(`Slide ${no} is only ${s.width}px wide. Instagram's minimum is ${ig.minWidth}.`);
        }
      }
    });
  }

  if (targets.has('tiktok')) {
    const tt = TIKTOK;
    if (slides.length > tt.maxItems) {
      out.push(`TikTok takes up to ${tt.maxItems} photos; this has ${slides.length}.`);
    }
    if (runes(c.title || '') > tt.maxTitle) {
      out.push(`TikTok caps the title at ${tt.maxTitle} characters; this is ${runes(c.title)}.`);
    }
    if (runes(caption) > tt.maxCaption) {
      out.push(`TikTok caps the description at ${tt.maxCaption} characters; this is ${runes(caption)}.`);
    }
  }

  return out;
}
