const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Paths ----------
const DATA_DIR = path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CONTACTS_FILE = path.join(DATA_DIR, 'contacts.json');
const CONTACT_INFO_FILE = path.join(DATA_DIR, 'contact-info.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');
const SITE_CONTENT_FILE = path.join(DATA_DIR, 'site-content.json');
const SITE_CONTENT_DRAFT_FILE = path.join(DATA_DIR, 'site-content-draft.json');
const SITE_CONTENT_VERSIONS_FILE = path.join(DATA_DIR, 'site-content-versions.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
const MAX_VERSIONS = 30;

// ---------- Hardcoded admin account ----------
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = '12345';

// ---------- Helpers ----------
function readJSON(file) {
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    return [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

// Like readJSON but lets the caller supply a default value for objects
// (readJSON always falls back to []), used by the site-content store.
function readJSONWithDefault(file, defaultValue) {
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return defaultValue;
  }
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized. Admin login required.' });
}

// ---------- Middleware ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'wfigure-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24h
}));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Multer (image upload) ----------
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

// =====================================================
//  AUTH ROUTES
// =====================================================

// Register a normal customer account
app.post('/api/register', (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required.' });
  }
  const users = readJSON(USERS_FILE);
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }
  const hashed = bcrypt.hashSync(password, 10);
  const newUser = {
    id: uuidv4(),
    name,
    email,
    phone: phone || '',
    password: hashed,
    createdAt: new Date().toISOString()
  };
  users.push(newUser);
  writeJSON(USERS_FILE, users);
  return res.json({ message: 'Account created successfully. You can now log in.' });
});

// Login for both admin and normal customers
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username/email and password are required.' });
  }

  // Admin check (hardcoded credentials)
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.user = { id: 'admin', name: 'Administrator', role: 'admin' };
    return res.json({ message: 'Admin login successful.', role: 'admin' });
  }

  // Normal customer check (by email)
  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.email.toLowerCase() === username.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid username/email or password.' });
  }
  req.session.user = { id: user.id, name: user.name, email: user.email, role: 'customer' };
  return res.json({ message: `Welcome back, ${user.name}!`, role: 'customer' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logged out.' });
  });
});

app.get('/api/me', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ user: req.session.user });
  }
  return res.status(401).json({ user: null });
});

// =====================================================
//  CATEGORY / MENU ROUTES
// =====================================================
app.get('/api/categories', (req, res) => {
  const categories = readJSON(CATEGORIES_FILE);
  res.json(categories);
});

// =====================================================
//  PRODUCT ROUTES
// =====================================================

// List / filter / search products
app.get('/api/products', (req, res) => {
  let products = readJSON(PRODUCTS_FILE);
  const { category, brand, series, character, status, q, sort, featured, limit } = req.query;

  // Multi-value support: category/brand/series/character/status may be a
  // comma-separated list (e.g. category=nendoroid,gundam,scale-figure) so a
  // single request can power a category "hub" page spanning several
  // sub-categories at once.
  const toList = (val) => val.split(',').map(s => s.trim()).filter(Boolean);

  if (category && category !== 'all') {
    const list = toList(category);
    products = products.filter(p => list.includes(p.category));
  }
  if (brand) {
    const list = toList(brand).map(s => s.toLowerCase());
    products = products.filter(p => list.includes((p.brand || '').toLowerCase()));
  }
  if (series) {
    const list = toList(series).map(s => s.toLowerCase());
    products = products.filter(p => list.includes((p.series || '').toLowerCase()));
  }
  if (character) {
    const list = toList(character).map(s => s.toLowerCase());
    products = products.filter(p => list.includes((p.character || '').toLowerCase()));
  }
  if (status) {
    const list = toList(status);
    products = products.filter(p => list.includes(p.status));
  }
  if (featured === 'true') {
    products = products.filter(p => p.featured);
  }
  if (q) {
    const query = q.toLowerCase();
    products = products.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.character.toLowerCase().includes(query) ||
      p.series.toLowerCase().includes(query) ||
      p.brand.toLowerCase().includes(query)
    );
  }

  if (sort === 'price-asc') products.sort((a, b) => a.price - b.price);
  else if (sort === 'price-desc') products.sort((a, b) => b.price - a.price);
  else if (sort === 'newest') products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (limit) products = products.slice(0, parseInt(limit, 10));

  res.json(products);
});

// Get single product
app.get('/api/products/:id', (req, res) => {
  const products = readJSON(PRODUCTS_FILE);
  const product = products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  res.json(product);
});

// Create product (admin only) — supports up to 5 images
app.post('/api/products', requireAdmin, upload.array('images', 5), (req, res) => {
  const { name, category, brand, series, character, price, oldPrice, status, description, featured } = req.body;
  if (!name || !category || !price) {
    return res.status(400).json({ error: 'Name, category and price are required.' });
  }
  const products = readJSON(PRODUCTS_FILE);
  const images = (req.files || []).map(f => `/uploads/${f.filename}`);

  const newProduct = {
    id: uuidv4(),
    name,
    category,
    brand: brand || '',
    series: series || '',
    character: character || '',
    price: parseInt(price, 10) || 0,
    oldPrice: oldPrice ? parseInt(oldPrice, 10) : 0,
    status: status || 'in-stock',
    description: description || '',
    images,
    featured: featured === 'true' || featured === true,
    createdAt: new Date().toISOString()
  };
  products.unshift(newProduct);
  writeJSON(PRODUCTS_FILE, products);
  res.json({ message: 'Product created successfully.', product: newProduct });
});

// Update product (admin only) — new images get appended
app.put('/api/products/:id', requireAdmin, upload.array('images', 5), (req, res) => {
  const products = readJSON(PRODUCTS_FILE);
  const idx = products.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Product not found.' });

  const body = req.body;
  const existing = products[idx];
  const newImages = (req.files || []).map(f => `/uploads/${f.filename}`);

  let keepImages = existing.images;
  if (body.removeImages) {
    const toRemove = JSON.parse(body.removeImages);
    keepImages = keepImages.filter(img => !toRemove.includes(img));
  }

  products[idx] = {
    ...existing,
    name: body.name || existing.name,
    category: body.category || existing.category,
    brand: body.brand !== undefined ? body.brand : existing.brand,
    series: body.series !== undefined ? body.series : existing.series,
    character: body.character !== undefined ? body.character : existing.character,
    price: body.price ? parseInt(body.price, 10) : existing.price,
    oldPrice: body.oldPrice !== undefined ? (parseInt(body.oldPrice, 10) || 0) : existing.oldPrice,
    status: body.status || existing.status,
    description: body.description !== undefined ? body.description : existing.description,
    featured: body.featured !== undefined ? (body.featured === 'true' || body.featured === true) : existing.featured,
    images: [...keepImages, ...newImages]
  };

  writeJSON(PRODUCTS_FILE, products);
  res.json({ message: 'Product updated successfully.', product: products[idx] });
});

// Delete product (admin only)
app.delete('/api/products/:id', requireAdmin, (req, res) => {
  let products = readJSON(PRODUCTS_FILE);
  const product = products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found.' });

  // Remove associated image files
  (product.images || []).forEach(imgPath => {
    const filePath = path.join(__dirname, 'public', imgPath);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
    }
  });

  products = products.filter(p => p.id !== req.params.id);
  writeJSON(PRODUCTS_FILE, products);
  res.json({ message: 'Product deleted successfully.' });
});

// Bulk catalog upload (admin only) — accepts a JSON array of products (no images)
app.post('/api/products/bulk', requireAdmin, (req, res) => {
  const incoming = req.body;
  if (!Array.isArray(incoming)) {
    return res.status(400).json({ error: 'Expected a JSON array of products.' });
  }
  const products = readJSON(PRODUCTS_FILE);
  const created = incoming.map(item => ({
    id: uuidv4(),
    name: item.name || 'Unnamed product',
    category: item.category || 'all',
    brand: item.brand || '',
    series: item.series || '',
    character: item.character || '',
    price: parseInt(item.price, 10) || 0,
    oldPrice: parseInt(item.oldPrice, 10) || 0,
    status: item.status || 'in-stock',
    description: item.description || '',
    images: Array.isArray(item.images) ? item.images : [],
    featured: !!item.featured,
    createdAt: new Date().toISOString()
  }));
  writeJSON(PRODUCTS_FILE, [...created, ...products]);
  res.json({ message: `${created.length} products imported successfully.` });
});

// =====================================================
//  CONTACT ROUTE
// =====================================================
app.post('/api/contact', (req, res) => {
  const { name, email, phone, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email and message are required.' });
  }
  const contacts = readJSON(CONTACTS_FILE);
  contacts.push({
    id: uuidv4(),
    name, email, phone: phone || '', message,
    createdAt: new Date().toISOString()
  });
  writeJSON(CONTACTS_FILE, contacts);
  res.json({ message: 'Thank you! Your message has been sent. Our team will contact you soon.' });
});

// Admin: view contact messages
app.get('/api/contact', requireAdmin, (req, res) => {
  res.json(readJSON(CONTACTS_FILE));
});

// =====================================================
//  CONTACT INFO ROUTES (phone / Zalo / email shown in the footer)
//  Public GET so the storefront footer can render them; writes are
//  admin-only. A plain flat list rather than fixed fields so the admin
//  can add/remove as many entries as they want (e.g. two phone lines).
// =====================================================
const CONTACT_INFO_TYPES = ['phone', 'zalo', 'email', 'other'];

app.get('/api/contact-info', (req, res) => {
  res.json(readJSON(CONTACT_INFO_FILE));
});

app.post('/api/contact-info', requireAdmin, (req, res) => {
  const { type, label, value } = req.body || {};
  if (!value || !String(value).trim()) {
    return res.status(400).json({ error: 'Value is required.' });
  }
  const entries = readJSON(CONTACT_INFO_FILE);
  const entry = {
    id: uuidv4(),
    type: CONTACT_INFO_TYPES.includes(type) ? type : 'other',
    label: (label || '').trim() || labelForType(type),
    value: String(value).trim()
  };
  entries.push(entry);
  writeJSON(CONTACT_INFO_FILE, entries);
  res.json({ message: 'Contact info added.', entry });
});

app.put('/api/contact-info/:id', requireAdmin, (req, res) => {
  const entries = readJSON(CONTACT_INFO_FILE);
  const idx = entries.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Contact info not found.' });
  const { type, label, value } = req.body || {};
  if (!value || !String(value).trim()) {
    return res.status(400).json({ error: 'Value is required.' });
  }
  entries[idx] = {
    ...entries[idx],
    type: CONTACT_INFO_TYPES.includes(type) ? type : entries[idx].type,
    label: (label !== undefined ? String(label).trim() : entries[idx].label) || labelForType(type),
    value: String(value).trim()
  };
  writeJSON(CONTACT_INFO_FILE, entries);
  res.json({ message: 'Contact info updated.', entry: entries[idx] });
});

app.delete('/api/contact-info/:id', requireAdmin, (req, res) => {
  const entries = readJSON(CONTACT_INFO_FILE);
  const exists = entries.some(e => e.id === req.params.id);
  if (!exists) return res.status(404).json({ error: 'Contact info not found.' });
  writeJSON(CONTACT_INFO_FILE, entries.filter(e => e.id !== req.params.id));
  res.json({ message: 'Contact info deleted.' });
});

function labelForType(type) {
  if (type === 'phone') return 'Hotline';
  if (type === 'zalo') return 'Zalo';
  if (type === 'email') return 'Email';
  return 'Contact';
}

// =====================================================
//  VISUAL EDITOR ("Edit Website") ROUTES
//  Every editable element on the storefront (header hotline,
//  hero text, images, etc.) has a data-edit-id in the HTML.
//  Overrides for those elements (text, image, position, size,
//  visibility, lock) live here as two parallel documents:
//    - published: what real visitors see
//    - draft:     what the admin is currently working on
//  Publishing snapshots the outgoing "published" doc into the
//  version history first, so it can always be restored.
// =====================================================

function emptyContentDoc() {
  return { elements: {}, updatedAt: null };
}

// Public: anyone can read the published content (storefront needs it),
// only the admin can read the draft.
app.get('/api/site-content', (req, res) => {
  const mode = req.query.mode === 'draft' ? 'draft' : 'published';
  if (mode === 'draft') {
    if (!(req.session && req.session.user && req.session.user.role === 'admin')) {
      return res.status(401).json({ error: 'Unauthorized. Admin login required.' });
    }
    return res.json(readJSONWithDefault(SITE_CONTENT_DRAFT_FILE, emptyContentDoc()));
  }
  return res.json(readJSONWithDefault(SITE_CONTENT_FILE, emptyContentDoc()));
});

// Autosave the draft as the admin works (not visible to real visitors).
app.post('/api/site-content/draft', requireAdmin, (req, res) => {
  const elements = (req.body && typeof req.body.elements === 'object' && req.body.elements) || {};
  const doc = { elements, updatedAt: new Date().toISOString() };
  writeJSON(SITE_CONTENT_DRAFT_FILE, doc);
  res.json({ message: 'Draft saved.', doc });
});

// Reset the draft back to whatever is currently published (discard changes).
app.post('/api/site-content/discard', requireAdmin, (req, res) => {
  const published = readJSONWithDefault(SITE_CONTENT_FILE, emptyContentDoc());
  writeJSON(SITE_CONTENT_DRAFT_FILE, published);
  res.json({ message: 'Draft discarded.', doc: published });
});

// Officially go live: snapshot current published state into version
// history, then promote the draft to be the new published state.
app.post('/api/site-content/publish', requireAdmin, (req, res) => {
  const published = readJSONWithDefault(SITE_CONTENT_FILE, emptyContentDoc());
  const draft = readJSONWithDefault(SITE_CONTENT_DRAFT_FILE, emptyContentDoc());

  const versions = readJSON(SITE_CONTENT_VERSIONS_FILE);
  versions.unshift({
    id: uuidv4(),
    snapshot: published,
    savedAt: new Date().toISOString(),
    label: req.body && req.body.label ? String(req.body.label).slice(0, 120) : ''
  });
  writeJSON(SITE_CONTENT_VERSIONS_FILE, versions.slice(0, MAX_VERSIONS));

  const newPublished = { elements: draft.elements || {}, updatedAt: new Date().toISOString() };
  writeJSON(SITE_CONTENT_FILE, newPublished);
  // Keep the draft in sync with what's now live.
  writeJSON(SITE_CONTENT_DRAFT_FILE, newPublished);

  res.json({ message: 'Changes are now live.', doc: newPublished });
});

// List saved versions (most recent first). Snapshots are small
// (element metadata + image paths, no binary data) so returning them
// in full keeps restore simple.
app.get('/api/site-content/versions', requireAdmin, (req, res) => {
  res.json(readJSON(SITE_CONTENT_VERSIONS_FILE));
});

// Restore a previous version into the draft. This does NOT go live by
// itself — the admin still has to press Save/Publish, same as any
// other draft edit.
app.post('/api/site-content/restore/:versionId', requireAdmin, (req, res) => {
  const versions = readJSON(SITE_CONTENT_VERSIONS_FILE);
  const version = versions.find(v => v.id === req.params.versionId);
  if (!version) return res.status(404).json({ error: 'Version not found.' });
  const doc = { elements: version.snapshot.elements || {}, updatedAt: new Date().toISOString() };
  writeJSON(SITE_CONTENT_DRAFT_FILE, doc);
  res.json({ message: 'Version restored into draft. Press Save to publish it.', doc });
});

// Upload a replacement image for an editable element.
app.post('/api/site-content/upload-image', requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file received.' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// =====================================================
//  FALLBACK / START
// =====================================================
app.get('/admin', (req, res) => {
  res.redirect('/admin/dashboard.html');
});

// Global error handler — must be registered last, after all routes.
// Without this, errors thrown by middleware like multer (e.g. file too
// large, wrong file type) fell through to Express's default HTML error
// page. The editor's frontend always expects JSON back from its API
// calls (e.g. `await res.json()` after an image upload); receiving HTML
// there throws a parse error that was never caught, so the upload
// silently "did nothing" from the admin's point of view — no image, no
// error message. Returning JSON here fixes that for every route.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error('Request error:', err);
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Image is too large (max 8MB).' });
  }
  const status = err && err.status ? err.status : 500;
  res.status(status).json({ error: (err && err.message) || 'Unexpected server error.' });
});

app.listen(PORT, () => {
  console.log(`\n  wfigure server running: http://localhost:${PORT}\n`);
});
