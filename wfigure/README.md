# wfigure — Anime & Manga Figure Store

A full local website for selling anime/manga figures and merchandise, inspired by jhfigure.com. Includes a customer-facing storefront (home, category browsing with mega-menu, product detail, login/register, contact) and a separate admin dashboard for managing the product catalog and uploading images.

## What's included

- **Storefront**: home page, category/listing page with filters (category, brand, series, character, status, search), product detail page, login/register page, contact page with hotline **0365244436**, static info pages (shipping, returns, privacy, FAQ).
- **Mega menu**: clicking "MENU" (or the top category bar) opens category groups — PVC Figure, Resin Figure, Blindbox Arttoy, Gundam/Plastic Model, Character Goods, Pre-order/Order — each with sub-filters by category, brand, series and character, similar to jhfigure.com.
- **Admin dashboard** (`/admin/dashboard.html`): add/edit/delete products, upload up to 5 images per product, bulk-import a JSON catalog, and view messages submitted through the contact form.
- **Backend**: Node.js + Express, with a simple JSON-file database (no external database needed) at `data/products.json`, `data/users.json`, `data/contacts.json`. Uploaded images are stored in `public/uploads/`.

## Requirements

- [Node.js](https://nodejs.org) 18+ installed on your machine (this includes `npm`).

## Setup (in VS Code)

1. Open this `wfigure` folder in VS Code (`File > Open Folder…`).
2. Open a terminal in VS Code (`Terminal > New Terminal`).
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   npm start
   ```
5. Open your browser at **http://localhost:3000**.

The server auto-reloads data from the JSON files on every request, so you don't need to restart it while adding products through the admin dashboard — only restart after editing `server.js` or `.html`/`.js`/`.css` files if changes don't appear (hard-refresh the browser first).

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
├── server.js              # Express server & REST API
├── package.json
├── data/
│   ├── products.json      # Product catalog (seeded with sample data)
│   ├── users.json         # Registered customer accounts
│   ├── contacts.json      # Contact form submissions
│   └── categories.json    # Menu / category structure used by the mega menu
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
│   │   └── admin.js        # Admin dashboard logic (CRUD, uploads, bulk import)
│   └── uploads/             # Uploaded product images land here
```

## Notes & next steps

- This is a self-contained demo/store scaffold meant to be extended: the "Add to Cart" button currently just shows a confirmation toast — wire it up to a real cart/checkout flow when you're ready.
- Data is stored in flat JSON files for simplicity. For production use, swap `data/*.json` reads/writes in `server.js` for a real database (e.g. MongoDB, PostgreSQL) and put the admin password behind proper hashed credentials and environment variables instead of the hardcoded `admin` / `12345` (only meant for local development/demo).
- The support hotline `0365244436` appears in the top bar, footer, contact page and mobile sticky call bar — search for it in the codebase if you need to change it everywhere.
