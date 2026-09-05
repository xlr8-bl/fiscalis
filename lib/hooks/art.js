/**
 * art.js — which picture goes in a slot, and what happens when Ashley's
 * own photographs arrive.
 *
 * READ THIS BEFORE FILLING AN ART SLOT.
 *
 * A layout's art slot describes a KIND of picture, never a file. What
 * actually gets drawn is resolved at render time, in this order, and the
 * order is the whole point:
 *
 *   1. OWN         a photograph of Ashley's, tagged for this role in the
 *                  studio. Always wins. As soon as one exists for a role,
 *                  every layout using that role picks it up on the next
 *                  render with no code change and no spec change.
 *   2. STOCK       a cached CC0 photograph, fetched by tools/fetch_stock.mjs
 *                  against the slot's own search terms. Placeholder in
 *                  intent, real in appearance, so the composition can be
 *                  judged now rather than after a shoot.
 *   3. NOTHING     the box is drawn at the size the picture will be, with
 *                  what is wanted written in it. Honest, and it keeps the
 *                  layout legible.
 *
 * WHAT THIS MEANS IF YOU ARE AN AGENT FILLING ONE
 *
 * Do not name a file. Do not pick from a fixed list. Say what you want
 * in the slot's own terms — the `wants` note is the brief — and let the
 * resolver find it. If you need something the cached stock does not
 * cover, add a search term to the role rather than hard-coding a URL:
 * a URL rots, a search term keeps working.
 *
 * WHAT HAPPENS WHEN THE REAL PHOTOGRAPHS LAND
 *
 * Nothing, in the code. Ashley uploads them in the studio under Brand
 * kit and tags each one with a role from ROLES below. `own()` finds them
 * by that tag. Every layout that asks for the role is upgraded at once,
 * and the stock underneath stays as the fallback for anything he has not
 * shot. There is no migration, no re-render of stored specs, and no list
 * of filenames anywhere that has to be kept in step.
 *
 * The roles are deliberately few. Twenty roles would mean twenty shoots
 * and nineteen of them never happening; six means a good afternoon
 * covers the whole corpus.
 *
 * WHERE CUT-OUTS COME FROM
 *
 * A cut-out role gets a real keyed PNG, never a drawing. Drawn objects were
 * tried and they read as icons on sheets that are otherwise photographic.
 *
 *   assets/cutouts/<role>/   keyed PNGs with a real alpha channel
 *
 * Two sources fill it. tools/cutouts.mjs takes freely licensed images —
 * Commons PNGs that already carry alpha, and photographs shot on a plain
 * even ground — and keys them; those are shippable. tools/refcuts.py keys
 * objects out of the saved reference sheets; those are PLACEHOLDERS, marked
 * `origin: 'reference'` in cutouts.js, because each one is somebody else's
 * photograph. A sheet still using one must not be published.
 *
 * Keying is not machine learning: the background is the median of the border
 * ring, only background-coloured regions touching the border are deleted, and
 * alpha is a ramp on colour distance. A subject on a busy street scores low
 * and is thrown away rather than shipped ragged.
 */

/**
 * The kinds of picture the 79 references actually need.
 *
 * `is` is the brief, and it is what an agent reads. `search` is what the
 * stock fetcher asks a library for when Ashley has not shot it yet, and
 * it is a list because one query is one photographer's idea of the
 * subject. `holds` says what the type needs from the frame, which is the
 * thing that decides whether a picture works here or merely depicts the
 * right thing.
 */
export const ROLES = {
  portrait: {
    fill: 'stock',      // a rectangle is correct here
    shape: 'tall',
    is: 'A face cropped close enough that features run off the frame.',
    holds: 'Gets screened to a coarse halftone, so shape survives and detail does not. '
         + 'Wants strong light and one clear direction of gaze.',
    /* "close up portrait dramatic light" returned a lizard and a wolf.
       An archive matches words, and "portrait" is a word it applies to
       animals as readily as to people, so the species has to be in the
       query and the obvious misses have to be rejected by name.

       The first three that came back were all landscape scenes with a
       person somewhere in them, and that was not the query's fault: the
       search was scoring for a 1200x630 blog cover and DELETING anything
       taller than 1.1 before it ranked. `shape` is why it now asks for the
       orientation the slot is. */
    search: ['portrait of a woman face', 'portrait of a man face',
             'human face close up photograph'],
    reject: /\b(wolf|lizard|dog|cat|bird|horse|animal|fox|deer|monkey|statue|painting)\b/i,
    own: 'Head and shoulders, filling the frame, plain wall behind you.',
  },
  figure: {
    is: 'One person, whole, cut out of their background.',
    holds: 'Stands in front of type and often overlaps it, so it needs a clean '
         + 'edge and roughly twice as tall as it is wide.',
    /* These get KEYED, so the source has to be keyable: a plain, even
       ground behind the subject. A photograph of somebody on a street is
       a fine photograph and an impossible cut-out, and the keyer scores
       it low rather than producing a ragged one. */
    search: ['man standing white background full body',
             'woman standing plain background full length',
             'person full body isolated white'],
    reject: /\b(dog|hound|horse|statue|monument|cattle|sheep|diagram|logo|icon|symbol|flag|map)\b/i,
    shape: 'tall',
    fill: 'cut',
    /* Stands in until he shoots. His own still wins the moment one is
       tagged; until then a real keyed figure is a truer test of the
       composition than a dashed box. */
    cut: ['filemime:image/png man standing full body',
          'filemime:image/png woman standing full body',
          'filemime:image/png person walking silhouette photograph',
          'man standing white background full body'],
    own: 'Standing, sitting and mid-gesture, whole body, plain wall, gap all round. '
       + 'See PHOTOS.md for the cut-out rules, which are about the shoot and not the software.',
  },
  scene: {
    fill: 'stock',      // a rectangle is correct here
    is: 'A place or a moment, wide, with somewhere quiet in it.',
    holds: 'Type sits directly on it, so at least a third of the frame has to be '
         + 'plain: sky, a wall, a table, a floor.',
    /* Used full bleed on a 4:5 sheet as often as it is used in a band, so
       the search is not restricted to landscape — a wide photograph
       cropped to portrait loses both its sides, which for a room is most
       of what made it a room. */
    shape: 'any',
    search: ['empty restaurant interior', 'coffee shop counter morning',
             'shop front street', 'desk with laptop by a window'],
    reject: /\b(portrait|woman|man|face|coat|fashion|model)\b/i,
    own: 'Whatever you actually see: a counter, a pass mid-service, a queue, '
       + 'a shopfront from across the street.',
  },
  objects: {
    is: 'Two to four related objects in a row, flat against a plain ground.',
    holds: 'Sits in a wide shallow band. They only have to read as a set.',
    /* "flat lay" is not a word an archive knows. Asking for a plural
       noun is: "three telephones" finds three telephones. */
    search: ['telephone white background', 'camera isolated white background',
             'radio isolated white background', 'typewriter white background'],
    reject: /\b(diagram|chart|map|logo|icon|symbol|flag|coat of arms|seal|font|typeface|screenshot|graph)\b/i,
    shape: 'any',
    fill: 'cut',
    /* Keyed cut-outs, not drawings. Commons carries thousands of PNGs that
       already have an alpha channel, and a real one beats anything a keyer
       infers; the JPEGs that survive are the ones shot on a plain ground. */
    cut: ['filemime:image/png rotary telephone', 'filemime:image/png cassette tape',
          'filemime:image/png camera photographic', 'filemime:image/png wristwatch',
          'telephone white background', 'typewriter white background'],
    own: 'Anything you can lay on a table and light evenly. Three of a kind beats one of each.',
  },
  object: {
    is: 'One object, centred, on nothing.',
    holds: 'Carries the whole middle of the sheet, so it wants an interesting '
         + 'silhouette rather than an interesting surface.',
    search: ['vintage telephone white background', 'computer monitor isolated',
             'typewriter white background'],
    reject: /\b(diagram|chart|map|logo|icon|symbol|flag|coat of arms|seal|font|typeface|screenshot|graph)\b/i,
    shape: 'any',
    fill: 'cut',
    cut: ['filemime:image/png crt monitor', 'filemime:image/png office chair',
          'filemime:image/png desk lamp', 'filemime:image/png megaphone',
          'filemime:image/png alarm clock', 'filemime:image/png light bulb'],
    own: 'One thing, one light, a plain wall behind it.',
  },
  texture: {
    fill: 'stock',
    shape: 'any',
    is: 'An abstract surface: folded paper, a facade, a stack, a fan of pages.',
    holds: 'Sits inside a card or a strip and is never the subject. It has to '
         + 'survive being cropped to any shape and tinted to one colour.',
    search: ['folded paper macro', 'concrete facade abstract',
             'stack of paper close up', 'spiral staircase from below'],
    reject: /\b(portrait|face|person|woman|man|logo|diagram|map)\b/i,
    own: 'Anything with a repeating structure, shot flat and close.',
  },
  crowd: {
    fill: 'stock',      // a rectangle is correct here
    is: 'Several people, or one still person among moving ones.',
    holds: 'Labels get placed around the figures, so it needs space between them.',
    search: ['crowd walking motion blur street from above',
             'group of people office meeting candid'],
    own: 'A room with people in it. Nobody has to be looking at you.',
  },
};

export const ROLE_NAMES = Object.keys(ROLES);

/**
 * Where a role's cached stock lives.
 *
 * Several per role, because a layout that always draws the same
 * photograph is a layout that produces the same post. The seed picks
 * which, so a given spec is stable across renders and two specs filed
 * the same day are not twins.
 */
export const stockPath = (role, n) => `/assets/stock/roles/${role}-${n}.jpg`;

/**
 * Resolve one art slot to a URL, or to nothing.
 *
 * @param slot   the art slot from the layout
 * @param opts.own    {role: url} — Ashley's photographs, by role, from the studio
 * @param opts.stock  {role: count} — how many cached stock files exist per role
 * @param opts.seed   so the same spec always picks the same one
 */
export function resolveArt(slot, { own = {}, stock = {}, cut = {}, seed = 1 } = {}) {
  const role = slot.role ?? slot.id;
  const at = (n, k = 0) => Math.abs(Math.floor(seed) + k) % n;

  if (own[role]) return { url: own[role], from: 'own', role };

  let cuts = cut[role] ?? [];
  // a slot can ask for a cut-out whatever the role's default is: h006
  // wants a keyed head over its panel, not a rectangle of photograph
  const wantsCut = slot.cut === true
    || ROLES[role]?.fill === 'cut' || slot.treat === 'contain';
  if (wantsCut && cuts.length) {
    /* Prefer a cut-out shaped like the box it has to fill. A tall slot
       given a wide collage leaves the sheet blanketed, and a wide band
       given a standing figure leaves it mostly empty; ranking by shape
       costs nothing and picks the one that was going to work. */
    const want = (slot.box[2] * 1080) / (slot.box[3] * 1350);
    const off = (c) => Math.abs(Math.log((c.aspect || 1) / want));
    cuts = [...cuts].sort((a, b) => off(a) - off(b))
      // and a cut-out more than about twice the wrong shape is not a
      // stand-in for anything: the box with the brief in it is more use
      // than a wide chair jammed into a tall slot
      .filter((c) => off(c) <= (slot.shapeTol ?? 0.8));
    if (cuts.length) {
      // `count` is a row: several cut-outs laid side by side in one box,
      // which is what a role like `objects` means
      const n = Math.min(slot.count ?? 1, cuts.length);
      const urls = Array.from({ length: n }, (_, k) =>
        `/assets/cutouts/${role}/${cuts[at(cuts.length, k)].file}`);
      const from = cuts.some((c) => c.origin === 'reference') ? 'placeholder' : 'cut';
      return { url: urls[0], urls, from, role };
    }
  }

  const n = (ROLES[role]?.fill === 'cut' || slot.cut === true) ? 0 : stock[role] ?? 0;
  if (n > 0) return { url: stockPath(role, at(n)), from: 'stock', role };

  return { url: null, from: 'none', role };
}

/**
 * What to tell an agent about pictures, generated from the roles rather
 * than written beside them.
 *
 * Returned by the MCP brief so the instruction and the code cannot
 * drift: a role added here shows up in the brief on the next call.
 */
export function artBrief() {
  return {
    how_it_works:
      'Art slots name a KIND of picture, not a file. Say what you want in the '
      + "slot's own terms and the resolver finds it. Ashley's own photographs "
      + 'win whenever they exist; cached CC0 stock stands in until then; and a '
      + 'slot with neither draws its box at the size the picture will be.',
    do_not:
      'Do not name a filename or a URL. Do not pick from a fixed list. A URL '
      + 'rots and a filename ties one layout to one picture, which is the thing '
      + 'these templates exist to avoid.',
    when_his_photos_arrive:
      'Nothing changes in a spec. He uploads them in the studio under Brand kit '
      + 'tagged with a role below, and every layout asking for that role picks '
      + 'them up on the next render. Do not rewrite filed specs to point at them.',
    roles: Object.entries(ROLES).map(([role, r]) => ({
      role, is: r.is, must_hold: r.holds, he_will_shoot: r.own,
    })),
  };
}
