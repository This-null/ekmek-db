(function () {
  async function request(method, path, body) {
    const opts = {
      method,
      credentials: 'same-origin',
      headers: {},
    };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(path, opts);
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await res.json() : await res.text();
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
    status: () => request('GET', '/api/status'),
    setup: (username, password) => request('POST', '/api/setup', { username, password }),
    login: (username, password) => request('POST', '/api/login', { username, password }),
    logout: () => request('POST', '/api/logout'),
    me: () => request('GET', '/api/me'),
    getData: () => request('GET', '/api/data'),
    setData: (key, value) => request('POST', '/api/data', { key, value }),
    deleteData: (key) => request('POST', '/api/data/delete', { key }),
    clearData: () => request('POST', '/api/data/clear'),
    getSettings: () => request('GET', '/api/settings'),
    updateSettings: (patch) => request('POST', '/api/settings', patch),
    changePassword: (current, next) => request('POST', '/api/password', { current, next }),
    importData: (data, mode) => request('POST', '/api/import', { data, mode }),
    exportUrl: () => '/api/export',
  };
})();
