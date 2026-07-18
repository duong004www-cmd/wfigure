# JSON → PostgreSQL Migration Plan (wfigure)

## 1. Inventory: every JSON read/write site in the codebase

All JSON I/O lives in `server.js` (the only file that touches `data/`). Helpers:

- `readJSON(file)` — used for **array-shaped** stores. Falls back to `[]`.
- `readJSONWithDefault(file, default)` — used for **single-object** stores
  (site-content, flash-sale, site-music). Falls back to a caller-supplied default.
- `writeJSON(file, data)` — full-file overwrite (`JSON.stringify(data, null, 2)`), used for both.
- `ensureDataDir()` — first-boot seeding of `data/` from `data-defaults/` (JSON-file-only concept, dropped entirely once Postgres is the source of truth).

| File | Shape | Read at | Written at |
|---|---|---|---|
| `products.json` | array | `/api/products` (list, filters), `/api/products/:id`, `/api/orders` (price lookup), `/api/flash-sale` (resolve ids), chatbot `searchProducts`/`aiReply` | `POST/PUT/DELETE /api/products`, `POST /api/products/bulk` |
| `users.json` | array | `/api/login`, Google/Facebook auth handlers | `/api/register`, Google/Facebook auth (create/link) |
| `orders.json` | array | `/api/orders` (admin list), unseen-count, chatbot order lookup | `POST /api/orders`, `PUT /api/orders/:id/seen`, `PUT /api/orders/:id/status` |
| `categories.json` | single object `{menu:[...]}` (nested tree) | `/api/categories`, chatbot category synonyms | *(no write route exists — admin never edits this file today)* |
| `blog-posts.json` | array | `/api/blog`, `/api/blog/all`, `/api/blog/:slug` | `POST/PUT/DELETE /api/blog` |
| `contacts.json` | array | `GET /api/contact` (admin inbox) | `POST /api/contact` |
| `contact-info.json` | array | `GET /api/contact-info`, chatbot `getLiveContactInfo` | `POST/PUT/DELETE /api/contact-info` |
| `flash-sale.json` | single object | `GET/PUT /api/flash-sale` | `PUT /api/flash-sale` |
| `site-content.json` | single object `{elements,updatedAt}` | `GET /api/site-content` (published), publish/discard flow | `POST /api/site-content/publish` |
| `site-content-draft.json` | single object | `GET /api/site-content?mode=draft`, discard/publish flow | `POST /api/site-content/draft`, `/discard`, `/publish`, `/restore/:id` |
| `site-content-versions.json` | array | `GET /api/site-content/versions`, `/restore/:id` | `POST /api/site-content/publish` |
| `site-music.json` | single object | `GET /api/site-music` | `POST /api/site-music/upload`, `PUT /api/site-music`, `DELETE /api/site-music` |

No other file in the project touches `fs.readFileSync`/`writeFileSync` for JSON data
(the `public/uploads` binary files are untouched by this migration, per requirements).

## 2. Design decision: how to preserve behavior with a relational store

Every route currently does: **load the whole collection into memory → mutate the JS array/object →
write the whole thing back**. To keep the diff in `server.js` minimal and behavior identical
(same field names, same ordering, same defaults), the migration introduces one module,
**`lib/store.js`**, that exposes `getX()` / `saveX(data)` functions per collection with the
*exact same in-memory JS shapes* the routes already use. Internally these functions run real SQL
against real relational columns. Route code changes only from
`const products = readJSON(PRODUCTS_FILE)` → `const products = await store.getProducts()`
(and the enclosing handler becomes `async`), never touching business logic.

`saveX(array)` performs the collection write inside a single transaction (`DELETE` + bulk
`INSERT`, or `TRUNCATE` + `INSERT`), which reproduces the "whole file overwrite" semantics of
`writeJSON` exactly (no partial-write races, same as before).

## 3. Schema

Relational tables for naturally tabular data; JSONB columns only where the JSON is
tree-shaped/config-shaped and doesn't decompose into rows (categories menu tree, order line
items, order customer/delivery/invoice sub-objects, site-content element map, flash-sale product
id list) — this matches the brief's allowance ("nếu JSON không phù hợp bảng quan hệ thì dùng
JSONB").

See `migrations/001_init.sql` for full DDL. Summary:

- `products` — real columns for every filterable/sortable field (`category`, `brand`, `series`,
  `character`, `price`, `status`, `featured`, ...); `images` / `description_images` as `JSONB`
  arrays (they're opaque path lists, never queried individually).
- `users` — real columns incl. `provider`, `google_id`, `facebook_id` (unique) for OAuth linking.
- `orders` — real columns for everything queried/filtered (`code`, `status`, `seen_by_admin`,
  totals); `customer` / `delivery` / `invoice` / `items` as `JSONB` (nested, never queried by
  sub-field today).
- `blog_posts`, `contacts`, `contact_info` — fully relational.
- `categories` — single-row JSONB doc (`menu` tree) — no relational shape exists in the app today.
- `flash_sale`, `site_music` — single-row config tables with real columns.
- `site_content` — two rows keyed by `mode` (`'published'` / `'draft'`), `elements` as JSONB.
- `site_content_versions` — relational metadata + JSONB `snapshot`.

## 4. Migration stages (each independently verifiable)

1. **Stage 1 — Schema**: add `migrations/001_init.sql`, run it against `DATABASE_URL`. No app
   code changes yet; app still runs exactly as before on JSON files.
2. **Stage 2 — Import script**: add `scripts/import-json.js` (idempotent upsert, safe to re-run,
   replaces the old JSONB-blob stub). Run it, verify row counts match `data/*.json`.
3. **Stage 3 — Storage layer**: add `lib/store.js` implementing every `getX`/`saveX` against
   Postgres. No route changes yet — dead code, but independently testable.
4. **Stage 4 — Route cutover, one resource at a time** (products → users/auth → orders →
   categories → blog → contacts/contact-info → flash-sale → site-content → site-music),
   each becoming `async`/`await store.*`. After each resource, smoke-test its routes.
5. **Stage 5 — Cleanup**: remove `readJSON`/`writeJSON`/`readJSONWithDefault`/`ensureDataDir`/
   `DATA_DIR`/`DATA_DEFAULTS_DIR`/`*_FILE` constants and the `data/` + `data-defaults/`
   directories/requirement from `server.js`. `fs`/`path` remain (still used for `uploads`).

## 5. What does NOT change

Routes, URLs, request/response JSON shapes, HTML/CSS/frontend JS, admin behavior, upload
handling (`multer` → `public/uploads`, unchanged), session/auth logic, the rule-based & AI
chatbot logic, promo codes, slug generation. Only the storage backend changes.
