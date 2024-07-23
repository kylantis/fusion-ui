
class K_Database {

    static #NO_OP = () => {};
    static #resolvedResultSet = Promise.resolve([]);

    #deferredDeletes = [];
    #migrating;

    #databaseName;
    #storeInfoList;

    #idb;
    #lds;

    static DEFAULT_PRIMARY_KEY = 'id';

    constructor(databaseName, storeInfoList) {
        this.#databaseName = databaseName;
        this.#storeInfoList = storeInfoList;
    }

    createInMemoryLayer() {
        this.#lds = new self.LokiDatabase(this.#databaseName, K_Database.DEFAULT_PRIMARY_KEY, this.#storeInfoList);
    }

    async createPersistenceLayer() {
        this.#idb = await K_Database.#_connect(this.#databaseName, this.#storeInfoList);

        if (this.#storeInfoList) {
            this.#migrating = true;

            const promises = []

            this.#storeInfoList.forEach(({ storeName }) => {
                promises.push(
                    this.put(storeName, this.#lds.all(storeName))
                )
            });

            await Promise.all(promises);

            this.#migrating = false;

            this.#deferredDeletes.forEach(([storeName, keys]) => {
                this.delete(storeName, keys);
            });

            const _lds = this.#lds;
            this.#lds = null;
            _lds.dropDatabase();

            this.#deferredDeletes = null;
            this.#storeInfoList = null;
        }
    }

    static #_connect(databaseName, storeInfoList) {
        const { DEFAULT_PRIMARY_KEY } = K_Database;

        return new Promise((resolve, reject) => {
            const openRequest = self.indexedDB.open(databaseName, 1);

            openRequest.onerror = event => reject(event.target.error);
            openRequest.onsuccess = event => {
                resolve(event.target.result);
            };
            openRequest.onupgradeneeded = (event) => {
                const db = event.target.result;

                const indexName = (colName) => `${colName}_index`;

                storeInfoList.forEach(({ storeName, indexedColumns }) => {
                    const store = db.createObjectStore(storeName, { keyPath: DEFAULT_PRIMARY_KEY });

                    indexedColumns.forEach(colName => {
                        store.createIndex(indexName(colName), colName, { unique: false, multiEntry: true });
                    });
                });
            }
        });
    }

    put(storeName, rows) {
        const lokiReservedColumns = self.LokiDatabase ? self.LokiDatabase.getReservedColumns() : null;
        
        const transform = this.#migrating ? (row) => {
            lokiReservedColumns.forEach(k => {
                delete row[k];
            });
        } : K_Database.#NO_OP;

        return this.#idb ? K_Database.#_put(this.#idb, storeName, rows, transform) : this.#lds.put(storeName, rows);
    }

    static #_put(dbInstance, storeName, rows, transform) {
        const transaction = dbInstance.transaction([storeName], 'readwrite', { durability: 'relaxed' });
        const store = transaction.objectStore(storeName);

        return new Promise((resolve, reject) => {

            transaction.oncomplete = resolve;
            transaction.onerror = reject;

            const updatedAt = new Date();

            for (const row of rows) {
                transform(row);
                row.updatedAt = updatedAt;
                store.put(row);
            }

            if (transaction.commit) {
                transaction.commit();
            }
        });
    }

    static async #combineFetchResults(...promises) {
        const keys = {};
        const values = [];

        await Promise.all(
            promises
                .map(p => p.then(arr => {
                    arr.forEach(row => {
                        const pk = row[this.DEFAULT_PRIMARY_KEY];

                        if (!keys[pk]) {
                            keys[pk] = true;
                            values.push(row);
                        }
                    });
                })
                )
        );

        return values;
    }

    startsWithQuery(proxyInstance, storeName, indexName, prefix) {
        return K_Database.#combineFetchResults(
            this.#lds ? Promise.resolve(this.#lds.startsWithQuery(proxyInstance, storeName, indexName, prefix)) : K_Database.#resolvedResultSet,
            this.#idb ? this.#getAll0(storeName, indexName, IDBKeyRange.bound(prefix, prefix + 'uffff', false, false)) : K_Database.#resolvedResultSet
        )
    }

    equalsQuery(storeName, indexName, eqValue) {
        return K_Database.#combineFetchResults(
            this.#lds ? Promise.resolve(this.#lds.equalsQuery(storeName, indexName, eqValue)) : K_Database.#resolvedResultSet,
            this.#idb ? this.#getAll0(storeName, indexName, eqValue) : K_Database.#resolvedResultSet
        )
    }

    async #getAll0(storeName, indexName, range, keysOnly) {
        return K_Database.#_getAll0(this.#idb, storeName, indexName, range, keysOnly);
    }

    static #_getAll0(dbInstance, storeName, indexName, range, keysOnly) {

        const transaction = dbInstance.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const target = indexName ? store.index(indexName) : store;

        const getRequest = (...args) => keysOnly ? target.getAllKeys(...args) : target.getAll(...args);

        const request = (range != undefined) ? getRequest(range) : getRequest();

        return new Promise((resolve, reject) => {
            request.onsuccess = event => {
                resolve(event.target.result);
            };
            request.onerror = event => reject(event.target.error);
        });
    }

    delete(storeName, keys) {
        if (this.#migrating) {
            this.#deferredDeletes.push([storeName, keys]);
            return;
        }

        return this.#idb ? K_Database.#_delete(this.#idb, storeName, keys) : this.#lds.delete(storeName, keys);
    }

    static #_delete(dbInstance, storeName, keys) {
        const transaction = dbInstance.transaction([storeName], 'readwrite', { durability: 'relaxed' });
        const store = transaction.objectStore(storeName);

        return new Promise((resolve, reject) => {
            transaction.oncomplete = resolve;
            transaction.onerror = reject;

            keys.forEach(key => {
                store.delete(key);
            });

            if (transaction.commit) {
                transaction.commit();
            }
        });
    }
}

module.exports = K_Database;