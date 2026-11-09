# Art knowledge base site

The pages at **art.jonashw.dev**: a Cloudflare Worker that reads the art knowledge base from D1 and
serves images from R2, per the alternatives analysis *Knowledge Base Forms* (Decision 2: database in
D1; Decision 3: a Cloudflare Worker in front, with sign-in and R2; Decision 6: the domain).

Pages are rendered on each request from the database, so a change to the knowledge base shows up as
soon as the seed is reloaded; nothing is generated ahead of time.

| Path | Page |
|---|---|
| `/` | counts and the way in |
| `/works` | every work, filtered by `?form=`, `?archetype=` and (signed in) `?origin=` |
| `/w/monalisa` | one work |
| `/p/V2P1B` | a proof mark: where the QR sticker on a proof points (any case; see below) |
| `/tropes`, `/tropes/:id` | tropes grouped by turn; one trope with what carries it and what it is anchored on |
| `/idioms`, `/idioms/:id` | idioms; one idiom with the tropes anchored on it |
| `/techniques`, `/techniques/:id` | techniques; one with its archetypes and anchors |
| `/archetypes`, `/archetypes/:id` | archetypes; one with the works of that shape |
| `/studio/...` | the same pages for Jon, signed in through Cloudflare Access |
| `/img/<key>` | an image from R2 |

## What the public sees

- **Private** works are left out.
- **Own** works (Jon's) are drafts until his editorial pass: left out of public pages, lists and
  anchor lists, and their images need sign-in. A row can set `visibility` (`public`, `draft`,
  `private`) to override this once the pass is done.
- An **in-copyright** work follows Wikipedia's non-free content practice: a small copy (300 pixels
  wide at most) on the work's own page with a fair-use caption, and no image in lists or grids. Its
  record, readings and tropes always show.

Under `/studio` everything shows. Cloudflare Access guards `art.jonashw.dev/studio*`; the Worker also
checks Access's signed token and that the email is in `STUDIO_EMAILS`.

## Data

The source tables are `palette/kb/data/*.json` in the project files, built by
`palette/kb/build_tables.py`. `npm run seed` turns them into `seed/seed.sql` (not committed). Each
table keeps the columns pages filter on, plus the whole source row as JSON in `body`, so a new field
in the knowledge base reaches the pages without a migration.

**Proof marks** are QR stickers printed in bulk (`palette/proof_stamp/qr/`, `make_sheet.py`). Each
encodes `HTTPS://ART.JONASHW.DEV/P/<CODE>` with a random five-character Crockford base32 code, so no
two look alike and none counts up. A code names a proof, not a work. `npm run seed` also writes
`seed/codes.sql` from `codes.csv`; it only adds codes, so registrations survive a reload.

- Scanning an unused code signed in (`/studio/p/<code>`) asks which work the proof belongs to; the
  choice is saved and never moves.
- Anyone else scanning an unused code sees "Not registered yet"; a registered code goes to the
  work's page, or says "Not published yet" while the work is a draft.
- Any spelling reaches the code: lower case, and I, L and O read as 1, 1 and 0.

## Commands

```sh
npm install
npm test                  # pages and sign-in against node:sqlite, with the real migrations and seed code
npm run check             # type-check
npm run seed              # seed/seed.sql from the project files (or: npm run seed -- <dataDir>)
npm run db:migrate:local && npm run db:seed:local && npm run dev   # the site on localhost:8787
npx tsx scripts/snapshot.ts > snapshot.html                       # one-file preview of every page
```

## Deploying (needs a Cloudflare API token)

1. `npx wrangler d1 create kb`, and put the id in `wrangler.toml`.
2. `npm run db:migrate && npm run seed && npm run db:seed`, then
   `npx wrangler d1 execute kb --remote --file seed/codes.sql` (again after each new sheet of stickers).
3. Upload own works' documentation images to R2 under `kb/own/doc/<file>`.
4. `npm run deploy`. The Worker answers at its `workers.dev` address.
5. Once jonashw.dev's DNS is on Cloudflare: uncomment `routes` in `wrangler.toml`, create the Access
   application for `art.jonashw.dev/studio*`, fill in `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` and
   `STUDIO_EMAILS`, and deploy again.

Later: received works' images copied into R2 (today they load from Wikipedia), and the reading
card's save endpoint.
