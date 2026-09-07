/**
 * own.js — Ashley's four photographs and what each one may do.
 *
 * Capabilities, not a role mapping. A slot asks for a cut-out or for a
 * rectangle, and only some of these can be either, so the resolver picks
 * from what is allowed rather than from a list written by hand.
 *
 *   keyed     may be cut out
 *   photo     may be used whole, as a rectangle
 *   stands    its cut edge sits ON a horizontal: the frame's foot or a
 *             rule in the layout. Never floating.
 *   floats    placed anywhere, but only over a solid ground
 *
 * Measured, not assigned: box, and how much sits on each border, which
 * is where the photograph cut him and therefore what may touch an edge.
 */

const DIR = '/assets/stock/own';

export const OWN_PHOTOS = {
  'blue-flat': {
    url: `${DIR}/blue-flat.jpg`,
    roles: ['portrait', 'figure'],
    keyed: true, photo: false, stands: true,
    cut: 'scissors', snap: 'bottom-right',
    // cut on the right (0.18) and the bottom (0.71): two edges, one corner
    box: 'x 0.29..1.00 y 0.28..1.00', wide: 0.99,
    why: 'Keyed only. It is a bust already cut at the shoulder and the chest, '
       + 'so as a rectangle both cuts show mid-sheet. Stood in the corner they '
       + 'are the frame.',
  },

  'sky-arms': {
    url: `${DIR}/sky-arms.jpg`,
    roles: ['figure', 'portrait'],
    keyed: true, photo: true, stands: true,
    cut: 'scissors', snap: 'bottom', lean: 'left',
    // cut on the bottom only (0.38), so the bottom is what it stands on
    box: 'x 0.01..0.61 y 0.41..1.00', wide: 0.81,
    why: 'The best key of the four and the only one that also works whole: the '
       + 'sky is a photograph in its own right. Cut on the bottom alone, so it '
       + 'stands on a horizontal and is free sideways.',
  },

  'phone-chair': {
    url: `${DIR}/phone-chair.jpg`,
    roles: ['figure'],
    keyed: true, photo: false, floats: true, solidOnly: true,
    cut: 'clean', snap: null,
    // touches no border at all, which is why it may float
    box: 'x 0.09..0.98 y 0.11..0.98', wide: 0.83,
    why: 'Keyed and nothing else: a chair of chrome tubing six pixels across '
       + 'at sheet size, which no border or scissors cut survives. Runs off no '
       + 'edge of its own, so it goes against none, and a clean key needs a '
       + 'solid ground behind it or the tubing disappears into the picture.',
  },

  'black-wall': {
    url: `${DIR}/black-wall.jpg`,
    roles: ['scene', 'portrait'],
    keyed: false, photo: true,
    // the key inverts: black ground, black jacket
    why: 'Photograph only. The key takes the white panel as subject and the '
       + 'jacket as ground, and the mask runs to all four edges. Its left half '
       + 'is quiet at luminance 13 to 25, so it is the one that carries type.',
  },
};

const list = Object.entries(OWN_PHOTOS);

/** The photographs allowed in a slot, best first. */
export function ownFor(role, { wantsCut = false, solid = true } = {}) {
  return list
    .filter(([, p]) => p.roles.includes(role))
    .filter(([, p]) => (wantsCut ? p.keyed : p.photo))
    .filter(([, p]) => (!p.solidOnly || solid))
    .sort((a, b) => a[1].roles.indexOf(role) - b[1].roles.indexOf(role))
    .map(([name, p]) => ({ name, ...p }));
}

/** Nothing of his fits these, and a face is not a stand-in for a surface. */
export const NOT_SHOT = ['texture', 'crowd', 'objects', 'object'];
