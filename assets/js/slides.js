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
import { CUTOUTS, placementOf } from './cutouts.js';
import { APP_LABELS } from './apps.js';

export const W = 1080;
export const H = 1350;

const px = { w: (v) => v * W, h: (v) => v * H, size: (v) => v * H };
// a height already in frame fractions, for a block adding to its own top
const M_h = (v) => v * H;

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

  /* The closing blocks. A recap line is set at the paragraph size and
     given a pitch a little over twice it, so the rules under the lines
     have air and five of them still clear the instruction. */
  /* `pitch` is the roomy one and `min` the tight one; a recap of eight
     uses the tight one. `budget` is what the whole list may occupy, so a
     long recap gets denser instead of pushing the instruction off. */
  recap:    { size: 0.0208, pitch: 0.049, min: 0.0315, budget: 0.300,
              num: 0.0230, indent: 0.072 },
  echo:     { size: 0.0170, gap: 0.022 },

  /* The hanging object. Read off the reference, which is 736x736: the
     object's box runs x 0.30..0.48 and y 0.00..0.71 there, cord off the
     top edge, ring marks in an arc off the earpiece. Carried over as
     fractions of this frame, which is 4:5 and so taller. */
  hang:     { x: 0.20, h: 0.62, earX: 0.60, earY: 0.88,
              marks: 7, markR: 0.085, markLen: 0.030,
              /* Above the instruction, not under it. The instruction keeps
                 full width and its label starts at 0.1893, which is where
                 the address was ending. */
              foot: 0.845, addr: 0.0175, col: 0.50 },
  mark:     { size: 0.0300, padX: 0.014, padY: 0.007, gap: 0.016 },
  prompt:   { gap: 0.020, row: 0.011 },
  line:     { size: 0.0165 },

  /* The blocks that carry evidence rather than argument. None of these
     is off a reference card: the set had nothing that could show a real
     page or a real figure, so these are chosen against the sheet and
     then measured back out of the renderer by check_slides. */

  // 16:10, which is the shape the capture comes back as, plus the bar
  shot:     { w: 0.72, chromeH: 0.030, dot: 0.0055, urlSize: 0.0150,
              cap: 0.0165, capGap: 0.014, r: 0.006 },
  // a bar is the row; `gapRow` is between rows; `lab` is the name beside it
  bars:     { rowH: 0.0300, gapRow: 0.0130, lab: 0.0165, val: 0.0165,
              labW: 0.30, r: 0.003 },
  // two stacked halves: what not to do, struck through, then what to do
  swap:     { size: 0.0215, padX: 0.020, padY: 0.011, gap: 0.020, r: 0.004 },
  // the word IS this slide's headline, so it is set near headline size
  term:     { word: 0.0980, gap: 0.034, size: 0.0225, lead: 1.45 },
  apps:     { h: 0.0660, gap: 0.052, lab: 0.0135, labGap: 0.016 },
  quote:    { size: 0.0430, lead: 1.24, who: 0.0165, whoGap: 0.026, markX: 0.030 },
  stat:     { size: 0.1500, of: 0.0210, ofGap: 0.020 },
  source:   { size: 0.0140 },

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
      /* Off by default. At 0.18 nearly a fifth of a headline came out in
         the bitmap face, and a swapped letter inside a common word does
         not read as a device: "broken" read as a typo and "second" as a
         glyph that failed to load, because the bitmap is lighter than the
         800-weight grotesque around it. It also contradicted the rule
         written on TYPE below, which says the pixel face carries the rail
         and the label and never the headline. A slide can still ask for
         it by name; nothing asks by accident. */
      const mix = block.mix ?? 0;
      /* A word wider than the column cannot wrap, so it overflows: a big
         cut-out narrowed the portrait slide's column to 336px and
         "checking" is 537px, which came out with its first letter off the
         sheet. Shrink the headline to fit instead. Clipping is the one
         failure that is invisible until it has posted. */
      const widest = Math.max(...ls.map((line, i) =>
        mixedRun(ctx, g, line, mix, `${block.text}|${i}`).total));
      const k = widest > box.w ? box.w / widest : 1;
      ls.forEach((line, i) => {
        const y = box.y + px.size(M.title.size) * CAP
          + i * px.size(M.title.size * M.title.lead);
        drawMixed(ctx, g, line, alignX(box, block.align), y, mix,
                  `${block.text}|${i}`, block.align, k);
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
      return (block.mark ? M.mark.size * CAP + M.mark.gap : 0)
        + M.say.size * CAP + (n - 1) * M.say.size * M.say.lead;
    },
    draw(ctx, block, g, box) {
      let top = box.y;
      /* One word or two, on a marker swipe, above the paragraph. The
         swipe is drawn behind and slightly low, the way a highlighter
         goes on over something already printed rather than around it. */
      if (block.mark) {
        setType(ctx, g, 'say');
        const s = px.size(M.mark.size);
        ctx.font = `${TYPE.chip.weight} ${s}px ${TYPE.chip.family}`;
        ctx.textAlign = 'left';
        const x = alignX(box, block.align ?? 'left');
        const w = ctx.measureText(block.mark).width;
        const base = top + s * CAP;
        ctx.save();
        ctx.fillStyle = g.accentSoft;
        ctx.fillRect(x - px.w(M.mark.padX), base - s * CAP - px.h(M.mark.padY) * 0.4,
                     w + px.w(M.mark.padX) * 2, s * CAP + px.h(M.mark.padY) * 1.7);
        ctx.restore();
        ctx.fillStyle = g.mark;
        ctx.fillText(block.mark, x, base);
        top += M_h(M.mark.size * CAP + M.mark.gap);
      }
      setType(ctx, g, 'say');
      const ls = lines(ctx, block.text, face(g, 'say'), box.w, trackOf('say'));
      ctx.textAlign = alignTo(block.align);
      const x = alignX(box, block.align);
      ls.forEach((line, i) => {
        const y = top + px.size(M.say.size) * CAP
          + i * px.size(M.say.size * M.say.lead);
        ctx.fillText(line, x, y);
      });
      ctx.textAlign = 'center';
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

  /**
   * The carousel restated, one numbered line each.
   *
   * Not chips. A chip stack is a set of things that belong together and
   * is the shape used mid-carousel; this is the same carousel read back,
   * so it is numbered and it runs full width. Numbering is what makes it
   * legible as a recap rather than as another list of reasons.
   */
  recap: {
    takes: 'items',
    what: 'The carousel read back, two to five numbered lines, one for each '
        + 'slide that mattered. For a closing slide: somebody who swiped '
        + 'without reading gets the whole thing here, and somebody who did '
        + 'read gets it confirmed.',
    height(_ctx, block) {
      const n = Math.max(1, (block.items ?? []).length);
      return n * recapPitch(n);
    },
    draw(ctx, block, g, box) {
      const items = block.items ?? [];
      const num = px.size(M.recap.num);
      const pitch = recapPitch(items.length);
      items.forEach((text, i) => {
        const y = box.y + i * px.h(pitch) + px.size(M.recap.size) * CAP;
        setType(ctx, g, 'label');
        ctx.font = `${TYPE.label.weight} ${num}px ${TYPE.label.family}`;
        ctx.textAlign = 'left';
        ctx.fillText(String(i + 1).padStart(2, '0'), box.x, y);
        ctx.font = `${TYPE.say.weight} ${px.size(M.recap.size)}px ${TYPE.say.family}`;
        ctx.letterSpacing = trackOf('say');
        ctx.fillText(text, box.x + px.w(M.recap.indent), y);
        // a hairline under each, so five lines read as five and not as a paragraph
        ctx.globalAlpha = 0.22;
        ctx.fillRect(box.x, y + px.h(0.012), box.w, Math.max(1, px.h(0.0009)));
        ctx.globalAlpha = 1;
      });
      ctx.textAlign = 'center';
    },
  },

  /**
   * The headline the carousel opened with, set small above the one it
   * closes with. The research calls it a bookend and it is the one
   * device that makes a last slide unmistakably last: the reader is
   * shown the question they were asked, answered.
   */
  echo: {
    takes: 'text',
    what: 'The headline this carousel OPENED with, repeated small above the '
        + 'closing headline. Only on a closing slide, and only the opening '
        + 'line verbatim: paraphrasing it breaks the loop it exists to close.',
    height(_ctx, _block) { return M.echo.size * CAP + M.echo.gap; },
    draw(ctx, block, g, box) {
      setType(ctx, g, 'label');
      ctx.font = `${TYPE.label.weight} ${px.size(M.echo.size)}px ${TYPE.label.family}`;
      ctx.letterSpacing = `${0.04 * px.size(M.echo.size)}px`;
      ctx.textAlign = alignTo(block.align);
      ctx.globalAlpha = 0.55;
      const y = box.y + px.size(M.echo.size) * CAP;
      ctx.fillText(`YOU ASKED: ${String(block.text ?? '').toUpperCase()}`,
                   alignX(box, block.align), y);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
    },
  },

  /**
   * The object on its cord, ringing, with the address at the foot.
   *
   * One arrangement, fixed. It hangs from the top edge rather than
   * sitting on the sheet, which is the whole trick: the cord running off
   * the frame is what makes it read as an object in a room instead of a
   * picture of a telephone. The marks say it is ringing and nobody has
   * picked it up, which is the point of the slide.
   *
   * Costs no height. What it costs is the left half of the sheet, taken
   * in layOut, the same way a cut-out takes its side.
   */
  calling: {
    takes: 'nothing',
    what: 'A handset hanging on its cord, ringing, and the address at the '
        + 'foot. The closing slide for a carousel about not being reachable: '
        + 'it is the only one that shows the thing going unanswered rather '
        + 'than saying it. Nothing to set.',
    height() { return 0; },
    draw(ctx, block, g, box, art) {
      const img = art?.objects?.handset;
      const h = px.h(M.hang.h);
      const w = img ? h * (img.width / img.height) : px.w(0.19);
      const x0 = px.w(M.hang.x);

      if (img) {
        ctx.save();
        /* Near-black on paper, near-paper on ink. The photographs are
           monochrome now and an object that is not would be the only
           colour on the sheet. */
        /* Barely touched on paper: it is already a black object, and
           crushing it further took the highlights off the handset and
           left a blob. Inverted on ink, where black on black is nothing. */
        ctx.filter = g.ground === GROUNDS.ink.ground
          ? 'grayscale(1) invert(1) brightness(1.05)'
          : 'grayscale(1) contrast(1.08)';
        ctx.drawImage(img, x0, 0, w, h);
        ctx.restore();
      }

      // the ring marks, an arc off the earpiece, none of them touching it
      const ex = x0 + w * M.hang.earX;
      const ey = h * M.hang.earY;
      const r = px.h(M.hang.markR);
      const len = px.h(M.hang.markLen);
      ctx.save();
      ctx.strokeStyle = g.mark;
      ctx.lineWidth = Math.max(2, px.h(0.0035));
      ctx.lineCap = 'round';
      for (let i = 0; i < M.hang.marks; i++) {
        const a = (-0.85 + (1.7 * i) / (M.hang.marks - 1));
        ctx.beginPath();
        ctx.moveTo(ex + Math.cos(a) * r, ey + Math.sin(a) * r);
        ctx.lineTo(ex + Math.cos(a) * (r + len), ey + Math.sin(a) * (r + len));
        ctx.stroke();
      }
      ctx.restore();

      // the address, behind a short rule, the way a sheet is signed
      const fy = px.h(M.hang.foot);
      const s = px.size(M.hang.addr);
      ctx.save();
      ctx.fillStyle = g.mark;
      ctx.fillRect(px.w(M.margin), fy - s, Math.max(2, px.w(0.0022)), s * 1.5);
      ctx.font = `${TYPE.label.weight} ${s}px ${TYPE.label.family}`;
      ctx.letterSpacing = `${0.03 * s}px`;
      ctx.textAlign = 'left';
      ctx.fillText(block.address ?? 'web3ashley.com', px.w(M.margin) + px.w(0.022), fy);
      ctx.textAlign = 'center';
      ctx.restore();
    },
  },

  /**
   * A question with the answers already on it, so replying costs a
   * letter.
   *
   * This is the engagement device and it is the only one. It works
   * where "let me know what you think" does not, for a reason worth
   * writing down: an open question asks the reader to compose a
   * sentence, and almost nobody will, whereas a question with three
   * answers on it asks them to type one character. The answers also do
   * the harder job, which is telling Ashley which of the three the
   * reader actually is.
   *
   * It never replaces the instruction. One ask per carousel is the one
   * thing every source agrees on, so this sits ABOVE the instruction and
   * is the soft one: the reader who answers has done something, and the
   * reader who acts on the instruction has done the thing.
   */
  prompt: {
    takes: 'question',
    /* Optional, because a recap of nine lines and a prompt do not both
       fit and the list is the point of that slide. Dropping it is a
       decision the writer makes, not a silent truncation of the list. */
    optional: true,
    what: 'A question with two to three answers on it, for the closing slide. '
        + 'The reader replies with a letter rather than a sentence, which is '
        + 'the whole reason it works. Ask something only somebody who read '
        + 'THIS carousel could answer, never a general one.',
    height(ctx, block, g, col) {
      if (!block.question) return 0;
      const n = lines(ctx, block.question, face(g, 'say'), col, trackOf('say')).length;
      const rows = packOptions(ctx, block.options, col).rows.length;
      return M.say.size * CAP + (n - 1) * M.say.size * M.say.lead
        + M.prompt.gap + rows * M.chip.h + (rows - 1) * M.prompt.row;
    },
    draw(ctx, block, g, box) {
      if (!block.question) return;
      setType(ctx, g, 'say');
      const ls = lines(ctx, block.question, face(g, 'say'), box.w, trackOf('say'));
      ctx.textAlign = alignTo(block.align);
      const ax = alignX(box, block.align);
      ls.forEach((line, i) => {
        ctx.fillText(line, ax, box.y + px.size(M.say.size) * CAP
          + i * px.size(M.say.size * M.say.lead));
      });
      const top = box.y + px.h(M.say.size * CAP
        + (ls.length - 1) * M.say.size * M.say.lead + M.prompt.gap);

      const { rows, gap } = packOptions(ctx, block.options, box.w);
      let n = 0;
      rows.forEach((row, r) => {
        const total = row.reduce((a, o) => a + o.w, 0) + gap * (row.length - 1);
        let x = block.align === 'left' ? box.x
          : block.align === 'right' ? box.x + box.w - total
            : box.x + (box.w - total) / 2;
        const y = top + r * px.h(M.chip.h + M.prompt.row);
        row.forEach((o) => {
          chip(ctx, g, o.text, x + o.w / 2, y,
               { fill: n++ === 0 ? 'accentSoft' : 'accentSoft2' });
          x += o.w + gap;
        });
      });
      ctx.textAlign = 'center';
    },
  },

  /**
   * Who it is for, small, near the foot. One line, and it names both
   * halves of the same person: no site yet, and a site that is not
   * working. Naming one loses the other.
   */
  line: {
    takes: 'text',
    /* Optional, unlike every other block a template names. A standing
       line on every single outro stops being read: it is a signature,
       and a signature on all of them is wallpaper. */
    optional: true,
    what: 'One quiet line saying who this is for. Both halves in it: '
        + 'somebody putting a first site up and somebody fixing the one they '
        + 'have. Set from AUDIENCE in brand.js. No price, no package, and no '
        + 'promise of a result.',
    height(_ctx, block) { return block.text ? M.line.size * CAP : 0; },
    draw(ctx, block, g, box) {
      if (!block.text) return;
      setType(ctx, g, 'say');
      ctx.font = `${TYPE.label.weight} ${px.size(M.line.size)}px ${TYPE.label.family}`;
      ctx.letterSpacing = `${0.02 * px.size(M.line.size)}px`;
      ctx.textAlign = alignTo(block.align);
      ctx.globalAlpha = 0.62;
      ctx.fillText(block.text, alignX(box, block.align),
                   box.y + px.size(M.line.size) * CAP);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
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
   * A real page, in browser chrome, with its address showing.
   *
   * The address bar is not decoration: it is the citation. A screenshot
   * with no URL on it is an assertion, and this set's whole standard is
   * that a claim is traceable. So the frame draws what was captured and
   * where it came from as one object, and neither can be set without
   * the other.
   */
  shot: {
    takes: 'shot',
    what: 'A screenshot of a real page, drawn in browser chrome with its '
        + 'address showing. Capture it with capture_page and pass the key it '
        + 'gives back as `src`, with the page\'s address as `url`. The '
        + 'address IS the citation, so both are required. `caption` is one '
        + 'line under it saying what to look at.',
    height(ctx, block, g, col) {
      const w = Math.min(px.w(M.shot.w), col);
      // 16:10 is what the capture comes back as, plus the chrome bar
      const h = w * 0.625 + px.h(M.shot.chromeH);
      if (!block.caption) return h / H;
      const ls = lines(ctx, block.caption, face(g, 'caption'), w, trackOf('caption'));
      return (h + px.h(M.shot.capGap)) / H + ls.length * M.shot.cap * 1.35;
    },
    draw(ctx, block, g, box, art) {
      const img = art?.shots?.[block.src];
      const w = Math.min(px.w(M.shot.w), box.w);
      const bar = px.h(M.shot.chromeH);
      const h = w * 0.625;
      const x = box.x + (box.w - w) / 2;
      const r = px.h(M.shot.r);

      ctx.save();
      /* The whole frame on one path, so the picture is clipped by the
         same rounded corner the chrome has. Two paths and the capture's
         square corners poke out of the frame's round ones. */
      round(ctx, x, box.y, w, bar + h, r);
      ctx.fillStyle = g.mark;
      ctx.fill();
      ctx.clip();

      if (img) ctx.drawImage(img, x, box.y + bar, w, h);
      else {
        // nothing captured yet: the frame still says what is missing
        ctx.fillStyle = g.halo ?? g.ground;
        ctx.fillRect(x, box.y + bar, w, h);
      }
      ctx.restore();

      // three dots, then the address, in the chrome bar
      const d = px.h(M.shot.dot);
      ctx.fillStyle = g.ground;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(x + px.w(0.018) + i * d * 3.2, box.y + bar / 2, d, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.font = face(g, 'url');
      ctx.letterSpacing = trackOf('url');
      ctx.textAlign = 'left';
      ctx.fillStyle = g.ground;
      ctx.fillText(shortUrl(block.url), x + px.w(0.075),
                   box.y + bar / 2 + px.size(M.shot.urlSize) * CAP * 0.5);
      ctx.textAlign = 'center';

      if (!block.caption) return;
      setType(ctx, g, 'caption');
      const ls = lines(ctx, block.caption, face(g, 'caption'), w, trackOf('caption'));
      ls.forEach((line, i) => {
        ctx.fillText(line, box.x + box.w / 2,
          box.y + bar + h + px.h(M.shot.capGap)
          + px.size(M.shot.cap) * CAP + i * px.size(M.shot.cap * 1.35));
      });
    },
  },

  /**
   * Figures as bars, with where they came from underneath.
   *
   * Proportional to the largest, not to a scale starting anywhere but
   * zero: a truncated axis is the oldest way to lie with a chart and
   * this set does not get to use it. `source` is required for the same
   * reason the shot's URL is.
   */
  bars: {
    takes: 'bars',
    what: 'Two to five figures as bars, each a name and a number. Longest '
        + 'bar is the largest value and every bar is proportional to it from '
        + 'zero, so the picture cannot mislead. `unit` labels the numbers '
        + '("seconds", "%"). Needs a `source` block on the slide saying where '
        + 'the figures came from; a chart with no source is a drawing.',
    height(_ctx, block) {
      const n = Math.max(1, (block.items ?? []).length);
      return n * M.bars.rowH + (n - 1) * M.bars.gapRow;
    },
    draw(ctx, block, g, box) {
      const items = (block.items ?? []).slice(0, 5);
      const most = Math.max(...items.map((i) => Number(i.value) || 0), 1);
      const labW = Math.min(px.w(M.bars.labW), box.w * 0.34);
      const track = box.w - labW - px.w(0.02);
      const rowH = px.h(M.bars.rowH);

      items.forEach((item, i) => {
        const y = box.y + i * (rowH + px.h(M.bars.gapRow));
        ctx.textAlign = 'left';
        ctx.font = face(g, 'barLab');
        ctx.letterSpacing = trackOf('barLab');
        ctx.fillStyle = g.mark;
        ctx.fillText(item.label, box.x, y + rowH / 2 + px.size(M.bars.lab) * CAP * 0.5);

        const w = Math.max(px.w(0.01), track * ((Number(item.value) || 0) / most));
        const x = box.x + labW;
        ctx.fillStyle = i === 0 ? g.accent : (g.accentSoft ?? g.accent);
        round(ctx, x, y, w, rowH, px.h(M.bars.r));
        ctx.fill();

        ctx.font = face(g, 'barVal');
        ctx.letterSpacing = trackOf('barVal');
        ctx.fillStyle = g.mark;
        const text = `${item.value}${block.unit ? ` ${block.unit}` : ''}`;
        ctx.fillText(text, x + w + px.w(0.014),
                     y + rowH / 2 + px.size(M.bars.val) * CAP * 0.5);
      });
      ctx.textAlign = 'center';
    },
  },

  /**
   * Instead of this, do this. The instruction as a slide of its own.
   *
   * The DO THIS: panel used to sit on every template, so a five-slide
   * set gave a reader five orders and none of them landed. This is the
   * shape that actually wants one: the wrong way struck through, the
   * right way under it, and nothing else on the sheet.
   */
  swap: {
    takes: 'pair',
    what: 'Two lines: what people do, struck through, and what to do instead '
        + 'under it. `pair` is [{ head, tail }] where head is the wrong way '
        + 'and tail is the right one. This is the instruction slide; a '
        + 'teaching panel does not carry one.',
    height(ctx, block, g, col) {
      const [a, b] = block.pair ?? [];
      const inner = col - px.w(M.swap.padX) * 2;
      const n = (t) => (t ? lines(ctx, t, face(g, 'swap'), inner, trackOf('swap')).length : 0);
      const one = (t) => (n(t) * M.swap.size * 1.42 + M.swap.padY * 2);
      return one(a?.head) + M.swap.gap + one(a?.tail ?? b?.head);
    },
    draw(ctx, block, g, box) {
      const [a] = block.pair ?? [];
      if (!a) return;
      const inner = box.w - px.w(M.swap.padX) * 2;
      let y = box.y;

      for (const [text, strike] of [[a.head, true], [a.tail, false]]) {
        if (!text) continue;
        const ls = lines(ctx, text, face(g, 'swap'), inner, trackOf('swap'));
        const h = ls.length * px.size(M.swap.size * 1.42) + px.h(M.swap.padY) * 2;
        ctx.fillStyle = strike ? (g.halo ?? g.ground) : (g.accentSoft ?? g.accent);
        round(ctx, box.x, y, box.w, h, px.h(M.swap.r));
        ctx.fill();

        ctx.font = face(g, 'swap');
        ctx.letterSpacing = trackOf('swap');
        ctx.fillStyle = g.chipInk ?? g.mark;
        ctx.textAlign = 'left';
        ls.forEach((line, i) => {
          const ty = y + px.h(M.swap.padY) + px.size(M.swap.size) * CAP
            + i * px.size(M.swap.size * 1.42);
          const tx = box.x + px.w(M.swap.padX);
          ctx.fillText(line, tx, ty);
          /* Ruled through rather than greyed out. Grey reads as
             secondary; a line through it reads as refused, which is
             what the half means. */
          if (!strike) return;
          const lw = ctx.measureText(line).width;
          ctx.fillRect(tx, ty - px.size(M.swap.size) * CAP * 0.34,
                       lw, Math.max(2, px.h(0.0016)));
        });
        y += h + px.h(M.swap.gap);
      }
      ctx.textAlign = 'center';
    },
  },

  /**
   * One word and what it actually means. The educational slide.
   *
   * The jargon rule says a technical term is dropped and moved past,
   * never defined mid-paragraph. This is where a term gets defined
   * instead: on its own sheet, where a reader can save it.
   */
  term: {
    takes: 'term',
    what: 'One technical word set large, and underneath it what it means in '
        + 'plain language, in a sentence or two. `term` is { word, means }. '
        + 'For teaching a word somebody has been nodding along to. Never '
        + 'more than one word a slide.',
    height(ctx, block, g, col) {
      const ls = lines(ctx, block.means, face(g, 'means'), col, trackOf('means'));
      return M.term.word * CAP + M.term.gap
        + ls.length * M.term.size * M.term.lead;
    },
    draw(ctx, block, g, box) {
      setType(ctx, g, 'word');
      ctx.textAlign = alignTo(block.align);
      const x = alignX(box, block.align);
      ctx.fillText(block.word ?? '', x, box.y + px.size(M.term.word) * CAP);

      setType(ctx, g, 'means');
      ctx.textAlign = alignTo(block.align);
      const ls = lines(ctx, block.means, face(g, 'means'), box.w, trackOf('means'));
      ls.forEach((line, i) => {
        ctx.fillText(line, x,
          box.y + px.size(M.term.word) * CAP + px.h(M.term.gap)
          + px.size(M.term.size) * CAP + i * px.size(M.term.size * M.term.lead));
      });
      ctx.textAlign = 'center';
    },
  },

  /**
   * The tools, named by their own marks.
   *
   * A brand mark here NAMES the thing being discussed and does nothing
   * else. It never sits where a logo would sit, it is never recoloured
   * into the palette, and its presence is not an endorsement in either
   * direction. assets/icons/apps/SOURCES.md carries the licence and the
   * rule; check_slides asserts the rule is still written down.
   */
  apps: {
    takes: 'apps',
    what: 'Two to five app or product marks in a row, each with its name '
        + 'under it, for a slide about the tools themselves. Names come from '
        + 'the apps pack. A mark may only NAME a product the slide is talking '
        + 'about: never as a logo, never recoloured, never implying the brand '
        + 'endorses any of this.',
    height() { return M.apps.h + M.apps.labGap + M.apps.lab * CAP; },
    draw(ctx, block, g, box, art) {
      const names = (block.items ?? []).slice(0, 5);
      if (!names.length) return;
      const s = px.h(M.apps.h);
      const step = s + px.w(M.apps.gap);
      const total = names.length * s + (names.length - 1) * px.w(M.apps.gap);
      let x = box.x + (box.w - total) / 2 + s / 2;

      for (const name of names) {
        const img = art?.apps?.[name];
        if (img) {
          const w = s * (img.width / img.height);
          ctx.drawImage(img, x - w / 2, box.y, w, s);
        }
        ctx.font = face(g, 'appLab');
        ctx.letterSpacing = trackOf('appLab');
        ctx.fillStyle = g.mark;
        ctx.textAlign = 'center';
        ctx.fillText(appLabel(name), x,
                     box.y + s + px.h(M.apps.labGap) + px.size(M.apps.lab) * CAP);
        x += step;
      }
    },
  },

  /**
   * Somebody else's words, with their name on them.
   *
   * `who` is required. The naming rule says "a Harvard study" is
   * forgettable and a named person is a story, and an unattributed
   * quotation is worse than either: it is the shape of evidence with
   * none in it.
   */
  quote: {
    takes: 'quote',
    what: 'A line somebody else actually wrote or said, set large, with who '
        + 'said it underneath. `quote` is { text, who }. Both required: an '
        + 'unattributed quotation is the shape of evidence with nothing in '
        + 'it. Never invent one, and never tidy up the wording.',
    height(ctx, block, g, col) {
      const ls = lines(ctx, block.text, face(g, 'quote'),
                       col - px.w(M.quote.markX), trackOf('quote'));
      return ls.length * M.quote.size * M.quote.lead
        + M.quote.whoGap + M.quote.who * CAP;
    },
    draw(ctx, block, g, box) {
      const x = box.x + px.w(M.quote.markX);
      const w = box.w - px.w(M.quote.markX);
      ctx.font = face(g, 'quote');
      ctx.letterSpacing = trackOf('quote');
      ctx.fillStyle = g.mark;
      ctx.textAlign = 'left';
      const ls = lines(ctx, block.text, face(g, 'quote'), w, trackOf('quote'));
      ls.forEach((line, i) => {
        ctx.fillText(line, x, box.y + px.size(M.quote.size) * CAP
          + i * px.size(M.quote.size * M.quote.lead));
      });

      /* The rule down the left, not a curly quotation mark. A big glyph
         at this size is a piece of decoration that competes with the
         words; a rule is the same signal and stays out of the way. */
      const h = ls.length * px.size(M.quote.size * M.quote.lead);
      ctx.fillStyle = g.accent;
      ctx.fillRect(box.x, box.y, Math.max(3, px.w(0.006)), h);

      ctx.font = face(g, 'who');
      ctx.letterSpacing = trackOf('who');
      ctx.fillStyle = g.mark;
      ctx.fillText(block.who ?? '', x,
                   box.y + h + px.h(M.quote.whoGap) + px.size(M.quote.who) * CAP);
      ctx.textAlign = 'center';
    },
  },

  /** One figure, set at headline size, and what it is a figure OF. */
  stat: {
    takes: 'stat',
    what: 'A single measured number set as large as a headline, with one '
        + 'line under it saying what it counts. `stat` is { figure, of }. '
        + 'Needs a `source` block: a number with no source is the one thing '
        + 'the research rule refuses outright.',
    height(ctx, block, g, col) {
      const ls = lines(ctx, block.of, face(g, 'of'), col, trackOf('of'));
      return M.stat.size * CAP + M.stat.ofGap + ls.length * M.stat.of * 1.4;
    },
    draw(ctx, block, g, box) {
      setType(ctx, g, 'figure');
      ctx.fillText(block.figure ?? '', box.x + box.w / 2,
                   box.y + px.size(M.stat.size) * CAP);
      setType(ctx, g, 'of');
      const ls = lines(ctx, block.of, face(g, 'of'), box.w, trackOf('of'));
      ls.forEach((line, i) => {
        ctx.fillText(line, box.x + box.w / 2,
          box.y + px.size(M.stat.size) * CAP + px.h(M.stat.ofGap)
          + px.size(M.stat.of) * CAP + i * px.size(M.stat.of * 1.4));
      });
    },
  },

  /** Where a figure came from. Small, quiet, and not optional. */
  source: {
    takes: 'text',
    what: 'Where the figures on this slide came from: who published it and '
        + 'when, in one line. Set small on purpose — it is not the point of '
        + 'the slide, it is what makes the point stand up.',
    height() { return M.source.size * CAP; },
    draw(ctx, block, g, box) {
      setType(ctx, g, 'source');
      ctx.fillStyle = g.mark;
      ctx.globalAlpha = 0.62;
      ctx.fillText(block.text ?? '', box.x + box.w / 2,
                   box.y + px.size(M.source.size) * CAP);
      ctx.globalAlpha = 1;
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
    what: 'One of Ashley\'s own photographs with its background taken off, '
        + 'monochrome and halftoned like every other photograph of him. For an '
        + 'opening or closing slide. It is a shape on the sheet, not a '
        + 'photograph in a box.',
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
      cutout(ctx, img, g, { ...block, ...place });
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
    /* It used to be on every template, so every panel ended DO THIS: and
       a five-slide set gave a reader five orders. An instruction is a
       kind of slide, not a footer. Only the templates whose whole point
       is an instruction have it now. */
    optional: true,
    what: 'The one thing to actually do, in a sentence or two. It belongs to '
        + 'the few templates whose job IS an instruction — swap, close, the '
        + 'sign-off — and NOT to a teaching panel. A set carries one ask, at '
        + 'the end. `label` renames the tab from DO THIS:.',
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
  /* Every few letters of a headline is swapped to the bitmap face. It is
     the reference's signature: "Quarterly" and "Taxes" both carry two
     letters from another face. Which letters is seeded off the headline
     so a slide redraws identically.
     scale: NeueBit's x-height is 71 units where Neue Montreal's is 108,
     so a swapped letter set at the headline size reads as a subscript.
     1.52 is 108/71, measured on both faces at 200px. */
  titleAlt: { family: 'NeueBit', weight: '700', track: 0, scale: 1.52 },
  say:    { family: 'NeueMontreal', weight: '500', track: 0 },
  chip:   { family: 'NeueMontreal', weight: '700', track: 0 },
  action: { family: 'NeueMontreal', weight: '500', track: 0 },
  label:  { family: 'NeueBit', weight: '400', track: 0.020 },
  rail:   { family: 'NeueBit', weight: '400', track: 0.060 },

  /* The evidence blocks. A figure and a defined word are set in the
     headline face because they ARE the headline of their slide; a URL,
     a caption and a source are set in the bitmap, which is what the rail
     uses, because all three are machine text rather than writing. */
  word:    { family: 'NeueMontreal', weight: '700', track: 0 },
  means:   { family: 'NeueMontreal', weight: '500', track: 0 },
  quote:   { family: 'NeueMontreal', weight: '500', track: 0 },
  who:     { family: 'NeueBit', weight: '400', track: 0.040 },
  figure:  { family: 'NeueMontreal', weight: '700', track: 0 },
  of:      { family: 'NeueMontreal', weight: '500', track: 0 },
  url:     { family: 'NeueBit', weight: '400', track: 0.030 },
  caption: { family: 'NeueMontreal', weight: '500', track: 0 },
  source:  { family: 'NeueBit', weight: '400', track: 0.040 },
  barLab:  { family: 'NeueMontreal', weight: '500', track: 0 },
  barVal:  { family: 'NeueBit', weight: '400', track: 0.030 },
  appLab:  { family: 'NeueBit', weight: '400', track: 0.030 },
  swap:    { family: 'NeueMontreal', weight: '500', track: 0 },
};

/**
 * The address, as a browser shows it: host and path, no scheme, no
 * query. A full URL with tracking parameters on it is unreadable at
 * 15px and tells the reader nothing they can type in themselves.
 */
export function shortUrl(url) {
  const s = String(url ?? '').replace(/^https?:\/\//, '').replace(/\?.*$/, '');
  return s.length > 52 ? `${s.slice(0, 51)}…` : s;
}

/** The name under a mark. The pack's slug is not what a person calls it. */
const appLabel = (name) => APP_LABELS[name] ?? name;

/** Every role's size, so a new one is a row rather than another ternary. */
const SIZE = {
  title: M.title.size, titleAlt: M.title.size,
  action: M.action.body, label: M.action.label, rail: M.rail.size,
  chip: M.chip.h * 0.52,
  word: M.term.word, means: M.term.size,
  quote: M.quote.size, who: M.quote.who,
  figure: M.stat.size, of: M.stat.of,
  url: M.shot.urlSize, caption: M.shot.cap, source: M.source.size,
  barLab: M.bars.lab, barVal: M.bars.val, appLab: M.apps.lab,
  swap: M.swap.size,
};

const sizeOf = (role) =>
  px.size(SIZE[role] ?? M.say.size) * (TYPE[role]?.scale ?? 1);

const face = (g, role) => {
  const t = TYPE[role] ?? TYPE.say;
  return `${t.weight} ${sizeOf(role)}px ${t.family}`;
};

/** Tracking has to be set alongside the font, every time, or it leaks. */
const trackOf = (role) => {
  const t = TYPE[role] ?? TYPE.say;
  return `${t.track * sizeOf(role)}px`;
};

/**
 * A headline with a few letters in the other face.
 *
 * Drawn per character because canvas has no way to change face mid-run.
 * The swapped letters are chosen by a hash of the line, so the same
 * headline always swaps the same letters: the redo loop redraws single
 * slides, and a random pick would make one slide of a set stop matching.
 * Spaces and the first letter are never swapped.
 */
function mixedRun(ctx, g, line, rate, seed, k = 1) {
  const at = (role) => `${TYPE[role].weight} ${sizeOf(role) * k}px ${TYPE[role].family}`;
  const A = at('title');
  const B = at('titleAlt');
  const tA = `${TYPE.title.track * sizeOf('title') * k}px`;
  const tB = `${TYPE.titleAlt.track * sizeOf('titleAlt') * k}px`;
  const r = rng(hash(seed));
  const ch = [...line];
  const pick = ch.map((c, i) => (i > 0 && c !== ' ' && r() < rate));
  /* Chrome puts the letter-spacing AFTER each character, so the headline's
     -0.070 pull would drag the next letter into a bitmap glyph, which has
     no sidebearing to give. Relax the pull on both sides of a swap. */
  const setAt = (i) => {
    ctx.font = pick[i] ? B : A;
    ctx.letterSpacing = (pick[i] || pick[i + 1]) ? tB : tA;
  };
  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  let total = 0;
  ch.forEach((c, i) => { setAt(i); total += ctx.measureText(c).width; });
  ctx.textAlign = prev;
  return { ch, setAt, total };
}

function drawMixed(ctx, g, line, ax, y, rate, seed, align, k = 1) {
  const { ch, setAt, total } = mixedRun(ctx, g, line, rate, seed, k);
  ctx.textAlign = 'left';
  let x = align === 'left' ? ax : align === 'right' ? ax - total : ax - total / 2;
  ch.forEach((c, i) => {
    setAt(i);
    ctx.fillText(c, x, y);
    x += ctx.measureText(c).width;
  });
  ctx.textAlign = 'center';
}

function setType(ctx, g, role) {
  ctx.fillStyle = g.mark;
  ctx.font = face(g, role);
  ctx.letterSpacing = trackOf(role);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
}

/* Teaching slides are centred and stay centred. A CTA is not a teaching
   slide: the figure owns one side, so the type wants to be flush to the
   other and ragged towards him. */
/**
 * The answers, packed into rows that fit.
 *
 * Each chip is only as wide as its own words, which is right, and means
 * three of them do not necessarily fit a line: `calling` gives half the
 * sheet to the object, and there the third answer ran off the edge.
 * Measured with the real font, so height() and draw() agree.
 */
function packOptions(ctx, options, colW) {
  const letters = ['A', 'B', 'C', 'D'];
  const gap = px.w(0.018);
  ctx.font = `${TYPE.chip.weight} ${sizeOf('chip')}px ${TYPE.chip.family}`;
  ctx.letterSpacing = trackOf('chip');
  const rows = [[]];
  let w = 0;
  (options ?? []).slice(0, 4).forEach((t, i) => {
    const text = `${letters[i]}. ${t}`;
    const cw = ctx.measureText(text).width + px.w(M.chip.padX) * 2;
    const last = rows[rows.length - 1];
    const add = last.length ? gap + cw : cw;
    if (last.length && w + add > colW) { rows.push([]); w = cw; }
    else w += add;
    rows[rows.length - 1].push({ text, w: cw });
  });
  return { rows, gap };
}

/**
 * How far apart recap lines sit, which depends on how many there are.
 *
 * A fixed pitch made the block's height proportional to the carousel's
 * length, so a nine-slide carousel could not be recapped at all: the
 * list pushed the instruction off the sheet, and the cap that stopped it
 * was a hardcoded 5 with no relationship to the geometry.
 *
 * Now the LIST has the budget and the lines share it. Four or fewer sit
 * at the roomy pitch, and past that they tighten to a floor, so the
 * block occupies about the same band whatever it holds. The floor is
 * 1.5x the text size, which is ordinary leading and where legibility
 * stops being negotiable.
 */
export const recapPitch = (n) => Math.max(M.recap.min,
  Math.min(M.recap.pitch, M.recap.budget / Math.max(1, n)));

const alignX = (box, align) => (align === 'left' ? box.x
  : align === 'right' ? box.x + box.w : box.x + box.w / 2);
const alignTo = (align) => (align === 'left' ? 'left'
  : align === 'right' ? 'right' : 'center');

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
/*
 * `for` is the job the slide does, and it is what Spark sorts on.
 *
 * Sorting on the template NAME meant picking whichever was first in the
 * list, which is how three carousels in a row came back as six panels of
 * reasons. A name says what a slide contains; `for` says what it is for,
 * and that is the question a writer actually has when they know what the
 * next slide has to accomplish and not what it should look like.
 *
 * `asks` marks the four templates that carry a DO THIS: panel. It used
 * to be all of them, which gave a reader five orders in five slides and
 * meant none of them landed. An instruction is a kind of slide.
 */
export const TEMPLATES = {
  open: {
    blocks: ['title', 'say', 'icons'],
    for: 'say what the subject is, before anything is picked out',
    what: 'The first teaching slide. Names the thing and says what it is. '
        + 'Nothing picked out yet, because there is nothing to pick out '
        + 'until the reader knows what the subject is.',
  },
  reasons: {
    blocks: ['title', 'say', 'chips', 'icons'],
    for: 'why it matters, as a short list',
    what: 'A short setup, then the reasons as chips. The workhorse, which '
        + 'is exactly why a set should not be three of them: if two '
        + 'consecutive slides are both this, one of them is the wrong shape.',
  },
  steps: {
    blocks: ['title', 'say', 'chips', 'say', 'icons'],
    for: 'how to do it, in order',
    what: 'Setup, the steps as chips, then a line that lands the whole '
        + 'thing. The second paragraph is the point of this template — it '
        + 'is the reassurance after the list.',
  },
  compare: {
    blocks: ['title', 'say', 'duo', 'say', 'icons'],
    for: 'two kinds that get confused for each other',
    what: 'Two kinds, side by side, with a line under each. Only for an '
        + 'actual difference between two things.',
  },
  proof: {
    blocks: ['title', 'say', 'chips', 'icons'],
    for: 'evidence you can point at, as a short list',
    what: 'The same shape as reasons, used for evidence rather than '
        + 'argument: each chip is a figure you can point at. Named apart '
        + 'so a slide of numbers is a decision rather than an accident.',
  },
  portrait: {
    blocks: ['title', 'say', 'portrait'],
    for: 'saying a person is behind this, mid-set',
    what: 'A middle slide carrying Ashley himself, cut out and monochrome '
        + 'and screened. The sign-off already carries him, so this is the '
        + 'SECOND time he appears in a set and usually one time too many. '
        + 'Reach for it only when the slide is about him doing the work.',
  },

  /* ------------------------------------------------- showing rather
   * than saying. Everything below carries evidence, and every one of
   * them refuses to draw without the thing that makes it checkable: a
   * screenshot without its address, a chart without its source and a
   * quotation without a name are all the shape of proof with none in it.
   */

  shot: {
    blocks: ['title', 'say', 'shot'],
    for: 'showing a real page, on the record',
    what: 'A screenshot of an actual page in browser chrome with its address '
        + 'showing. For taking one real thing apart in public, or for '
        + 'referencing somebody else\'s page, documentation or announcement. '
        + 'Capture it with capture_page first. The address is the citation, '
        + 'so the slide cannot be written from memory.',
  },
  annotated: {
    blocks: ['title', 'shot', 'swap'],
    for: 'showing a real page and what to do about it',
    what: 'The screenshot with the fix under it: what is on the page struck '
        + 'through, what it should say instead below. The one arrangement '
        + 'that shows the fault and the fix on the same sheet.',
  },
  chart: {
    blocks: ['title', 'say', 'bars', 'source'],
    for: 'figures, drawn to scale, with where they came from',
    what: 'Two to five measured figures as bars, from zero, longest bar '
        + 'largest. For analytics, timings, sizes, counts. `source` is not '
        + 'optional: a chart without one is a drawing.',
  },
  figure: {
    blocks: ['stat', 'say', 'source'],
    for: 'one number that is the whole slide',
    what: 'A single measured figure at headline size, one line saying what '
        + 'it counts, and the source. For when the number IS the argument '
        + 'and a chart would be three bars pretending to be a comparison.',
  },
  define: {
    blocks: ['term', 'say', 'icons'],
    for: 'teaching one word somebody has been nodding along to',
    what: 'A technical word set large, then what it means in plain language. '
        + 'The educational slide. The jargon rule says a term is normally '
        + 'dropped and moved past; this is the sheet where one gets '
        + 'explained properly instead. One word only.',
  },
  quote: {
    blocks: ['quote', 'say'],
    for: 'somebody else said it, and here is who',
    what: 'A line somebody actually published, set large, with their name '
        + 'under it, then why it matters here. For a platform announcement, '
        + 'a spec, a named study. Never invented, never tidied up.',
  },
  tools: {
    blocks: ['title', 'say', 'apps'],
    for: 'naming the products involved',
    what: 'A row of app marks with their names, for a slide about the tools '
        + 'themselves. A mark may only name a product this slide discusses. '
        + 'Read USE_A_MARK before reaching for it: the failure is a post '
        + 'that reads as a partnership with a company that has never heard '
        + 'of him.',
  },

  /* ------------------------------------------------- the ones that ask.
   * Four, out of sixteen. `swap` is the mid-set instruction and the
   * sign-off is the end of every set; `close` and `recap` are the older
   * endings and stay for carousels that want them.
   */

  swap: {
    blocks: ['title', 'swap', 'action'],
    asks: true,
    for: 'instead of this, do this',
    what: 'The instruction slide. What people do, struck through, and what '
        + 'to do instead under it, then the DO THIS: panel. This is where an '
        + 'instruction belongs mid-set; a teaching panel does not carry one '
        + 'and cannot be given one.',
  },
  close: {
    blocks: ['title', 'say', 'icons', 'action'],
    asks: true,
    for: 'the last slide, when the instruction is the whole point',
    what: 'What to do now, with nothing competing with it.',
  },
  signoff: {
    /* No echo. His column beside the cut-out is about 19 characters a
       line, and echo plus a paragraph came to 102% of the sheet. */
    blocks: ['title', 'say', 'portrait', 'action'],
    asks: true,
    for: 'ending the set. Every set, the same way.',
    what: 'The sign-off, and the only slide whose look is not a decision: '
        + 'Ashley seated with the phone, on yellow, every time. It ends every '
        + 'set, so a reader knows one has ended. Write the words; the ground '
        + 'and the photograph are fixed, and the column beside him is narrow, '
        + 'so the title answers the opening and the paragraph is one sentence.',
  },

  /*
   * The two outros. Both close a carousel and they close it differently,
   * which is the point of having two.
   *
   * What the guidance agrees on, across every source that is not selling
   * a template pack: ONE ask, never a stack of them; the last slide
   * should read as the reward for swiping rather than as an advert
   * appended to the end; and it should bookend the opening so the set
   * has a shape. The disagreement is only about what fills the rest of
   * it, and the two answers given are a recap or a single statement. So
   * there is one of each.
   */
  recap: {
    blocks: ['title', 'recap', 'prompt', 'line', 'action'],
    asks: true,
    for: 'the last slide, read back for whoever swiped without reading',
    what: 'The whole carousel read back in numbered lines, then the ask. The '
        + 'one to reach for by default: it is the only slide that pays off a '
        + 'reader who swiped to the end without reading, and it is what makes '
        + 'the post worth keeping rather than worth finishing.',
  },
  calling: {
    blocks: ['calling', 'say', 'prompt', 'line', 'action'],
    asks: true,
    for: 'ending a carousel about not being reachable',
    what: 'A handset hanging off the top of the sheet on its cord, ringing, '
        + 'with the address at the foot. No headline: the object is the '
        + 'headline. For the end of a carousel about being reachable, or not '
        + 'being. `say` takes a `mark`, one or two words on a marker swipe '
        + 'above the sentence, which is where the slide starts talking.',
  },
  bookend: {
    blocks: ['echo', 'title', 'say', 'icons', 'line', 'action'],
    asks: true,
    for: 'answering the opening headline out loud',
    what: 'Closes the loop out loud: the headline the carousel opened with, '
        + 'set small, and under it the line that answers it. For a carousel '
        + 'that opened on a question or a claim. Needs the opening headline '
        + 'verbatim in `echo`, so it is the one template that cannot be '
        + 'written without looking at slide one.',
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
/**
 * How wide the text column is, and where it starts.
 *
 * Exported because the copy budget needs the same answer. Working it out
 * a second time in spec.js is the fault that already cost twenty false
 * passes: a budget that believes the column is full width passes twelve
 * lines of paragraph into a template that shows five.
 */
export function columnOf(slide) {
  let col = px.w(1 - M.margin * 2);
  let x = px.w(M.margin);

  /* A photograph filling the sheet has its own quiet half, measured in
     assets/stock/own/SOURCES.md. `column` holds the type inside it: on
     black-wall the type must stay left of 0.58 or it runs onto his face,
     and no cut-out is present to narrow the column the usual way. */
  if (slide.column) col = Math.min(col, px.w(slide.column) - px.w(M.margin));

  /*
   * A cut-out takes WIDTH, not height: the column gives up its side.
   *
   * Worked from where he actually stands rather than from a fraction of
   * the sheet. `wide` is his own width over his own height, so this is
   * his footprint. The earlier version took his width MINUS a margin,
   * which is backwards, and the paragraph ran under phone-chair's arm by
   * exactly that margin.
   */
  // the hanging object claims the left half, the same way a cut-out does
  const names0 = slide.blocks ?? TEMPLATES[slide.template]?.blocks ?? [];
  if (names0.includes('calling')) {
    x = px.w(M.hang.col);
    col = px.w(1 - M.margin) - x;
  }

  /* Only when the template actually draws one. A stray `portrait` field
     on a template with no portrait block was still taking its side of
     the column, so the budget was narrowing every template it probed. */
  const cut = names0.includes('portrait') && slide.portrait
    && placementOf(slide.portrait, slide.context ?? 'cta');
  if (cut) {
    const wide = px.h(cut.h) * (CUTOUTS[slide.portrait]?.wide ?? 0.8);
    const gut = px.w(0.075);          // his edge to the first letter
    const pad = px.w(0.045);          // what an uncut side stands off by
    // a figure snapped on neither side still stands somewhere
    const side = cut.snap?.includes('left') || cut.lean === 'left' ? 'left'
      : cut.snap?.includes('right') || cut.lean === 'right' ? 'right'
        : (cut.cx ?? 0.5) < 0.5 ? 'left' : 'right';
    /* Assume he stands off the edge even when he is snapped to it. It is
       wrong by `pad` on a snapped side and wrong in the safe direction:
       a column too narrow sets badly, a column too wide sets over him. */
    const mine = cut.cx != null
      ? { a: px.w(cut.cx) - wide / 2, b: px.w(cut.cx) + wide / 2 }
      : side === 'left' ? { a: pad, b: pad + wide } : { a: W - pad - wide, b: W - pad };
    const right = x + col;
    if (side === 'left') x = Math.max(x, mine.b + gut);
    col = Math.max(px.w(0.30), (side === 'left' ? right : Math.min(right, mine.a - gut)) - x);
  }
  return { x, col };
}

export function layOut(ctx, slide, g) {
  const { x: x0, col } = columnOf(slide);
  let x = x0;
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
    /* `context` travels beside `portrait` the way `iconsWhere` travels
       beside `icons`. Without it the block fell back to the cta
       placement while columnOf narrowed for the one the slide asked
       for, so the renderer drew a bigger figure than the type made room
       for and the headline ran into his shoulder. */
    const block = { align: slide.align, context: slide.context,
                    name, key, ...blockData(slide, name, key) };
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
  /* Centring is right for a teaching slide, where the stack IS the slide.
     A CTA has a figure holding the foot, so centring floats the type in
     the middle with a void above it. `anchor: 'top'` gives the void back
     to the photograph. */
  let y = slide.anchor === 'top' || stretched >= room
    ? M.top : M.top + (room - stretched) / 2;

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
      : name === 'duo' || name === 'swap' ? { pair: own }
        : name === 'bars' ? { items: own, unit: slide.unit }
          : { items: own };
  }
  return own;
};

/** Draw one slide onto a 1080x1350 context. */
export function drawSlide(ctx, slide, { art = {} } = {}) {
  const g = SLIDE_GROUNDS[slide.ground] ?? SLIDE_GROUNDS.paper;
  ctx.fillStyle = g.ground;
  ctx.fillRect(0, 0, W, H);
  if (art.scene) cover(ctx, art.scene, g, slide.veil);
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
  /* The instruction goes LAST. It is an opaque sticker that keeps full
     width and lies over the photograph rather than dodging it, and
     layOut pushes it first so it was drawing UNDER: the cut-out ate the
     label and "DO THIS:" came out as "THIS:". */
  const front = placed.filter((i) => i.block.name === 'action');
  for (const item of placed) {
    if (back.includes(item) || front.includes(item)) continue;
    item.spec.draw(ctx, item.block, g, item.box, art, head);
  }
  for (const item of front) item.spec.draw(ctx, item.block, g, item.box, art, head);

  /* Accents: one or two icons in the headline, ON TOP of whatever the
     icons block is doing. `iconsWhere: 'scatter'` REPLACES the row,
     which was the wrong reading — the row is the format and should not
     move. This adds an icon here and there and leaves it alone. */
  if (slide.accent?.length && head) accents(ctx, slide.accent, head, g, art);

  return { over };
}

/**
 * Key the subject out of one of the flat-ground photographs.
 *
 * Everything here is measured against the SUBJECT rather than the image
 * that carries him. `h` is how tall he stands on the sheet, and where he
 * lands is decided by which edges of his own frame he runs off:
 *
 *   blue-flat    off the right (18%) and the bottom (71%)
 *   sky-arms     off the bottom only (38%)
 *   phone-chair  off nothing at all
 *
 * Those cut edges are where the photograph ended, so they go against the
 * sheet's matching edges and he pokes out of that corner. Sizing by the
 * image instead put an invisible margin of keyed-away sky between him
 * and the edge, and `bleed` then pushed him back off it, which cut off
 * the parts of him that were never cut in the first place.
 */
function keyOut(img, H_, tolerance = 0.20) {
  const W_ = Math.max(1, Math.round(H_ * (img.width / img.height)));
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
  const tol = tolerance * 441.7;

  const on = new Uint8Array(W_ * H_);
  for (let i = 0, p = 0; p < W_ * H_; p++, i += 4) {
    on[p] = Math.hypot(d[i] - key[0], d[i + 1] - key[1], d[i + 2] - key[2]) > tol ? 1 : 0;
  }
  /* Before the box, not after: the sky in sky-arms is a gradient, so the
     raw key keeps a wedge of it and the box came back as the whole
     frame. Measured with this pass it is x 0.01..0.61, y 0.41..1.00. */
  keepLargest(on, W_, H_);

  let bx0 = W_; let by0 = H_; let bx1 = 0; let by1 = 0;
  for (let y = 0; y < H_; y++) {
    for (let x = 0; x < W_; x++) {
      if (!on[y * W_ + x]) continue;
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
      if (y < by0) by0 = y; if (y > by1) by1 = y;
    }
  }

  /* How much of him sits ON each border. This is the whole basis for
     where he goes: a border he covers is where the photograph cut him,
     and that is the only edge of the sheet he may touch. Reaching a
     border is not the same as being cut by it, which is why this counts
     coverage rather than comparing the box: sky-arms reaches x 0.01 on
     the left and covers 0.00 of it. */
  let L = 0; let R = 0; let T = 0; let B = 0;
  for (let y = 0; y < H_; y++) { L += on[y * W_]; R += on[y * W_ + W_ - 1]; }
  for (let x = 0; x < W_; x++) { T += on[x]; B += on[(H_ - 1) * W_ + x]; }
  const cutOn = { left: L / H_ > 0.02, right: R / H_ > 0.02,
                  top: T / W_ > 0.02, bottom: B / W_ > 0.02 };
  return { on, off, W_, H_, bx0, by0, bx1, by1, cutOn };
}

function cutout(ctx, img, g, opts = {}) {
  /* Two passes. The first is small and only there to find how much of
     the image the subject occupies, because the draw size depends on it:
     `h` is HIS height, not the photograph's. */
  const probe = keyOut(img, 200, opts.tolerance);
  if (probe.bx1 <= probe.bx0 || probe.by1 <= probe.by0) return;
  const tallness = (probe.by1 - probe.by0 + 1) / probe.H_;

  const H_ = Math.round(px.h(opts.h) / tallness);
  const { on, off, W_, bx0, by0, bx1, by1, cutOn } = keyOut(img, H_, opts.tolerance);
  if (bx1 <= bx0 || by1 <= by0) return;

  /*
   * Where he goes, per axis, and the axes are decided separately.
   *
   * A side the photograph CUT goes flush against the sheet's matching
   * edge: nothing of him is lost, and the straight edge reads as the
   * frame rather than as an amputation. A side it did not cut keeps a
   * margin, because putting a whole shoulder hard against an edge
   * invents a cut that was never there. sky-arms is the case: told to go
   * bottom-left it snaps the bottom, which is cut, and stands clear of
   * the left, which is not.
   */
  const snap = opts.snap ?? '';
  const lean = opts.lean ?? '';
  const pad = px.w(0.045);
  /* Guarded by the measurement, not by the table: a side named in `snap`
     still only goes flush if the key says he covers that border. The
     table is written by hand and the mask is not. */
  const flush = (side) => snap.includes(side) && cutOn[side];
  const x0 = flush('right') ? W - bx1 - 1
    : flush('left') ? -bx0
      : lean === 'right' ? W - bx1 - 1 - pad
        : lean === 'left' ? pad - bx0
          : (opts.cx != null ? px.w(opts.cx) - (bx0 + bx1) / 2 : (W - W_) / 2);
  const y0 = flush('bottom') ? H - by1 - 1
    : flush('top') ? -by0
      : (opts.cy != null ? px.h(opts.cy) - (by0 + by1) / 2 : H - by1 - 1 - pad);

  if (opts.style === 'clean') return drawClean(ctx, off, on, W_, H_, x0, y0, opts.screen);

  const contour = trace(on, W_, H_);
  /* `rough` stays coarse: that is the scissors. `close` is where the
     PHOTOGRAPH clips, so its tolerance is how far the cut may miss him,
     and at 0.011 that was ten pixels on a big cut-out. RDP takes a
     straight chord across a concave run, so ten pixels of slack under a
     chin or between an arm and a torso came back as wedges of sky inside
     the cut. It has to touch him, which means vertices. */
  const rough = simplify(contour, H_ * (opts.rough ?? 0.038));
  const close = simplify(contour, H_ * (opts.coarse ?? 0.0035));
  if (rough.length < 3 || close.length < 3) return;

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
  ctx.drawImage(screened(pixelate(img, W_, H_, opts.pixels), W_, H_, opts.screen),
                x0, y0, W_, H_);
  ctx.restore();
}

/**
 * The background removed and nothing else done. No paper, no border, no
 * scissors: phone-chair is a whole seated figure on a chair of chrome
 * tubing, and every one of those is a treatment the tubing cannot carry.
 *
 * The mask goes on as alpha per pixel rather than as a polygon, so the
 * edge follows the tubing instead of bridging it. It is eroded by one
 * pixel first because a colour-distance key keeps a rim of the ground it
 * cut away, and on a white sweep that rim is a white halo.
 */
function drawClean(ctx, off, on, W_, H_, x0, y0, screen) {
  const o = off.getContext('2d', { willReadFrequently: true });
  const im = o.getImageData(0, 0, W_, H_);
  const d = im.data;
  screenPixels(d, W_, H_, screen);
  for (let y = 0; y < H_; y++) {
    for (let x = 0; x < W_; x++) {
      const i = y * W_ + x;
      const edge = x === 0 || y === 0 || x === W_ - 1 || y === H_ - 1;
      const keep = on[i] && !edge
        && on[i - 1] && on[i + 1] && on[i - W_] && on[i + W_];
      d[i * 4 + 3] = keep ? 255 : 0;
    }
  }
  o.putImageData(im, 0, 0);
  ctx.drawImage(off, x0, y0);
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
 * Monochrome, with a dot screen over it. Every photograph of Ashley gets
 * this, so the four of them read as one set rather than as four
 * photographs that happen to be on the same sheets.
 *
 * The screen is a real halftone, not a pixelation: an AM dot per cell,
 * bigger where the picture is darker, on a grid turned 45 degrees, which
 * is where a print screen goes because at 0 the rows read as stripes.
 *
 * MILD is the whole point and it is one number. `depth` is how far the
 * dots are mixed over the grey; past about 0.5 the face stops being a
 * face, which is the pixelated look that was already rejected once.
 * `cell` is in sheet pixels, not image pixels, so the screen has the
 * same frequency however big the photograph is drawn.
 */
function screenPixels(d, W_, H_, opts = {}) {
  const cell = opts.cell ?? 5;
  const depth = opts.depth ?? 0.30;
  const R45 = Math.SQRT1_2;
  const wrap = (n) => n - Math.floor(n / cell) * cell - cell / 2;
  for (let y = 0; y < H_; y++) {
    for (let x = 0; x < W_; x++) {
      const i = (y * W_ + x) * 4;
      const lum = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
      const fu = wrap(x * R45 + y * R45);
      const fv = wrap(y * R45 - x * R45);
      // area, not radius, tracks tone: sqrt keeps the midtones honest
      const r = cell * 0.62 * Math.sqrt(1 - lum);
      // soft edge over one pixel, or the dots alias into moire
      const dot = Math.min(1, Math.max(0, r - Math.hypot(fu, fv) + 0.5));
      const v = Math.min(1, Math.max(0, lum * (1 - depth) + (1 - dot) * depth));
      d[i] = d[i + 1] = d[i + 2] = Math.round(v * 255);
    }
  }
}

/**
 * One of his photographs, keyed and cropped to him, on its own canvas.
 *
 * For the hook engine, which places pictures itself. Everything the
 * sheets already do to him happens here so both renderers agree: the
 * key, the treatment his photograph is allowed (`scissors` gets the
 * paper and the border, `clean` gets neither), and the monochrome
 * screen.
 *
 * Cropped tight to the subject, so whoever draws it can stand it on a
 * horizontal by putting its foot on the line. That is the rule for the
 * two that were cut at the bottom: they sit ON something, never float.
 */
export function standee(img, { style = 'scissors', tall = 900, paper = '#FFFFFF' } = {}) {
  const probe = keyOut(img, 200);
  if (probe.bx1 <= probe.bx0) return null;
  const H_ = Math.round(tall / ((probe.by1 - probe.by0 + 1) / probe.H_));
  const { on, off, W_, bx0, by0, bx1, by1 } = keyOut(img, H_);
  if (bx1 <= bx0 || by1 <= by0) return null;

  /* The border grows GROW outward, so the canvas needs GROW around the
     subject and not a pixel more. It used to pad twice that, which put a
     transparent margin of 1.5% of his height on all four sides — so a
     figure anchored to a rule floated about twelve sheet pixels above it,
     and one anchored right stopped the same distance short. The box was
     doing its job; the picture inside it was smaller than it looked. */
  const grow = Math.max(3, H_ * 0.015);
  const pad = style === 'clean' ? 0 : Math.ceil(grow) + 2;   // +2 for the antialiased edge
  const w = bx1 - bx0 + 1 + pad * 2;
  const h = by1 - by0 + 1 + pad * 2;
  const c = new OffscreenCanvas(w, h);
  const x = c.getContext('2d');

  if (style === 'clean') {
    const o = off.getContext('2d', { willReadFrequently: true });
    const im = o.getImageData(0, 0, W_, H_);
    screenPixels(im.data, W_, H_);
    const d = im.data;
    for (let yy = 0; yy < H_; yy++) {
      for (let xx = 0; xx < W_; xx++) {
        const i = yy * W_ + xx;
        const edge = xx === 0 || yy === 0 || xx === W_ - 1 || yy === H_ - 1;
        d[i * 4 + 3] = (on[i] && !edge && on[i - 1] && on[i + 1]
                        && on[i - W_] && on[i + W_]) ? 255 : 0;
      }
    }
    o.putImageData(im, 0, 0);
    x.drawImage(off, -bx0, -by0);
    return c;
  }

  const contour = trace(on, W_, H_);
  const rough = simplify(contour, H_ * 0.038);
  const close = simplify(contour, H_ * 0.0035);
  if (rough.length < 3 || close.length < 3) return null;
  const path = (poly, grow) => {
    x.beginPath();
    const n = poly.length;
    poly.forEach(([qx, qy], i) => {
      let X = qx; let Y = qy;
      if (grow) {
        const a = poly[(i - 1 + n) % n]; const b = poly[(i + 1) % n];
        const nx = (qy - a[1]) + (b[1] - qy);
        const ny = -((qx - a[0]) + (b[0] - qx));
        const len = Math.hypot(nx, ny) || 1;
        X += (nx / len) * grow; Y += (ny / len) * grow;
      }
      const px_ = X - bx0 + pad; const py = Y - by0 + pad;
      i ? x.lineTo(px_, py) : x.moveTo(px_, py);
    });
    x.closePath();
  };
  x.fillStyle = paper;
  path(rough, grow);
  x.fill();
  x.save();
  path(close, 0);
  x.clip();
  x.drawImage(screened(img, W_, H_), -bx0 + pad, -by0 + pad);
  x.restore();
  return c;
}

export function screened(src, W_, H_, opts) {
  const c = new OffscreenCanvas(W_, H_);
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(src, 0, 0, W_, H_);
  const im = x.getImageData(0, 0, W_, H_);
  screenPixels(im.data, W_, H_, opts);
  x.putImageData(im, 0, 0);
  return c;
}

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
/* 0.82 was set so type reads anywhere on the sheet, and it costs the
   photograph: black-wall came back as a tint of the ground with a ghost
   in it. A slide that puts its type in a region already measured quiet
   does not need the wash, so the strength is the slide's to set. */
function cover(ctx, img, g, veil = 0.82) {
  const scale = Math.max(W / img.width, H / img.height);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  // screened at the size it is drawn, so the dots stay one size a sheet
  ctx.drawImage(screened(img, w, h), (W - w) / 2, (H - h) / 2);
  if (veil <= 0) return;
  ctx.save();
  ctx.globalAlpha = veil;
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
