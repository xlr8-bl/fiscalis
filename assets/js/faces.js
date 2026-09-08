/**
 * faces.js — registering the typefaces a canvas render needs.
 *
 * A canvas does not wait for a font. `ctx.font = '800 100px NeueMontreal'`
 * against a face the document has not loaded silently falls back to the
 * browser's serif and draws anyway, so the failure is a whole carousel
 * set in Times with no error anywhere.
 *
 * The studio's stylesheet declares NeueBit, Mondwest and PixelDisplay,
 * and does not declare NeueMontreal — nothing on the site sets type in
 * it, only the slide renderer does. So the renderer registers its own
 * faces rather than relying on a stylesheet written for a different job.
 *
 * Second name in each list is the fallback that ships when the licensed
 * file is absent, which is why `fallback` comes back: a render in the
 * substitute is legible and is not the brand, and it is worth being able
 * to say which happened.
 */

export const FACE_FILES = {
  NeueMontreal: [
    [['neue-montreal-regular.woff2', 'heros-regular.woff2'], { weight: '100 500' }],
    [['neue-montreal-bold.woff2', 'heros-bold.woff2'], { weight: '600 900' }],
  ],
  NeueBit: [
    [['neuebit.woff2', 'pixel.woff2'], { weight: '400 900' }],
  ],
  Mondwest: [
    [['mondwest-regular.woff2', 'pixel.woff2'], { weight: '400' }],
  ],
};

const firstThatLoads = async (name, files, desc) => {
  for (const [i, f] of files.entries()) {
    try {
      const ff = new FontFace(name, `url(/assets/fonts/${f})`, desc);
      await ff.load();
      document.fonts.add(ff);
      return { file: f, fallback: i > 0 };
    } catch { /* try the next one */ }
  }
  return null;
};

/** Every face the slide renderer sets type in, loaded and registered. */
export async function loadFaces() {
  const used = {};
  await Promise.all(Object.entries(FACE_FILES).flatMap(([name, faces]) =>
    faces.map(async ([files, desc]) => {
      (used[name] ??= []).push(await firstThatLoads(name, files, desc));
    })));
  await document.fonts.ready;
  return used;
}
