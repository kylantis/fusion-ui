
const handlebars = require('handlebars');
const assert = require('assert');
const utils = require('./utils');

class TernaryTransformer {

    static T_EXPR = 'TernaryExpression';
    static OR = 'OR';
    static AND = 'AND';

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

        const { T_EXPR, OR, AND } = TernaryTransformer;
        const { getLine } = this.Preprocessor;
        const { methodNames } = this.preprocessor;

        const { type, path, params, hash } = stmt;

        if (type === 'PathExpression' || type === 'TernaryExpression' ||
            type.endsWith('Literal') || !params.length) {
            return stmt;
        }

        assert(type === 'SubExpression' || type === 'MustacheStatement');

        // index of '?'
        let leftStart;

        // (index of '?') - 1
        let leftStartOffset = 1;

        // no-op array for keeping track of inner ternary expressions
        const noOpStack = [];

        // index of ':'
        let rightStart;

        let expr = params[0].original === '?' ? {
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
                        const condition = [];

                        // assert not and/or
                        const assertNotAndOr = (path) => {
                            assert(
                                ![OR, AND].includes((path.original || '').toUpperCase()),
                                `Illegal [OR, AND] ${path}`
                            );
                        }

                        assertNotAndOr(path);

                        if (expr.params) {
                            let j = i - 1;

                            // operand
                            condition.push(expr.params[j]);

                            while (j - 1 >= 0 && [OR, AND].includes((expr.params[j - 1].original || '').toUpperCase())) {

                                assertNotAndOr(expr.params[j]);

                                // (and | or) operator
                                condition.unshift(
                                    this.Preprocessor.createStringLiteral(
                                        expr.params[j - 1].original.toUpperCase()
                                    )
                                );

                                // operand
                                if (j - 1 == 0) {
                                    condition.unshift(stmt.path);

                                    expr = {
                                        type: T_EXPR,
                                    };

                                    break;

                                } else {
                                    condition.unshift(expr.params[j - 2]);

                                    leftStartOffset += 2;
                                }

                                j -= 2;
                            }

                        } else {
                            condition.push(path);
                        }

                        expr.condition =
                            condition
                                .map(c => this.getExpression({ stmt: c }));

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

                        const start = leftStart - leftStartOffset;

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
                        leftStartOffset = 1;
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

            expr.params
                .filter(({ type }) => !type.endsWith('Literal'))
                .map(param => {
                    if (param.original === '?' || param.original == ':') {
                        throw new Error(`The ternary operator stack is imbalanced, ${getLine(param)}`);
                    }
                    return param;
                }).forEach(param => {
                    if ([OR, AND].includes((param.original || '').toUpperCase())) {
                        throw new Error(`Illegal AND/OR, ${getLine(param)}`);
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

    addLogicGate({ stmt }) {
        const { T_EXPR } = TernaryTransformer;
        const { visitNodes } = this.Preprocessor;

        const participants = [];
        const table = [];

        const excludeSubExpressionsFromPrune = () => {

            const { Visitor } = handlebars;
            const _this = this;

            Visitor.prototype.TernaryExpression = function (stmt) {
                this.acceptArray(stmt.condition);
                this.acceptKey(stmt, 'left');
                this.acceptKey(stmt, 'right');
            }

            visitNodes({
                Visitor,
                types: ['TernaryExpression'],
                ast: {
                    type: 'Program',
                    body: [stmt],
                },
                consumer: ({ stmt }) => {

                    const { condition, left, right } = stmt;

                    [...condition, left, right]
                        .filter(({ type, original }) =>
                            type === 'SubExpression' ||
                            (type === 'PathExpression' &&_this.preprocessor.methodNames.includes(original))
                        )
                        .forEach(stmt => stmt.prune = false);
                }
            });
        }

        const accept = (stmt) => {

            const { type, condition, left, right } = stmt;

            // Todo: Do we may also need to add "data path" params found in sub expression
            // as participants?

            if (type !== T_EXPR) {
                return stmt;
            }

            const isDataPath = ({ type, original }) => type === 'PathExpression' &&
                !this.preprocessor.methodNames.includes(original);

            if (stmt.ternaryPath) {

                // Add participants for this logic gate

                // Todo: Do we also need to add participants, even if this does
                // not follow the ternary path

                [...condition]
                    .filter(isDataPath)
                    .forEach(stmt => participants.push(stmt))

                const hasSubExpression = !![...condition]
                    .filter(({ type }) => !type.endsWith('Literal'))
                    .filter(({ type, original }) =>
                        type === 'SubExpression' ||
                        type === T_EXPR ||
                        !isDataPath({ type, original })
                    ).length;

                if (!hasSubExpression) {
                    [left, right]
                        .filter(({ type }) => type == T_EXPR)
                        .forEach(s => s.ternaryPath = true);
                }
            }

            const data = {
                index: table.length,
            }

            table.push(data);

            data.condition = condition.map(accept);
            data.left = accept(left);
            data.right = accept(right);

            return data.index;
        }

        // In TemplatePreprocessor, when SubExpressions are processed, 
        // the resulting method is placed on the ast, and later prune automatically
        // Since, this subexpressions are being used by this logic gate,
        // we do not want to prune this, but rather leave it on the ast
        // for use on runtime
        excludeSubExpressionsFromPrune();

        stmt.path.ternaryPath = true;

        // Later on, if this is in the root context, we will need to clean up
        // the "ternary" synthetic method from the ast. Hence, we 'll add
        // a suffix to the method name, and then later also use it to find
        // and prune them
        stmt.logicGatePruneKey = `_${utils.generateRandomString()}`;

        stmt.prune = true;
        stmt.methodNameSuffix = stmt.logicGatePruneKey;
     
        accept(stmt.path);

        stmt.logicGate = {
            participants,
            table,
        };
    }

    addLogicGatesAndHelper() {
        const {
            ternaryHelperName,
            createPathExpression,
        } = this.Preprocessor;

        const { T_EXPR } = TernaryTransformer;
        const _this = this;

        const { Visitor } = handlebars;

        function ASTParser() {
        }
        ASTParser.prototype = new Visitor();

        ASTParser.prototype.TernaryExpression = function (stmt) {

            const { condition, left, right } = stmt;

            this.acceptArray(condition);
            this.acceptArray([left]);
            this.acceptArray([right]);

            this.mutating = true;
            return {
                type: 'SubExpression',
                path: createPathExpression({ original: ternaryHelperName }),
                params: [
                    ...condition,
                    left,
                    right,
                ],
            }
        }

        ASTParser.prototype.MustacheStatement = function (stmt) {

            if (stmt.path.type === T_EXPR) {
                _this.addLogicGate({ stmt });
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