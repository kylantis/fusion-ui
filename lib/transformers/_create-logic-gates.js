
const assert = require('assert');
const utils = require('../utils');
const importFresh = require('import-fresh');

class LogicalExprTransformer {

    static T_EXPR = 'TernaryExpression';
    static P_EXPR = 'PathExpression';
    static S_EXPR = 'SubExpression';
    static B_EXPR = 'BooleanExpression';
    static MUST_GRP = 'MustacheGroup';

    static OR = 'OR';
    static AND = 'AND';
    static NOT = 'NOT';

    // This option protects the developer from unknowingly creating a logic gate that is logically-wrong
    static requireParenthesis = false;

    constructor({ preprocessor }) {
        this.preprocessor = preprocessor;
    }

    transform() {

        this.explodeOperators();

        this.implyTernary();

        this.parse();

        this.explodeTernaryEachBlocks();

        this.registerLogicGateParticipants();

        this.addLogicGatesAndHelper();
    }

    explodeOperators() {
        const { visitNodes, createPathExpression } = this.preprocessor.constructor;
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
            T_EXPR, P_EXPR, S_EXPR, B_EXPR, MUST_GRP, OR, AND, NOT,
        } = LogicalExprTransformer;

        const { component, constructor } = this.preprocessor;
        const { getLine, createStringLiteral, stringifyHandlebarsStatement } = constructor;

        const unionOperators = [OR, AND];
        const booleanOperators = Object.keys(component.getBooleanOperators());

        const operators = [NOT, ...unionOperators, ...booleanOperators];

        let { type, path, params, hash } = stmt;

        if (type === P_EXPR || type === T_EXPR || type === MUST_GRP ||
            type.endsWith('Literal')) {
            return stmt;
        }

        assert(type === S_EXPR || type === 'MustacheStatement');

        const IsOperator = (stmt) => stmt.type == P_EXPR &&
            operators.includes((stmt.original || '').toUpperCase())

        const IsBooleanOperator = (stmt) => stmt.type == P_EXPR &&
            booleanOperators.includes((stmt.original || '').toUpperCase())

        const ensureNotOperator = (stmt) => {
            if (IsOperator(stmt)) {
                this.preprocessor.throwError(`Illegal ${stmt.original}`, stmt);
            }
            return true;
        }

        const parseInversions = () => {

            if ([NOT, NOT.toLowerCase()].includes(path.original)) {

                const expr = params.shift();
                assert(!!expr && ensureNotOperator(expr));

                path = stmt.path = expr;
                stmt.path.invert = 1
            }
            for (let i = 0; i < params.length; i++) {
                const param = params[i];

                if ([NOT, NOT.toLowerCase()].includes(param.original)) {
                    assert(i < params.length - 1 && ensureNotOperator(params[i + 1]));

                    params[i + 1].invert = 1;
                    params[i] = null;
                }
            }
            params = stmt.params = stmt.params
                .filter(param => param != null);
        }

        const getExpression = (stmt) => {
            let { type, path, params, invert = 0, loc } = stmt;

            let expr;

            if ((params[0] || {}).original === '?') {
                expr = {
                    type: T_EXPR,
                    loc
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

        if (root) {
            expr.source = stringifyHandlebarsStatement(stmt);
        } else if (stmt.source) {
            expr.source = stmt.source;
        }

        if (expr.wrap) {
            return expr;
        }

        for (let i = 0; i < params.length; i++) {

            if (root) {
                stmt.params[i].source = stringifyHandlebarsStatement(stmt.params[i]);
            }

            const param = this.getExpression({ stmt: stmt.params[i] });

            if (expr.params) {
                expr.params.push(param);
            }

            const { type, original } = param;

            param.isTernary = (rightStart || (leftStart !== undefined)) &&
                (i - (rightStart || leftStart)) % 2 === 0;


            if (param.isTernary && original !== '?' && original !== ':') {
                throw Error(`Expected ternary operator, ${getLine(param)}`);
            }

            switch (true) {

                case leftStart === undefined:
                    if (type === P_EXPR && original == '?') {
                        const condition = [];

                        // assert not and/or
                        const ensureNotAndOr = (path) => {
                            if ([OR, AND].includes((typeof path.original == 'string' ? path.original : '').toUpperCase())) {
                                this.preprocessor.throwError(`Illegal [OR, AND] ${path.original}`, path);
                            }
                        }

                        ensureNotAndOr(path);

                        if (expr.params) {
                            let j = i - 1;

                            // operand
                            condition.push(expr.params[j]);

                            while (j - 1 >= 0 && [OR, AND].includes((expr.params[j - 1].original || '').toUpperCase())) {

                                ensureNotAndOr(expr.params[j]);

                                // (and | or) operator
                                condition.unshift(
                                    createStringLiteral(
                                        expr.params[j - 1].original.toUpperCase()
                                    )
                                );

                                // operand
                                if (j - 1 == 0) {
                                    condition.unshift(stmt.path);

                                    expr = {
                                        type: T_EXPR,
                                        loc: expr.loc
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
                                            params: children.slice(1),
                                            loc: children[0].loc,
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

                    if (noOpStack.length != 0) {
                        this.preprocessor.throwError(`The ternary operator stack is imbalanced`, param);
                    }

                    const children = params.slice(rightStart + 1, i + 1);

                    expr.right = this.getExpression({
                        stmt: children.length === 1 ? children[0] : {
                            type: S_EXPR,
                            path: children[0],
                            params: children.slice(1),
                            loc: children[0].loc,
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
                            throw Error(`Expected end of ternary expression, but found ${params[i + 1].type} ${getLine(params[i + 1])}`);
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
                            throw Error(`The ternary operator stack is imbalanced ${getLine(param)}`);
                        }
                        return param;
                    });
            }
        }

        const transformHash = () => {
            if (hash) {

                if (type == T_EXPR) {
                    this.preprocessor.throwError(`Unxpected hash pairs`, stmt);
                }

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

                        if (type == S_EXPR && params.length && IsBooleanOperator(params[0])) {

                            if (params.length != 2) {
                                this.preprocessor.throwError(`Incorrect number of params`, stmt);
                            }

                            ensureNotOperator(path);
                            ensureNotOperator(params[1]);

                            if (type == T_EXPR) {
                                this.preprocessor.throwError(`Unxpected hash pairs`, stmt);
                            }

                            if (!isCondition) {
                                this.preprocessor.throwError(`${B_EXPR}s must also be conditional expressions`, stmt);
                            }

                            const left = path;
                            const [operator, right] = params;

                            return {
                                type: B_EXPR,
                                operator: operator.original.toUpperCase(),
                                left: this.getExpression({ stmt: left }),
                                right: this.getExpression({ stmt: right }),
                                isCondition,
                                invert,
                                loc
                            };
                        }

                        return stmt;
                    });
            }
        }

        const checkOrphanedOperators = (stmt, parent) => {

            if (!stmt) {
                throw Error(`Statement contains error, ${getLine(parent)}`);
            }

            if (stmt.type.endsWith('Literal')) {
                return stmt;
            }

            const validate = expr => {

                switch (expr.type) {

                    case P_EXPR:
                        ensureNotOperator(expr);

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
                        .map((s) => checkOrphanedOperators(s, stmt))
                        .forEach(validate)

                    break;

                case B_EXPR:
                    [stmt.left, stmt.right]
                        .map((s) => checkOrphanedOperators(s, stmt))
                        .forEach(validate)
                    break;

                case S_EXPR:
                    [stmt.path, ...stmt.params]
                        .map((s) => checkOrphanedOperators(s, stmt))
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
            AND, OR, NOT, S_EXPR, MUST_GRP, getVisitor, requireParenthesis
        } = LogicalExprTransformer;

        const Visitor = getVisitor([MUST_GRP]);

        const { component } = this.preprocessor;

        const unionOperators = [OR, AND];
        const booleanOperators = Object.keys(component.getBooleanOperators());

        const {
            visitNodes, createPathExpression, createLiteral, getConditionalHelpers, getLine,
        } = this.preprocessor.constructor;

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

                    const hasNot = typeof path.original == 'string' && path.original.toUpperCase() == NOT;

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

                        if (requireParenthesis) {
                            if (hasNot) {
                                if (params.length != 1) {
                                    this.preprocessor.throwError(`NOT operator should be enclosed in parenthesis, e.g. (not x)`, stmt);
                                }
                            }
                        }

                        if (hasUnion || hasBool) {
                            if (params.length != 2) {
                                this.preprocessor.throwError(
                                    `Union and boolean operators should be enclosed in parenthesis, e.g. (x eq b) or (x and b)`,
                                    stmt
                                );
                            }
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

                    const conditional = getConditionalHelpers()
                        .includes(stmt.path.original);

                    if (conditional && stmt.params.length > 1) {
                        const { params, loc } = stmt;
                        const path = params.shift();

                        stmt.params = [{
                            type: S_EXPR,
                            path,
                            params,
                            loc,
                        }];
                    } else {

                        // Note: For #with and #each, we expect an object or array, so
                        // we cannot implicitly transform a param that looks like
                        // a conditional to a ternary expression

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
                },
                root: true
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

    registerLogicGateParticipants() {

        const { T_EXPR, B_EXPR, P_EXPR, S_EXPR, getVisitor } = LogicalExprTransformer;
        const {
            visitNodes, addParticipantType, PARTICIPANT_TYPE_ALL, PARTICIPANT_TYPE_CONDITIONAL,
            PARTICIPANT_TYPE_TERNARY, DOM_PARTICIPANT_TYPE
        } = this.preprocessor.constructor;

        const registerLogicGateParticipants0 = (stmt, consumer) => {

            const conditionalKey = 'logicGateCondition';
            const ternaryKey = 'logicGateTernary';

            assert(stmt.type == T_EXPR);

            const prune = (stmt) => {
                delete stmt[conditionalKey];
                delete stmt[ternaryKey];
            }

            const addConditional = (...statements) => {
                statements
                    .filter(({ type }) => [T_EXPR, B_EXPR, P_EXPR].includes(type))
                    .forEach((stmt) => {
                        stmt[conditionalKey] = true;
                    });
            }

            const addTernary = (...statements) => {
                statements
                    .filter(({ type }) => [T_EXPR, P_EXPR].includes(type))
                    .forEach((stmt) => {
                        stmt[ternaryKey] = true;
                    });
            }

            stmt[conditionalKey] = true;
            stmt[ternaryKey] = true;

            visitNodes({
                Visitor: getVisitor(),
                types: [P_EXPR, B_EXPR, T_EXPR],
                ast: {
                    type: 'Program',
                    body: [stmt],
                },
                consumer: ({ stmt }) => {
                    switch (stmt.type) {
                        case B_EXPR:
                            if (stmt[conditionalKey]) {
                                addConditional(stmt.left, stmt.right);
                            }
                            break;
                        case T_EXPR:
                            if (stmt[ternaryKey]) {
                                addTernary(...stmt.condition, stmt.left, stmt.right)
                            }
                            if (stmt[conditionalKey]) {
                                addConditional(...stmt.condition);

                                [stmt.left, stmt.right]
                                    .filter(({ type }) => type == T_EXPR)
                                    .forEach(addConditional)
                            }
                            break;
                        case P_EXPR:
                            if (!this.preprocessor.methodNames.includes(stmt.original)) {

                                switch (true) {
                                    case stmt[conditionalKey]:
                                        addParticipantType(stmt, PARTICIPANT_TYPE_CONDITIONAL);
                                        break;

                                    case stmt[ternaryKey]:
                                        addParticipantType(stmt, PARTICIPANT_TYPE_TERNARY);
                                        break;
                                }

                                addParticipantType(stmt, PARTICIPANT_TYPE_ALL);

                                if (consumer) {
                                    consumer(stmt);
                                }
                            }
                            break;
                    }

                    prune(stmt);
                }
            });
        }

        visitNodes({
            Visitor: getVisitor(),
            types: [S_EXPR, T_EXPR],
            ast: this.preprocessor.ast,
            consumer: ({ stmt }) => {
                if (stmt.type == T_EXPR) {
                    const domParticipants = [];

                    registerLogicGateParticipants0(
                        stmt,
                        (stmt) => {
                            if (stmt.participantType.includes(DOM_PARTICIPANT_TYPE)) {
                                domParticipants.push(stmt);
                            }
                        });

                    stmt.domParticipants = domParticipants;
                    return false;
                }
            }
        });
    }

    addLogicGate({ stmt }) {
        const { T_EXPR, B_EXPR, getVisitor } = LogicalExprTransformer;
        const { visitNodes } = this.preprocessor.constructor;

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

        // Later when SubExpressions are processed, the resulting method is placed
        // on the ast, and later prune automatically. Since, this subexpressions 
        // are being used by this logic gate, we do not want to prune this, 
        // but rather leave it on the ast for use on runtime

        excludeSubExpressionsFromPrune();

        const mustache = stmt.type == 'MustacheStatement';
        assert(mustache || stmt.type == 'BlockStatement');

        // <source> is the source of the TernaryExpression node
        const source = mustache ? stmt.path : stmt.params[0];

        const { domParticipants: participants } = source;

        assert(participants);

        stmt.logicGate = { participants, table };

        // Later on, if this is in the root context, we may need to clean up
        // "ternary" synthetic methods from the ast. Hence, we 'll add
        // a suffix to the method name, and then later also use it to find
        // and prune them

        stmt.logicGatePruneKey = `_${utils.generateRandomString()}`;

        (mustache ? stmt : stmt.params[0]).prune = true;
        (mustache ? stmt : stmt.params[0]).methodNameSuffix = stmt.logicGatePruneKey;


        const accept = (stmt) => {

            const { type, condition, left, right, invert } = stmt;

            if (type !== T_EXPR) {
                return stmt;
            }

            const data = {
                index: table.length,
                invert: !!invert,
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
            data.conditionInversions = condition.map(c => !!c.invert)

            return data.index;
        }

        accept(source);
    }

    /**
     * This transform #each blocks with a ternary param to an #if...else tree
     */
    explodeTernaryEachBlocks() {
        const {
            createPathExpression, createStringLiteral, createBooleanLiteral
        } = this.preprocessor.constructor;
        const { T_EXPR, getVisitor } = LogicalExprTransformer;

        const Visitor = getVisitor();
        function ASTParser() {
        }
        ASTParser.prototype = new Visitor();

        const replacements = [];

        const bindParents = [
            this.preprocessor.ast,
        ];

        const visit = (decoratorName, inlineVariable, program, expr) => {

            assert(expr.type == T_EXPR);

            const ifBlock = {
                type: 'BlockStatement',
                path: createPathExpression({ original: 'if' }),
                params: [{
                    type: T_EXPR,
                    condition: expr.condition,
                    invert: expr.invert,
                    left: createBooleanLiteral(true),
                    right: createBooleanLiteral(false),
                }],
                program: {
                    type: 'Program',
                    body: [],
                },
                inverse: {
                    type: 'Program',
                    body: [],
                }
            }

            const accept = (expr, prg) => {
                if (expr == T_EXPR) {
                    visit(decoratorName, inlineVariable, prg, expr);
                } else {
                    prg.body.push({
                        type: 'PartialStatement',
                        params: [],
                        hash: {
                            type: 'Hash',
                            pairs: [{
                                type: 'HashPair',
                                key: createPathExpression({ original: inlineVariable }),
                                value: expr,
                            }]
                        },
                        name: createPathExpression({ original: decoratorName }),
                    })
                }
            }

            accept(expr.left, ifBlock.program);
            accept(expr.right, ifBlock.inverse);

            program.body.push(ifBlock);
        }

        ASTParser.prototype.BlockStatement = function (stmt) {

            if (stmt.path.original == 'each' && stmt.params[0] == T_EXPR) {

                const parent = utils.peek(bindParents);
                const index = parent.body.indexOf(stmt);

                const inlineVariable = utils.generateRandomString();
                const decoratorName = utils.generateRandomString();

                const decoratorBlock = {
                    type: 'DecoratorBlock',
                    params: [
                        createStringLiteral(decoratorName),
                        createPathExpression({ original: inlineVariable })
                    ],
                    program: {
                        type: 'Program',
                        body: [{
                            ...stmt,
                            params: [
                                {
                                    ...createPathExpression({ original: inlineVariable }),
                                    loc: stmt.params[0].loc,
                                }
                            ]
                        }]
                    },
                }

                replacements.push({
                    parent: parent.body,
                    replacementIndex: index,
                    replacementNodes: [
                        decoratorBlock,
                    ]
                });

                const prg = { body: [] };

                visit(decoratorName, inlineVariable, prg, stmt.params[0]);

                // Note: There's no need to add ... ASTParser.prototype.DecoratorBlock..., above for
                // the purpose of pushing and popping from <bindParents>. This is because <decoratorBlock> 
                // as constructed above has only one body item, which will not be transformed

                ASTParser.prototype.DecoratorBlock.call(this, decoratorBlock);

                this.mutating = true;

                return prg.body[0];

            } else {
                bindParents.push(stmt.program);

                this.acceptKey(stmt, 'program');
                this.acceptKey(stmt, 'inverse');

                bindParents.pop();
            }
        }

        const parser = new ASTParser();
        parser.accept(this.preprocessor.ast);

        // Todo: remove
        assert(
            bindParents.length == 1 && bindParents[0].body == this.preprocessor.ast.body
        );

        this.preprocessor.replaceNodes0({ replacements });
    }

    addLogicGatesAndHelper() {

        const {
            ternaryHelperName,
            logicalHelperName,
            createPathExpression,
            getLine,
            createStringLiteral,
            createBooleanLiteral,
            getDefaultLoc,
            getConditionalHelpers,
        } = this.preprocessor.constructor;

        const { T_EXPR, S_EXPR, MUST_GRP, getVisitor } = LogicalExprTransformer;
        const _this = this;


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
            assert(!!stmt.loc);

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
                    createBooleanLiteral(!!stmt.invert)
                ],
                loc: stmt.loc,
            };
        }

        ASTParser.prototype.MustacheStatement = function (stmt) {

            if (stmt.path.type === T_EXPR) {
                _this.addLogicGate({ stmt });
            }

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

module.exports = LogicalExprTransformer;