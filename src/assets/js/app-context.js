/* eslint-disable no-case-declarations */
/* eslint-disable no-eval */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-param-reassign */
class AppContext {
  static lazyLoadComponentTemplates = false;

  static #initialized;
  static #loadedResources = {};
  static #internalApi = {};

  constructor({
    logger, userGlobals,
  }) {

    this.logger = logger;

    // Add user globals
    this.userGlobals = {};

    for (const k in userGlobals) {
      let v = userGlobals[k];

      // Transform variables with their default (falsy) values
      // This is usually done because the server did not provide us with any value
      switch (true) {
        case k == 'rtl' && v == '{{rtl}}':
          v = false;
          break;
      }

      this.userGlobals[k] = v;
    }

    this.components = {};

    this.setGlobals();

    this.addPolyfills();
  }

  // Todo: Replace XHR object with a custom api as urgent security measure
  // Todo: Should apps be able to create workers?
  setGlobals() {
    if (self.appContext) {
      throw Error('Duplicate appContext instance');
    }

    self.assert = (condition, message) => {
      if (!condition) {
        throw Error(`Assertion Error${message ? `: ${message}` : ''}`);
      }
    };

    self.global = self;

    Object.defineProperty(self, 'appContext', {
      value: this, configurable: false, writable: false,
    });
  }

  // Use Token for security
  // getInternalApi() {
  //   return AppContext.#internalApi;
  // }

  addPolyfills() {
  }

  static unsafeEval(code, scope = {}) {
    const { require } = scope;

    const exports = {};
    const module = { exports };

    const r = eval(code);

    return module.exports.__esModule ? module.exports : r;
  }

  static evaluate(code, scope = {}, thisObject) {

    const args = { names: [], values: [] };

    Object.entries(scope).forEach(([k, v]) => {
      args.names.push(k);
      args.values.push(v);
    });

    let fn = new Function(args.names.join(', '), code);

    if (thisObject) {
      fn = fn.bind(thisObject);
    }

    return fn(...args.values);
  }

  setupSessionSocket() {
    this.socketSessionId = global.clientUtils.randomString();
    document.cookie = `socketSessionId=${this.socketSessionId};path=/`

    const port = 4583;
    const sessionSocket = new WebSocket(`ws://${location.hostname}:${port}/client-session`);

    sessionSocket.onopen = () => {
      const data = {
        op: 'init',
        sessionId: this.socketSessionId,
      }

      sessionSocket.send(JSON.stringify(data));
      this.logger.info(`Initialized new client session; id=${this.socketSessionId}`);
    };

    sessionSocket.onmessage = (event) => {
      const { op, path, value } = JSON.parse(event);



    };

    this.sessionSocket = sessionSocket;
  }

  async start({
    rootComponent, data, testMode,
  }) {

    if (testMode == '{{testMode}}') {
      testMode = true;
    }

    this.testMode = testMode;

    if (!AppContext.#initialized) {
      await this.loadDependencies();

      if (!testMode) {
        this.setupSessionSocket();
      }
    }

    await this.loadEnums();

    await this.loadComponentClasses(rootComponent);

    let id;

    if (testMode) {
      const samples = self.Samples[rootComponent];

      data = samples[
        self.clientUtils.getRandomInt(0, samples.length - 1)
      ];

      self.SampleData = data;

    } else {
      assert(!!data && data instanceof Function);
      data = data();

      id = data.id;
      delete data.id;
    }

    const container = document.createElement('div');
    container.id = 'app-container';
    container.style.display = 'contents';

    document.body.appendChild(container);

    // eslint-disable-next-line no-new
    const component = new self.components[rootComponent]({
      id, input: data, testMode,
    });

    if (testMode) {
      self.Component = component;
    }

    return component.load({ container: container.id })
      .then(() => {
        if (!AppContext.#initialized) {
          AppContext.#initialized = true;
        }
      });
  }

  getDependencies() {
    return [
      '/assets/js/client-bundle.min.js',
      { url: '/assets/js/client-utils.min.js', namespace: 'clientUtils' },
      // 'https://cdn.jsdelivr.net/npm/handlebars@4.7.6/dist/handlebars.runtime.min.js',
      { url: '/assets/js/cdn/handlebars.runtime.min.js', namespace: 'Handlebars' },
      { url: '/assets/js/custom-ctx-helpers.min.js', namespace: 'customCtxHelpers' },
      '/assets/js/proxy.min.js',
      '/assets/js/base-renderer.min.js',
      '/assets/js/root-ctx-renderer.min.js',
      '/assets/js/custom-ctx-renderer.min.js',
      '/assets/js/web-renderer.min.js',
      '/assets/js/base-component.min.js',
    ];
  }

  loadDependencies() {
    return this.fetchAll(this.getDependencies());
  }

  loadEnums() {
    return this.fetch({
      url: '/components/enums.json', asJson: true
    }).then(enums => {
      self.appContext.enums = enums;
    });
  }

  async loadComponentClasses(rootComponent) {

    const { lazyLoadComponentTemplates } = AppContext;

    const list = await this.fetch({
      url: '/components/list.json',
      asJson: true,
    });

    self.components = {};
    self.templates = {};

    const loadComponentClass = (name, assetId, tpl, src, testSrc, config) => {

      const componentClass = this.processScript({
        contents: src,
      });

      self.components[name] = componentClass;

      if (testSrc) {
        // If we are in test mode, load component test classes, to override the main ones
        const componentTestClass = this.processScript({
          contents: testSrc, scope: {
            require: (module) => {
              switch (module) {
                case './index':
                  return self.components[name];
                default:
                  // this.logger.warn(`Unable to load module "${module}" in the browser, returning null`);
                  return null;
              }
            }
          },
        });

        // When serializing, toJSON(...) should use the actual className, not the test class
        componentTestClass.className = name;

        self.components[name] = componentTestClass;
      }

      RootProxy.getGlobalSchemasObject()[name] = config.schema;
    }

    return Promise.all(
      Object.keys(list).map((name) => {
        const assetId = list[name];
        return Promise.all([
          name,
          assetId,
          lazyLoadComponentTemplates ? Promise.resolve() : this.fetch(`/components/${assetId}/metadata.min.js`),

          this.fetch({
            url: `/components/${assetId}/index.min.js`,
            process: false,
          }),

          this.testMode ? this.fetch({
            url: `/components/${assetId}/index.test.min.js`,
            process: false,
          }) : null,

          this.fetch({
            url: `/components/${assetId}/config.json`,
            asJson: true,
          }),
        ]);
      }))
      .then(async (components) => {
        self.Samples = {};

        await Promise.all(
          components.map(async (args) => {
            loadComponentClass(...args);

            const [name, assetId] = args;

            if (this.testMode && name == rootComponent) {
              self.Samples[name] = await this.fetch(`/components/${assetId}/samples.js`);
            }
          })
        )
      });
  }

  processScript({ contents, scope, namespace }) {
    const { evaluate, unsafeEval } = AppContext;

    const result = unsafeEval(contents, scope);

    // eslint-disable-next-line default-case
    switch (true) {
      case result instanceof Function:
        namespace = namespace || result.name;

      case result instanceof Object && !!namespace:
        evaluate(
          `self.${namespace} = result;`,
          { result }
        );
        break;
    }

    return result;
  }

  async fetch(req) {
    const [res] = await this.fetchAll([req]);
    return res;
  }

  async fetchAll(reqArray) {

    const fetchFn = async ({ url, asJson }) => {
      const resourceType = asJson ? 'json' : 'text';

      const loadedResources = AppContext.#loadedResources;
      const cached = loadedResources[url] || (loadedResources[url] = {})

      if (!cached[resourceType]) {
        const data = await self.fetch(
          `${url}`, { method: 'GET' }
        );

        if (data.ok) {
          // this.logger.info(`Loaded ${url} [REMOTE]`);

          cached[resourceType] = {
            contents: await data[resourceType](),
          };
        } else {
          throw Error(data.statusText);
        }
      } else {
        // this.logger.info(`Loaded ${url} [CACHED]`);
        cached[resourceType].cached = true;
      }

      return cached[resourceType];
    }

    const processFn = ({ response, url, asJson, namespace, process }) => {

      const {
        contents, cached, namespace: ns
      } = response;

      let result = contents;

      if (!asJson && process) {

        if (cached &&
          // The namespace needs to match for us to know that res.module is what 
          // the developer intended to load
          ns === namespace
        ) {

          // this.logger.info(`Processed ${url} [CACHED]`);
          result = response.module;
        } else {

          result = this.processScript({ contents, namespace });
          // this.logger.info(`Processed ${url} [REMOTE]`);

          response.module = result;
          response.namespace = namespace;
        }
      }

      return result;
    }

    return Promise.all(
      reqArray
        .map((req) => {
          if (typeof req === 'string') {
            req = { url: req };
          }
          return req;
        })
        .map(async ({ url, asJson, namespace, process = true }) => ({
          response: await fetchFn({ url, asJson }),
          url, asJson, namespace, process,
        }))
    ).then(responses => {
      const result = [];

      for (const { response, url, asJson, namespace, process } of responses) {
        result.push(
          processFn({ response, url, asJson, namespace, process })
        );
      }

      return result;
    });
  }
}

module.exports = AppContext;