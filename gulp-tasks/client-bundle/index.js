
const StreamTokenizer = require('hyntax/lib/stream-tokenizer');
const constructTree = require('hyntax/lib/construct-tree');
var Buffer = require('buffer/').Buffer;

global.Buffer = Buffer;
global.process = {
    nextTick: (fn, ...args) => queueMicrotask(() => {
        fn(...args);
    }),
};
global.hyntax = { StreamTokenizer, constructTree };