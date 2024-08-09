
class LokiDatabase {

    #databaseName;
    #primaryKey;

    #adapter;
    #collections = {};
    #indexToColumn = {};

    constructor(databaseName, primaryKey, storeInfoList) {

        this.#databaseName = databaseName;
        this.#primaryKey = primaryKey;

        this.#adapter = new Loki.LokiMemoryAdapter();
        const db = new Loki(databaseName, { adapter: this.#adapter });

        storeInfoList.forEach(({ storeName, indexedColumns }) => {

            this.#collections[storeName] = db.addCollection(storeName, {
                unique: [this.#primaryKey],
                indices: indexedColumns,
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
            if (this.#findById(storeName, row[this.#primaryKey])) {
                this.#collections[storeName].update(row);
            } else {
                this.#collections[storeName].insert(row);
            }
        });
    }

    startsWithQuery(proxyInstance, storeName, indexName, prefix) {
        const dataPathPrefix = 'data__';
        const hasDataPrefix = prefix.startsWith(dataPathPrefix)

        const subpaths = proxyInstance.getTrieSubPaths(
            hasDataPrefix ? prefix.replace(`${dataPathPrefix}`, '') : prefix
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
        this.#collections[storeName].remove(row);
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

module.exports = LokiDatabase;