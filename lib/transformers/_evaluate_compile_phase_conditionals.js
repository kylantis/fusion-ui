const importFresh = require('import-fresh');

class CompilePhaseConditionalTransformer {

    constructor({ preprocessor }) {
        this.preprocessor = preprocessor;
    }

    transform(ast) {
        this.ast = ast;
        this.transformConditionals();
    }

    transformConditionals() {
        // TODO
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

module.exports = CompilePhaseConditionalTransformer;