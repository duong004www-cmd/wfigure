// scripts/import-json.js
//
// Imports the legacy data/*.json files into PostgreSQL. Safe to re-run:
// every row is UPSERTed by its natural key (id / slug / email / etc.), so
// running the script twice never creates duplicates and simply re-syncs
// whatever is currently in data/*.json.
//
// Usage:  node scripts/import-json.js  [--data-dir=path]

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const db = require('../db');

const dataDirArg = process.argv.find(a => a.startsWith('--data-dir='));
const DATA_DIR = dataDirArg ? path.resolve(dataDirArg.split('=')[1]) : path.join(__dirname, '..', 'data');

function readJSON(filename, fallback) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️  ${filename} not found, skipping`);
    return fallback;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.log(`  ❌ Could not parse ${filename}: ${err.message}`);
    return fallback;
  }
}

async function importProducts() {
  const products = readJSON('products.json', []);
  for (const p of products) {
    await db.query(
      `INSERT INTO products
        (id, name, category, brand, series, character, price, old_price,
         status, description, images, description_images, featured, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (id) DO UPDATE SET
         name=EXCLUDED.name, category=EXCLUDED.category, brand=EXCLUDED.brand,
         series=EXCLUDED.series, character=EXCLUDED.character, price=EXCLUDED.price,
         old_price=EXCLUDED.old_price, status=EXCLUDED.status, description=EXCLUDED.description,
         images=EXCLUDED.images, description_images=EXCLUDED.description_images,
         featured=EXCLUDED.featured, created_at=EXCLUDED.created_at`,
      [
        p.id, p.name, p.category || 'all', p.brand || '', p.series || '', p.character || '',
        parseInt(p.price, 10) || 0, parseInt(p.oldPrice, 10) || 0, p.status || 'in-stock',
        p.description || '',
        JSON.stringify(Array.isArray(p.images) ? p.images : []),
        JSON.stringify(
          Array.isArray(p.descriptionImages) ? p.descriptionImages
            : (typeof p.descriptionImage === 'string' && p.descriptionImage ? [p.descriptionImage] : [])
        ),
        !!p.featured, p.createdAt || new Date().toISOString()
      ]
    );
  }
  console.log(`  ✅ products: ${products.length} row(s)`);
}

async function importUsers() {
  const users = readJSON('users.json', []);
  for (const u of users) {
    await db.query(
      `INSERT INTO users (id, name, email, phone, password, provider, google_id, facebook_id, avatar, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO UPDATE SET
         name=EXCLUDED.name, email=EXCLUDED.email, phone=EXCLUDED.phone, password=EXCLUDED.password,
         provider=EXCLUDED.provider, google_id=EXCLUDED.google_id, facebook_id=EXCLUDED.facebook_id,
         avatar=EXCLUDED.avatar, created_at=EXCLUDED.created_at`,
      [
        u.id, u.name, u.email, u.phone || '', u.password,
        u.provider || null, u.googleId || null, u.facebookId || null, u.avatar || null,
        u.createdAt || new Date().toISOString()
      ]
    );
  }
  console.log(`  ✅ users: ${users.length} row(s)`);
}

async function importOrders() {
  const orders = readJSON('orders.json', []);
  for (const o of orders) {
    await db.query(
      `INSERT INTO orders
        (id, code, status, seen_by_admin, customer, delivery, payment, invoice,
         note, promo_code, items, subtotal, shipping, discount, total, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (id) DO UPDATE SET
         code=EXCLUDED.code, status=EXCLUDED.status, seen_by_admin=EXCLUDED.seen_by_admin,
         customer=EXCLUDED.customer, delivery=EXCLUDED.delivery, payment=EXCLUDED.payment,
         invoice=EXCLUDED.invoice, note=EXCLUDED.note, promo_code=EXCLUDED.promo_code,
         items=EXCLUDED.items, subtotal=EXCLUDED.subtotal, shipping=EXCLUDED.shipping,
         discount=EXCLUDED.discount, total=EXCLUDED.total, created_at=EXCLUDED.created_at`,
      [
        o.id, o.code, o.status || 'pending', !!o.seenByAdmin,
        JSON.stringify(o.customer || {}), JSON.stringify(o.delivery || {}),
        o.payment, JSON.stringify(o.invoice || { requested: false }),
        o.note || '', o.promoCode || null, JSON.stringify(Array.isArray(o.items) ? o.items : []),
        parseInt(o.subtotal, 10) || 0, parseInt(o.shipping, 10) || 0,
        parseInt(o.discount, 10) || 0, parseInt(o.total, 10) || 0,
        o.createdAt || new Date().toISOString()
      ]
    );
  }
  console.log(`  ✅ orders: ${orders.length} row(s)`);
}

async function importCategories() {
  const doc = readJSON('categories.json', { menu: [] });
  await db.query(
    `INSERT INTO categories (id, menu) VALUES (1, $1)
     ON CONFLICT (id) DO UPDATE SET menu = EXCLUDED.menu`,
    [JSON.stringify(doc.menu || [])]
  );
  console.log(`  ✅ categories: 1 doc (${(doc.menu || []).length} top-level entries)`);
}

async function importBlogPosts() {
  const posts = readJSON('blog-posts.json', []);
  for (const p of posts) {
    await db.query(
      `INSERT INTO blog_posts (id, title, slug, excerpt, content, category, author, cover_image, published_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO UPDATE SET
         title=EXCLUDED.title, slug=EXCLUDED.slug, excerpt=EXCLUDED.excerpt, content=EXCLUDED.content,
         category=EXCLUDED.category, author=EXCLUDED.author, cover_image=EXCLUDED.cover_image,
         published_at=EXCLUDED.published_at, created_at=EXCLUDED.created_at`,
      [
        p.id, p.title, p.slug, p.excerpt || '', p.content || '',
        p.category || 'Tin tức', p.author || 'wfigure', p.coverImage || '',
        p.publishedAt || new Date().toISOString(), p.createdAt || new Date().toISOString()
      ]
    );
  }
  console.log(`  ✅ blog_posts: ${posts.length} row(s)`);
}

async function importContacts() {
  const contacts = readJSON('contacts.json', []);
  for (const c of contacts) {
    await db.query(
      `INSERT INTO contacts (id, name, email, phone, message, created_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO UPDATE SET
         name=EXCLUDED.name, email=EXCLUDED.email, phone=EXCLUDED.phone,
         message=EXCLUDED.message, created_at=EXCLUDED.created_at`,
      [c.id, c.name, c.email, c.phone || '', c.message, c.createdAt || new Date().toISOString()]
    );
  }
  console.log(`  ✅ contacts: ${contacts.length} row(s)`);
}

async function importContactInfo() {
  const entries = readJSON('contact-info.json', []);
  for (const e of entries) {
    await db.query(
      `INSERT INTO contact_info (id, type, label, value, map_url)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET
         type=EXCLUDED.type, label=EXCLUDED.label, value=EXCLUDED.value, map_url=EXCLUDED.map_url`,
      [e.id, e.type || 'other', e.label || '', e.value, e.type === 'address' ? (e.mapUrl ?? null) : null]
    );
  }
  console.log(`  ✅ contact_info: ${entries.length} row(s)`);
}

async function importFlashSale() {
  const s = readJSON('flash-sale.json', { enabled: false, title: 'FLASH SALE', startAt: null, endAt: null, productIds: [] });
  await db.query(
    `INSERT INTO flash_sale (id, enabled, title, start_at, end_at, product_ids, updated_at)
     VALUES (1, $1,$2,$3,$4,$5,$6)
     ON CONFLICT (id) DO UPDATE SET
       enabled=EXCLUDED.enabled, title=EXCLUDED.title, start_at=EXCLUDED.start_at,
       end_at=EXCLUDED.end_at, product_ids=EXCLUDED.product_ids, updated_at=EXCLUDED.updated_at`,
    [!!s.enabled, s.title || 'FLASH SALE', s.startAt || null, s.endAt || null,
      JSON.stringify(Array.isArray(s.productIds) ? s.productIds : []), s.updatedAt || null]
  );
  console.log(`  ✅ flash_sale: 1 doc`);
}

async function importSiteContent() {
  const published = readJSON('site-content.json', { elements: {}, updatedAt: null });
  const draft = readJSON('site-content-draft.json', { elements: {}, updatedAt: null });
  for (const [mode, doc] of [['published', published], ['draft', draft]]) {
    await db.query(
      `INSERT INTO site_content (mode, elements, updated_at) VALUES ($1,$2,$3)
       ON CONFLICT (mode) DO UPDATE SET elements=EXCLUDED.elements, updated_at=EXCLUDED.updated_at`,
      [mode, JSON.stringify(doc.elements || {}), doc.updatedAt || null]
    );
  }
  console.log(`  ✅ site_content: 2 docs (published, draft)`);

  const versions = readJSON('site-content-versions.json', []);
  for (const v of versions) {
    await db.query(
      `INSERT INTO site_content_versions (id, snapshot, saved_at, label) VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET snapshot=EXCLUDED.snapshot, saved_at=EXCLUDED.saved_at, label=EXCLUDED.label`,
      [v.id, JSON.stringify(v.snapshot || {}), v.savedAt || new Date().toISOString(), v.label || '']
    );
  }
  console.log(`  ✅ site_content_versions: ${versions.length} row(s)`);
}

async function importSiteMusic() {
  const s = readJSON('site-music.json', {
    enabled: false, autoplay: false, loop: true, volume: 0.5,
    url: null, filename: null, originalName: null, updatedAt: null
  });
  await db.query(
    `INSERT INTO site_music (id, enabled, autoplay, loop, volume, url, filename, original_name, updated_at)
     VALUES (1, $1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (id) DO UPDATE SET
       enabled=EXCLUDED.enabled, autoplay=EXCLUDED.autoplay, loop=EXCLUDED.loop, volume=EXCLUDED.volume,
       url=EXCLUDED.url, filename=EXCLUDED.filename, original_name=EXCLUDED.original_name,
       updated_at=EXCLUDED.updated_at`,
    [!!s.enabled, !!s.autoplay, s.loop !== false, s.volume ?? 0.5,
      s.url || null, s.filename || null, s.originalName || null, s.updatedAt || null]
  );
  console.log(`  ✅ site_music: 1 doc`);
}

async function main() {
  console.log(`===== IMPORT JSON -> POSTGRESQL (from ${DATA_DIR}) =====`);
  await importProducts();
  await importUsers();
  await importOrders();
  await importCategories();
  await importBlogPosts();
  await importContacts();
  await importContactInfo();
  await importFlashSale();
  await importSiteContent();
  await importSiteMusic();
  console.log('\n🎉 Import complete. Safe to re-run any time (upserts by id).');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Import failed:');
  console.error(err);
  process.exit(1);
});
