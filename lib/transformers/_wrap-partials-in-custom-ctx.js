
const importFresh = require('import-fresh');
const utils = require('../utils');

class PartialTransformer {

    constructor({ preprocessor }) {
        this.preprocessor = preprocessor;
    }

    transform() {

        const { getVisitor } = PartialTransformer;
        const {
            logger,
            constructor: { 
                noOpHelperName, createPathExpression, getDefaultStripOptions, 
                getHandleBarsBlockHelpers, getLine,
            },
        } = this.preprocessor;

        const _this = this;

        const bindParents = [
            // Root
            {}
        ];
        const customBlockCtx = [false];

        const isCustomContext = () => utils.peek(customBlockCtx);

        const Visitor = getVisitor();
        function ASTParser() {
        }
        ASTParser.prototype = new Visitor();

        const addParamsAsHashes = (stmt) => {
            const hash = stmt.hash || (stmt.hash = { type: 'Hash', pairs: [] });
            const { params } = stmt;

            if (params.length) {
                // Add params (path expressions) as hash pairs
                // For example:
                // {{> myPartial myOtherContext }} == {{> myPartial myOtherContext = ./myOtherContext }}
                params
                    .filter(param => param.type === 'PathExpression')
                    .forEach((param) => {
                        hash.pairs.push({
                            type: 'HashPair',
                            key: param.original,
                            value: createPathExpression({ original: param.original }),
                        });
                    });

                stmt.params = [];
            }
        };

        const isInlineBlock = (decoratorName) => {
            for (const parent of bindParents) {
                const decorators = parent.decorators || [];

                if (decorators.includes(decoratorName)) {
                    return true;
                }
            }
            return false;
        }

        const isPartial = (partialName) => {

            if (isInlineBlock(partialName)) {
                return true;
            }

            try {
                this.preprocessor.getPartialPath(partialName);
                return true;
            } catch (e) { }

            return false;
        }

        ASTParser.prototype.DecoratorBlock = function (stmt) {
            const { original: decoratorName } = stmt.params[0];
            
            bindParents.push(stmt.program);
            this.accept(stmt.program);
            bindParents.pop();

            const parent = utils.peek(bindParents);
            const decorators = parent.decorators || (parent.decorators = []);

            decorators.push(decoratorName);
        }

        ASTParser.prototype.BlockStatement = function (stmt) {
            const isCustomBlock = !getHandleBarsBlockHelpers().includes(stmt.path.original);
            if (isCustomBlock) {
                customBlockCtx.push(true);
            }

            bindParents.push(stmt.program);
            this.accept(stmt.program);
            bindParents.pop();

            if (stmt.inverse) {
                bindParents.push(stmt.inverse);
                this.acceptKey(stmt, 'inverse');
                bindParents.pop();
              }

            if (isCustomBlock) {
                customBlockCtx.pop();
            }

        }

        ASTParser.prototype.PartialStatement = function (stmt) {

            const partialName = stmt.name.original;

            if (!isPartial(partialName)) {
                return;
            }

            this.mutating = true;

            // Add params as hashes
            addParamsAsHashes(stmt);

            const nonLiteralHashes = {};

            if (stmt.hash && !isCustomContext()) {
                stmt.hash.pairs.forEach((pair) => {
                    if (!pair.value.type.endsWith('Literal')) {
                        nonLiteralHashes[pair.key] = pair.value;
                    }
                });
            }

            if (
                Object.values(nonLiteralHashes)
                    .filter(({ type, original }) =>
                        type == 'SubExpression' ||
                        (type == 'PathExpression' && _this.preprocessor.methodNames.includes(original))
                    )
                    .length
            ) {

                // Update hash pairs, so that the non linear hashes are converted to
                // path expressions using the hash keys

                stmt.hash.pairs = stmt.hash.pairs.map((pair) => {
                    if (!pair.value.type.endsWith('Literal')) {
                        pair.value = createPathExpression({ original: pair.key });
                    }
                    return pair;
                });

                // logger.info(
                //     `Wrapping partial statement at ${getLine(stmt)} in a custom context, because it contains hashes that can only be dynamically resolved`
                // );

                // Wrap partial statement in a custom block
                return {
                    type: 'BlockStatement',
                    path: createPathExpression({ original: noOpHelperName }),
                    params: [],
                    hash: {
                        type: 'Hash',
                        pairs: Object.entries(nonLiteralHashes)
                            .map(([key, value]) => ({
                                type: 'HashPair', key, value,
                            }))
                    },
                    program: {
                        type: 'Program',
                        body: [
                            stmt
                        ],
                        blockParams: [utils.generateRandomString()]
                    },
                    ...getDefaultStripOptions(stmt.loc),
                    partialWrapper: true,
                };
            }


            return stmt;
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


module.exports = PartialTransformer;