
class LokiDatabase {

    static #INDEX_VALUE_COLUMN = 'value';

    #databaseName;
    #primaryKey;

    #adapter;

    #collections = {}
    #indexes = {}

    #columnIndexes = {};

    constructor(databaseName, primaryKey, storeInfoList) {

        this.#databaseName = databaseName;
        this.#primaryKey = primaryKey;

        this.#adapter = new Loki.LokiMemoryAdapter();
        const db = new Loki(databaseName, { adapter: this.#adapter });

        const indexName = (colName) => `${colName}_index`;

        storeInfoList.forEach(({ storeName, indexedColumns }) => {

            this.#collections[storeName] = db.addCollection(storeName, {
                unique: [this.#primaryKey],
                disableMeta: true,
            });

            indexedColumns.forEach(colName => {

                const collectionName = `${storeName}_${indexName(colName)}`;
                const collection = db.addCollection(
                    collectionName, {
                    indices: [this.#primaryKey, LokiDatabase.#INDEX_VALUE_COLUMN],
                    disableMeta: true,
                });

                this.#indexes[collectionName] = collection;
                this.#columnIndexes[`${storeName}_${colName}`] = collection;
            });
        });
    }

    #getIndexCollection(storeName, indexName) {
        return this.#indexes[`${storeName}_${indexName}`];
    }

    #getIndexCollections(storeName) {
        return Object.entries(this.#indexes)
            .filter(([k, v]) => k.startsWith(`${storeName}_`))
            .map(([k, v]) => v);
    }

    put(storeName, rows) {
        rows.forEach(doc => {
            this.#putOne(storeName, doc);
        });
    }

    #putOne(storeName, doc) {
        const key = doc[this.#primaryKey];

        if (this.#by(storeName, key)) {
            this.#deleteOne(storeName, key);
            delete doc.$loki;
        }

        this.#collections[storeName].insert(doc);

        Object.keys(doc).forEach(colName => {
            const index = this.#columnIndexes[`${storeName}_${colName}`];
            if (!index) return;

            let values = doc[colName];

            if (!Array.isArray(values)) {
                values = [values];
            }

            values.forEach(v => {
                index.insert({
                    [this.#primaryKey]: key,
                    [LokiDatabase.#INDEX_VALUE_COLUMN]: v,
                });
            });
        });
    }

    #fetchIndexEntries(storeName, entries) {
        const results = {};

        entries.forEach(({ [this.#primaryKey]: key }) => {
            if (results[key]) return;

            const doc = this.#by(storeName, key);
            assert(doc);

            results[key] = doc;
        });

        return Object.values(results);
    }

    startsWithQuery(storeName, indexName, prefix) {
        return this.#fetchIndexEntries(
            storeName,
            this.#getIndexCollection(storeName, indexName)
                .find({
                    [LokiDatabase.#INDEX_VALUE_COLUMN]: {
                        $regex: RegExp(
                            `^${clientUtils.escapeRegExp(prefix)}`
                        )
                    }
                })
        );
    }

    equalsQuery(storeName, indexName, eqValue) {
        if (indexName) {
            return this.#fetchIndexEntries(
                storeName,
                this.#getIndexCollection(storeName, indexName)
                    .find({
                        [LokiDatabase.#INDEX_VALUE_COLUMN]: {
                            '$eq': eqValue,
                        }
                    })
            )
        } else {
            const ret = this.#by(storeName, eqValue);
            return ret ? [this.#by(storeName, eqValue)] : [];
        }
    }

    #by(storeName, key) {
        return this.#collections[storeName].by(
            this.#primaryKey, key,
        );
    }

    delete(storeName, keys) {
        keys.forEach(k => {
            this.#deleteOne(storeName, k);
        });
    }

    #deleteOne(storeName, key) {
        const doc = this.#by(storeName, key);

        if (!doc) return;

        this.#getIndexCollections(storeName).forEach(coll => {
            coll.findAndRemove({
                [this.#primaryKey]: key,
            })
        })

        this.#collections[storeName].remove(doc);
    }

    all(storeName) {
        const coll = this.#collections[storeName];
        return coll.find({});
    }

    dropDatabase() {
        this.#adapter.deleteDatabase(this.#databaseName);

        this.#adapter = null;
        this.#collections = null;
        this.#indexes = null;
        this.#columnIndexes = null;
    }
}

module.exports = LokiDatabase;