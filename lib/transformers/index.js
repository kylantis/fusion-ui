
const parseMustacheGroups = require('./_parse_mustache_groups');
const inlineVariables = require('./_inline_variables');
const implodeSubExpressions = require('./_implode_subexpressions');
const addLogicGates = require('./_create-logic-gates');
const transformMustacheGroups = require('./_transform_mustache_groups');
const wrapPartialsInCustomCtx = require('./_wrap-partials-in-custom-ctx');

module.exports = [
    parseMustacheGroups,
    inlineVariables,
    implodeSubExpressions,
    addLogicGates,
    transformMustacheGroups,
    wrapPartialsInCustomCtx
]