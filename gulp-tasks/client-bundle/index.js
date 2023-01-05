
const StreamTokenizer = require('hyntax/lib/stream-tokenizer');
var Buffer = require('buffer/').Buffer;

global.Buffer = Buffer;
global.process = {
    nextTick: (fn, ...args) => queueMicrotask(() => {
        fn(...args);
    }),
};
global.hyntaxStreamTokenizerClass = StreamTokenizer;