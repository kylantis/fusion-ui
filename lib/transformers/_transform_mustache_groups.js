const importFresh = require('import-fresh');
const assert = require('assert');

class MustacheGroupTransformer {

    static S_EXPR = 'SubExpression';

    constructor({ preprocessor }) {
        this.preprocessor = preprocessor;
    }

    transform(ast) {
        this.ast = ast;
        this.transformMustacheGroups();
    }

    transformMustacheGroups() {

        const {
            concatenateHelperName,
            createPathExpression,
        } = this.preprocessor.constructor;

        const { getVisitor } = MustacheGroupTransformer;

        const Visitor = getVisitor();

        function ASTParser() {
        }
        ASTParser.prototype = new Visitor();

        ASTParser.prototype.MustacheGroup = function (stmt) {

            const { items, loc } = stmt;

            this.mutating = true;
            return {
                type: 'SubExpression',
                path: {
                    ...createPathExpression({ original: concatenateHelperName }),
                    loc,
                },
                params: items,
                loc,
            };
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

module.exports = MustacheGroupTransformer;