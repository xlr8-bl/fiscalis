/**
 * ctas.js — one closing design per photograph, so there is a choice.
 *
 * Four options rather than one, because the photographs are four
 * different compositions and a single CTA layout would suit one of them
 * and be a compromise for the rest. Each is fixed: the photograph, the
 * side it sits on, the size, the bleed. Spark picks the CTA by NAME and
 * gets the whole arrangement, and cannot move any part of it.
 *
 * The copy is a starting point, not part of the fixed design. Each one
 * uses a different shape from CLOSES so the set reads as five ways of
 * ending rather than one sentence in four typefaces.
 */

export const CTAS = {
  /**
   * The one to reach for by default. Face at the right edge, running off
   * it, type in the left two thirds. It is the composition the photograph
   * already has, so nothing is being forced.
   */
  'looking-back': {
    photo: 'blue-flat',
    close: "the reader's own words",
    slide: {
      template: 'portrait', ground: 'paper',
      handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
      portrait: 'blue-flat', context: 'cta',
      title: 'Who is checking',
      say: 'One person, one site at a time. Everything on these sheets is a '
         + 'check I run before I touch anything.',
      action: 'Send me the URL and I will tell you which of the four it is.',
    },
  },

  /**
   * The mirror. Figure at the left edge, type on the right, which is the
   * one arrangement that reads differently in a feed full of
   * left-aligned posts.
   */
  'arms-folded': {
    photo: 'sky-arms',
    close: 'the consequence, dated',
    slide: {
      template: 'portrait', ground: 'paper',
      handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
      portrait: 'sky-arms', context: 'cta',
      title: 'Still not fixed',
      say: 'Whatever this check found on your site, it has been that way '
         + 'since the day it went live, and nobody has mentioned it.',
      action: 'Fix the one you found today. Leave the rest for now.',
    },
  },

  /**
   * The whole figure, seated, phone in hand, on the ink ground. The only
   * photograph that can carry a cut on all four sides, so it is the one
   * that can be big without looking cropped.
   */
  'on-the-phone': {
    photo: 'phone-chair',
    close: 'the harder version',
    slide: {
      template: 'portrait', ground: 'ink',
      handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
      portrait: 'phone-chair', context: 'cta',
      title: 'The call you never got',
      say: 'Nobody rings to say your number would not dial. They ring the '
         + 'next business on the list instead.',
      action: 'Run the same check on the page where people actually pay you.',
    },
  },

  /**
   * No cut-out. The photograph fills the frame and the type sits in its
   * left half, which SOURCES.md measured as quiet at luminance 15. It is
   * here because black-wall cannot be cut out, and because a set of four
   * closings that are all cut-outs is one idea repeated.
   */
  'against-the-wall': {
    photo: 'black-wall',
    close: 'the pass-on',
    slide: {
      template: 'close', ground: 'ink',
      handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
      scene: 'black-wall',
      title: 'Send it on',
      say: 'The person who can fix this is usually not the person paying '
         + 'for the site.',
      icons: ['message', 'rise'],
      action: 'Send this to whoever built it.',
    },
  },
};

export const CTA_NAMES = Object.keys(CTAS);

/** What Spark reads: it picks a name, never a position. */
export const ctaCatalogue = () => CTA_NAMES.map((n) => ({
  name: n,
  photograph: CTAS[n].photo,
  close_shape: CTAS[n].close,
  ground: CTAS[n].slide.ground,
}));
