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

class LokiDb {

    #databaseName;
    #primaryKey;

    #adapter;
    #collections = {};
    #indexToColumn = {};

    constructor(databaseName, primaryKey, storeInfoList, options = {}) {

        this.#databaseName = databaseName;
        this.#primaryKey = primaryKey;

        this.#adapter = new self.loki.LokiMemoryAdapter();
        const db = new loki(databaseName, { adapter: this.#adapter, env: 'BROWSER' });

        storeInfoList.forEach(({ storeName, indexedColumns }) => {

            this.#collections[storeName] = db.addCollection(storeName, {
                unique: [this.#primaryKey],
                indices: indexedColumns,
                ...options,
            });

            indexedColumns.forEach(colName => {
                this.#indexToColumn[`${colName}_index`] = colName;
            });
        });
    }

    static getReservedColumns() {
        return ['$loki', 'meta'];
    }

    put(storeName, rows) {
        rows.forEach(row => {
            const doc = this.#findById(storeName, row[this.#primaryKey]);
            if (doc) {
                this.#collections[storeName].update(row);
            } else {
                this.#collections[storeName].insert(row);
            }
        });
    }

    startsWithQuery(trie, storeName, indexName, prefix) {
        const dataPathPrefix = 'data__';
        const hasDataPrefix = prefix.startsWith(dataPathPrefix);

        const subpaths = self.clientUtils.getTrieSubPaths(
            trie, hasDataPrefix ? prefix.replace(`${dataPathPrefix}`, '') : prefix
        )
            .map(p => hasDataPrefix ? `${dataPathPrefix}${p}` : p);

        const colName = this.#indexToColumn[indexName];

        return this.#collections[storeName]
            .find({ [colName]: { '$containsAny': [prefix, ...subpaths] } });
    }

    equalsQuery(storeName, indexName, eqValue) {
        if (indexName) {
            const colName = this.#indexToColumn[indexName];

            return this.#collections[storeName]
                .find({ [colName]: { '$contains': eqValue } });
        } else {
            const row = this.#findById(storeName, eqValue);
            return row ? [row] : [];
        }
    }

    #findById(storeName, key) {
        return this.#collections[storeName].by(
            this.#primaryKey, key,
        );
    }

    delete(storeName, keys) {
        keys.forEach(k => {
            this.#deleteById(storeName, k);
        });
    }

    #deleteById(storeName, key) {
        const row = this.#findById(storeName, key);

        if (row) {
            this.#collections[storeName].remove(row);
        }
    }

    all(storeName) {
        const coll = this.#collections[storeName];
        return coll.find({});
    }

    dropDatabase() {
        this.#adapter.deleteDatabase(this.#databaseName);

        this.#adapter = null;
        this.#collections = null;
        this.#indexToColumn = null;
    }
}

module.exports = LokiDb;