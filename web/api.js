(function initApiHelpers() {
  const cfg = window.APP_CONFIG || {};
  const configuredBase = (cfg.API_BASE_URL || '').trim().replace(/\/$/, '');
  const apiBase = configuredBase || window.location.origin;

  window.apiUrl = function apiUrl(pathAndQuery) {
    if (/^https?:\/\//i.test(pathAndQuery)) return pathAndQuery;
    const normalized = pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`;
    return `${apiBase}${normalized}`;
  };

  window.apiFetch = function apiFetch(pathAndQuery, options) {
    return fetch(window.apiUrl(pathAndQuery), options);
  };

  window.pageUrl = function pageUrl(page, queryString = '') {
    const basePath = window.location.pathname.replace(/\/[^/]*$/, '/');
    return `${basePath}${page}${queryString ? `?${queryString}` : ''}`;
  };
})();
