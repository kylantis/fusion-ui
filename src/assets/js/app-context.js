/*
 *  Fusion UI
 *  Copyright (C) 2025 Kylantis, Inc
 *  
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *  
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *  
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/* eslint-disable no-eval */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-param-reassign */
class AppContext {

  static INITIAL_LOAD_TIME_SEC = 4.5;

  // com.kylantis.pfe-v1.session_metadata
  static DB_NAME_PREFIX = 'k.ui';
  static DB_PERSISTENCE_TIMEOUT = 10000;

  static DB_COUNT = 5;
  static BUCKET_COUNT_PER_DB = 50;

  // Note: as long as each connection caches database entries in-memory (as is currently the case),
  // we can only maintain a ONE connection per db, see lib/indexed_db.js
  static CONNECTIONS_PER_DB = 1;

  static CREATE_DB_WORKER = false;

  static COMPONENT_SERVICE_URI = '/web/components';

  static SESSION_QUERY_PARAMS;

  static RTL = false;

  #loadedStyles = [];
  #loadedScripts = new Set();

  #logger;
  #userGlobals;

  #assetId;
  #className;
  #rootComponent;
  #componentList;
  #sessionId;

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
  #networkCache = new Map();

  constructor({ logger, userGlobals, assetId, className, bootConfig, componentList, testMode, sessionId }) {

    this.#logger = logger;
    this.#userGlobals = (userGlobals == '{{userGlobals}}') ? {} : userGlobals;

    this.#assetId = assetId;
    this.#className = className;

    this.#bootConfigs[className] = bootConfig;
    this.#componentList = this.#parseComponentList(componentList);

    this.#sessionId = (sessionId == '{{sessionId}}') ? null : sessionId;

    this.testMode = !!testMode;

    Object.defineProperty(self, 'appContext', {
      value: this, configurable: false, writable: false,
    });

    this.#addPolyfills();

    this.#readUserGlobals();
  }

  static getComponentAssetURLs(assetId) {
    return {
      schemaURL: `/components/${assetId}/schema.json`,
      metadataURL: `/components/${assetId}/metadata.min.js`,
      jsURL: `/components/${assetId}/index.min.js`,
      testJsURL: `/components/${assetId}/index.test.min.js`
    }
  }

  static getDependencies() {
    return [
      '/assets/js/lib/event_handler.min.js',
      '/assets/js/lib/trie.min.js',
      '/assets/js/data/interned_strings_6480.js',
      '/assets/js/client-bundles/hyntax.js',
      { url: '/assets/js/client-utils.min.js', namespace: 'clientUtils' },
      { url: '/assets/js/template-runtime.min.js', namespace: 'TemplateRuntime' },
      { url: '/assets/js/custom-ctx-helpers.min.js', namespace: 'customCtxHelpers' },
    ];
  }

  static getBaseDependencies() {
    return [
      '/assets/js/lib/database.min.js',
      { url: '/assets/js/lib/lokijs.min.js', namespace: 'loki' },
      '/assets/js/lib/loki_db.min.js',
      '/assets/js/lib/indexed_db.min.js',

      '/assets/js/base-renderer.min.js',
      '/assets/js/root-ctx-renderer.min.js',
      '/assets/js/custom-ctx-renderer.min.js',
      '/assets/js/web-renderer.min.js',
      '/assets/js/proxy.min.js',
      '/assets/js/base-component.min.js',
    ]
  }

  static getAllDependencies(assetId, bootConfig, componentList, testMode) {
    const { getComponentAssetURLs, getDependencies, getBaseDependencies } = AppContext;
    const { renderTree } = bootConfig;

    const toURL = (dep) => (typeof dep == 'object') ? dep.url : dep;

    let fileList = [
      ...testMode ? [`/components/${assetId}/samples.js`] : [],
      ...getBaseDependencies().map(toURL),
      '/components/enums.json',
      ...getDependencies().map(toURL),
      ...Object.values(componentList)
        .filter(_assetId => _assetId != assetId)
        .map(assetId => `/components/${assetId}/boot-config.json`),
    ];

    [...new Set([assetId, ...Object.keys(renderTree)])]
      .forEach(assetId => {
        fileList = fileList.concat(
          Object.values(
            getComponentAssetURLs(assetId)
          )
        );
      });

    return fileList;
  }

  #parseComponentList(str) {
    const markerStart = '<componentList>';
    const markerEnd = '</componentList>';

    const jsonStr = str.substring(markerStart.length, str.length - markerEnd.length);
    return JSON.parse(jsonStr);
  }

  getComponentList() {
    return { ...this.#componentList };
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

  getSessionId() {
    return this.#sessionId;
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
    const {
      DB_COUNT, BUCKET_COUNT_PER_DB, CONNECTIONS_PER_DB, COMPONENT_SERVICE_URI, SESSION_QUERY_PARAMS, RTL, CREATE_DB_WORKER,
    } = this.#userGlobals;

    if (typeof DB_COUNT == 'number') {
      AppContext.DB_COUNT = DB_COUNT;
    }

    if (typeof BUCKET_COUNT_PER_DB == 'number') {
      AppContext.BUCKET_COUNT_PER_DB = BUCKET_COUNT_PER_DB;
    }

    if (typeof CONNECTIONS_PER_DB == 'number') {
      AppContext.CONNECTIONS_PER_DB = CONNECTIONS_PER_DB;
    }

    if (typeof COMPONENT_SERVICE_URI == 'string') {
      AppContext.COMPONENT_SERVICE_URI = COMPONENT_SERVICE_URI;
    }

    if (typeof SESSION_QUERY_PARAMS == 'string') {
      AppContext.SESSION_QUERY_PARAMS = SESSION_QUERY_PARAMS;
    }

    if (typeof RTL == 'boolean') {
      AppContext.RTL = RTL;
    }

    if (typeof CREATE_DB_WORKER == 'boolean') {
      AppContext.CREATE_DB_WORKER = CREATE_DB_WORKER;
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

  static unsafeEvaluate(code, scope = {}, thisObject) {

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

  getDbWorkers() {
    return Object.values(this.#dbWorkers);
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

  getNetworkCache() {
    return this.#networkCache;
  }

  static async streamToArrayBuffer(stream) {
    const reader = stream.getReader();
    const chunks = [];
    let result;

    while (!(result = await reader.read()).done) {
      chunks.push(result.value);
    }

    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
    const arrayBuffer = new Uint8Array(totalLength);

    let position = 0;
    for (const chunk of chunks) {
      arrayBuffer.set(new Uint8Array(chunk), position);
      position += chunk.byteLength;
    }

    return arrayBuffer.buffer;
  }

  static async decompressArrayBuf(inputBuf) {
    const { streamToArrayBuffer } = AppContext;
    const decompressionStream = new DecompressionStream('deflate');

    const compressedStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(inputBuf));
        controller.close();
      }
    });

    const decompressedStream = compressedStream.pipeThrough(decompressionStream);
    return await streamToArrayBuffer(decompressedStream);
  }

  getComponentServiceUri() {
    return AppContext.COMPONENT_SERVICE_URI;
  }

  async #requestNetworkCacheFile(bootConfig) {
    const { decompressArrayBuf, getAllDependencies } = AppContext;

    const fileList = getAllDependencies(
      this.#assetId, bootConfig, this.#componentList, this.testMode,
    );

    const numFiles = fileList.length;

    const queryParams = new URLSearchParams();
    queryParams.append('sessionId', this.#sessionId);
    queryParams.append('assetId', this.#assetId);
    queryParams.append('numFiles', numFiles);

    const url = `${this.getComponentServiceUri()}/request-network-cache-file?${queryParams.toString()}`;

    const response = await self.fetch(
      url, { method: 'GET', priority: 'high' }
    );

    if (!response.ok) {
      throw new Error(`Unable to fetch network cache file: ${response.statusText}`);
    }

    const fileIndices = response.headers.get('File-Indices').split(',').map(Number);
    const buffer = await response.arrayBuffer();

    for (let i = 0; i < fileList.length; i++) {
      const start = (i == 0) ? 0 : fileIndices[i - 1];
      const end = fileIndices[i];

      this.#networkCache.set(
        fileList[i], decompressArrayBuf(
          buffer.slice(start, end)
        ).then(buf => new TextDecoder('utf-8').decode(buf))
      );
    }
  }

  async load({ data, runtimeBootConfig }) {
    runtimeBootConfig = (runtimeBootConfig == '{{runtimeBootConfig}}') ? null : runtimeBootConfig;

    const rootBootConfig = this.#bootConfigs[this.#className];
    const _rootBootConfig = runtimeBootConfig || rootBootConfig;

    const cacheFilePromise = this.#requestNetworkCacheFile(_rootBootConfig);

    let htmlDepsPromise = this.#loadCSSDependencies(_rootBootConfig.cssDependencies)

    await cacheFilePromise;

    let alphaListPromise;
    let alphaBootConfigsPromise;

    const samplesStringPromise = this.testMode ?
      this.fetch({ url: `/components/${this.#assetId}/samples.js`, process: false }) :
      null;

    const baseDepsPromise = this.#loadBaseDependencies();
    const enumPromise = this.#loadEnums();

    const depsPromise = this.#loadDependencies();

    if (runtimeBootConfig || !rootBootConfig.hasDynamicBootConfig) {
      const { jsDependencies, renderTree } = _rootBootConfig;

      htmlDepsPromise = Promise.all([htmlDepsPromise, this.#loadJSDependencies(jsDependencies)]);
      alphaListPromise = Promise.resolve();

      alphaBootConfigsPromise = Promise.all(
        Object.entries(renderTree)
          .map(([assetId, className]) => {
            this.#alphaList[className] = assetId;
            return this.#addBootConfig(assetId, className)
          })
      );

      this.#alphaList[this.#className] = this.#assetId;

    } else {

      let htmlDepsResolve;
      let alphaListResolve;
      let alphaBootConfigsResolve;

      htmlDepsPromise = Promise.all([
        htmlDepsPromise,
        new Promise(resolve => htmlDepsResolve = resolve),
      ]);
      alphaListPromise = new Promise(resolve => alphaListResolve = resolve);
      alphaBootConfigsPromise = new Promise(resolve => alphaBootConfigsResolve = resolve);

      samplesStringPromise.then(sampleString => {

        const classNames = [
          ...new Set([
            ...this.#findAllComponentClassesInSampleString(sampleString),
            ...Object.values(_rootBootConfig.renderTree),
          ])
        ];

        const htmlDepsPromises = [];

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

            const { cssDependencies, jsDependencies } = bootConfig;

            htmlDepsPromises.push(
              Promise.all([
                this.#loadCSSDependencies(cssDependencies),
                this.#loadJSDependencies(jsDependencies)
              ])
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
      });
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
      .then(() => this.loadComponentClasses(this.#alphaList, baseDepsPromise));

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
    // await Promise.all([alphaComponentClassesPromise, dbSetupPromise, enumPromise, depsPromise])

    await new Promise(resolve => {
      requestAnimationFrame(resolve);
    });

    await this.#loadRootComponent(data, await samplesPromise, htmlDepsPromise);


    this.#setupComponentsNodePruneTask();

    this.#finalizers.forEach(fn => {
      fn();
    });

    this.#finalizers = null;
    this.#bootConfigs = null;
    this.#refMetadata = null;

    setTimeout(
      async () => {
        console.info('start migration');
        await this.#connectDatabase();
        console.info('finish migration');
      },
      AppContext.DB_PERSISTENCE_TIMEOUT,
    );
  }

  async #connectDatabase() {
    const { CREATE_DB_WORKER } = AppContext;

    await Promise.all(
      Object.entries(this.#dbConnections)
        .map(([dbName, { connections, storeInfoList }]) =>
          connections[0].createPersistenceLayer(true)
            .then(() => {
              const promises = [];

              for (let i = 1; i < connections.length; i++) {
                promises.push(
                  connections[i].createPersistenceLayer()
                );
              }

              if (CREATE_DB_WORKER) {
                promises.push(
                  this.#createDbWorker(dbName, storeInfoList)
                );
              }

              return Promise.all(promises);
            }))
    );

    this.#indexedDbReady = true;
  }

  async loadComponentClasses(list, preLoadPromise) {
    const { getComponentAssetURLs } = AppContext;

    Object.entries(list)
      .forEach(async ([className, assetId]) => {
        const metadataMap = this.getComponentClassMetadataMap()[className] = {};

        const { schemaURL, metadataURL } = getComponentAssetURLs(assetId);

        this.fetch({ url: schemaURL, asJson: true }).then(schema => {
          metadataMap.schema = schema;
        });

        this.fetch({ url: metadataURL }).then(metadata => {
          metadataMap.metadata = metadata;
        });
      });

    return Promise.all(
      Object.entries(list)
        .filter(([className]) => !self.components[className])
        .map(async ([className, assetId]) => {
          const { jsURL, testJsURL } = getComponentAssetURLs(assetId);

          return [
            className,
            await this.fetch({ url: jsURL, process: false }),
            this.testMode ? await this.fetch({ url: testJsURL, process: false, }) : null,
          ]
        })
    )
      .then(async componentsData => {
        if (preLoadPromise) {
          await preLoadPromise;
        }

        componentsData.forEach(([className, mainSrc, testSrc]) => {

          const componentClass = this.#processScript({
            contents: mainSrc,
          });

          self.components[className] = componentClass;

          if (testSrc) {
            // If we are in test mode, load component test classes, to override the main ones
            const componentTestClass = this.#processScript({
              contents: testSrc, scope: {
                require: (module) => {
                  switch (module) {
                    case './index':
                      return self.components[className];
                    default:
                      this.#logger.warn(`Unable to load module "${module_1_1}" in the browser, returning null`);
                      return null;
                  }
                }
              },
            });

            // When serializing, toJSON(...) should use the actual className, not the test class
            componentTestClass.className = className;

            self.components[className] = componentTestClass;
          }
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

  async #createDbWorker(dbName, storeInfoList) {
    const worker = new Worker(`/assets/js/web_workers/db_web_worker.min.js?v=${new Date().getTime()}`);
    this.#dbWorkers[dbName] = worker;

    await Promise.all([
      RootProxy.runTask(
        worker, 'connectDatabase', dbName, storeInfoList,
      ),
      RootProxy.runTask(
        worker, 'createPathTries', RootProxy.getPathList(),
      ),
    ]);
  }

  #createDatabaseConnections(dbName, storeInfoList) {
    const { CONNECTIONS_PER_DB } = AppContext;

    if (CONNECTIONS_PER_DB < 1) {
      this.#throwError(`"CONNECTIONS_PER_DB" must be >= 1`);
    }

    const connections = [];

    const connection = new K_Database(dbName, storeInfoList);

    connections.push(connection);

    for (let i = 1; i < CONNECTIONS_PER_DB; i++) {
      const connection = new K_Database(dbName, storeInfoList);
      connections.push(connection);
    }

    this.#dbConnections[dbName] = {
      currentIndex: -1, connections, storeInfoList,
    }
  }

  #loadDependencies() {
    const { getDependencies } = AppContext;
    return this.fetchAll(getDependencies(), true);
  }

  #loadBaseDependencies() {
    const { getBaseDependencies } = AppContext;
    return this.fetchAll(getBaseDependencies());
  }

  #loadEnums() {
    return this.fetch({
      url: '/components/enums.json', asJson: true
    }).then(enums => {
      self.appContext.enums = enums;
    });
  }

  getComponentClassMetadataMap() {
    return global.componentClassMetadata || (global.componentClassMetadata = {});
  }

  #addComponentConstructorPruneFinalizer(componentNames) {
    const { INITIAL_LOAD_TIME_SEC } = AppContext;

    const fn = () => {
      setTimeout(() => {
        componentNames
          .forEach(name => {
            this.#pruneComponentConstructor(name)
          });
      }, INITIAL_LOAD_TIME_SEC * 1000);
    };

    if (this.#finalizers) {
      this.#finalizers.push(fn);
    } else {
      fn();
    }
  }

  #pruneComponentConstructor(className) {
    const classMetadata = this.getComponentClassMetadataMap()[className];

    delete classMetadata.schema;
    delete classMetadata.metadata;
  }

  async #loadRootComponent(data, samples, htmlDepsPromise) {
    const { testMode } = this;

    let component;

    if (testMode) {

      component = new self.components[this.#className]({
        input: samples[
          self.clientUtils.getRandomInt(0, samples.length - 1)
        ],
        isRoot: true
      });

    } else {

      assert(typeof data == 'function');
      component = data();
    }

    if (component.awaitHtmlDependencies()) {
      await htmlDepsPromise;
    }

    component.addConfig('useWeakRef', false);

    this.#loaded = true;
    this.#rootComponent = component;

    if (testMode) {
      global.Component = component;
    }

    return component.load();
  }

  #processScript({ contents, scope, namespace }) {
    const result = AppContext.unsafeEval(contents, scope);

    // eslint-disable-next-line default-case
    switch (true) {
      case result instanceof Function:
        namespace = namespace || result.name;

      case result instanceof Object && !!namespace:
        AppContext.unsafeEvaluate(
          `self['${namespace}'] = result;`,
          { result }
        );
        break;
    }

    return result;
  }

  fetchAll(requests, optimizeMicroTask) {
    const promises = [];

    requests.forEach((req, i) => {
      promises.push(
        (!optimizeMicroTask || (i % 2 == 0)) ?
          this.fetch(req) :
          new Promise(async resolve => {
            await new Promise(resolve => {
              requestAnimationFrame(resolve);
            });

            resolve(
              await this.fetch(req)
            );
          })
      )
    })

    return Promise.all(promises);
  }

  async fetch(req) {
    if (typeof req === 'string') {
      req = { url: req };
    }

    const { url, asJson, namespace, process = true } = req;
    const response = await this.#fetchFn({ url, asJson });

    return (!asJson && process) ?
      this.#processScript({ contents: response, namespace }) :
      response;
  }

  #getSessionQueryParams() {
    const { SESSION_QUERY_PARAMS } = AppContext;
    return SESSION_QUERY_PARAMS || ''
  }

  async #fetchFn({ url, asJson }) {
    const resourceType = asJson ? 'json' : 'text';

    let data;

    if (this.#networkCache) {
      const resp = await this.#networkCache.get(url);

      if (resp) {
        data = {
          ok: true,
          text: () => resp,
          json: () => JSON.parse(resp)
        }
      }
    }

    if (!data) {
      data = await self.fetch(url + this.#getSessionQueryParams(), { method: 'GET' });
    }

    if (data.ok) {
      return await data[resourceType]();
    } else {
      throw Error(data.statusText);
    }
  }

  loadCSSDependencies(requests) {
    return this.#loadCSSDependencies(requests, false);
  }

  #loadCSSDependencies(requests, isRoot = true) {
    // eslint-disable-next-line consistent-return
    return new Promise((resolve, reject) => {
      const loaded = [];

      const styles = requests
        .map(req => ({ ...req, url: req.url + this.#getSessionQueryParams() }))
        .filter(({ url }) => {
          if (!this.#loadedStyles.includes(url)) {
            this.#loadedStyles.push(url);
            return true;
          } else {
            return false;
          }
        })
        .filter(({ screenTargets }) => !screenTargets || screenTargets.includes(AppContext.#getScreenSize()))
        .map(({ url }) => url);

      if (!styles.length) {
        return resolve([]);
      }

      styles.forEach(url => {
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

        (isRoot ? document.head : document.body)
          .appendChild(link);
      });
    });
  }

  loadJSDependencies(requests) {
    return this.#loadJSDependencies(requests, false)
  }

  #loadJSDependencies(requests, isRoot = true) {
    requests = requests.map((req) => {
      if (req.constructor.name === 'String') {
        return { url: req };
      }
      return req;
    })
      .filter(({ url }) => {
        if (!this.#loadedScripts.has(url)) {
          this.#loadedScripts.add(url);
          return true;
        } else {
          return false;
        }
      })
      .filter(({ screenTargets }) => !screenTargets || screenTargets.includes(AppContext.#getScreenSize()))

    const groups = {};

    requests.forEach((req) => {
      const { group = AppContext.#getRandomString() } = req;

      if (!groups[group]) {
        groups[group] = [];
      }

      groups[group].push(() => this.fetch(req));
    });

    return Promise.all(
      Object.values(groups)
        .map(async requests => {
          for (const req of requests) {
            await req();
          }
        })
    );
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

  static #getRandomString(len = 6) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomString = '';
    for (let i = 0; i < len; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      randomString += characters.charAt(randomIndex);
    }
    return randomString;
  }
}

module.exports = AppContext;