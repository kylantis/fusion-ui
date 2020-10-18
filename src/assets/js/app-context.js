/* eslint-disable no-case-declarations */
/* eslint-disable no-eval */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-param-reassign */
/* eslint-disable class-methods-use-this */

class AppContext {
    static #loadedScripts = [];

    #fetchApi;

    #importScriptApi;

    #appId;

    #serverUrl;

    constructor({
      appId, logger, serverUrl,
    }) {
      this.#appId = appId;
      this.#serverUrl = serverUrl;

      this.logger = logger;

      if (self.WorkerGlobalScope && !appId) {
        throw new Error('Empty appId');
      }

      this.setGlobals();
    }

    // Todo: Replace XHR object with a custom api as urgent security measure
    // Todo: Should apps be able to create workers?
    setGlobals() {
      if (self.appContext) {
        throw new Error('Duplicate appContext instance');
      }
      this.#fetchApi = self.fetch.bind(self);
      this.#importScriptApi = self.importScripts;

      delete self.fetch;
      delete self.importScripts;

      window.global = window;
      global.assert = (condition, message) => {
        if (!condition) {
          throw new Error(`Assertion Error${message ? `: ${message}` : ''}`);
        }
      };

      Object.defineProperty(self, 'appContext', {
        value: this, configurable: false, writable: false,
      });
    }

    async start({ data, rootComponent }) {
      await this.loadGlobalDependencies();

      await this.loadComponentClasses();

      const container = document.createElement('div');
      container.id = `${this.#appId || 'app'}-container`;
      document.body.appendChild(container);

      // eslint-disable-next-line no-new
      new self.components[rootComponent]({
        input: data,
      }).load({ parent: container.id });
    }

    getCanonicalURLPrefix() {
      return this.#appId ? `/${this.#appId}` : '';
    }

    toCanonicalDependency(dependency) {
      if (dependency.constructor.name === 'String') {
        dependency = { url: dependency, moduleType: 'cjs' };
      }
      return dependency;
    }

    async loadGlobalDependencies() {
      // eslint-disable-next-line no-restricted-syntax
      for (let dependency of this.getGlobalScriptURLs()) {
        dependency = this.toCanonicalDependency(dependency);

        // eslint-disable-next-line no-await-in-loop
        await this.loadResource({
          url: dependency.url,
          moduleType: dependency.moduleType,
        // eslint-disable-next-line no-loop-func
        }).then((f) => {
          // eslint-disable-next-line default-case
          switch (true) {
            case f instanceof Function:
              self[f.name] = f;
              break;

            case f instanceof Object && !!Object.keys(f).length:

              // eslint-disable-next-line no-undef
              assert(dependency.namespace);
              self[dependency.namespace] = f;
              break;
          }
        });
      }
    }

    async loadComponentClasses() {
      const list = await this.loadResource({
        url: '/components/list.json',
        asJson: true,
      });

      self.components = {};

      return Promise.all(
        Object.keys(list).map((name) => {
          const assetId = list[name];
          return this.loadResource({
            url: `/components/${assetId}/index.js`,
            moduleType: 'cjs',
          }).then((f) => {
            // eslint-disable-next-line no-eval
            self.components[name] = f;
            this.logger.info(`Loaded component class: ${name}`);
          });
        }),
      );
    }

    getGlobalScriptURLs() {
      return [
        { url: '/assets/js/polyfills/index.min.js', moduleType: 'inline' },
        { url: '/assets/js/add-polyfills.min.js', moduleType: 'inline' },
        { url: 'https://cdn.jsdelivr.net/npm/handlebars@4.7.6/dist/handlebars.min.js', moduleType: 'cjs', namespace: 'Handlebars' },
        '/assets/js/proxy.min.js',
        '/assets/js/base-renderer.min.js',
        '/assets/js/root-ctx-renderer.min.js',
        '/assets/js/custom-ctx-renderer.min.js',
        '/assets/js/web-renderer.min.js',
        '/assets/js/base-component.min.js',
        '/assets/js/root-context.min.js',
      ];
    }

    normalizeURL(resource) {
      let url;
      try {
        url = new URL(resource).toString();
        if (url.hostname === this.#serverUrl.hostname) {
          throw new Error(`Absolute URL: ${resource} not allowed`);
        }
      } catch (e) {
        if (!resource.startsWith('/')) {
          throw new Error(`Malformed URL: ${resource}`);
        }
        url = `${this.getCanonicalURLPrefix()}${resource}`;
      }
      return url;
    }

    /**
     * Note:
     * - This should load be used to fetch .js, .json files
     * - URL should contain only path compnent
     */
    async loadResource({ url, asJson = false, moduleType }) {
      return this.#fetchApi(`${
        this.normalizeURL(url)
      }`, { method: 'GET' })
        .then(response => response[asJson ? 'json' : 'text']()
          .then((responseObject) => {
            this.logger.info(`Loaded ${url}`);
            let result = responseObject;

            if (!asJson) {
            // eslint-disable-next-line default-case
              switch (moduleType) {
                case 'cjs':
                  const mod = { exports: {} };
                  eval(`(function (module, exports) { ${responseObject}\n//*/\n})(mod, mod.exports);\n//@ sourceURL=${url}`);
                  result = mod.exports;
                  break;

                case 'inline':
                  result = eval(responseObject);
                  break;
              }
            }

            return result;
          }));
    }
}

module.exports = AppContext;
