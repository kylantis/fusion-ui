
const parseMustacheGroups = require('./_parse_mustache_groups');
const inlineVariables = require('./_inline_variables');
const implodeSubExpressions = require('./_implode_subexpressions');
const addLogicGates = require('./_create-logic-gates');
const transformMustacheGroups = require('./_transform_mustache_groups');
const evaluateCompilePhaseConditionals = require('./_evaluate_compile_phase_conditionals');

module.exports = [
    parseMustacheGroups,
    inlineVariables,
    addLogicGates,
    transformMustacheGroups,
    implodeSubExpressions,
    evaluateCompilePhaseConditionals,
]