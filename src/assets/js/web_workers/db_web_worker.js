
// cjs import polyfill
function fetch(url) {
    self.module = {};
    importScripts(url);
    return self.module.exports;
}

// globals polyfill
self.assert = (condition, message) => {
    if (!condition) {
        throw Error(`Assertion Error${message ? `: ${message}` : ''}`);
    }
};

const clientUtils = fetch('/assets/js/client-utils.min.js');

fetch('/assets/js/lib/database.min.js');

const { DEFAULT_PRIMARY_KEY: primaryKey } = K_Database;


const connections = [];
let currentIndex = -1;

let db;

const connectDatabase = (dbName, numConnections) => {
    db = new K_Database(dbName);
    return db.createPersistenceLayer();
}

const pruneCollChild = async (auxCallId, hooklistStoreName, mustachelistStoreName, componentId, parent, key, timestamp) => {
    const { pruneCollChild } = clientUtils;

    await pruneCollChild(db, hooklistStoreName, mustachelistStoreName, componentId, parent, key, timestamp);
    self.postMessage({ callId: auxCallId });
}

const updateCollChild = async (auxCallId, hooklistStoreName, componentId, parent, key, info, timestamp) => {
    const { updateCollChild } = clientUtils;

    await updateCollChild(db, hooklistStoreName, componentId, parent, key, info, timestamp);
    self.postMessage({ callId: auxCallId });
}

onmessage = async (event) => {
    const [callId, auxCallId, fnName, params] = event.data;

    switch (fnName) {

        case 'connectDatabase':
            (async () => {
                const [dbName, type] = params;
                await connectDatabase(dbName);

                self.postMessage({ callId });
                self.postMessage({ callId: auxCallId });
            })();
            break;

        case 'put':
            (async () => {
                const [storeName, rows] = params;
                db.put(storeName, rows)
                    .then(() => {
                        self.postMessage({ callId: auxCallId });
                    });

                self.postMessage({ callId });
            })();
            break;

        case 'delete':
            (async () => {
                const [storeName, keys] = params;
                db.delete(storeName, keys).then(() => {
                    self.postMessage({ callId: auxCallId });
                });;

                self.postMessage({ callId });
            })();
            break;

        case 'equalsQuery':
            (async () => {
                const [storeName, indexName, value] = params;
                const ret = await db.equalsQuery(storeName, indexName, value);

                self.postMessage({ callId, ret });
                self.postMessage({ callId: auxCallId });
            })();
            break;

        case 'startsWithQuery':
            (async () => {
                const [storeName, indexName, prefix] = params;
                const ret = await db.startsWithQuery(storeName, indexName, prefix);

                self.postMessage({ callId, ret });
                self.postMessage({ callId: auxCallId });
            })();
            break;

        case 'updateCollChild':
            (async () => {
                const [hooklistStoreName, componentId, parent, key, info, timestamp] = params;

                updateCollChild(auxCallId, hooklistStoreName, componentId, parent, key, info, timestamp);

                self.postMessage({ callId });
            })();
            break;

        case 'pruneCollChild':
            (async () => {
                const [hooklistStoreName, mustachelistStoreName, componentId, parent, key, timestamp] = params;

                pruneCollChild(auxCallId, hooklistStoreName, mustachelistStoreName, componentId, parent, key, timestamp);

                self.postMessage({ callId });
            })();
            break;

        default:
            console.error(`Unknown worker function ${fnName}`);

            self.postMessage({ callId });
            self.postMessage({ callId: auxCallId });
            break;
    }
};