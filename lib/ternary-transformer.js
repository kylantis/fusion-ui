
const handlebars = require('handlebars');
const assert = require('assert');
const utils = require('./utils');

class TernaryTransformer {

    static T_EXPR = 'TernaryExpression';

    static OR = 'OR';
    static AND = 'AND';
    static NOT = 'NOT';

    constructor({ Preprocessor, preprocessor }) {
        this.Preprocessor = Preprocessor;
        this.preprocessor = preprocessor;
    }

    transform() {

        this.explodeOperators();

        this.implyTernary();

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

        const { T_EXPR, OR, AND, NOT } = TernaryTransformer;
        const { getLine } = this.Preprocessor;
        const { methodNames } = this.preprocessor;

        const operators = [OR, AND, NOT];

        let { type, path, params, hash } = stmt;

        if (type === 'PathExpression' || type === 'TernaryExpression' ||
            type.endsWith('Literal')) {
            return stmt;
        }

        assert(type === 'SubExpression' || type === 'MustacheStatement');

        const IsOperator = (stmt) => operators.includes((stmt.original || '').toUpperCase())

        const assertNotOperator = (stmt) => {
            if (IsOperator(stmt)) {
                throw new Error(`Illegal ${stmt.original}, ${getLine(stmt)}`);
            }
            return true;
        }

        const parseInversions = () => {

            if (path.original == NOT) {

                const expr = params.shift();
                assert(!!expr && assertNotOperator(expr));

                path = stmt.path = expr;
                stmt.path.invert = 1
            }
            for (let i = 0; i < params.length; i++) {
                const param = params[i];

                if (param.original == NOT) {
                    assert(i < params.length - 1 && assertNotOperator(params[i + 1]));

                    params[i + 1].invert = 1;
                    params[i] = null;
                }
            }
            params = stmt.params = stmt.params
                .filter(param => param != null);
        }

        const getExpression = (stmt) => {
            let { type, path, params, invert = 0 } = stmt;

            let expr;

            if ((params[0] || {}).original === '?') {
                expr = {
                    type: T_EXPR,
                }
            } else {

                if (!params.length && path.type == 'SubExpression') {

                    expr = this.getExpression({ stmt: path });
                    expr.wrap = true;

                } else {
                    expr = {
                        ...stmt,
                        params: [],
                    }
                }
            }

            expr.invert = invert +
                (expr.invert != undefined ? expr.invert : 0);
            return expr;
        }

        // parse occurences of NOT
        parseInversions();

        // index of '?'
        let leftStart;

        // (index of '?') - 1
        let leftStartOffset = 1;

        // no-op array for keeping track of inner ternary expressions
        const noOpStack = [];

        // index of ':'
        let rightStart;

        let expr = getExpression(stmt);

        if (expr.wrap) {
            return expr;
        }

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
                                .map(stmt => {
                                    // Todo: Verify if I even need to call getExpression(...) again
                                    // since I already called it at the beginning of the loop
                                    const expr = this.getExpression({ stmt })
                                    if (!IsOperator(expr)) {
                                        expr.isCondition = true;
                                    }
                                    return expr;
                                });

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

        const checkTernaryBalance = () => {
            if (expr.params) {
                expr.params = expr.params.filter(p => p != null);

                [expr.path, ...expr.params]
                    .filter(({ type }) => !type.endsWith('Literal'))
                    .map(param => {
                        if (param.original === '?' || param.original == ':') {
                            throw new Error(`The ternary operator stack is imbalanced ${getLine(param)}`);
                        }
                        return param;
                    }).forEach(assertNotOperator);
            }
        }

        const checkUnnecessaryHash = () => {
            if (hash) {
                assert(type !== T_EXPR, `Unxpected hash pairs, ${getLine(stmt)}`);

                hash.pairs = hash.pairs.map(pair => ({
                    ...pair,
                    value: this.getExpression({ stmt: pair.value })
                }), this);

                expr.hash = hash;
            }
        }

        const checkInvalidNot = (stmt) => {

            if (stmt.type === 'PathExpression' || stmt.type.endsWith('Literal')) {
                return stmt;
            }

            const validate = expr => {
                if (expr.invert && !expr.isCondition) {
                    throw Error(`Illegal NOT, ${getLine(expr)}`);
                }
                return expr;
            }

            if (stmt.type == T_EXPR) {
                [...stmt.condition, stmt.left, stmt.right,]
                    .map(validate)
                    .map(checkInvalidNot);
            } else {
                [stmt.path, ...stmt.params].map(validate)
                    .map(checkInvalidNot);
            }

            return stmt;
        }

        checkTernaryBalance();

        checkUnnecessaryHash();

        checkInvalidNot(expr);

        return expr;
    }

    implyTernary() {

        const { AND, OR, NOT } = TernaryTransformer;

        const {
            visitNodes, createPathExpression, createLiteral
        } = this.Preprocessor;

        visitNodes({
            types: [
                'SubExpression', 'MustacheStatement', 'BlockStatement'
            ],
            ast: this.preprocessor.ast,
            consumer: ({ stmt }) => {

                const transform = (stmt) => {

                    // If this looks like a compound boolean expression, we
                    // automatically append ? true : false, so that it can be
                    // processed as a logic gate.

                    const { type, path, params, loc } = stmt;

                    assert(type == 'SubExpression' || type == 'MustacheStatement');

                    const ternary = path.original == NOT ||
                        (params.length && [AND, OR, '?'].includes((params[0].original || '').toUpperCase()))

                    if (
                        ternary &&
                        !params.filter(({ original }) => original == '?').length
                    ) {

                        params.push({
                            ...createPathExpression({ original: '?' }),
                            loc
                        });
                        params.push({
                            ...createLiteral({
                                type: 'BooleanLiteral',
                                original: true
                            }),
                            loc
                        });
                        params.push({
                            ...createPathExpression({ original: ':' }),
                            loc
                        });
                        params.push({
                            ...createLiteral({
                                type: 'BooleanLiteral',
                                original: false
                            }),
                            loc
                        });
                    }

                    return stmt;
                }

                if (stmt.type == 'BlockStatement') {

                    // For #with and #each, we expect an object or array, so
                    // we cannot implicitly transform a param that looks like
                    // a conditional to a ternary expression

                    if (['if', 'unless'].includes(stmt.path.original)
                        && stmt.params[0].type == 'SubExpression') {
                        stmt.params[0] = transform(stmt.params[0]);
                    } else {
                        return;
                    }
                } else {
                    transform(stmt);
                }
            }
        });
    }

    parse() {

        const { T_EXPR } = TernaryTransformer;

        const _this = this;

        const { Visitor } = handlebars;
        function ASTParser() {
        }
        ASTParser.prototype = new Visitor();

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

        ASTParser.prototype.BlockStatement = function (stmt) {

            this.mutating = true;

            Visitor.prototype.Program.call(this, stmt.program);

            const expr = _this.getExpression({
                stmt: {
                    type: 'SubExpression',
                    path: stmt.path,
                    params: stmt.params,
                }
            });

            stmt.params = expr.params;

            return stmt;
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
                            (type === 'PathExpression' && _this.preprocessor.methodNames.includes(original))
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
            data.invert = condition.map(c => !!c.invert)

            return data.index;
        }

        // In TemplatePreprocessor, when SubExpressions are processed, 
        // the resulting method is placed on the ast, and later prune automatically
        // Since, this subexpressions are being used by this logic gate,
        // we do not want to prune this, but rather leave it on the ast
        // for use on runtime
        excludeSubExpressionsFromPrune();

        const mustache = stmt.type == 'MustacheStatement';

        assert(mustache || stmt.type == 'BlockStatement');

        // <target> is the source of the TernaryExpression node
        const target = mustache ? stmt.path : stmt.params[0];

        target.ternaryPath = true;

        stmt.logicGate = {
            participants,
            table,
        };

        // Later on, if this is in the root context, we may need to clean up
        // the "ternary" synthetic method from the ast. Hence, we 'll add
        // a suffix to the method name, and then later also use it to find
        // and prune them

        stmt.logicGatePruneKey = `_${utils.generateRandomString()}`;

        (mustache ? stmt : stmt.params[0]).prune = true;
        (mustache ? stmt : stmt.params[0]).methodNameSuffix = stmt.logicGatePruneKey;

        accept(target);
    }

    addLogicGatesAndHelper() {
        const {
            ternaryHelperName,
            createPathExpression,
            getLine,
            createStringLiteral,
            getDefaultLoc,
        } = this.Preprocessor;

        const { T_EXPR } = TernaryTransformer;
        const _this = this;

        const { Visitor } = handlebars;

        function ASTParser() {
        }
        ASTParser.prototype = new Visitor();

        ASTParser.prototype.TernaryExpression = function (stmt) {

            this.acceptArray(stmt.condition);
            this.acceptKey(stmt, 'left');
            this.acceptKey(stmt, 'right');

            this.mutating = true;
            return {
                type: 'SubExpression',
                path: createPathExpression({ original: ternaryHelperName }),
                params: [
                    ...stmt.condition,
                    stmt.left,
                    stmt.right,
                    createStringLiteral(
                        JSON.stringify(
                            stmt.condition.map(c => !!c.invert)
                        )
                    ),
                ],
                loc: getDefaultLoc()
            };
        }

        const implodeTernaryExpression = (stmt) => {

            assert(['SubExpression', 'MustacheStatement'].includes(stmt.type));

            if (stmt.path.type === 'SubExpression') {

                const { path, params } = stmt.path;

                if (path.original === ternaryHelperName) {
                    assert(stmt.type == 'MustacheStatement');
                    return {
                        ...stmt,
                        path,
                        params,
                    };
                } else {

                    // A SubExpression was used as the path, outside of a ternary expression
                    // For example:
                    // {{(myMethod x y z)}} - WRONG
                    // {{(myMethod x y z) AND B ? C : D}} CORRECT

                    throw Error(`Outside of a ${T_EXPR}, a MustacheStatment cannot contain a SubExpression as it's path, ${getLine(stmt.path)}`);
                }
            }
            return stmt;
        }
        ASTParser.prototype.MustacheStatement = function (stmt) {

            if (stmt.path.type === T_EXPR) {
                _this.addLogicGate({ stmt });
            };

            Visitor.prototype.MustacheStatement.call(this, stmt);
            this.mutating = true;

            return implodeTernaryExpression(stmt);
        }

        ASTParser.prototype.SubExpression = function (stmt) {

            Visitor.prototype.SubExpression.call(this, stmt);
            this.mutating = true;

            return implodeTernaryExpression(stmt);
        }

        ASTParser.prototype.BlockStatement = function (stmt) {

            const conditional = ['if', 'unless'].includes(stmt.path.original);

            // Non-conditional blocks cannot contain logic gates because
            // 1. #with and #each are context switching in nature
            // 2. Custom blocks are typically rendered once

            if (conditional && stmt.params[0].type === T_EXPR) {
                _this.addLogicGate({ stmt });
            };

            const { prune, methodNameSuffix } = stmt.params[0] || {};

            Visitor.prototype.BlockStatement.call(this, stmt);

            if (stmt.logicGate) {

                // ASTParser.prototype.TernaryExpression transformed the 
                // TernaryExpression into a SubExpression without including
                // additional metadata added by addLogicGate(...) above

                stmt.params[0].prune = prune;
                stmt.params[0].methodNameSuffix = methodNameSuffix;
            }

            this.mutating = true;

            return stmt;
        }

        const parser = new ASTParser();
        parser.accept(this.preprocessor.ast);
    }

}

module.exports = TernaryTransformer;