/* ============================================================
   wfigure — shared site chrome (header, mega menu, footer)
   Injected into #site-header / #site-footer placeholders that
   every page includes, so nav + category menu stay in sync.
============================================================ */

const SUPPORT_PHONE = '0365244436';
const CART_KEY = 'wfigure_cart';

/* Floating contact bubbles (every page) — phone / Messenger only. */
const CONTACT_LINKS = {
  phone: `tel:${SUPPORT_PHONE}`,
  messenger: 'https://m.me/100012223122396' // wfigure Facebook Page (Messenger)
};

/* All icons render with stroke="currentColor" so they always pick up the
   text color of whatever wraps them, instead of needing a bespoke CSS
   rule per-icon (this is what made the search icon invisible before). */
const ICONS = {
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21a8 8 0 1 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>`,
  cart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
  menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>`,
  minus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  chevronRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
  messenger: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.14 2 11.25c0 2.9 1.44 5.49 3.7 7.19V22l3.38-1.86c.9.25 1.87.38 2.92.38 5.52 0 10-4.14 10-9.27S17.52 2 12 2Zm1.02 12.48-2.55-2.72-4.98 2.72 5.48-5.82 2.6 2.72 4.93-2.72-5.48 5.82Z"/></svg>`,
  zalo: `<svg viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="6" fill="currentColor"/><text x="12" y="15.5" font-family="Arial, sans-serif" font-size="8.5" font-weight="700" fill="#fff" text-anchor="middle">Zalo</text></svg>`,
  chatbot: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,
  eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>`
};

/* ============================================================
   Shopping cart — stored client-side in localStorage so the
   cart persists across pages (and across visits) without a
   backend. Every page includes common.js, so the badge count
   and cart contents always stay in sync.
============================================================ */
function getCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
}

function addToCart(product, qty = 1) {
  const cart = getCart();
  const existing = cart.find(item => item.id === product.id);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: (product.images && product.images[0]) || '',
      brand: product.brand || product.series || '',
      qty
    });
  }
  saveCart(cart);
  showToast(`${product.name} đã được thêm vào giỏ hàng`, 'success');
}

function removeFromCart(id) {
  saveCart(getCart().filter(item => item.id !== id));
}

function setCartQty(id, qty) {
  const cart = getCart();
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty = Math.max(1, qty);
  saveCart(cart);
}

function cartCount() {
  return getCart().reduce((sum, i) => sum + i.qty, 0);
}

function cartSubtotal() {
  return getCart().reduce((sum, i) => sum + (i.price * i.qty), 0);
}

function updateCartBadge() {
  const badge = document.getElementById('cartBadge');
  if (badge) badge.textContent = cartCount();
}

function buildHeader() {
  return `
  <div class="topbar">
    <div class="container">
      <a href="tel:${SUPPORT_PHONE}" class="hotline" data-edit-id="header.topbarHotline" data-edit-type="block" data-edit-label="Top bar hotline">${ICONS.phone} <span data-edit-id="header.topbarHotlineText" data-edit-type="text" data-edit-label="Top bar hotline text">Hotline hỗ trợ: ${SUPPORT_PHONE}</span></a>
      <div class="topbar-links">
        <a href="/blog.html">Blog</a>
        <a href="/contact.html">Contact</a>
        <a href="/pages/shipping.html" data-static="shipping">Shipping &amp; Warranty</a>
        <a href="/pages/faq.html" data-static="faq">FAQ</a>
      </div>
    </div>
  </div>
  <header class="site-header">
    <div class="container nav-row">
      <button class="mobile-menu-btn" id="openMobileMenu" aria-label="Open menu">${ICONS.menu}</button>
      <a href="/index.html" class="logo">w<span class="accent">figure</span><span class="dot">.</span></a>
      <form class="search-form" id="searchForm" role="search" autocomplete="off">
        <input type="search" name="q" id="searchInput" placeholder="Search figures, series, characters..." autocomplete="off"/>
        <button type="submit" aria-label="Search">${ICONS.search}</button>
        <div class="search-results" id="searchResults"></div>
      </form>
      <a href="tel:${SUPPORT_PHONE}" class="header-hotline" data-edit-id="header.mainHotlineBlock" data-edit-type="block" data-edit-label="Header hotline (upper-left area)">
        <span class="header-hotline-icon">${ICONS.phone}</span>
        <span class="header-hotline-text"><small>Hotline hỗ trợ</small><span data-edit-id="header.mainHotlineNumber" data-edit-type="text" data-edit-label="Header hotline number">${SUPPORT_PHONE}</span></span>
      </a>
      <div class="nav-actions">
        <div class="nav-action" id="accountAction" style="cursor:pointer;">
          ${ICONS.user}
          <span id="accountLabel">Login</span>
        </div>
        <a class="nav-action" href="/cart.html">
          ${ICONS.cart}
          <span>Cart</span>
          <span class="badge" id="cartBadge">0</span>
        </a>
      </div>
    </div>
    <nav class="menubar">
      <div class="container">
        <button class="menu-toggle" id="menuToggleBtn">${ICONS.menu} MENU</button>
        <div class="menu-items" id="menuItems"><!-- injected --></div>
        <a class="menu-other-link" href="/category.html?category=all">Xem sản phẩm khác ${ICONS.chevronRight}</a>
      </div>
    </nav>
  </header>

  <div class="offcanvas" id="mobileMenu">
    <div class="offcanvas-backdrop" id="closeMobileMenuBackdrop"></div>
    <div class="offcanvas-panel">
      <button class="close-btn" id="closeMobileMenu">${ICONS.close}</button>
      <a href="/index.html" class="logo">w<span class="accent">figure</span><span class="dot">.</span></a>
      <div class="offcanvas-section">
        <h4>Account</h4>
        <a href="/login.html">Login / Register</a>
        <a href="/blog.html">Blog</a>
        <a href="/contact.html">Contact us</a>
        <a href="tel:${SUPPORT_PHONE}">Call hotline ${SUPPORT_PHONE}</a>
      </div>
      <div class="offcanvas-section" id="mobileMenuCategories">
        <h4>Categories</h4>
        <!-- injected -->
      </div>
    </div>
  </div>

  <a href="tel:${SUPPORT_PHONE}" class="mobile-call">${ICONS.phone} Call hotline: ${SUPPORT_PHONE}</a>
  `;
}

const SHIPPING_BANNER_DISMISS_KEY = 'wf_shipping_banner_dismissed';

function buildShippingBanner() {
  return `
  <div class="shipping-banner" id="shippingBanner">
    <p>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
      <span data-edit-id="header.shippingBanner" data-edit-type="text" data-edit-label="Free shipping banner text">Miễn phí vận chuyển cho đơn hàng từ 1.000.000₫ trên toàn quốc</span>
    </p>
    <button type="button" class="shipping-banner-close" id="shippingBannerClose" aria-label="Đóng thông báo">${ICONS.close}</button>
  </div>`;
}

function buildBackToTopButton() {
  return `
  <button type="button" class="back-to-top" id="backToTopBtn" aria-label="Back to top">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
  </button>`;
}

function buildFloatingContacts() {
  return `
  <div class="floating-contact" id="floatingContact">
    <button type="button" class="fc-btn fc-ai" id="fcAiToggle" aria-label="Chat với AI" data-tip="Chat với AI">${ICONS.chatbot}</button>
    <a href="${CONTACT_LINKS.phone}" class="fc-btn fc-phone" aria-label="Call hotline" data-tip="Gọi ${SUPPORT_PHONE}">${ICONS.phone}</a>
    <a href="${CONTACT_LINKS.messenger}" class="fc-btn fc-messenger" target="_blank" rel="noopener" aria-label="Chat on Messenger" data-tip="Chat Messenger">${ICONS.messenger}</a>
  </div>
  <div class="ai-floating-panel" id="aiFloatingPanel"></div>`;
}

// Loads /js/chatbot.js once per page (skips if the page already includes
// it explicitly, e.g. contact.html which also has the full embedded
// widget). Injected dynamically so every customer-facing page gets the
// floating AI chat bubble without having to edit each HTML file.
function loadAiChatbotScript() {
  if (document.querySelector('script[src="/js/chatbot.js"]')) return;
  const s = document.createElement('script');
  s.src = '/js/chatbot.js';
  document.body.appendChild(s);
}

function contactInfoHref(entry) {
  if (entry.type === 'phone') return `tel:${entry.value.replace(/\s+/g, '')}`;
  if (entry.type === 'email') return `mailto:${entry.value}`;
  if (entry.type === 'zalo') return entry.value.startsWith('http') ? entry.value : `https://zalo.me/${entry.value.replace(/\D/g, '')}`;
  return entry.value.startsWith('http') ? entry.value : undefined;
}

function renderFooterContactList(entries) {
  const list = document.getElementById('footerContactList');
  if (!list) return;
  if (!entries || !entries.length) {
    list.innerHTML = '<li>32 Đồng Xoài, Tân Bình, TP. Hồ Chí Minh</li><li>Open daily 09:00 – 20:30</li>';
    return;
  }
  const rows = entries.map(entry => {
    const href = contactInfoHref(entry);
    const content = href
      ? `<a ${href.startsWith('http') ? 'target="_blank" rel="noopener"' : ''} href="${href}">${entry.value}</a>`
      : entry.value;
    return `<li>${entry.label ? entry.label + ': ' : ''}${content}</li>`;
  });
  if (!entries.some(e => e.type === 'address')) {
    rows.push('<li>32 Đồng Xoài, Tân Bình, TP. Hồ Chí Minh</li>');
  }
  rows.push('<li>Open daily 09:00 – 20:30</li>');
  list.innerHTML = rows.join('');
}

async function loadFooterContactInfo() {
  try {
    const res = await fetch('/api/contact-info');
    const entries = await res.json();
    renderFooterContactList(entries);
  } catch (e) {
    renderFooterContactList(null);
  }
}

function buildFooter() {
  return `
  <div class="container footer-grid">
    <div class="footer-brand">
      <a href="/index.html" class="logo">w<span class="accent">figure</span><span class="dot">.</span></a>
      <p>wfigure is your destination for authentic anime &amp; manga figures — PVC scale figures, Nendoroid, Gundam models, plushies and character goods, curated for collectors.</p>
    </div>
    <div>
      <h4>Policies</h4>
      <ul>
        <li><a href="/blog.html">Blog</a></li>
        <li><a href="/contact.html">Contact</a></li>
        <li><a href="/pages/shipping.html">Shipping &amp; Warranty</a></li>
        <li><a href="/pages/returns.html">Returns Policy</a></li>
        <li><a href="/pages/privacy.html">Privacy Policy</a></li>
      </ul>
    </div>
    <div>
      <h4>Account</h4>
      <ul>
        <li><a href="/login.html">Login</a></li>
        <li><a href="/login.html?tab=register">Register</a></li>
        <li><a href="/category.html?category=all">All Products</a></li>
        <li><a href="/admin/dashboard.html">Admin</a></li>
      </ul>
    </div>
    <div>
      <h4>Contact</h4>
      <ul id="footerContactList">
        <li>Hotline: <a href="tel:${SUPPORT_PHONE}">${SUPPORT_PHONE}</a></li>
      </ul>
    </div>
  </div>
  <div class="container footer-bottom">
    <span>© ${new Date().getFullYear()} wfigure. All rights reserved.</span>
    <span>Built for collectors, by collectors.</span>
  </div>
  `;
}

function categoryIcon() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;margin-right:4px;vertical-align:-2px;"><path d="m9 18 6-6-6-6"/></svg>`;
}

function simpleMenuHref(item) {
  if (item.page) return item.page;
  if (item.id === 'in-stock') return '/category.html?status=in-stock';
  if (item.id === 'new-releases') return '/category.html?sort=newest';
  return `/category.html?category=${item.id}`;
}

function renderMenu(menuData) {

  const menuItems = document.getElementById('menuItems');
  const mobileCats = document.getElementById('mobileMenuCategories');
  if (!menuItems) return;

  menuItems.innerHTML = menuData.menu.map(item => {
    if (item.type === 'mega') {
      const cols = item.columns.map(col => `
        <div class="mega-col">
          <h4>${col.title}</h4>
          ${col.links.map(l => `<a href="/category.html?${l.kind}=${encodeURIComponent(l.value)}">${l.label}</a>`).join('')}
        </div>
      `).join('');
      // The label itself is a real link to the item's dedicated hub page;
      // hovering over the whole .menu-item still opens the mega dropdown
      // (see .menu-item:hover .mega in style.css) for quick sub-filters.
      return `
        <div class="menu-item">
          <a href="${item.page || '#'}">${item.label} ${categoryIcon()}</a>
          <div class="mega">${cols}</div>
        </div>`;
    }
    return `<div class="menu-item"><a href="${simpleMenuHref(item)}">${item.label}</a></div>`;
  }).join('');

  if (mobileCats) {
    mobileCats.innerHTML = '<h4>Categories</h4>' + menuData.menu.map(item => {
      return `<a href="${simpleMenuHref(item)}">${item.label}</a>`;
    }).join('');
  }
}

async function loadMenu() {
  try {
    const res = await fetch('/api/categories');
    const data = await res.json();
    renderMenu(data);
  } catch (e) {
    console.error('Failed to load categories', e);
  }
}

async function refreshAccountState() {
  const label = document.getElementById('accountLabel');
  const action = document.getElementById('accountAction');
  if (!label || !action) return;
  try {
    const res = await fetch('/api/me');
    if (res.ok) {
      const data = await res.json();
      label.textContent = data.user.role === 'admin' ? 'Admin' : data.user.name.split(' ')[0];
      action.onclick = () => {
        if (data.user.role === 'admin') {
          window.location.href = '/admin/dashboard.html';
        } else {
          window.location.href = '/account.html';
        }
      };
      return;
    }
  } catch (e) { /* not logged in */ }
  label.textContent = 'Login';
  action.onclick = () => { window.location.href = '/login.html'; };
}

function wireShippingBanner() {
  const banner = document.getElementById('shippingBanner');
  const closeBtn = document.getElementById('shippingBannerClose');
  if (!banner || !closeBtn) return;
  if (sessionStorage.getItem(SHIPPING_BANNER_DISMISS_KEY) === '1') {
    banner.remove();
    document.body.classList.remove('has-shipping-banner');
    return;
  }
  document.body.classList.add('has-shipping-banner');
  closeBtn.addEventListener('click', () => {
    sessionStorage.setItem(SHIPPING_BANNER_DISMISS_KEY, '1');
    document.body.classList.remove('has-shipping-banner');
    banner.remove();
  });
}

function wireBackToTop() {
  const btn = document.getElementById('backToTopBtn');
  if (!btn) return;
  const toggleVisibility = () => {
    btn.classList.toggle('visible', window.scrollY > 480);
  };
  window.addEventListener('scroll', toggleVisibility, { passive: true });
  toggleVisibility();
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function wireMobileMenu() {
  const openBtn = document.getElementById('openMobileMenu');
  const closeBtn = document.getElementById('closeMobileMenu');
  const backdrop = document.getElementById('closeMobileMenuBackdrop');
  const panel = document.getElementById('mobileMenu');
  if (!openBtn || !panel) return;
  openBtn.addEventListener('click', () => panel.classList.add('open'));
  closeBtn.addEventListener('click', () => panel.classList.remove('open'));
  backdrop.addEventListener('click', () => panel.classList.remove('open'));
}

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function searchResultProductHTML(p) {
  const img = (p.images && p.images[0])
    ? `<img src="${p.images[0]}" alt="">`
    : `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.4"><path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z"/><path d="M3 7l9 5 9-5"/><path d="M12 12v10"/></svg>`;
  return `
  <a class="search-result-item" href="/product.html?id=${encodeURIComponent(p.id)}">
    <span class="search-result-thumb">${img}</span>
    <span class="search-result-text">
      <span class="search-result-title">${escapeHtml(p.name)}</span>
      <span class="search-result-meta price">${formatVND(p.price)}</span>
    </span>
  </a>`;
}

function searchResultArticleHTML(post) {
  const img = post.coverImage
    ? `<img src="${post.coverImage}" alt="">`
    : `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.4"><path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>`;
  return `
  <a class="search-result-item" href="/blog-post.html?slug=${encodeURIComponent(post.slug)}">
    <span class="search-result-thumb">${img}</span>
    <span class="search-result-text">
      <span class="search-result-title">${escapeHtml(post.title)}</span>
      <span class="search-result-meta">Article</span>
    </span>
  </a>`;
}

function wireSearch() {
  const form = document.getElementById('searchForm');
  const input = document.getElementById('searchInput');
  const resultsBox = document.getElementById('searchResults');
  if (!form || !input || !resultsBox) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (q) window.location.href = `/category.html?q=${encodeURIComponent(q)}`;
  });

  let debounceTimer = null;
  let requestToken = 0;

  function closeResults() {
    resultsBox.classList.remove('open');
  }

  function openResults() {
    resultsBox.classList.add('open');
  }

  async function runSearch(query) {
    const token = ++requestToken;
    resultsBox.innerHTML = `<div class="search-results-loading">Searching…</div>`;
    openResults();
    try {
      const [productsRes, blogRes] = await Promise.all([
        fetch(`/api/products?q=${encodeURIComponent(query)}&limit=5`),
        fetch(`/api/blog?q=${encodeURIComponent(query)}&limit=4`)
      ]);
      const products = productsRes.ok ? await productsRes.json() : [];
      const articles = blogRes.ok ? await blogRes.json() : [];
      if (token !== requestToken) return; // a newer keystroke already fired

      if (!products.length && !articles.length) {
        resultsBox.innerHTML = `<div class="search-results-empty">No results for &ldquo;${escapeHtml(query)}&rdquo;</div>`;
        return;
      }

      let html = '';
      if (products.length) {
        html += `<div class="search-results-group"><h5>Products</h5>${products.map(searchResultProductHTML).join('')}</div>`;
      }
      if (articles.length) {
        html += `<div class="search-results-group"><h5>Articles</h5>${articles.map(searchResultArticleHTML).join('')}</div>`;
      }
      html += `<a class="search-results-viewall" href="/category.html?q=${encodeURIComponent(query)}">View all results for "${escapeHtml(query)}"</a>`;
      resultsBox.innerHTML = html;
    } catch (e) {
      if (token !== requestToken) return;
      resultsBox.innerHTML = `<div class="search-results-empty">Something went wrong. Please try again.</div>`;
    }
  }

  input.addEventListener('input', () => {
    const query = input.value.trim();
    clearTimeout(debounceTimer);
    if (query.length < 2) {
      closeResults();
      return;
    }
    debounceTimer = setTimeout(() => runSearch(query), 250);
  });

  input.addEventListener('focus', () => {
    if (input.value.trim().length >= 2 && resultsBox.innerHTML) openResults();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeResults(); input.blur(); }
  });

  // Delay so a click on a result link still registers before the blur
  // handler hides the dropdown out from under it.
  input.addEventListener('blur', () => setTimeout(closeResults, 150));

  document.addEventListener('click', (e) => {
    if (!form.contains(e.target)) closeResults();
  });
}

function formatVND(amount) {
  if (!amount || amount === 0) return 'Contact for price';
  return amount.toLocaleString('vi-VN') + '₫';
}

function statusLabel(status) {
  return { 'in-stock': 'In Stock', 'pre-order': 'Pre-order', 'out-of-stock': 'Out of Stock' }[status] || status;
}

function showToast(message, type = 'success') {
  let toast = document.getElementById('globalToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'globalToast';
    document.body.appendChild(toast);
  }
  toast.className = `toast ${type}`;
  toast.textContent = message;
  requestAnimationFrame(() => toast.classList.add('show'));
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3200);
}

function productCardHTML(p) {
  const img = (p.images && p.images[0]) ? `<img src="${p.images[0]}" alt="${p.name}" loading="lazy"/>` : `<svg class="ph-icon" viewBox="0 0 24 24" fill="none" stroke-width="1.2"><path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z"/><path d="M3 7l9 5 9-5"/><path d="M12 12v10"/></svg>`;
  const discount = (p.oldPrice && p.oldPrice > p.price) ? Math.round(100 - (p.price / p.oldPrice) * 100) : 0;
  const safeProduct = encodeURIComponent(JSON.stringify(p)).replace(/'/g, '%27');
  return `
  <a class="card" href="/product.html?id=${p.id}">
    <div class="card-media">
      <span class="status-tag status-${p.status}">${statusLabel(p.status)}</span>
      ${discount > 0 ? `<span class="discount-tag">-${discount}%</span>` : ''}
      ${img}
      <div class="card-hover-actions">
        <button type="button" class="card-quick-view" title="Xem nhanh" onclick="event.preventDefault();event.stopPropagation();openQuickView('${p.id}');">${ICONS.eye}</button>
        <button type="button" class="card-quick-add" title="Thêm vào giỏ hàng" onclick="event.preventDefault();event.stopPropagation();quickAddToCart('${safeProduct}');">${ICONS.plus}</button>
      </div>
    </div>
    <div class="card-body">
      <span class="card-brand">${p.brand || p.series || ''}</span>
      <span class="card-title">${p.name}</span>
      <div class="card-price">
        <span class="price-now">${formatVND(p.price)}</span>
        ${p.oldPrice > p.price ? `<span class="price-old">${formatVND(p.oldPrice)}</span>` : ''}
      </div>
    </div>
  </a>`;
}

function quickAddToCart(encoded) {
  try {
    const product = JSON.parse(decodeURIComponent(encoded));
    addToCart(product, 1);
  } catch (e) { console.error('Quick add failed', e); }
}

/* ============================================================
   Quick View — a lightweight modal that shows a product's photo,
   price, status and short description without leaving the current
   page. Triggered by hovering a product card (which reveals the
   eye-icon button) and clicking it. The modal markup is built once
   and reused for every product.
============================================================ */
function ensureQuickViewModal() {
  if (document.getElementById('quickViewModal')) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
  <div class="qv-overlay" id="quickViewModal">
    <div class="qv-backdrop" id="qvBackdrop"></div>
    <div class="qv-panel" role="dialog" aria-modal="true">
      <button type="button" class="qv-close" id="qvClose" aria-label="Close quick view">${ICONS.close}</button>
      <div class="qv-body" id="qvBody"><div class="qv-loading">Loading…</div></div>
    </div>
  </div>`;
  document.body.appendChild(wrap.firstElementChild);
  document.getElementById('qvBackdrop').addEventListener('click', closeQuickView);
  document.getElementById('qvClose').addEventListener('click', closeQuickView);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeQuickView();
  });
}

function closeQuickView() {
  const modal = document.getElementById('quickViewModal');
  if (modal) modal.classList.remove('show');
  document.body.classList.remove('qv-lock');
}

async function openQuickView(id) {
  ensureQuickViewModal();
  const modal = document.getElementById('quickViewModal');
  const body = document.getElementById('qvBody');
  body.innerHTML = `<div class="qv-loading">Loading…</div>`;
  modal.classList.add('show');
  document.body.classList.add('qv-lock');

  try {
    const res = await fetch(`/api/products/${id}`);
    if (!res.ok) throw new Error('Product not found');
    const p = await res.json();
    const discount = (p.oldPrice && p.oldPrice > p.price) ? Math.round(100 - (p.price / p.oldPrice) * 100) : 0;
    const img = (p.images && p.images[0]) ? `<img src="${p.images[0]}" alt="${p.name}">` : `<svg class="ph-icon" viewBox="0 0 24 24" fill="none" stroke-width="1.2"><path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z"/><path d="M3 7l9 5 9-5"/><path d="M12 12v10"/></svg>`;
    const safeProduct = encodeURIComponent(JSON.stringify(p)).replace(/'/g, '%27');
    body.innerHTML = `
      <div class="qv-media">
        <span class="status-tag status-${p.status}">${statusLabel(p.status)}</span>
        ${discount > 0 ? `<span class="discount-tag">-${discount}%</span>` : ''}
        ${img}
      </div>
      <div class="qv-info">
        <span class="card-brand">${p.brand || p.series || ''}</span>
        <h3>${p.name}</h3>
        <div class="card-price" style="margin:6px 0 14px;">
          <span class="price-now" style="font-size:1.3rem;">${formatVND(p.price)}</span>
          ${p.oldPrice > p.price ? `<span class="price-old">${formatVND(p.oldPrice)}</span>` : ''}
        </div>
        ${p.description ? `<p class="qv-desc">${p.description.length > 220 ? p.description.slice(0, 220) + '…' : p.description}</p>` : ''}
        <div class="qv-meta">
          ${p.series ? `<div><span>Series</span>${p.series}</div>` : ''}
          ${p.character ? `<div><span>Character</span>${p.character}</div>` : ''}
        </div>
        <div class="qv-actions">
          <button type="button" class="btn btn-primary" onclick="quickAddToCart('${safeProduct}');closeQuickView();">Add to Cart</button>
          <a class="btn btn-outline" href="/product.html?id=${p.id}">View Full Details</a>
        </div>
      </div>`;
  } catch (e) {
    body.innerHTML = `<div class="qv-loading">Couldn't load this product. <a href="/product.html?id=${id}">View product page →</a></div>`;
  }
}

/* ============================================================
   Blog / News cards — shared by the homepage "Latest News"
   section and blog.html so listings look identical everywhere.
============================================================ */
function blogCardHTML(post) {
  const img = post.coverImage
    ? `<img src="${post.coverImage}" alt="${post.title}" loading="lazy">`
    : `<svg class="ph-icon" viewBox="0 0 24 24" fill="none" stroke-width="1.2"><path d="M4 4h16v16H4z"/><path d="M4 9h16M9 4v16"/></svg>`;
  const date = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-GB') : '';
  return `
  <a class="blog-card" href="/blog-post.html?slug=${encodeURIComponent(post.slug)}">
    <div class="blog-card-media">${img}<span class="blog-card-cat">${post.category || 'News'}</span></div>
    <div class="blog-card-body">
      <span class="blog-card-date">${date}</span>
      <span class="blog-card-title">${post.title}</span>
      ${post.excerpt ? `<span class="blog-card-excerpt">${post.excerpt}</span>` : ''}
    </div>
  </a>`;
}

/* ============================================================
   Countdown helper — used by the homepage Flash Sale section.
   Pads to 2 digits and calls onExpire once when the target time
   is reached (interval keeps running so the caller can decide
   what to do next, e.g. hide the section).
============================================================ */
function startCountdown(targetDate, onTick, onExpire) {
  function tick() {
    const diff = new Date(targetDate).getTime() - Date.now();
    if (diff <= 0) {
      onTick({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
      if (onExpire) onExpire();
      return;
    }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);
    onTick({ days, hours, minutes, seconds, expired: false });
  }
  tick();
  return setInterval(tick, 1000);
}

function pad2(n) { return String(n).padStart(2, '0'); }

/* ============================================================
   "Edit Website" content engine
   ------------------------------------------------------------
   Any element in the markup can opt into being editable from the
   admin's visual editor by adding:
     data-edit-id="some.unique.id"               (required — the storage key)
     data-edit-type="text|image|block|slideshow" (what the editor lets you change)
     data-edit-label="Human name"                (optional — shown in the editor UI)
   A "slideshow" element stores { images: [url, ...], intervalMs } and is
   rendered as a rotating, sliding image banner (see initSlideshowElement
   below) — used e.g. by the homepage hero visual.
   This engine fetches the published overrides (text, image, position,
   size, visibility) and applies them on every normal page load, so
   whatever the admin last saved is what real visitors see. The editor
   itself (js/editor.js) reuses applySiteContentToDOM() to preview the
   draft live while an admin is editing.
============================================================ */
const HERO_SLIDE_INTERVAL_DEFAULT = 3000; // ms between slides if the admin hasn't set one
const HERO_SLIDE_TRANSITION_MS = 600;     // must match the CSS transition duration on .hero-slideshow-track

// Builds/rebuilds a sliding image banner inside `el` (which must contain a
// `.hero-visual-default` fallback layer and an empty `.hero-slideshow`
// layer — see index.html). Falls back to showing the original decorative
// markup when no images have been configured yet. Re-running this (e.g. on
// every draft re-render in the admin editor) safely tears down any
// previous rotation timer first.
function initSlideshowElement(el, ov) {
  const defaultLayer = el.querySelector('.hero-visual-default');
  const showEl = el.querySelector('.hero-slideshow');
  if (el._heroSlideTimer) { clearInterval(el._heroSlideTimer); el._heroSlideTimer = null; }
  if (!showEl) return;

  const images = Array.isArray(ov.images) ? ov.images.filter(Boolean) : [];
  if (!images.length) {
    if (defaultLayer) defaultLayer.style.display = '';
    showEl.style.display = 'none';
    showEl.innerHTML = '';
    return;
  }

  if (defaultLayer) defaultLayer.style.display = 'none';
  showEl.style.display = '';
  showEl.innerHTML = '';

  const track = document.createElement('div');
  track.className = 'hero-slideshow-track';
  images.forEach((src) => {
    const slide = document.createElement('div');
    slide.className = 'hero-slide';
    slide.style.backgroundImage = `url("${src}")`;
    track.appendChild(slide);
  });
  showEl.appendChild(track);

  const total = images.length;
  if (total <= 1) return; // nothing to rotate through

  // Append a clone of the first slide so the track can slide "past the
  // end" and then snap back to 0 without a visible jump — the standard
  // infinite-carousel trick.
  track.appendChild(track.firstElementChild.cloneNode(true));

  const dots = document.createElement('div');
  dots.className = 'hero-slideshow-dots';
  images.forEach((_, i) => {
    const d = document.createElement('span');
    if (i === 0) d.classList.add('active');
    dots.appendChild(d);
  });
  showEl.appendChild(dots);

  let index = 0;
  const intervalMs = Math.max(1000, parseInt(ov.intervalMs, 10) || HERO_SLIDE_INTERVAL_DEFAULT);

  function goNext() {
    index++;
    track.style.transform = `translateX(-${index * 100}%)`;
    const dotIndex = index % total;
    Array.from(dots.children).forEach((d, i) => d.classList.toggle('active', i === dotIndex));
    if (index === total) {
      setTimeout(() => {
        track.classList.add('no-transition');
        index = 0;
        track.style.transform = 'translateX(0)';
        void track.offsetWidth; // force reflow before re-enabling the transition
        track.classList.remove('no-transition');
      }, HERO_SLIDE_TRANSITION_MS + 30);
    }
  }
  el._heroSlideTimer = setInterval(goNext, intervalMs);
}

function applyOverrideToElement(el, ov) {
  if (!el || !ov) return;
  el.style.display = ov.hidden ? 'none' : '';
  if (typeof ov.text === 'string') {
    el.textContent = ov.text;
  }
  if (ov.image) {
    const img = el.tagName === 'IMG' ? el : el.querySelector('img');
    if (img) img.src = ov.image;
  }
  if (ov.type === 'slideshow') {
    initSlideshowElement(el, ov);
  }
  const tx = ov.offsetX || 0, ty = ov.offsetY || 0;
  el.style.transform = (tx || ty) ? `translate(${tx}px, ${ty}px)` : '';
  if (ov.width) el.style.width = ov.width + 'px';
  if (ov.height) el.style.height = ov.height + 'px';
  if (ov.locked) el.setAttribute('data-edit-locked', 'true'); else el.removeAttribute('data-edit-locked');
}

function ensureFreeLayer() {
  let layer = document.getElementById('ewFreeLayer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'ewFreeLayer';
    layer.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:1px;overflow:visible;z-index:55;';
    document.body.appendChild(layer);
  }
  return layer;
}

// Custom elements (type "new-text" / "new-image") aren't attached to any
// element already in the markup — the admin drops them anywhere on the
// page from the editor toolbar. They live in a single absolutely
// positioned layer and are placed with page coordinates (x, y) rather
// than the offsetX/offsetY "nudge from original spot" model used for
// existing template elements.
function renderFreeElement(id, ov) {
  const isImage = ov.type === 'new-image';
  const el = document.createElement(isImage ? 'img' : 'div');
  el.setAttribute('data-edit-id', id);
  el.setAttribute('data-edit-type', isImage ? 'image' : 'text');
  el.setAttribute('data-edit-label', isImage ? 'Custom image' : 'Custom text');
  el.setAttribute('data-edit-free', 'true');
  el.style.position = 'absolute';
  el.style.left = (ov.x || 0) + 'px';
  el.style.top = (ov.y || 0) + 'px';
  el.style.pointerEvents = 'auto';
  // Images are draggable by the browser by default (native "drag this
  // image out" behavior). That native drag hijacks mouse movement mid-
  // gesture, which is what made horizontal dragging feel broken while
  // vertical still worked. Disable it so our own mousedown/mousemove
  // reposition logic in editor.js is the only thing handling the drag.
  if (isImage) {
    el.setAttribute('draggable', 'false');
    el.style.userSelect = 'none';
    el.style.webkitUserDrag = 'none';
  }
  if (isImage) {
    el.style.borderRadius = '8px';
    // #ewFreeLayer (this element's containing block, since both are
    // position:absolute) is only 1px wide — it exists purely as a
    // coordinate anchor. The site-wide `img{max-width:100%}` reset
    // resolves that percentage against the containing block, which
    // collapses this image down to ~1px regardless of the width we set
    // below. Custom images are explicitly sized (by the admin, in px),
    // so opt them out of that reset.
    el.style.maxWidth = 'none';
    if (ov.image) el.src = ov.image;
    if (!ov.width) el.style.width = '240px';
  } else {
    el.style.font = "500 16px 'Inter', system-ui, sans-serif";
    el.style.color = 'var(--text, #f2f0f6)';
    el.style.background = 'rgba(0,0,0,0.4)';
    el.style.padding = '8px 12px';
    el.style.borderRadius = '8px';
    el.style.maxWidth = '340px';
    el.textContent = typeof ov.text === 'string' ? ov.text : '';
  }
  if (ov.width) el.style.width = ov.width + 'px';
  if (ov.height) el.style.height = ov.height + 'px';
  if (ov.fontSize) el.style.fontSize = ov.fontSize + 'px';
  el.style.display = ov.hidden ? 'none' : '';
  if (ov.locked) el.setAttribute('data-edit-locked', 'true');
  ensureFreeLayer().appendChild(el);
  return el;
}

function applySiteContentToDOM(doc) {
  if (!doc || !doc.elements) return;
  const els = doc.elements;
  // Clear previously injected clones/custom elements before re-applying
  // (used when the editor live-updates the preview after an undo/etc).
  document.querySelectorAll('[data-edit-clone]').forEach(n => n.remove());
  document.querySelectorAll('[data-edit-free]').forEach(n => n.remove());

  Object.keys(els).forEach(id => {
    const ov = els[id];
    if (ov.type === 'clone' || ov.type === 'new-text' || ov.type === 'new-image') return;
    const el = document.querySelector(`[data-edit-id="${id}"]`);
    if (el) applyOverrideToElement(el, ov);
  });

  Object.keys(els).forEach(id => {
    const ov = els[id];
    if (ov.type !== 'clone') return;
    const src = document.querySelector(`[data-edit-id="${ov.cloneOf}"]`);
    if (!src) return;
    const clone = src.cloneNode(true);
    // A clone is treated as one atomic duplicated block — strip any
    // data-edit-id on its *descendants* so they don't collide with the
    // original nested editable elements (e.g. a hotline number span
    // inside a cloned header block).
    clone.querySelectorAll('[data-edit-id]').forEach(n => n.removeAttribute('data-edit-id'));
    clone.setAttribute('data-edit-id', id);
    clone.setAttribute('data-edit-clone', 'true');
    clone.removeAttribute('data-edit-locked');
    src.insertAdjacentElement('afterend', clone);
    applyOverrideToElement(clone, ov);
  });

  Object.keys(els).forEach(id => {
    const ov = els[id];
    if (ov.type !== 'new-text' && ov.type !== 'new-image') return;
    renderFreeElement(id, ov);
  });
}

async function loadAndApplyPublishedContent() {
  try {
    const res = await fetch('/api/site-content');
    const doc = await res.json();
    applySiteContentToDOM(doc);
    return doc;
  } catch (e) {
    console.error('Failed to load site content', e);
    return null;
  }
}

// Loads the visual editor (editor.css + editor.js) for the current page,
// after confirming the logged-in user is actually an admin. Shared by the
// ?edit=1 query-param path and the backtick quick-launch shortcut below,
// so both go through the exact same auth check. Everyone else (including
// logged-out visitors) never downloads editor.js/editor.css.
let editWebsiteModeActive = false;
let editWebsiteModeLoading = false;
async function loadEditWebsiteMode() {
  if (editWebsiteModeActive || editWebsiteModeLoading) return;
  editWebsiteModeLoading = true;
  let isAdmin = false;
  try {
    const res = await fetch('/api/me');
    if (res.ok) {
      const data = await res.json();
      isAdmin = !!(data.user && data.user.role === 'admin');
    }
  } catch (e) { /* treat as not an admin */ }
  editWebsiteModeLoading = false;
  if (!isAdmin) return;

  editWebsiteModeActive = true;
  if (!document.getElementById('editorStylesheet')) {
    const link = document.createElement('link');
    link.id = 'editorStylesheet';
    link.rel = 'stylesheet';
    link.href = '/css/editor.css';
    document.head.appendChild(link);
  }
  const script = document.createElement('script');
  script.src = '/js/editor.js';
  document.body.appendChild(script);
}

// If an admin opens any page with ?edit=1, load the visual editor.
async function maybeInitEditWebsiteMode() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('edit') !== '1') return;
  loadEditWebsiteMode();
}

// Quick-launch shortcut: an admin can press the backtick/tilde key (`)
// anywhere on a storefront page to jump straight into page editing mode,
// without having to know about or type the "?edit=1" URL param. Silently
// does nothing for non-admins (and for logged-out visitors) beyond the
// one auth check. Ignored while typing in a field, and while the editor
// is already active so it doesn't fight with editor.js's own shortcuts.
function wireQuickEditShortcut() {
  document.addEventListener('keydown', (e) => {
    if (e.key !== '`') return;
    if (editWebsiteModeActive || editWebsiteModeLoading) return;
    const t = e.target;
    const tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();

    // Reflect edit mode in the URL (so a refresh keeps it, and it matches
    // the normal ?edit=1 entry point) without a page reload.
    const params = new URLSearchParams(window.location.search);
    if (params.get('edit') !== '1') {
      params.set('edit', '1');
      const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
      window.history.replaceState(null, '', newUrl);
    }
    loadEditWebsiteMode();
  });
}

function initSiteChrome() {
  const headerEl = document.getElementById('site-header');
  const footerEl = document.getElementById('site-footer');
  if (headerEl) headerEl.innerHTML = buildHeader();
  if (footerEl) footerEl.innerHTML = buildFooter();
  if (headerEl && !document.getElementById('shippingBanner')) {
    document.body.insertAdjacentHTML('afterbegin', buildShippingBanner());
  }
  if (headerEl && !document.getElementById('floatingContact')) {
    document.body.insertAdjacentHTML('beforeend', buildFloatingContacts());
  }
  if (headerEl && !document.getElementById('backToTopBtn')) {
    document.body.insertAdjacentHTML('beforeend', buildBackToTopButton());
  }
  if (headerEl) loadAiChatbotScript();
  if (footerEl) loadFooterContactInfo();
  loadMenu();
  refreshAccountState();
  wireMobileMenu();
  wireSearch();
  wireShippingBanner();
  wireBackToTop();
  updateCartBadge();
  loadAndApplyPublishedContent().then(() => maybeInitEditWebsiteMode());
  wireQuickEditShortcut();
  initBackgroundMusic();
}

// =====================================================
//  BACKGROUND MUSIC (site-wide, admin-configurable)
//  A single <audio> element + floating mute/play toggle. Since this is
//  a classic multi-page site (not an SPA), the track restarts on every
//  navigation — we use sessionStorage to remember the visitor's chosen
//  play/pause state and roughly where they were, so it feels continuous
//  as they browse between pages instead of resetting their preference.
// =====================================================
const MUSIC_STATE_KEY = 'wf_music_playing';
const MUSIC_TIME_KEY = 'wf_music_time';

function buildMusicToggleButton() {
  return `
  <button id="musicToggleBtn" class="music-toggle" aria-label="Toggle background music" data-tip="Nhạc nền" style="display:none;">
    <svg id="musicIconOn" viewBox="0 0 24 24" fill="currentColor" style="display:none;"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>
    <svg id="musicIconOff" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" opacity="0.35"/><path d="M3 3l18 18-1.4 1.4L1.6 4.4 3 3z"/></svg>
  </button>`;
}

async function initBackgroundMusic() {
  if (document.getElementById('bgMusicAudio')) return; // already initialized (shouldn't happen, but be safe)
  let settings;
  try {
    const res = await fetch('/api/site-music');
    settings = await res.json();
  } catch (e) {
    return;
  }
  if (!settings || !settings.enabled || !settings.url) return;

  const audio = document.createElement('audio');
  audio.id = 'bgMusicAudio';
  audio.src = settings.url;
  audio.loop = !!settings.loop;
  audio.volume = typeof settings.volume === 'number' ? settings.volume : 0.5;
  audio.style.display = 'none';
  document.body.appendChild(audio);

  document.body.insertAdjacentHTML('beforeend', buildMusicToggleButton());
  const btn = document.getElementById('musicToggleBtn');
  const iconOn = document.getElementById('musicIconOn');
  const iconOff = document.getElementById('musicIconOff');
  btn.style.display = 'flex';

  const savedTime = parseFloat(sessionStorage.getItem(MUSIC_TIME_KEY) || '0');
  if (savedTime > 0 && isFinite(savedTime)) {
    audio.addEventListener('loadedmetadata', () => {
      if (savedTime < audio.duration) audio.currentTime = savedTime;
    }, { once: true });
  }

  function setUIPlaying(isPlaying) {
    iconOn.style.display = isPlaying ? 'block' : 'none';
    iconOff.style.display = isPlaying ? 'none' : 'block';
    btn.classList.toggle('is-playing', isPlaying);
  }

  function tryPlay() {
    const p = audio.play();
    if (p && p.catch) {
      p.then(() => {
        sessionStorage.setItem(MUSIC_STATE_KEY, '1');
        setUIPlaying(true);
      }).catch(() => {
        // Autoplay blocked by the browser — leave it paused, visitor can tap to start.
        setUIPlaying(false);
      });
    }
  }

  // Resume automatically only if the visitor previously turned it on
  // themselves this session, or the admin explicitly enabled autoplay.
  const shouldTryAutoResume = sessionStorage.getItem(MUSIC_STATE_KEY) === '1' || settings.autoplay;
  if (shouldTryAutoResume) {
    tryPlay();
  } else {
    setUIPlaying(false);
  }

  btn.addEventListener('click', () => {
    if (audio.paused) {
      tryPlay();
    } else {
      audio.pause();
      sessionStorage.setItem(MUSIC_STATE_KEY, '0');
      setUIPlaying(false);
    }
  });

  audio.addEventListener('play', () => setUIPlaying(true));
  audio.addEventListener('pause', () => setUIPlaying(false));

  // Periodically remember playback position so navigating to another
  // page can pick up roughly where the visitor left off.
  setInterval(() => {
    if (!audio.paused) sessionStorage.setItem(MUSIC_TIME_KEY, String(audio.currentTime));
  }, 2000);
  window.addEventListener('beforeunload', () => {
    sessionStorage.setItem(MUSIC_TIME_KEY, String(audio.currentTime));
  });
}

document.addEventListener('DOMContentLoaded', initSiteChrome);
