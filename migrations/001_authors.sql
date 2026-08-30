-- Run once against a database created before authors existed:
--   npx wrangler d1 execute web3ashley --remote --file=./migrations/001_authors.sql
-- A fresh database gets these from schema.sql and does not need this file.
ALTER TABLE articles ADD COLUMN author TEXT NOT NULL DEFAULT '';
ALTER TABLE articles ADD COLUMN last_editor TEXT NOT NULL DEFAULT '';
