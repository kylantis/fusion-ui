
class K_Cache {

  #cacheName;
  #version;
  #opts;

  constructor(cacheName, version, opts = {}) {
    this.#cacheName = cacheName;
    this.#version = version;
    this.#opts = opts;
  }

  #getCacheNamePrefix() {
    return `${this.#cacheName}-v`
  }

  #getCacheName() {
    return `${this.#getCacheNamePrefix()}${this.#version}`
  }

  getCache() {
    return caches.open(this.#getCacheName());
  }

  pruneCache() {
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName.startsWith(this.#getCacheNamePrefix()) && cacheName !== this.#getCacheName()) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  }

  #addCacheControl(response) {
    const { cacheControl } = this.#opts;

    if (cacheControl) {
      const _headers = new Headers(response.headers);
      _headers.set('Cache-Control', cacheControl);

      response.headers = _headers;
    }

    return response;
  }

  async addToCache(url, options = {}) {
    const cache = await this.getCache();

    const response = await fetch(url, options);
    await cache.put(url, this.#addCacheControl(response.clone()));

    return response;
  }

  async getCachedResponse(url) {
    const cache = await this.getCache();
    return cache.match(url);
  }

  async fetchWithCache(url, options = {}) {
    const cachedResponse = await this.getCachedResponse(url);

    if (cachedResponse) {
      const cachedETag = cachedResponse.headers.get('ETag');
      options.headers = options.headers || {};
      options.headers['If-None-Match'] = cachedETag;
    }

    const response = await fetch(url, options);

    if (response.status === 304) {
      return cachedResponse;
    } else {

      const cache = await this.getCache();
      await cache.put(url, this.#addCacheControl(response.clone()));
      
      return response;
    }
  }
}

module.exports = K_Cache;