
const handlebars = require('handlebars');
const parser = require('@handlebars/parser');
const assert = require('assert');
const utils = require('./utils');
const importFresh = require('import-fresh');

class LogicalExprTransformer {

    static T_EXPR = 'TernaryExpression';
    static P_EXPR = 'PathExpression';
    static S_EXPR = 'SubExpression';
    static B_EXPR = 'BooleanExpression';
    static MUST_GRP = 'MustacheGroup';

    static mustacheStart = '${';
    static mustacheEnd = '}';

    static OR = 'OR';
    static AND = 'AND';
    static NOT = 'NOT';

    static LT = 'LT';
    static LTE = 'LTE';
    static GT = 'GT';
    static GTE = 'GTE';
    static INCLUDES = 'INCLUDES';
    static EQ = 'EQ';
    static NEQ = 'NEQ';

    constructor({ Preprocessor, preprocessor }) {
        this.Preprocessor = Preprocessor;
        this.preprocessor = preprocessor;
    }

    transform() {

        this.parseMustacheGroups();

        this.explodeOperators();

        this.implyTernary();

        this.parse();

        this.addLogicGatesAndHelper();
    }

    static isMustacheGroup({ original }) {
        const { mustacheStart } = LogicalExprTransformer;
        return original.includes(mustacheStart);
    }

    static getMustacheGroup({ original, loc }) {

        const {
            mustacheStart, mustacheEnd, MUST_GRP,
        } = LogicalExprTransformer;

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
                    expr.items.push({
                        ...parser.parse(`{{${segment}}}`).body[0],
                        loc,
                    });
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
                    assert(segment.startsWith(mustacheStart));
                    segment += mustacheEnd;
                    addSegment();
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

    parseMustacheGroups() {
        const {
            MUST_GRP, isMustacheGroup,
            getMustacheGroup, getVisitor
        } = LogicalExprTransformer;

        const Visitor = getVisitor([MUST_GRP]);

        function ASTParser() {
        }
        ASTParser.prototype = new Visitor();

        ASTParser.prototype.StringLiteral = function (stmt) {

            if (isMustacheGroup(stmt)) {
                const expr = getMustacheGroup(stmt);

                stmt.type = expr.type;
                stmt.items = expr.items;

                this.mutating = true;

                return stmt;
            }
        }

        const parser = new ASTParser();
        parser.accept(this.preprocessor.ast);
    }

    explodeOperators() {
        const { visitNodes, createPathExpression } = this.Preprocessor;
        const { ast } = this.preprocessor;
        const {
            MUST_GRP, getVisitor
        } = LogicalExprTransformer;

        const Visitor = getVisitor([MUST_GRP]);

        visitNodes({
            types: ['SubExpression', 'MustacheStatement'],
            ast,
            Visitor,
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

    getExpression({ stmt, root = false }) {

        const {
            T_EXPR, P_EXPR, S_EXPR, B_EXPR, MUST_GRP,
            OR, AND, NOT, LT, LTE, GT, GTE, EQ, NEQ, INCLUDES,
        } = LogicalExprTransformer;

        const { getLine } = this.Preprocessor;

        const unionOperators = [OR, AND];
        const booleanOperators = [LT, LTE, GT, GTE, EQ, NEQ, INCLUDES];
        const operators = [NOT, ...unionOperators, ...booleanOperators];

        let { type, path, params, hash } = stmt;

        if (type === P_EXPR || type === T_EXPR ||
            type.endsWith('Literal')) {
            return stmt;
        }

        if (type == MUST_GRP) {
            stmt.items = stmt.items.map(item => {

                switch (item.type) {
                    case 'StringLiteral':
                        return item;

                    case 'MustacheStatement':
                        const expr = this.getExpression({ stmt: item, root: true })
                        return expr.type === T_EXPR ? {
                            ...item,
                            type: 'MustacheStatement',
                            path: expr,
                            params: [],
                        } : expr;
                }

            });
            return stmt;
        }

        assert(type === S_EXPR || type === 'MustacheStatement');

        const IsOperator = (stmt) => stmt.type == P_EXPR &&
            operators.includes((stmt.original || '').toUpperCase())

        const IsBooleanOperator = (stmt) => stmt.type == P_EXPR &&
            booleanOperators.includes((stmt.original || '').toUpperCase())

        const assertNotOperator = (stmt) => {
            if (IsOperator(stmt)) {
                throw new Error(`Illegal ${stmt.original}, ${getLine(stmt)}`);
            }
            return true;
        }

        const parseInversions = () => {

            if ([NOT, NOT.toLowerCase()].includes(path.original)) {

                const expr = params.shift();
                assert(!!expr && assertNotOperator(expr));

                path = stmt.path = expr;
                stmt.path.invert = 1
            }
            for (let i = 0; i < params.length; i++) {
                const param = params[i];

                if ([NOT, NOT.toLowerCase()].includes(param.original)) {
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

                if (!params.length && path.type == S_EXPR) {

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
                    if (type === P_EXPR && original == '?') {
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
                                            type: S_EXPR,
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
                            type: S_EXPR,
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
                    .forEach(param => {
                        if (param.original === '?' || param.original == ':') {
                            throw new Error(`The ternary operator stack is imbalanced ${getLine(param)}`);
                        }
                        return param;
                    });
            }
        }

        const transformHash = () => {
            if (hash) {
                assert(type !== T_EXPR, `Unxpected hash pairs, ${getLine(stmt)}`);

                hash.pairs = hash.pairs.map(pair => ({
                    ...pair,
                    value: this.getExpression({ stmt: pair.value })
                }), this);

                expr.hash = hash;
            }
        }

        const parseBooleanExpressions = () => {

            if (expr.type == T_EXPR) {

                expr.condition = expr.condition
                    .map(stmt => {

                        const { type, path, params, isCondition, invert, loc } = stmt;

                        if (type == S_EXPR && IsBooleanOperator(params[0])) {

                            const line = getLine({ loc });

                            assert(params.length == 2, `Incorrect number of params, ${line}`);

                            assertNotOperator(path);
                            assertNotOperator(params[1]);

                            assert(isCondition, `${B_EXPR}s must also be conditional expressions, ${line}`);

                            const left = path;
                            const [operator, right] = params;

                            return {
                                type: B_EXPR,
                                operator: operator.original.toUpperCase(),
                                left: this.getExpression({ stmt: left }),
                                right: this.getExpression({ stmt: right }),
                                isCondition,
                                invert
                            };
                        }

                        return stmt;
                    });
            }
        }

        const checkOrphanedOperators = (stmt) => {

            if (stmt.type.endsWith('Literal')) {
                return stmt;
            }

            const validate = expr => {

                switch (expr.type) {

                    case P_EXPR:
                        assertNotOperator(expr);

                    case S_EXPR:
                    case T_EXPR:
                        if (expr.invert && !expr.isCondition) {
                            throw Error(`Illegal NOT, ${getLine(expr)}`);
                        }

                    default:
                        break;
                }

                return expr;
            }

            switch (stmt.type) {

                case T_EXPR:
                    [...stmt.condition, stmt.left, stmt.right]
                        .map(checkOrphanedOperators)
                        .forEach(validate)

                    break;

                case B_EXPR:
                    [stmt.left, stmt.right]
                        .map(checkOrphanedOperators)
                        .forEach(validate)
                    break;

                case S_EXPR:
                    [stmt.path, ...stmt.params]
                        .map(checkOrphanedOperators)
                        .forEach(validate)
                    break;

                case P_EXPR:
                    validate(stmt);
                    break;
            }

            return stmt;
        }

        checkTernaryBalance();

        transformHash();

        parseBooleanExpressions();

        if (root) {
            checkOrphanedOperators(expr);
        }

        return expr;
    }

    implyTernary() {

        const {
            MUST_GRP, getVisitor
        } = LogicalExprTransformer;

        const Visitor = getVisitor([MUST_GRP]);

        const {
            AND, OR, NOT, LT, LTE, GT, GTE, EQ, NEQ, INCLUDES,
            S_EXPR
        } = LogicalExprTransformer;

        const unionOperators = [OR, AND];
        const booleanOperators = [LT, LTE, GT, GTE, EQ, NEQ, INCLUDES];

        const {
            visitNodes, createPathExpression, createLiteral, getConditionalHelpers,
            getLine,
        } = this.Preprocessor;

        visitNodes({
            types: [
                S_EXPR, 'MustacheStatement', 'BlockStatement'
            ],
            ast: this.preprocessor.ast,
            Visitor,
            consumer: ({ stmt }) => {

                const transform = (stmt) => {

                    // If this looks like a compound boolean expression, we
                    // automatically append ? true : false, so that it can be
                    // processed as a logic gate.

                    let { type, path, params, loc, generated } = stmt;

                    assert(type == 'SubExpression' || type == 'MustacheStatement');

                    const hasNot = (path.original || '').toUpperCase() == NOT;

                    const hasUnion = (params.length &&
                        [...unionOperators]
                            .includes((params[0].original || '').toUpperCase())
                    );
                    const hasBool = (params.length &&
                        [...booleanOperators]
                            .includes((params[0].original || '').toUpperCase())
                    );
                    const hasTernary = params.filter(({ original }) => original == '?').length;

                    if (
                        (hasNot || hasUnion || hasBool) &&
                        !hasTernary &&
                        !generated
                    ) {

                        if (hasNot) {
                            assert(
                                params.length == 1,
                                `Unknown expression, ${getLine(stmt)}`
                            );
                        }

                        if (hasUnion || hasBool) {
                            assert(
                                params.length == 2,
                                `Unknown expression, ${getLine(stmt)}`
                            );
                        }

                        if (hasBool) {

                            // Wrap stmt as a subexpression, before appending
                            // ? true : false to the param list.
                            stmt.type = type;
                            stmt.path = {
                                type: S_EXPR,
                                path,
                                params,
                                loc,
                                generated: true,
                            };
                            params = stmt.params = [];
                        }

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

                    if (stmt.params.length > 1) {
                        const { params, loc } = stmt;
                        const path = params.shift();

                        stmt.params = [{
                            type: S_EXPR,
                            path,
                            params,
                            loc,
                        }];
                    }

                    // Note: For #with and #each, we expect an object or array, so
                    // we cannot implicitly transform a param that looks like
                    // a conditional to a ternary expression

                    if (
                        getConditionalHelpers()
                            .includes(stmt.path.original) &&
                        stmt.params[0].type == 'SubExpression'
                    ) {
                        stmt.params[0] = transform(stmt.params[0]);
                    } else {
                        return stmt;
                    }
                } else {
                    transform(stmt);
                }
            }
        });
    }

    parse() {

        const { T_EXPR, getVisitor } = LogicalExprTransformer;

        const _this = this;

        const Visitor = getVisitor([T_EXPR]);
        function ASTParser() {
        }
        ASTParser.prototype = new Visitor();

        ASTParser.prototype.MustacheStatement = function (stmt) {
            this.mutating = true;

            const expr = _this.getExpression({ stmt, root: true });

            return expr.type === T_EXPR ? {
                ...stmt,
                type: 'MustacheStatement',
                path: expr,
                params: [],
            } : expr;
        }

        ASTParser.prototype.BlockStatement = function (stmt) {

            this.mutating = true;

            Visitor.prototype.Program.call(this, stmt.program);

            if (stmt.inverse) {
                Visitor.prototype.Program.call(this, stmt.inverse);
            }

            const expr = _this.getExpression({
                stmt: {
                    type: 'SubExpression',
                    path: stmt.path,
                    params: stmt.params,
                }, root: true
            });

            stmt.params = expr.params;

            return stmt;
        }

        ASTParser.prototype.SubExpression = function (stmt) {
            this.mutating = true;
            return _this.getExpression({ stmt, root: true });
        }

        const parser = new ASTParser();
        parser.accept(this.preprocessor.ast);
    }

    addLogicGate({ stmt }) {
        const { T_EXPR, B_EXPR, getVisitor } = LogicalExprTransformer;
        const { visitNodes } = this.Preprocessor;

        const participants = [];
        const table = [];

        const excludeSubExpressionsFromPrune = () => {

            const _this = this;

            visitNodes({
                Visitor: getVisitor(),
                types: [T_EXPR, B_EXPR],
                ast: {
                    type: 'Program',
                    body: [stmt],
                },
                consumer: ({ stmt }) => {

                    const { condition, left, right } = stmt;

                    [...(condition || []), left, right]
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
                    .forEach(stmt => {
                        if (stmt.type == B_EXPR) {
                            if (isDataPath(stmt.left)) {
                                participants.push(stmt.left)
                            }
                            if (isDataPath(stmt.right)) {
                                participants.push(stmt.right)
                            }
                        } else if (isDataPath(stmt)) {
                            participants.push(stmt)
                        }
                    });

                const hasSubExpression = !![...condition]
                    .filter(({ type }) => !type.endsWith('Literal'))
                    .filter(({ type, original, left, right }) => {

                        const fn = (type, original) =>
                            type === 'SubExpression' ||
                            type === T_EXPR ||
                            !isDataPath({ type, original });

                        if (type == B_EXPR) {
                            return fn(left.type, left.original) ||
                                fn(right.type, right.original)
                        } else {
                            return fn(type, original);
                        }

                    }).length;

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

            data.condition = condition.map((c) => {
                if (c.type == B_EXPR) {
                    return {
                        type: c.type,
                        operator: c.operator,
                        left: accept(c.left),
                        right: accept(c.right),
                    };
                } else {
                    return accept(c);
                }
            });
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
            logicalHelperName,
            concatenateHelperName,
            createPathExpression,
            getLine,
            createStringLiteral,
            getDefaultLoc,
            getConditionalHelpers,
        } = this.Preprocessor;
        const {
            methodNames,
        } = this.preprocessor;

        const { T_EXPR, S_EXPR, MUST_GRP, getVisitor } = LogicalExprTransformer;
        const _this = this;

        const Visitor = getVisitor([MUST_GRP]);

        function ASTParser() {
        }
        ASTParser.prototype = new Visitor();

        ASTParser.prototype.BooleanExpression = function (stmt) {

            this.acceptKey(stmt, 'left');
            this.acceptKey(stmt, 'right');

            this.mutating = true;
            return {
                type: 'SubExpression',
                path: createPathExpression({ original: logicalHelperName }),
                params: [
                    stmt.left,
                    stmt.right,
                    createStringLiteral(stmt.operator),
                ],
                loc: getDefaultLoc()
            };
        }

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

        ASTParser.prototype.MustacheGroup = function (stmt) {

            const { items, loc } = stmt;

            this.acceptArray(items);

            stmt.items = stmt.items.map(item => {

                switch (item.type) {
                    case 'StringLiteral':
                        return item;

                    case 'MustacheStatement':

                        // Skip logic gate processing, since it will be transformed 
                        // to a sub expression 
                        stmt.subExpression = true

                        item = ASTParser.prototype.MustacheStatement.call(
                            this, item
                        )

                        if (item.params.length ||
                            item.path.type === 'PathExpression' && methodNames.includes(item.path.original)
                        ) {
                            item.prune = false;
                            item.type = S_EXPR

                            return item
                        } else {
                            return item.path;
                        }
                }
            });

            this.mutating = true;
            return {
                type: 'SubExpression',
                path: createPathExpression({ original: concatenateHelperName }),
                params: [...stmt.items],
                loc,
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

                    throw Error(`A ${S_EXPR} cannot contain a ${S_EXPR} as it's path, ${getLine(stmt.path)}`);
                }
            }
            return stmt;
        }

        ASTParser.prototype.MustacheStatement = function (stmt) {

            if (stmt.path.type === T_EXPR && !stmt.subExpression) {
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

            const conditional = getConditionalHelpers().includes(stmt.path.original);

            if (conditional && stmt.params[0].type === T_EXPR) {
                _this.addLogicGate({ stmt });
            }

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

    static getVisitor(types = [
        LogicalExprTransformer.B_EXPR,
        LogicalExprTransformer.T_EXPR,
        LogicalExprTransformer.MUST_GRP
    ]) {

        const { B_EXPR, T_EXPR, MUST_GRP } = LogicalExprTransformer;

        // We want to keep the shared handlebars object clean
        const handlebars = importFresh('handlebars');

        const ASTParser = handlebars.Visitor;

        if (types.includes(B_EXPR)) {
            ASTParser.prototype[B_EXPR] = function (stmt) {
                this.acceptKey(stmt, 'left');
                this.acceptKey(stmt, 'right');
            }
        }

        if (types.includes(T_EXPR)) {
            ASTParser.prototype[T_EXPR] = function (stmt) {
                this.acceptArray(stmt.condition);
                this.acceptKey(stmt, 'left');
                this.acceptKey(stmt, 'right');
            }
        }

        if (types.includes(MUST_GRP)) {
            ASTParser.prototype[MUST_GRP] = function (stmt) {
                this.acceptArray(stmt.items);
            }
        }

        return ASTParser;
    }

}

module.exports = LogicalExprTransformer;