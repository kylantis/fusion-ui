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
self.clientUtils = clientUtils;

fetch('/assets/js/lib/database.min.js');
self.K_Database = K_Database;

importScripts('/assets/js/lib/lokijs.min.js');

fetch('/assets/js/lib/loki_db.min.js');
self.LokiDb = LokiDb;

fetch('/assets/js/lib/indexed_db.min.js');

fetch('/assets/js/lib/trie.min.js');

const { DEFAULT_PRIMARY_KEY: primaryKey } = K_Database;


const connections = [];
let currentIndex = -1;

let db;

const pathTries = new Map();

const createPathTries = (pathList) => {
    Object.entries(pathList).forEach(([className, _pathList]) => {
        const pathTrie = new K_Trie(clientUtils.getAllSegments);

        _pathList.forEach(p => {
            pathTrie.insert(p);
        });

        pathTries.set(className, pathTrie);
    });
}

const addPathToTrie = (className, path, segments) => {
    pathTries.get(className).insert(path, segments);
}

const connectDatabase = (dbName, storeInfoList) => {
    db = new K_Database(dbName, storeInfoList);
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
                const [dbName, storeInfoList] = params;
                await connectDatabase(dbName, storeInfoList);

                self.postMessage({ callId });
                self.postMessage({ callId: auxCallId });
            })();
            break;

        case 'createPathTries':
            (async () => {
                const [pathList] = params;

                createPathTries(pathList);

                self.postMessage({ callId });
                self.postMessage({ callId: auxCallId });
            })();
            break;

        case 'addPathToTrie':
            (async () => {
                const [className, path, segments] = params;

                addPathToTrie(className, path, segments);

                self.postMessage({ callId });
                self.postMessage({ callId: auxCallId });
            })();
            break;

        case 'put':
            (async () => {
                const [storeName, rows] = params;
                await db.put(storeName, rows);

                self.postMessage({ callId });
                self.postMessage({ callId: auxCallId });
            })();
            break;

        case 'delete':
            (async () => {
                const [storeName, keys] = params;
                await db.delete(storeName, keys);

                self.postMessage({ callId });
                self.postMessage({ callId: auxCallId });
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
                const [className, storeName, indexName, prefix] = params;
                const ret = await db.startsWithQuery(
                    pathTries.get(className), storeName, indexName, prefix
                );

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