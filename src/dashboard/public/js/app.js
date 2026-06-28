(function () {
  const { t, apply: applyI18n, setLang } = window.I18n;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const state = { status: null, settings: null, user: null, currentFile: null, dirty: false };

  function node(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    return tpl.content.firstElementChild;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function formatTime(ts) {
    try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
  }
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  const ICON = {
    check: '<svg viewBox="0 0 24 24" class="ico"><path d="M20 6 9 17l-5-5"/></svg>',
    alert: '<svg viewBox="0 0 24 24" class="ico"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" class="ico"><path d="M12 5v14M5 12h14"/></svg>',
    edit: '<svg viewBox="0 0 24 24" class="ico"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" class="ico"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>',
    download: '<svg viewBox="0 0 24 24" class="ico"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"/></svg>',
    shield: '<svg viewBox="0 0 24 24" class="ico"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>',
    search: '<svg viewBox="0 0 24 24" class="ico"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
    sun: '<svg viewBox="0 0 24 24" class="ico"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" class="ico"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>',
    x: '<svg viewBox="0 0 24 24" class="ico"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    db: '<svg viewBox="0 0 24 24" class="ico"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" class="ico"><path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6"/></svg>',
    save: '<svg viewBox="0 0 24 24" class="ico"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>',
    file: '<svg viewBox="0 0 24 24" class="ico"><path d="M14 3v5h5"/><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-5Z"/></svg>',
  };

  function toast(message, type = 'success') {
    const el = node(`<div class="toast ${type === 'error' ? 'error' : ''}">${type === 'error' ? ICON.alert : ICON.check}<span>${esc(message)}</span></div>`);
    $('#toast-root').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 220); }, 2700);
  }

  function openModal({ title, body, footer, onClose }) {
    const overlay = node('<div class="modal-overlay"></div>');
    const modal = node(`<div class="modal"><div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-x>${ICON.x}</button></div><div class="modal-body"></div><div class="modal-foot"></div></div>`);
    $('.modal-body', modal).appendChild(body);
    if (footer) $('.modal-foot', modal).appendChild(footer);
    else $('.modal-foot', modal).remove();
    overlay.appendChild(modal);
    $('#modal-root').appendChild(overlay);
    const close = () => { overlay.classList.add('out'); setTimeout(() => overlay.remove(), 180); onClose && onClose(); };
    $('[data-x]', modal).addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function esc2(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc2); } });
    return close;
  }

  function confirmDialog(message, danger = true) {
    return new Promise((resolve) => {
      const body = node(`<p style="color:var(--text-dim);line-height:1.55;margin:0">${esc(message)}</p>`);
      const footer = node('<div style="display:flex;gap:.6rem"></div>');
      const cancel = node(`<button class="btn btn-ghost">${esc(t('common.cancel'))}</button>`);
      const ok = node(`<button class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${esc(t('common.confirm'))}</button>`);
      footer.append(cancel, ok);
      const close = openModal({ title: t('common.confirm'), body, footer });
      cancel.addEventListener('click', () => { close(); resolve(false); });
      ok.addEventListener('click', () => { close(); resolve(true); });
    });
  }

  function promptDialog(title, placeholder) {
    return new Promise((resolve) => {
      const body = node(`<label class="field"><input data-in placeholder="${esc(placeholder || '')}" /></label>`);
      const footer = node('<div style="display:flex;gap:.6rem"></div>');
      const cancel = node(`<button class="btn btn-ghost">${esc(t('common.cancel'))}</button>`);
      const ok = node(`<button class="btn btn-primary">${esc(t('common.confirm'))}</button>`);
      footer.append(cancel, ok);
      const close = openModal({ title, body, footer });
      const done = (v) => { close(); resolve(v); };
      cancel.addEventListener('click', () => done(null));
      ok.addEventListener('click', () => done($('[data-in]', body).value.trim()));
      $('[data-in]', body).addEventListener('keydown', (e) => { if (e.key === 'Enter') done($('[data-in]', body).value.trim()); });
      setTimeout(() => $('[data-in]', body).focus(), 50);
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    $$('[data-toggle-theme]').forEach((b) => { b.innerHTML = theme === 'dark' ? ICON.moon : ICON.sun; });
  }
  async function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    if (state.user) { try { await Api.updateSettings({ theme: next }); } catch (e) {} }
  }
  async function toggleLang() {
    const next = I18n.lang === 'en' ? 'tr' : 'en';
    await setLang(next);
    $$('[data-lang-flag]').forEach((e) => (e.textContent = next.toUpperCase()));
    if (state.user) {
      try { await Api.updateSettings({ language: next }); } catch (e) {}
      route();
    } else {
      renderAuth();
    }
  }

  async function boot() {
    const s = await Api.status();
    state.status = s;
    await setLang(s.language || 'en');
    applyTheme(s.theme || 'dark');
    $$('[data-lang-flag]').forEach((e) => (e.textContent = (s.language || 'en').toUpperCase()));
    bindChrome();
    if (!s.setup) return showAuth('setup');
    if (!s.authed) return showAuth('login');
    await enterApp();
  }

  function bindChrome() {
    $$('[data-toggle-theme]').forEach((b) => b.addEventListener('click', toggleTheme));
    $$('[data-toggle-lang]').forEach((b) => b.addEventListener('click', toggleLang));
    $('[data-menu]')?.addEventListener('click', () => $('.sidebar').classList.toggle('open'));
    $('[data-logout]')?.addEventListener('click', async () => { try { await Api.logout(); } catch (e) {} location.reload(); });
    $$('.nav-item[data-route]').forEach((a) => a.addEventListener('click', () => $('.sidebar').classList.remove('open')));
    window.addEventListener('hashchange', route);
  }

  function showAuth(mode) {
    $('#app').classList.add('hidden');
    $('#auth-screen').classList.remove('hidden');
    renderAuth(mode);
  }
  function renderAuth(mode) {
    mode = mode || (state.status && !state.status.setup ? 'setup' : 'login');
    applyI18n($('#auth-screen'));
    $('#setup-form').classList.toggle('hidden', mode !== 'setup');
    $('#login-form').classList.toggle('hidden', mode !== 'login');

    const setupForm = $('#setup-form');
    setupForm.onsubmit = async (e) => {
      e.preventDefault();
      const err = $('[data-error]', setupForm);
      err.textContent = '';
      const u = setupForm.username.value.trim();
      const p = setupForm.password.value;
      const c = setupForm.confirm.value;
      if (p !== c) { err.textContent = t('setup.mismatch'); return; }
      try {
        await Api.setup({ username: u, password: p, company: setupForm.company.value });
        await enterApp();
      } catch (ex) {
        err.textContent = ex.code === 'weak_password' ? t('setup.passwordHint') : ex.code === 'invalid_username' ? t('setup.usernameHint') : t('common.error');
      }
    };

    const loginForm = $('#login-form');
    loginForm.onsubmit = async (e) => {
      e.preventDefault();
      const err = $('[data-error]', loginForm);
      err.textContent = '';
      try {
        await Api.login({ username: loginForm.username.value.trim(), password: loginForm.password.value, company: loginForm.company.value });
        await enterApp();
      } catch (ex) {
        if (ex.code === 'locked') {
          const mins = Math.ceil((ex.data.retryInMs || 0) / 60000);
          err.textContent = t('login.locked', { minutes: mins });
        } else {
          err.textContent = t('login.invalid');
        }
      }
    };
  }

  async function enterApp() {
    state.user = await Api.me();
    $('#auth-screen').classList.add('hidden');
    $('#app').classList.remove('hidden');
    applyI18n($('#app'));
    $('[data-user]').textContent = state.user.username;
    if (!location.hash) location.hash = '#overview';
    route();
  }

  const ROUTES = { overview: renderOverview, data: renderData, transfer: renderTransfer, settings: renderSettings };
  function route() {
    if (!state.user) return;
    const name = (location.hash.replace('#', '') || 'overview');
    const render = ROUTES[name] || renderOverview;
    $$('.nav-item[data-route]').forEach((a) => a.classList.toggle('active', a.getAttribute('data-route') === name));
    $('[data-crumb]').textContent = t('nav.' + name);
    const view = $('#view');
    view.classList.toggle('view-full', name === 'data');
    render();
  }

  function greeting() {
    const h = new Date().getHours();
    if (h < 12) return t('overview.greeting_morning');
    if (h < 18) return t('overview.greeting_afternoon');
    return t('overview.greeting_evening');
  }

  function countUp(el) {
    if (!el) return;
    const target = Number(el.getAttribute('data-count')) || 0;
    if (target === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = target; return; }
    const start = performance.now();
    const dur = 520;
    const step = (now) => {
      const p = Math.min(1, (now - start) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 4)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  async function renderOverview() {
    const view = $('#view');
    view.innerHTML = `<div class="empty">${t('common.loading')}</div>`;
    const s = state.status;
    const readOnly = state.user.readOnly;
    let fileCount = 0, totalSize = 0;
    try { const f = await Api.listFiles(); fileCount = f.files.length; totalSize = f.files.reduce((a, b) => a + b.size, 0); } catch (e) {}

    view.innerHTML = `
      <div class="bento anim-in stagger">
        <section class="hero col-7">
          <div>
            <h2>${esc(greeting())}, ${esc(state.user.username)}</h2>
            <p class="sub">${esc(t('overview.subtitle'))}</p>
          </div>
          <div class="pill-row">
            <span class="badge online"><span class="live-dot"></span> ${esc(t('overview.online'))}</span>
            <span class="badge candy">v${esc(s.version)}</span>
            ${readOnly ? `<span class="badge warn">${esc(t('overview.readOnlyBadge'))}</span>` : ''}
          </div>
        </section>

        <div class="card stat col-5">
          <div>
            <div class="stat-num" data-count="${fileCount}">0</div>
            <div class="stat-label">${esc(t('files.title'))} · ${esc(formatSize(totalSize))}</div>
          </div>
          <dl class="swatch-row">
            <dt>NAME</dt><dd>${esc(s.name)}</dd>
            <dt>VER</dt><dd>${esc(s.version)}</dd>
            <dt>STATUS</dt><dd>${esc(t('overview.online'))}</dd>
          </dl>
        </div>

        <div class="card col-12">
          <h3 class="card-title">${esc(t('overview.quickActions'))}</h3>
          <div class="qa-row">
            <button class="qa" data-qa="add"><span class="qa-ico">${ICON.edit}</span><span><p>${esc(t('overview.addEntry'))}</p><small>${esc(t('files.title'))}</small></span></button>
            <button class="qa" data-qa="export"><span class="qa-ico">${ICON.download}</span><span><p>${esc(t('overview.exportData'))}</p><small>JSON</small></span></button>
            <button class="qa" data-qa="security"><span class="qa-ico">${ICON.shield}</span><span><p>${esc(t('overview.manageSecurity'))}</p><small>${esc(t('nav.settings'))}</small></span></button>
          </div>
        </div>
      </div>`;

    countUp($('[data-count]', view));
    $('[data-qa="add"]').onclick = () => { location.hash = '#data'; };
    $('[data-qa="export"]').onclick = () => downloadExport();
    $('[data-qa="security"]').onclick = () => { location.hash = '#settings'; };
  }

  function highlightJson(code) {
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return escaped.replace(
      /("(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false)\b|\bnull\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (m) => {
        let cls = 'tok-num';
        if (/^"/.test(m)) cls = /:\s*$/.test(m) ? 'tok-key' : 'tok-str';
        else if (/^(true|false)$/.test(m)) cls = 'tok-bool';
        else if (m === 'null') cls = 'tok-null';
        return `<span class="${cls}">${m}</span>`;
      }
    );
  }

  function createCodeEditor(initial, onState) {
    const wrap = node(`
      <div class="code-editor">
        <div class="code-gutter" data-gutter></div>
        <div class="code-scroll">
          <pre class="code-highlight" data-hl aria-hidden="true"><code></code></pre>
          <textarea class="code-input" data-input spellcheck="false" autocapitalize="off" autocomplete="off"></textarea>
        </div>
      </div>`);
    const gutter = $('[data-gutter]', wrap);
    const hl = $('[data-hl] code', wrap);
    const ta = $('[data-input]', wrap);
    ta.value = initial;

    const renderHl = () => {
      hl.innerHTML = highlightJson(ta.value) + '\n';
      const lines = ta.value.split('\n').length;
      let g = '';
      for (let i = 1; i <= lines; i++) g += i + '\n';
      gutter.textContent = g;
    };
    const validate = () => {
      let ok = true;
      try { JSON.parse(ta.value || 'null'); } catch { ok = false; }
      onState && onState({ valid: ok });
      return ok;
    };
    const sync = () => { hl.parentElement.scrollTop = ta.scrollTop; hl.parentElement.scrollLeft = ta.scrollLeft; gutter.scrollTop = ta.scrollTop; };

    ta.addEventListener('input', () => { renderHl(); validate(); onState && onState({ dirty: true }); });
    ta.addEventListener('scroll', sync);
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = ta.selectionStart, en = ta.selectionEnd;
        ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(en);
        ta.selectionStart = ta.selectionEnd = s + 2;
        renderHl();
      }
    });

    renderHl();
    return {
      el: wrap,
      getValue: () => ta.value,
      setValue: (v) => { ta.value = v; renderHl(); validate(); },
      validate,
      focus: () => ta.focus(),
      input: ta,
    };
  }

  async function renderData() {
    const view = $('#view');
    view.innerHTML = `<div class="empty">${t('common.loading')}</div>`;
    const readOnly = state.user.readOnly;
    const { files, dir } = await Api.listFiles();

    view.innerHTML = `
      <div class="files-shell anim-in">
        <aside class="file-list">
          <div class="file-list-head">
            <div class="fl-titles">
              <h2>${esc(t('files.title'))}</h2>
              <p class="dir mono" title="${esc(dir)}">${esc(dir)}</p>
            </div>
            ${readOnly ? '' : `<button class="icon-btn" data-newfile title="${esc(t('files.newFile'))}">${ICON.plus}</button>`}
          </div>
          <div class="file-items" data-files></div>
        </aside>
        <section class="file-pane" data-pane>
          <div class="pane-empty">${ICON.file}<p>${esc(files.length ? t('files.pickFile') : t('files.empty'))}</p>${readOnly || files.length ? '' : `<button class="btn btn-primary" data-newfile2>${ICON.plus}<span>${esc(t('files.newFile'))}</span></button>`}</div>
        </section>
      </div>`;

    const listHost = $('[data-files]', view);
    const renderList = () => {
      if (!files.length) { listHost.innerHTML = `<div class="fl-empty">${esc(t('files.emptyHint'))}</div>`; return; }
      listHost.innerHTML = files.map((f) => `
        <button class="file-item ${state.currentFile === f.name ? 'active' : ''}" data-file="${esc(f.name)}">
          <span class="fi-dot ${f.valid ? 'ok' : 'bad'}"></span>
          <span class="fi-name">${esc(f.name)}</span>
          <span class="fi-size mono">${esc(formatSize(f.size))}</span>
        </button>`).join('');
      $$('[data-file]', listHost).forEach((b) => b.onclick = () => openFile(b.getAttribute('data-file')));
    };
    renderList();

    const newFile = async () => {
      const name = await promptDialog(t('files.newFile'), t('files.newFilePrompt'));
      if (!name) return;
      try {
        const res = await Api.createFile(name);
        toast(t('files.created', { name: res.name }));
        renderData();
      } catch (ex) {
        toast(ex.code === 'exists' ? t('files.exists') : t('files.invalidName'), 'error');
      }
    };
    $('[data-newfile]', view)?.addEventListener('click', newFile);
    $('[data-newfile2]', view)?.addEventListener('click', newFile);

    if (state.currentFile && files.find((f) => f.name === state.currentFile)) {
      openFile(state.currentFile);
    }

    async function openFile(name) {
      if (state.dirty && name !== state.currentFile) {
        if (!(await confirmDialog(t('files.unsaved') + ' — ' + t('common.confirm') + '?'))) return;
      }
      state.currentFile = name;
      state.dirty = false;
      $$('[data-file]', listHost).forEach((b) => b.classList.toggle('active', b.getAttribute('data-file') === name));
      const pane = $('[data-pane]', view);
      pane.innerHTML = `<div class="empty">${t('common.loading')}</div>`;
      const { content } = await Api.readFile(name);

      pane.innerHTML = `
        <div class="pane-head">
          <div class="pane-title">${ICON.file}<strong>${esc(name)}</strong></div>
          <div class="pane-actions">
            <span class="status-chip ok" data-status>${esc(t('files.valid'))}</span>
            <button class="icon-btn" data-reload title="${esc(t('files.reload'))}">${ICON.refresh}</button>
            <button class="btn btn-ghost" data-format>${esc(t('files.format'))}</button>
            ${readOnly ? '' : `<button class="btn btn-primary" data-save>${ICON.save}<span>${esc(t('files.save'))}</span></button>`}
            ${readOnly ? '' : `<button class="icon-btn danger" data-delete title="${esc(t('files.deleteFile'))}">${ICON.trash}</button>`}
          </div>
        </div>
        <div class="pane-editor" data-host></div>`;

      const status = $('[data-status]', pane);
      const setStatus = (st) => {
        if (st.valid === false) { status.className = 'status-chip bad'; status.textContent = t('files.invalidJson'); }
        else if (st.dirty) { status.className = 'status-chip warn'; status.textContent = t('files.unsaved'); state.dirty = true; }
        else { status.className = 'status-chip ok'; status.textContent = t('files.valid'); }
      };
      const editor = createCodeEditor(content, setStatus);
      if (readOnly) editor.input.setAttribute('readonly', 'readonly');
      $('[data-host]', pane).appendChild(editor.el);

      $('[data-reload]', pane).onclick = async () => {
        const fresh = await Api.readFile(name);
        editor.setValue(fresh.content);
        state.dirty = false; setStatus({ valid: true });
      };
      $('[data-format]', pane).onclick = () => {
        try { editor.setValue(JSON.stringify(JSON.parse(editor.getValue()), null, 2)); setStatus({ dirty: true }); }
        catch { toast(t('files.invalidJson'), 'error'); }
      };
      const saveBtn = $('[data-save]', pane);
      if (saveBtn) saveBtn.onclick = async () => {
        if (!editor.validate()) { toast(t('files.invalidJson'), 'error'); setStatus({ valid: false }); return; }
        try {
          await Api.saveFile(name, editor.getValue());
          state.dirty = false; setStatus({ valid: true });
          toast(t('files.saved', { name }));
          const idx = files.findIndex((f) => f.name === name);
          if (idx >= 0) files[idx].size = new Blob([editor.getValue()]).size;
          renderList();
        } catch (ex) { toast(ex.code === 'invalid_json' ? t('files.invalidJson') : t('common.error'), 'error'); }
      };
      const delBtn = $('[data-delete]', pane);
      if (delBtn) delBtn.onclick = async () => {
        if (!(await confirmDialog(t('files.deleteConfirm', { name })))) return;
        await Api.deleteFile(name);
        state.currentFile = null; state.dirty = false;
        toast(t('common.saved'));
        renderData();
      };
    }
  }

  function downloadExport() {
    const a = document.createElement('a');
    a.href = Api.exportUrl();
    a.download = '';
    document.body.appendChild(a); a.click(); a.remove();
  }

  async function renderTransfer() {
    const view = $('#view');
    const readOnly = state.user.readOnly;
    view.innerHTML = `
      <div class="page-head anim-in"><h1>${esc(t('transfer.title'))}</h1><p>${esc(t('transfer.subtitle'))}</p></div>
      <div class="set-grid anim-in">
        <div class="set-card">
          <h3>${esc(t('transfer.exportTitle'))}</h3>
          <p class="set-desc">${esc(t('transfer.exportDesc'))}</p>
          <button class="btn btn-primary" data-export>${ICON.download}<span>${esc(t('transfer.exportBtn'))}</span></button>
        </div>
        <div class="set-card">
          <h3>${esc(t('transfer.importTitle'))}</h3>
          <p class="set-desc">${esc(t('transfer.importDesc'))}</p>
          ${readOnly ? `<span class="badge warn">${esc(t('overview.readOnlyBadge'))}</span>` : `
          <div class="set-row">
            <span class="lbl">${esc(t('transfer.mode'))}</span>
            <div class="seg" data-mode>
              <button class="active" data-m="merge">${esc(t('transfer.merge'))}</button>
              <button data-m="replace">${esc(t('transfer.replace'))}</button>
            </div>
            <small class="hint" data-modedesc>${esc(t('transfer.mergeDesc'))}</small>
          </div>
          <div class="drop" data-drop>${ICON.download}<div>${esc(t('transfer.drop'))}</div></div>
          <input type="file" accept="application/json,.json" hidden data-file />
          <div data-chip></div>
          <button class="btn btn-primary" style="margin-top:1rem" data-import disabled>${esc(t('transfer.importBtn'))}</button>`}
        </div>
      </div>`;

    $('[data-export]', view).onclick = downloadExport;
    if (readOnly) return;

    let mode = 'merge';
    let payload = null;
    const modeDesc = $('[data-modedesc]', view);
    $$('[data-mode] button', view).forEach((b) => b.addEventListener('click', () => {
      $$('[data-mode] button', view).forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      mode = b.getAttribute('data-m');
      modeDesc.textContent = mode === 'replace' ? t('transfer.replaceDesc') : t('transfer.mergeDesc');
    }));

    const drop = $('[data-drop]', view);
    const file = $('[data-file]', view);
    const chip = $('[data-chip]', view);
    const importBtn = $('[data-import]', view);

    const accept = (f) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const json = JSON.parse(reader.result);
          if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error();
          payload = json;
          chip.innerHTML = `<div class="file-chip">${ICON.db}<span>${esc(f.name)} · ${Object.keys(json).length} keys</span></div>`;
          importBtn.disabled = false;
        } catch { toast(t('files.invalidJson'), 'error'); }
      };
      reader.readAsText(f);
    };

    drop.onclick = () => file.click();
    file.onchange = () => file.files[0] && accept(file.files[0]);
    ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) accept(f); });

    importBtn.onclick = async () => {
      if (!payload) return;
      if (mode === 'replace' && !(await confirmDialog(t('transfer.replaceWarn')))) return;
      const res = await Api.importData(payload, mode);
      toast(t('transfer.imported', { count: res.imported }));
      payload = null; chip.innerHTML = ''; importBtn.disabled = true;
    };
  }

  function logBadge(type) {
    const danger = ['login_failed', 'login_locked', 'ip_blocked', 'honeypot', 'csrf_failed'];
    const cls = danger.includes(type) ? 'warn' : type === 'login_success' || type === 'setup' ? 'online' : 'candy';
    return `<span class="badge ${cls}">${esc(t('log.' + type) || type)}</span>`;
  }

  async function renderSettings() {
    const view = $('#view');
    const cfg = await Api.getSettings();
    state.settings = cfg;
    const sec = cfg.security;

    view.innerHTML = `
      <div class="page-head anim-in"><h1>${esc(t('settings.title'))}</h1><p>${esc(t('settings.subtitle'))}</p></div>
      <div class="set-grid anim-in">

        <div class="set-card">
          <h3>${esc(t('settings.server'))}</h3>
          <p class="set-desc">${esc(t('settings.portHint'))}</p>
          <div class="set-row"><label class="field"><span>${esc(t('settings.port'))}</span><input data-port type="number" min="1" max="65535" value="${esc(cfg.port)}" /></label></div>
          <div class="set-row"><label class="field"><span>${esc(t('settings.host'))}</span><input data-host value="${esc(cfg.host)}" /><small class="hint">${esc(t('settings.hostHint'))}</small></label></div>
          <div class="set-actions"><button class="btn btn-primary" data-save-server>${esc(t('common.save'))}</button></div>
        </div>

        <div class="set-card">
          <h3>${esc(t('settings.appearance'))}</h3>
          <p class="set-desc">${esc(t('app.tagline'))}</p>
          <div class="set-row"><span class="lbl">${esc(t('settings.language'))}</span>
            <div class="seg" data-lang>
              <button data-l="en" class="${cfg.language === 'en' ? 'active' : ''}">English</button>
              <button data-l="tr" class="${cfg.language === 'tr' ? 'active' : ''}">Türkçe</button>
            </div>
          </div>
          <div class="set-row"><span class="lbl">${esc(t('settings.theme'))}</span>
            <div class="seg" data-theme-seg>
              <button data-th="dark" class="${cfg.theme === 'dark' ? 'active' : ''}">${esc(t('theme.dark'))}</button>
              <button data-th="light" class="${cfg.theme === 'light' ? 'active' : ''}">${esc(t('theme.light'))}</button>
            </div>
          </div>
        </div>

        <div class="set-card span-2">
          <div class="row-between mb">
            <div><h3 class="nogap">${esc(t('settings.security'))}</h3><p class="set-desc nogap">${esc(t('settings.readOnlyHint'))}</p></div>
            <span class="badge candy">${esc(t('settings.yourIp'))}: ${esc(cfg.currentIp)}</span>
          </div>
          <div class="set-row row-between">
            <span style="font-weight:600">${esc(t('settings.readOnly'))}</span>
            <label class="toggle"><input type="checkbox" data-readonly ${sec.readOnly ? 'checked' : ''}><span class="track"></span></label>
          </div>
          <div class="set-grid">
            <div class="set-row"><label class="field"><span>${esc(t('settings.allowlist'))}</span><textarea data-allow placeholder="192.168.1.20">${esc((sec.allowlist || []).join('\n'))}</textarea><small class="hint">${esc(t('settings.allowlistHint'))}</small></label></div>
            <div class="set-row"><label class="field"><span>${esc(t('settings.blocklist'))}</span><textarea data-block placeholder="10.0.0.5">${esc((sec.blocklist || []).join('\n'))}</textarea><small class="hint">${esc(t('settings.blocklistHint'))}</small></label></div>
          </div>
          <div class="set-grid">
            <div class="set-row"><label class="field"><span>${esc(t('settings.maxAttempts'))}</span><input data-maxatt type="number" min="1" max="100" value="${esc(sec.maxLoginAttempts)}" /></label></div>
            <div class="set-row"><label class="field"><span>${esc(t('settings.lockout'))}</span><input data-lockout type="number" min="1" value="${esc(Math.round(sec.lockoutMs / 60000))}" /></label></div>
            <div class="set-row"><label class="field"><span>${esc(t('settings.sessionTtl'))}</span><input data-ttl type="number" min="1" value="${esc(Math.round(sec.sessionTtlMs / 3600000))}" /></label></div>
          </div>
          <div class="set-actions"><button class="btn btn-primary" data-save-sec>${esc(t('common.save'))}</button></div>
        </div>

        <div class="set-card span-2">
          <div class="row-between mb">
            <div><h3 class="nogap">${esc(t('settings.securityLog'))}</h3><p class="set-desc nogap">${esc(t('settings.securityLogDesc'))}</p></div>
            <div style="display:flex;gap:.5rem">
              <button class="icon-btn" data-log-refresh title="${esc(t('common.refresh'))}">${ICON.refresh}</button>
              <button class="btn btn-ghost" data-log-clear>${esc(t('settings.clearLog'))}</button>
            </div>
          </div>
          <div class="log-wrap" data-log></div>
        </div>

        <div class="set-card">
          <h3>${esc(t('settings.account'))}</h3>
          <p class="set-desc">${esc(t('common.signedInAs'))}: <strong>${esc(state.user.username)}</strong></p>
          <div class="set-row"><label class="field"><span>${esc(t('settings.currentPassword'))}</span><input data-cur type="password" /></label></div>
          <div class="set-row"><label class="field"><span>${esc(t('settings.newPassword'))}</span><input data-new type="password" /></label></div>
          <p class="form-error" data-pwerr></p>
          <div class="set-actions"><button class="btn btn-ghost" data-save-pw>${esc(t('settings.changePassword'))}</button></div>
        </div>

        <div class="set-card">
          <h3>${esc(t('settings.configPath'))}</h3>
          <p class="set-desc">${esc(t('setup.subtitle'))}</p>
          <div class="config-path">${esc(cfg.configPath)}</div>
        </div>
      </div>`;

    $$('[data-lang] button', view).forEach((b) => b.onclick = () => toggleLangTo(b.getAttribute('data-l')));
    $$('[data-theme-seg] button', view).forEach((b) => b.onclick = async () => {
      applyTheme(b.getAttribute('data-th'));
      $$('[data-theme-seg] button', view).forEach((x) => x.classList.toggle('active', x === b));
      try { await Api.updateSettings({ theme: b.getAttribute('data-th') }); } catch (e) {}
    });

    $('[data-save-server]', view).onclick = async () => {
      const port = Number($('[data-port]', view).value);
      const host = $('[data-host]', view).value.trim();
      try {
        const res = await Api.updateSettings({ port, host });
        if (res.restarted) {
          toast(t('settings.restartNotice', { host: res.host, port: res.port }));
          setTimeout(() => { window.location.href = `${location.protocol}//${location.hostname}:${res.port}${location.pathname}#settings`; }, 1400);
        } else { toast(t('settings.saved')); }
      } catch (ex) { toast(t('common.error'), 'error'); }
    };

    $('[data-save-sec]', view).onclick = async () => {
      const lines = (sel) => $(sel, view).value.split('\n').map((s) => s.trim()).filter(Boolean);
      const security = {
        readOnly: $('[data-readonly]', view).checked,
        allowlist: lines('[data-allow]'),
        blocklist: lines('[data-block]'),
        maxLoginAttempts: Number($('[data-maxatt]', view).value),
        lockoutMs: Number($('[data-lockout]', view).value) * 60000,
        sessionTtlMs: Number($('[data-ttl]', view).value) * 3600000,
      };
      try {
        await Api.updateSettings({ security });
        state.user = await Api.me();
        toast(t('settings.saved'));
        route();
      } catch (ex) { toast(t('common.error'), 'error'); }
    };

    $('[data-save-pw]', view).onclick = async () => {
      const err = $('[data-pwerr]', view); err.textContent = '';
      try {
        await Api.changePassword($('[data-cur]', view).value, $('[data-new]', view).value);
        toast(t('settings.passwordChanged'));
        setTimeout(() => location.reload(), 1200);
      } catch (ex) {
        err.textContent = ex.code === 'weak_password' ? t('setup.passwordHint') : t('login.invalid');
      }
    };

    const logHost = $('[data-log]', view);
    const loadLog = async () => {
      const { events } = await Api.securityLog();
      if (!events.length) { logHost.innerHTML = `<div class="empty" style="padding:2rem"><p>${esc(t('settings.logEmpty'))}</p></div>`; return; }
      logHost.innerHTML = `
        <table class="log-table">
          <thead><tr><th>${esc(t('settings.logTime'))}</th><th>${esc(t('settings.logType'))}</th><th>${esc(t('settings.logIp'))}</th><th>${esc(t('settings.logDetail'))}</th><th>${esc(t('settings.logClient'))}</th></tr></thead>
          <tbody>${events.map((e) => `<tr>
            <td class="mono nowrap">${esc(formatTime(e.ts))}</td>
            <td>${logBadge(e.type)}</td>
            <td class="mono">${esc(e.ip)}</td>
            <td class="mono dim">${esc(e.detail || e.path || '')}</td>
            <td class="dim ua">${esc(e.ua || '')}</td>
          </tr>`).join('')}</tbody>
        </table>`;
    };
    $('[data-log-refresh]', view).onclick = loadLog;
    $('[data-log-clear]', view).onclick = async () => {
      if (await confirmDialog(t('settings.clearLog'), false)) { await Api.clearLog(); loadLog(); }
    };
    loadLog();
  }

  async function toggleLangTo(lang) {
    await setLang(lang);
    $$('[data-lang-flag]').forEach((e) => (e.textContent = lang.toUpperCase()));
    if (state.user) { try { await Api.updateSettings({ language: lang }); } catch (e) {} }
    route();
  }

  boot().catch((e) => {
    document.body.innerHTML = `<div style="min-height:100dvh;display:grid;place-items:center;color:#888;font-family:monospace">${esc(e.message || 'Failed to start')}</div>`;
  });
})();
