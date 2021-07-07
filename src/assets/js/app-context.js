/* eslint-disable no-case-declarations */
/* eslint-disable no-eval */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-param-reassign */
/* eslint-disable class-methods-use-this */

// eslint-disable-next-line no-unused-vars
class AppContext {
  static lazyLoadComponentTemplates = true;

  static #initialized;
  static #loadedScripts = [];

  constructor({
    logger, userGlobals,
  }) {

    this.logger = logger;

    // Add user globals
    this.userGlobals = {};
    
    for (const k in userGlobals) {
      const v = userGlobals[k];

      // Transform variables with their default values
      switch (true) {
        case k == 'rtl' && v == '{{rtl}}':
          v = false;
          break;
      }

      this.userGlobals[k] = v;
    }

    this.components = {};
    this.setGlobals();
  }

  // Todo: Replace XHR object with a custom api as urgent security measure
  // Todo: Should apps be able to create workers?
  setGlobals() {
    if (self.appContext) {
      throw new Error('Duplicate appContext instance');
    }

    self.global = self;
    global.assert = (condition, message) => {
      if (!condition) {
        throw new Error(`Assertion Error${message ? `: ${message}` : ''}`);
      }
    };

    Object.defineProperty(self, 'appContext', {
      value: this, configurable: false, writable: false,
    });
  }

  async start({
    rootComponent, data, testMode,
  }) {

    if (testMode == '{{testMode}}') {
      testMode = true;
    }

    if (data == '{{data}}') {
      data = false;
    }

    this.testMode = testMode;

    if (!AppContext.#initialized) {
      await this.loadGlobalDependencies();
    }

    await this.loadEnums();

    await this.loadComponentClasses({ rootComponent });

    if (testMode) {
      data = self.SampleData;
    }

    const container = document.createElement('div');
    container.id = 'app-container';
    document.body.appendChild(container);

    // eslint-disable-next-line no-new
    const component = new self.components[rootComponent]({
      input: data,
    });

    component.load({ container: container.id })
      .then(() => {
        if (!AppContext.#initialized) {
          AppContext.#initialized = true;
        }
      });

    if (testMode) {
      self.Component = component;
    }
  }

  toCanonicalDependency(dependency) {
    if (dependency.constructor.name === 'String') {
      dependency = { url: dependency, moduleType: 'cjs' };
    }
    return dependency;
  }

  loadDependencies({
    dependencies
  }) {

    const promises = [];

    for (const dependency of dependencies) {
      dependency = this.toCanonicalDependency(dependency);
      promises.push(
        this.loadResource({
          url: dependency.url,
          moduleType: dependency.moduleType,
          esm: dependency.esm,
          // We 'll process them in order below
          process: false,
        }).then(r => ({ ...r, namespace: dependency.namespace }))
      );
    }

    return Promise.all(promises).then((responses) => {
      for (const response of responses) {
        const { contents, moduleType, url, namespace, esm } = response;
        const f = this.processScript({ contents, moduleType, url });

        // eslint-disable-next-line default-case
        switch (true) {
          case f instanceof Function:
            self[f.name] = f;
            break;
          case f instanceof Object && !!Object.keys(f).length:
            // eslint-disable-next-line no-undef
            assert(namespace);
            self[namespace] = esm ? f.default : f;
            break;
        }
      }
    });
  }

  loadGlobalDependencies() {
    return this.loadDependencies({
      dependencies: this.getGlobalScriptURLs()
    });
  }

  loadEnums() {
    return this.loadResource({
      url: '/components/enums.json', asJson: true
    }).then(enums => {
      self.appContext.enums = enums;
    });
  }

  async loadComponentClasses({ rootComponent }) {
    const { lazyLoadComponentTemplates } = AppContext;
    const list = await this.loadResource({
      url: '/components/list.json',
      asJson: true,
    });

    let rootAssetId;
    self.components = {};

    return Promise.all(
      Object.keys(list).map((name) => {
        const assetId = list[name];
        return Promise.all([

          lazyLoadComponentTemplates ? Promise.resolve() : this.loadResource({
            url: `/components/${assetId}/metadata.min.js`,
            moduleType: 'inline',
          }),

          this.loadResource({
            url: `/components/${assetId}/index.js`,
            moduleType: 'cjs',
          }),
        ])
          // eslint-disable-next-line no-unused-vars
          .then(([tpl, ComponentClass]) => {
            // eslint-disable-next-line no-eval
            self.components[name] = ComponentClass;
            this.logger.info(`Loaded component class: ${name}`);
          })
          .then(() => {
            if (!this.testMode) {
              return null;
            }

            if (name === rootComponent) {
              rootAssetId = assetId;
            }

            const inlineScope = `
              const require = (module) => {

                switch(module) {
                  case './index':
                    return self.components['${name}'];
                  default:
                    return self[module];
                }
              };
              `;

            return this.loadResource({
              url: `/components/${assetId}/index.test.js`,
              moduleType: 'inline',
              inlineScope,
            }).then((ComponentClass) => {
              // When serializing, toJSON(...) should use the actual className, not the test class
              ComponentClass.className = name;
              self.components[name] = ComponentClass;
              this.logger.info(`Loaded test class for component: ${name}`);
            });
          });
      }),
    ).then(() => {
      if (!this.testMode) {
        return null;
      }

      return this.loadResource({
        url: `/components/${rootAssetId}/sample.js`,
        moduleType: 'inline',
      }).then((o) => {
        self.SampleData = o;
      });
    });
  }

  getGlobalScriptURLs() {
    const urls = [
      { url: '/assets/js/client-utils.min.js', moduleType: 'inline', namespace: 'clientUtils' },
      '/assets/js/proxy.min.js',
      '/assets/js/base-renderer.min.js',
      '/assets/js/root-ctx-renderer.min.js',
      '/assets/js/custom-ctx-renderer.min.js',
      '/assets/js/web-renderer.min.js',
      '/assets/js/base-component.min.js',
      '/assets/js/root-context.min.js',
      // 'https://cdnjs.cloudflare.com/ajax/libs/ajv/7.2.3/ajv7.min.js',
      { url: '/assets/js/cdn/ajv.min.js', moduleType: 'cjs', namespace: 'Ajv', esm: true },
    ];
    return urls;
  }

  processScript({ contents, inlineScope, moduleType, url }) {
    let result;
    // eslint-disable-next-line default-case
    switch (moduleType) {
      case 'cjs':
        const mod = { exports: {} };
        eval(`(function (module, exports) { ${contents}\n//*/\n})(mod, mod.exports);\n//@ sourceURL=${url}`);
        result = mod.exports;
      break;

      case 'inline':
        if (inlineScope) {
          contents = `${inlineScope}${contents}`;
        }
        // eslint-disable-next-line no-unused-vars
        const module = { exports: {} };
        result = eval(contents);
      break;
    }
    this.logger.info(`Loaded ${url}`);
    return result;
  }

  /**
   * Note:
   * - This should load be used to fetch .js, .json files
   * - URL should contain only path compnent
   */
  async loadResource({
    url, asJson = false, moduleType, esm, inlineScope, process = true,
  }) {

    return self.fetch(`${url}`, { method: 'GET' })
      .then(res => {
        if (!res.ok) {
          throw Error(res.statusText);
        }
        return res;
      })
      .then(
        response => response[asJson ? 'json' : 'text']()
          .then((contents) => {
            let result = contents;

            if (!asJson) {
              if (process) {
                result = this.processScript({ contents, url, inlineScope, moduleType });
              } else {
                result = {
                  moduleType,
                  contents,
                  url,
                  esm,
                }
              }
            }
            return result;
          })
      );
  }
}
