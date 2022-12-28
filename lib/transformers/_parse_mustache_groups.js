
const parser = require('@handlebars/parser');
const assert = require('assert');
const importFresh = require('import-fresh');
const utils = require('../utils');

class MustacheGroupTransformer {

    static MUST_GRP = 'MustacheGroup';

    static mustacheStart = '${';
    static mustacheEnd = '}';

    constructor({ preprocessor }) {
        this.preprocessor = preprocessor;
    }

    transform(ast) {
        this.ast = ast;
        this.parseMustacheGroups();
    }

    parseMustacheGroups() {
        const {
            MUST_GRP, isMustacheGroup, getVisitor
        } = MustacheGroupTransformer;

        const _this = this;
        const Visitor = getVisitor([MUST_GRP]);

        function ASTParser() {
        }
        ASTParser.prototype = new Visitor();

        ASTParser.prototype.StringLiteral = function (stmt) {

            const { logger } = _this.preprocessor;
            const { getLine } = _this.preprocessor.constructor;

            // Note: Syntax highlighting in some code editors may trick the users into believing that it is valid to mustache statements nested inside 
            // string literals, when in reality it's not. Hence, we need to search for such scenarios and emit a warning.

            const checkForMustacheExpressions = () => {

                let { original } = stmt;

                const printWarning = (index) => {

                    const loc = utils.deepClone(stmt.loc);
                    loc.start.column += 2;
                    loc.start.column += index;
                    loc.end = { end: { ...loc.start } };
                    loc.end.column += 2;

                    logger.warn(
                        `[${getLine({ loc })}] Mustache expression "${original.substring(index, index + 2)}" has no special meaning inside a StringLiteral`
                    );

                    return loc;
                }

                for (const s of ['{{', '}}']) {
                    let i;
                    while ((i = original.indexOf(s)) >= 0) {
                        printWarning(i);
                        original = original.replace(s, utils.generateRandomString(s.length));
                    }
                }
            }

            checkForMustacheExpressions();

            if (isMustacheGroup(stmt)) {
                const expr = _this.getMustacheGroup(stmt);

                stmt.type = expr.type;
                stmt.items = expr.items;

                this.mutating = true;

                return stmt;
            }
        }

        const parser = new ASTParser();
        parser.accept(this.ast);
    }

    static isMustacheGroup({ original }) {
        const { mustacheStart } = MustacheGroupTransformer;
        return original.includes(mustacheStart);
    }

    getMustacheGroup({ original, loc }) {

        const {
            mustacheStart, mustacheEnd, MUST_GRP,
        } = MustacheGroupTransformer;

        const { methodNames } = this.preprocessor;

        const expr = {
            type: MUST_GRP,
            items: [],
        }

        const addSegment = () => {
            if (!segment.length) {
                return;
            }

            if (segment.startsWith(mustacheStart)) {
                assert(segment.endsWith(mustacheEnd));

                segment = segment
                    .replace(mustacheStart, '')
                    .replace(mustacheEnd, '');

                assert(segment.length);

                try {

                    let item = {
                        ...parser.parse(`{{${segment}}}`).body[0],
                        loc,
                    };

                    assert(item.path.type == 'PathExpression');

                    if (item.params.length || methodNames.includes(item.path.original)
                    ) {
                        item.prune = false;
                        item.type = 'SubExpression'
                    } else {
                        item = item.path;
                    }

                    expr.items.push(item);
                } catch (e) {
                    throw Error(`${original} ${e.message}`);
                }

            } else {
                expr.items.push({
                    type: 'StringLiteral',
                    original: segment,
                    loc
                });
            }

            segment = '';
        }

        let i = 0;
        let segment = '';

        while (i < original.length) {

            let char = original[i];

            if (char == mustacheStart[0]) {
                assert(original[i + 1] == mustacheStart[1]);
                char += mustacheStart[1];
                i += 1;
            }

            switch (char) {
                case mustacheStart:
                    addSegment();
                    segment = mustacheStart;
                    break;

                case mustacheEnd:
                    if (segment.startsWith(mustacheStart)) {
                        segment += mustacheEnd;
                        addSegment();
                    }
                    break;

                default:
                    segment += char;
                    break;
            }

            if (i == original.length - 1) {
                addSegment();
            }

            i++;
        }

        return expr;
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