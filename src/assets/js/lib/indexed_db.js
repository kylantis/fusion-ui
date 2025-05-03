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

class IndexedDb {

    #databaseName;
    #primaryKey;

    #idb;
    #ldb;

    #pendingPuts = new Map();
    #pendingDeletes = new Map();

    constructor(databaseName, primaryKey) {
        this.#databaseName = databaseName;
        this.#primaryKey = primaryKey;
    }

    async connect(storeInfoList) {

        this.#ldb = new LokiDb(`${this.#databaseName}-stage`, this.#primaryKey, storeInfoList, { ttl: 15000, ttlInterval: 60000 });

        this.#idb = await new Promise((resolve, reject) => {
            const openRequest = self.indexedDB.open(this.#databaseName, 1);

            openRequest.onerror = event => reject(event.target.error);
            openRequest.onsuccess = event => {
                resolve(event.target.result);
            };
            openRequest.onupgradeneeded = (event) => {
                const db = event.target.result;

                const indexName = (colName) => `${colName}_index`;

                storeInfoList.forEach(({ storeName, indexedColumns }) => {
                    const store = db.createObjectStore(storeName, { keyPath: this.#primaryKey });

                    indexedColumns.forEach(colName => {
                        store.createIndex(indexName(colName), colName, { unique: false, multiEntry: true });
                    });
                });
            }
        });
    }

    startsWithQuery(trie, storeName, indexName, prefix) {
        return this.#mergeQueryResults(
            storeName,
            Promise.resolve(this.#ldb.startsWithQuery(trie, storeName, indexName, prefix)),
            this.#readFromIndexedDb(storeName, indexName, IDBKeyRange.bound(prefix, prefix + 'uffff', false, false))
        );
    }

    equalsQuery(storeName, indexName, eqValue) {
        return this.#mergeQueryResults(
            storeName,
            Promise.resolve(this.#ldb.equalsQuery(storeName, indexName, eqValue)),
            this.#readFromIndexedDb(storeName, indexName, eqValue)
        );
    }

    async #mergeQueryResults(storeName, ...promises) {
        const ret = await K_Database.combineFetchResults(...promises);
        return ret.filter(({ [this.#primaryKey]: id }) => !this.#existsInMultiMap(this.#pendingDeletes, storeName, id));
    }

    #readFromIndexedDb(storeName, indexName, range, keysOnly) {

        const transaction = this.#idb.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const target = indexName ? store.index(indexName) : store;

        const getRequest = (...args) => keysOnly ? target.getAllKeys(...args) : target.getAll(...args);

        const request = (range != undefined) ? getRequest(range) : getRequest();

        return new Promise((resolve, reject) => {
            request.onsuccess = event => {
                const { result } = event.target;

                self.K_Database.removeLokiMetadataFromRows(result);

                resolve(result);
            };
            request.onerror = event => reject(event.target.error);
        });
    }

    put(storeName, rows) {

        const keys = rows.map(r => r[this.#primaryKey]);

        if (this.#existsInMultiMap(this.#pendingDeletes, storeName, keys)) {
            throw Error(`Unable to put entry that has been marked for deletion`);
        }

        this.#ldb.put(storeName, rows);

        this.#addToMultiMap(this.#pendingPuts, storeName, keys);

        this.#writeToIndexedDb('put', storeName, rows)
            .then(() => {
                const promises = [];

                keys.forEach(k => {
                    if (this.#existsInMultiMap(this.#pendingDeletes, storeName, k)) {
                        promises.push(
                            this.#writeToIndexedDb('delete', storeName, [k]).then(() => {
                                this.#removeFromMultiMap(this.#pendingDeletes, storeName, k);
                            })
                        );
                    }
                });

                Promise.all(promises).then(() => {
                    this.#removeFromMultiMap(this.#pendingPuts, storeName, keys);
                });
            });
    }

    delete(storeName, keys) {

        this.#ldb.delete(storeName, keys);

        this.#addToMultiMap(this.#pendingDeletes, storeName, keys);

        this.#writeToIndexedDb('delete', storeName, keys)
            .then(() => {
                keys.forEach(k => {
                    if (!this.#existsInMultiMap(this.#pendingPuts, storeName, k)) {
                        this.#removeFromMultiMap(this.#pendingDeletes, storeName, k);
                    }
                });
            });
    }

    #writeToIndexedDb(op, storeName, entries) {
        assert(['put', 'delete'].includes(op));

        const transaction = this.#idb.transaction([storeName], 'readwrite', { durability: 'relaxed' });
        const store = transaction.objectStore(storeName);

        return new Promise((resolve, reject) => {
            transaction.oncomplete = resolve;
            transaction.onerror = reject;

            entries.forEach(e => {
                store[op](e);
            });

            if (transaction.commit) {
                transaction.commit();
            }
        });
    }

    #addToMultiMap(map, storeName, keys) {
        if (!map.has(storeName)) {
            map.set(storeName, new Map());
        }
        const _m = map.get(storeName);
        keys.forEach(k => {
            _m.set(k, true);
        });
    }

    #removeFromMultiMap(map, storeName, keys) {
        if (typeof keys == 'string') {
            keys = [keys];
        }

        const _m = map.get(storeName);

        keys.forEach(k => {
            _m.delete(k);
        });
    }

    #existsInMultiMap(map, storeName, keys) {
        if (typeof keys == 'string') {
            keys = [keys];
        }

        const _m = map.get(storeName);

        if (_m) {
            for (const k of keys) {
                if (_m.has(k)) return true;
            }
        }

        return false;
    }
}

module.exports = IndexedDb;