let allProducts = [];
let categoryOptions = [];
let editingId = null;

async function checkAdminAccess() {
  try {
    const res = await fetch('/api/me');
    if (res.ok) {
      const data = await res.json();
      if (data.user.role === 'admin') {
        document.getElementById('adminGate').style.display = 'none';
        document.getElementById('adminApp').style.display = 'flex';
        initAdmin();
        return;
      }
    }
  } catch (e) { /* fall through */ }
  window.location.href = '/login.html';
}

function initAdmin() {
  wireNav();
  loadCategoryOptions();
  loadProducts();
  wireProductForm();
  wireBulkImport();
  wireContactInfoForm();
  wireLogout();
  document.getElementById('adminSearch').addEventListener('input', renderProductTable);
}

function wireNav() {
  document.querySelectorAll('.admin-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.admin-view').forEach(v => v.style.display = 'none');
      document.getElementById(`view-${btn.dataset.view}`).style.display = 'block';
      document.getElementById('adminViewTitle').textContent = btn.textContent;
      if (btn.dataset.view === 'messages') loadMessages();
      if (btn.dataset.view === 'add' && !editingId) resetProductForm();
      if (btn.dataset.view === 'contactinfo') loadContactInfo();
    });
  });
}

async function loadCategoryOptions() {
  try {
    const res = await fetch('/api/categories');
    const data = await res.json();
    const opts = [];
    data.menu.forEach(item => {
      if (item.type === 'mega') {
        item.columns.forEach(col => {
          col.links.filter(l => l.kind === 'category').forEach(l => opts.push({ value: l.value, label: l.label }));
        });
      } else {
        opts.push({ value: item.id, label: item.label });
      }
    });
    categoryOptions = opts;
    const select = document.getElementById('f_category');
    select.innerHTML = opts.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
  } catch (e) { console.error(e); }
}

async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    allProducts = await res.json();
    renderProductTable();
  } catch (e) { console.error(e); }
}

function renderProductTable() {
  const query = (document.getElementById('adminSearch').value || '').toLowerCase();
  const filtered = allProducts.filter(p => p.name.toLowerCase().includes(query));
  document.getElementById('productCount').textContent = `${filtered.length} products`;
  const tbody = document.getElementById('productTableBody');

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-faint);padding:32px;">No products found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(p => `
    <tr>
      <td>${p.images && p.images[0] ? `<img class="admin-thumb" src="${p.images[0]}">` : `<div class="admin-thumb"></div>`}</td>
      <td>${p.name}</td>
      <td>${p.category}</td>
      <td>${p.brand || '—'}</td>
      <td>${formatVND(p.price)}</td>
      <td><span class="status-tag status-${p.status}" style="position:static;">${statusLabel(p.status)}</span></td>
      <td>
        <div class="admin-actions">
          <button data-edit="${p.id}">Edit</button>
          <button data-delete="${p.id}" class="delete-btn">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => editProduct(btn.dataset.edit)));
  tbody.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', () => deleteProduct(btn.dataset.delete)));
}

function resetProductForm() {
  editingId = null;
  document.getElementById('productForm').reset();
  document.getElementById('productId').value = '';
  document.getElementById('existingImages').innerHTML = '';
  document.getElementById('cancelEditBtn').style.display = 'none';
  document.getElementById('saveProductBtn').textContent = 'Save Product';
  clearAlert('productFormAlert');
}

function editProduct(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  editingId = id;
  document.getElementById('productId').value = id;
  document.getElementById('f_name').value = p.name;
  document.getElementById('f_category').value = p.category;
  document.getElementById('f_brand').value = p.brand || '';
  document.getElementById('f_series').value = p.series || '';
  document.getElementById('f_character').value = p.character || '';
  document.getElementById('f_status').value = p.status;
  document.getElementById('f_price').value = p.price;
  document.getElementById('f_oldPrice').value = p.oldPrice || '';
  document.getElementById('f_featured').checked = !!p.featured;
  document.getElementById('f_description').value = p.description || '';

  const existingWrap = document.getElementById('existingImages');
  existingWrap.innerHTML = (p.images || []).map(img => `
    <div class="thumb-wrap" data-img="${img}">
      <img src="${img}">
      <button type="button" class="remove-img" title="Remove image">×</button>
    </div>
  `).join('');
  existingWrap.querySelectorAll('.remove-img').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.thumb-wrap').remove());
  });

  document.getElementById('cancelEditBtn').style.display = 'inline-flex';
  document.getElementById('saveProductBtn').textContent = 'Update Product';

  document.querySelector('.admin-nav-item[data-view="add"]').click();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function wireProductForm() {
  document.getElementById('cancelEditBtn').addEventListener('click', resetProductForm);

  document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    formData.set('featured', document.getElementById('f_featured').checked ? 'true' : 'false');

    if (editingId) {
      const kept = Array.from(document.querySelectorAll('#existingImages .thumb-wrap')).map(el => el.dataset.img);
      const original = allProducts.find(p => p.id === editingId);
      const removed = (original.images || []).filter(img => !kept.includes(img));
      formData.set('removeImages', JSON.stringify(removed));
    }

    const url = editingId ? `/api/products/${editingId}` : '/api/products';
    const method = editingId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, { method, body: formData });
      const result = await res.json();
      if (!res.ok) { setFormAlert(result.error || 'Failed to save product.', 'error'); return; }
      setFormAlert(result.message, 'success');
      await loadProducts();
      setTimeout(() => {
        resetProductForm();
        document.querySelector('.admin-nav-item[data-view="products"]').click();
      }, 800);
    } catch (err) {
      setFormAlert('Something went wrong while saving.', 'error');
    }
  });
}

async function deleteProduct(id) {
  const p = allProducts.find(x => x.id === id);
  if (!confirm(`Delete "${p ? p.name : 'this product'}"? This cannot be undone.`)) return;
  try {
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (!res.ok) { showToast(result.error || 'Failed to delete.', 'error'); return; }
    showToast('Product deleted.', 'success');
    await loadProducts();
  } catch (e) {
    showToast('Something went wrong.', 'error');
  }
}

function wireBulkImport() {
  document.getElementById('bulkImportBtn').addEventListener('click', async () => {
    const raw = document.getElementById('bulkJson').value.trim();
    if (!raw) { setAlertBox('bulkAlert', 'Paste a JSON array first.', 'error'); return; }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      setAlertBox('bulkAlert', 'Invalid JSON — please check formatting.', 'error');
      return;
    }
    try {
      const res = await fetch('/api/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed)
      });
      const result = await res.json();
      if (!res.ok) { setAlertBox('bulkAlert', result.error || 'Import failed.', 'error'); return; }
      setAlertBox('bulkAlert', result.message, 'success');
      document.getElementById('bulkJson').value = '';
      await loadProducts();
    } catch (e) {
      setAlertBox('bulkAlert', 'Something went wrong during import.', 'error');
    }
  });
}

async function loadMessages() {
  try {
    const res = await fetch('/api/contact');
    const messages = await res.json();
    const tbody = document.getElementById('messagesTableBody');
    if (!messages.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-faint);padding:32px;">No messages yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = messages.slice().reverse().map(m => `
      <tr>
        <td>${m.name}</td>
        <td>${m.email}</td>
        <td>${m.phone || '—'}</td>
        <td style="max-width:320px;">${m.message}</td>
        <td>${new Date(m.createdAt).toLocaleString('en-GB')}</td>
      </tr>
    `).join('');
  } catch (e) { console.error(e); }
}

// =====================================================
//  CONTACT INFO (phone / Zalo / email shown in the site footer)
// =====================================================
let allContactInfo = [];
let editingContactInfoId = null;

async function loadContactInfo() {
  try {
    const res = await fetch('/api/contact-info');
    allContactInfo = await res.json();
    renderContactInfoTable();
  } catch (e) { console.error(e); }
}

function contactInfoTypeLabel(type) {
  if (type === 'phone') return 'Phone';
  if (type === 'zalo') return 'Zalo';
  if (type === 'email') return 'Email';
  return 'Other';
}

function renderContactInfoTable() {
  const tbody = document.getElementById('contactInfoTableBody');
  if (!allContactInfo.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-faint);padding:32px;">No contact info yet — add one above.</td></tr>`;
    return;
  }
  tbody.innerHTML = allContactInfo.map(entry => `
    <tr>
      <td>${contactInfoTypeLabel(entry.type)}</td>
      <td>${entry.label || '—'}</td>
      <td>${entry.value}</td>
      <td>
        <div class="admin-actions">
          <button data-edit="${entry.id}">Edit</button>
          <button data-delete="${entry.id}" class="delete-btn">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
  tbody.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => editContactInfo(btn.dataset.edit)));
  tbody.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', () => deleteContactInfo(btn.dataset.delete)));
}

function resetContactInfoForm() {
  editingContactInfoId = null;
  document.getElementById('contactInfoForm').reset();
  document.getElementById('ci_id').value = '';
  document.getElementById('cancelContactInfoEditBtn').style.display = 'none';
  document.getElementById('saveContactInfoBtn').textContent = 'Add Contact Info';
  clearAlert('contactInfoAlert');
}

function editContactInfo(id) {
  const entry = allContactInfo.find(e => e.id === id);
  if (!entry) return;
  editingContactInfoId = id;
  document.getElementById('ci_id').value = entry.id;
  document.getElementById('ci_type').value = entry.type;
  document.getElementById('ci_label').value = entry.label || '';
  document.getElementById('ci_value').value = entry.value;
  document.getElementById('cancelContactInfoEditBtn').style.display = 'inline-flex';
  document.getElementById('saveContactInfoBtn').textContent = 'Update Contact Info';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function wireContactInfoForm() {
  document.getElementById('cancelContactInfoEditBtn').addEventListener('click', resetContactInfoForm);

  document.getElementById('contactInfoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      type: document.getElementById('ci_type').value,
      label: document.getElementById('ci_label').value.trim(),
      value: document.getElementById('ci_value').value.trim()
    };
    const url = editingContactInfoId ? `/api/contact-info/${editingContactInfoId}` : '/api/contact-info';
    const method = editingContactInfoId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (!res.ok) { setAlertBox('contactInfoAlert', result.error || 'Failed to save.', 'error'); return; }
      setAlertBox('contactInfoAlert', result.message, 'success');
      await loadContactInfo();
      resetContactInfoForm();
    } catch (err) {
      setAlertBox('contactInfoAlert', 'Something went wrong while saving.', 'error');
    }
  });
}

async function deleteContactInfo(id) {
  const entry = allContactInfo.find(e => e.id === id);
  if (!confirm(`Delete "${entry ? entry.value : 'this entry'}"? This cannot be undone.`)) return;
  try {
    const res = await fetch(`/api/contact-info/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (!res.ok) { showToast(result.error || 'Failed to delete.', 'error'); return; }
    showToast('Contact info deleted.', 'success');
    await loadContactInfo();
  } catch (e) {
    showToast('Something went wrong.', 'error');
  }
}

function wireLogout() {
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login.html';
  });
}

function setFormAlert(msg, type) { setAlertBox('productFormAlert', msg, type); }
function setAlertBox(id, msg, type) {
  const box = document.getElementById(id);
  box.textContent = msg;
  box.className = `alert alert-${type} show`;
}
function clearAlert(id) {
  const box = document.getElementById(id);
  box.className = 'alert';
}

document.addEventListener('DOMContentLoaded', checkAdminAccess);
