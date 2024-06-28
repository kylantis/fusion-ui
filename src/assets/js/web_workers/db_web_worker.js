
function addGlobals() {
    self.assert = (condition, message) => {
        if (!condition) {
            throw Error(`Assertion Error${message ? `: ${message}` : ''}`);
        }
    };
}

// cjs import polyfill
function fetch(url) {
    self.module = {};
    importScripts(url);
    return self.module.exports;
}

addGlobals();

const clientUtils = fetch('/assets/js/client-utils.min.js');

fetch('/assets/js/lib/indexed_db.min.js');

const { DEFAULT_PRIMARY_KEY: primaryKey } = K_IndexedDB;

const logicGatePathRoot = 'lg';
const pathSeparator = '__';
const logicGatePathPrefix = RegExp(`^${logicGatePathRoot}${pathSeparator}`);

const ARRAY_BLOCK_PATH_INDEX = 'arrayBlockPath_index';


const connections = [];
let currentIndex = -1;


let db;


const connectDatabase = (dbName, numConnections) => {
    db = new K_IndexedDB(dbName);
    return db.connect();
}



const pruneCollChild = async (auxCallId, hooklistStoreName, mustachelistStoreName, componentId, parent, key, timestamp) => {
    const { toFqPath, isNumber } = clientUtils;

    const isArray = isNumber(key);

    const path = toFqPath({ isArray, isMap: !isArray, parent, prop: key });

    const rows = await db.getAll(hooklistStoreName, ARRAY_BLOCK_PATH_INDEX, path);

    const mustacheRefIds = [];

    const ids = rows
        .filter(({ [primaryKey]: id, updatedAt }) => id.startsWith(`${componentId}_`) && updatedAt < timestamp)
        .map(({ id, mustacheRef }) => {
            if (mustacheRef) {
                mustacheRefIds.push(`${componentId}_${mustacheRef}`);
            }
            return id
        });


    Promise.all([
        db.delete(hooklistStoreName, ids),
        db.delete(mustachelistStoreName, mustacheRefIds)
    ]).then(() => {
        self.postMessage({ callId: auxCallId });
    });
}

const updateCollChild = async (auxCallId, hooklistStoreName, componentId, parent, key, info, timestamp) => {
    const { toFqPath, isNumber, isCanonicalArrayIndex, toCanonicalPath } = clientUtils;

    const isArray = isNumber(key);

    const canonicalParent = toCanonicalPath(parent);

    const path = toFqPath({ isArray, isMap: !isArray, parent, prop: key });
    const newPath = (isArray && (info.index != undefined)) ? toFqPath({ isArray, parent, prop: `${info.index}` }) : null;

    const dataPathRoot = 'data';
    const pathSeparator = '__';

    const rows = await db.getAll(hooklistStoreName, ARRAY_BLOCK_PATH_INDEX, path);

    const updates = rows
        .filter(({ [primaryKey]: id, updatedAt }) => id.startsWith(`${componentId}_`) && updatedAt < timestamp)
        .map((row) => {
            const {
                arrayBlockPath, canonicalPath, owner, blockData, blockStack, participants, canonicalParticipants,
            } = row;

            let blockDataKey;

            for (let k of Object.keys(blockData)) {
                if ((k.includes('[') ? toCanonicalPath(k) : k) == canonicalParent) {
                    blockDataKey = k;
                    break;
                }
            }

            assert(blockDataKey);

            if (newPath) {

                const isknownCanonicalPath = p => p.startsWith(`${canonicalParent}_$`) || isCanonicalArrayIndex(p, parent);

                arrayBlockPath.forEach((p, i) => {
                    if (p.startsWith(path)) {
                        arrayBlockPath[i] = p.replace(path, newPath);
                    }
                });

                if (canonicalPath.startsWith(logicGatePathRoot)) {
                    canonicalParticipants.forEach((p, i) => {
                        if (
                            participants[i].startsWith(path) &&
                            isknownCanonicalPath(p.split(pathSeparator).join('.'))
                        ) {
                            return participants[i] = participants[i].replace(path, newPath);
                        }
                    });
                } else
                    if (
                        owner.startsWith(`${dataPathRoot}${pathSeparator}${path}`) &&
                        isknownCanonicalPath(canonicalPath.split(pathSeparator).join('.'))
                    ) {
                        row.owner = owner.replace(path, newPath);
                    }

            }

            const updateBlockData = (entry) => {
                assert(entry);

                if (info.index != undefined) {
                    entry.index = info.index;
                }

                if (info.length != undefined) {
                    entry.length = info.length;
                }
            }

            updateBlockData(blockData[blockDataKey]);

            blockStack
                .filter(({ blockData }) => blockData)
                .forEach(({ blockData }) => {
                    const entry = blockData[blockDataKey];
                    if (entry) updateBlockData(entry);
                });

            return row;
        });

    db.put(hooklistStoreName, updates)
        .then(() => {
            self.postMessage({ callId: auxCallId });
        });
}

onmessage = async (event) => {
    const [callId, auxCallId, fnName, params] = event.data;

    switch (fnName) {

        case 'connectDatabase':
            (async () => {
                const [dbName] = params;
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

        case 'query':
            (async () => {
                const [storeName, indexName, value] = params;
                const ret = await db.getAll(storeName, indexName, value);

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