# wfigure — Anime & Manga Figure Store

A full local website for selling anime/manga figures and merchandise, inspired by jhfigure.com. Includes a customer-facing storefront (home, category browsing with mega-menu, product detail, login/register, contact) and a separate admin dashboard for managing the product catalog and uploading images.

## What's included

- **Storefront**: home page, category/listing page with filters (category, brand, series, character, status, search), product detail page, login/register page, contact page with hotline **0365244436**, static info pages (shipping, returns, privacy, FAQ).
- **AI chat assistant** (bottom of the Contact page): answers questions about the store (address, hours, hotline, Zalo, email) and suggests products from the live catalog based on the customer's description. Works out of the box with a built-in rule-based fallback; set `ANTHROPIC_API_KEY` (see below) to upgrade it to a true free-form AI assistant.
- **Mega menu**: clicking "MENU" (or the top category bar) opens category groups — PVC Figure, Resin Figure, Blindbox Arttoy, Gundam/Plastic Model, Character Goods, Pre-order/Order — each with sub-filters by category, brand, series and character, similar to jhfigure.com.
- **Admin dashboard** (`/admin/dashboard.html`): add/edit/delete products, upload up to 5 images per product, bulk-import a JSON catalog, and view messages submitted through the contact form.
- **Backend**: Node.js + Express, backed by **PostgreSQL** (via the `pg` driver, plain SQL — no ORM) through `db.js` + `lib/store.js`. Uploaded images are stored in `public/uploads/`. See "Database (PostgreSQL)" below for schema/setup.

## Requirements

- [Node.js](https://nodejs.org) 18+ installed on your machine (this includes `npm`).
- A PostgreSQL database (e.g. a free Render PostgreSQL instance) and its connection string.

## Setup (in VS Code)

1. Open this `wfigure` folder in VS Code (`File > Open Folder…`).
2. Open a terminal in VS Code (`Terminal > New Terminal`).
3. Install dependencies:
   ```bash
   npm install
   ```
4. Copy `.env.example` to `.env` and set `DATABASE_URL` to your PostgreSQL connection string.
5. Create the schema (safe to re-run):
   ```bash
   psql "$DATABASE_URL" -f migrations/001_init.sql
   ```
6. (First time only, or to re-sync from the legacy `data/*.json` files) import the seed data:
   ```bash
   node scripts/import-json.js
   ```
7. Start the server:
   ```bash
   npm start
   ```
8. Open your browser at **http://localhost:3000**.

All product/user/order/content data now lives in PostgreSQL, so it survives server restarts and redeploys — you don't need to restart the server while adding products through the admin dashboard. Only restart after editing `server.js` or `.html`/`.js`/`.css` files if changes don't appear (hard-refresh the browser first).

### (Optional) Enable the AI chat assistant

The chat widget on the Contact page works immediately with no setup — it uses a built-in keyword-matching assistant. To upgrade it to a real AI (Claude) that understands free-form descriptions:

1. Copy `.env.example` to `.env`.
2. Add your Anthropic API key: `ANTHROPIC_API_KEY=sk-ant-...` (get one at [console.anthropic.com](https://console.anthropic.com/)).
3. Restart the server (`npm start`).

Without a key, the chatbot still fully works — it just answers with simpler keyword-based logic instead of a language model.

## Logging in

- **Customer account**: go to `Login` in the top navigation, switch to the "Register" tab to create an account, then log in from the "Login" tab.
- **Admin account**: go to the same `Login` page and sign in with:
  - Username: `admin`
  - Password: `12345`

  This redirects to the admin dashboard at `/admin/dashboard.html`, where you can:
  - **Products** — search, edit or delete existing catalog items.
  - **Add / Upload** — create a new product, set its category/brand/series/character/price/status, and upload product photos.
  - **Bulk Import** — paste a JSON array of products to import many items at once (see the placeholder text in that tab for the expected format).
  - **Contact Messages** — view messages submitted via the public Contact page.

## Project structure

```
wfigure/
├── server.js               # Express server & REST API (routes unchanged; storage now PostgreSQL)
├── db.js                   # PostgreSQL connection pool (pg)
├── lib/
│   └── store.js            # Data-access layer: getX()/saveX() per resource, plain SQL
├── migrations/
│   └── 001_init.sql        # Full PostgreSQL schema (idempotent, safe to re-run)
├── scripts/
│   └── import-json.js      # One-time/re-runnable importer: data/*.json -> PostgreSQL
├── package.json
├── data/                   # Legacy JSON seed files (source for import-json.js only;
│   │                       #   no longer read by the running server)
│   ├── products.json
│   ├── users.json
│   ├── contacts.json
│   └── categories.json
├── public/
│   ├── index.html          # Homepage
│   ├── category.html       # Category / search listing page
│   ├── product.html        # Product detail page
│   ├── login.html          # Login + Register (admin logs in here too)
│   ├── contact.html        # Contact page + hotline
│   ├── account.html        # Logged-in customer's account page
│   ├── admin/
│   │   └── dashboard.html  # Admin dashboard (protected client-side + server-side)
│   ├── pages/               # Shipping, Returns, Privacy, FAQ static pages
│   ├── css/
│   │   ├── style.css       # Storefront design system
│   │   └── admin.css       # Admin dashboard styles
│   ├── js/
│   │   ├── common.js       # Shared header/footer/menu/auth-state logic
│   │   ├── admin.js        # Admin dashboard logic (CRUD, uploads, bulk import)
│   │   └── chatbot.js      # AI chat assistant widget (contact page)
│   └── uploads/             # Uploaded product images land here
```

## Database (PostgreSQL)

Data storage was migrated from JSON files to PostgreSQL — see `MIGRATION_PLAN.md` for the
full analysis/plan. Summary:

- `db.js` — the `pg` connection pool, read from `DATABASE_URL`.
- `migrations/001_init.sql` — creates every table (`products`, `users`, `orders`, `categories`,
  `blog_posts`, `contacts`, `contact_info`, `flash_sale`, `site_content`,
  `site_content_versions`, `site_music`). Real relational columns for anything the app filters/
  sorts by; `JSONB` only for genuinely nested data (order line items, the category menu tree,
  site-content elements) — no ORM, plain parameterized SQL throughout.
- `lib/store.js` — every place `server.js` used to do
  `JSON.parse(fs.readFileSync(...))` / `fs.writeFileSync(...)` now calls
  `store.getX()` / `store.saveX(data)` instead, which run real SQL against the tables above.
  Routes, URLs, request/response shapes and admin behavior are unchanged.
- `scripts/import-json.js` — imports `data/*.json` into PostgreSQL. Every row is **UPSERTed by
  its id**, so it's safe to run multiple times (re-running just re-syncs, never duplicates).

## What's new (Flash Sale, Quick View, Blog)

- **Flash Sale section** (homepage): a banner with a live countdown timer to a deadline you set. Manage it from **Admin → Flash Sale**: toggle it on/off, set a title, pick a **start/end date-time** (the promotion duration), and check off which products to feature. The section — and the countdown — automatically hide once the end time passes or if it's disabled/empty.
- **Discount display & status badges**: already built into every product card — set **Original Price** (`oldPrice`) higher than **Price** in the product form and a `-x%` badge + strikethrough original price appear automatically; the **Status** dropdown (In Stock / Pre-order / Out of Stock) drives the colored badge shown on the product image.
- **Quick View**: hover any product card to reveal a small eye-icon button (next to the cart button) — clicking it opens a modal with the photo, price, discount, status, short description and an "Add to Cart" button, with no page navigation. Works everywhere `productCardHTML` is used (home, category, search, flash sale).
- **Blog / News**: manage posts from **Admin → Blog / News** (title, category, slug, excerpt, full content, cover image). Public pages: `/blog.html` (list, filterable by category) and `/blog-post.html?slug=...` (detail page with related posts). The homepage shows the 3 latest posts in a "Latest News" section, and a **Blog** link was added to the top bar, mobile menu and footer.

## Checkout & order notifications

- **Checkout page** (`/checkout.html`): reached from the "Thanh toán" button on the cart page. Collects shipping/pickup info, lets the customer pick a payment method (COD, cash at store, or bank QR transfer), accepts a promo code (`WF10` = 10% off orders ≥ 500.000₫) and an order note, then places the order.
- **Order API** (`server.js`): `POST /api/orders` recomputes item prices from the live catalog (never trusts the browser's numbers) and saves the order to the `orders` table in PostgreSQL.
- **Admin "Orders" panel** (`/admin/dashboard.html` → Orders tab): every new order shows up here — customer info, delivery/pickup details, payment method, items, and totals. New orders are flagged with a "Mới" badge and roll up into a notification count on the sidebar nav item until an admin opens that order's detail view. Admins can update an order's status (Chờ xác nhận → Đã xác nhận → Đang giao → Hoàn tất, or Đã hủy) right from the detail panel.

## Notes & next steps

- Data now lives in PostgreSQL (see "Database (PostgreSQL)" above), which survives Render's
  ephemeral filesystem across restarts/redeploys — no persistent disk needed for data (only
  `public/uploads/` still needs one if you want uploaded images to survive redeploys). For
  production, also put the admin password behind proper hashed credentials and environment
  variables instead of the hardcoded `admin` / `12345` (only meant for local development/demo).
- The support hotline `0365244436` appears in the top bar, footer, contact page and mobile sticky call bar — search for it in the codebase if you need to change it everywhere.
- The QR bank-transfer payment option currently shows placeholder bank details (Sacombank account name/number) and a placeholder QR icon — replace with your real account info and an actual QR code image in `checkout.html` before going live.
- The admin "Orders" notification badge is polled while the dashboard is open. If you want a desktop/push notification (e.g. a sound or browser notification the moment an order comes in) or a daily order-summary email, that can be layered on top of the `orders` table later — just say so.
