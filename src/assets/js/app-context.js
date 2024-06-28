/* eslint-disable no-case-declarations */
/* eslint-disable no-eval */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-param-reassign */
class AppContext {

  static INITIAL_LOAD_TIME_SEC = 4.5;

  // com.kylantis.pfe-v1.session_metadata
  static DB_NAME_PREFIX = 'k.ui';

  static DB_COUNT = 5;
  static BUCKET_COUNT_PER_DB = 50;
  static CONNECTIONS_PER_DB = 1;

  static #staticFilePattern = /\.(?:[a-zA-Z0-9]+)(\?.*)?$/i;

  #logger;
  #userGlobals;
  #staticCache;

  #dbSpec;

  #dbConnections = {}
  #dbWorkers = {};

  #finalizers = [];
  #loaded;

  constructor({ logger, userGlobals }) {

    this.#logger = logger;
    this.#userGlobals = (userGlobals == '{{userGlobals}}') ? {} : userGlobals;
    this.#staticCache = new K_Cache('static-cache', 1);

    this.testMode = window.location.hostname == 'localhost';

    Object.defineProperty(self, 'appContext', {
      value: this, configurable: false, writable: false,
    });

    this.#addPolyfills();

    this.#readUserGlobals();
  }

  isLoaded() {
    return this.#loaded;
  }

  getLogger() {
    return this.#logger;
  }

  getUserGlobals() {
    return this.#userGlobals;
  }

  #addPolyfills() {
    self.assert = (condition, message) => {
      if (!condition) {
        throw Error(`Assertion Error${message ? `: ${message}` : ''}`);
      }
    };

    self.global = self;
  }

  #readUserGlobals() {
    const { DB_COUNT, BUCKET_COUNT_PER_DB, CONNECTIONS_PER_DB } = this.#userGlobals;

    if (typeof DB_COUNT == 'number') {
      AppContext.DB_COUNT = DB_COUNT;
    }

    if (typeof BUCKET_COUNT_PER_DB == 'number') {
      AppContext.BUCKET_COUNT_PER_DB = BUCKET_COUNT_PER_DB;
    }

    if (typeof CONNECTIONS_PER_DB == 'number') {
      AppContext.CONNECTIONS_PER_DB = CONNECTIONS_PER_DB;
    }
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

  #setupSessionSocket() {
    return;

    this.socketSessionId = global.clientUtils.randomString('ungrouped');
    document.cookie = `socketSessionId=${this.socketSessionId};path=/`

    const port = 4583;
    const sessionSocket = new WebSocket(`ws://${location.hostname}:${port}/client-session`);

    sessionSocket.onopen = () => {
      const data = {
        op: 'init',
        sessionId: this.socketSessionId,
      }

      sessionSocket.send(JSON.stringify(data));
      this.#logger.info(`Initialized new client session; id=${this.socketSessionId}`);
    };

    sessionSocket.onmessage = (event) => {
      const { op, path, value } = JSON.parse(event);

    };

    this.sessionSocket = sessionSocket;
  }

  #getNextDatabase(groupName) {
    const group = this.#dbSpec.groups[groupName];
    const { databases } = group;

    group.currentIndex++;

    if (group.currentIndex == databases.length) {
      group.currentIndex = 0;
    }

    return databases[group.currentIndex];
  }

  #getNextBucket(dbName, groupName) {
    const group = this.#dbSpec.spec[dbName].groups[groupName];
    const { bucketNames } = group;

    group.currentIndex++;

    if (group.currentIndex == bucketNames.length) {
      group.currentIndex = 0;
    }

    return bucketNames[group.currentIndex];
  }

  #getNextConnection(dbName) {
    const database = this.#dbConnections[dbName];
    const { connections } = database;

    database.currentIndex++;

    if (database.currentIndex == connections.length) {
      database.currentIndex = 0;
    }

    return connections[database.currentIndex];
  }

  getDbInfo(groupName) {
    const dbName = this.#getNextDatabase(groupName);

    return {
      dbName,
      bucketName: this.#getNextBucket(dbName, groupName),
    }
  }

  getDbWorker(dbName) {
    return this.#dbWorkers[dbName];
  }

  getDatabaseConnection(dbName) {
    return this.#getNextConnection(dbName);
  }

  #idbOpenRequestToPromise(openRequest) {
    return new Promise((resolve, reject) => {
      openRequest.onerror = event => reject(event.target.error);
      openRequest.onsuccess = event => {
          resolve(event.target.result);
      };
    });
  }

  async #pruneExistingDatabases() {
    const { DB_NAME_PREFIX } = AppContext;

    const databases = await self.indexedDB.databases();
    const promises = [];

    databases.forEach(({ name }) => {
      if (name.startsWith(DB_NAME_PREFIX)) {
        promises.push(
          this.#idbOpenRequestToPromise(
            self.indexedDB.deleteDatabase(name)
          )
        );
      }
    });

    return Promise.all(promises);
  }

  async start({ rootComponent, data }) {
    await Promise.all([
      this.#setupSessionSocket(),
      this.#loadDependencies(),
      this.#loadEnums(),
    ]);


    const componentsInfo = await this.#loadComponentClasses();

    setTimeout(() => {
      this.#pruneExistingDatabases();
    }, AppContext.INITIAL_LOAD_TIME_SEC * 1000);

    const startTime = performance.now();
    await this.#setupDatabases(componentsInfo);
    const endTime = performance.now()

    this.#logger.info(`DB setup completed after ${endTime - startTime} milliseconds`);


    this.#finalizers.forEach(fn => {
      fn();
    });
    this.#finalizers = null;

    this.#setupComponentsNodePruneTask();

    this.#loadRootComponent(
      rootComponent, componentsInfo[rootComponent].assetId, data,
    ).then(() => {


      // start moving moving in memory records to real indexeddb


    });
  }

  #setupComponentsNodePruneTask() {
    setInterval(() => {
      Object.entries(global.components).forEach(([k, { instanceIndex }]) => {

        for (let i = 0; i <= instanceIndex; i++) {
          // see BaseRenderer.#createId()
          const id = `${k}_${i}`;

          if (!document.querySelector(`[__component='${id}']`)) {
            RootCtxRenderer.onComponentNodeRemoved(id);
          }
        }
      })
    }, 60 * 5 * 1000);
  }

  #getDbQuotaScore(componentsInfo) {
    const refCount = {};

    const addComponentRefCount = (className) => {
      const { hspuMetadata: { componentRefCount } } = componentsInfo[className].config;

      refCount[className]++;

      Object.entries(componentRefCount).forEach(([k, v]) => {
        assert(Number.isSafeInteger(v));

        const execIteration = (k == className) ? () => {
          refCount[className]++;
        } : () => {
          addComponentRefCount(k);
        };

        for (let i = 0; i < v; i++) {
          execIteration();
        }
      });
    }

    Object.keys(componentsInfo).forEach(n => {
      refCount[n] = 0;
    })

    Object.keys(componentsInfo).forEach(className => {
      addComponentRefCount(className);
    });

    const quotaScore = {};

    Object.entries(refCount).forEach(([k, v]) => {
      const { hspuMetadata: { size }, isAbstract } = componentsInfo[k].config;
      quotaScore[k] = v * ((isAbstract && size > 1) ? 1 : size);
    });

    return quotaScore;
  }

  #throwError(msg) {
    alert(msg);
    throw Error(msg);
  }

  async #setupDatabases(componentsInfo) {
    const { DB_COUNT, BUCKET_COUNT_PER_DB, DB_NAME_PREFIX } = AppContext;
    const { getRandomInt, scaleArrayToTotal } = clientUtils;

    if (BUCKET_COUNT_PER_DB < DB_COUNT || BUCKET_COUNT_PER_DB % DB_COUNT != 0) {
      this.#throwError(`Incorrect DB params specified`);
    }

    const totalBucketCount = DB_COUNT * BUCKET_COUNT_PER_DB;

    const quotaScore = this.#getDbQuotaScore(componentsInfo);
    const quotaScoreEntries = Object.entries(quotaScore);

    if (totalBucketCount < quotaScoreEntries.length) {
      this.#throwError(`Expected totalBucketCount to be at least ${quotaScoreEntries.length}`);
    }

    const storesToCreate = scaleArrayToTotal(
      quotaScoreEntries.map(([k, v]) => v), totalBucketCount,
    );

    assert(quotaScoreEntries.length == storesToCreate.length);

    const bucketsQuota = {};

    quotaScoreEntries.forEach(([k, v], i) => {
      bucketsQuota[k] = storesToCreate[i];
    });

    const _buckets = [];

    Object.entries(bucketsQuota).forEach(([k, v]) => {
      for (let i = 0; i < v; i++) {
        _buckets.push({
          bucketName: `${k}_Bucket_${i}`, groupName: k,
        });
      }
    });

    assert(_buckets.length == totalBucketCount);


    const dbNames = [];

    for (let i = 0; i < DB_COUNT; i++) {
      dbNames.push(`${DB_NAME_PREFIX}_${getRandomInt(0, 100000)}`);
    }

    const dbSpec = {
      groups: {},
      spec: {},
    };

    while (_buckets.length) {

      for (let i = 0; i < DB_COUNT; i++) {

        const { groups } = dbSpec;
        const dbName = dbNames[i];

        const { bucketName, groupName } = _buckets.pop();

        if (!groups[groupName]) {
          groups[groupName] = {
            databases: [], currentIndex: -1,
          };
        }

        groups[groupName].databases.push(dbName);

        if (!dbSpec.spec[dbName]) {
          dbSpec.spec[dbName] = { bucketNames: [] }
        }

        dbSpec.spec[dbName].bucketNames.push(bucketName);
      }
    }

    Object.entries(dbSpec.groups)
      .forEach(([k, { databases }]) => {
        dbSpec.groups[k].databases = [...new Set(databases)];
      });


    const promises = [];

    Object.entries(dbSpec.spec).forEach(([k, v]) => {
      const { bucketNames } = v;
      const groups = {};

      let storeInfoList = [];

      bucketNames.forEach(bucketName => {
        const [groupName] = bucketName.split('_');

        if (!groups[groupName]) {
          groups[groupName] = {
            bucketNames: [], currentIndex: -1,
          }
        }

        groups[groupName].bucketNames.push(bucketName);

        storeInfoList = [
          ...storeInfoList,
          ...[{
            storeName: `${bucketName}_mustache_statements`,
            indexedColumns: ['groupId'],
          },
          {
            storeName: `${bucketName}_hook_list`,
            indexedColumns: [
              'owner', 'participants', 'arrayBlockPath', 'attrValueGroupId'
            ],
          }],
        ];
      });

      delete v.bucketNames;
      v.groups = groups;

      promises.push(
        this.#createDatabaseConnections(k, storeInfoList, promises)
          .then(() => this.#createDbWorker(k))
      );
    });

    await Promise.all(promises);

    // const dbSpec = {
    //   groups: {
    //    [groupName]: {
    //     databases: [...],
    //     currentIndex: -1,
    //    }
    //   },
    //   spec: {
    //     ...
    //     [dbName]: {
    //       bucketNames: [...],
    //       groups: {
    //         // amounting to BUCKET_COUNT_PER_DB total
    //         ComponentA: {
    //           bucketNames: ['bucket1', 'bucket2'],
    //           currentIndex: -1,
    //         },
    //       }
    //     }
    //   },
    //   currentIndex: -1,
    // }

    this.#dbSpec = dbSpec;
  }

  getDbSpec() {
    return this.#dbSpec;
  }

  async #createDbWorker(dbName) {
    const worker = new Worker('/assets/js/web_workers/db_web_worker.min.js');
    this.#dbWorkers[dbName] = worker;

    return RootProxy.runTask(
      worker, 'connectDatabase', dbName,
    )
  }

  async #createDatabaseConnections(dbName, storeInfoList, promises) {
    const { CONNECTIONS_PER_DB } = AppContext;

    if (CONNECTIONS_PER_DB < 1) {
      this.#throwError(`"CONNECTIONS_PER_DB" must be >= 1`);
    }

    const connections = [];

    const connection = new K_IndexedDB(dbName);
    await connection.connect(storeInfoList);

    connections.push(connection);

    for (let i = 1; i < CONNECTIONS_PER_DB; i++) {
      const connection = new K_IndexedDB(dbName);

      promises.push(
        connection.connect()
      )

      connections.push(connection);
    }

    this.#dbConnections[dbName] = {
      currentIndex: -1, connections,
    }
  }

  #getDependencies() {
    return [
      '/assets/js/lib/event_handler.min.js',
      '/assets/js/lib/indexed_db.min.js',
      '/assets/js/lib/trie.min.js',
      // '/assets/js/data/interned_strings_6480.js',

      '/assets/js/client-bundle.min.js',
      { url: '/assets/js/client-utils.min.js', namespace: 'clientUtils' },
      { url: '/assets/js/template-runtime.min.js', namespace: 'TemplateRuntime' },
      { url: '/assets/js/custom-ctx-helpers.min.js', namespace: 'customCtxHelpers' },
      '/assets/js/proxy.min.js',
      '/assets/js/base-renderer.min.js',
      '/assets/js/root-ctx-renderer.min.js',
      '/assets/js/custom-ctx-renderer.min.js',
      '/assets/js/web-renderer.min.js',
      '/assets/js/base-component.min.js',
      { url: '/assets/js/web_workers/db_web_worker.min.js', process: false },
    ];
  }

  #loadDependencies() {
    return this.fetchAll(this.#getDependencies());
  }

  #loadEnums() {
    return this.fetch({
      url: '/components/enums.json', asJson: true
    }).then(enums => {
      self.appContext.enums = enums;
    });
  }

  #loadComponentClass(name, assetId, config, metadata, src, testSrc) {
    const componentClass = this.#processScript({
      contents: src,
    });

    self.components[name] = componentClass;

    if (testSrc) {
      // If we are in test mode, load component test classes, to override the main ones
      const componentTestClass = this.#processScript({
        contents: testSrc, scope: {
          require: (module) => {
            switch (module) {
              case './index':
                return self.components[name];
              default:
                // this.#logger.warn(`Unable to load module "${module}" in the browser, returning null`);
                return null;
            }
          }
        },
      });

      // When serializing, toJSON(...) should use the actual className, not the test class
      componentTestClass.className = name;

      self.components[name] = componentTestClass;
    }

    self.components[name].schema = config.schema;
    self.components[name].metadata = metadata;
  }

  #pruneComponentConstructor(className) {
    const constructor = self.components[className];

    delete constructor.schema;
    delete constructor.metadata;
  }

  async #loadComponentClasses() {
    const { testMode } = this;

    const list = await this.fetch({
      url: '/components/list.json',
      asJson: true,
    });

    self.components = {};
    self.templates = {};

    const componentsInfo = await Promise.all(
      Object.keys(list).map((name) => {
        const assetId = list[name];
        return Promise.all([
          name,
          assetId,
          this.fetch({
            url: `/components/${assetId}/config.json`,
            asJson: true,
          }),
          this.fetch({
            url: `/components/${assetId}/metadata.min.js`,
          }),
          this.fetch({
            url: `/components/${assetId}/index.min.js`,
            process: false,
          }),
          testMode ? this.fetch({
            url: `/components/${assetId}/index.test.min.js`,
            process: false,
          }) : null,
        ]);
      }))
      .then(componentsData => {
        const componentsInfo = {};

        componentsData.forEach(async (args) => {
          this.#loadComponentClass(...args);

          const [name, assetId, config] = args;
          componentsInfo[name] = { assetId, config };
        })

        return componentsInfo;
      });

    this.#addComponentConstructorPruneFinalizer(
      Object.keys(self.components)
    );

    return componentsInfo;
  }

  #addComponentConstructorPruneFinalizer(componentNames) {
    const { INITIAL_LOAD_TIME_SEC } = AppContext;

    this.#finalizers.push(() => {
      setTimeout(() => {
        componentNames
          .forEach(name => {
            this.#pruneComponentConstructor(name)
          });
      }, INITIAL_LOAD_TIME_SEC * 1000);
    });
  }

  async #loadRootComponent(rootComponent, assetId, data) {
    const { testMode } = this;

    let component;

    if (testMode) {
      const sampleData = await this.fetch(`/components/${assetId}/samples.js`);

      component = new self.components[rootComponent]({
        input:
          sampleData[
          self.clientUtils.getRandomInt(0, sampleData.length - 1)
          ],
      });

    } else {

      assert(typeof data == 'function');
      component = data();
    }

    const container = document.createElement('div');
    container.id = 'app-container';
    container.style.display = 'contents';

    document.body.appendChild(container);

    this.#loaded = true;
    this.rootComponent = component;

    return component.load({ container: `#${container.id}` });
  }

  #processScript({ contents, scope, namespace }) {
    const { evaluate, unsafeEval } = AppContext;

    const result = unsafeEval(contents, scope);

    // eslint-disable-next-line default-case
    switch (true) {
      case result instanceof Function:
        namespace = namespace || result.name;

      case result instanceof Object && !!namespace:
        evaluate(
          `self['${namespace}'] = result;`,
          { result }
        );
        break;
    }

    return result;
  }

  async fetch(req, useCache = true) {
    const [res] = await this.fetchAll([req], useCache);
    return res;
  }

  async fetchAll(reqArray, useCache = true) {

    const fetchFn = async ({ url, asJson }) => {
      const resourceType = asJson ? 'json' : 'text';

      const args = [url, { method: 'GET' }];

      const data = await (
        url.match(AppContext.#staticFilePattern) ?
          useCache ? this.#staticCache.fetchWithCache(...args) : this.#staticCache.addToCache(...args) :
          self.fetch(...args)
      );

      if (data.ok) {
        return await data[resourceType]();
      } else {
        throw Error(data.statusText);
      }
    }

    const processFn = ({ response, url, asJson, namespace, process }) => {
      return (!asJson && process) ?
        this.#processScript({ contents: response, namespace }) :
        response;
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