
const handlebars = require('handlebars');
const assert = require('assert');

class TernaryTransformer {

    static T_EXPR = 'TernaryExpression';

    constructor({ Preprocessor, preprocessor }) {
        this.Preprocessor = Preprocessor;
        this.preprocessor = preprocessor;
    }

    transform() {

        this.explodeOperators();

        this.parse();

        this.addLogicGatesAndHelper();
    }

    explodeOperators() {
        const { visitNodes, createPathExpression } = this.Preprocessor;
        const { ast } = this.preprocessor;
        visitNodes({
            types: ['SubExpression', 'MustacheStatement'],
            ast,
            consumer: ({ stmt }) => {

                const segments = [stmt.path, ...stmt.params];
                const compositeSegments = {};
                let newSegments = [];

                for (let i = 0; i < segments.length; i++) {

                    const { type, original } = segments[i];
                    if (type !== 'PathExpression' || original.length == 1) {
                        continue;
                    }

                    let j = 0;
                    let str = '';

                    while (j < original.length) {
                        const char = original[j];
                        const isSymbol = char == '?' || char == ':';
                        str += `${isSymbol ? ',' : ''}${char}${isSymbol && j < original.length - 1 ? ',' : ''}`;
                        j++;
                    }

                    if (str == original) {
                        continue;
                    }

                    compositeSegments[i] = str.split(',');
                }

                for (let i = 0; i < segments.length; i++) {
                    if (compositeSegments[i]) {
                        newSegments = [
                            ...newSegments,
                            ...compositeSegments[i]
                                .filter(s => !!s.length)
                                .map(s => createPathExpression({
                                    original: s,
                                }))
                        ]
                    } else {
                        newSegments.push(segments[i]);
                    }
                }

                stmt.path = newSegments[0];
                stmt.params = newSegments.slice(1, newSegments.length);
            },
        });
    }

    getExpression({ stmt }) {

        const { T_EXPR } = TernaryTransformer;
        const { getLine } = this.Preprocessor;
        const { methodNames } = this.preprocessor;

        const { type, path, params, hash } = stmt;

        if (type === 'PathExpression' || type.endsWith('Literal') || !params.length) {
            return stmt;
        }

        assert(type === 'SubExpression' || type === 'MustacheStatement');

        // index of '?'
        let leftStart;

        // no-op array for keeping track of inner ternary expressions
        const noOpStack = [];

        // index of ':'
        let rightStart;

        const expr = params[0].original === '?' ? {
            type: T_EXPR,
        } : {
                type,
                path,
                params: [],
            };

        for (let i = 0; i < params.length; i++) {

            const param = this.getExpression({ stmt: stmt.params[i] });

            if (expr.params) {
                expr.params.push(param);
            }

            const { type, original } = param;

            param.isTernary = (rightStart || (leftStart !== undefined)) &&
                (i - (rightStart || leftStart)) % 2 === 0;


            if (param.isTernary && original !== '?' && original !== ':') {
                throw new Error(`Expected ternary operator, ${getLine(param)}`);
            }

            switch (true) {

                case leftStart == undefined:
                    if (type === 'PathExpression' && original == '?') {
                        expr.condition = this.getExpression({
                            stmt: expr.params ? expr.params[i - 1] : path
                        })
                        leftStart = i;
                    }
                    break;

                case param.isTernary:

                    assert(leftStart !== undefined);
                    assert(i < params.length - 1);

                    switch (true) {
                        case original === '?':
                            noOpStack.push({});
                            break;
                        case original === ':':

                            if (noOpStack.length == 0) {

                                if (expr.left === undefined) {
                                    const children = params.slice(leftStart + 1, i);

                                    expr.left = this.getExpression({
                                        stmt: children.length === 1 ? children[0] : {
                                            type: 'SubExpression',
                                            path: children[0],
                                            params: children.slice(1)
                                        }
                                    });
                                    rightStart = i;
                                }

                            } else {
                                noOpStack.pop();
                            }

                            break;
                    }
                    break;

                case rightStart !== undefined &&
                    (
                        (i == params.length - 1) ||
                        (params[i + 1].original !== '?' && params[i + 1].original !== ':')
                    ):

                    assert(noOpStack.length === 0, `The ternary operator stack is imbalanced, ${getLine(param)}`);

                    const children = params.slice(rightStart + 1, i + 1);

                    expr.right = this.getExpression({
                        stmt: children.length === 1 ? children[0] : {
                            type: 'SubExpression',
                            path: children[0],
                            params: children.slice(1)
                        }
                    });

                    if (expr.params) {
                        const start = leftStart - 1;
                        const delCount = (i + 1) - start;
                        const elements = [{
                            type: T_EXPR,
                            condition: expr.condition,
                            left: expr.left,
                            right: expr.right
                        }];

                        // We need to maintain the length of expr.params, as this
                        // is modifed in place during the course of iteration, we
                        // 'll filter the nulls later, just before returning
                        if (delCount > 1) {
                            for (let i = 0; i < delCount - 1; i++) {
                                elements.push(null);
                            }
                        }

                        expr.params.splice(
                            start,
                            delCount,
                            ...elements,
                        );

                        delete expr.condition;
                        delete expr.left;
                        delete expr.right;

                        leftStart = undefined;
                        rightStart = undefined;

                    } else {
                        if (i < (params.length - 1)) {
                            throw new Error(`Expected end of ternary expression, but found ${params[i + 1].type} ${getLine(params[i + 1])}`);
                        }
                    }

                    break;
            }
        }

        if (expr.params) {

            expr.params = expr.params.filter(p => p != null);

            const { path } = expr;
            assert(
                methodNames.includes(path.original),
                `Unknown method: ${path.original}, ${getLine(path)}`
            );

            expr.params.forEach(param => {
                if (param.original === '?' || param.original == ':') {
                    throw new Error(`The ternary operator stack is imbalanced, ${getLine(param)}`);
                }
            });
        }

        if (hash) {
            assert(type !== T_EXPR, `Unxpected hash pairs, ${getLine(stmt)}`);

            hash.pairs = hash.pairs.map(pair => ({
                ...pair,
                value: this.getExpression({ stmt: pair.value })
            }), this);

            expr.hash = hash;
        }

        return expr;
    }

    parse() {

        const { T_EXPR } = TernaryTransformer;
        const _this = this;

        const { Visitor } = handlebars;

        function ASTParser() {
        }
        ASTParser.prototype = new Visitor();

        ASTParser.prototype.SubExpression = function (stmt) {
            this.mutating = true;
            return _this.getExpression({ stmt });
        }

        ASTParser.prototype.MustacheStatement = function (stmt) {
            this.mutating = true;
            const expr = _this.getExpression({ stmt });

            if (expr.type === T_EXPR) {
                return {
                    ...stmt,
                    type: 'MustacheStatement',
                    path: expr,
                    params: [],
                };
            }
            return expr;
        }

        const parser = new ASTParser();
        parser.accept(this.preprocessor.ast);
    }

    static addLogicGate({ stmt }) {
        const { T_EXPR } = TernaryTransformer;

        const participants = [];
        const table = [];
        let hasSubExpression = undefined;

        const accept = (stmt) => {

            const { type, condition, left, right } = stmt;

            if (type !== T_EXPR) {
                if (type === 'SubExpression') {
                    hasSubExpression = true;
                    // When SubExpressions are processed, the resulting
                    // method is placed on the ast, and later prune automatically
                    // Since, this subexpression is being used by this logic gate,
                    // we do not want to prune this, but rather leave it on the ast
                    // for use on runtime
                    stmt.prune = false;
                }
                return stmt;
            }

            participants.push(condition);

            const data = {
                index: table.length,
                condition,
            }

            table.push(data);

            data.left = accept(left);
            data.right = accept(right);

            return data.index;
        }

        accept(stmt.path);

        stmt.logicGate = {
            participants,
            table,
        };

        if (hasSubExpression) {
            stmt.logicGate.hasSubExpression = true;
        }
    }

    addLogicGatesAndHelper() {
        const {
            ternaryHelperName,
            createPathExpression,
            visitNodes
        } = this.Preprocessor;

        const { T_EXPR, addLogicGate } = TernaryTransformer;
        const _this = this;

        const { Visitor } = handlebars;

        function ASTParser() {
        }
        ASTParser.prototype = new Visitor();

        ASTParser.prototype.TernaryExpression = function (stmt) {

            this.acceptKey(stmt, 'condition');
            this.acceptKey(stmt, 'left');
            this.acceptKey(stmt, 'right');

            this.mutating = true;
            return {
                type: 'SubExpression',
                path: createPathExpression({ original: ternaryHelperName }),
                params: [
                    stmt.condition,
                    stmt.left,
                    stmt.right,
                ],
            }
        }

        ASTParser.prototype.MustacheStatement = function (stmt) {

            if (stmt.path.type === T_EXPR) {
                addLogicGate({ stmt });
            };

            Visitor.prototype.MustacheStatement.call(this, stmt);
            this.mutating = true;

            if (stmt.path.type === 'SubExpression') {
                const { path, params } = stmt.path;
                assert(path.original === ternaryHelperName);

                return {
                    ...stmt,
                    path,
                    params,
                };
            }
            return stmt;
        }

        ASTParser.prototype.SubExpression = function (stmt) {
            Visitor.prototype.SubExpression.call(this, stmt);
            this.mutating = true;
            return stmt;
        }

        ASTParser.prototype.BlockStatement = function (stmt) {
            Visitor.prototype.BlockStatement.call(this, stmt);
            this.mutating = true;
            return stmt;
        }

        const parser = new ASTParser();
        parser.accept(this.preprocessor.ast);
    }

}

module.exports = TernaryTransformer;