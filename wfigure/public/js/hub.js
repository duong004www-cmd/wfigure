/* ============================================================
   wfigure — category "hub" pages
   Powers the dedicated landing pages for each top-level mega
   menu entry (Mô hình / Figure, Sản phẩm khác, Đặt trước /
   Order). Each page sets <body data-hub="<category id>">;
   this script reads /api/categories to find that menu entry,
   renders its sub-category groups as quick-filter chips, and
   loads a product grid scoped to the whole hub (or to a single
   chip when one is selected via the URL query string).
============================================================ */

function hubChipHref(hubPage, kind, value) {
  if (!kind || !value) return hubPage;
  const p = new URLSearchParams();
  p.set(kind, value);
  return `${hubPage}?${p.toString()}`;
}

function hubAggregateQuery(hubItem) {
  // The API ANDs together category/brand/series/character/status, which is
  // correct when a single chip sets one of them — but the hub's *default*
  // "show everything" view must OR values within one facet, not AND every
  // facet together (a product rarely matches a curated brand AND series AND
  // character at once). So pick a single primary facet to aggregate on:
  // "category" if this hub groups by category (Mô hình/Figure, Sản phẩm
  // khác), otherwise "status" (Đặt trước/Order, which has no category links).
  const allKinds = new Set();
  (hubItem.columns || []).forEach(col => col.links.forEach(l => {
    if (l.kind !== 'sort') allKinds.add(l.kind);
  }));
  const primaryKind = allKinds.has('category') ? 'category' : (allKinds.has('status') ? 'status' : null);

  const query = new URLSearchParams();
  if (!primaryKind) return query;
  const values = [];
  (hubItem.columns || []).forEach(col => col.links.forEach(l => {
    if (l.kind === primaryKind) values.push(l.value);
  }));
  if (values.length) query.set(primaryKind, values.join(','));
  return query;
}

function hubLinkFor(hubItem, kind, value) {
  for (const col of hubItem.columns || []) {
    for (const l of col.links) {
      if (l.kind === kind && l.value === value) return l;
    }
  }
  return null;
}

async function initHub() {
  const hubId = document.body.dataset.hub;
  if (!hubId) return;

  let data;
  try {
    const res = await fetch('/api/categories');
    data = await res.json();
  } catch (e) {
    console.error('Failed to load categories', e);
    return;
  }
  const hubItem = (data.menu || []).find(m => m.id === hubId);
  if (!hubItem) return;

  const hubPage = hubItem.page || window.location.pathname;
  const params = new URLSearchParams(window.location.search);

  // A "single filter" is any category/brand/series/character/status value
  // in the query string — selecting a chip narrows the page down to just
  // that one sub-category instead of the whole hub.
  const filterKinds = ['category', 'brand', 'series', 'character', 'status'];
  let activeFilter = null;
  for (const k of filterKinds) {
    const v = params.get(k);
    if (v) { activeFilter = hubLinkFor(hubItem, k, v) || { kind: k, value: v, label: v }; break; }
  }
  const activeSort = params.get('sort') || '';
  const activeSortLink = activeSort ? hubLinkFor(hubItem, 'sort', activeSort) : null;

  const displayLabel = (activeFilter && activeFilter.label) || (activeSortLink && activeSortLink.label) || hubItem.label;

  document.title = `${displayLabel} — wfigure`;
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = `${displayLabel} — wfigure`;
  const heroTitle = document.getElementById('hubTitle');
  if (heroTitle) heroTitle.textContent = displayLabel;
  const heroIntro = document.getElementById('hubIntro');
  if (heroIntro && !activeFilter && !activeSortLink) heroIntro.textContent = hubItem.intro || '';
  else if (heroIntro) heroIntro.style.display = 'none';
  const crumb = document.getElementById('hubCrumb');
  if (crumb) crumb.textContent = displayLabel;

  // Quick-filter chip groups
  const groupsEl = document.getElementById('hubGroups');
  if (groupsEl) {
    groupsEl.innerHTML = (hubItem.columns || []).map(col => `
      <div class="hub-group">
        <h4>${col.title}</h4>
        <div class="hub-chip-row">
          ${col.links.map(l => {
            const isActive = (activeFilter && activeFilter.kind === l.kind && activeFilter.value === l.value)
              || (l.kind === 'sort' && activeSort === l.value);
            return `<a class="hub-chip${isActive ? ' active' : ''}" href="${hubChipHref(hubPage, l.kind, l.value)}">${l.label}</a>`;
          }).join('')}
        </div>
      </div>
    `).join('');
  }

  const allChip = document.getElementById('hubAllChip');
  if (allChip) {
    allChip.href = hubPage;
    allChip.classList.toggle('active', !activeFilter && !activeSortLink);
  }

  // Build the product query: a selected chip narrows to just that value,
  // otherwise fall back to every sub-category this hub covers.
  let query;
  if (activeFilter && activeFilter.kind !== 'sort') {
    query = new URLSearchParams();
    query.set(activeFilter.kind, activeFilter.value);
  } else {
    query = hubAggregateQuery(hubItem);
  }
  if (activeSort) query.set('sort', activeSort);

  const sortSelect = document.getElementById('hubSort');
  if (sortSelect) {
    sortSelect.value = activeSort;
    sortSelect.onchange = () => {
      const p = new URLSearchParams(window.location.search);
      if (sortSelect.value) p.set('sort', sortSelect.value); else p.delete('sort');
      window.location.search = p.toString();
    };
  }

  const grid = document.getElementById('hubGrid');
  if (grid) grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">Đang tải sản phẩm…</div>`;

  try {
    const pRes = await fetch(`/api/products?${query.toString()}`);
    const items = await pRes.json();
    if (grid) {
      grid.innerHTML = items.length
        ? items.map(productCardHTML).join('')
        : `<div class="empty-state" style="grid-column:1/-1;">
             <svg viewBox="0 0 24 24" fill="none" stroke-width="1.2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
             <div>Chưa có sản phẩm nào trong mục này.</div>
             <a class="btn btn-outline" style="margin-top:18px;" href="${hubPage}">Xem tất cả ${hubItem.label}</a>
           </div>`;
    }
  } catch (e) {
    console.error(e);
  }
}

document.addEventListener('DOMContentLoaded', initHub);
