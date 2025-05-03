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

class K_Database {

    static #resolvedResultSet = Promise.resolve([]);

    #deferredDeletes = [];

    #migrating;
    #migrated;

    #databaseName;
    #storeInfoList;

    #idb;
    #ldb;

    static DEFAULT_PRIMARY_KEY = 'id';

    constructor(databaseName, storeInfoList) {
        this.#databaseName = databaseName;
        this.#storeInfoList = storeInfoList;
    }

    #getLds() {
        if (this.#migrated) return null;

        if (!this.#ldb) {
            this.#ldb = new self.LokiDb(this.#databaseName, K_Database.DEFAULT_PRIMARY_KEY, this.#storeInfoList);
        }
        return this.#ldb;
    }

    async createPersistenceLayer(setupDb) {

        const idb = new IndexedDb(this.#databaseName, K_Database.DEFAULT_PRIMARY_KEY);
        await idb.connect(this.#storeInfoList);

        this.#idb = idb;

        if (setupDb) {

            if (this.#ldb) {

                const promises = []
                this.#migrating = true;

                this.#storeInfoList.forEach(({ storeName }) => {
                    promises.push(
                        this.put(storeName, this.#ldb.all(storeName))
                    )
                });

                await Promise.all(promises);

                this.#migrating = false;

                this.#deferredDeletes.forEach(([storeName, keys]) => {
                    this.delete(storeName, keys);
                });

                const _lds = this.#ldb;
                this.#ldb = null;

                _lds.dropDatabase();
            }

            this.#deferredDeletes = null;
            this.#storeInfoList = null;
        }

        this.#migrated = true;
    }

    static removeLokiMetadataFromRows(rows) {
        const lokiReservedColumns = self.LokiDb.getReservedColumns();

        rows.forEach(row => {
            lokiReservedColumns.forEach(k => {
                delete row[k];
            });
        });
    }

    static async combineFetchResults(...promises) {
        const keys = {};
        const values = [];

        await Promise.all(
            promises
                .map((p, i) => p.then(arr => {
                    arr.forEach(row => {

                        // we want to ensure that loki results come first before indexeddb results, the reason
                        // for this is that - we want to priorize adding loki documents to the result set
                        // because it contains indexing metadata used by loki, and in the event that an
                        // update operation is triggered against the document(s), loki is able to
                        // internally reconcile the document against it's indexes
                        assert(i || row.$loki);

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

    put(storeName, rows) {

        if (this.#idb && this.#migrating) {
            K_Database.removeLokiMetadataFromRows(rows);
        }

        return this.#idb ? this.#idb.put(storeName, rows) : this.#getLds().put(storeName, rows);
    }

    startsWithQuery(trie, storeName, indexName, prefix) {
        return K_Database.combineFetchResults(
            this.#getLds() ? Promise.resolve(this.#getLds().startsWithQuery(trie, storeName, indexName, prefix)) : K_Database.#resolvedResultSet,
            this.#idb ? this.#idb.startsWithQuery(trie, storeName, indexName, prefix) : K_Database.#resolvedResultSet
        )
    }

    equalsQuery(storeName, indexName, eqValue) {
        return K_Database.combineFetchResults(
            this.#getLds() ? Promise.resolve(this.#getLds().equalsQuery(storeName, indexName, eqValue)) : K_Database.#resolvedResultSet,
            this.#idb ? this.#idb.equalsQuery(storeName, indexName, eqValue) : K_Database.#resolvedResultSet
        )
    }

    delete(storeName, keys) {
        if (this.#migrating) {
            this.#deferredDeletes.push([storeName, keys]);
            return;
        }

        return this.#idb ? this.#idb.delete(storeName, keys) : this.#getLds().delete(storeName, keys);
    }
}

module.exports = K_Database;