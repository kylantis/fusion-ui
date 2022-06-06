const importFresh = require('import-fresh');
const assert = require('assert');

class SubExpressionTransformer {

    static S_EXPR = 'SubExpression';

    constructor({ preprocessor }) {
        this.preprocessor = preprocessor;
    }

    transform() {
        this.implodeSubExpressions();
    }

    implodeSubExpressions() {

        const {
            getLine
        } = this.preprocessor.constructor;

        const { S_EXPR, getVisitor } = SubExpressionTransformer;

        const Visitor = getVisitor();

        function ASTParser() {
        }
        ASTParser.prototype = new Visitor();

        ASTParser.prototype.SubExpression = function (stmt) {

            const ensureNoHashesOrParams = (stmt) => {
                assert(
                    !stmt.params.length,
                    `No params allows in ${S_EXPR}: ${getLine(stmt)}`
                );

                assert(
                    !stmt.hash || !stmt.hash.pairs.length,
                    `No hashes allows in ${S_EXPR}: ${getLine(stmt)}`
                );
            }

            const unwrap = (stmt) => {
                if (stmt.type != S_EXPR) {
                    return stmt;
                }
                if (['Literal', 'MustacheGroup'].includes(stmt.path.type)) {
                    ensureNoHashesOrParams(stmt);
                    return stmt.path;
                }

                stmt.params = stmt.params.map(unwrap);

                if (stmt.hash) {
                    stmt.hash.pairs = stmt.hash.pairs.map(pair => {
                        pair.value = unwrap(pair.value);
                        return pair;
                    });
                }
                return stmt;
            };

            const visitSubExpression = (stmt) => {

                if (stmt.type != S_EXPR) {
                    return stmt;
                }

                stmt.params = stmt.params.map(visitSubExpression);

                if (stmt.hash) {
                    stmt.hash.pairs = stmt.hash.pairs.map(pair => {
                        pair.value = visitSubExpression(pair.value);
                        return pair;
                    });
                }

                if (stmt.path.type != S_EXPR || stmt.params.length || stmt.hash) {
                    return stmt;
                } else {
                    return visitSubExpression(stmt.path);
                }
            }

            this.mutating = true;
            return unwrap(visitSubExpression(stmt));
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

module.exports = SubExpressionTransformer;