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

  #loadedStyles = [];
  #loadedScripts = [];

  #logger;
  #userGlobals;
  #staticCache;

  #assetId;
  #className;
  #parents;
  #rootComponent;
  #componentList;

  #alphaList = {};
  #omegaList = {};

  #bootConfigs = {};
  #refMetadata;

  #dbSpec;

  #dbConnections = {}
  #dbWorkers = {};

  #finalizers = [];
  #loaded;

  #indexedDbReady = false;

  constructor({ logger, userGlobals, assetId, className, parents, bootConfig, componentList }) {

    this.#logger = logger;
    this.#userGlobals = (userGlobals == '{{userGlobals}}') ? {} : userGlobals;
    this.#staticCache = new K_Cache('static-cache', 1);

    this.#assetId = assetId;
    this.#className = className;
    this.#parents = parents;

    this.#bootConfigs[className] = bootConfig;
    this.#componentList = this.#parseComponentList(componentList);

    this.testMode = window.location.hostname == 'localhost';

    Object.defineProperty(self, 'appContext', {
      value: this, configurable: false, writable: false,
    });

    this.#addPolyfills();

    this.#readUserGlobals();
  }

  #parseComponentList(str) {
    const markerStart = '<componentList>';
    const markerEnd = '</componentList>';

    const jsonStr = str.substring(markerStart.length, str.length - markerEnd.length);
    return JSON.parse(jsonStr);
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

  getRootComponent() {
    return this.#rootComponent;
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

    const DEF = {};

    const exports = DEF;
    const module = { exports };

    const r = eval(code);

    if (module.exports.__esModule) {
      return module.exports.default || exports;
    }

    return (module.exports != DEF) ? module.exports : r;
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

    if (!this.#indexedDbReady) {
      return connections[0];
    }

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
    return this.#indexedDbReady ? this.#dbWorkers[dbName] : null;
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

  #findAllComponentClassesInSampleString(sampleString) {
    const word = ` new components['`;
    const classNames = {};

    AppContext.#findWordMatches(sampleString, word)
      .forEach(i => {
        let buf = '';
        let c;

        let idx = i + word.length;

        while ((c = sampleString[idx]) != '\'') {
          buf += c;
          idx++;
        }

        classNames[buf] = true;
      });

    return Object.keys(classNames);
  }

  async load({ data, dynamicBootConfig, runtimeBootConfig }) {

    let htmlDepsPromise;
    let alphaListPromise;
    let alphaBootConfigsPromise;

    const samplesStringPromise = this.testMode ?
      this.fetch({ url: `/components/${this.#assetId}/samples.js`, process: false }) :
      null;

    const baseDepsPromise = this.#loadBaseDependencies();
    const enumPromise = this.#loadEnums();

    const depsPromise = this.#loadDependencies();
    const sessionSocketPromise = this.#setupSessionSocket();


    const loadBootConfig = (bootConfig) => {
      htmlDepsPromise = this.#loadCssAndJsDependencies(bootConfig);
      alphaListPromise = Promise.resolve();

      alphaBootConfigsPromise = Promise.all(
        Object.entries(bootConfig.renderTree)
          .map(([assetId, className]) => {
            this.#alphaList[className] = assetId;
            return this.#addBootConfig(assetId, className)
          })
      );

      this.#alphaList[this.#className] = this.#assetId;
    }

    if (dynamicBootConfig) {
      if (this.testMode) {

        let htmlDepsResolve;
        let alphaListResolve;
        let alphaBootConfigsResolve;

        htmlDepsPromise = new Promise(resolve => htmlDepsResolve = resolve);
        alphaListPromise = new Promise(resolve => alphaListResolve = resolve);
        alphaBootConfigsPromise = new Promise(resolve => alphaBootConfigsResolve = resolve);

        samplesStringPromise.then(sampleString => {

          const classNames = [...new Set([
            ...this.#findAllComponentClassesInSampleString(sampleString),
            ...[...this.#parents].reverse(),
          ])];

          const htmlDepsPromises = [];

          let cssDeps = {};
          let jsDeps = {};

          Promise.all(
            classNames.map(async className => {
              if (className == this.#className) return;

              const assetId = this.#componentList[className];
              const bootConfig = await this.#addBootConfig(assetId, className);

              const _bootConfigPromises = [];

              Object.entries(bootConfig.renderTree)
                .forEach(([assetId, className]) => {
                  this.#alphaList[className] = assetId;

                  _bootConfigPromises.push(
                    this.#addBootConfig(assetId, className)
                  )
                });

              const cssDependencies = bootConfig.cssDependencies
                .filter(({ url }) => !cssDeps[url])
                .map(dep => {
                  cssDeps[dep.url] = true;
                  return dep;
                });

              const jsDependencies = bootConfig.jsDependencies
                .filter(({ url }) => !jsDeps[url])
                .map(dep => {
                  jsDeps[dep.url] = true;
                  return dep;
                });

              htmlDepsPromises.push(
                this.#loadCssAndJsDependencies({ cssDependencies, jsDependencies })
              );

              await Promise.all(_bootConfigPromises);
            })
          )
            .then(() => {
              classNames.forEach(className => {
                const assetId = this.#componentList[className];
                this.#alphaList[className] = assetId;
              });
              this.#alphaList[this.#className] = this.#assetId;

              alphaListResolve();
              alphaBootConfigsResolve();

              Promise.all(htmlDepsPromises).then(() => {
                htmlDepsResolve();
              });
            });
        })

      } else {
        loadBootConfig(runtimeBootConfig)
      }
    } else {
      loadBootConfig(
        this.#bootConfigs[this.#className]
      )
    }

    const omegaBootConfigsPromise = alphaListPromise
      .then(() => Promise.all(
        Object.entries(this.#componentList)
          .filter(([className]) => !this.#alphaList[className])
          .map(([className, assetId]) => {
            this.#omegaList[className] = assetId;
            return this.#addBootConfig(assetId, className)
          })
      )
      );


    self.components = {};

    const alphaComponentClassesPromise = alphaListPromise
      .then(() => this.#loadComponentClasses(this.#alphaList, baseDepsPromise));

    const samplesPromise = alphaComponentClassesPromise.then(async () => {
      if (this.testMode) {
        return AppContext.unsafeEval(await samplesStringPromise);
      }
    });

    const dbSetupPromise = Promise.all([alphaBootConfigsPromise, omegaBootConfigsPromise, baseDepsPromise])
      .then(() => {

        setTimeout(() => {
          this.#pruneExistingDatabases();
        }, AppContext.INITIAL_LOAD_TIME_SEC * 1000);

        const startTime = performance.now();
        this.#setupDatabases();
        const endTime = performance.now()

        this.#logger.info(`DB setup completed after ${endTime - startTime} milliseconds`);
      });


    // htmlDepsPromise
    await Promise.all([alphaComponentClassesPromise, dbSetupPromise, enumPromise, depsPromise, sessionSocketPromise])


    await this.#loadRootComponent(data, await samplesPromise);


    this.#setupComponentsNodePruneTask();

    this.#finalizers.forEach(fn => {
      fn();
    });

    this.#finalizers = null;
    this.#bootConfigs = null;
    this.#refMetadata = null;

    setTimeout(async () => {
      console.info('start connectDatabase');

      await this.#connectDatabase();

      console.info('finish connectDatabase');
    }, 10000);
  }

  async #connectDatabase() {

    await Promise.all(
      Object.entries(this.#dbConnections)
        .map(([dbName, { connections }]) =>
          connections[0].createPersistenceLayer()
            .then(() => {
              const promises = [];

              for (let i = 1; i < connections.length; i++) {
                promises.push(
                  connections[i].createPersistenceLayer()
                );
              }

              promises.push(
                this.#createDbWorker(dbName)
              );

              return Promise.all(promises);
            }))
    );

    this.#indexedDbReady = true;
  }

  #loadComponentClasses(list, preLoadPromise) {
    return this.#fetchComponentsData(list)
      .then(async (componentsData) => {

        if (preLoadPromise) {
          await preLoadPromise;
        }

        componentsData.forEach(([...args]) => {
          this.#loadComponentClass(...args);
        });

        this.#addComponentConstructorPruneFinalizer(
          Object.keys(list)
        );
      });
  }

  #setupComponentsNodePruneTask() {
    setInterval(() => {
      Object.entries(self.components).forEach(([k, { instanceIndex }]) => {

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

  #getRefMetadata() {
    if (this.#refMetadata) return this.#refMetadata;

    const refCount = {};
    const tree = {};

    const addComponentRefCount = (parents, className) => {
      const { hspuMetadata: { componentRefCount } } = this.#bootConfigs[className];

      refCount[className]++;

      if (parents) {
        parents = [...parents, className];
      }

      Object.entries(componentRefCount).forEach(([k, v]) => {
        assert(Number.isSafeInteger(v) && v > 0);

        if (parents) {
          parents.forEach(p => {
            tree[p].push(k);
          });
        }

        const execIteration = (k == className) ? () => {
          refCount[className]++;
        } : (i) => {
          addComponentRefCount((i == 0) ? parents : null, k);
        };

        for (let i = 0; i < v; i++) {
          execIteration(i);
        }
      });
    }

    Object.keys(this.#bootConfigs).forEach(className => {
      refCount[className] = 0;
      tree[className] = []
    });

    Object.keys(this.#bootConfigs).forEach(className => {
      addComponentRefCount([], className);
    });

    Object.keys(this.#bootConfigs).forEach(className => {
      tree[className] = [...new Set(tree[className])]
    });

    this.#refMetadata = { refCount, tree };
    return this.#refMetadata;
  }

  #loadCssAndJsDependencies(bootConfig) {
    const { cssDependencies, jsDependencies } = bootConfig;

    return Promise.all([
      this.loadCSSDependencies(cssDependencies),
      this.loadJSDependencies(jsDependencies)
    ]);
  }

  #fetchBootConfig(assetId) {
    return this.fetch({
      url: `/components/${assetId}/boot-config.json`, asJson: true,
    });
  }

  async #addBootConfig(assetId, className) {
    let bootConfig = this.#bootConfigs[className];

    if (!bootConfig) {
      bootConfig = await this.#fetchBootConfig(assetId);
      this.#bootConfigs[className] = bootConfig;
    }

    return bootConfig;
  }

  #getDbQuotaScore() {
    const { refCount } = this.#getRefMetadata();

    const quotaScore = {};

    Object.entries(refCount).forEach(([k, v]) => {
      const { hspuMetadata: { size }, isAbstract } = this.#bootConfigs[k];
      quotaScore[k] = v * ((isAbstract && size > 1) ? 1 : size);
    });

    return quotaScore;
  }

  #throwError(msg) {
    alert(msg);
    throw Error(msg);
  }

  #setupDatabases() {
    const { DB_COUNT, BUCKET_COUNT_PER_DB, DB_NAME_PREFIX } = AppContext;

    if (BUCKET_COUNT_PER_DB < DB_COUNT || BUCKET_COUNT_PER_DB % DB_COUNT != 0) {
      this.#throwError(`Incorrect DB params specified`);
    }

    const totalBucketCount = DB_COUNT * BUCKET_COUNT_PER_DB;

    const quotaScore = this.#getDbQuotaScore();
    const quotaScoreEntries = Object.entries(quotaScore);

    if (totalBucketCount < quotaScoreEntries.length) {
      this.#throwError(`Expected totalBucketCount to be at least ${quotaScoreEntries.length}`);
    }

    const storesToCreate = AppContext.#scaleArrayToTotal(
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
      dbNames.push(`${DB_NAME_PREFIX}_${AppContext.#getRandomInt(0, 100000)}`);
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

      this.#createDatabaseConnections(k, storeInfoList)
    });

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

  #createDatabaseConnections(dbName, storeInfoList) {
    const { CONNECTIONS_PER_DB } = AppContext;

    if (CONNECTIONS_PER_DB < 1) {
      this.#throwError(`"CONNECTIONS_PER_DB" must be >= 1`);
    }

    const connections = [];

    const connection = new K_Database(dbName, storeInfoList);
    connection.createInMemoryLayer();

    connections.push(connection);

    for (let i = 1; i < CONNECTIONS_PER_DB; i++) {
      const connection = new K_Database(dbName);
      connections.push(connection);
    }

    this.#dbConnections[dbName] = {
      currentIndex: -1, connections,
    }
  }

  #getDependencies() {
    return [
      '/assets/js/lib/event_handler.min.js',
      '/assets/js/lib/trie.min.js',
      // '/assets/js/data/interned_strings_6480.js',

      // Todo: REMOVE
      '/assets/js/client-bundles/hyntax.min.js',
      { url: '/assets/js/client-utils.min.js', namespace: 'clientUtils' },
      { url: '/assets/js/template-runtime.min.js', namespace: 'TemplateRuntime' },
      { url: '/assets/js/custom-ctx-helpers.min.js', namespace: 'customCtxHelpers' },
    ];
  }

  #getBaseDependencies() {
    return [
      '/assets/js/lib/database.min.js',
      { url: '/assets/js/lib/lokijs.min.js', namespace: 'Loki' },
      '/assets/js/lib/loki_database.min.js',

      '/assets/js/base-renderer.min.js',
      '/assets/js/root-ctx-renderer.min.js',
      '/assets/js/custom-ctx-renderer.min.js',
      '/assets/js/web-renderer.min.js',
      '/assets/js/proxy.min.js',
      '/assets/js/base-component.min.js',
    ]
  }

  #loadDependencies() {
    return this.fetchAll(this.#getDependencies());
  }

  #loadBaseDependencies() {
    return this.fetchAll(this.#getBaseDependencies());
  }

  #loadEnums() {
    return this.fetch({
      url: '/components/enums.json', asJson: true
    }).then(enums => {
      self.appContext.enums = enums;
    });
  }

  #loadComponentClass(name, schema, metadata, src, testSrc) {
    assert(!self.components[name]);

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

    this.getComponentClassMetadataMap()[name] = {
      schema, metadata,
    }
  }

  getComponentClassMetadataMap() {
    return global.componentClassMetadata || (global.componentClassMetadata = {});
  }

  async #fetchComponentsData(list) {
    const { testMode } = this;

    return Promise.all(
      Object.keys(list).map((name) => {
        const assetId = list[name];
        return Promise.all([
          name,
          this.fetch({
            url: `/components/${assetId}/schema.json`,
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
      })
    );
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

  #pruneComponentConstructor(className) {
    const classMetadata = this.getComponentClassMetadataMap()[className];

    delete classMetadata.schema;
    delete classMetadata.metadata;
  }

  async #loadRootComponent(data, samples) {
    const { testMode } = this;

    let component;

    if (testMode) {

      component = new self.components[this.#className]({
        input:
          samples[
          self.clientUtils.getRandomInt(0, samples.length - 1)
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
    this.#rootComponent = component;

    component.on('preload', ({ futures }) => {
      futures.push(
        new Promise(resolve => {
          requestAnimationFrame(() => {
            this.#loadComponentClasses(this.#omegaList).then(resolve)
          });
        })
      )
    });

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

      // url.match(AppContext.#staticFilePattern) ? ... : self.fetch(...args);

      const data = await (
        useCache ? this.#staticCache.fetchWithCache(...args) : this.#staticCache.addToCache(...args)
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

  loadCSSDependencies(requests) {
    // eslint-disable-next-line consistent-return
    return new Promise((resolve, reject) => {
      const loaded = [];

      let styles = [
        ...new Set(
          requests
            .filter(({ screenTargets }) => !screenTargets || screenTargets.includes(AppContext.#getScreenSize()))
            .map(({ url }) => url)
        )
      ];
      // Filter styles that have previously loaded
      styles = styles
        .filter(url => !this.#loadedStyles.includes(url));

      if (!styles.length) {
        return resolve([]);
      }

      styles.forEach(url => {
        if (this.#loadedStyles.includes(url)) {
          return;
        }

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        link.type = 'text/css';
        link.async = true;
        // eslint-disable-next-line func-names
        const _this = this;
        link.onload = function () {
          loaded.push(this.href);
          // _this.logger.info(null, `Loaded ${this.href}`);
          if (loaded.length === styles.length) {
            resolve();
          }
        };
        link.onerror = () => reject(link.href);
        document.body.appendChild(link);

        this.#loadedStyles.push(url);
      });
    });
  }

  loadJSDependencies(requests) {
    const dependencies = requests.map((req) => {
      if (req.constructor.name === 'String') {
        return { url: req };
      }
      return req;
    })
      .filter(({ screenTargets }) => !screenTargets || screenTargets.includes(AppContext.#getScreenSize()))
      .filter(({ url }) => !this.#loadedScripts.includes(url))

    return this.fetchAll(dependencies)
      .then(() => {
        dependencies.forEach(({ url }) => {
          if (!this.#loadedScripts.includes(url)) {
            this.#loadedScripts.push(url);
          }
        })
      });
  }

  static #getScreenSize() {
    const width = window.innerWidth;

    if (width <= 767) {
      return 'mobile';
    } else if (width <= 1024) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }


  // Utility methods

  static #findWordMatches(str, word) {
    const arr = [];
    let currentIndex = str.indexOf(word);

    while (currentIndex !== -1) {
      arr.push(currentIndex);
      currentIndex = str.indexOf(word, currentIndex + 1);
    }

    return arr;
  }

  static #scaleArrayToTotal(arr, cumulativeTotal) {

    const minInitial = Math.min(...arr);

    // Step 1: Normalize the array such that the minimum becomes 1
    let normalizedArray = arr.map(num => (num - minInitial) + 1);

    // Step 2: Calculate the sum of the normalized array
    let sumNormalized = normalizedArray.reduce((acc, num) => acc + num, 0);

    // Step 3: Scale the normalized array to sum to the cumulativeTotal
    let scaledArray = normalizedArray.map(num => (num / sumNormalized) * cumulativeTotal);

    // Step 4: Ensure all numbers are whole numbers and adjust to make the sum exact
    let resultingArray = scaledArray.map(num => Math.floor(num));

    // Calculate the sum of the resulting array after flooring
    let currentSum = resultingArray.reduce((acc, num) => acc + num, 0);

    // Calculate the difference to reach the desired cumulative total
    let difference = cumulativeTotal - currentSum;

    // Adjust the array to account for the difference
    for (let i = 0; i < resultingArray.length && difference != 0; i++) {
      let add = Math.sign(difference);  // +1 if difference is positive, -1 if negative
      resultingArray[i] += add;
      difference -= add;
    }

    // Ensure there are no zeros in the resulting array
    for (let i = 0; i < resultingArray.length; i++) {
      if (resultingArray[i] === 0) {
        // Find the maximum element to decrease
        let maxIndex = resultingArray.indexOf(Math.max(...resultingArray));
        resultingArray[maxIndex]--;
        resultingArray[i]++;
      }
    }

    return resultingArray;
  }

  static #getRandomInt(min = 10000, max = 99999) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

module.exports = AppContext;