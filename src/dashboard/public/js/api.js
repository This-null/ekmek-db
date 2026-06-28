(function () {
  let csrf = '';

  async function request(method, path, body) {
    const opts = {
      method,
      credentials: 'same-origin',
      headers: {},
    };
    if (method !== 'GET' && csrf) opts.headers['X-CSRF-Token'] = csrf;
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(path, opts);
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await res.json() : await res.text();
    if (data && typeof data === 'object' && data.csrf) csrf = data.csrf;
    if (!res.ok) {
      const err = new Error((data && data.error) || `HTTP ${res.status}`);
      err.status = res.status;
      err.code = data && data.error;
      err.data = data;
      throw err;
    }
    return data;
  }

  window.Api = {
    setCsrf: (token) => { csrf = token || ''; },
    status: () => request('GET', '/api/status'),
    setup: (payload) => request('POST', '/api/setup', payload),
    login: (payload) => request('POST', '/api/login', payload),
    logout: () => request('POST', '/api/logout'),
    me: () => request('GET', '/api/me'),
    getData: () => request('GET', '/api/data'),
    getRaw: () => request('GET', '/api/raw'),
    setRaw: (json) => request('POST', '/api/raw', { json }),
    setData: (key, value) => request('POST', '/api/data', { key, value }),
    deleteData: (key) => request('POST', '/api/data/delete', { key }),
    clearData: () => request('POST', '/api/data/clear'),
    getSettings: () => request('GET', '/api/settings'),
    updateSettings: (patch) => request('POST', '/api/settings', patch),
    changePassword: (current, next) => request('POST', '/api/password', { current, next }),
    importData: (data, mode) => request('POST', '/api/import', { data, mode }),
    securityLog: () => request('GET', '/api/security/log'),
    clearLog: () => request('POST', '/api/security/log/clear'),
    listFiles: () => request('GET', '/api/files'),
    readFile: (name) => request('GET', '/api/files/read?name=' + encodeURIComponent(name)),
    saveFile: (name, content) => request('POST', '/api/files/save', { name, content }),
    createFile: (name) => request('POST', '/api/files/create', { name }),
    deleteFile: (name) => request('POST', '/api/files/delete', { name }),
    exportUrl: () => '/api/export',
  };
})();
