
const importFresh = require('import-fresh');
const assert = require('assert');
const utils = require('../utils');

class PartialTransformer {

    constructor({ preprocessor }) {
        this.preprocessor = preprocessor;
    }

    transform() {

        const { getVisitor } = PartialTransformer;
        const { getLine } = this.preprocessor.constructor;

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

            const parent = utils.peek(bindParents);
            const variable = parent.variables[stmt.original];

            if (variable) {
                this.mutating = true;
                return {
                    ...utils.deepClone(variable),
                    loc: stmt.loc,
                };
            }
        }

        ASTParser.prototype.MustacheStatement = function (stmt) {

            const parent = utils.peek(bindParents);

            switch (stmt.path.original) {
                case 'var':

                    stmt.params.forEach(({ original }) => {
                        parent.variables[original] = {
                            type: 'UndefinedLiteral',
                        };
                    });

                    if (stmt.hash) {
                        this.acceptKey(stmt, 'hash');

                        stmt.hash.pairs.forEach(({ key, value }) => {
                            parent.variables[key] = value;
                        });
                    }

                    this.mutating = true
                    return false;

                case 'delete':
                    assert(!stmt.hash, `No hashes are expected, ${getLine(stmt)}`);

                    stmt.params.forEach(({ original }) => {
                        parent.variables[original] = undefined;
                    });
                
                    this.mutating = true
                    return false;

                default:

                    this.acceptKey(stmt, 'path');    
                    this.acceptKey(stmt, 'hash');
                    this.acceptArray(stmt.params);

                    this.mutating = true
                    return stmt;
            }
        }

        const parser = new ASTParser();
        parser.accept(this.preprocessor.ast);
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


module.exports = PartialTransformer;