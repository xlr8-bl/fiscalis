-- 005 — the design a slide is drawn from, and the seed it came off.
--
--   npx wrangler d1 execute web3ashley --remote --file=./migrations/005_design_specs.sql
--
-- Only needed for a database created before this existed. The studio's
-- Set up button applies the same change.

-- The generator's spec for one panel: the words, and the device, ground
-- and seed chosen for it. Held as JSON because the shape belongs to
-- assets/js/design-spec.js and a column per field would have to be
-- migrated every time a device gained an option.
--
-- Separate from `prompt` on purpose. A slide is drawn either by an image
-- model from a prompt or by the generator from a design, never both, and
-- keeping them apart is what makes which route was used unambiguous.
ALTER TABLE slides ADD COLUMN design TEXT NOT NULL DEFAULT '';

-- The seed the whole carousel was chosen from. Kept so a set can be
-- re-rolled by changing one number and so the same spec redrawn a month
-- later comes back identical.
ALTER TABLE carousels ADD COLUMN design_seed INTEGER NOT NULL DEFAULT 0;
