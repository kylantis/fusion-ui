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

            const visitSubExpression = (stmt) => {

                if (stmt.type != S_EXPR) {
                    return stmt;
                }

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

                if (stmt.path.type.endsWith('Literal')) {
                    ensureNoHashesOrParams(stmt);

                    return stmt.path;
                }

                if (stmt.path.type == S_EXPR) {
                    const path = visitSubExpression(stmt.path);

                    if (path.type.endsWith('Literal')) {
                        ensureNoHashesOrParams(stmt);

                        return path;
                    }
                }

                stmt.params = stmt.params.map(visitSubExpression);

                if (stmt.hash) {
                    stmt.hash.pairs = stmt.hash.pairs.map(pair => {
                        pair.value = visitSubExpression(pair.value);
                        return pair;
                    });
                }

                return stmt;
            }

            this.mutating = true;
            return visitSubExpression(stmt);
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

        return ASTParser;
    }
}

module.exports = SubExpressionTransformer;