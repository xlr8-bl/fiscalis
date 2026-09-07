/**
 * slides.js — teaching carousel. Blocks flow down the sheet.
 *
 * A FLOW, not compose.js's absolute boxes, because copy length varies:
 * measured across five reference slides, the icon row sits at 0.650 on
 * one and 0.712 on the next, and the block above it is what moved.
 *
 * Structure only is taken from the reference. None of their palette,
 * faces, words or branding.
 */

import { GROUNDS } from './design-spec.js';
import { ALL_ICONS, ICON_NAMES, PIXEL } from './icons.js';
import { CUTOUTS, placementOf } from '../../lib/slides/cutouts.js';

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

  // caps 0.0816 of frame = 0.113 em; lines 0.0893 apart, ie under one em
  title:    { size: 0.1133, lead: 0.0893 / 0.1133 },
  say:      { size: 0.0208, lead: 0.0330 / 0.0208 },  // line pitch 0.0330

  // centred: three reference sheets land on 0.4964, 0.4964, 0.4970
  chip:     { h: 0.0360, pitch: 0.0495, padX: 0.020, r: 0.004 },

  // 0.4806 wide for six, so they nearly touch. A wider gap reads as six marks
  icons:    { h: 0.0796, gap: 0.004 },

  /* Fixed boxes, same on all three reference sheets whatever the copy.
     Sizing the panel to its text pulls it off the label. */
  action:   { label: 0.0355, body: 0.0195, lead: 1.14,
              labelX: 0.1893, labelW: 0.2075, panelX: 0.3386, panelW: 0.4612,
              padX: 0.018, padY: 0.016 },

  // read off the reference's runs, rounded, not tuned
  gap:      { afterTitle: 0.063, between: 0.034, beforeIcons: 0.036 },
  top:      0.117,      // where the headline's cap starts
  foot:     0.030,      // clear space under the action block
};

/* Blocks. Each reports its height before drawing, which is what makes
   the flow possible. */

const CAP = 0.72;          // cap height as a fraction of the em, measured

function lines(ctx, text, font, maxW, track = '0px') {
  ctx.font = font;
  // must wrap WITH tracking on, or every line comes out the wrong length
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
  /** The headline. Display size, centred, two lines at most. */
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

  /** A paragraph, and the only block allowed to be prose. */
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

  /** Phrases on chips. Each is only as wide as its own words, which is
      what stops the stack reading as a table. */
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

  /** Two things side by side. The one shape a chip stack cannot do:
      side by side says "the two kinds", stacked says "three things". */
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
    what: 'Small objects from the icon pack, chosen for what they mean. Set '
        + '`where` to place them: "row" (the default) is the beat between the '
        + 'explaining and the instruction; "corner" drops two or three into the '
        + 'sheet\'s empty shoulder, turned off square; "edge" runs them down the '
        + 'side of a chip stack so the eye picks them up on the way past. Vary '
        + 'it across a set: a row every time is why nobody notices them.',
    /* A row is part of the stack and takes its height. Corner and edge
       are OVERLAYS: they sit beside something rather than after it, so
       they claim nothing. The first version gave them height and the
       edge icons landed in the empty band below the chips they were
       supposed to be running alongside. */
    height(_ctx, block) {
      return (block.where ?? 'row') === 'row' ? M.icons.h : 0;
    },
    draw(ctx, block, g, box, art, head) {
      const names = (block.icons ?? []).filter((n) => ICON_NAMES.includes(n));
      if (!names.length) return;
      const s = px.h(M.icons.h);
      /* Drawn at the icon's own aspect, fitted to the row's height. A
         square box squashed `lives`, which is three hearts wide, into
         three narrow slivers. */
      const wide = (img) => s * (img.width / img.height);
      ctx.save();

      /* Four arrangements. Angles are fixed per position, not random:
         the redo loop redraws single slides, and a random tilt would
         make the same slide come back different. */
      const where = block.where ?? 'row';
      if (where === 'corner') {
        const tilts = [-0.22, 0.15, -0.09];
        names.slice(0, 3).forEach((name, i) => {
          const img = art?.icons?.[name];
          if (!img) return;
          const cx = px.w(0.80) + i * px.w(0.055);
          const cy = px.h(0.125) + (i % 2) * px.h(0.048);
          const w = wide(img);
          ctx.save();
          ctx.filter = iconFilter(g, name);
          ctx.translate(cx, cy);
          ctx.rotate(tilts[i % tilts.length]);
          ctx.drawImage(img, -w / 2, -s / 2, w, s);
          ctx.restore();
        });
      } else if (where === 'edge') {
        /* Upward from this block's own y, so they run alongside whatever
           is directly above — normally a chip stack — rather than under
           it. Inset from the margin, because at the very edge of the
           frame they read as something that fell off. */
        const step = px.h(0.062);
        names.slice(0, 4).forEach((name, i) => {
          const img = art?.icons?.[name];
          if (!img) return;
          const w = wide(img) * 0.8;
          ctx.save();
          ctx.filter = iconFilter(g, name);
          ctx.translate(box.x + px.w(0.04), box.y - px.h(0.02) - i * step);
          ctx.rotate(i % 2 ? 0.12 : -0.12);
          ctx.drawImage(img, -w / 2, -s * 0.4, w, s * 0.8);
          ctx.restore();
        });
      } else if (where === 'scatter' && head) {
        /* Into the headline's ragged ends, at mixed sizes, drawn behind
           the type. Centred on a line end instead of past it, an icon
           lands squarely on a word. */
        const spots = [];
        head.lines.forEach((line, i) => {
          const cx = head.box.x + head.box.w / 2;
          const top = head.box.y + i * px.size(M.title.size * M.title.lead);
          const capH = px.size(M.title.size) * CAP;
          // the wedge at each end of this line, just outside the words
          // just past the last letter, lapping it and no more
          const out = s * 0.55;
          spots.push({ x: cx + line.w / 2 + out, y: top + capH * 0.10, s: 1.30, r: 0.12 });
          spots.push({ x: cx - line.w / 2 - out * 0.8, y: top + capH * 0.85, s: 0.85, r: -0.28 });
        });

        names.slice(0, 4).forEach((name, i) => {
          const img = art?.icons?.[name];
          if (!img) return;
          /* Alternate ends rather than taking them in order, so two
             icons never stack at the same side of one line. */
          const spot = spots[(i * 3 + 1) % spots.length];
          if (!spot) return;
          const size = s * spot.s;
          const w = size * (img.width / img.height);
          ctx.save();
          ctx.filter = iconFilter(g, name);
          ctx.translate(spot.x, spot.y);
          ctx.rotate(spot.r);
          ctx.drawImage(img, -w / 2, -size / 2, w, size);
          ctx.restore();
        });
      } else {
        const gap = px.w(M.icons.gap);
        const got = names.map((n) => [n, art?.icons?.[n]]).filter(([, i]) => i);
        const total = got.reduce((t, [, i]) => t + wide(i), 0) + (got.length - 1) * gap;
        let x = box.x + (box.w - total) / 2;
        for (const [name, img] of got) {
          ctx.filter = iconFilter(g, name);
          ctx.drawImage(img, x, box.y, wide(img), s);
          x += wide(img) + gap;
        }
      }
      ctx.restore();
    },
  },

  /**
   * A cut-out. The background is keyed by colour distance from the
   * frame's corners, which only works on the flat-ground photographs
   * SOURCES.md names. Placement comes from cutouts.js, never the slide.
   */
  portrait: {
    takes: 'portrait',
    what: 'One of Ashley\'s own photographs, cut out and screened to a single '
        + 'ink with a hard outline. For an opening or closing slide. It is a '
        + 'shape on the sheet, not a photograph in a box.',
    /* The height comes from the placement table, not from the slide. A
       cut-out whose size is a per-slide decision is a cut-out that
       changes size between slides of one carousel. */
    /* Nothing. A cut-out pinned to the sheet's edge and bled off it is
       not part of the stack, it is behind and beside it, so charging the
       flow for its height pushed the copy up and overflowed the slide.
       What it costs instead is WIDTH: layOut narrows the text column
       away from whichever edge the photograph is pinned to. */
    height() { return 0; },
    draw(ctx, block, g, box, art) {
      // the slide names a photograph by file stem: `portrait: 'blue-flat'`
      const name = block.text ?? block.name;
      const img = art?.portraits?.[name] ?? art?.portrait;
      const place = placementOf(name, block.context ?? 'cta');
      if (!img || !place || CUTOUTS[name]?.use !== 'cutout') return;

      /*
       * The anchor is the table's, and the table's alone.
       *
       * `bleed` runs the cut-out past the edge it is pinned to, because
       * one that stops short looks placed and one that runs off looks
       * photographed. Both are measured against the FRAME rather than
       * the block's box, since the whole point is leaving the column.
       */
      const h = px.h(place.h);
      const w = h * (img.width / img.height);
      const bleed = px.w(place.bleed);
      const x0 = place.at === 'left' ? -bleed
        : place.at === 'centre' ? (W - w) / 2
          : W - w + bleed;
      const y0 = place.from === 'bottom' ? H - px.h(M.foot) - h : box.y;

      cutout(ctx, img, { ...box, h, w }, g, { ...block, x0, y0 });
    },
  },

  /**
   * The instruction. The label laps the panel's corner on purpose: sat
   * neatly above it, it is a heading. Pinned to the foot so a reader
   * who only wants the instruction knows where to look.
   */
  action: {
    takes: 'text',
    pinned: true,
    what: 'The one thing to actually do, in a sentence or two. Every slide '
        + 'ends with one and it is always in the same place, so a reader '
        + 'who only wants the instruction knows where to look.',
    height(ctx, block, g, col) {
      const inner = Math.min(px.w(M.action.panelW), col) - px.w(M.action.padX) * 2;
      const n = lines(ctx, block.text, face(g, 'action'), inner, trackOf('action')).length;
      /* Same arithmetic as draw(): the first line clears the label, so
         the block is that much taller than its padding suggests. */
      const clear = Math.max(M.action.padY, M.chip.h * 0.37 + 0.004);
      return M.chip.h * 0.63 + clear + M.action.padY
        + M.action.body * CAP + (n - 1) * M.action.body * M.action.lead;
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
      /* Both boxes are the reference's, until the column says otherwise.
         A cut-out pinned to an edge narrows the column, and the panel
         has to come with it: at the reference's fixed width it ran
         straight under his face. */
      const right = box.x + box.w;
      const labelX = Math.max(px.w(M.action.labelX), box.x);
      const panelX = Math.max(px.w(M.action.panelX), labelX + px.w(0.10));
      const panelW = Math.min(px.w(M.action.panelW), right - panelX);
      const panelY = box.y + px.h(M.chip.h) * 0.63;

      /* The first line starts below the LABEL, not below the panel's own
         padding. The label laps the panel's top-left corner and is drawn
         last, so a first line that begins at the panel's padding has its
         opening words painted over: "Try to select" came out "y to
         select". Vertically clearing the label costs a few pixels and
         fixes it for any label width. */
      const clear = Math.max(px.h(M.action.padY),
                             box.y + px.h(M.chip.h) + px.h(0.004) - panelY);

      const ls = lines(ctx, block.text, face(g, 'action'),
                       panelW - px.w(M.action.padX) * 2, trackOf('action'));
      const panelH = clear + px.h(M.action.padY)
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
          panelY + clear + sizeOf('action') * CAP
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

/**
 * Icon contrast, computed rather than chosen per ground. The pack's body
 * is luminance 205; against the grounds that is a difference of 187 on
 * ink, 31 on paper, 13 on amber. Aim for 95.
 */
const ICON_LUM = 205;      // measured across all sixteen
const WANT = 95;           // the difference that makes them read

function iconFilter(g, name) {
  /* Only the kit needs it. Its objects are pale greys at luminance 205
     and vanish on a light ground; the pixel set is already coloured and
     dark, and darkening it turned the hearts to mud. */
  if (name && name in PIXEL) return 'none';
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

/** The rail. The same on every slide, and the only branding on a sheet. */
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

/** Fewer grounds than the hook engine: a teaching slide is all paragraph,
    so a display-only ground is no use. */
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
  portrait: {
    blocks: ['title', 'say', 'portrait', 'action'],
    what: 'An opening or closing slide carrying Ashley himself, cut out and '
        + 'screened to one ink. Use it once in a set at most: it is the slide '
        + 'that says a person is behind this, and twice makes it about him.',
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
  let col = px.w(1 - M.margin * 2);
  let x = px.w(M.margin);

  // a cut-out takes WIDTH, not height: the column gives up its side
  const cut = slide.portrait && placementOf(slide.portrait, slide.context ?? 'cta');
  if (cut && cut.at !== 'centre' && cut.at !== 'cover') {
    /* As much width as the cut-out actually occupies, not a constant.
       phone-chair is a whole seated figure and takes over half the
       sheet; a fixed third left the paragraph running under his knees. */
    const shape = CUTOUTS[slide.portrait]?.aspect ?? 0.8;
    const wide = px.h(cut.h) * shape - px.w(cut.bleed);
    const take = Math.min(px.w(0.52), Math.max(px.w(0.26), wide - px.w(0.04)));
    if (cut.at === 'left') { x += take; col -= take; } else { col -= take; }
  }
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
    /* The instruction keeps the FULL width even when a cut-out has
       narrowed the column. It is an opaque sticker drawn last, so it
       lies over the photograph rather than dodging it, which is what the
       collage wants anyway. Narrowing it squeezed "Send me the URL and I
       will tell you" into one word a line. */
    out.push({ ...pinned,
      box: { x: px.w(M.margin), y: px.h(y), w: px.w(1 - M.margin * 2), h: px.h(pinned.h) } });
  }

  // measure the gaps first, then settle the whole stack into the space
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

  /* Slack opens the gaps before it centres the stack. Capped at 1.5x:
     past that the blocks read as unrelated rather than as a stack. */
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
    /* `where` travels beside the icon list rather than inside it, because
       a slide reads better as `icons: [...], iconsWhere: 'corner'` than
       as a nested object, and Spark writes these by hand. */
    return name === 'icons' ? { icons: own, where: slide.iconsWhere }
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
  if (slide.grain !== false) grain(ctx, g, slide.slug ?? slide.title ?? '');

  rail(ctx, g, slide);
  const { placed, over } = layOut(ctx, slide, g);

  /* Where the headline landed, and how wide each of its lines is.
     `scatter` needs it: an icon dropped into type has to know where the
     type's ragged edges are, or it lands in the middle of a word. */
  const t = placed.find((i) => i.block.name === 'title');
  const head = t ? {
    box: t.box,
    lines: lines(ctx, t.block.text, face(g, 'title'), t.box.w, trackOf('title'))
      .map((line) => {
        ctx.font = face(g, 'title');
        ctx.letterSpacing = trackOf('title');
        return { text: line, w: ctx.measureText(line).width };
      }),
  } : null;

  /* Scattered icons go UNDER the type. They lap the headline by design,
     and on top they take letters out of it: an X across "nobody" and a
     bolt through "calls". Behind, the same overlap reads as depth. */
  const back = placed.filter((i) => i.block.name === 'icons' && i.block.where === 'scatter');
  for (const item of back) item.spec.draw(ctx, item.block, g, item.box, art, head);
  for (const item of placed) {
    if (back.includes(item)) continue;
    item.spec.draw(ctx, item.block, g, item.box, art, head);
  }

  /* Accents: one or two icons in the headline, ON TOP of whatever the
     icons block is doing. `iconsWhere: 'scatter'` REPLACES the row,
     which was the wrong reading — the row is the format and should not
     move. This adds an icon here and there and leaves it alone. */
  if (slide.accent?.length && head) accents(ctx, slide.accent, head, g, art);

  return { over };
}

/**
 * Cut the subject out with scissors.
 *
 * The silhouette is traced then simplified HARD. That is not an
 * optimisation, it is the effect: a hand cutting round a shape makes a
 * few centimetres per stroke and never follows a curve. A faithful
 * outline would be a die cut.
 */
function cutout(ctx, img, box, g, opts = {}) {
  const H_ = Math.round(box.h);
  const W_ = Math.round(H_ * (img.width / img.height));
  if (!W_ || !H_) return;

  const off = new OffscreenCanvas(W_, H_);
  const o = off.getContext('2d', { willReadFrequently: true });
  o.drawImage(img, 0, 0, W_, H_);
  const d = o.getImageData(0, 0, W_, H_).data;

  /* The ground, taken from the corners. Four samples rather than one,
     because a sweep is not perfectly even and one JPEG artefact would
     key the wrong colour entirely. */
  const at = (x, y) => { const i = (y * W_ + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
  const corners = [at(1, 1), at(W_ - 2, 1), at(1, H_ - 2), at(W_ - 2, H_ - 2)];
  const key = [0, 1, 2].map((c) => median(corners.map((p) => p[c])));
  const tol = (opts.tolerance ?? 0.20) * 441.7;

  const on = new Uint8Array(W_ * H_);
  for (let i = 0, p = 0; p < W_ * H_; p++, i += 4) {
    on[p] = Math.hypot(d[i] - key[0], d[i + 1] - key[1], d[i + 2] - key[2]) > tol ? 1 : 0;
  }

  // the subject's own box, for callers that need it
  let bx0 = W_; let by0 = H_; let bx1 = 0; let by1 = 0;
  for (let y = 0; y < H_; y++) {
    for (let x = 0; x < W_; x++) {
      if (!on[y * W_ + x]) continue;
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
      if (y < by0) by0 = y; if (y > by1) by1 = y;
    }
  }
  if (bx1 <= bx0 || by1 <= by0) return;

  /* Two polygons at two coarsenesses. `rough` is the paper, cut fast;
     `close` is where the photo clips. One polygon for both would give a
     perfectly even border, which is a die cut. */
  keepLargest(on, W_, H_);
  const contour = trace(on, W_, H_);
  const rough = simplify(contour, H_ * (opts.rough ?? 0.038));
  const close = simplify(contour, H_ * (opts.coarse ?? 0.011));
  if (rough.length < 3 || close.length < 3) return;

  const x0 = opts.x0 ?? (box.x + box.w - W_);
  const y0 = opts.y0 ?? box.y;

  const shape = (poly, grow) => {
    ctx.beginPath();
    const n = poly.length;
    poly.forEach(([qx, qy], i) => {
      let X = qx;
      let Y = qy;
      if (grow) {
        // along the vertex normal: radial growth is thick at the head,
        // thin at the shoulders
        const a = poly[(i - 1 + n) % n];
        const b = poly[(i + 1) % n];
        let nx = (qy - a[1]) + (b[1] - qy);
        let ny = -((qx - a[0]) + (b[0] - qx));
        const len = Math.hypot(nx, ny) || 1;
        X += (nx / len) * grow;
        Y += (ny / len) * grow;
      }
      i ? ctx.lineTo(x0 + X, y0 + Y) : ctx.moveTo(x0 + X, y0 + Y);
    });
    ctx.closePath();
  };

  const edge = Math.max(3, H_ * (opts.edge ?? 0.015));

  ctx.save();
  // the shadow, so it reads as lying on the sheet rather than printed in
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = g.mark;
  ctx.translate(px.w(0.007), px.h(0.007));
  shape(rough, edge);
  ctx.fill();
  ctx.restore();

  // the paper it was cut out of
  ctx.fillStyle = opts.paper ?? '#FFFFFF';
  shape(rough, edge);
  ctx.fill();

  // and the photograph, laid over it
  shape(close, 0);
  ctx.clip();
  ctx.drawImage(pixelate(img, W_, H_, opts.pixels), x0, y0, W_, H_);
  ctx.restore();
}

/**
 * Big square pixels, off by default. `pixels` is blocks across, so
 * lower is chunkier. On a face there is a level past which it stops
 * being recognisably him.
 */
function pixelate(img, W_, H_, blocks) {
  if (!blocks) return img;
  const w = Math.max(4, Math.round(blocks));
  const h = Math.max(4, Math.round(blocks * (H_ / W_)));
  const small = new OffscreenCanvas(w, h);
  const sc = small.getContext('2d');
  sc.imageSmoothingEnabled = true;          // average, so blocks are honest
  sc.drawImage(img, 0, 0, w, h);

  const big = new OffscreenCanvas(W_, H_);
  const bc = big.getContext('2d');
  bc.imageSmoothingEnabled = false;         // and hard-edged going back up
  bc.drawImage(small, 0, 0, W_, H_);
  return big;
}

/**
 * Keep only the biggest blob. The trace follows whichever region it hits
 * first, so one speck of noise becomes the whole cut-out: sky-arms came
 * out as a blue triangle.
 */
function keepLargest(on, W_, H_) {
  const label = new Int32Array(W_ * H_).fill(-1);
  const stack = [];
  let best = -1;
  let bestSize = 0;
  let next = 0;
  for (let p = 0; p < on.length; p++) {
    if (!on[p] || label[p] >= 0) continue;
    const id = next++;
    let size = 0;
    stack.push(p);
    label[p] = id;
    while (stack.length) {
      const q = stack.pop();
      size++;
      const x = q % W_;
      const y = (q - x) / W_;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W_ || ny >= H_) continue;
        const r = ny * W_ + nx;
        if (!on[r] || label[r] >= 0) continue;
        label[r] = id;
        stack.push(r);
      }
    }
    if (size > bestSize) { bestSize = size; best = id; }
  }
  for (let p = 0; p < on.length; p++) if (label[p] !== best) on[p] = 0;
}

/**
 * One or two icons dropped into the headline, over the type rather than
 * behind it, small. Different spots from `scatter` so the two can be on
 * one slide without landing on each other.
 */
function accents(ctx, names, head, g, art) {
  const s = px.h(M.icons.h) * 0.62;
  ctx.save();
  names.slice(0, 2).forEach((name, i) => {
    const img = art?.icons?.[name];
    if (!img) return;
    const line = head.lines[Math.min(i, head.lines.length - 1)];
    const cx = head.box.x + head.box.w / 2;
    const top = head.box.y + Math.min(i, head.lines.length - 1)
      * px.size(M.title.size * M.title.lead);
    // tucked just inside the line's end, riding its cap
    const x = i % 2 ? cx - line.w / 2 + s * 0.3 : cx + line.w / 2 - s * 0.3;
    const w = s * (img.width / img.height);
    ctx.save();
    ctx.filter = iconFilter(g, name);
    ctx.translate(x, top - s * 0.15);
    ctx.rotate(i % 2 ? -0.20 : 0.22);
    ctx.drawImage(img, -w / 2, -s / 2, w, s);
    ctx.restore();
  });
  ctx.restore();
}

/** Moore boundary trace. Outer boundary only: scissors do not cut holes. */
function trace(on, W_, H_) {
  let sx = -1;
  let sy = -1;
  for (let y = 0; y < H_ && sx < 0; y++) {
    for (let x = 0; x < W_; x++) if (on[y * W_ + x]) { sx = x; sy = y; break; }
  }
  if (sx < 0) return [];

  const N = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const out = [[sx, sy]];
  let cx = sx;
  let cy = sy;
  let dir = 6;
  for (let step = 0; step < W_ * H_ * 4; step++) {
    let moved = false;
    for (let k = 0; k < 8; k++) {
      const nd = (dir + 6 + k) % 8;
      const nx = cx + N[nd][0];
      const ny = cy + N[nd][1];
      if (nx < 0 || ny < 0 || nx >= W_ || ny >= H_ || !on[ny * W_ + nx]) continue;
      cx = nx; cy = ny; dir = nd; moved = true;
      out.push([cx, cy]);
      break;
    }
    if (!moved) break;
    if (cx === sx && cy === sy && out.length > 8) break;
  }
  return out;
}

/** Ramer-Douglas-Peucker, coarse on purpose. See cutout(). */
function simplify(pts, eps) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let far = -1;
    let best = eps;
    for (let i = a + 1; i < b; i++) {
      const dist = perp(pts[i], pts[a], pts[b]);
      if (dist > best) { best = dist; far = i; }
    }
    if (far > 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

function perp(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (!len) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
}

const centroid = (poly) => [
  poly.reduce((s, p) => s + p[0], 0) / poly.length,
  poly.reduce((s, p) => s + p[1], 0) / poly.length,
];

const median = (a) => [...a].sort((p, q) => p - q)[Math.floor(a.length / 2)];

/**
 * Paper grain: single pixels, low strength. Seeded from the slide, so a
 * redrawn slide still matches the ones around it.
 */
function grain(ctx, g, seed) {
  const r = rng(hash(String(seed)));
  const img = ctx.createImageData(W, H);
  const px_ = img.data;
  const base = hex(g.ground);
  const spread = 9;
  for (let i = 0; i < px_.length; i += 4) {
    const n = (r() - 0.5) * spread * 2;
    px_[i] = base[0] + n;
    px_[i + 1] = base[1] + n;
    px_[i + 2] = base[2] + n;
    px_[i + 3] = 26;
  }
  const off = new OffscreenCanvas(W, H);
  off.getContext('2d').putImageData(img, 0, 0);
  ctx.drawImage(off, 0, 0);
}

const hex = (h) => {
  const v = String(h).replace('#', '');
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
};

/** mulberry32, and FNV-1a, so a slide grains the same way every render. */
function rng(a) {
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
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
  icons: ICON_NAMES.map((n) => ({ name: n, means: ALL_ICONS[n].means })),
});
