-- The art knowledge base, read by the pages at art.jonashw.dev.
-- Source tables: palette/kb/data/*.json in the project files, built by palette/kb/build_tables.py.
-- Each table keeps the columns a page filters or sorts on, plus `body`: the whole source row as JSON,
-- so a field the knowledge base adds later reaches the pages without a migration.

-- A work: a picture, poem, film, video or software, received (others') or own (Jon's).
CREATE TABLE works (
  id            TEXT PRIMARY KEY,
  number        INTEGER UNIQUE,            -- proof-mark number (the stamp on the front), own works only
  title         TEXT,
  who           TEXT,
  form          TEXT NOT NULL,             -- picture | poem | film | video | software
  origin        TEXT NOT NULL,             -- received | own
  recognition   INTEGER,                   -- 0 to 4
  in_copyright  INTEGER NOT NULL DEFAULT 0, -- hides only the image on public pages
  visibility    TEXT NOT NULL DEFAULT 'public'
                CHECK (visibility IN ('public', 'draft', 'private')),
  image_url     TEXT,                      -- where the page loads the image from
  sort          INTEGER NOT NULL,          -- order in the source table
  body          TEXT NOT NULL
);

-- A reading: one viewer's interpretation of one work. Every interpretive field lives here.
CREATE TABLE readings (
  work       TEXT NOT NULL REFERENCES works(id),
  viewer     TEXT NOT NULL,
  archetype  TEXT,
  body       TEXT NOT NULL,
  PRIMARY KEY (work, viewer)
);
CREATE INDEX readings_archetype ON readings(archetype);

CREATE TABLE tropes (
  id      TEXT PRIMARY KEY,
  name    TEXT NOT NULL,
  turn    TEXT,                            -- estrange | flip | condense | transplant | anchor
  origin  TEXT,
  sort    INTEGER NOT NULL,
  body    TEXT NOT NULL
);

-- A frozen phrase or visual sign (top banana, skull and crossbones).
CREATE TABLE idioms (
  id          TEXT PRIMARY KEY,
  phrase      TEXT NOT NULL,
  kind        TEXT,                        -- verbal | visual
  skeuomorph  INTEGER NOT NULL DEFAULT 0,
  sort        INTEGER NOT NULL,
  body        TEXT NOT NULL
);

CREATE TABLE techniques (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  sort  INTEGER NOT NULL,
  body  TEXT NOT NULL
);

CREATE TABLE archetypes (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  sort  INTEGER NOT NULL,
  body  TEXT NOT NULL
);

-- Every "anchors" and "archetypes" list in the source, one row per link, so a work or idiom page
-- can list what points at it. from_kind: trope | technique | archetype. to_kind: work | idiom | archetype.
CREATE TABLE links (
  from_kind  TEXT NOT NULL,
  from_id    TEXT NOT NULL,
  to_kind    TEXT NOT NULL,
  to_id      TEXT NOT NULL,
  sort       INTEGER NOT NULL,
  PRIMARY KEY (from_kind, from_id, to_kind, to_id)
);
CREATE INDEX links_to ON links(to_kind, to_id);
