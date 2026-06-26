(function () {
  const { t, apply: applyI18n, setLang } = window.I18n;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const state = { status: null, settings: null, user: null };

  function node(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    return tpl.content.firstElementChild;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function prettyValue(v) {
    try { return JSON.stringify(v, null, 2); } catch { return String(v); }
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
  };

  function toast(message, type = 'success') {
    const el = node(`<div class="toast ${type === 'error' ? 'error' : ''}">${type === 'error' ? ICON.alert : ICON.check}<span>${esc(message)}</span></div>`);
    $('#toast-root').appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(16px)'; el.style.transition = 'all .25s'; setTimeout(() => el.remove(), 250); }, 2800);
  }

  function openModal({ title, body, footer, onClose }) {
    const overlay = node('<div class="modal-overlay"></div>');
    const modal = node(`<div class="modal"><div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-x>${ICON.x}</button></div><div class="modal-body"></div><div class="modal-foot"></div></div>`);
    $('.modal-body', modal).appendChild(body);
    if (footer) $('.modal-foot', modal).appendChild(footer);
    else $('.modal-foot', modal).remove();
    overlay.appendChild(modal);
    $('#modal-root').appendChild(overlay);
    const close = () => { overlay.remove(); onClose && onClose(); };
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
    if (state.user) { try { await Api.updateSettings({ language: next }); } catch (e) {} }
    else renderAuth();
    if (state.user) route();
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
    $('[data-logout]')?.addEventListener('click', async () => { await Api.logout(); location.reload(); });
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
        await Api.setup(u, p);
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
        await Api.login(loginForm.username.value.trim(), loginForm.password.value);
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
    state.settings = await Api.getSettings();
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
    render();
  }

  function greeting() {
    const h = new Date().getHours();
    if (h < 12) return t('overview.greeting_morning');
    if (h < 18) return t('overview.greeting_afternoon');
    return t('overview.greeting_evening');
  }

  async function renderOverview() {
    const view = $('#view');
    view.innerHTML = `<div class="empty">${t('common.loading')}</div>`;
    const data = await Api.getData();
    const s = state.status;
    const readOnly = state.user.readOnly;

    view.innerHTML = `
      <div class="bento">
        <section class="hero col-7">
          <div>
            <h2>${esc(greeting())}, ${esc(state.user.username)}</h2>
            <p class="sub">${esc(t('overview.subtitle'))}</p>
          </div>
          <div class="pill-row">
            <span class="badge online">● ${esc(t('overview.online'))}</span>
            <span class="badge candy">v${esc(s.version)}</span>
            ${readOnly ? `<span class="badge warn">${esc(t('overview.readOnlyBadge'))}</span>` : ''}
          </div>
        </section>

        <div class="card stat col-5">
          <div>
            <div class="stat-num">${data.size}</div>
            <div class="stat-label">${esc(t('overview.totalKeys'))}</div>
          </div>
          <dl class="swatch-row">
            <dt>NAME</dt><dd>${esc(s.name)}</dd>
            <dt>VER</dt><dd>${esc(s.version)}</dd>
            <dt>STATUS</dt><dd>${esc(t('overview.online'))}</dd>
          </dl>
        </div>

        <div class="card col-12">
          <h3 style="margin:0 0 1rem;font-size:1.05rem">${esc(t('overview.quickActions'))}</h3>
          <div class="bento">
            <button class="qa col-4" data-qa="add"><span class="qa-ico">${ICON.plus}</span><span><p>${esc(t('overview.addEntry'))}</p><small>${esc(t('nav.data'))}</small></span></button>
            <button class="qa col-4" data-qa="export"><span class="qa-ico">${ICON.download}</span><span><p>${esc(t('overview.exportData'))}</p><small>JSON</small></span></button>
            <button class="qa col-4" data-qa="security"><span class="qa-ico">${ICON.shield}</span><span><p>${esc(t('overview.manageSecurity'))}</p><small>${esc(t('nav.settings'))}</small></span></button>
          </div>
        </div>
      </div>`;

    $('[data-qa="add"]').onclick = () => { location.hash = '#data'; setTimeout(() => openEntryModal(), 60); };
    $('[data-qa="export"]').onclick = () => downloadExport();
    $('[data-qa="security"]').onclick = () => { location.hash = '#settings'; };
  }

  async function renderData() {
    const view = $('#view');
    view.innerHTML = `<div class="empty">${t('common.loading')}</div>`;
    const { entries } = await Api.getData();
    const readOnly = state.user.readOnly;

    view.innerHTML = `
      <div class="page-head page-head-row">
        <div><h1>${esc(t('data.title'))}</h1><p>${esc(t('data.subtitle'))}</p></div>
        ${readOnly ? '' : `<button class="btn btn-primary" data-add>${ICON.plus}<span>${esc(t('data.add'))}</span></button>`}
      </div>
      <div class="toolbar">
        <div class="search">${ICON.search}<input data-search placeholder="${esc(t('data.search'))}" /></div>
        ${readOnly || entries.length === 0 ? '' : `<button class="btn btn-ghost" data-clear>${ICON.trash}<span>${esc(t('data.clearAll'))}</span></button>`}
      </div>
      <div data-list></div>`;

    const list = $('[data-list]', view);
    const render = (filter = '') => {
      const f = filter.toLowerCase();
      const rows = entries.filter((e) => e.key.toLowerCase().includes(f));
      if (entries.length === 0) {
        list.innerHTML = `<div class="empty"><span class="loaf">🍞</span><p>${esc(t('data.empty'))}</p>${readOnly ? '' : `<button class="btn btn-primary" data-add2>${ICON.plus}<span>${esc(t('data.add'))}</span></button>`}</div>`;
        $('[data-add2]', list)?.addEventListener('click', () => openEntryModal());
        return;
      }
      if (rows.length === 0) { list.innerHTML = `<div class="empty"><p>${esc(t('data.emptySearch'))}</p></div>`; return; }
      list.innerHTML = `<div class="entry-grid">${rows.map(entryCard).join('')}</div>`;
      $$('[data-edit]', list).forEach((b) => b.addEventListener('click', () => {
        const e = entries.find((x) => x.key === b.getAttribute('data-edit'));
        openEntryModal(e);
      }));
      $$('[data-del]', list).forEach((b) => b.addEventListener('click', async () => {
        const key = b.getAttribute('data-del');
        if (await confirmDialog(t('data.deleteConfirm', { key }))) {
          await Api.deleteData(key);
          toast(t('common.saved'));
          renderData();
        }
      }));
    };
    render();

    $('[data-search]', view).addEventListener('input', (e) => render(e.target.value));
    $('[data-add]', view)?.addEventListener('click', () => openEntryModal());
    $('[data-clear]', view)?.addEventListener('click', async () => {
      if (await confirmDialog(t('data.clearConfirm'))) { await Api.clearData(); toast(t('common.saved')); renderData(); }
    });
  }

  function entryCard(e) {
    return `<article class="entry">
      <div class="entry-key">${esc(e.key)}</div>
      <pre class="entry-val">${esc(prettyValue(e.value))}</pre>
      <div class="entry-foot">
        <span class="type-chip">${esc(e.type)}</span>
        ${state.user.readOnly ? '' : `<div class="entry-tools">
          <button class="tool" data-edit="${esc(e.key)}" title="${esc(t('common.edit'))}">${ICON.edit}</button>
          <button class="tool danger" data-del="${esc(e.key)}" title="${esc(t('common.delete'))}">${ICON.trash}</button>
        </div>`}
      </div>
    </article>`;
  }

  function openEntryModal(entry) {
    const editing = Boolean(entry);
    const body = node('<div style="display:flex;flex-direction:column;gap:1rem"></div>');
    body.innerHTML = `
      <label class="field"><span>${esc(t('data.key'))}</span><input data-key value="${entry ? esc(entry.key) : ''}" ${editing ? 'readonly' : ''} placeholder="user.profile.name" /></label>
      <label class="field"><span>${esc(t('data.valueJson'))}</span><textarea data-val spellcheck="false">${entry ? esc(prettyValue(entry.value)) : '""'}</textarea><small class="hint">e.g. "text", 42, true, { "a": 1 }, [1,2,3]</small></label>
      <p class="form-error" data-err></p>`;
    const footer = node('<div style="display:flex;gap:.6rem"></div>');
    const cancel = node(`<button class="btn btn-ghost">${esc(t('common.cancel'))}</button>`);
    const save = node(`<button class="btn btn-primary">${esc(t('common.save'))}</button>`);
    footer.append(cancel, save);
    const close = openModal({ title: editing ? t('data.editEntry') : t('data.newEntry'), body, footer });
    cancel.addEventListener('click', close);
    save.addEventListener('click', async () => {
      const err = $('[data-err]', body);
      err.textContent = '';
      const key = $('[data-key]', body).value.trim();
      if (!key) { err.textContent = t('data.keyRequired'); return; }
      let value;
      try { value = JSON.parse($('[data-val]', body).value); }
      catch { err.textContent = t('data.invalidJson'); return; }
      try {
        await Api.setData(key, value);
        close();
        toast(t('common.saved'));
        renderData();
      } catch (ex) { err.textContent = t('common.error'); }
    });
    setTimeout(() => $(editing ? '[data-val]' : '[data-key]', body).focus(), 50);
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
      <div class="page-head"><h1>${esc(t('transfer.title'))}</h1><p>${esc(t('transfer.subtitle'))}</p></div>
      <div class="set-grid">
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
            <span style="font-size:.8rem;color:var(--text-dim)">${esc(t('transfer.mode'))}</span>
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
        } catch { toast(t('data.invalidJson'), 'error'); }
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

  async function renderSettings() {
    const view = $('#view');
    const cfg = await Api.getSettings();
    state.settings = cfg;
    const sec = cfg.security;

    view.innerHTML = `
      <div class="page-head"><h1>${esc(t('settings.title'))}</h1><p>${esc(t('settings.subtitle'))}</p></div>
      <div class="set-grid">

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
          <div class="set-row"><span style="font-size:.8rem;color:var(--text-dim)">${esc(t('settings.language'))}</span>
            <div class="seg" data-lang>
              <button data-l="en" class="${cfg.language === 'en' ? 'active' : ''}">English</button>
              <button data-l="tr" class="${cfg.language === 'tr' ? 'active' : ''}">Türkçe</button>
            </div>
          </div>
          <div class="set-row"><span style="font-size:.8rem;color:var(--text-dim)">${esc(t('settings.theme'))}</span>
            <div class="seg" data-theme-seg>
              <button data-th="dark" class="${cfg.theme === 'dark' ? 'active' : ''}">${esc(t('theme.dark'))}</button>
              <button data-th="light" class="${cfg.theme === 'light' ? 'active' : ''}">${esc(t('theme.light'))}</button>
            </div>
          </div>
        </div>

        <div class="set-card col-12" style="grid-column:1/-1">
          <h3>${esc(t('settings.security'))}</h3>
          <p class="set-desc">${esc(t('settings.readOnlyHint'))}</p>
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
