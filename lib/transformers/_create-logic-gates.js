
const assert = require('assert');
const utils = require('../utils');
const importFresh = require('import-fresh');

class LogicalExprTransformer {

    static T_EXPR = 'TernaryExpression';
    static P_EXPR = 'PathExpression';
    static S_EXPR = 'SubExpression';
    static B_EXPR = 'BooleanExpression';
    static MUST_GRP = 'MustacheGroup';
    static M_STMT = 'MustacheStatement';
    static B_STMT = 'BlockStatement';

    static OR = 'OR';
    static AND = 'AND';
    static NOT = 'NOT';

    static enableTernaryEachBlockExplosion = true;

    constructor({ preprocessor }) {
        this.preprocessor = preprocessor;
    }

    transform(ast) {

        this.ast = ast;

        const { enableTernaryEachBlockExplosion } = LogicalExprTransformer;

        this.explodeOperators();

        this.implyTernary();

        this.parse();

        if (enableTernaryEachBlockExplosion) {
            this.explodeTernaryEachBlocks();
        }

        this.registerLogicGateParticipants();

        this.addLogicGatesAndHelper();
    }

    explodeOperators() {
        const { visitNodes, createPathExpression, stringifyHandlebarsNode } = this.preprocessor.constructor;
        const { ast } = this;
        const { S_EXPR, M_STMT, MUST_GRP, getVisitor } = LogicalExprTransformer;

        const Visitor = getVisitor([MUST_GRP]);

        visitNodes({
            types: [S_EXPR, M_STMT],
            ast,
            Visitor,
            consumer: ({ stmt }) => {

                if (stmt.generated) {
                    return;
                }

                stmt.source = stringifyHandlebarsNode(stmt);


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
                                    original: s, loc: segments[i].loc,
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
        const { getLine, createStringLiteral, stringifyHandlebarsNode } = constructor;

        const unionOperators = [OR, AND];
        const booleanOperators = Object.keys(component.getBooleanOperators());

        const operators = [NOT, ...unionOperators, ...booleanOperators];

        let { type, path, params, hash } = stmt;

        if (type === P_EXPR || type === T_EXPR || type.endsWith('Literal')) {
            return stmt;
        }

        if (type === MUST_GRP) {
            stmt.items = stmt.items.map((stmt) => this.getExpression({ stmt }));
            return stmt;
        }

        assert(type === S_EXPR || type === 'MustacheStatement');

        const IsOperator = (stmt) => stmt.type == P_EXPR &&
            operators.includes((stmt.original || '').toUpperCase())

        const IsBooleanOperator = (stmt) => stmt.type == P_EXPR &&
            booleanOperators.includes((stmt.original || '').toUpperCase())

        const ensureNotOperator = (stmt) => {
            if (IsOperator(stmt)) {
                this.preprocessor.throwError(`Illegal "${stmt.original}" expression`, stmt);
            }
            return true;
        }

        const parseInversions = () => {

            if ([NOT, NOT.toLowerCase()].includes(path.original)) {

                const expr = params.shift();
                assert(!!expr && ensureNotOperator(expr));

                path = stmt.path = expr;
                stmt.path.invert = true;
            }
            for (let i = 0; i < params.length; i++) {
                const param = params[i];

                if ([NOT, NOT.toLowerCase()].includes(param.original)) {
                    assert(i < params.length - 1 && ensureNotOperator(params[i + 1]));

                    params[i + 1].invert = true;
                    params[i] = null;
                }
            }
            params = stmt.params = stmt.params
                .filter(param => param != null);
        }

        const getExpression = (stmt) => {
            let { type, path, params, invert } = stmt;

            let expr;

            if ((params[0] || {}).original === '?') {
                expr = {
                    type: T_EXPR,
                    invert,
                }
            } else {

                if (!params.length && path.type == S_EXPR) {

                    expr = this.getExpression({ stmt: path });
                    
                    if (invert) {
                        expr.invert = invert;
                    }

                    expr.wrap = true;

                } else {
                    expr = {
                        ...stmt,
                        params: [],
                    }
                }
            }

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

                                const { original: operator } = expr.params[j - 1];

                                // (and | or) operator
                                condition.unshift({
                                    ...createStringLiteral(
                                        operator.toUpperCase()
                                    ),
                                    raw: operator,
                                    loc: expr.params[j - 1].loc,
                                });

                                // operand
                                if (j - 1 == 0) {
                                    condition.unshift(stmt.path);

                                    expr = {
                                        type: T_EXPR,
                                        invert: stmt.invert,
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

                    const e = {
                        type: T_EXPR,
                        condition: expr.condition,
                        left: expr.left,
                        right: expr.right,
                        loc: {
                            ...expr.condition[0].loc,
                            end: expr.right.loc.end,
                        }
                    }

                    const source = stringifyHandlebarsNode({
                        ...e, ...expr.left.implied ? { left: null, right: null } : {},
                    },
                        { useSource: true }
                    );

                    if (expr.params) {

                        const start = leftStart - leftStartOffset;

                        const delCount = (i + 1) - start;

                        const elements = [{
                            ...e, source,
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

                        expr.loc = e.loc;
                        expr.source = source;

                        expr.hook = this.preprocessor.getMethodNameHashValue({ stmt, key: 'hook', cleanup: true });
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
                        if (param.original == '?' || param.original == ':') {
                            this.preprocessor.throwError(`The ternary operator stack is imbalanced`, param);
                        }
                        return param;
                    });
            }
        }

        const transformHash = () => {
            if (hash && hash.pairs.length) {

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

                        const { type, path, params, isCondition, invert, loc, source, hash } = stmt;

                        if (type == S_EXPR && params.length && IsBooleanOperator(params[0])) {

                            if (params.length != 2) {
                                this.preprocessor.throwError(`Incorrect number of params, use parenthesis for the LHS and/or RHS`, stmt);
                            }

                            ensureNotOperator(path);
                            ensureNotOperator(params[1]);

                            if (hash && hash.pairs.length) {
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
                                loc, source,
                            };
                        }

                        return stmt;
                    });
            }
        }

        const checkOrphanedOperators = (stmt, parent) => {

            if (!stmt) {
                throw Error(`Statement contains syntax error, ${getLine(parent)}`);
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
            AND, OR, NOT, S_EXPR, MUST_GRP, M_STMT, B_STMT, getVisitor,
        } = LogicalExprTransformer;

        const Visitor = getVisitor([MUST_GRP]);

        const { component, constructor: { stringifyHandlebarsNode } } = this.preprocessor;

        const unionOperators = [OR, AND];
        const booleanOperators = Object.keys(component.getBooleanOperators());

        const {
            visitNodes, createPathExpression, createLiteral, getConditionalHelpers, throwError,
        } = this.preprocessor.constructor;

        visitNodes({
            types: [S_EXPR, M_STMT, B_STMT],
            ast: this.ast,
            Visitor,
            consumer: ({ stmt }) => {

                const transform = (stmt) => {

                    // If this looks like a compound boolean expression, we automatically 
                    // append ? true : false, so that it can be processed as a logic gate.

                    let { type, path, params, loc, generated, source } = stmt;

                    if (generated) return;

                    const hasTernary = params.filter(({ original }) => original == '?').length;

                    if (hasTernary) return;

                    assert(type == 'SubExpression' || type == 'MustacheStatement');

                    const hasNot = typeof path.original == 'string' && path.original.toUpperCase() == NOT;

                    const firstParamValue = params.length ? params[0].original : null;

                    const hasUnion = typeof firstParamValue == 'string' && unionOperators.includes(firstParamValue.toUpperCase());
                    const hasBool = typeof firstParamValue == 'string' && booleanOperators.includes(firstParamValue.toUpperCase());

                    if (!(hasNot || hasUnion || hasBool)) return;

                    if (hasBool) {
                        if (params.length == 1) {
                            throwError(`Exepected boolean expression to have a RHS`, stmt);
                        }

                        if (params.length > 2) {

                            stmt.path = {
                                type: S_EXPR,
                                path,
                                params: [
                                    params.shift(),
                                    params.shift()
                                ],
                                loc,
                                source,
                            };

                            transform(stmt.path);
                            transform(stmt);

                            return;
                        }
                    }

                    /// ????

                    if (hasBool) {

                        // see parseBooleanExpressions()

                        // Wrap stmt as a subexpression, before appending
                        // ? true : false to the param list.
                        stmt.type = type;
                        stmt.path = {
                            type: S_EXPR,
                            path,
                            params,
                            loc,
                            generated: true,
                            source,
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
                        implied: true,
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
                        implied: true,
                        loc
                    });
                }

                if (stmt.type == 'BlockStatement') {

                    const conditional = getConditionalHelpers()
                        .includes(stmt.path.original);

                    if (conditional && stmt.params.length > 1) {
                        const { params, loc } = stmt;
                        const path = params.shift();

                        const param = {
                            type: S_EXPR,
                            path,
                            params,
                            loc,
                        }

                        stmt.params = [{
                            ...param,
                            source: stringifyHandlebarsNode(param),
                        }];
                    } else {

                        // Note: For #with and #each, we expect an object or (array or map) respctively, so
                        // we cannot implicitly transform a param that looks like a conditional to a ternary
                        // expression

                        return stmt;
                    }

                } else {
                    transform(stmt);
                }
            }
        });
    }

    parse() {

        const { T_EXPR, MUST_GRP, getVisitor } = LogicalExprTransformer;

        const _this = this;

        const Visitor = getVisitor([T_EXPR, MUST_GRP]);
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
                    hash: stmt.hash,
                    loc: stmt.loc,
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
        parser.accept(this.ast);
    }

    registerLogicGateParticipants() {

        const { T_EXPR, B_EXPR, P_EXPR, S_EXPR, MUST_GRP, getVisitor } = LogicalExprTransformer;
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
                types: [S_EXPR, T_EXPR, MUST_GRP, P_EXPR, B_EXPR],
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
            types: [S_EXPR, T_EXPR, MUST_GRP],
            ast: this.ast,
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
        const { T_EXPR, B_EXPR, S_EXPR, P_EXPR, MUST_GRP, getVisitor } = LogicalExprTransformer;
        const { constructor: { visitNodes }, metadata } = this.preprocessor;

        const table = [];

        const excludeSubExpressionsFromPrune = () => {

            const _this = this;

            visitNodes({
                Visitor: getVisitor(),
                types: [T_EXPR, B_EXPR, MUST_GRP],
                ast: {
                    type: 'Program',
                    body: [stmt],
                },
                consumer: ({ stmt }) => {

                    if (stmt.prune == false) {
                        return false;
                    }

                    const { condition, left, right, items } = stmt;
                    [
                        ...(condition || []),
                        ...(items || []),
                        left, right
                    ]
                        .filter(s => !!s)
                        .filter(({ type, original }) => {
                            const isSubExpression = type == S_EXPR ||
                                (type == P_EXPR && _this.preprocessor.methodNames.includes(original)) ||
                                // MUST_GRP and T_EXPR statements will be exploded into sub-expressions soon
                                type == MUST_GRP || type == T_EXPR;

                            return isSubExpression;
                        })
                        .forEach(stmt => {
                            if (!stmt.inLogicGateTree) {
                                stmt.prune = false
                            }
                        });
                }
            });
        }

        const mustache = stmt.type == 'MustacheStatement';
        assert(mustache || stmt.type == 'BlockStatement');

        // <src> refers to the stmt where the TernaryExpression node originated from
        const src = mustache ? stmt.path : stmt.params[0];

        const { domParticipants: participants } = src;

        assert(participants);

        stmt.logicGate = { participants, table };

        // Later on, if this is in the root context, we may need to clean up
        // "ternary" synthetic methods from the ast. Hence, we 'll add
        // a suffix to the method name, and then later also use it to find
        // and prune them

        stmt.logicGatePruneKey = `_${utils.generateRandomString()}`;

        // Register logicGate prune key, for more info, see addLogicGate() in TemplatePreprocessor
        (metadata.logicGatePruneKeys || (metadata.logicGatePruneKeys = []))
            .push(stmt.logicGatePruneKey);

        (mustache ? stmt : stmt.params[0]).prune = true;
        (mustache ? stmt : stmt.params[0]).methodNameSuffix = stmt.logicGatePruneKey;


        const accept = (stmt) => {

            stmt.inLogicGateTree = true;

            const { type, condition, left, right, invert, hook } = stmt;

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

            // Note: since logic gates have an inversion mechanism (i.e. "invert"), we shouldn't re-inverse it
            data.conditionInversions = condition.map(({ type, invert }) => !!invert && type != T_EXPR)

            if (hook && data.index == 0) {
                // Hooks are intrinsic to the logic gate table at index 0, i.e. the root
                data.hook = hook;
            }

            return data.index;
        }

        accept(src);

        // Later when SubExpressions are processed, the resulting method is placed
        // on the ast, and later prune automatically. Since, these subexpressions 
        // are being used by this logic gate, we do not want to prune this, 
        // but rather leave it on the ast for use on runtime

        excludeSubExpressionsFromPrune();
    }

    /**
     * This transform #each blocks with a ternary param to an #if...else tree
     */
    explodeTernaryEachBlocks() {
        const {
            createPathExpression, createStringLiteral, createBooleanLiteral, getDefaultStripOptions
        } = this.preprocessor.constructor;
        const { T_EXPR, getVisitor } = LogicalExprTransformer;

        const Visitor = getVisitor();
        function ASTParser() {
        }
        ASTParser.prototype = new Visitor();

        const replacements = [];

        const bindParents = [
            this.ast,
        ];

        const visit = (decoratorName, inlineVariable, program, expr, loc) => {

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
                    loc: expr.loc,
                }],
                program: {
                    type: 'Program',
                    body: [],
                },
                inverse: {
                    type: 'Program',
                    body: [],
                },
                loc,
                ...getDefaultStripOptions(),
            }

            const accept = (expr, prg) => {
                if (expr == T_EXPR) {
                    visit(decoratorName, inlineVariable, prg, expr, loc);
                } else {
                    prg.body.push({
                        type: 'PartialStatement',
                        params: [],
                        hash: {
                            type: 'Hash',
                            pairs: [{
                                type: 'HashPair',
                                key: inlineVariable,
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

            if (stmt.path.original == 'each' && stmt.params[0].type == T_EXPR) {

                const parent = utils.peek(bindParents);
                const index = parent.body.indexOf(stmt);

                const inlineVariable = utils.generateRandomString();
                const decoratorName = utils.generateRandomString();

                const decoratorBlock = {
                    type: 'DecoratorBlock',
                    path: {
                        ...createPathExpression({ original: 'inline' }),
                    },
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

                visit(decoratorName, inlineVariable, prg, stmt.params[0], stmt.loc);

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
        parser.accept(this.ast);

        // Todo: remove
        assert(
            bindParents.length == 1 && bindParents[0].body == this.ast.body
        );

        this.preprocessor.replaceNodes0({ replacements });
    }

    addLogicGatesAndHelper() {

        const {
            ternaryHelperName, logicalHelperName, createPathExpression, getLine, createStringLiteral,
            createBooleanLiteral, getConditionalHelpers,
        } = this.preprocessor.constructor;

        const { T_EXPR, S_EXPR, MUST_GRP, getVisitor } = LogicalExprTransformer;
        const _this = this;


        const implodeTernaryExpression = (stmt) => {

            assert(['SubExpression', 'MustacheStatement'].includes(stmt.type));

            stmt.canonicalSource = stmt.canonicalSource || stmt.source;

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

            const { loc, source } = stmt;

            this.acceptKey(stmt, 'left');
            this.acceptKey(stmt, 'right');

            this.mutating = true;
            return {
                type: 'SubExpression',
                path: {
                    ...createPathExpression({ original: logicalHelperName }),
                    loc,
                },
                params: [
                    stmt.left,
                    stmt.right,
                    {
                        ...createStringLiteral(stmt.operator),
                        loc
                    },
                ],
                loc,
                canonicalSource: source,
                generated: true,
            };
        }

        ASTParser.prototype.TernaryExpression = function (stmt) {
            assert(stmt.loc);

            this.acceptArray(stmt.condition);
            this.acceptKey(stmt, 'left');
            this.acceptKey(stmt, 'right');

            const { loc, prune } = stmt;

            this.mutating = true;
            return {
                type: 'SubExpression',
                path: {
                    ...createPathExpression({ original: ternaryHelperName }),
                    loc: stmt.loc,
                },
                params: [
                    ...stmt.condition,
                    stmt.left,
                    stmt.right,
                    {
                        ...createStringLiteral(
                            JSON.stringify(
                                stmt.condition.map(c => !!c.invert)
                            )
                        ),
                        loc,
                    },
                    {
                        ...createBooleanLiteral(!!stmt.invert),
                        loc
                    }
                ],
                prune,
                loc,
                canonicalSource: stmt.source,
                generated: true,
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
        parser.accept(this.ast);
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

        ASTParser.prototype.ExternalProgram = function (stmt) {
            stmt.type = 'Program';
            this.accept(stmt);
            stmt.type = 'ExternalProgram';
        }

        ASTParser.prototype.ComponentReference = function () {
        }

        return ASTParser;
    }

}

module.exports = LogicalExprTransformer;