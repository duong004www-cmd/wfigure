/* ============================================================
   wfigure — "Edit Website" visual editor
   Only ever loaded for a logged-in admin visiting a storefront
   page with ?edit=1 (see maybeInitEditWebsiteMode in common.js).
   Reuses applyOverrideToElement/applySiteContentToDOM from common.js.
============================================================ */
(function () {
  let draftDoc = { elements: {} };
  let selectedId = null;
  let copied = null;          // { sourceId }
  let history = [];           // stack of deep-cloned elements maps (undo)
  let dragState = null;       // active drag/resize info
  let saveTimer = null;
  let dirty = false;

  const $ = (sel, root) => (root || document).querySelector(sel);
  const byEditId = (id) => document.querySelector(`[data-edit-id="${id}"]`);

  const IMAGE_MAX_BYTES = 8 * 1024 * 1024; // 8MB — must match multer's limits.fileSize in server.js

  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

  // Basic client-side sanity check before we even hit the network —
  // catches the common mistakes (wrong file type, huge screenshots)
  // with an instant, specific message instead of a generic server error.
  // Kept intentionally as permissive as the server's own fileFilter
  // (any image/* mimetype) so we never block something the server would
  // actually accept.
  function validateImageFile(file) {
    if (!file) return 'No file selected.';
    if (!file.type || !file.type.startsWith('image/')) return 'That file doesn\'t look like an image.';
    if (file.size > IMAGE_MAX_BYTES) {
      return `Image is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max size is ${IMAGE_MAX_BYTES / (1024 * 1024)}MB.`;
    }
    return null;
  }

  // Shared upload helper used by both the toolbar "+ Image" flow and the
  // per-element "replace image" field in the properties panel, so both
  // paths get identical validation, progress feedback, and error handling.
  async function uploadImageFile(file, { onProgress } = {}) {
    const problem = validateImageFile(file);
    if (problem) { toast(problem); return null; }
    const fd = new FormData();
    fd.append('image', file);
    setStatus('Uploading image…');
    if (onProgress) onProgress(true);
    try {
      const res = await fetch('/api/site-content/upload-image', { method: 'POST', body: fd });
      let data = null;
      try { data = await res.json(); } catch (parseErr) { /* server returned a non-JSON error page */ }
      if (!res.ok || !data || !data.url) {
        const msg = (data && data.error) ? data.error : `Upload failed (HTTP ${res.status})`;
        setStatus('Upload failed');
        toast(`Could not upload image: ${msg}`);
        return null;
      }
      return data.url;
    } catch (networkErr) {
      setStatus('Upload failed');
      toast('Could not upload image: network/connection error.');
      return null;
    } finally {
      if (onProgress) onProgress(false);
    }
  }

  function getOverride(id) {
    if (!draftDoc.elements[id]) {
      const el = byEditId(id);
      draftDoc.elements[id] = {
        type: el ? (el.dataset.editType || 'block') : 'block',
        hidden: false, locked: false, offsetX: 0, offsetY: 0, width: null, height: null
      };
    }
    return draftDoc.elements[id];
  }

  function pushHistory() {
    history.push(clone(draftDoc.elements));
    if (history.length > 50) history.shift();
  }

  function undo() {
    if (!history.length) { toast('Nothing to undo.'); return; }
    draftDoc.elements = history.pop();
    rerender();
    scheduleSave(true);
    toast('Undone.');
  }

  function rerender() {
    applySiteContentToDOM(draftDoc);
    if (selectedId && byEditId(selectedId)) {
      highlightSelection();
    } else {
      selectedId = null;
      clearOverlays();
    }
    refreshHiddenCount();
  }

  function scheduleSave(immediate) {
    dirty = true;
    setStatus('Saving…');
    clearTimeout(saveTimer);
    const run = () => {
      fetch('/api/site-content/draft', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elements: draftDoc.elements })
      }).then(() => { dirty = false; setStatus('Draft saved'); })
        .catch(() => setStatus('Could not save draft — check connection'));
    };
    if (immediate) run(); else saveTimer = setTimeout(run, 500);
  }

  function setStatus(text) {
    const el = document.getElementById('ewStatus');
    if (el) el.textContent = text;
  }

  function toast(msg) {
    let t = document.getElementById('ewToast');
    if (!t) { t = document.createElement('div'); t.id = 'ewToast'; t.className = 'ew-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  // ---------------------------------------------------------
  // Toolbar
  // ---------------------------------------------------------
  function buildToolbar() {
    const bar = document.createElement('div');
    bar.id = 'ewToolbar';
    bar.innerHTML = `
      <span class="ew-brand">✏️ Edit Website</span>
      <button id="ewAddText" title="Drop a new text box anywhere on the page">+ Text</button>
      <button id="ewAddImage" title="Drop a new image anywhere on the page (you can also drag &amp; drop or paste an image onto the page)">+ Image</button>
      <input type="file" id="ewAddImageInput" accept="image/*" style="display:none">
      <button id="ewUndo" title="Undo (Ctrl+Z)">↶ Undo</button>
      <button id="ewHiddenBtn" title="Show hidden elements">Hidden (<span id="ewHiddenCount">0</span>)</button>
      <button id="ewHistoryBtn" title="Version history">History</button>
      <span class="ew-status" id="ewStatus">Loading…</span>
      <button id="ewDiscard" class="ew-danger">Discard changes</button>
      <button id="ewPublish" class="ew-primary" title="Make changes live for visitors">Save (Publish)</button>
      <button id="ewExit">Exit</button>
    `;
    document.body.appendChild(bar);
    document.body.classList.add('editmode-active');

    $('#ewUndo').addEventListener('click', undo);
    $('#ewAddText').addEventListener('click', addTextElement);
    $('#ewAddImage').addEventListener('click', () => $('#ewAddImageInput').click());
    $('#ewAddImageInput').addEventListener('change', addImageElement);
    $('#ewExit').addEventListener('click', () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('edit');
      window.location.href = url.pathname + (url.search || '');
    });
    $('#ewDiscard').addEventListener('click', async () => {
      if (!confirm('Discard all unpublished draft changes and revert to the last published version?')) return;
      const res = await fetch('/api/site-content/discard', { method: 'POST' });
      const data = await res.json();
      draftDoc = data.doc;
      history = [];
      selectedId = null;
      rerender();
      setStatus('Draft discarded');
      toast('Draft reverted to published version.');
    });
    $('#ewPublish').addEventListener('click', async () => {
      if (!confirm('Publish these changes live for all visitors now?')) return;
      const res = await fetch('/api/site-content/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const data = await res.json();
      setStatus('Live — published just now');
      toast('Changes are now live for all visitors.');
    });
    $('#ewHiddenBtn').addEventListener('click', toggleHiddenDrawer);
    $('#ewHistoryBtn').addEventListener('click', toggleVersionsDrawer);
  }

  // ---------------------------------------------------------
  // Hidden-elements drawer (restore soft-deleted elements)
  // ---------------------------------------------------------
  function buildDrawers() {
    const hidden = document.createElement('div');
    hidden.id = 'ewHidden';
    document.body.appendChild(hidden);
    const versions = document.createElement('div');
    versions.id = 'ewVersions';
    document.body.appendChild(versions);
  }

  function refreshHiddenCount() {
    const n = Object.values(draftDoc.elements).filter(o => o.hidden).length;
    const el = document.getElementById('ewHiddenCount');
    if (el) el.textContent = String(n);
  }

  function toggleHiddenDrawer() {
    const panel = document.getElementById('ewHidden');
    const versions = document.getElementById('ewVersions');
    versions.classList.remove('open');
    const btn = document.getElementById('ewHiddenBtn');
    const rect = btn.getBoundingClientRect();
    panel.style.left = rect.left + 'px';
    const items = Object.entries(draftDoc.elements).filter(([, o]) => o.hidden);
    panel.innerHTML = items.length ? items.map(([id]) => {
      const el = byEditId(id);
      const label = (el && el.dataset.editLabel) || id;
      return `<div class="ew-hidden-row"><span>${label}</span><button data-restore="${id}">Restore</button></div>`;
    }).join('') : `<div class="ew-empty">No deleted elements.</div>`;
    panel.querySelectorAll('[data-restore]').forEach(btn => {
      btn.addEventListener('click', () => {
        pushHistory();
        draftDoc.elements[btn.dataset.restore].hidden = false;
        rerender();
        scheduleSave();
        toggleHiddenDrawer();
      });
    });
    panel.classList.toggle('open');
  }

  async function toggleVersionsDrawer() {
    const panel = document.getElementById('ewVersions');
    const hidden = document.getElementById('ewHidden');
    hidden.classList.remove('open');
    if (panel.classList.contains('open')) { panel.classList.remove('open'); return; }
    const btn = document.getElementById('ewHistoryBtn');
    const rect = btn.getBoundingClientRect();
    panel.style.left = rect.left + 'px';
    panel.innerHTML = `<div class="ew-empty">Loading…</div>`;
    panel.classList.add('open');
    const res = await fetch('/api/site-content/versions');
    const versions = await res.json();
    panel.innerHTML = versions.length ? versions.map(v => `
      <div class="ew-version">
        <div class="ew-v-date">${new Date(v.savedAt).toLocaleString()}</div>
        <div>${v.label || 'Published snapshot'}</div>
        <button data-restore-v="${v.id}">Restore into draft</button>
      </div>
    `).join('') : `<div class="ew-empty">No previous versions yet — versions are created every time you publish.</div>`;
    panel.querySelectorAll('[data-restore-v]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const res = await fetch(`/api/site-content/restore/${btn.dataset.restoreV}`, { method: 'POST' });
        const data = await res.json();
        draftDoc = data.doc;
        history = [];
        rerender();
        panel.classList.remove('open');
        toast('Version restored into draft. Press "Save (Publish)" to make it live.');
      });
    });
  }

  // ---------------------------------------------------------
  // Selection overlay (tag label + resize handles)
  // ---------------------------------------------------------
  function clearOverlays() {
    document.querySelectorAll('.ew-tag, .ew-handle').forEach(n => n.remove());
    document.querySelectorAll('.ew-selected').forEach(n => n.classList.remove('ew-selected'));
  }

  function highlightSelection() {
    clearOverlays();
    const el = byEditId(selectedId);
    if (!el) return;
    el.classList.add('ew-selected');
    const ov = getOverride(selectedId);
    const rect = el.getBoundingClientRect();

    const tag = document.createElement('div');
    tag.className = 'ew-tag' + (ov.locked ? ' locked' : '');
    tag.style.left = rect.left + window.scrollX + 'px';
    tag.style.top = rect.top + window.scrollY + 'px';
    tag.textContent = (el.dataset.editLabel || selectedId) + (ov.locked ? ' 🔒' : '') + ' — drag to move, corners/edge to resize';
    document.body.appendChild(tag);

    if (!ov.locked) {
      ['nw', 'ne', 'sw', 'se', 'e'].forEach(corner => {
        const h = document.createElement('div');
        h.className = `ew-handle ${corner}`;
        positionHandle(h, corner, rect);
        h.addEventListener('mousedown', (e) => startResize(e, corner));
        document.body.appendChild(h);
      });
    }
  }

  function positionHandle(h, corner, rect) {
    let x, y;
    if (corner.length === 1) {
      // Edge handle (currently just 'e' — right side only): centered
      // along the perpendicular axis instead of pinned to a corner.
      if (corner === 'e') { x = rect.right; y = rect.top + rect.height / 2; }
      else if (corner === 'w') { x = rect.left; y = rect.top + rect.height / 2; }
      else if (corner === 'n') { x = rect.left + rect.width / 2; y = rect.top; }
      else { x = rect.left + rect.width / 2; y = rect.bottom; }
    } else {
      x = corner.includes('w') ? rect.left : rect.right;
      y = corner.includes('n') ? rect.top : rect.bottom;
    }
    h.style.left = (x + window.scrollX - 5) + 'px';
    h.style.top = (y + window.scrollY - 5) + 'px';
  }

  // ---------------------------------------------------------
  // Select / open properties panel
  // ---------------------------------------------------------
  function selectElement(el) {
    selectedId = el.dataset.editId;
    highlightSelection();
  }

  function openPanel(el) {
    selectElement(el);
    const id = el.dataset.editId;
    const ov = getOverride(id);
    let panel = document.getElementById('ewPanel');
    if (!panel) { panel = document.createElement('div'); panel.id = 'ewPanel'; document.body.appendChild(panel); }

    const isSlideshow = ov.type === 'slideshow';
    const hasImage = !isSlideshow && (ov.type === 'image' || ov.type === 'new-image' || el.tagName === 'IMG' || !!el.querySelector('img'));
    const isText = ov.type === 'text' || ov.type === 'new-text';
    const free = isFreeType(ov.type);
    const posX = free ? (ov.x || 0) : (ov.offsetX || 0);
    const posY = free ? (ov.y || 0) : (ov.offsetY || 0);

    panel.innerHTML = `
      <button class="ew-close" id="ewPanelClose">✕</button>
      <h3>${el.dataset.editLabel || id}</h3>
      <div class="ew-sub">${ov.locked ? '🔒 Locked — unlock to make changes' : 'Editing this element'}</div>

      ${isText ? `<label>Text</label><textarea id="ewFText" ${ov.locked ? 'disabled' : ''}>${escapeHtml(ov.text != null ? ov.text : el.textContent.trim())}</textarea>` : ''}

      ${hasImage ? `<label>Image</label>
        <input type="file" id="ewFImage" accept="image/*" ${ov.locked ? 'disabled' : ''}>
        <div class="ew-hint">Uploading replaces the current image immediately in the draft preview.</div>` : ''}

      ${isSlideshow ? `<label>Slideshow images</label>
        <div id="ewSlideList" class="ew-slide-list">
          ${(ov.images && ov.images.length) ? ov.images.map((src, i) => `
            <div class="ew-slide-item" data-idx="${i}">
              <img src="${src}" alt="">
              <div class="ew-slide-item-actions">
                <button type="button" class="ew-slide-up" ${(i === 0 || ov.locked) ? 'disabled' : ''} title="Move earlier">↑</button>
                <button type="button" class="ew-slide-down" ${(i === ov.images.length - 1 || ov.locked) ? 'disabled' : ''} title="Move later">↓</button>
                <button type="button" class="ew-slide-remove" ${ov.locked ? 'disabled' : ''} title="Remove">✕</button>
              </div>
            </div>`).join('') : '<div class="ew-hint">No images yet — add one below.</div>'}
        </div>
        <input type="file" id="ewSlideAdd" accept="image/*" ${ov.locked ? 'disabled' : ''}>
        <div class="ew-hint">Adds a new image to the end of the rotation. Needs at least 2 images to rotate — with just 1, it's shown as a static image.</div>

        <label>Transition time (seconds)</label>
        <input type="number" id="ewSlideInterval" min="1" step="0.5" value="${((ov.intervalMs || 3000) / 1000)}" ${ov.locked ? 'disabled' : ''}>
        <div class="ew-hint">How long each image stays on screen before sliding to the next.</div>` : ''}

      <label>${free ? 'Position on page (px)' : 'Position offset (px)'}</label>
      <div class="ew-row">
        <div><input type="number" id="ewOffX" value="${posX}" ${ov.locked ? 'disabled' : ''}></div>
        <div><input type="number" id="ewOffY" value="${posY}" ${ov.locked ? 'disabled' : ''}></div>
      </div>
      <div class="ew-hint">You can also just drag the element on the page.</div>

      <label>Size override (px, blank = auto)</label>
      <div class="ew-row">
        <div><input type="number" id="ewW" value="${ov.width || ''}" placeholder="width" ${ov.locked ? 'disabled' : ''}></div>
        <div><input type="number" id="ewH" value="${ov.height || ''}" placeholder="height" ${ov.locked ? 'disabled' : ''}></div>
      </div>

      <div class="ew-actions">
        <button id="ewLockToggle">${ov.locked ? '🔓 Unlock element' : '🔒 Lock element (prevent drag/resize)'}</button>
        <button id="ewDuplicate" ${ov.locked ? 'disabled' : ''}>⧉ Duplicate (Ctrl+C / Ctrl+V)</button>
        <button id="ewResetPos" ${ov.locked ? 'disabled' : ''}>↺ Reset position &amp; size</button>
        <button id="ewDelete" class="ew-danger" ${ov.locked ? 'disabled' : ''}>🗑 Delete (Del key)</button>
      </div>
    `;
    panel.classList.add('open');

    $('#ewPanelClose').addEventListener('click', () => panel.classList.remove('open'));

    if (isText) {
      $('#ewFText').addEventListener('input', (e) => {
        pushHistoryOnce(id, 'text');
        getOverride(id).text = e.target.value;
        applyOverrideToElement(el, getOverride(id));
        scheduleSave();
      });
    }
    if (hasImage) {
      $('#ewFImage').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const input = e.target;
        input.disabled = true;
        pushHistory();
        const url = await uploadImageFile(file);
        input.disabled = false;
        input.value = '';
        if (!url) return;
        const ovv = getOverride(id);
        ovv.type = ovv.type === 'text' ? ovv.type : (ovv.type || 'image');
        ovv.image = url;
        applyOverrideToElement(el, ovv);
        scheduleSave();
        setStatus('Draft saved');
        toast('Image updated in draft.');
      });
    }
    if (isSlideshow) {
      if (!Array.isArray(ov.images)) ov.images = [];
      $('#ewSlideAdd').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const input = e.target;
        input.disabled = true;
        pushHistory();
        const url = await uploadImageFile(file);
        input.disabled = false;
        input.value = '';
        if (!url) return;
        const ovv = getOverride(id);
        ovv.type = 'slideshow';
        if (!Array.isArray(ovv.images)) ovv.images = [];
        ovv.images.push(url);
        rerender();
        scheduleSave();
        toast('Image added to the slideshow.');
        openPanel(byEditId(id));
      });
      $('#ewSlideInterval').addEventListener('change', (e) => {
        if (ov.locked) return;
        pushHistory();
        const secs = parseFloat(e.target.value);
        getOverride(id).intervalMs = Math.max(1000, Math.round((isNaN(secs) ? 3 : secs) * 1000));
        rerender();
        scheduleSave();
      });
      panel.querySelectorAll('.ew-slide-up').forEach((btn) => btn.addEventListener('click', () => {
        if (ov.locked) return;
        const i = parseInt(btn.closest('.ew-slide-item').dataset.idx, 10);
        pushHistory();
        const arr = getOverride(id).images;
        [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
        rerender(); scheduleSave(); openPanel(byEditId(id));
      }));
      panel.querySelectorAll('.ew-slide-down').forEach((btn) => btn.addEventListener('click', () => {
        if (ov.locked) return;
        const i = parseInt(btn.closest('.ew-slide-item').dataset.idx, 10);
        pushHistory();
        const arr = getOverride(id).images;
        [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
        rerender(); scheduleSave(); openPanel(byEditId(id));
      }));
      panel.querySelectorAll('.ew-slide-remove').forEach((btn) => btn.addEventListener('click', () => {
        if (ov.locked) return;
        const i = parseInt(btn.closest('.ew-slide-item').dataset.idx, 10);
        pushHistory();
        getOverride(id).images.splice(i, 1);
        rerender(); scheduleSave(); openPanel(byEditId(id));
      }));
    }
    $('#ewOffX').addEventListener('change', (e) => { pushHistory(); const v = parseInt(e.target.value, 10) || 0; if (free) getOverride(id).x = v; else getOverride(id).offsetX = v; rerender(); scheduleSave(); });
    $('#ewOffY').addEventListener('change', (e) => { pushHistory(); const v = parseInt(e.target.value, 10) || 0; if (free) getOverride(id).y = v; else getOverride(id).offsetY = v; rerender(); scheduleSave(); });
    $('#ewW').addEventListener('change', (e) => { pushHistory(); getOverride(id).width = e.target.value ? parseInt(e.target.value, 10) : null; rerender(); scheduleSave(); });
    $('#ewH').addEventListener('change', (e) => { pushHistory(); getOverride(id).height = e.target.value ? parseInt(e.target.value, 10) : null; rerender(); scheduleSave(); });

    $('#ewLockToggle').addEventListener('click', () => {
      pushHistory();
      const ovv = getOverride(id);
      ovv.locked = !ovv.locked;
      rerender();
      scheduleSave();
      openPanel(byEditId(id));
    });
    $('#ewResetPos').addEventListener('click', () => {
      pushHistory();
      const ovv = getOverride(id);
      if (isFreeType(ovv.type)) {
        const pos = dropPosition();
        ovv.x = pos.x; ovv.y = pos.y;
      } else {
        ovv.offsetX = 0; ovv.offsetY = 0;
      }
      ovv.width = null; ovv.height = null;
      rerender();
      scheduleSave();
      openPanel(byEditId(id));
    });
    $('#ewDuplicate').addEventListener('click', () => duplicateElement(id));
    $('#ewDelete').addEventListener('click', () => { deleteSelected(id); panel.classList.remove('open'); });
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Avoid spamming history on every keystroke of a textarea — only push
  // once per "burst" of edits to a given field.
  let lastHistoryKey = null;
  function pushHistoryOnce(id, field) {
    const key = id + ':' + field;
    if (lastHistoryKey !== key) { pushHistory(); lastHistoryKey = key; }
  }

  function isFreeType(t) { return t === 'new-text' || t === 'new-image'; }

  function dropPosition() {
    // Places new elements just under the page header, roughly centered
    // horizontally, within whatever part of the page is currently in view.
    // (Previously this used a flat "+90px", which is only enough to clear
    // the 52px admin toolbar — not the real site header, which is much
    // taller. New images/text were landing underneath the header and
    // appearing invisible, even though the upload/creation worked fine.)
    const header = document.querySelector('.site-header');
    const headerBottom = header ? header.getBoundingClientRect().bottom : 90;
    return {
      x: Math.round(window.scrollX + Math.max(20, (window.innerWidth - 240) / 2)),
      y: Math.round(window.scrollY + Math.max(90, headerBottom + 20))
    };
  }

  function addTextElement() {
    const id = 'custom.text.' + Date.now();
    const pos = dropPosition();
    pushHistory();
    draftDoc.elements[id] = {
      type: 'new-text', text: 'New text — double-click to edit',
      x: pos.x, y: pos.y, width: null, height: null, fontSize: 16,
      hidden: false, locked: false
    };
    rerender();
    scheduleSave();
    const el = byEditId(id);
    if (el) openPanel(el);
    toast('Text box added — drag it into place.');
  }

  let addImageInFlight = false;

  // file: optional File (used when called from drag-drop/paste instead of
  // the hidden <input>). pos: optional {x,y} drop point (e.g. cursor
  // position on drop) — falls back to the default under-header placement.
  async function addImageElement(e, file, pos) {
    if (e && e.target) {
      file = file || e.target.files[0];
      e.target.value = '';
    }
    if (!file) return;
    if (addImageInFlight) { toast('Still uploading the previous image — one moment.'); return; }
    addImageInFlight = true;
    const addBtn = document.getElementById('ewAddImage');
    if (addBtn) addBtn.disabled = true;

    const url = await uploadImageFile(file);

    if (addBtn) addBtn.disabled = false;
    addImageInFlight = false;
    if (!url) return;

    const dropPos = pos || dropPosition();
    const id = 'custom.image.' + Date.now();
    pushHistory();
    draftDoc.elements[id] = {
      type: 'new-image', image: url,
      x: dropPos.x, y: dropPos.y, width: 240, height: null,
      hidden: false, locked: false
    };
    rerender();
    scheduleSave();
    setStatus('Draft saved');
    const el = byEditId(id);
    if (el) openPanel(el);
    toast('Image added — drag it into place.');
  }


  function duplicateElement(sourceId) {
    const src = getOverride(sourceId);
    pushHistory();
    let newId;
    if (isFreeType(src.type)) {
      newId = (src.type === 'new-image' ? 'custom.image.' : 'custom.text.') + Date.now();
      draftDoc.elements[newId] = Object.assign(clone(src), { x: (src.x || 0) + 24, y: (src.y || 0) + 24 });
    } else {
      const templateId = src.type === 'clone' ? src.cloneOf : sourceId;
      newId = templateId + '__clone_' + Date.now();
      draftDoc.elements[newId] = {
        type: 'clone', cloneOf: templateId,
        offsetX: (src.offsetX || 0) + 24, offsetY: (src.offsetY || 0) + 24,
        width: src.width || null, height: src.height || null,
        hidden: false, locked: false
      };
    }
    rerender();
    const el = byEditId(newId);
    if (el) selectElement(el);
    scheduleSave();
    toast('Element duplicated.');
  }

  function deleteSelected(id) {
    const ov = getOverride(id);
    if (ov.locked) { toast('This element is locked — unlock it first.'); return; }
    pushHistory();
    if (ov.type === 'clone' || isFreeType(ov.type)) {
      delete draftDoc.elements[id];
    } else {
      ov.hidden = true;
    }
    selectedId = null;
    rerender();
    scheduleSave();
    toast(isFreeType(ov.type) || ov.type === 'clone'
      ? 'Deleted (undo with Ctrl+Z).'
      : 'Deleted (undo with Ctrl+Z, or restore from the Hidden list).');
  }

  // ---------------------------------------------------------
  // Drag to reposition
  // ---------------------------------------------------------
  function startDrag(e, el) {
    const id = el.dataset.editId;
    const ov = getOverride(id);
    if (ov.locked) return;
    e.preventDefault();
    pushHistory();
    // Belt-and-braces: browsers treat <img> (and elements containing one)
    // as natively draggable, and that native "drag the image out" gesture
    // can steal the mousemove sequence mid-drag — this is what caused
    // horizontal moves to misbehave while vertical ones still worked.
    // Force it off on whatever we're about to drag, for the duration of
    // the drag, regardless of element type.
    el.setAttribute('draggable', 'false');
    const img = el.tagName === 'IMG' ? el : el.querySelector('img');
    if (img) img.setAttribute('draggable', 'false');
    const free = isFreeType(ov.type);
    dragState = {
      id, startX: e.clientX, startY: e.clientY,
      baseX: free ? (ov.x || 0) : (ov.offsetX || 0),
      baseY: free ? (ov.y || 0) : (ov.offsetY || 0),
      free, mode: 'move'
    };
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
  }

  function startResize(e, corner) {
    e.preventDefault();
    e.stopPropagation();
    const id = selectedId;
    const el = byEditId(id);
    const ov = getOverride(id);
    if (ov.locked || !el) return;
    pushHistory();
    const rect = el.getBoundingClientRect();
    dragState = {
      id, corner, startX: e.clientX, startY: e.clientY,
      startW: rect.width, startH: rect.height, mode: 'resize'
    };
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
  }

  function onDragMove(e) {
    if (!dragState) return;
    const el = byEditId(dragState.id);
    if (!el) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    const ov = getOverride(dragState.id);
    if (dragState.mode === 'move') {
      if (dragState.free) {
        ov.x = dragState.baseX + dx;
        ov.y = dragState.baseY + dy;
        el.style.left = ov.x + 'px';
        el.style.top = ov.y + 'px';
      } else {
        ov.offsetX = dragState.baseX + dx;
        ov.offsetY = dragState.baseY + dy;
        el.style.transform = `translate(${ov.offsetX}px, ${ov.offsetY}px)`;
      }
    } else {
      let w = dragState.startW, h = dragState.startH;
      if (dragState.corner.includes('e')) w = Math.max(20, dragState.startW + dx);
      if (dragState.corner.includes('w')) w = Math.max(20, dragState.startW - dx);
      if (dragState.corner.includes('s')) h = Math.max(20, dragState.startH + dy);
      if (dragState.corner.includes('n')) h = Math.max(20, dragState.startH - dy);
      ov.width = Math.round(w); ov.height = Math.round(h);
      el.style.width = ov.width + 'px'; el.style.height = ov.height + 'px';
    }
    highlightSelection();
  }

  function onDragEnd() {
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);
    if (dragState) { scheduleSave(); }
    dragState = null;
  }

  // ---------------------------------------------------------
  // Global listeners
  // ---------------------------------------------------------
  function wireGlobalEvents() {
    document.addEventListener('click', (e) => {
      if (e.target.closest('#ewToolbar, #ewPanel, #ewHidden, #ewVersions')) return;
      const el = e.target.closest('[data-edit-id]');
      if (!el) {
        selectedId = null; clearOverlays();
        return;
      }
      e.preventDefault(); e.stopPropagation();
      selectElement(el);
    }, true);

    document.addEventListener('dblclick', (e) => {
      if (e.target.closest('#ewToolbar, #ewPanel, #ewHidden, #ewVersions')) return;
      const el = e.target.closest('[data-edit-id]');
      if (!el) return;
      e.preventDefault(); e.stopPropagation();
      openPanel(el);
    }, true);

    document.addEventListener('mousedown', (e) => {
      if (e.target.closest('#ewToolbar, #ewPanel, #ewHidden, #ewVersions, .ew-handle')) return;
      const el = e.target.closest('[data-edit-id]');
      if (!el || el.dataset.editId !== selectedId) return;
      startDrag(e, el);
    });

    // Hard block on the browser's native "drag this image out" gesture
    // anywhere inside an editable element. Without this, dragging an
    // <img> can be silently taken over by native drag-and-drop partway
    // through the gesture — the symptom is that horizontal movement
    // stops responding while vertical still does, since the browser's
    // drag-threshold detection is direction-sensitive.
    document.addEventListener('dragstart', (e) => {
      if (e.target.closest('[data-edit-id], #ewFreeLayer')) e.preventDefault();
    }, true);

    // Drag an image file from the desktop straight onto the page to add it,
    // as an alternative to the "+ Image" button/file-picker flow.
    let dragDepth = 0;
    document.addEventListener('dragenter', (e) => {
      if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
      e.preventDefault();
      dragDepth++;
      document.body.classList.add('ew-dragover');
    });
    document.addEventListener('dragover', (e) => {
      if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    document.addEventListener('dragleave', () => {
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) document.body.classList.remove('ew-dragover');
    });
    document.addEventListener('drop', (e) => {
      if (!e.dataTransfer) return;
      const file = Array.from(e.dataTransfer.files || []).find(f => f.type.startsWith('image/'));
      dragDepth = 0;
      document.body.classList.remove('ew-dragover');
      if (!file) return;
      e.preventDefault();
      addImageElement(null, file, { x: Math.round(e.pageX - 60), y: Math.round(e.pageY - 20) });
    });

    // Paste (Ctrl+V) an image from the clipboard to add it, as long as
    // focus isn't in a text field (where paste should behave normally).
    document.addEventListener('paste', (e) => {
      const typing = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
      if (typing || !e.clipboardData) return;
      const item = Array.from(e.clipboardData.items || []).find(i => i.type.startsWith('image/'));
      if (!item) return;
      e.preventDefault();
      addImageElement(null, item.getAsFile(), dropPosition());
    });

    window.addEventListener('scroll', () => { if (selectedId) highlightSelection(); }, true);
    window.addEventListener('resize', () => { if (selectedId) highlightSelection(); });

    document.addEventListener('keydown', (e) => {
      const typing = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
      if (typing) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) { e.preventDefault(); deleteSelected(selectedId); return; }
      if (ctrl && e.key.toLowerCase() === 'c' && selectedId) { copied = { sourceId: selectedId }; toast('Copied. Press Ctrl+V to paste a duplicate.'); return; }
      if (ctrl && e.key.toLowerCase() === 'v' && copied) { duplicateElement(copied.sourceId); return; }
    });

    window.addEventListener('beforeunload', (e) => {
      if (dirty) { e.preventDefault(); e.returnValue = ''; }
    });
  }

  // ---------------------------------------------------------
  // Init
  // ---------------------------------------------------------
  async function init() {
    buildToolbar();
    buildDrawers();
    wireGlobalEvents();
    const res = await fetch('/api/site-content?mode=draft');
    draftDoc = await res.json();
    if (!draftDoc.elements) draftDoc.elements = {};
    rerender();
    setStatus('Draft loaded — click any highlighted element to select it, double-click to edit');
  }

  init();
})();
