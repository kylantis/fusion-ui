const implodeSubExpressions = require('./_implode_subexpressions');
const parseMustacheGroups = require('./_parse_mustache_groups');
const addLogicGates = require('./_create-logic-gates');
const transformMustacheGroups = require('./_transform_mustache_groups');
const wrapPartialsInCustomCtx = require('./_wrap-partials-in-custom-ctx');

module.exports = [
    implodeSubExpressions,
    parseMustacheGroups,
    addLogicGates,
    transformMustacheGroups,
    wrapPartialsInCustomCtx
]