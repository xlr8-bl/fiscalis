-- 004 — the background a slide was drawn from, before the type went on.
--
--   npx wrangler d1 execute web3ashley --remote --file=./migrations/004_slide_grounds.sql
--
-- Only needed for a database created before this existed. The studio's
-- Set up button applies the same change, so on a deployment managed from
-- the dashboard there is nothing to run here.

-- The free drawing path splits what the paid one does in one step:
-- Workers AI draws a picture with no words in it, and the studio sets the
-- copy over it in the site's own typeface. This holds the picture.
--
-- It is kept rather than thrown away once the slide is finished, so the
-- type can be reset — a different size, a corrected line — without
-- spending another generation on the picture underneath.
ALTER TABLE slides ADD COLUMN ground_key TEXT NOT NULL DEFAULT '';
