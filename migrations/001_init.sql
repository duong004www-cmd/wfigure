-- wfigure: JSON -> PostgreSQL schema
-- Safe to run multiple times (IF NOT EXISTS everywhere).

-- =====================================================
-- PRODUCTS
-- =====================================================
CREATE TABLE IF NOT EXISTS products (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  category            TEXT NOT NULL DEFAULT 'all',
  brand               TEXT NOT NULL DEFAULT '',
  series              TEXT NOT NULL DEFAULT '',
  character           TEXT NOT NULL DEFAULT '',
  price               INTEGER NOT NULL DEFAULT 0,
  old_price           INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'in-stock',
  description         TEXT NOT NULL DEFAULT '',
  images              JSONB NOT NULL DEFAULT '[]'::jsonb,
  description_images  JSONB NOT NULL DEFAULT '[]'::jsonb,
  featured            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured);

-- =====================================================
-- USERS
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT NOT NULL DEFAULT '',
  password      TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'customer',
  provider      TEXT,
  google_id     TEXT UNIQUE,
  facebook_id   TEXT UNIQUE,
  avatar        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users((lower(email)));

-- =====================================================
-- ORDERS
-- customer / delivery / invoice / items are nested objects in the app
-- and are never queried by sub-field, so they stay JSONB.
-- =====================================================
CREATE TABLE IF NOT EXISTS orders (
  id              TEXT PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'pending',
  seen_by_admin   BOOLEAN NOT NULL DEFAULT FALSE,
  customer        JSONB NOT NULL DEFAULT '{}'::jsonb,
  delivery        JSONB NOT NULL DEFAULT '{}'::jsonb,
  payment         TEXT NOT NULL DEFAULT 'cod',
  invoice         JSONB NOT NULL DEFAULT '{"requested":false}'::jsonb,
  note            TEXT NOT NULL DEFAULT '',
  promo_code      TEXT,
  items           JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal        INTEGER NOT NULL DEFAULT 0,
  shipping        INTEGER NOT NULL DEFAULT 0,
  discount        INTEGER NOT NULL DEFAULT 0,
  total           INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_seen ON orders(seen_by_admin);
CREATE INDEX IF NOT EXISTS idx_orders_code ON orders(code);

-- =====================================================
-- CATEGORIES
-- The app models this as a single nested "menu" tree (sections > columns >
-- links), never as flat rows -- there is no admin route that edits
-- individual categories today. Kept as one JSONB document, per the brief's
-- "use JSONB where the JSON doesn't fit a relational table" allowance.
-- =====================================================
CREATE TABLE IF NOT EXISTS categories (
  id    SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  menu  JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- =====================================================
-- BLOG POSTS
-- =====================================================
CREATE TABLE IF NOT EXISTS blog_posts (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  excerpt       TEXT NOT NULL DEFAULT '',
  content       TEXT NOT NULL DEFAULT '',
  category      TEXT NOT NULL DEFAULT 'Tin tức',
  author        TEXT NOT NULL DEFAULT 'wfigure',
  cover_image   TEXT NOT NULL DEFAULT '',
  published_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category);

-- =====================================================
-- CONTACT MESSAGES (from the public contact form)
-- =====================================================
CREATE TABLE IF NOT EXISTS contacts (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT NOT NULL DEFAULT '',
  message     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- CONTACT INFO (footer / chatbot: phone, zalo, email, address entries)
-- =====================================================
CREATE TABLE IF NOT EXISTS contact_info (
  id       TEXT PRIMARY KEY,
  type     TEXT NOT NULL DEFAULT 'other',
  label    TEXT NOT NULL DEFAULT '',
  value    TEXT NOT NULL,
  map_url  TEXT
);

-- =====================================================
-- FLASH SALE (single site-wide banner config)
-- =====================================================
CREATE TABLE IF NOT EXISTS flash_sale (
  id           SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  title        TEXT NOT NULL DEFAULT 'FLASH SALE',
  start_at     TIMESTAMPTZ,
  end_at       TIMESTAMPTZ,
  product_ids  JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at   TIMESTAMPTZ
);

-- =====================================================
-- PAYMENT SETTINGS (single site-wide bank-transfer config,
-- shown on the checkout page's QR transfer option)
-- =====================================================
CREATE TABLE IF NOT EXISTS payment_settings (
  id              SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  bank_name       TEXT NOT NULL DEFAULT 'Sacombank',
  account_name    TEXT NOT NULL DEFAULT 'CONG TY WFIGURE',
  account_number  TEXT NOT NULL DEFAULT '0699999999999',
  transfer_note   TEXT NOT NULL DEFAULT 'Mã đơn hàng của bạn',
  qr_image_url    TEXT,
  updated_at      TIMESTAMPTZ
);

-- =====================================================
-- SITE CONTENT (visual editor) -- 'published' and 'draft' rows
-- =====================================================
CREATE TABLE IF NOT EXISTS site_content (
  mode        TEXT PRIMARY KEY CHECK (mode IN ('published', 'draft')),
  elements    JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS site_content_versions (
  id        TEXT PRIMARY KEY,
  snapshot  JSONB NOT NULL,
  saved_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  label     TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_site_content_versions_saved_at ON site_content_versions(saved_at DESC);

-- =====================================================
-- SITE MUSIC (single site-wide background track config)
-- =====================================================
CREATE TABLE IF NOT EXISTS site_music (
  id             SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled        BOOLEAN NOT NULL DEFAULT FALSE,
  autoplay       BOOLEAN NOT NULL DEFAULT FALSE,
  loop           BOOLEAN NOT NULL DEFAULT TRUE,
  volume         REAL NOT NULL DEFAULT 0.5,
  url            TEXT,
  filename       TEXT,
  original_name  TEXT,
  updated_at     TIMESTAMPTZ
);
