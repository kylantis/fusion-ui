
const importFresh = require('import-fresh');
const assert = require('assert');
const utils = require('../utils');

class InlineVariableTransformer {

    constructor({ preprocessor }) {
        this.preprocessor = preprocessor;
    }

    transform(ast) {
        this.ast = ast;

        const { getVisitor } = InlineVariableTransformer;

        const bindParents = [{ variables: {} }];

        const getVariables = () => {
            let variables = {};

            for (let i = 0; i < bindParents.length; i++) {
                const parent = bindParents[i];
                variables = {
                    ...variables,
                    ...parent.variables
                };
            }

            return variables;
        }

        const _this = this;

        const Visitor = getVisitor();
        function ASTParser() {
        }
        ASTParser.prototype = new Visitor();

        ASTParser.prototype.DecoratorBlock = function (stmt) {

            this.acceptKey(stmt, 'hash');

            // Note: Because DecoratorBlock params are used as parameter keys, variable inlining is not
            // enabled for them

            bindParents.push(stmt.program);

            stmt.program.variables = getVariables();
            this.accept(stmt.program);
            delete stmt.program.variables;

            bindParents.pop();

            this.mutating = true;
            return stmt;
        }

        ASTParser.prototype.BlockStatement = function (stmt) {

            this.acceptKey(stmt, 'hash');
            this.acceptArray(stmt.params);

            bindParents.push(stmt.program);

            stmt.program.variables = getVariables();
            this.accept(stmt.program);
            delete stmt.program.variables;

            bindParents.pop();

            if (stmt.inverse) {
                bindParents.push(stmt.inverse);

                stmt.inverse.variables = getVariables();
                this.acceptKey(stmt, 'inverse');
                delete stmt.inverse.variables;

                bindParents.pop();
            }

            this.mutating = true;
            return stmt;
        }

        ASTParser.prototype.PathExpression = function (stmt) {

            const { resetPathExpression, throwError } = _this.preprocessor.constructor;

            const parent = utils.peek(bindParents);

            const variable = parent.variables[stmt.original] || parent.variables[stmt.parts[0]];

            if (variable) {
                this.mutating = true;
                switch (true) {
                    case !!stmt.forPartial:
                        // <stmt> is a partial param, hence we want to replace param with a hash instead
                        const partial = stmt.forPartial;

                        const hash = partial.hash || (partial.hash = { type: 'Hash', pairs: [] });
                        hash.pairs.push({
                            type: 'HashPair',
                            key: stmt.original,
                            value: variable,
                        });

                        return false;
                    case variable.forVariable != stmt.original:
                        if (variable.type != 'PathExpression') {
                            throwError(`Expected variable "${variable.forVariable}" to be a PathExpression because accessor has a subpath`, stmt);
                        }

                        return {
                            ...resetPathExpression({
                                stmt,
                                original: stmt.original.replace(variable.forVariable, variable.original),
                            })
                        };
                    default:
                        return {
                            ...utils.deepClone(variable),
                        };
                }
            }

            // Remove this if applicable, to avoid a circular reference
            delete stmt.forPartial;
        }

        ASTParser.prototype.MustacheStatement = function (stmt) {
            const {
                wordPattern, throwError, variableHelperName, getHashValue
            } = _this.preprocessor.constructor;

            const validateVariableName = (name) => {
                if (!name.match(wordPattern)) {
                    throwError(`Variable name "${name}" must be a word`, stmt);
                }
            }

            this.mutating = true

            this.acceptKey(stmt, 'path');
            this.acceptKey(stmt, 'hash');
            this.acceptArray(stmt.params);

            const parent = utils.peek(bindParents);

            if (stmt.path.original == variableHelperName) {

                const { original: inline } = getHashValue({
                    stmt, key: 'inline', type: 'BooleanLiteral', cleanup: true,
                }) || { original: false };

                if (inline) {

                    stmt.params.forEach(({ original }) => {
                        validateVariableName(original);

                        parent.variables[original] = {
                            type: 'UndefinedLiteral',
                            forVariable: original,
                        };
                    });

                    (stmt.hash ? stmt.hash.pairs : [])
                        .forEach(({ key, value }) => {
                            validateVariableName(key);

                            parent.variables[key] = {
                                ...value,
                                forVariable: key,
                            };
                        });

                    return false;
                }
            }

            return stmt;
        }

        ASTParser.prototype.PartialStatement = function (stmt) {
            const { params } = stmt;

            if (params) {
                params.filter(({ type }) => type == 'PathExpression')
                    .forEach(param => param.forPartial = stmt);
                this.acceptArray(params);
            }

            this.acceptKey(stmt, 'hash');

            this.mutating = true
            return stmt;
        }

        const parser = new ASTParser();
        parser.accept(this.ast);
    }

    static getVisitor() {

        // We want to keep the shared handlebars object clean
        const handlebars = importFresh('handlebars');

        const ASTParser = handlebars.Visitor;

        // If this is a partial, the root ast element will be PartialWrapper
        // instead of Program as recognized by hbs by default
        ASTParser.prototype.PartialWrapper = function (stmt) {
            stmt.type = 'Program';
            this.accept(stmt);

            this.mutating = true;

            stmt.type = 'PartialWrapper';
            return stmt;
        }

        ASTParser.prototype.MustacheGroup = function (stmt) {
            this.acceptArray(stmt.items);
        }

        return ASTParser;
    }
}


module.exports = InlineVariableTransformer;