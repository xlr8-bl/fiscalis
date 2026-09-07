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
 *
 * THESE ARE NOT TEACHING SLIDES and they stopped looking like the
 * teaching template on purpose. A teaching slide is a centred stack in
 * the middle of the sheet, which is right when the stack is the whole
 * slide. Here a figure holds one side and the foot, so:
 *
 *   align   flush to the side the figure is NOT on, ragged towards him
 *   anchor  top, so the void the centred version left above the headline
 *           goes to the photograph instead
 *   column  held inside the half the photograph measured quiet
 *   veil    only as much wash as the type actually needs
 *
 * The first set had all four centred with the instruction panel running
 * straight through his chest.
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
      align: 'left', anchor: 'top',
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
      align: 'right', anchor: 'top',
      title: 'Still not fixed',
      say: 'Whatever this check found on your site, it has been that way '
         + 'since the day it went live, and nobody has mentioned it.',
      action: 'Fix the one you found today. Leave the rest for now.',
    },
  },

  /**
   * The whole figure, seated, phone in hand. Keyed and nothing else: no
   * paper, no border, no scissors, because a chair of chrome tubing
   * survives none of them. He runs off no edge of his own frame, so he
   * goes against none of the sheet's either. He floats.
   */
  'on-the-phone': {
    photo: 'phone-chair',
    close: 'the harder version',
    slide: {
      template: 'portrait', ground: 'paper',
      handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
      portrait: 'phone-chair', context: 'cta',
      align: 'left', anchor: 'top',
      title: 'The call you never got',
      // short on purpose: his column is 19 characters a line, measured
      say: 'Nobody rings to say your number would not dial.',
      action: 'Run the same check on the page where people actually pay you.',
    },
  },

  /**
   * The photograph fills the frame and the type sits in its left half,
   * measured quiet at luminance 13-25 for the top six sevenths. Almost no
   * wash, because that half is already darker than the ink ground: at the
   * default 0.82 the sheet came back as a tint with a ghost in it and his
   * face was gone.
   */
  'against-the-wall': {
    photo: 'black-wall',
    close: 'the pass-on',
    slide: {
      template: 'close', ground: 'ink',
      handle: 'WEB3ASHLEY', series: 'SITE CHECKS',
      scene: 'black-wall', veil: 0.14,
      align: 'left', anchor: 'top', column: 0.70,
      title: 'Send it on',
      say: 'The person who can fix this is usually not the person paying '
         + 'for the site.',
      // corner, onto the pale panel at the top right, not across his face
      icons: ['message', 'rise'], iconsWhere: 'corner',
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
