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
  wirePaymentSettingsForm();
  wireMusicForms();
  wireFlashSaleForm();
  wireBlogForm();
  wireLogout();
  document.getElementById('adminSearch').addEventListener('input', renderProductTable);
  document.getElementById('orderStatusFilter').addEventListener('change', renderOrdersTable);

  refreshOrdersBadge();
  setInterval(refreshOrdersBadge, 20000);
}

function wireNav() {
  document.querySelectorAll('.admin-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.admin-view').forEach(v => v.style.display = 'none');
      document.getElementById(`view-${btn.dataset.view}`).style.display = 'block';
      document.getElementById('adminViewTitle').textContent = btn.dataset.title || btn.textContent;
      if (btn.dataset.view === 'orders') loadOrders();
      if (btn.dataset.view === 'messages') loadMessages();
      if (btn.dataset.view === 'add' && !editingId) resetProductForm();
      if (btn.dataset.view === 'contactinfo') loadContactInfo();
      if (btn.dataset.view === 'payment') loadPaymentSettings();
      if (btn.dataset.view === 'music') loadMusicSettings();
      if (btn.dataset.view === 'flashsale') loadFlashSaleAdmin();
      if (btn.dataset.view === 'blog') loadBlogAdmin();
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
  document.getElementById('existingDescriptionImages').innerHTML = '';
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

  const existingDescWrap = document.getElementById('existingDescriptionImages');
  const descImages = p.descriptionImages || (p.descriptionImage ? [p.descriptionImage] : []);
  existingDescWrap.innerHTML = descImages.map(img => `
    <div class="thumb-wrap" data-img="${img}">
      <img src="${img}">
      <button type="button" class="remove-img" title="Remove image">×</button>
    </div>
  `).join('');
  existingDescWrap.querySelectorAll('.remove-img').forEach(btn => {
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

      const keptDesc = Array.from(document.querySelectorAll('#existingDescriptionImages .thumb-wrap')).map(el => el.dataset.img);
      const originalDescImages = original.descriptionImages || (original.descriptionImage ? [original.descriptionImage] : []);
      const removedDesc = originalDescImages.filter(img => !keptDesc.includes(img));
      formData.set('removeDescriptionImages', JSON.stringify(removedDesc));
    }

    const url = editingId ? `/api/products/${editingId}` : '/api/products';
    const method = editingId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, { method, body: formData });
      const result = await res.json();
      if (!res.ok) { setFormAlert(result.error || 'Failed to save product.', 'error'); return; }
      setFormAlert(result.message, 'success');
      if (result.product) {
    if (editingId) {
        const index = allProducts.findIndex(p => p.id === editingId);
        if (index !== -1) allProducts[index] = result.product;
    } else {
        allProducts.unshift(result.product);
    }

    renderProductTable();
}
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
//  ORDERS (admin notification panel — replaces email alerts)
// =====================================================
let allOrders = [];

async function refreshOrdersBadge() {
  try {
    const res = await fetch('/api/orders/unseen-count');
    if (!res.ok) return;
    const { count } = await res.json();
    const badge = document.getElementById('ordersNavBadge');
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  } catch (e) { /* ignore — badge just won't update this round */ }
}

async function loadOrders() {
  try {
    const res = await fetch('/api/orders');
    allOrders = await res.json();
    renderOrdersTable();
    refreshOrdersBadge();
  } catch (e) { console.error(e); }
}

function orderStatusLabel(status) {
  return {
    pending: 'Chờ xác nhận',
    confirmed: 'Đã xác nhận',
    shipped: 'Đang giao',
    completed: 'Hoàn tất',
    cancelled: 'Đã hủy'
  }[status] || status;
}

function paymentMethodLabel(method) {
  return {
    cod: 'COD',
    cash: 'Tiền mặt tại cửa hàng',
    qr: 'QR - Sacombank'
  }[method] || method;
}

function renderOrdersTable() {
  const filter = document.getElementById('orderStatusFilter').value;
  const filtered = filter === 'all' ? allOrders : allOrders.filter(o => o.status === filter);
  const newCount = allOrders.filter(o => !o.seenByAdmin).length;
  document.getElementById('orderCount').textContent = `${filtered.length} orders${newCount ? ` (${newCount} new)` : ''}`;

  const tbody = document.getElementById('ordersTableBody');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-faint);padding:32px;">No orders yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(o => `
    <tr class="order-row ${!o.seenByAdmin ? 'is-new' : ''}">
      <td>${!o.seenByAdmin ? '<span class="new-order-dot"></span>' : ''}#${o.code}</td>
      <td>${o.customer.name}<br><span style="color:var(--text-faint);font-size:0.78rem;">${o.customer.phone}</span></td>
      <td>${o.items.reduce((s, i) => s + i.qty, 0)} sản phẩm</td>
      <td>${formatVND(o.total)}</td>
      <td>${paymentMethodLabel(o.payment)}</td>
      <td><span class="order-status-badge order-status-${o.status}">${orderStatusLabel(o.status)}</span></td>
      <td>${new Date(o.createdAt).toLocaleString('vi-VN')}</td>
      <td><div class="admin-actions"><button data-view-order="${o.id}">View</button></div></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-view-order]').forEach(btn => {
    btn.addEventListener('click', () => openOrderModal(btn.dataset.viewOrder));
  });
}

async function openOrderModal(id) {
  const order = allOrders.find(o => o.id === id);
  if (!order) return;

  if (!order.seenByAdmin) {
    try {
      await fetch(`/api/orders/${id}/seen`, { method: 'PUT' });
      order.seenByAdmin = true;
      renderOrdersTable();
      refreshOrdersBadge();
    } catch (e) { /* non-fatal */ }
  }

  const deliveryHtml = order.delivery.method === 'pickup'
    ? `<p>Nhận tại cửa hàng — 32 Đồng Xoài, Tân Bình, TP. Hồ Chí Minh</p>`
    : `<p>${order.delivery.address}<br>${order.delivery.ward}<br>${order.delivery.country}</p>`;

  const invoiceHtml = order.invoice && order.invoice.requested
    ? `<div class="modal-section"><h4>Hoá đơn điện tử</h4>
        <p>Công ty: <strong>${order.invoice.company || '—'}</strong></p>
        <p>MST: <strong>${order.invoice.taxCode || '—'}</strong></p>
        <p>Email nhận hoá đơn: <strong>${order.invoice.email || '—'}</strong></p>
      </div>`
    : '';

  const itemsRows = order.items.map(i => `
    <tr>
      <td>${i.name}</td>
      <td style="text-align:center;">${i.qty}</td>
      <td style="text-align:right;">${formatVND(i.price)}</td>
      <td style="text-align:right;">${formatVND(i.price * i.qty)}</td>
    </tr>`).join('');

  const root = document.getElementById('orderModalRoot');
  root.innerHTML = `
    <div class="modal-backdrop" id="orderModalBackdrop">
      <div class="modal-box">
        <button class="modal-close" id="orderModalClose">${ICONS.close}</button>
        <h2>Đơn hàng #${order.code}</h2>
        <div class="modal-sub">Đặt lúc ${new Date(order.createdAt).toLocaleString('vi-VN')}</div>

        <div class="modal-section">
          <h4>Khách hàng</h4>
          <p><strong>${order.customer.name}</strong></p>
          <p>Điện thoại: ${order.customer.phone}</p>
          <p>Email: ${order.customer.email || '—'}</p>
        </div>

        <div class="modal-section">
          <h4>${order.delivery.method === 'pickup' ? 'Nhận tại cửa hàng' : 'Giao tận nơi'}</h4>
          ${deliveryHtml}
        </div>

        <div class="modal-section">
          <h4>Thanh toán</h4>
          <p>${paymentMethodLabel(order.payment)}</p>
          ${order.note ? `<p>Ghi chú: ${order.note}</p>` : ''}
        </div>

        ${invoiceHtml}

        <div class="modal-section">
          <h4>Sản phẩm</h4>
          <table class="modal-items">
            <thead><tr><th>Tên</th><th style="text-align:center;">SL</th><th style="text-align:right;">Giá</th><th style="text-align:right;">Thành tiền</th></tr></thead>
            <tbody>${itemsRows}</tbody>
          </table>
          <div class="modal-totals">
            Tổng tiền hàng: ${formatVND(order.subtotal)}<br>
            Phí vận chuyển: ${order.shipping ? formatVND(order.shipping) : 'Miễn phí'}<br>
            ${order.discount ? `Giảm giá${order.promoCode ? ` (${order.promoCode})` : ''}: -${formatVND(order.discount)}<br>` : ''}
            <span class="grand">Tổng thanh toán: ${formatVND(order.total)}</span>
          </div>
        </div>

        <div class="modal-section">
          <h4>Trạng thái đơn hàng</h4>
          <div class="modal-status-row">
            <select class="status-select" id="orderStatusSelect">
              <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Chờ xác nhận</option>
              <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Đã xác nhận</option>
              <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Đang giao</option>
              <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Hoàn tất</option>
              <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Đã hủy</option>
            </select>
            <button class="btn btn-primary btn-sm" id="saveOrderStatusBtn">Cập nhật trạng thái</button>
          </div>
        </div>
      </div>
    </div>`;

  const close = () => { root.innerHTML = ''; };
  document.getElementById('orderModalClose').addEventListener('click', close);
  document.getElementById('orderModalBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'orderModalBackdrop') close();
  });
  document.getElementById('saveOrderStatusBtn').addEventListener('click', async () => {
    const status = document.getElementById('orderStatusSelect').value;
    try {
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const result = await res.json();
      if (!res.ok) { showToast(result.error || 'Cập nhật thất bại.', 'error'); return; }
      order.status = status;
      showToast('Đã cập nhật trạng thái đơn hàng.', 'success');
      renderOrdersTable();
      close();
    } catch (e) {
      showToast('Có lỗi xảy ra, vui lòng thử lại.', 'error');
    }
  });
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
  if (type === 'address') return 'Address';
  return 'Other';
}

// Toggle the map-link field and adjust the value field's placeholder/label
// so the form makes sense for whichever contact-info type is selected.
function updateContactInfoFormForType(type) {
  const mapField = document.getElementById('ci_map_field');
  const valueLabel = document.getElementById('ci_value_label');
  const valueInput = document.getElementById('ci_value');
  const isAddress = type === 'address';
  mapField.style.display = isAddress ? 'block' : 'none';
  if (isAddress) {
    valueLabel.textContent = 'Value * (shop address shown on the Contact page)';
    valueInput.placeholder = 'e.g. 32 Đồng Xoài, Phường Tân Bình, TP. Hồ Chí Minh';
  } else {
    valueLabel.textContent = 'Value * (phone number, Zalo number/link, email address, etc.)';
    valueInput.placeholder = 'e.g. 0365244436';
  }
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
  updateContactInfoFormForType(document.getElementById('ci_type').value);
}

function editContactInfo(id) {
  const entry = allContactInfo.find(e => e.id === id);
  if (!entry) return;
  editingContactInfoId = id;
  document.getElementById('ci_id').value = entry.id;
  document.getElementById('ci_type').value = entry.type;
  document.getElementById('ci_label').value = entry.label || '';
  document.getElementById('ci_value').value = entry.value;
  document.getElementById('ci_map').value = entry.mapUrl || '';
  updateContactInfoFormForType(entry.type);
  document.getElementById('cancelContactInfoEditBtn').style.display = 'inline-flex';
  document.getElementById('saveContactInfoBtn').textContent = 'Update Contact Info';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function wireContactInfoForm() {
  document.getElementById('cancelContactInfoEditBtn').addEventListener('click', resetContactInfoForm);
  document.getElementById('ci_type').addEventListener('change', (e) => updateContactInfoFormForType(e.target.value));
  updateContactInfoFormForType(document.getElementById('ci_type').value);

  document.getElementById('contactInfoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      type: document.getElementById('ci_type').value,
      label: document.getElementById('ci_label').value.trim(),
      value: document.getElementById('ci_value').value.trim(),
      mapUrl: document.getElementById('ci_map').value.trim()
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

// =====================================================
//  PAYMENT SETTINGS
// =====================================================
let currentPaymentSettings = null;

async function loadPaymentSettings() {
  try {
    const res = await fetch('/api/payment-settings');
    currentPaymentSettings = await res.json();
    renderPaymentSettings();
  } catch (e) { console.error(e); }
}

function renderPaymentSettings() {
  const s = currentPaymentSettings;
  if (!s) return;
  document.getElementById('pay_bankName').value = s.bankName || '';
  document.getElementById('pay_accountName').value = s.accountName || '';
  document.getElementById('pay_accountNumber').value = s.accountNumber || '';
  document.getElementById('pay_transferNote').value = s.transferNote || '';
  document.getElementById('pay_qrImageUrl').value = s.qrImageUrl || '';
}

function wirePaymentSettingsForm() {
  document.getElementById('paymentSettingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      bankName: document.getElementById('pay_bankName').value.trim(),
      accountName: document.getElementById('pay_accountName').value.trim(),
      accountNumber: document.getElementById('pay_accountNumber').value.trim(),
      transferNote: document.getElementById('pay_transferNote').value.trim(),
      qrImageUrl: document.getElementById('pay_qrImageUrl').value.trim()
    };
    const btn = document.getElementById('savePaymentBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';
    try {
      const res = await fetch('/api/payment-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (!res.ok) { setAlertBox('paymentAlert', result.error || 'Failed to save.', 'error'); return; }
      currentPaymentSettings = result.settings;
      renderPaymentSettings();
      setAlertBox('paymentAlert', result.message, 'success');
    } catch (err) {
      setAlertBox('paymentAlert', 'Something went wrong while saving.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Payment Settings';
    }
  });
}

// =====================================================
//  BACKGROUND MUSIC
// =====================================================
let currentMusicSettings = null;

async function loadMusicSettings() {
  try {
    const res = await fetch('/api/site-music');
    currentMusicSettings = await res.json();
    renderMusicSettings();
  } catch (e) { console.error(e); }
}

function renderMusicSettings() {
  const s = currentMusicSettings;
  if (!s) return;

  const infoEl = document.getElementById('currentTrackInfo');
  const previewEl = document.getElementById('musicPreviewPlayer');
  if (s.url) {
    infoEl.textContent = s.originalName || s.url;
    previewEl.src = s.url;
    previewEl.style.display = 'block';
  } else {
    infoEl.textContent = 'No track uploaded yet.';
    previewEl.removeAttribute('src');
    previewEl.style.display = 'none';
  }

  document.getElementById('m_enabled').checked = !!s.enabled;
  document.getElementById('m_autoplay').checked = !!s.autoplay;
  document.getElementById('m_loop').checked = !!s.loop;
  const volPct = Math.round((typeof s.volume === 'number' ? s.volume : 0.5) * 100);
  document.getElementById('m_volume').value = volPct;
  document.getElementById('m_volumeLabel').textContent = `${volPct}%`;
}

function wireMusicForms() {
  document.getElementById('m_volume').addEventListener('input', (e) => {
    document.getElementById('m_volumeLabel').textContent = `${e.target.value}%`;
  });

  document.getElementById('musicUploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('f_musicTrack');
    if (!fileInput.files.length) return;
    const formData = new FormData();
    formData.append('track', fileInput.files[0]);

    const btn = document.getElementById('uploadMusicBtn');
    btn.disabled = true;
    btn.textContent = 'Uploading...';
    try {
      const res = await fetch('/api/site-music/upload', { method: 'POST', body: formData });
      const result = await res.json();
      if (!res.ok) { setAlertBox('musicAlert', result.error || 'Upload failed.', 'error'); return; }
      currentMusicSettings = result.settings;
      renderMusicSettings();
      fileInput.value = '';
      setAlertBox('musicAlert', result.message, 'success');
    } catch (err) {
      setAlertBox('musicAlert', 'Something went wrong while uploading.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Upload Track';
    }
  });

  document.getElementById('removeMusicBtn').addEventListener('click', async () => {
    if (!currentMusicSettings || !currentMusicSettings.url) {
      setAlertBox('musicAlert', 'There is no track to remove.', 'error');
      return;
    }
    if (!confirm('Remove the current background track? This cannot be undone.')) return;
    try {
      const res = await fetch('/api/site-music', { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) { setAlertBox('musicAlert', result.error || 'Failed to remove track.', 'error'); return; }
      currentMusicSettings = result.settings;
      renderMusicSettings();
      setAlertBox('musicAlert', result.message, 'success');
    } catch (err) {
      setAlertBox('musicAlert', 'Something went wrong.', 'error');
    }
  });

  document.getElementById('musicSettingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      enabled: document.getElementById('m_enabled').checked,
      autoplay: document.getElementById('m_autoplay').checked,
      loop: document.getElementById('m_loop').checked,
      volume: Number(document.getElementById('m_volume').value) / 100
    };
    try {
      const res = await fetch('/api/site-music', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (!res.ok) { setAlertBox('musicAlert', result.error || 'Failed to save.', 'error'); return; }
      currentMusicSettings = result.settings;
      renderMusicSettings();
      setAlertBox('musicAlert', result.message, 'success');
    } catch (err) {
      setAlertBox('musicAlert', 'Something went wrong while saving.', 'error');
    }
  });
}

// =====================================================
//  FLASH SALE
// =====================================================
let currentFlashSale = null;
let fsSelectedIds = new Set();

function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function loadFlashSaleAdmin() {
  try {
    if (!allProducts.length) await loadProducts();
    const res = await fetch('/api/flash-sale');
    currentFlashSale = await res.json();
    fsSelectedIds = new Set(currentFlashSale.productIds || []);

    document.getElementById('fs_title').value = currentFlashSale.title || '';
    document.getElementById('fs_enabled').checked = !!currentFlashSale.enabled;
    document.getElementById('fs_startAt').value = toDatetimeLocalValue(currentFlashSale.startAt);
    document.getElementById('fs_endAt').value = toDatetimeLocalValue(currentFlashSale.endAt);

    renderFsProductList();
  } catch (e) { console.error(e); }
}

function renderFsProductList() {
  const query = (document.getElementById('fs_productSearch').value || '').toLowerCase();
  const list = document.getElementById('fs_productList');
  const filtered = allProducts.filter(p => p.name.toLowerCase().includes(query));

  if (!filtered.length) {
    list.innerHTML = `<div class="admin-help" style="padding:12px;">No products found.</div>`;
  } else {
    list.innerHTML = filtered.map(p => `
      <label class="fs-product-row">
        <input type="checkbox" data-fs-id="${p.id}" ${fsSelectedIds.has(p.id) ? 'checked' : ''}>
        ${p.images && p.images[0] ? `<img src="${p.images[0]}">` : `<div style="width:34px;height:34px;background:var(--surface);border-radius:6px;flex-shrink:0;"></div>`}
        <span class="fs-p-name">${p.name}</span>
        <span class="fs-p-price">${formatVND(p.price)}</span>
      </label>
    `).join('');
    list.querySelectorAll('[data-fs-id]').forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.checked) fsSelectedIds.add(cb.dataset.fsId);
        else fsSelectedIds.delete(cb.dataset.fsId);
        updateFsSelectedCount();
      });
    });
  }
  updateFsSelectedCount();
}

function updateFsSelectedCount() {
  document.getElementById('fs_selectedCount').textContent = `${fsSelectedIds.size} product(s) selected`;
}

function wireFlashSaleForm() {
  document.getElementById('fs_productSearch').addEventListener('input', renderFsProductList);

  document.getElementById('flashSaleForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const startVal = document.getElementById('fs_startAt').value;
    const endVal = document.getElementById('fs_endAt').value;
    const payload = {
      title: document.getElementById('fs_title').value.trim() || 'FLASH SALE',
      enabled: document.getElementById('fs_enabled').checked,
      startAt: startVal ? new Date(startVal).toISOString() : null,
      endAt: endVal ? new Date(endVal).toISOString() : null,
      productIds: Array.from(fsSelectedIds)
    };
    try {
      const res = await fetch('/api/flash-sale', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (!res.ok) { setAlertBox('flashSaleAlert', result.error || 'Failed to save.', 'error'); return; }
      setAlertBox('flashSaleAlert', result.message || 'Flash sale saved.', 'success');
    } catch (err) {
      setAlertBox('flashSaleAlert', 'Something went wrong while saving.', 'error');
    }
  });
}

// =====================================================
//  BLOG / NEWS
// =====================================================
let allBlogPosts = [];
let editingBlogId = null;

async function loadBlogAdmin() {
  try {
    const res = await fetch('/api/blog/all');
    allBlogPosts = await res.json();
    renderBlogTable();
  } catch (e) { console.error(e); }
}

function renderBlogTable() {
  const tbody = document.getElementById('blogTableBody');
  if (!allBlogPosts.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-faint);padding:32px;">No posts yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = allBlogPosts.map(p => `
    <tr>
      <td>${p.coverImage ? `<img class="admin-thumb" src="${p.coverImage}">` : `<div class="admin-thumb"></div>`}</td>
      <td>${p.title}</td>
      <td>${p.category || '—'}</td>
      <td>${p.publishedAt ? new Date(p.publishedAt).toLocaleDateString('en-GB') : '—'}</td>
      <td>
        <div class="admin-actions">
          <button data-blog-edit="${p.id}">Edit</button>
          <button data-blog-delete="${p.id}" class="delete-btn">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
  tbody.querySelectorAll('[data-blog-edit]').forEach(btn => btn.addEventListener('click', () => editBlogPost(btn.dataset.blogEdit)));
  tbody.querySelectorAll('[data-blog-delete]').forEach(btn => btn.addEventListener('click', () => deleteBlogPost(btn.dataset.blogDelete)));
}

function resetBlogForm() {
  editingBlogId = null;
  document.getElementById('blogForm').reset();
  document.getElementById('blogId').value = '';
  document.getElementById('bg_author').value = 'wfigure';
  document.getElementById('bg_category').value = 'News';
  document.getElementById('bg_existingCover').innerHTML = '';
  document.getElementById('cancelBlogEditBtn').style.display = 'none';
  document.getElementById('saveBlogBtn').textContent = 'Publish Post';
  clearAlert('blogAlert');
}

function editBlogPost(id) {
  const p = allBlogPosts.find(x => x.id === id);
  if (!p) return;
  editingBlogId = id;
  document.getElementById('blogId').value = id;
  document.getElementById('bg_title').value = p.title;
  document.getElementById('bg_category').value = p.category || '';
  document.getElementById('bg_slug').value = p.slug || '';
  document.getElementById('bg_author').value = p.author || '';
  document.getElementById('bg_excerpt').value = p.excerpt || '';
  document.getElementById('bg_content').value = p.content || '';

  const existingWrap = document.getElementById('bg_existingCover');
  existingWrap.innerHTML = p.coverImage ? `
    <div class="thumb-wrap" data-img="${p.coverImage}">
      <img src="${p.coverImage}">
      <button type="button" class="remove-img" title="Remove image">×</button>
    </div>` : '';
  existingWrap.querySelectorAll('.remove-img').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.thumb-wrap').remove());
  });

  document.getElementById('cancelBlogEditBtn').style.display = 'inline-flex';
  document.getElementById('saveBlogBtn').textContent = 'Update Post';
  document.querySelector('.admin-nav-item[data-view="blog"]').click();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function wireBlogForm() {
  document.getElementById('cancelBlogEditBtn').addEventListener('click', resetBlogForm);

  document.getElementById('blogForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.set('title', document.getElementById('bg_title').value.trim());
    formData.set('category', document.getElementById('bg_category').value.trim() || 'News');
    formData.set('slug', document.getElementById('bg_slug').value.trim());
    formData.set('author', document.getElementById('bg_author').value.trim());
    formData.set('excerpt', document.getElementById('bg_excerpt').value.trim());
    formData.set('content', document.getElementById('bg_content').value);

    const fileInput = document.getElementById('bg_coverImage');
    if (fileInput.files.length) formData.set('coverImage', fileInput.files[0]);

    if (editingBlogId) {
      const stillHasCover = document.querySelector('#bg_existingCover .thumb-wrap');
      const original = allBlogPosts.find(p => p.id === editingBlogId);
      if (original && original.coverImage && !stillHasCover && !fileInput.files.length) {
        formData.set('removeCoverImage', 'true');
      }
    }

    const url = editingBlogId ? `/api/blog/${editingBlogId}` : '/api/blog';
    const method = editingBlogId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, { method, body: formData });
      const result = await res.json();
      if (!res.ok) { setAlertBox('blogAlert', result.error || 'Failed to save post.', 'error'); return; }
      setAlertBox('blogAlert', result.message, 'success');
      await loadBlogAdmin();
      resetBlogForm();
    } catch (err) {
      setAlertBox('blogAlert', 'Something went wrong while saving.', 'error');
    }
  });
}

async function deleteBlogPost(id) {
  const post = allBlogPosts.find(p => p.id === id);
  if (!confirm(`Delete "${post ? post.title : 'this post'}"? This cannot be undone.`)) return;
  try {
    const res = await fetch(`/api/blog/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (!res.ok) { showToast(result.error || 'Failed to delete.', 'error'); return; }
    showToast('Post deleted.', 'success');
    await loadBlogAdmin();
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
