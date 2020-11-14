const { tokenize, constructTree } = require('hyntax');
const util = require('util');

const inputHTML = '<html id="Hello">';

const { tokens } = tokenize(inputHTML);
const { ast } = constructTree(tokens);

console.log(JSON.stringify(tokens, null, 2));
console.log(util.inspect(ast, { showHidden: false, depth: null }));
