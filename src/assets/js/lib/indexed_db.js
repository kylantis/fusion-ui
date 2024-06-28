
class K_IndexedDB {

    static DEFAULT_PRIMARY_KEY = 'id';

    constructor(databaseName) {
        this.databaseName = databaseName;
    }

    connect(storeInfoList) {
        const { DEFAULT_PRIMARY_KEY } = K_IndexedDB;

        return new Promise((resolve, reject) => {
            const openRequest = self.indexedDB.open(this.databaseName, 1);

            openRequest.onerror = event => reject(event.target.error);
            openRequest.onsuccess = event => {
                this.db = event.target.result;
                resolve();
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
        const transaction = this.db.transaction([storeName], 'readwrite', { durability: 'relaxed' });
        const store = transaction.objectStore(storeName);

        return new Promise((resolve, reject) => {

            transaction.oncomplete = () => resolve();
            transaction.onerror = event => reject(event.target.error);

            const updatedAt = new Date();

            for (const row of rows) {
                row.updatedAt = updatedAt;
                store.put(row);
            }

            if (transaction.commit) {
                transaction.commit();
            }
        });
    }

    getAll(storeName, indexName, range) {
        return this.#getAll0(storeName, indexName, range, false);
    }

    getAllKeys(storeName, indexName, range) {
        return this.#getAll0(storeName, indexName, range, true);
    }

    #getAll0(storeName, indexName, range, keysOnly) {

        const transaction = this.db.transaction([storeName], 'readonly');
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
        const transaction = this.db.transaction([storeName], 'readwrite', { durability: 'relaxed' });
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

module.exports = K_IndexedDB;