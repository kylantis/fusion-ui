/* eslint-disable no-case-declarations */
/* eslint-disable no-eval */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-param-reassign */
class AppContext {
  static lazyLoadComponentTemplates = false;

  static #initialized;
  static #loadedResources = {};

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

    self.module = {
      exports: {},
    };

    // This is needed for loading component metadata.min.js files
    // because they reference global, i.e. global['metadata_abstract_component']
    self.global = self;

    Object.defineProperty(self, 'appContext', {
      value: this, configurable: false, writable: false,
    });
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

    await this.loadComponentClasses({ rootComponent });

    let id;

    if (testMode) {
      data = self.Samples[
        self.clientUtils.getRandomInt(0, self.Samples.length - 1)
      ];
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
      { url: '/assets/js/client-utils.min.js', namespace: 'clientUtils' },
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

  async loadComponentClasses({ rootComponent }) {

    const { lazyLoadComponentTemplates } = AppContext;

    const list = await this.fetch({
      url: '/components/list.json',
      asJson: true,
    });

    let rootAssetId;
    self.components = {};

    const loadComponentClass = (name, assetId, tpl, src, testSrc, config) => {

      const componentClass = this.processScript({
        contents: src,
      });

      self.components[name] = componentClass;

      if (testSrc) {
        // If we are in test mode, load component test classes, to override the main ones
        const inlineScope = ` const require = (module) => {

        switch(module) {
          case './index':
            return self.components['${name}'];
          default:
            throw Error('Cannot load module: ${module}');
        }
      };
      `;

        const componentTestClass = this.processScript({
          contents: testSrc, inlineScope,
        });

        // When serializing, toJSON(...) should use the actual className, not the test class
        componentTestClass.className = name;

        self.components[name] = componentTestClass;
      }

      self.components[name].schema = config.schema;

      if (name === rootComponent) {
        rootAssetId = assetId;
      }
    }

    return Promise.all(
      Object.keys(list).map((name) => {
        const assetId = list[name];
        return Promise.all([
          name,
          assetId,
          lazyLoadComponentTemplates ? Promise.resolve() : this.fetch(`/components/${assetId}/metadata.min.js`),

          this.fetch({
            url: `/components/${assetId}/index.js`,
            process: false,
          }),

          this.testMode ? this.fetch({
            url: `/components/${assetId}/index.test.js`,
            process: false,
          }) : null,

          this.fetch({
            url: `/components/${assetId}/config.json`,
            asJson: true,
          }),

        ]);
      }))
      .then(async (components) => {

        for (const [name, assetId, tpl, componentSrc, testComponentSrc, config] of components) {
          loadComponentClass(name, assetId, tpl, componentSrc, testComponentSrc, config);
        }

        assert(!!rootAssetId, `Unknown root component: ${rootComponent}`);

        if (!this.testMode) {
          return;
        }

        self.Samples = await this.fetch(`/components/${rootAssetId}/samples.js`);
      });
  }

  processScript({ contents, inlineScope, namespace }) {

    if (inlineScope) {
      contents = `${inlineScope}${contents}`;
    }

    const exports = {};
    // eslint-disable-next-line no-unused-vars
    const module = { exports };

    const result = eval(contents);

    // eslint-disable-next-line default-case
    switch (true) {
      case result instanceof Function:
        namespace = namespace || result.name;

      case result instanceof Object && !!namespace:
        eval(`self.${namespace} = result;`);
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

    const processFn = ({ response, url, asJson, namespace, inlineScope, process }) => {

      const {
        contents, cached, inlineScope: scope, namespace: ns
      } = response;

      let result = contents;

      if (!asJson && process) {

        if (cached &&
          // The namespace and inlineScope needs to match for us to know that 
          // res.module what the developer intended to load
          scope === inlineScope &&
          ns === namespace
        ) {

          // this.logger.info(`Processed ${url} [CACHED]`);
          result = response.module;
        } else {

          result = this.processScript({ contents, inlineScope, namespace });
          // this.logger.info(`Processed ${url} [REMOTE]`);

          response.module = result;

          response.inlineScope = inlineScope;
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
        .map(async ({ url, asJson, namespace, inlineScope, process = true }) => ({
          response: await fetchFn({ url, asJson }),
          url, asJson, namespace, inlineScope, process,
        }))
    ).then(responses => {
      const result = [];

      for (const { response, url, asJson, namespace, inlineScope, process } of responses) {
        result.push(
          processFn({ response, url, asJson, namespace, inlineScope, process })
        );
      }

      return result;
    });
  }
}
