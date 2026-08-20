(function () {
  const state = { lang: 'en', dict: {} };
  const cache = {};

  const FALLBACK = "en";

  async function load(lang) {
    if (cache[lang]) return cache[lang];
    try {
      const res = await fetch("/i18n/" + encodeURIComponent(lang) + ".json", { cache: "no-cache" });
      if (!res.ok) throw new Error("i18n " + res.status);
      cache[lang] = await res.json();
      return cache[lang];
    } catch (err) {
      if (lang === FALLBACK) throw err;
      return load(FALLBACK);
    }
  }

  function lookup(path) {
    return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), state.dict);
  }

  function t(key, params) {
    let val = lookup(key);
    if (val === undefined) return key;
    if (params) {
      for (const p of Object.keys(params)) {
        val = val.replace(new RegExp(`\\{${p}\\}`, 'g'), params[p]);
      }
    }
    return val;
  }

  function apply(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    root.querySelectorAll('[data-i18n-ph]').forEach((el) => {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
  }

  async function setLang(lang) {
    state.lang = lang;
    state.dict = await load(lang);
    document.documentElement.setAttribute('lang', lang);
    apply();
    window.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
  }

  window.I18n = {
    t,
    apply,
    setLang,
    get lang() { return state.lang; },
  };
})();
