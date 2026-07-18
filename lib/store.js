// lib/store.js
//
// Data-access layer that replaces the old fs.readFileSync/writeFileSync +
// JSON.parse/stringify helpers in server.js. Every function here returns or
// accepts the *exact same in-memory JS shape* the routes already used with
// the JSON files, so route handlers only need `readJSON(FILE)` ->
// `await store.getX()` / `writeJSON(FILE, data)` -> `await store.saveX(data)`
// (plus making the handler async) -- no business logic changes.
//
// getX()/saveX(array) pairs for collection-shaped data reproduce the old
// "whole file overwrite" semantics: saveX runs inside a transaction that
// clears the table and bulk-inserts the new array, so a save always leaves
// the table in exactly the state the caller asked for (same as writeJSON
// replacing the whole file), with no partial-write races.
//
// Singleton config docs (flash sale, site content, site music, categories)
// use a fixed-key UPSERT instead, since there's always exactly one row.

const db = require('../db');

// ---------- helpers ----------
function toISO(d) {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

async function withTransaction(fn) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// =====================================================
// PRODUCTS
// =====================================================
function rowToProduct(r) {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    brand: r.brand,
    series: r.series,
    character: r.character,
    price: r.price,
    oldPrice: r.old_price,
    status: r.status,
    description: r.description,
    images: r.images || [],
    descriptionImages: r.description_images || [],
    featured: r.featured,
    createdAt: toISO(r.created_at)
  };
}

async function getProducts() {
  const { rows } = await db.query('SELECT * FROM products ORDER BY created_at DESC');
  return rows.map(rowToProduct);
}

async function saveProducts(products) {
  await withTransaction(async (client) => {
    await client.query('DELETE FROM products');
    for (const p of products) {
      await client.query(
        `INSERT INTO products
          (id, name, category, brand, series, character, price, old_price,
           status, description, images, description_images, featured, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          p.id, p.name, p.category || 'all', p.brand || '', p.series || '', p.character || '',
          p.price || 0, p.oldPrice || 0, p.status || 'in-stock', p.description || '',
          JSON.stringify(p.images || []), JSON.stringify(p.descriptionImages || []),
          !!p.featured, p.createdAt || new Date().toISOString()
        ]
      );
    }
  });
}

// =====================================================
// USERS
// =====================================================
function rowToUser(r) {
  const u = {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    password: r.password,
    createdAt: toISO(r.created_at)
  };
  if (r.provider) u.provider = r.provider;
  if (r.google_id) u.googleId = r.google_id;
  if (r.facebook_id) u.facebookId = r.facebook_id;
  if (r.avatar) u.avatar = r.avatar;
  return u;
}

async function getUsers() {
  const { rows } = await db.query('SELECT * FROM users ORDER BY created_at ASC');
  return rows.map(rowToUser);
}

async function saveUsers(users) {
  await withTransaction(async (client) => {
    await client.query('DELETE FROM users');
    for (const u of users) {
      await client.query(
        `INSERT INTO users
          (id, name, email, phone, password, provider, google_id, facebook_id, avatar, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          u.id, u.name, u.email, u.phone || '', u.password,
          u.provider || null, u.googleId || null, u.facebookId || null, u.avatar || null,
          u.createdAt || new Date().toISOString()
        ]
      );
    }
  });
}

// =====================================================
// ORDERS
// =====================================================
function rowToOrder(r) {
  return {
    id: r.id,
    code: r.code,
    createdAt: toISO(r.created_at),
    status: r.status,
    seenByAdmin: r.seen_by_admin,
    customer: r.customer || {},
    delivery: r.delivery || {},
    payment: r.payment,
    invoice: r.invoice || { requested: false },
    note: r.note || '',
    promoCode: r.promo_code || null,
    items: r.items || [],
    subtotal: r.subtotal,
    shipping: r.shipping,
    discount: r.discount,
    total: r.total
  };
}

async function getOrders() {
  const { rows } = await db.query('SELECT * FROM orders ORDER BY created_at DESC');
  return rows.map(rowToOrder);
}

async function saveOrders(orders) {
  await withTransaction(async (client) => {
    await client.query('DELETE FROM orders');
    for (const o of orders) {
      await client.query(
        `INSERT INTO orders
          (id, code, status, seen_by_admin, customer, delivery, payment, invoice,
           note, promo_code, items, subtotal, shipping, discount, total, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          o.id, o.code, o.status || 'pending', !!o.seenByAdmin,
          JSON.stringify(o.customer || {}), JSON.stringify(o.delivery || {}),
          o.payment, JSON.stringify(o.invoice || { requested: false }),
          o.note || '', o.promoCode || null, JSON.stringify(o.items || []),
          o.subtotal || 0, o.shipping || 0, o.discount || 0, o.total || 0,
          o.createdAt || new Date().toISOString()
        ]
      );
    }
  });
}

// =====================================================
// CATEGORIES (single JSONB doc: the nested menu tree)
// =====================================================
async function getCategories() {
  const { rows } = await db.query('SELECT menu FROM categories WHERE id = 1');
  if (!rows.length) return { menu: [] };
  return { menu: rows[0].menu || [] };
}

async function saveCategories(categoriesDoc) {
  await db.query(
    `INSERT INTO categories (id, menu) VALUES (1, $1)
     ON CONFLICT (id) DO UPDATE SET menu = EXCLUDED.menu`,
    [JSON.stringify((categoriesDoc && categoriesDoc.menu) || [])]
  );
}

// =====================================================
// BLOG POSTS
// =====================================================
function rowToBlogPost(r) {
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    excerpt: r.excerpt,
    content: r.content,
    category: r.category,
    author: r.author,
    coverImage: r.cover_image,
    publishedAt: toISO(r.published_at),
    createdAt: toISO(r.created_at)
  };
}

async function getBlogPosts() {
  const { rows } = await db.query('SELECT * FROM blog_posts ORDER BY created_at DESC');
  return rows.map(rowToBlogPost);
}

async function saveBlogPosts(posts) {
  await withTransaction(async (client) => {
    await client.query('DELETE FROM blog_posts');
    for (const p of posts) {
      await client.query(
        `INSERT INTO blog_posts
          (id, title, slug, excerpt, content, category, author, cover_image, published_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          p.id, p.title, p.slug, p.excerpt || '', p.content || '',
          p.category || 'Tin tức', p.author || 'wfigure', p.coverImage || '',
          p.publishedAt || new Date().toISOString(), p.createdAt || new Date().toISOString()
        ]
      );
    }
  });
}

// =====================================================
// CONTACTS (public contact-form messages)
// =====================================================
function rowToContact(r) {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    message: r.message,
    createdAt: toISO(r.created_at)
  };
}

async function getContacts() {
  const { rows } = await db.query('SELECT * FROM contacts ORDER BY created_at ASC');
  return rows.map(rowToContact);
}

async function saveContacts(contacts) {
  await withTransaction(async (client) => {
    await client.query('DELETE FROM contacts');
    for (const c of contacts) {
      await client.query(
        `INSERT INTO contacts (id, name, email, phone, message, created_at)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [c.id, c.name, c.email, c.phone || '', c.message, c.createdAt || new Date().toISOString()]
      );
    }
  });
}

// =====================================================
// CONTACT INFO
// =====================================================
function rowToContactInfo(r) {
  const entry = { id: r.id, type: r.type, label: r.label, value: r.value };
  if (r.type === 'address') entry.mapUrl = r.map_url ?? null;
  return entry;
}

async function getContactInfo() {
  const { rows } = await db.query('SELECT * FROM contact_info ORDER BY id ASC');
  return rows.map(rowToContactInfo);
}

async function saveContactInfo(entries) {
  await withTransaction(async (client) => {
    await client.query('DELETE FROM contact_info');
    for (const e of entries) {
      await client.query(
        `INSERT INTO contact_info (id, type, label, value, map_url)
         VALUES ($1,$2,$3,$4,$5)`,
        [e.id, e.type, e.label || '', e.value, e.type === 'address' ? (e.mapUrl ?? null) : null]
      );
    }
  });
}

// =====================================================
// FLASH SALE (singleton config)
// =====================================================
function defaultFlashSale() {
  return { enabled: false, title: 'FLASH SALE', startAt: null, endAt: null, productIds: [] };
}

async function getFlashSale() {
  const { rows } = await db.query('SELECT * FROM flash_sale WHERE id = 1');
  if (!rows.length) return defaultFlashSale();
  const r = rows[0];
  const doc = {
    enabled: r.enabled,
    title: r.title,
    startAt: toISO(r.start_at),
    endAt: toISO(r.end_at),
    productIds: r.product_ids || []
  };
  if (r.updated_at) doc.updatedAt = toISO(r.updated_at);
  return doc;
}

async function saveFlashSale(doc) {
  await db.query(
    `INSERT INTO flash_sale (id, enabled, title, start_at, end_at, product_ids, updated_at)
     VALUES (1, $1,$2,$3,$4,$5,$6)
     ON CONFLICT (id) DO UPDATE SET
       enabled = EXCLUDED.enabled, title = EXCLUDED.title, start_at = EXCLUDED.start_at,
       end_at = EXCLUDED.end_at, product_ids = EXCLUDED.product_ids, updated_at = EXCLUDED.updated_at`,
    [!!doc.enabled, doc.title, doc.startAt || null, doc.endAt || null,
      JSON.stringify(doc.productIds || []), doc.updatedAt || null]
  );
}

// =====================================================
// SITE CONTENT (published / draft docs + version history)
// =====================================================
function emptyContentDoc() {
  return { elements: {}, updatedAt: null };
}

async function getSiteContent(mode) {
  const { rows } = await db.query('SELECT * FROM site_content WHERE mode = $1', [mode]);
  if (!rows.length) return emptyContentDoc();
  return { elements: rows[0].elements || {}, updatedAt: toISO(rows[0].updated_at) };
}

async function saveSiteContent(mode, doc) {
  await db.query(
    `INSERT INTO site_content (mode, elements, updated_at) VALUES ($1,$2,$3)
     ON CONFLICT (mode) DO UPDATE SET elements = EXCLUDED.elements, updated_at = EXCLUDED.updated_at`,
    [mode, JSON.stringify(doc.elements || {}), doc.updatedAt || null]
  );
}

function rowToVersion(r) {
  return { id: r.id, snapshot: r.snapshot, savedAt: toISO(r.saved_at), label: r.label || '' };
}

async function getSiteContentVersions() {
  const { rows } = await db.query('SELECT * FROM site_content_versions ORDER BY saved_at DESC');
  return rows.map(rowToVersion);
}

async function saveSiteContentVersions(versions) {
  await withTransaction(async (client) => {
    await client.query('DELETE FROM site_content_versions');
    for (const v of versions) {
      await client.query(
        `INSERT INTO site_content_versions (id, snapshot, saved_at, label) VALUES ($1,$2,$3,$4)`,
        [v.id, JSON.stringify(v.snapshot || {}), v.savedAt || new Date().toISOString(), v.label || '']
      );
    }
  });
}

// =====================================================
// SITE MUSIC (singleton config)
// =====================================================
function defaultMusicSettings() {
  return {
    enabled: false, autoplay: false, loop: true, volume: 0.5,
    url: null, filename: null, originalName: null, updatedAt: null
  };
}

async function getSiteMusic() {
  const { rows } = await db.query('SELECT * FROM site_music WHERE id = 1');
  if (!rows.length) return defaultMusicSettings();
  const r = rows[0];
  return {
    enabled: r.enabled, autoplay: r.autoplay, loop: r.loop, volume: r.volume,
    url: r.url, filename: r.filename, originalName: r.original_name,
    updatedAt: toISO(r.updated_at)
  };
}

async function saveSiteMusic(settings) {
  await db.query(
    `INSERT INTO site_music (id, enabled, autoplay, loop, volume, url, filename, original_name, updated_at)
     VALUES (1, $1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (id) DO UPDATE SET
       enabled = EXCLUDED.enabled, autoplay = EXCLUDED.autoplay, loop = EXCLUDED.loop,
       volume = EXCLUDED.volume, url = EXCLUDED.url, filename = EXCLUDED.filename,
       original_name = EXCLUDED.original_name, updated_at = EXCLUDED.updated_at`,
    [
      !!settings.enabled, !!settings.autoplay, settings.loop !== false, settings.volume ?? 0.5,
      settings.url || null, settings.filename || null, settings.originalName || null,
      settings.updatedAt || null
    ]
  );
}

module.exports = {
  getProducts, saveProducts,
  getUsers, saveUsers,
  getOrders, saveOrders,
  getCategories, saveCategories,
  getBlogPosts, saveBlogPosts,
  getContacts, saveContacts,
  getContactInfo, saveContactInfo,
  getFlashSale, saveFlashSale, defaultFlashSale,
  getSiteContent, saveSiteContent, emptyContentDoc,
  getSiteContentVersions, saveSiteContentVersions,
  getSiteMusic, saveSiteMusic, defaultMusicSettings
};
