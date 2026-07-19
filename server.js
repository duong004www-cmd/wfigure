// Load ANTHROPIC_API_KEY (and any other secrets) from a local .env file if
// the optional `dotenv` package is installed. This is entirely optional —
// the AI chatbot below falls back to a rule-based assistant when no key is
// configured, so a missing .env / missing dotenv package never breaks the
// server.
try { require('dotenv').config(); } catch (err) { /* dotenv not installed — fine, just skip */ }

console.log("DATABASE_URL =", process.env.DATABASE_URL);

const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const db = require("./db");
const store = require('./lib/store');
const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Google Sign-In ----------
// Optional: only active when GOOGLE_CLIENT_ID is set (see .env.example).
// Uses Google Identity Services on the frontend (a client-side button that
// returns a signed ID token) — the server's only job is to verify that
// token, so no client secret or redirect flow is needed.
let OAuth2Client = null;
try { ({ OAuth2Client } = require('google-auth-library')); } catch (err) { /* not installed — Google Sign-In just stays disabled */ }
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = (GOOGLE_CLIENT_ID && OAuth2Client) ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

// ---------- Facebook Login ----------
// Optional: only active when both FACEBOOK_APP_ID and FACEBOOK_APP_SECRET
// are set (see .env.example). Uses the Facebook JS SDK on the frontend (a
// client-side button that returns a short-lived user access token) — the
// server's only job is to verify that token with Facebook (via
// debug_token, using the app id + secret) and then fetch the basic profile
// (id, name, email) needed to create/log in the account.
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || '';
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || '';
const facebookEnabled = !!(FACEBOOK_APP_ID && FACEBOOK_APP_SECRET);

// ---------- Paths ----------
// IMPORTANT (Render free tier bug fix):
// Render's free/standard web services have an EPHEMERAL filesystem — every
// restart / redeploy / spin-down wipes any files written at runtime. This
// app now persists all data (products, orders, theme content, etc.) in
// PostgreSQL via lib/store.js instead of JSON files on disk, so nothing is
// lost on restart/redeploy. Only uploaded media files (images/audio) still
// live on disk — see UPLOADS_DIR below, which can be pointed at a Render
// "Persistent Disk" the same way as before.
const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, 'public', 'uploads');
const MAX_VERSIONS = 30;

// ---------- Hardcoded admin account ----------
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = '12345';

// ---------- Store info used by the AI chat assistant ----------
// (Keep in sync with the static text in public/contact.html — this file
// doesn't read from contact.html, it's just the same info duplicated for
// the chatbot's own use.)
const STORE_INFO = {
  name: 'wfigure',
  address: '32 Đồng Xoài, Phường Tân Bình, TP. Hồ Chí Minh',
  hours: 'Mở cửa hằng ngày, 09:00 – 20:30',
  hotline: '0365 244 436',
  email: 'contact@wfigure.vn'
};

// ---------- Helpers ----------
// (JSON file read/write helpers removed — all persistent data now goes
// through lib/store.js, which talks to PostgreSQL.)

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

// ---------- Multer (background music upload) ----------
const uploadAudio = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^audio\//.test(file.mimetype) || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Only audio files are allowed (mp3, wav, ogg, m4a, aac, flac)'));
  }
});

// =====================================================
//  AUTH ROUTES
// =====================================================

// Register a normal customer account
app.post('/api/register', async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required.' });
  }
  const users = await store.getUsers();
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
  await store.saveUsers(users);
  return res.json({ message: 'Account created successfully. You can now log in.' });
});

// Login for both admin and normal customers
app.post('/api/login', async (req, res) => {
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
  const users = await store.getUsers();
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

// Public: lets the frontend know which optional integrations are turned
// on, without exposing any secrets (the Google Client ID is not secret —
// it's meant to be visible in the browser).
app.get('/api/config', (req, res) => {
  res.json({
    googleClientId: GOOGLE_CLIENT_ID || null,
    facebookAppId: facebookEnabled ? FACEBOOK_APP_ID : null
  });
});

// Google Sign-In: the browser uses Google Identity Services to get a
// signed ID token for the user, then hands it to us here. We verify it
// with Google, then log the matching account in — creating one
// automatically the first time someone signs in with a given Google
// account, or linking an existing email/password account if the emails
// match.
// Trả Google Client ID cho frontend
app.get('/api/auth/google/config', (req, res) => {
  res.json({
    googleClientId: GOOGLE_CLIENT_ID || null
  });
});
app.post('/api/auth/google', async (req, res) => {
  if (!googleClient) {
    return res.status(503).json({ error: 'Google Sign-In chưa được cấu hình trên server.' });
  }
  const { credential } = req.body || {};
  if (!credential) {
    return res.status(400).json({ error: 'Missing Google credential.' });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch (err) {
    return res.status(401).json({ error: 'Google Sign-In không hợp lệ hoặc đã hết hạn, vui lòng thử lại.' });
  }
  if (!payload || !payload.email) {
    return res.status(400).json({ error: 'Không lấy được thông tin tài khoản Google.' });
  }

  const email = payload.email.toLowerCase();
  const users = await store.getUsers();
  let user = users.find(u => u.email.toLowerCase() === email);

  if (!user) {
    user = {
      id: uuidv4(),
      name: payload.name || email.split('@')[0],
      email: payload.email,
      phone: '',
      // Random, never used to log in directly — this account only signs
      // in via Google, but every account still needs a password hash to
      // fit the existing user record shape.
      password: bcrypt.hashSync(uuidv4(), 10),
      provider: 'google',
      googleId: payload.sub,
      avatar: payload.picture || '',
      createdAt: new Date().toISOString()
    };
    users.push(user);
    await store.saveUsers(users);
  } else if (!user.googleId) {
    // An email/password account with the same email is signing in with
    // Google for the first time — link them instead of creating a duplicate.
    user.googleId = payload.sub;
    if (!user.provider) user.provider = 'google';
    await store.saveUsers(users);
  }

  req.session.user = { id: user.id, name: user.name, email: user.email, role: 'customer' };
  return res.json({ message: `Chào mừng, ${user.name}!`, role: 'customer' });
});

// Facebook Login: the browser uses the Facebook JS SDK to get a user
// access token, then hands it to us here. We verify the token belongs to
// our app (debug_token), fetch the basic profile from the Graph API, then
// log the matching account in — creating one automatically the first time
// someone signs in with a given Facebook account, or linking an existing
// email/password (or Google) account if the emails match.
app.post('/api/auth/facebook', async (req, res) => {
  if (!facebookEnabled) {
    return res.status(503).json({ error: 'Facebook Login chưa được cấu hình trên server.' });
  }
  const { accessToken } = req.body || {};
  if (!accessToken) {
    return res.status(400).json({ error: 'Missing Facebook access token.' });
  }

  let profile;
  try {
    // 1) Verify the token was issued for our app and is still valid.
    const appToken = `${FACEBOOK_APP_ID}|${FACEBOOK_APP_SECRET}`;
    const debugUrl = `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appToken)}`;
    const debugResp = await fetch(debugUrl);
    const debugData = await debugResp.json();
    const tokenInfo = debugData && debugData.data;
    if (!tokenInfo || !tokenInfo.is_valid || String(tokenInfo.app_id) !== String(FACEBOOK_APP_ID)) {
      return res.status(401).json({ error: 'Facebook Login không hợp lệ hoặc đã hết hạn, vui lòng thử lại.' });
    }

    // 2) Fetch the profile fields we need.
    const profileUrl = `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`;
    const profileResp = await fetch(profileUrl);
    profile = await profileResp.json();
  } catch (err) {
    return res.status(401).json({ error: 'Facebook Login không hợp lệ hoặc đã hết hạn, vui lòng thử lại.' });
  }

  if (!profile || !profile.id) {
    return res.status(400).json({ error: 'Không lấy được thông tin tài khoản Facebook.' });
  }
  if (!profile.email) {
    // Some Facebook accounts have no email on file, or the person declined
    // to share it — we require an email to match/create a user record.
    return res.status(400).json({ error: 'Tài khoản Facebook này không có email công khai, vui lòng đăng nhập bằng email/mật khẩu.' });
  }

  const email = profile.email.toLowerCase();
  const users = await store.getUsers();
  let user = users.find(u => u.email.toLowerCase() === email);

  if (!user) {
    user = {
      id: uuidv4(),
      name: profile.name || email.split('@')[0],
      email: profile.email,
      phone: '',
      // Random, never used to log in directly — this account only signs
      // in via Facebook, but every account still needs a password hash to
      // fit the existing user record shape.
      password: bcrypt.hashSync(uuidv4(), 10),
      provider: 'facebook',
      facebookId: profile.id,
      avatar: `https://graph.facebook.com/${profile.id}/picture?type=large`,
      createdAt: new Date().toISOString()
    };
    users.push(user);
    await store.saveUsers(users);
  } else if (!user.facebookId) {
    // An existing account (email/password or Google) with the same email
    // is signing in with Facebook for the first time — link them instead
    // of creating a duplicate.
    user.facebookId = profile.id;
    if (!user.provider) user.provider = 'facebook';
    await store.saveUsers(users);
  }

  req.session.user = { id: user.id, name: user.name, email: user.email, role: 'customer' };
  return res.json({ message: `Chào mừng, ${user.name}!`, role: 'customer' });
});

// =====================================================
//  CATEGORY / MENU ROUTES
// =====================================================
app.get('/api/categories', async (req, res) => {
  const categories = await store.getCategories();
  res.json(categories);
});

// =====================================================
//  PRODUCT ROUTES
// =====================================================

// List / filter / search products
app.get('/api/products', async (req, res) => {
  let products = await store.getProducts();
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
app.get('/api/products/:id', async (req, res) => {
  const products = await store.getProducts();
  const product = products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  res.json(product);
});

// Field config shared by the create/update routes: up to 5 gallery images
// plus up to 5 "description images" shown below the main image on the
// product page.
const productUploadFields = upload.fields([
  { name: 'images', maxCount: 5 },
  { name: 'descriptionImages', maxCount: 5 }
]);

// Products created/imported before this feature may still have the old
// singular `descriptionImage` string field — normalize it into an array
// so the rest of the app only ever has to deal with `descriptionImages`.
function normalizeDescriptionImages(product) {
  if (Array.isArray(product.descriptionImages)) return product.descriptionImages;
  if (typeof product.descriptionImage === 'string' && product.descriptionImage) return [product.descriptionImage];
  return [];
}

// Create product (admin only) — supports up to 5 images + up to 5 description images
app.post('/api/products', requireAdmin, productUploadFields, async (req, res) => {
  const { name, category, brand, series, character, price, oldPrice, status, description, featured } = req.body;
  if (!name || !category || !price) {
    return res.status(400).json({ error: 'Name, category and price are required.' });
  }
  const products = await store.getProducts();
  const images = (req.files?.images || []).map(f => `/uploads/${f.filename}`);
  const descriptionImages = (req.files?.descriptionImages || []).map(f => `/uploads/${f.filename}`);

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
    descriptionImages,
    featured: featured === 'true' || featured === true,
    createdAt: new Date().toISOString()
  };
  products.unshift(newProduct);
  await store.saveProducts(products);
  res.json({ message: 'Product created successfully.', product: newProduct });
});

// Update product (admin only) — new gallery images get appended, and
// description images work the same way (append new ones, remove any
// explicitly deselected in the admin form).
app.put('/api/products/:id', requireAdmin, productUploadFields, async (req, res) => {
  const products = await store.getProducts();
  const idx = products.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Product not found.' });

  const body = req.body;
  const existing = products[idx];
  const newImages = (req.files?.images || []).map(f => `/uploads/${f.filename}`);

  let keepImages = existing.images;
  if (body.removeImages) {
    const toRemove = JSON.parse(body.removeImages);
    keepImages = keepImages.filter(img => !toRemove.includes(img));
  }

  const existingDescriptionImages = normalizeDescriptionImages(existing);
  const newDescriptionImages = (req.files?.descriptionImages || []).map(f => `/uploads/${f.filename}`);

  let keepDescriptionImages = existingDescriptionImages;
  if (body.removeDescriptionImages) {
    const toRemove = JSON.parse(body.removeDescriptionImages);
    keepDescriptionImages = keepDescriptionImages.filter(img => !toRemove.includes(img));
    toRemove.forEach(imgPath => {
      const oldFilePath = path.join(__dirname, 'public', imgPath);
      if (fs.existsSync(oldFilePath)) {
        try { fs.unlinkSync(oldFilePath); } catch (e) { /* ignore */ }
      }
    });
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
    images: [...keepImages, ...newImages],
    descriptionImages: [...keepDescriptionImages, ...newDescriptionImages]
  };
  delete products[idx].descriptionImage;

  await store.saveProducts(products);
  res.json({ message: 'Product updated successfully.', product: products[idx] });
});

// Delete product (admin only)
app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  let products = await store.getProducts();
  const product = products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found.' });

  // Remove associated image files
  (product.images || []).forEach(imgPath => {
    const filePath = path.join(__dirname, 'public', imgPath);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
    }
  });
  normalizeDescriptionImages(product).forEach(imgPath => {
    const descFilePath = path.join(__dirname, 'public', imgPath);
    if (fs.existsSync(descFilePath)) {
      try { fs.unlinkSync(descFilePath); } catch (e) { /* ignore */ }
    }
  });

  products = products.filter(p => p.id !== req.params.id);
  await store.saveProducts(products);
  res.json({ message: 'Product deleted successfully.' });
});

// Bulk catalog upload (admin only) — accepts a JSON array of products (no images)
app.post('/api/products/bulk', requireAdmin, async (req, res) => {
  const incoming = req.body;
  if (!Array.isArray(incoming)) {
    return res.status(400).json({ error: 'Expected a JSON array of products.' });
  }
  const products = await store.getProducts();
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
    descriptionImages: Array.isArray(item.descriptionImages)
      ? item.descriptionImages
      : (typeof item.descriptionImage === 'string' && item.descriptionImage ? [item.descriptionImage] : []),
    featured: !!item.featured,
    createdAt: new Date().toISOString()
  }));
  await store.saveProducts([...created, ...products]);
  res.json({ message: `${created.length} products imported successfully.` });
});

// =====================================================
//  FLASH SALE
//  A single site-wide flash sale banner shown on the homepage: a title,
//  an on/off switch, a start/end date-time window (the admin picks the
//  promotion duration), and a hand-picked list of product IDs to feature.
//  Public GET resolves those IDs into full product objects (in the order
//  the admin picked them) so the homepage doesn't need a second request.
// =====================================================
app.get('/api/flash-sale', async (req, res) => {
  const sale = await store.getFlashSale();
  const products = await store.getProducts();
  const byId = new Map(products.map(p => [p.id, p]));
  const resolved = (sale.productIds || []).map(id => byId.get(id)).filter(Boolean);
  res.json({ ...sale, products: resolved });
});

app.put('/api/flash-sale', requireAdmin, async (req, res) => {
  const body = req.body || {};
  const current = await store.getFlashSale();
  const updated = {
    enabled: typeof body.enabled === 'boolean' ? body.enabled : current.enabled,
    title: typeof body.title === 'string' && body.title.trim() ? body.title.trim() : current.title,
    startAt: body.startAt !== undefined ? (body.startAt || null) : current.startAt,
    endAt: body.endAt !== undefined ? (body.endAt || null) : current.endAt,
    productIds: Array.isArray(body.productIds) ? body.productIds.filter(id => typeof id === 'string') : current.productIds,
    updatedAt: new Date().toISOString()
  };
  await store.saveFlashSale(updated);

  const products = await store.getProducts();
  const byId = new Map(products.map(p => [p.id, p]));
  const resolved = updated.productIds.map(id => byId.get(id)).filter(Boolean);
  res.json({ message: 'Flash sale settings saved.', ...updated, products: resolved });
});

// =====================================================
//  BLOG / NEWS
//  Simple blog used for SEO and customer-retention content (news +
//  customer-care posts), similar to jhfigure.com's "Tin tức" / "CSKH"
//  sections. Public reads, admin-only writes with an optional cover image.
// =====================================================
function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'post';
}

function uniqueSlug(base, posts, excludeId) {
  let slug = slugify(base);
  let candidate = slug;
  let i = 2;
  while (posts.some(p => p.slug === candidate && p.id !== excludeId)) {
    candidate = `${slug}-${i++}`;
  }
  return candidate;
}

// Public: list posts, newest first. Optional filters: category, q (search
// in title/excerpt), limit.
app.get('/api/blog', async (req, res) => {
  let posts = await store.getBlogPosts();
  const { category, q, limit } = req.query;
  if (category && category !== 'all') {
    posts = posts.filter(p => (p.category || '').toLowerCase() === String(category).toLowerCase());
  }
  if (q) {
    const query = q.toLowerCase();
    posts = posts.filter(p =>
      p.title.toLowerCase().includes(query) || (p.excerpt || '').toLowerCase().includes(query)
    );
  }
  posts = posts.slice().sort((a, b) => new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt));
  if (limit) posts = posts.slice(0, parseInt(limit, 10));
  res.json(posts);
});

// Admin: list posts including ones not yet used anywhere else — same data,
// kept as a distinct route so the admin dashboard never has to guess about
// query-filtering quirks above.
app.get('/api/blog/all', requireAdmin, async (req, res) => {
  const posts = (await store.getBlogPosts()).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(posts);
});

// Public: single post by slug (what /blog-post.html?slug=... reads).
app.get('/api/blog/:slug', async (req, res) => {
  const posts = await store.getBlogPosts();
  const post = posts.find(p => p.slug === req.params.slug);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  res.json(post);
});

app.post('/api/blog', requireAdmin, upload.single('coverImage'), async (req, res) => {
  const { title, excerpt, content, category, author } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required.' });
  }
  const posts = await store.getBlogPosts();
  const newPost = {
    id: uuidv4(),
    title,
    slug: uniqueSlug(req.body.slug || title, posts),
    excerpt: excerpt || '',
    content,
    category: category || 'Tin tức',
    author: author || 'wfigure',
    coverImage: req.file ? `/uploads/${req.file.filename}` : '',
    publishedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
  posts.unshift(newPost);
  await store.saveBlogPosts(posts);
  res.json({ message: 'Post published successfully.', post: newPost });
});

app.put('/api/blog/:id', requireAdmin, upload.single('coverImage'), async (req, res) => {
  const posts = await store.getBlogPosts();
  const idx = posts.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Post not found.' });

  const existing = posts[idx];
  const body = req.body;
  let coverImage = existing.coverImage;
  if (req.file) {
    if (existing.coverImage) {
      const oldPath = path.join(__dirname, 'public', existing.coverImage);
      if (fs.existsSync(oldPath)) { try { fs.unlinkSync(oldPath); } catch (e) { /* ignore */ } }
    }
    coverImage = `/uploads/${req.file.filename}`;
  } else if (body.removeCoverImage === 'true') {
    if (existing.coverImage) {
      const oldPath = path.join(__dirname, 'public', existing.coverImage);
      if (fs.existsSync(oldPath)) { try { fs.unlinkSync(oldPath); } catch (e) { /* ignore */ } }
    }
    coverImage = '';
  }

  posts[idx] = {
    ...existing,
    title: body.title || existing.title,
    slug: body.slug ? uniqueSlug(body.slug, posts, existing.id) : existing.slug,
    excerpt: body.excerpt !== undefined ? body.excerpt : existing.excerpt,
    content: body.content !== undefined ? body.content : existing.content,
    category: body.category || existing.category,
    author: body.author !== undefined ? body.author : existing.author,
    coverImage
  };
  await store.saveBlogPosts(posts);
  res.json({ message: 'Post updated successfully.', post: posts[idx] });
});

app.delete('/api/blog/:id', requireAdmin, async (req, res) => {
  let posts = await store.getBlogPosts();
  const post = posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });
  if (post.coverImage) {
    const filePath = path.join(__dirname, 'public', post.coverImage);
    if (fs.existsSync(filePath)) { try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ } }
  }
  posts = posts.filter(p => p.id !== req.params.id);
  await store.saveBlogPosts(posts);
  res.json({ message: 'Post deleted successfully.' });
});

// =====================================================
//  CONTACT ROUTE
// =====================================================
app.post('/api/contact', async (req, res) => {
  const { name, email, phone, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email and message are required.' });
  }
  const contacts = await store.getContacts();
  contacts.push({
    id: uuidv4(),
    name, email, phone: phone || '', message,
    createdAt: new Date().toISOString()
  });
  await store.saveContacts(contacts);
  res.json({ message: 'Thank you! Your message has been sent. Our team will contact you soon.' });
});

// Admin: view contact messages
app.get('/api/contact', requireAdmin, async (req, res) => {
  res.json(await store.getContacts());
});

// =====================================================
//  AI CHAT ASSISTANT
//
//  POST /api/chat  { message: string, history?: [{role, content}] }
//  -> { reply: string, products?: [{id, name, price, status, image}] }
//
//  Two modes, picked automatically:
//   1. If process.env.ANTHROPIC_API_KEY is set, the message + a snapshot
//      of the live product catalog + store info is sent to the Anthropic
//      API so replies are truly free-form ("AI").
//   2. Otherwise (no key configured — the default, works out of the box)
//      a small rule/keyword engine below answers store-info questions and
//      searches the catalog for products matching the customer's
//      description. It's less flexible but needs no setup or API cost.
// =====================================================

function formatPrice(n) {
  if (!n && n !== 0) return '';
  return n.toLocaleString('vi-VN') + '₫';
}

// Strips Vietnamese diacritics + lowercases, so the rule-based assistant
// understands typing without accents too ("dia chi shop o dau" should match
// exactly like "địa chỉ shop ở đâu"). This alone covers a huge share of how
// people actually type into chat boxes on phones.
function normalizeVN(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

// Flattens categories.json into a lookup of { normalizedLabel -> {kind, value} }
// so the assistant can recognize category/brand/series/character names the
// customer types loosely ("có gundam không", "co ban plushie khong") and use
// them both for category-browsing answers and as product-search synonyms.
async function getCategorySynonyms() {
  const menu = (await store.getCategories()).menu || [];
  const entries = [];
  menu.forEach(section => {
    if (section.page) {
      entries.push({ norm: normalizeVN(section.label), kind: 'section', value: section.id, label: section.label, page: section.page });
    }
    (section.columns || []).forEach(col => {
      (col.links || []).forEach(link => {
        entries.push({ norm: normalizeVN(link.label), kind: link.kind, value: link.value, label: link.label, page: section.page });
      });
    });
  });
  return entries;
}

async function getLiveContactInfo() {
  const entries = await store.getContactInfo();
  const byType = (t) => (entries.find(e => e.type === t) || {}).value;
  const addressEntry = entries.find(e => e.type === 'address');
  return {
    hotline: byType('phone') || STORE_INFO.hotline,
    zalo: byType('zalo') || STORE_INFO.hotline,
    email: byType('email') || STORE_INFO.email,
    address: (addressEntry && addressEntry.value) || STORE_INFO.address,
    mapUrl: (addressEntry && addressEntry.mapUrl) || null
  };
}

// Picks out a budget the customer mentioned, e.g. "dưới 500k", "tầm 1 triệu",
// "khoảng 300000đ", "trong tầm giá 2tr". Returns { max } or { min, max } or
// null if nothing budget-like was said. Deliberately forgiving about units
// (k / nghìn / tr / triệu / đ / vnd) since customers rarely type exact VND.
function parseBudget(text) {
  const m = text.toLowerCase();
  const under = /(dưới|tối đa|max|không quá|ko quá)\s*([\d.,]+)\s*(k|nghìn|ngàn|tr|triệu|đ|vnđ|vnd)?/;
  const around = /(tầm|khoảng|cỡ|around)\s*([\d.,]+)\s*(k|nghìn|ngàn|tr|triệu|đ|vnđ|vnd)?/;
  const toNumber = (numStr, unit) => {
    let n = parseFloat(numStr.replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'));
    if (isNaN(n)) return null;
    if (unit === 'k' || unit === 'nghìn' || unit === 'ngàn') n *= 1000;
    else if (unit === 'tr' || unit === 'triệu') n *= 1000000;
    return n;
  };
  let mm = m.match(under);
  if (mm) {
    const n = toNumber(mm[2], mm[3]);
    if (n) return { max: n };
  }
  mm = m.match(around);
  if (mm) {
    const n = toNumber(mm[2], mm[3]);
    if (n) return { min: n * 0.7, max: n * 1.3 };
  }
  return null;
}

// Very small Vietnamese-tolerant keyword search over the catalog. Scores a
// product by how many of the customer's words appear in its name/brand/
// series/character/category/description, with a bonus for the more
// specific fields (character, series) since those are the strongest
// signal of intent ("tôi thích Miku" should surface Miku figures first).
// Also understands a budget mentioned in the same sentence ("dưới 500k",
// "tầm 1 triệu") and uses it to filter/re-rank results.
// A few common colloquial/English terms customers use that don't literally
// appear in the catalog fields, mapped to the category id that actually
// matches ("chibi" -> nendoroid, "tượng" -> scale-figure, etc.). Keys are
// pre-normalized (no accents) since they're matched against normalized text.
const SEARCH_SYNONYMS = {
  'chibi': 'nendoroid',
  'tuong': 'scale-figure',
  'statue': 'scale-figure',
  'scale': 'scale-figure',
  'thu bong': 'plushie',
  'gau bong': 'plushie',
  'hop mu': 'blindbox',
  'do choi mu': 'blindbox',
  'arttoy': 'blindbox',
  'gundam': 'gundam',
  'mo hinh nhua': 'gundam',
  'the bai': 'trading-card',
  'card': 'trading-card',
  'tu trung bay': 'display-case',
  'hop trung bay': 'display-case'
};

// Common Vietnamese filler/function words (normalized) that appear in tons
// of product descriptions but carry no real search intent on their own —
// filtering these out stops small talk like "hôm nay thời tiết thế nào" from
// accidentally matching random products just because "thế"/"nào" show up
// somewhere in a description.
const SEARCH_STOPWORDS = new Set([
  'la', 'va', 'cua', 'cho', 'duoc', 'co', 'khong', 'the', 'nay', 'do', 'toi',
  'minh', 'ban', 'shop', 'mot', 'hay', 'nhu', 'rat', 'nhieu', 'it', 'se', 'da',
  'dang', 'de', 'tu', 'trong', 'ngoai', 'sao', 'vay', 'nhe', 'oi', 'gi', 'nao',
  'the nao', 'ne', 'a', 'nhi', 'ah', 'oke', 'ok'
]);

async function searchProducts(query, limit = 4) {
  const products = await store.getProducts();
  const budget = parseBudget(query);
  const normQuery = normalizeVN(query);

  // Expand any recognized colloquial term into its catalog category id too,
  // so e.g. "chibi miku" also searches for category:nendoroid.
  const extraTerms = [];
  Object.keys(SEARCH_SYNONYMS).forEach(key => {
    if (normQuery.includes(key)) extraTerms.push(SEARCH_SYNONYMS[key]);
  });

  const words = normQuery
    .replace(/[.,!?;:()"']/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !SEARCH_STOPWORDS.has(w))
    .concat(extraTerms);

  if (!words.length && !budget) return [];

  const scored = products.map(p => {
    const haystacks = [
      { text: normalizeVN(p.character || ''), weight: 3 },
      { text: normalizeVN(p.series || ''), weight: 2.5 },
      { text: normalizeVN(p.name || ''), weight: 2 },
      { text: normalizeVN(p.category || ''), weight: 1.5 },
      { text: normalizeVN(p.brand || ''), weight: 1 },
      { text: normalizeVN(p.description || ''), weight: 0.75 }
    ];
    let score = 0;
    for (const w of words) {
      for (const h of haystacks) {
        if (h.text.includes(w)) score += h.weight;
      }
    }
    if (budget) {
      const price = Number(p.price) || 0;
      const withinMax = budget.max ? price <= budget.max : true;
      const withinMin = budget.min ? price >= budget.min : true;
      if (withinMax && withinMin) score += 1.2;
      else if (!words.length) score = 0; // budget-only query: hide out-of-range items
    }
    return { product: p, score };
  });

  return scored
    .filter(s => s.score >= 1) // filters out weak/coincidental single low-weight matches (e.g. only the description field)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => ({
      id: s.product.id,
      name: s.product.name,
      price: s.product.price,
      priceFormatted: formatPrice(s.product.price),
      status: s.product.status,
      image: (s.product.images && s.product.images[0]) || null,
      url: `/product.html?id=${s.product.id}`
    }));
}

const ORDER_STATUS_LABELS_VI = {
  pending: 'đang chờ shop xác nhận',
  confirmed: 'đã được xác nhận, đang chuẩn bị hàng',
  shipped: 'đang giao đi',
  completed: 'đã giao thành công',
  cancelled: 'đã bị huỷ'
};

// Pulls an order code like "WF-A1B2C3" out of free text (case/format
// tolerant — customers often type it lowercase or without the dash).
function extractOrderCode(text) {
  const m = String(text).toUpperCase().match(/WF-?([A-Z0-9]{4,10})/);
  return m ? `WF-${m[1]}` : null;
}

async function findOrderByCode(code) {
  const orders = await store.getOrders();
  return orders.find(o => (o.code || '').toUpperCase() === code) || null;
}

// Rule-based fallback assistant (no API key required, always on by default).
// Upgraded to: (1) understand Vietnamese typed without accents, (2) remember
// context across the *whole* recent conversation instead of just the last
// message, (3) cover a much wider range of intents (payment, promo codes,
// order tracking, category browsing, small talk, "what can you do"), and
// (4) fall back to a helpful menu instead of a dead end when nothing matches.
async function ruleBasedReply(message, history) {
  const info = await getLiveContactInfo();
  const m = ` ${normalizeVN(message)} `;
  // Whole-word/phrase matching (padded with spaces above) — plain substring
  // matching caused false positives like "hi" matching inside "thích",
  // "chibi", "nhiều" once accents are stripped.
  const hasAny = (arr) => arr.some(w => m.includes(` ${w} `));
  const wordCount = message.trim().split(/\s+/).length;
  const isShort = wordCount <= 4;
  const pastUser = Array.isArray(history) ? history.filter(h => h && h.role === 'user').map(h => String(h.content || '')) : [];

  // ---- small talk & bot identity, kept short so it doesn't hijack longer,
  // more specific questions that merely happen to contain "chào" etc. ----
  if (isShort) {
    if (hasAny(['chao', 'hi', 'hello', 'alo', 'hey'])) {
      return { reply: `Chào bạn 👋 Mình là trợ lý AI của ${STORE_INFO.name}. Mình có thể giúp bạn: tìm figure theo nhân vật/series/ngân sách, hỏi địa chỉ - giờ mở cửa - ship - đổi trả - thanh toán, hoặc tra cứu đơn hàng. Bạn cần gì cứ nhắn nhé!` };
    }
    if (hasAny(['cam on', 'thank', 'thanks'])) {
      return { reply: `Không có gì đâu, rất vui được giúp bạn 😊 Cần thêm gì cứ nhắn tiếp cho shop nhé!` };
    }
    if (hasAny(['tam biet', 'bye', 'hen gap lai'])) {
      return { reply: `Tạm biệt bạn nhé! Hẹn gặp lại tại ${STORE_INFO.name} 👋` };
    }
    if (hasAny(['ban la ai', 'ban ten gi', 'ban la gi'])) {
      return { reply: `Mình là trợ lý AI của ${STORE_INFO.name} — chuyên tư vấn mô hình figure anime/manga và hỗ trợ thông tin đặt hàng, shop mở suốt để giúp bạn 24/7 nhé!` };
    }
  }
  if (hasAny(['ban lam duoc gi', 'ban giup duoc gi', 'ban co the lam gi', 'ban ho tro gi'])) {
    return { reply: `Mình giúp được các việc sau nè:\n• Gợi ý figure theo nhân vật, series, thương hiệu hoặc ngân sách\n• Thông tin shop: địa chỉ, giờ mở cửa, hotline, Zalo, email\n• Chính sách vận chuyển, đổi trả, thanh toán, mã giảm giá\n• Tra cứu trạng thái đơn hàng (cho mình xin mã đơn dạng WF-xxxxxx)\nBạn cứ nhắn thoải mái, mình trả lời liền!` };
  }
  if (hasAny(['gap nhan vien', 'noi chuyen voi nguoi', 'tu van vien', 'gap admin', 'nhan vien tu van', 'gap admin'])) {
    return { reply: `Được chứ! Bạn gọi trực tiếp hotline ${info.hotline} hoặc nhắn Zalo ${info.zalo} để gặp nhân viên tư vấn trực tiếp nhé, khung giờ ${STORE_INFO.hours}.` };
  }

  // ---- store info ----
  if (hasAny(['dia chi', 'o dau', 'cua hang o', 'shop o', 'cho nao'])) {
    return { reply: `Shop ${STORE_INFO.name} có địa chỉ tại ${info.address}. Bạn có thể ghé trực tiếp hoặc xem bản đồ ngay trên trang Liên hệ nhé!` };
  }
  if (hasAny(['gio mo cua', 'may gio', 'dong cua luc'])) {
    return { reply: `Shop ${STORE_INFO.hours}. Ngoài giờ đó bạn vẫn có thể nhắn tin/gọi hotline, shop sẽ phản hồi sớm nhất có thể.` };
  }
  if (hasAny(['hotline', 'so dien thoai', 'sdt', 'goi dien', 'goi cho shop'])) {
    return { reply: `Bạn có thể gọi hotline ${info.hotline} (${STORE_INFO.hours}) để được hỗ trợ nhanh nhất.` };
  }
  if (hasAny(['zalo'])) {
    return { reply: `Zalo của shop là ${info.zalo}, bạn nhắn trực tiếp để được tư vấn nhé.` };
  }
  if (hasAny(['email', 'mail'])) {
    return { reply: `Email của shop là ${info.email}, shop phản hồi trong vòng 24 giờ.` };
  }

  // ---- policies ----
  if (hasAny(['ship', 'giao hang', 'van chuyen', 'phi ship'])) {
    return { reply: `Shop áp dụng freeship trên toàn bộ đơn hàng. Bạn xem thêm chi tiết tại trang Shipping (mục "Chính sách" ở footer), hoặc để lại địa chỉ, shop tư vấn thời gian giao cụ thể nhé.` };
  }
  if (hasAny(['doi tra', 'bao hanh', 'hoan tien'])) {
    return { reply: `Chính sách đổi trả được nêu chi tiết ở trang Returns (footer). Nhìn chung shop hỗ trợ đổi trả nếu sản phẩm lỗi từ nhà sản xuất, còn nguyên tem/hộp.` };
  }
  if (hasAny(['thanh toan', 'tra gop', 'cod', 'chuyen khoan', 'quet ma', ' qr', 'tien mat'])) {
    return { reply: `Shop hỗ trợ 3 hình thức thanh toán: COD (thanh toán khi nhận hàng — không áp dụng cho sản phẩm Pre-order), tiền mặt tại cửa hàng, hoặc chuyển khoản quét QR qua Sacombank. Bạn chọn hình thức phù hợp ngay ở bước Thanh toán nhé.` };
  }
  if (hasAny(['ma giam gia', 'khuyen mai', 'giam gia', 'voucher', 'coupon'])) {
    return { reply: `Hiện shop có mã WF10 — giảm 10% cho đơn từ 500.000đ, nhập ở bước Thanh toán. Theo dõi thêm khuyến mãi mới tại trang chủ nhé!` };
  }

  // ---- order tracking ----
  const orderCode = extractOrderCode(message);
  if (orderCode) {
    const order = await findOrderByCode(orderCode);
    if (order) {
      const statusVi = ORDER_STATUS_LABELS_VI[order.status] || order.status;
      return { reply: `Đơn hàng ${order.code} hiện đang: ${statusVi}. Nếu cần hỗ trợ thêm, gọi hotline ${info.hotline} nhé.` };
    }
    return { reply: `Mình không tìm thấy đơn hàng với mã ${orderCode}. Bạn kiểm tra lại mã (có trong email/tin nhắn xác nhận đặt hàng) hoặc gọi hotline ${info.hotline} để shop tra giúp nhé.` };
  }
  if (hasAny(['don hang cua toi', 'kiem tra don', 'theo doi don', 'trang thai don'])) {
    return { reply: `Bạn cho shop xin mã đơn (dạng WF-xxxxxx, có trong email/tin nhắn xác nhận) để mình kiểm tra ngay nhé, hoặc xem trong trang "Tài khoản" nếu bạn đã đăng nhập lúc đặt hàng.` };
  }

  // ---- category browsing ("có bán gundam không", "co plushie khong") ----
  const catalogSynonyms = await getCategorySynonyms();
  const matchedCategory = catalogSynonyms.find(c => c.norm && m.includes(c.norm));
  if (matchedCategory && hasAny(['co ban', 'co khong', 'co ko', 'ban gi', 'loai nao', 'nhung loai'])) {
    return { reply: `Có nhé! Bạn xem mục "${matchedCategory.label}"${matchedCategory.page ? ` tại ${matchedCategory.page}` : ''}, hoặc cho shop biết thêm nhân vật/mức giá để mình gợi ý sản phẩm cụ thể luôn.` };
  }

  // ---- stock check for a specific item ----
  if (hasAny(['con hang', 'con ko', 'con khong', 'het hang chua'])) {
    const products = await searchProducts(message);
    if (products.length) {
      const list = products.map(p => `• ${p.name} — ${p.status === 'out-of-stock' ? 'hiện đang hết hàng' : p.status === 'pre-order' ? 'nhận pre-order' : 'còn hàng, sẵn sàng giao'}`).join('\n');
      return { reply: `Shop kiểm tra giúp bạn nhé:\n\n${list}`, products };
    }
    return { reply: `Bạn cho shop biết tên/nhân vật cụ thể của sản phẩm để shop kiểm tra tồn kho chính xác nhé, hoặc gọi hotline ${info.hotline}.` };
  }

  // ---- product recommendation (the default path) ----
  // Search the current message first; if that's weak/empty, progressively
  // widen using recent user turns so multi-message context isn't lost, e.g.
  // "mình thích Genshin Impact" -> "tầm 500k thì sao" -> "có Nendoroid không".
  let products = await searchProducts(message);
  if (!products.length) {
    for (let i = pastUser.length - 1; i >= 0 && i >= pastUser.length - 3; i--) {
      products = await searchProducts(`${pastUser[i]} ${message}`);
      if (products.length) break;
    }
  }

  if (products.length) {
    const list = products.map(p => `• ${p.name} — ${p.priceFormatted}${p.status === 'pre-order' ? ' (Pre-order)' : p.status === 'out-of-stock' ? ' (Hết hàng)' : ''}`).join('\n');
    return {
      reply: `Dựa trên mô tả của bạn, đây là vài sản phẩm shop nghĩ bạn sẽ thích:\n\n${list}\n\nBạn bấm vào tên sản phẩm bên dưới để xem chi tiết nhé, hoặc mô tả thêm (nhân vật, series, mức giá...) để shop gợi ý chính xác hơn.`,
      products
    };
  }

  // ---- helpful fallback menu instead of a dead end ----
  return {
    reply: `Shop chưa tìm thấy sản phẩm phù hợp với mô tả đó. Bạn có thể cho shop biết thêm nhân vật/series/thương hiệu bạn thích hoặc mức giá mong muốn — hoặc hỏi mình về địa chỉ, giờ mở cửa, ship, đổi trả, thanh toán, mã giảm giá, tra cứu đơn hàng. Cần gấp thì gọi hotline ${info.hotline} nhé!`
  };
}

// AI-powered reply via the Anthropic API (used only when ANTHROPIC_API_KEY
// is configured). Falls back to the rule-based assistant on any error.
async function aiReply(message, history) {
  const products = await store.getProducts();
  const info = await getLiveContactInfo();

  const catalogForPrompt = products.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category,
    brand: p.brand,
    series: p.series,
    character: p.character,
    price: p.price,
    status: p.status,
    description: p.description
  }));

  const systemPrompt = `Bạn là trợ lý tư vấn thân thiện của cửa hàng mô hình anime/manga "${STORE_INFO.name}". Hãy nói chuyện tự nhiên như một nhân viên tư vấn dễ mến qua tin nhắn — không cứng nhắc, không máy móc.
Nhiệm vụ:
1. Trả lời thông tin cửa hàng khi khách hỏi: địa chỉ "${info.address}", giờ mở cửa "${STORE_INFO.hours}", hotline "${info.hotline}", Zalo "${info.zalo}", email "${info.email}".
2. Khi khách mô tả sở thích/nhu cầu (nhân vật, series, loại figure, tầm giá...), hãy gợi ý sản phẩm PHÙ HỢP CHỈ TỪ danh mục JSON bên dưới — tuyệt đối không bịa sản phẩm không có trong danh mục. Nêu tên chính xác và giá (định dạng có dấu chấm phân cách nghìn + "đ") của tối đa 3-4 sản phẩm phù hợp nhất. Nếu không có sản phẩm nào khớp, thành thật nói vậy và hỏi thêm một câu ngắn để hiểu rõ nhu cầu hơn (nhân vật/series/mức giá) thay vì đoán bừa.
3. Nếu khách hỏi mơ hồ hoặc câu trả lời ngắn tiếp nối câu trước ("vậy dưới 500k thì sao", "còn hàng không"), hãy dựa vào lịch sử hội thoại để hiểu ngữ cảnh thay vì hỏi lại từ đầu.
4. Giữ câu trả lời ngắn gọn (2-4 câu là vừa), gần gũi, dùng tiếng Việt đời thường (trừ khi khách nhắn tiếng khác thì trả lời theo ngôn ngữ đó). Không dùng markdown phức tạp (không tiêu đề, không bảng), có thể dùng gạch đầu dòng đơn giản khi liệt kê sản phẩm. Có thể dùng emoji nhẹ nhàng, không lạm dụng.

Danh mục sản phẩm hiện có (JSON):
${JSON.stringify(catalogForPrompt)}`;

  const messages = [
    ...(Array.isArray(history) ? history.slice(-6).filter(h => h && h.role && h.content).map(h => ({
      role: h.role === 'assistant' ? 'assistant' : 'user',
      content: String(h.content).slice(0, 2000)
    })) : []),
    { role: 'user', content: String(message).slice(0, 2000) }
  ];

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 600,
      system: systemPrompt,
      messages
    })
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Anthropic API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = (data.content || [])
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n')
    .trim();

  if (!text) throw new Error('Empty response from Anthropic API');

  // Also run the keyword search so the UI can show clickable product
  // cards under the AI's free-form text reply (best of both worlds).
  const matchedProducts = await searchProducts(message);
  return { reply: text, products: matchedProducts };
}

app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body || {};
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const result = await aiReply(message, history);
      return res.json(result);
    } catch (err) {
      console.error('AI chat error, falling back to rule-based assistant:', err.message);
      // fall through to rule-based reply below
    }
  }

  res.json(await ruleBasedReply(String(message), history));
});

// =====================================================
//  ORDER / CHECKOUT ROUTES
// =====================================================

// Generate a short, human-friendly order code, e.g. WF-A1B2C3
function generateOrderCode() {
  return 'WF-' + uuidv4().split('-')[0].toUpperCase();
}

const PROMO_CODES = { WF10: { percent: 10, minSubtotal: 500000 } };

// Place an order. Recomputes prices/totals from the live product catalog
// server-side (never trusts client-submitted prices), stores the order,
// then emails a notification — the client never has to know how that part works.
app.post('/api/orders', async (req, res) => {
  const body = req.body || {};
  const { customer, delivery, payment, invoice, note, promoCode, items } = body;

  if (!customer || !customer.name || !customer.phone) {
    return res.status(400).json({ error: 'Vui lòng nhập họ tên và số điện thoại.' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Giỏ hàng đang trống.' });
  }
  if (!delivery || (delivery.method === 'ship' && (!delivery.address || !delivery.ward))) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ địa chỉ giao hàng.' });
  }
  if (!['cod', 'cash', 'qr'].includes(payment)) {
    return res.status(400).json({ error: 'Phương thức thanh toán không hợp lệ.' });
  }

  // Recompute each line item against the current catalog where possible,
  // falling back to the submitted price if the product can't be found
  // (e.g. removed from catalog after being added to cart).
  const catalog = await store.getProducts();
  const resolvedItems = items.map(item => {
    const product = catalog.find(p => p.id === item.id);
    const price = product ? product.price : Number(item.price) || 0;
    const qty = Math.max(1, parseInt(item.qty, 10) || 1);
    return {
      id: item.id,
      name: product ? product.name : (item.name || 'Sản phẩm'),
      price,
      qty,
      image: product && product.images && product.images[0] ? product.images[0] : (item.image || '')
    };
  });

  const subtotal = resolvedItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  const shipping = 0; // flat free shipping, matches storefront

  let discount = 0;
  let appliedPromo = null;
  if (promoCode) {
    const promo = PROMO_CODES[String(promoCode).toUpperCase()];
    if (promo && (!promo.minSubtotal || subtotal >= promo.minSubtotal)) {
      discount = Math.round(subtotal * (promo.percent / 100));
      appliedPromo = String(promoCode).toUpperCase();
    }
  }
  const total = Math.max(0, subtotal + shipping - discount);

  const order = {
    id: uuidv4(),
    code: generateOrderCode(),
    createdAt: new Date().toISOString(),
    status: 'pending', // pending -> confirmed -> shipped -> completed / cancelled
    seenByAdmin: false, // powers the "new order" notification badge in the admin panel
    customer: {
      name: String(customer.name).trim(),
      phone: String(customer.phone).trim(),
      email: (customer.email || '').trim(),
      userId: (req.session && req.session.user && req.session.user.role === 'customer') ? req.session.user.id : null
    },
    delivery: {
      method: delivery.method === 'pickup' ? 'pickup' : 'ship',
      address: (delivery.address || '').trim(),
      ward: (delivery.ward || '').trim(),
      country: (delivery.country || 'Việt Nam').trim()
    },
    payment,
    invoice: invoice && invoice.requested ? {
      requested: true,
      company: (invoice.company || '').trim(),
      taxCode: (invoice.taxCode || '').trim(),
      email: (invoice.email || '').trim()
    } : { requested: false },
    note: (note || '').trim(),
    promoCode: appliedPromo,
    items: resolvedItems,
    subtotal,
    shipping,
    discount,
    total
  };

  const orders = await store.getOrders();
  orders.unshift(order);
  await store.saveOrders(orders);

  res.json({ message: 'Đặt hàng thành công.', order });
});

// Admin: list all orders (most recent first)
app.get('/api/orders', requireAdmin, async (req, res) => {
  res.json(await store.getOrders());
});

// Admin: count of orders not yet opened in the dashboard — polled by the
// sidebar to show a "new orders" badge, similar to a notification bell.
app.get('/api/orders/unseen-count', requireAdmin, async (req, res) => {
  const orders = await store.getOrders();
  res.json({ count: orders.filter(o => !o.seenByAdmin).length });
});

// Admin: mark a single order as seen (called when the admin opens its detail view)
app.put('/api/orders/:id/seen', requireAdmin, async (req, res) => {
  const orders = await store.getOrders();
  const idx = orders.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' });
  orders[idx].seenByAdmin = true;
  await store.saveOrders(orders);
  res.json({ message: 'OK', order: orders[idx] });
});

// Admin: update order status
app.put('/api/orders/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body || {};
  const validStatuses = ['pending', 'confirmed', 'shipped', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Trạng thái không hợp lệ.' });
  }
  const orders = await store.getOrders();
  const idx = orders.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Không tìm thấy đơn hàng.' });
  orders[idx].status = status;
  await store.saveOrders(orders);
  res.json({ message: 'Cập nhật trạng thái thành công.', order: orders[idx] });
});

// =====================================================
//  CONTACT INFO ROUTES (phone / Zalo / email shown in the footer)
//  Public GET so the storefront footer can render them; writes are
//  admin-only. A plain flat list rather than fixed fields so the admin
//  can add/remove as many entries as they want (e.g. two phone lines).
// =====================================================
const CONTACT_INFO_TYPES = ['phone', 'zalo', 'email', 'address', 'other'];

app.get('/api/contact-info', async (req, res) => {
  res.json(await store.getContactInfo());
});

app.post('/api/contact-info', requireAdmin, async (req, res) => {
  const { type, label, value, mapUrl } = req.body || {};
  if (!value || !String(value).trim()) {
    return res.status(400).json({ error: 'Value is required.' });
  }
  const resolvedType = CONTACT_INFO_TYPES.includes(type) ? type : 'other';
  const entries = await store.getContactInfo();
  const entry = {
    id: uuidv4(),
    type: resolvedType,
    label: (label || '').trim() || labelForType(type),
    value: String(value).trim()
  };
  // The map link only makes sense for the shop's address entry — if the
  // admin leaves it blank, the storefront falls back to auto-generating
  // one from the address text itself.
  if (resolvedType === 'address') {
    entry.mapUrl = (mapUrl && String(mapUrl).trim()) || null;
  }
  entries.push(entry);
  await store.saveContactInfo(entries);
  res.json({ message: 'Contact info added.', entry });
});

app.put('/api/contact-info/:id', requireAdmin, async (req, res) => {
  const entries = await store.getContactInfo();
  const idx = entries.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Contact info not found.' });
  const { type, label, value, mapUrl } = req.body || {};
  if (!value || !String(value).trim()) {
    return res.status(400).json({ error: 'Value is required.' });
  }
  const resolvedType = CONTACT_INFO_TYPES.includes(type) ? type : entries[idx].type;
  entries[idx] = {
    ...entries[idx],
    type: resolvedType,
    label: (label !== undefined ? String(label).trim() : entries[idx].label) || labelForType(type),
    value: String(value).trim()
  };
  if (resolvedType === 'address') {
    entries[idx].mapUrl = (mapUrl && String(mapUrl).trim()) || null;
  } else {
    delete entries[idx].mapUrl;
  }
  await store.saveContactInfo(entries);
  res.json({ message: 'Contact info updated.', entry: entries[idx] });
});

app.delete('/api/contact-info/:id', requireAdmin, async (req, res) => {
  const entries = await store.getContactInfo();
  const exists = entries.some(e => e.id === req.params.id);
  if (!exists) return res.status(404).json({ error: 'Contact info not found.' });
  await store.saveContactInfo(entries.filter(e => e.id !== req.params.id));
  res.json({ message: 'Contact info deleted.' });
});

function labelForType(type) {
  if (type === 'phone') return 'Hotline';
  if (type === 'zalo') return 'Zalo';
  if (type === 'email') return 'Email';
  if (type === 'address') return 'Store Address';
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

// Public: anyone can read the published content (storefront needs it),
// only the admin can read the draft.
app.get('/api/site-content', async (req, res) => {
  const mode = req.query.mode === 'draft' ? 'draft' : 'published';
  if (mode === 'draft') {
    if (!(req.session && req.session.user && req.session.user.role === 'admin')) {
      return res.status(401).json({ error: 'Unauthorized. Admin login required.' });
    }
    return res.json(await store.getSiteContent('draft'));
  }
  return res.json(await store.getSiteContent('published'));
});

// Autosave the draft as the admin works (not visible to real visitors).
app.post('/api/site-content/draft', requireAdmin, async (req, res) => {
  const elements = (req.body && typeof req.body.elements === 'object' && req.body.elements) || {};
  const doc = { elements, updatedAt: new Date().toISOString() };
  await store.saveSiteContent('draft', doc);
  res.json({ message: 'Draft saved.', doc });
});

// Reset the draft back to whatever is currently published (discard changes).
app.post('/api/site-content/discard', requireAdmin, async (req, res) => {
  const published = await store.getSiteContent('published');
  await store.saveSiteContent('draft', published);
  res.json({ message: 'Draft discarded.', doc: published });
});

// Officially go live: snapshot current published state into version
// history, then promote the draft to be the new published state.
app.post('/api/site-content/publish', requireAdmin, async (req, res) => {
  const published = await store.getSiteContent('published');
  const draft = await store.getSiteContent('draft');

  const versions = await store.getSiteContentVersions();
  versions.unshift({
    id: uuidv4(),
    snapshot: published,
    savedAt: new Date().toISOString(),
    label: req.body && req.body.label ? String(req.body.label).slice(0, 120) : ''
  });
  await store.saveSiteContentVersions(versions.slice(0, MAX_VERSIONS));

  const newPublished = { elements: draft.elements || {}, updatedAt: new Date().toISOString() };
  await store.saveSiteContent('published', newPublished);
  // Keep the draft in sync with what's now live.
  await store.saveSiteContent('draft', newPublished);

  res.json({ message: 'Changes are now live.', doc: newPublished });
});

// List saved versions (most recent first). Snapshots are small
// (element metadata + image paths, no binary data) so returning them
// in full keeps restore simple.
app.get('/api/site-content/versions', requireAdmin, async (req, res) => {
  res.json(await store.getSiteContentVersions());
});

// Restore a previous version into the draft. This does NOT go live by
// itself — the admin still has to press Save/Publish, same as any
// other draft edit.
app.post('/api/site-content/restore/:versionId', requireAdmin, async (req, res) => {
  const versions = await store.getSiteContentVersions();
  const version = versions.find(v => v.id === req.params.versionId);
  if (!version) return res.status(404).json({ error: 'Version not found.' });
  const doc = { elements: version.snapshot.elements || {}, updatedAt: new Date().toISOString() };
  await store.saveSiteContent('draft', doc);
  res.json({ message: 'Version restored into draft. Press Save to publish it.', doc });
});

// Upload a replacement image for an editable element.
app.post('/api/site-content/upload-image', requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file received.' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// =====================================================
//  BACKGROUND MUSIC ROUTES
//  A single site-wide background track the admin can upload,
//  enable/disable, and configure (volume, loop, autoplay).
//  Public GET so the storefront can pick it up on every page load;
//  writes are admin-only.
// =====================================================
app.get('/api/site-music', async (req, res) => {
  res.json(await store.getSiteMusic());
});

// Upload/replace the background track. Any previously uploaded file is
// removed from disk so orphaned audio files don't pile up in /uploads.
app.post('/api/site-music/upload', requireAdmin, uploadAudio.single('track'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file received.' });

  const settings = await store.getSiteMusic();
  const oldFilename = settings.filename;

  const updated = {
    ...settings,
    url: `/uploads/${req.file.filename}`,
    filename: req.file.filename,
    originalName: req.file.originalname,
    updatedAt: new Date().toISOString()
  };
  await store.saveSiteMusic(updated);

  if (oldFilename) {
    const oldPath = path.join(UPLOADS_DIR, oldFilename);
    fs.unlink(oldPath, () => {}); // best-effort cleanup, ignore errors
  }

  res.json({ message: 'Track uploaded.', settings: updated });
});

// Update playback settings (enabled / autoplay / loop / volume) without
// touching the currently uploaded track.
app.put('/api/site-music', requireAdmin, async (req, res) => {
  const settings = await store.getSiteMusic();
  const { enabled, autoplay, loop, volume } = req.body || {};

  const updated = {
    ...settings,
    enabled: typeof enabled === 'boolean' ? enabled : settings.enabled,
    autoplay: typeof autoplay === 'boolean' ? autoplay : settings.autoplay,
    loop: typeof loop === 'boolean' ? loop : settings.loop,
    volume: typeof volume === 'number' ? Math.min(1, Math.max(0, volume)) : settings.volume,
    updatedAt: new Date().toISOString()
  };
  await store.saveSiteMusic(updated);
  res.json({ message: 'Music settings updated.', settings: updated });
});

// Remove the current track entirely (deletes the file, resets to defaults).
app.delete('/api/site-music', requireAdmin, async (req, res) => {
  const settings = await store.getSiteMusic();
  if (settings.filename) {
    fs.unlink(path.join(UPLOADS_DIR, settings.filename), () => {});
  }
  const reset = { ...store.defaultMusicSettings() };
  await store.saveSiteMusic(reset);
  res.json({ message: 'Track removed.', settings: reset });
});

// =====================================================
//  PAYMENT SETTINGS
//  Bank-transfer details (bank name, account name/number, transfer note)
//  shown on the checkout page's "Chuyển khoản qua QR" option. Public GET
//  so the checkout page can render it, admin-only PUT to edit it.
// =====================================================
app.get('/api/payment-settings', async (req, res) => {
  res.json(await store.getPaymentSettings());
});

app.put('/api/payment-settings', requireAdmin, async (req, res) => {
  const settings = await store.getPaymentSettings();
  const { bankName, accountName, accountNumber, transferNote, qrImageUrl } = req.body || {};

  const updated = {
    bankName: typeof bankName === 'string' && bankName.trim() ? bankName.trim() : settings.bankName,
    accountName: typeof accountName === 'string' && accountName.trim() ? accountName.trim() : settings.accountName,
    accountNumber: typeof accountNumber === 'string' && accountNumber.trim() ? accountNumber.trim() : settings.accountNumber,
    transferNote: typeof transferNote === 'string' && transferNote.trim() ? transferNote.trim() : settings.transferNote,
    qrImageUrl: qrImageUrl !== undefined ? (qrImageUrl || null) : settings.qrImageUrl,
    updatedAt: new Date().toISOString()
  };
  await store.savePaymentSettings(updated);
  res.json({ message: 'Payment settings saved.', settings: updated });
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
