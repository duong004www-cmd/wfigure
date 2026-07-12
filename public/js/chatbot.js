/* ============================================================
   wfigure — AI chat assistant widget
   Two mount points, sharing the same conversation + logic:
   - Embedded: a full-size box in #aiChatWidget (currently only on
     contact.html), always visible.
   - Floating: a bubble button (added into the site-wide floating
     contact stack by common.js, id #fcAiToggle) that opens/closes a
     small panel in #aiFloatingPanel — present on every customer page.
   Talks to POST /api/chat on the server (see server.js — uses the
   Anthropic API if ANTHROPIC_API_KEY is set, otherwise a built-in
   rule-based assistant, no setup required).
============================================================ */
(function () {
  if (window.__wfigureChatbotLoaded) return;
  window.__wfigureChatbotLoaded = true;

  const STARTER_CHIPS = [
    'Địa chỉ shop ở đâu?',
    'Giờ mở cửa thế nào?',
    'Cho mình gợi ý figure Genshin Impact',
    'Có Nendoroid Hatsune Miku không?'
  ];

  // Shared across both mount points so switching between the embedded
  // box and the floating bubble (e.g. on the contact page) keeps context.
  const history = []; // [{role: 'user'|'assistant', content: string}]

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  const BOT_AVATAR_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';

  function widgetInnerHTML(variant) {
    const closeBtn = variant === 'floating'
      ? `<button type="button" class="ai-chat-close" id="aiChatClose" aria-label="Đóng">&times;</button>`
      : '';
    return `
      <div class="ai-chat-header">
        <div class="ai-chat-avatar">
          ${BOT_AVATAR_SVG}
        </div>
        <div style="flex:1">
          <h3>Trợ lý wfigure</h3>
          <p><span class="dot"></span>Sẵn sàng tư vấn — hỏi về shop hoặc mô tả figure bạn muốn tìm</p>
        </div>
        ${closeBtn}
      </div>
      <div class="ai-chat-log" id="chatLog-${variant}"></div>
      <div class="ai-chat-suggestions" id="chatChips-${variant}"></div>
      <form class="ai-chat-inputbar" id="chatForm-${variant}">
        <input type="text" id="chatInput-${variant}" placeholder="Nhập câu hỏi hoặc mô tả sản phẩm bạn muốn tìm..." autocomplete="off">
        <button type="submit" aria-label="Gửi">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </form>
    `;
  }

  function addMessage(targetLog, role, text) {
    const isUser = role === 'user';
    const row = document.createElement('div');
    row.className = `chat-row ${isUser ? 'user' : 'bot'}`;
    if (!isUser) {
      const avatar = document.createElement('div');
      avatar.className = 'chat-msg-avatar';
      avatar.innerHTML = BOT_AVATAR_SVG;
      row.appendChild(avatar);
    }
    const bubble = document.createElement('div');
    bubble.className = `chat-msg ${isUser ? 'user' : 'bot'}`;
    bubble.innerHTML = escapeHtml(text);
    row.appendChild(bubble);
    targetLog.appendChild(row);
    targetLog.scrollTop = targetLog.scrollHeight;
    return bubble;
  }

  function addProducts(targetLog, products) {
    if (!products || !products.length) return;
    const wrap = document.createElement('div');
    wrap.className = 'chat-products';
    products.forEach(p => {
      const a = document.createElement('a');
      a.className = 'chat-product-card';
      a.href = p.url || `/product.html?id=${p.id}`;
      const statusLabel = p.status === 'pre-order' ? 'Pre-order' : p.status === 'out-of-stock' ? 'Hết hàng' : 'Còn hàng';
      a.innerHTML = `
        <div class="chat-product-thumb" style="${p.image ? `background-image:url('${p.image}')` : ''}">${p.image ? '' : 'IMG'}</div>
        <div class="chat-product-info">
          <div class="cp-name">${escapeHtml(p.name)}</div>
          <div><span class="cp-price">${escapeHtml(p.priceFormatted || '')}</span><span class="cp-status">${statusLabel}</span></div>
        </div>
      `;
      wrap.appendChild(a);
    });
    targetLog.appendChild(wrap);
    targetLog.scrollTop = targetLog.scrollHeight;
  }

  function addTyping(targetLog) {
    const row = document.createElement('div');
    row.className = 'chat-row bot';
    const avatar = document.createElement('div');
    avatar.className = 'chat-msg-avatar';
    avatar.innerHTML = BOT_AVATAR_SVG;
    row.appendChild(avatar);
    const div = document.createElement('div');
    div.className = 'chat-msg bot typing';
    div.innerHTML = '<span></span><span></span><span></span>';
    row.appendChild(div);
    targetLog.appendChild(row);
    targetLog.scrollTop = targetLog.scrollHeight;
    return row;
  }

  // Replays the full shared history into a newly-opened log (so switching
  // from the embedded box to the floating bubble, or vice versa, doesn't
  // lose context) then keeps it in sync for future messages.
  function syncLogFromHistory(targetLog) {
    targetLog.innerHTML = '';
    if (!history.length) {
      addMessage(targetLog, 'bot', 'Chào bạn! Mình là trợ lý AI của wfigure 👋 Mình có thể cho bạn biết địa chỉ, giờ mở cửa, cách liên hệ shop, hoặc gợi ý figure theo mô tả bạn đưa ra. Bạn cần giúp gì nào?');
      return;
    }
    history.forEach(h => addMessage(targetLog, h.role === 'user' ? 'user' : 'bot', h.content));
  }

  async function sendMessage(targetLog, inputEl, sendBtn, text) {
    const message = text.trim();
    if (!message) return;

    inputEl.value = '';
    sendBtn.disabled = true;
    addMessage(targetLog, 'user', message);
    history.push({ role: 'user', content: message });
    const typingEl = addTyping(targetLog);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history: history.slice(0, -1) })
      });
      const data = await res.json();
      typingEl.remove();

      if (!res.ok) {
        addMessage(targetLog, 'bot', data.error || 'Xin lỗi, shop đang gặp sự cố. Bạn thử lại sau nhé.');
        return;
      }

      addMessage(targetLog, 'bot', data.reply || 'Xin lỗi, shop chưa có câu trả lời phù hợp.');
      history.push({ role: 'assistant', content: data.reply || '' });
      addProducts(targetLog, data.products);
    } catch (err) {
      typingEl.remove();
      addMessage(targetLog, 'bot', 'Không thể kết nối tới máy chủ. Vui lòng thử lại hoặc gọi hotline 0365 244 436.');
    } finally {
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  function wireWidget(root, variant) {
    const log = root.querySelector(`#chatLog-${variant}`);
    const chipsEl = root.querySelector(`#chatChips-${variant}`);
    const formEl = root.querySelector(`#chatForm-${variant}`);
    const inputEl = root.querySelector(`#chatInput-${variant}`);
    const sendBtn = formEl.querySelector('button');

    chipsEl.innerHTML = '';
    STARTER_CHIPS.forEach(text => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chat-chip';
      btn.textContent = text;
      btn.addEventListener('click', () => sendMessage(log, inputEl, sendBtn, text));
      chipsEl.appendChild(btn);
    });

    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      sendMessage(log, inputEl, sendBtn, inputEl.value);
    });

    syncLogFromHistory(log);
    return { log, inputEl };
  }

  function initEmbedded() {
    const mount = document.getElementById('aiChatWidget');
    if (!mount) return;
    mount.innerHTML = `<div class="ai-chat-widget">${widgetInnerHTML('embed')}</div>`;
    wireWidget(mount, 'embed');
  }

  function initFloating() {
    const toggleBtn = document.getElementById('fcAiToggle');
    const panel = document.getElementById('aiFloatingPanel');
    if (!toggleBtn || !panel) return;

    // Avoid a redundant second chat entry point when the page already has
    // the full embedded widget (contact page) — the bubble still shows
    // as phone/messenger do elsewhere, but here it just scrolls to it.
    if (document.getElementById('aiChatWidget')) {
      toggleBtn.addEventListener('click', () => {
        document.getElementById('aiChatWidget').scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return;
    }

    let built = false;
    toggleBtn.addEventListener('click', () => {
      if (!built) {
        panel.innerHTML = `<div class="ai-chat-widget">${widgetInnerHTML('floating')}</div>`;
        const { inputEl } = wireWidget(panel, 'floating');
        panel.querySelector('#aiChatClose').addEventListener('click', () => closePanel());
        built = true;
        panel.__inputEl = inputEl;
      }
      const isOpen = panel.classList.toggle('open');
      toggleBtn.classList.toggle('active', isOpen);
      if (isOpen && panel.__inputEl) panel.__inputEl.focus();
    });

    function closePanel() {
      panel.classList.remove('open');
      toggleBtn.classList.remove('active');
    }

    document.addEventListener('click', (e) => {
      if (!panel.classList.contains('open')) return;
      if (panel.contains(e.target) || toggleBtn.contains(e.target)) return;
      closePanel();
    });
  }

  function wireFloatingWhenReady() {
    if (document.getElementById('fcAiToggle')) {
      initFloating();
    } else {
      document.addEventListener('DOMContentLoaded', initFloating, { once: true });
    }
  }

  initEmbedded();
  wireFloatingWhenReady();
})();
