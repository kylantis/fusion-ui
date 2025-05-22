
const StreamTokenizer = require('hyntax/lib/stream-tokenizer');
const constructTree = require('hyntax/lib/construct-tree');
var Buffer = require('buffer/').Buffer;

self.Buffer = Buffer;
self.process = {
    nextTick: (fn, ...args) => queueMicrotask(() => {
        fn(...args);
    }),
};
self.hyntax = { StreamTokenizer, constructTree };