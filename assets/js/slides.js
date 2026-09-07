/**
 * slides.js — the content carousel: blocks stacked down a sheet.
 *
 * WHY THIS IS NOT THE HOOK ENGINE. compose.js draws a hook sheet from
 * absolute boxes measured off a reference, because a hook is a poster:
 * six words in known places, and the geometry IS the design. A teaching
 * carousel is the opposite. Its slides carry a headline, two or three
 * paragraphs, a stack of chips and an instruction, the copy is a
 * different length every time, and absolute boxes cannot survive that —
 * one sentence longer and the chips land on the icons.
 *
 * That was read off the reference rather than assumed. Measuring the
 * same elements across five slides of one carousel: the icon row sits at
 * 0.650 down one sheet and 0.712 down the next, and the block above it
 * is what moved. So the sheet is a FLOW: blocks in order, each as tall
 * as its own copy, centred, with measured gaps between them, and the
 * whole stack settled between a rail pinned to the top and an
 * instruction pinned near the foot.
 *
 * WHAT IS TAKEN AND WHAT IS NOT. The reference is somebody else's
 * carousel and the grammar is what is worth having: a rail, a serif
 * headline, flowing paragraphs, phrases picked out on coloured chips, a
 * row of small objects, and a two-part instruction where a label
 * overlaps a panel. None of their palette, none of their faces, none of
 * their words, and nothing of their branding. It is set in this site's
 * own grounds and its own type, so the result is a cousin rather than a
 * copy.
 *
 * WHAT SPARK DOES WITH IT. It picks a template per slide by name and
 * writes the copy for the slots that template has. It never gives a
 * coordinate. That is the whole point: it was inventing compositions and
 * getting compositions wrong, and choosing between eight named shapes is
 * a judgement it can actually make.
 */

import { GROUNDS } from './design-spec.js';
import { ICONS, ICON_NAMES } from './icons.js';

export const W = 1080;
export const H = 1350;

const px = { w: (v) => v * W, h: (v) => v * H, size: (v) => v * H };

/* ---------------------------------------------------------- the metrics
 *
 * Every number measured off the reference card, which is 824x1030 and
 * therefore the same 4:5 frame these are drawn at. Where a number is a
 * choice rather than a measurement it says so.
 */
export const M = {
  rail:     { h: 0.0553, pad: 0.038, size: 0.0175 },  // 57px of 1030
  margin:   0.085,                                    // the text column's inset

  /* The headline, re-measured. The first pass had it at 0.078 with loose
     leading and the sheets came out timid beside the reference. Its caps
     run 0.0816 of the frame — H's cap top to the baseline on "How to" —
     which is 0.113 em, and its lines sit 0.0893 apart, which is LESS
     than one em. That negative leading is most of why the original reads
     as a poster and the first version read as a document. */
  title:    { size: 0.1133, lead: 0.0893 / 0.1133 },
  say:      { size: 0.0208, lead: 0.0330 / 0.0208 },  // line pitch 0.0330

  /* Chips: 0.036 tall on a 0.0495 pitch, and centred — measured across
     three sheets, whose centres land on 0.4964, 0.4964 and 0.4970. Each
     is only as wide as its own words: 0.4806 for a long one, 0.2646 for
     a short one, on the same sheet. */
  chip:     { h: 0.0360, pitch: 0.0495, padX: 0.020, r: 0.004 },

  /* The row is 0.0796 tall and 0.4806 wide for six, so the icons very
     nearly touch. The first version put a 0.014 gap between them and
     they read as six separate marks instead of one band. */
  icons:    { h: 0.0796, gap: 0.004 },

  /* The instruction, measured on three sheets that all agree: the panel
     is a FIXED box at x 0.3386 and 0.4612 wide, not one sized to its
     copy, and the label sits at x 0.1893 and 0.2075 wide. The label's
     right quarter laps over the panel's left edge, and the panel's top
     starts 63% of the way down the label. */
  action:   { label: 0.0355, body: 0.0195, lead: 1.14,
              labelX: 0.1893, labelW: 0.2075, panelX: 0.3386, panelW: 0.4612,
              padX: 0.018, padY: 0.016 },

  /* The gaps between blocks, as a fraction of the frame's height. Read
     off the reference's own runs: 0.0631 from the headline to the first
     paragraph, 0.0339 between a paragraph and a chip stack, 0.036 from
     the last block to the icon row. Rounded to three places, not tuned. */
  gap:      { afterTitle: 0.063, between: 0.034, beforeIcons: 0.036 },
  top:      0.117,      // where the headline's cap starts
  foot:     0.030,      // clear space under the action block
};

/* ------------------------------------------------------------- blocks
 *
 * A block knows how tall it is before anything is drawn, which is what
 * makes a flow possible: measure them all, add the gaps, then place.
 * `height` is given the context because a paragraph's height depends on
 * how many lines it wraps to, and that depends on the face.
 */

const CAP = 0.72;          // cap height as a fraction of the em, measured

function lines(ctx, text, font, maxW, track = '0px') {
  ctx.font = font;
  /* Measured with the tracking on. Wrapping without it and then drawing
     with it makes every line the wrong length — long ones on tight type,
     short ones on loose — and the error grows with the line. */
  ctx.letterSpacing = track;
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  const out = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxW || !line) line = next;
    else { out.push(line); line = word; }
  }
  if (line) out.push(line);
  return out;
}

export const BLOCKS = {
  /**
   * The headline. A serif at display size, centred, two or three lines.
   * It is the only thing on the sheet set in the didone, which is what
   * makes it read as the headline rather than as big body copy.
   */
  title: {
    takes: 'text',
    what: 'The headline. Three to six words, sentence case, and it has to '
        + 'work as the whole slide if somebody reads nothing else.',
    height(ctx, block, g, col) {
      const n = lines(ctx, block.text, face(g, 'title'), col, trackOf('title')).length;
      return M.title.size * CAP + (n - 1) * M.title.size * M.title.lead;
    },
    draw(ctx, block, g, box) {
      setType(ctx, g, 'title');
      const ls = lines(ctx, block.text, face(g, 'title'), box.w, trackOf('title'));
      ls.forEach((line, i) => {
        const y = box.y + px.size(M.title.size) * CAP
          + i * px.size(M.title.size * M.title.lead);
        ctx.fillText(line, box.x + box.w / 2, y);
      });
    },
  },

  /**
   * A paragraph. Two to four lines of grotesque, centred, and the one
   * block that carries an actual explanation.
   */
  say: {
    takes: 'text',
    what: 'A short paragraph, two to four lines. This is where the thing is '
        + 'actually explained, so it is the one block allowed to be prose.',
    height(ctx, block, g, col) {
      const n = lines(ctx, block.text, face(g, 'say'), col, trackOf('say')).length;
      return M.say.size * CAP + (n - 1) * M.say.size * M.say.lead;
    },
    draw(ctx, block, g, box) {
      setType(ctx, g, 'say');
      const ls = lines(ctx, block.text, face(g, 'say'), box.w, trackOf('say'));
      ls.forEach((line, i) => {
        const y = box.y + px.size(M.say.size) * CAP
          + i * px.size(M.say.size * M.say.lead);
        ctx.fillText(line, box.x + box.w / 2, y);
      });
    },
  },

  /**
   * A stack of phrases, each on its own chip.
   *
   * The chip is the device: a phrase picked out on a panel reads as a
   * thing rather than as part of a sentence, and three of them stacked
   * read as a set without needing bullets or numbers. Each chip is only
   * as wide as its own words, which is what stops the stack looking like
   * a table.
   */
  chips: {
    takes: 'items',
    what: 'Two to four short phrases, each picked out on its own chip. For a '
        + 'set of things that belong together: what something depends on, '
        + 'what it gets you, what to have ready.',
    height(_ctx, block) {
      const n = Math.max(1, (block.items ?? []).length);
      return M.chip.h + (n - 1) * M.chip.pitch;
    },
    draw(ctx, block, g, box) {
      (block.items ?? []).forEach((text, i) => {
        const y = box.y + i * px.h(M.chip.pitch);
        chip(ctx, g, text, box.x + box.w / 2, y, { fill: 'accentSoft' });
      });
    },
  },

  /**
   * Two chips on one row, each with its own line under it.
   *
   * The one shape a chip stack cannot do: a comparison. Side by side
   * says "these are the two kinds"; stacked says "these are three
   * things", and getting that wrong is the difference between a slide
   * that teaches and one that lists.
   */
  duo: {
    takes: 'pair',
    what: 'Exactly two things compared side by side, each a chip with one '
        + 'line under it. Use it when the slide is about a difference '
        + 'between two kinds, never for a list of two.',
    height() { return M.chip.h + 0.010 + M.say.size * CAP; },
    draw(ctx, block, g, box) {
      const [a, b] = block.pair ?? [];
      const half = box.w / 2;
      [[a, box.x + half / 2], [b, box.x + half + half / 2]].forEach(([item, cx]) => {
        if (!item) return;
        chip(ctx, g, item.head, cx, box.y, { fill: 'accentSoft' });
        if (!item.tail) return;
        setType(ctx, g, 'say');
        ctx.fillText(item.tail, cx,
          box.y + px.h(M.chip.h + 0.010) + px.size(M.say.size) * CAP);
      });
    },
  },

  /**
   * The row of objects.
   *
   * It carries no information and it is not decoration either: it is the
   * beat between the explanation and the instruction, and it is what
   * makes six slides read as one set rather than as six posts. The icons
   * are chosen for what they mean, so the row is also a picture of the
   * subject.
   */
  icons: {
    takes: 'icons',
    what: 'A row of three to six small objects from the icon pack, chosen for '
        + 'what they mean. It is the beat between the explaining and the '
        + 'instruction, and it is what ties a set of slides together.',
    height() { return M.icons.h; },
    draw(ctx, block, g, box, art) {
      const names = (block.icons ?? []).filter((n) => ICON_NAMES.includes(n));
      if (!names.length) return;
      const s = px.h(M.icons.h);
      const gap = px.w(M.icons.gap);
      const total = names.length * s + (names.length - 1) * gap;
      let x = box.x + (box.w - total) / 2;
      ctx.save();
      ctx.filter = iconFilter(g);
      for (const name of names) {
        const img = art?.icons?.[name];
        if (img) ctx.drawImage(img, x, box.y, s, s);
        x += s + gap;
      }
      ctx.restore();
    },
  },

  /**
   * The instruction: a label overlapping a panel.
   *
   * Two parts, overlapping on purpose. A label sitting neatly above its
   * panel is a heading; a label lapping over the corner of one is a
   * sticker somebody put there, and the difference is the whole reason
   * this reads as an instruction rather than as another paragraph.
   *
   * It is pinned to the foot rather than flowed, because the one thing
   * a reader must find on every slide should be in the same place on
   * every slide.
   */
  action: {
    takes: 'text',
    pinned: true,
    what: 'The one thing to actually do, in a sentence or two. Every slide '
        + 'ends with one and it is always in the same place, so a reader '
        + 'who only wants the instruction knows where to look.',
    height(ctx, block, g) {
      const inner = px.w(M.action.panelW) - px.w(M.action.padX) * 2;
      const n = lines(ctx, block.text, face(g, 'action'), inner, trackOf('action')).length;
      return M.action.label + 0.006
        + M.action.body * CAP + (n - 1) * M.action.body * M.action.lead
        + M.action.padY * 2;
    },
    draw(ctx, block, g, box) {
      const label = block.label || 'DO THIS:';
      /*
       * Both boxes are fixed, which is what the reference does and what
       * the first version got wrong.
       *
       * I sized the panel to its copy, so a one-line instruction gave a
       * narrow box that had drifted off the label. Measuring three of
       * their sheets: the panel sits at x 0.3386 and 0.4612 wide on all
       * three, whatever the copy. The overlap is the device, and a fixed
       * box is what guarantees it — the label's right quarter laps the
       * panel's left edge every time.
       */
      const labelX = px.w(M.action.labelX);
      const panelX = px.w(M.action.panelX);
      const panelW = px.w(M.action.panelW);
      const panelY = box.y + px.h(M.chip.h) * 0.63;

      const ls = lines(ctx, block.text, face(g, 'action'),
                       panelW - px.w(M.action.padX) * 2, trackOf('action'));
      const panelH = px.h(M.action.padY) * 2
        + sizeOf('action') * CAP
        + (ls.length - 1) * px.size(M.action.body * M.action.lead);

      const halo = px.h(0.0035);
      ctx.fillStyle = g.halo ?? g.ground;
      round(ctx, panelX - halo, panelY - halo,
            panelW + halo * 2, panelH + halo * 2, px.h(M.chip.r));
      ctx.fill();

      ctx.fillStyle = g.accentSoft2 ?? g.accentSoft;
      round(ctx, panelX, panelY, panelW, panelH, px.h(M.chip.r));
      ctx.fill();

      ctx.fillStyle = g.chipInk ?? g.mark;
      ctx.font = face(g, 'action');
      ctx.letterSpacing = trackOf('action');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ls.forEach((line, i) => {
        ctx.fillText(line, panelX + panelW / 2,
          panelY + px.h(M.action.padY) + sizeOf('action') * CAP
          + i * px.size(M.action.body * M.action.lead));
      });

      // the label last, so it laps OVER the panel rather than under it
      chip(ctx, g, label, labelX, box.y,
           { fill: 'accentSoft', role: 'label', align: 'left',
             width: px.w(M.action.labelW) });
    },
  },
};

export const BLOCK_NAMES = Object.keys(BLOCKS);

/*
 * Making the icons read on whatever they are standing on.
 *
 * The pack is one set of pale objects with a red accent, and its body
 * sits at luminance 205. Measured against the grounds: on ink the
 * difference is 187 and they are brilliant; on paper it is 31; on amber
 * it is 13, which is to say invisible. That is not something to fix by
 * eye per ground, because the grounds can change and the pack cannot.
 *
 * So the filter is computed. Aim for a difference of about 95, darken
 * when the ground is light and leave alone when it is dark, and clamp so
 * that no ground can crush the icons into silhouettes. A little extra
 * contrast goes with the darkening, because scaling brightness alone
 * flattens the red accent into the grey.
 */
const ICON_LUM = 205;      // measured across all sixteen
const WANT = 95;           // the difference that makes them read

function iconFilter(g) {
  const l = luminance(g.ground);
  if (l < 128) {
    // dark ground: they already stand out, and brightening blows the
    // pale structure out to a flat white shape
    return 'none';
  }
  const k = Math.max(0.42, Math.min(1, (l - WANT) / ICON_LUM));
  /* Saturation is put back as brightness is taken away. Scaling
     brightness alone darkens the pale structure AND the red accent, and
     on amber that turned the red to maroon: the icons read but stopped
     being these icons. Compensating keeps the accent the accent. */
  return `brightness(${k.toFixed(3)}) saturate(${(1 / k).toFixed(2)}) contrast(1.12)`;
}

function luminance(hex) {
  const h = String(hex).replace('#', '');
  const [r, gg, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * r + 0.7152 * gg + 0.0722 * b;
}

/* --------------------------------------------------------------- paint */

/*
 * THE TYPE: NEUE MONTREAL PAIRED WITH NEUEBIT.
 *
 * Ashley's pairing, not the reference's. A neo-grotesque carrying
 * everything that is read, and a bitmap face as the one odd voice on
 * the sheet.
 *
 * WHERE THE PIXEL GOES. On the two fixed small things: the rail across
 * the top and the DO THIS label. Both are short, both are the same on
 * every slide, and both are furniture rather than argument, which is
 * exactly what a bitmap face can carry without becoming a costume. It
 * does not touch the headline or the paragraphs. A pixel face at
 * display size is a joke about the nineties, and a pixel face under a
 * paragraph is unreadable at feed size.
 *
 * This also replaces the serif I had in the label. That came from
 * reading the reference, where the label IS a serif; this is Ashley's
 * pairing rather than theirs, and the bitmap does the same job of being
 * the one face that is not the body face.
 *
 * ON THE LICENCE. PP Neue Montreal and PP NeueBit are Pangram Pangram's
 * "free to try": personal use free, commercial use licensed, from $40.
 * These carousels are commercial. So the families are named here and
 * the loader falls back to licensed stand-ins until the real files are
 * bought and dropped into assets/fonts. Nothing else changes on the day
 * they land, which is the point of naming them rather than the files.
 *
 * THE TIGHTNESS STAYS, because it was measured rather than assumed: the
 * reference's headline runs 86-88% of a grotesque's natural width, and
 * its lines sit closer together than one em. Neue Montreal is a little
 * narrower than Helvetica to begin with, so the number may want easing
 * once the real file is in; it is one constant, in one place.
 */
export const TYPE = {
  title:  { family: 'NeueMontreal', weight: '800', track: -0.070 },
  say:    { family: 'NeueMontreal', weight: '500', track: 0 },
  chip:   { family: 'NeueMontreal', weight: '700', track: 0 },
  action: { family: 'NeueMontreal', weight: '500', track: 0 },
  label:  { family: 'NeueBit', weight: '400', track: 0.020 },
  rail:   { family: 'NeueBit', weight: '400', track: 0.060 },
};

const sizeOf = (role) => px.size(
  role === 'title' ? M.title.size
    : role === 'action' ? M.action.body
      : role === 'label' ? M.action.label
        : role === 'rail' ? M.rail.size
          : role === 'chip' ? M.chip.h * 0.52
            : M.say.size
);

const face = (g, role) => {
  const t = TYPE[role] ?? TYPE.say;
  return `${t.weight} ${sizeOf(role)}px ${t.family}`;
};

/** Tracking has to be set alongside the font, every time, or it leaks. */
const trackOf = (role) => {
  const t = TYPE[role] ?? TYPE.say;
  return `${t.track * sizeOf(role)}px`;
};

function setType(ctx, g, role) {
  ctx.fillStyle = g.mark;
  ctx.font = face(g, role);
  ctx.letterSpacing = trackOf(role);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
}

function round(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** How wide a chip will be, before drawing one. */
function chipWidth(ctx, text, role = 'chip') {
  const was = ctx.font;
  const wasT = ctx.letterSpacing;
  ctx.font = face(null, role);
  ctx.letterSpacing = trackOf(role);
  const w = ctx.measureText(String(text ?? '')).width + px.w(M.chip.padX) * 2;
  ctx.font = was;
  ctx.letterSpacing = wasT;
  return w;
}

/**
 * One phrase on a panel sized to the phrase.
 *
 * TWO layers, which is the thing that makes it read as a sticker rather
 * than as a highlight. At 5x the reference's chips have a pale halo
 * standing a couple of pixels proud of the coloured fill on every side —
 * a slightly larger rectangle behind, in a colour close to the paper.
 * Without it the chip is a rectangle of colour; with it, it is something
 * placed on the sheet.
 */
function chip(ctx, g, text, cx, y, { fill = 'accentSoft', role = 'chip',
                                     align = 'center', width = null } = {}) {
  ctx.font = face(g, role);
  ctx.letterSpacing = trackOf(role);
  const padX = px.w(M.chip.padX);

  /*
   * A fixed-width chip shrinks its type to fit rather than growing.
   *
   * The instruction's label is 0.2075 wide on every one of the
   * reference's sheets, and it has to stay that width because the panel
   * beside it is fixed too: a label that grows runs over the panel's
   * first line. It grew the moment the label's face changed to the
   * bitmap, which is wider than the grotesque it replaced, and "Send
   * yourself an enquiry" lost its opening letters. Fitting to the box
   * survives any face.
   */
  let tw = ctx.measureText(String(text ?? '')).width;
  if (width && tw + padX * 2 > width) {
    const shrunk = sizeOf(role) * ((width - padX * 2) / tw);
    ctx.font = `${TYPE[role].weight} ${shrunk}px ${TYPE[role].family}`;
    ctx.letterSpacing = `${TYPE[role].track * shrunk}px`;
    tw = ctx.measureText(String(text ?? '')).width;
  }
  const w = width ? Math.max(width, tw + padX * 2) : tw + padX * 2;
  const h = px.h(M.chip.h);
  const x = align === 'left' ? cx : cx - w / 2;
  const halo = px.h(0.0035);

  ctx.fillStyle = g.halo ?? g.ground;
  round(ctx, x - halo, y - halo, w + halo * 2, h + halo * 2, px.h(M.chip.r));
  ctx.fill();

  ctx.fillStyle = g[fill] ?? g.accent;
  round(ctx, x, y, w, h, px.h(M.chip.r));
  ctx.fill();

  ctx.fillStyle = g.chipInk ?? g.mark;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // centred on the box that was actually drawn, whatever the type did
  const em = parseFloat(ctx.font) || sizeOf(role);
  ctx.fillText(String(text ?? ''), x + (w - tw) / 2, y + h / 2 + em * CAP / 2);
}

/**
 * The rail across the top.
 *
 * Handle on the left, the series name on the right, on a band of the
 * ground's accent. It is the same on every slide of every carousel,
 * which is what makes a saved slide still say whose it is three months
 * later — and it is the only branding on the sheet, deliberately.
 */
function rail(ctx, g, { handle, series }) {
  const h = px.h(M.rail.h);
  ctx.fillStyle = g.accent;
  ctx.fillRect(0, 0, W, h);

  ctx.font = face(g, 'rail');
  ctx.letterSpacing = trackOf('rail');
  ctx.fillStyle = g.railInk ?? g.ground;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  if (handle) ctx.fillText(handle, px.w(M.rail.pad), h / 2);
  ctx.textAlign = 'right';
  if (series) ctx.fillText(series, W - px.w(M.rail.pad), h / 2);
}

/* -------------------------------------------------------------- ground */

/**
 * The grounds a content slide can use.
 *
 * Fewer than the hook engine's, and for a reason: a teaching slide is
 * read rather than glanced at, so a ground it cannot carry a paragraph
 * on is no use here at all. Each adds the two soft fills the chips and
 * the instruction panel need, because a chip at full accent strength
 * shouts louder than the headline.
 */
export const SLIDE_GROUNDS = {
  paper: { ...GROUNDS.paper, accentSoft: '#C9D9E8', accentSoft2: '#DCD0E8',
           chipInk: '#14120F', railInk: '#F2ECE0', halo: '#E4E0CF' },
  ink:   { ...GROUNDS.ink, accentSoft: '#2A3B4D', accentSoft2: '#3A3050',
           chipInk: '#F2ECE0', railInk: '#14120F', halo: '#2E2A24' },
  amber: { ...GROUNDS.amber, accentSoft: '#C9D9E8', accentSoft2: '#DCD0E8',
           chipInk: '#14120F', railInk: '#F2ECE0', halo: '#E2B824' },
};

export const SLIDE_GROUND_NAMES = Object.keys(SLIDE_GROUNDS);

/* ------------------------------------------------------------ templates
 *
 * A template is an ORDER of blocks with a job. Spark picks one by what
 * the slide is doing, not by what it looks like, which is the difference
 * between a choice it can make and a choice it cannot.
 *
 * `blocks` is the default order. A template does not forbid a different
 * one — a slide may give its own `blocks` array — but naming a template
 * is what stops the common case being reinvented five times a day.
 */
export const TEMPLATES = {
  open: {
    blocks: ['title', 'say', 'icons', 'action'],
    what: 'The first slide. Names the thing and says what it is, then the '
        + 'instruction. Nothing picked out yet, because there is nothing to '
        + 'pick out until the reader knows what the subject is.',
  },
  reasons: {
    blocks: ['title', 'say', 'chips', 'icons', 'action'],
    what: 'Why it matters. A short setup, then the reasons as chips. The '
        + 'workhorse: most middle slides are this one.',
  },
  steps: {
    blocks: ['title', 'say', 'chips', 'say', 'icons', 'action'],
    what: 'How to do it. Setup, the steps as chips, then a line that lands '
        + 'the whole thing. The second paragraph is the point of this '
        + 'template — it is the reassurance after the list.',
  },
  compare: {
    blocks: ['title', 'say', 'duo', 'say', 'icons', 'action'],
    what: 'Two kinds, side by side, with a line under each. Only for an '
        + 'actual difference between two things.',
  },
  proof: {
    blocks: ['title', 'say', 'chips', 'icons', 'action'],
    what: 'The same shape as reasons, used for evidence rather than '
        + 'argument: each chip is a figure you can point at. Named apart '
        + 'so a slide of numbers is a decision rather than an accident.',
  },
  close: {
    blocks: ['title', 'say', 'icons', 'action'],
    what: 'The last slide. What to do now. The instruction is the whole '
        + 'slide, so nothing competes with it.',
  },
};

export const TEMPLATE_NAMES = Object.keys(TEMPLATES);

/* ----------------------------------------------------------- the layout
 *
 * Measure every block, add the gaps, then decide where the stack starts.
 * The instruction is pinned to the foot first and everything else flows
 * into what is left, because the instruction's position is the promise
 * the format makes to a reader.
 */
export function layOut(ctx, slide, g) {
  const col = px.w(1 - M.margin * 2);
  const x = px.w(M.margin);
  const names = slide.blocks ?? TEMPLATES[slide.template]?.blocks ?? [];

  const flowing = [];
  let pinned = null;
  /* A template may use the same block twice — `steps` and `compare` both
     set a paragraph before their middle and another after it, and the
     one after is the whole point of those templates. So the second
     occurrence reads `say2`, the third `say3`. Without this both read
     `say` and the slide prints the same paragraph twice, which looks
     like a template that cannot count rather than like a bug. */
  const seen = new Map();
  for (const name of names) {
    const spec = BLOCKS[name];
    if (!spec) continue;
    const nth = (seen.get(name) ?? 0) + 1;
    seen.set(name, nth);
    const key = nth === 1 ? name : `${name}${nth}`;
    const block = { name, key, ...blockData(slide, name, key) };
    const h = spec.height(ctx, block, g, col);
    (spec.pinned ? (pinned = { block, h, spec }) : flowing.push({ block, h, spec }));
  }

  const out = [];
  if (pinned) {
    const y = 1 - M.foot - pinned.h;
    out.push({ ...pinned, box: { x, y: px.h(y), w: col, h: px.h(pinned.h) } });
  }

  /*
   * How tall the stack is, gaps included, before deciding where it goes.
   *
   * The first version top-anchored the flow and bottom-pinned the
   * instruction, which is what the reference looks like it does. It is
   * not: a short slide came out with a fifth of the frame empty between
   * the icons and the instruction, and the reference has no such hole
   * because its stack is settled into the space rather than hung from
   * the top. So the gaps are measured first and the whole stack is
   * centred in what is left.
   */
  const gapBefore = (i) => {
    if (i === 0) return 0;
    const prev = flowing[i - 1].block.name;
    return prev === 'title' ? M.gap.afterTitle
      : flowing[i].block.name === 'icons' ? M.gap.beforeIcons
        : M.gap.between;
  };
  const tall = flowing.reduce((sum, item, i) => sum + item.h + gapBefore(i), 0);

  const floor = pinned ? 1 - M.foot - pinned.h - M.gap.between : 1 - M.foot;
  const room = floor - M.top;

  /*
   * Slack goes into the gaps before it goes above and below.
   *
   * Centring alone fixed the wrong half of the problem. A short slide —
   * a closing one with a headline, a line and two icons — centred into a
   * tidy clump with a fifth of the frame empty under it, which reads as
   * a slide that ran out rather than one that is spacious. Opening the
   * gaps instead spends the space where it does something.
   *
   * Capped at 1.5x measured, because past that the blocks stop reading
   * as a stack and start reading as three unrelated things; whatever is
   * left over after the cap goes back to centring the whole stack.
   */
  const gaps = flowing.map((_, i) => gapBefore(i));
  const gapTotal = gaps.reduce((a, b) => a + b, 0);
  const slack = room - tall;
  let stretch = 1;
  if (slack > 0 && gapTotal > 0) {
    /* 1.5, not 2.6. Opening the gaps is how a thin slide breathes, but
       past about half again the sheet stops reading as the reference's
       dense stack and starts reading as widely spaced paragraphs, which
       is the thing that made the first set look timid. Whatever is left
       after the cap goes to centring, where it shows less. */
    stretch = Math.min(1.5, 1 + slack / gapTotal);
  }
  const stretched = tall + gapTotal * (stretch - 1);
  let y = stretched < room ? M.top + (room - stretched) / 2 : M.top;

  flowing.forEach((item, i) => {
    y += gaps[i] * stretch;
    out.push({ ...item, box: { x, y: px.h(y), w: col, h: px.h(item.h) } });
    y += item.h;
  });

  /* Did it fit? Reported rather than clipped: a slide whose copy is too
     long is a copy problem, and silently overlapping the instruction is
     how a carousel goes out unreadable. */
  return { placed: out, over: tall > room ? Number((tall - room).toFixed(4)) : 0 };
}

const blockData = (slide, name, key) => {
  const own = slide[key];
  if (own == null) return {};
  if (typeof own === 'string') return { text: own };
  if (Array.isArray(own)) {
    return name === 'icons' ? { icons: own }
      : name === 'duo' ? { pair: own } : { items: own };
  }
  return own;
};

/** Draw one slide onto a 1080x1350 context. */
export function drawSlide(ctx, slide, { art = {} } = {}) {
  const g = SLIDE_GROUNDS[slide.ground] ?? SLIDE_GROUNDS.paper;
  ctx.fillStyle = g.ground;
  ctx.fillRect(0, 0, W, H);
  if (art.scene) cover(ctx, art.scene, g);

  rail(ctx, g, slide);
  const { placed, over } = layOut(ctx, slide, g);
  for (const item of placed) item.spec.draw(ctx, item.block, g, item.box, art);
  return { over };
}

/** A photograph filling the frame, with the ground's own screen over it. */
function cover(ctx, img, g) {
  const scale = Math.max(W / img.width, H / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  ctx.save();
  ctx.globalAlpha = 0.82;
  ctx.fillStyle = g.ground;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** What Spark reads before it writes a slide. */
export const slideCatalogue = () => ({
  templates: TEMPLATE_NAMES.map((n) => ({
    name: n, blocks: TEMPLATES[n].blocks, what: TEMPLATES[n].what,
  })),
  blocks: BLOCK_NAMES.map((n) => ({
    name: n, takes: BLOCKS[n].takes, what: BLOCKS[n].what,
  })),
  grounds: SLIDE_GROUND_NAMES,
  icons: ICON_NAMES.map((n) => ({ name: n, means: ICONS[n].means })),
});
