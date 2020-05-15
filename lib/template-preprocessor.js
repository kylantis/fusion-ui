
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const handlebars = require('handlebars');
const utils = require('./utils');
const PartialReader = require('./template-reader');
const ClientHtmlGenerator = require('./client-html-generator');
const esprima = require('esprima')
const escodegen = require('escodegen');

class TemplatePreprocessor {

    static cfg = {
        // Todo: Add config params here
    };

    // Todo: Implement this
    static autoInlinePartials = true;

    static synthethicMethodPrefix = 's$_';
    static rootQualifier = '@_root';
    static dataPathRoot = 'data';
    static pathSeparator = '__';

    constructor({
        templatePath,
        componentName,
        ast,
        contextList,
        dataPaths,
        blocksData,
        component,
        componentAst,
        helpers,
        isPartial = false
    }) {

        this.componentName = componentName;
        this.templatePath = templatePath;
        this.ast = ast;

        this.contextList = contextList;

        this.dataPaths = dataPaths || [];

        this.blocksData = blocksData || {};

        // Lifecycle methods include: 
        // preRender, postRender
        // In both methods above, the component data is available via this.data
        // Additionally in postRender, the rendered DOMElement is available
        // via this.node

        // Interceptor methods include:
        // onChange, which allows you to intercept changes to specific data paths
        // the list of node_is (scoped by the current component) that are affected
        // by the change is passed in to your function, and you can perform custom
        // logic

        if (!component) {

            component = this.getComponent();
            componentAst = this.createComponentAst(component);

            this.validateMethodNames(this.getMethodNames({
                component
            }));
        }

        this.component = component;

        this.componentAst = componentAst;

        this.methodNames = this.getMethodNames({
            component: this.component
        });

        this.helpers = helpers || [];

        this.isPartial = isPartial;

        this.process();
    }

    getMethodNames({ component }) {
        return Object.getOwnPropertyNames(Object.getPrototypeOf(component))
            .filter(item => typeof component[item] === 'function');
    }

    createComponentAst(component) {
        const ast = esprima.parseScript(
            component.constructor.toString(),
        );

        // Add module.exports
        ast.body.push(
            this.getAssignmentExpression({
                left: {
                    type: 'MemberExpression',
                    object: {
                        type: 'Identifier',
                        name: 'module'
                    },
                    property: {
                        type: 'Identifier',
                        name: 'exports'
                    }
                },
                right: {
                    type: 'Identifier',
                    name: ast.body[0].id.name
                },
            })
        );

        return ast;
    }

    validateMethodNames(methodNames) {
        for (const methodName of methodNames) {
            if (methodName.startsWith('s$_')) {
                throw new Error(`Method name: ${methodName} not allowed`);
            }
        }
    }

    getComponentDistPath() {
        const componentPath = path
            .join(path.dirname(fs.realpathSync(__filename)),
                `../dist/components/${this.componentName}`);

        if (!fs.existsSync(componentPath)) {
            fs.mkdirSync(componentPath, { recursive: true });
        }

        return componentPath;
    }

    writeClientHtml() {

        const componentPath = this.getComponentDistPath();

        fs.writeFileSync(
            `${componentPath}/index.dist.js`, this.componentScript);

        const htmlString = ClientHtmlGenerator.get({
            className: this.component.constructor.name,
            componentName: this.componentName
        });

        fs.writeFileSync(`${componentPath}/client.html`, htmlString);
    }

    /**
     * Process the AST
     */
    process() {

        const { rootQualifier, dataPathRoot } = TemplatePreprocessor;

        const defaultContext = {};

        defaultContext[rootQualifier] = {

            type: 'PathExpression',
            value: dataPathRoot,

            // fyi - declaredValue is only used to resolve @root
            // and will be mutated as partials are processed
            declaredValue: dataPathRoot
        };

        this.process0({
            contextList: this.contextList || [
                defaultContext
            ],
            astNodes: this.ast.body
        });

        if (!this.isPartial) {
            // add helpers array
            this.addHelpers();

            // add component name
            this.addName();

            // add compoonent data paths
            this.addDataPaths();

            // serialize ast
            this.serializeAst();

            // write client-rendered html
            this.writeClientHtml();

            console.log(JSON.stringify(this.ast))
        }
    }

    serializeAst() {

        let fields = {};

        if (this.component) {
            for (const k of Object.getOwnPropertyNames(this.component)
                .filter(prop => prop != 'id')) {
                fields[k] = this.component[k];
            }
        }

        this.componentScript = escodegen.generate(this.componentAst, { comment: true });
        this.component = this.getComponent();

        for (const k in fields) {
            this.component[k] = fields[k];
        }
    }

    addName() {

        const returnExpression = this.getScalarValue(this.componentName);

        this.wrapExpressionAsMethod({
            name: 'name',
            returnExpression
        });
    }

    addHelpers() {

        const returnExpression = {
            type: 'ArrayExpression',
            elements: this.helpers.map(this.getValue, this),
        }

        this.wrapExpressionAsMethod({
            name: 'helpers',
            returnExpression
        });
    }

    addDataPaths() {
        const returnExpression = {
            type: 'ArrayExpression',
            elements: this.dataPaths.map(this.getValue, this),
        }

        this.wrapExpressionAsMethod({
            name: 'dataPaths',
            returnExpression
        });
    }

    /**
     * Todo: Use two arrays to to this:
     * restrictedPathsRange and restrictedPaths
     * 
     * @param {String} path 
     */
    validatePath(path) {

        const {
            pathSeparator,
            dataPathRoot,
            synthethicMethodPrefix
        } = TemplatePreprocessor;

        // Todo: Check if path === helpers, and fail
        if (
            path.includes('_$')
            ||
            path.includes(pathSeparator)
            ||
            path
                .startsWith(`${dataPathRoot}${pathSeparator}`)
            ||
            path.startsWith(synthethicMethodPrefix)
        ) {
            throw new Error(`Invalid path: ${path}`);
        }

        // Paths should generally be words or a json notation
        // Todo: Validate path using regex
    }

    hasObjectPrefix({ value, key, rangeAllowed = true }) {

        const arr = value.split('.');
        const match = arr[0] == key;

        if (match && arr.length > 1 && !rangeAllowed) {
            throw new Error(`Invalid property: ${arr.slice(1, arr.length).join('.')}`);
        }

        return match;
    }

    trimObjectPath({ value, key, repl, processReplAsEmpty = false }) {
        if (this.hasObjectPrefix({ value, key })) {
            const arr =
                value
                    .split('.');

            if (arr.length == 1) {
                value = repl;
            } else {
                if (processReplAsEmpty) {
                    arr.shift();
                } else {
                    arr[0] = repl;
                }
                value = arr.join('.');
            }
        }
        return value;
    }

    getPathOffset({ original, contextList }) {

        let index = contextList.length - 1;

        let arr = original.split(/(\.?\.\/){1}/);

        const isDataVariable = original.startsWith('@');

        if (arr.length > 1) {

            let i = isDataVariable ? 1 : 0;

            whileLoop:
            while (i < arr.length) {

                const v = arr[i];

                if (v == '') {
                    i++;
                    continue;
                }

                switch (v) {
                    case '../':
                        if (index > 0) {
                            index--;
                        }
                    case './':
                        original = original.replace(v, '');
                        break;

                    default:
                        break whileLoop;
                }

                i++;
            }
        }

        return {
            path: original,
            index
        }
    }

    /**
     * 
     * expectedTypes: The passed in expectedTypes should an array of strings containing any of:
     * 'Array', 'Object' or 'Literal'. An empty array means we only check that the
     * value is not undefined
     * 
     * @param {*} param0 
     */
    resolvePathFromContext({ contextList, contextIndex, original, validTypes = [], lookup = true }) {

        const { rootQualifier, pathSeparator: separator } = TemplatePreprocessor;
        const contextObject = contextList[contextIndex];

        let type;

        if (original.length) {

            const contextKeys = Object.keys(contextObject);
            contextKeys.splice(contextKeys.indexOf(rootQualifier), 1);

            for (let i = 0; i < contextKeys.length; i++) {

                const k = contextKeys[i];
                const v = contextObject[k];

                if (
                    this.hasObjectPrefix({
                        value: original,
                        key: k,
                        rangeAllowed: v.lookup == false ? false : true
                    })
                ) {

                    if (k == original && v.type.endsWith('Literal')) {

                        original = v.value;
                        type = v.type;

                    } else {

                        assert(v.type == 'PathExpression');

                        original = this.trimObjectPath({
                            value: original,
                            key: k,
                            repl: v.value,
                        })
                            .split('.').join(separator);

                        type = v.type;

                        if (v.lookup != undefined) {
                            lookup = v.lookup;
                        }
                    }

                    break;
                }
            }
        }

        if (!type) {

            let rootValue = contextObject[rootQualifier].value;

            if (this.hasObjectPrefix({ value: original, key: '@root' })) {

                rootValue = contextList[0][rootQualifier].declaredValue;

                original = this.trimObjectPath({
                    value: original,
                    key: '@root',
                    processReplAsEmpty: true
                });

            } else if (original.startsWith('@')) {

                // It is expected that any data variables must have been
                // resolved by now
                throw new Error(`Unknown data variable: ${original}`);
            }

            original = rootValue +
                (original.length ? separator : '') + original.split('.').join(separator);

            type = 'PathExpression';
        }

        // If applicable, we will then attempt to lookup
        // the original path to verify the value matches 
        // the validTypes specified

        let targetType;

        if (lookup && !type.endsWith('Literal')) {

            const value = this.lookupDataPath({
                fqPath: original,
                validTypes,
            });

            targetType = value != null ? value.constructor.name : null;
        }

        return {
            original,
            type,
            lookup,
            targetType
        }
    }

    // Fix the destructuring here
    resolvePath({ contextList, value, validTypes = [] }) {

        let lookup = true;
        let { type, original } = value;
        let targetType;

        if (type == 'PathExpression') {

            this.validatePath(original);

            // Todo: Is ../../this valid?

            if (this.hasObjectPrefix({ value: original, key: 'this' })) {

                original = this.trimObjectPath({
                    value: original,
                    key: 'this',
                    repl: './',
                });
            }

            const offset = this.getPathOffset({
                original,
                contextList
            });
            const { index } = offset;
            original = offset.path;

            const resolvedPath = this.resolvePathFromContext({
                contextList,
                contextIndex: index,
                original,
                validTypes,
                lookup
            });

            type = resolvedPath.type;
            original = resolvedPath.original;
            lookup = resolvedPath.lookup;
            targetType = resolvedPath.targetType;
        }

        if (type.endsWith('Literal')) {

            if (validTypes.length > 0 && !validTypes.includes('Literal')) {
                throw new Error(`Path: ${original} cannot resolve to the Literal value`);
            }
        }

        return {
            type,
            original,
            lookup,
            targetType
        }
    }

    getIdentifier(ctx) {
        return {
            type: 'Identifier',
            name: ctx
        }
    }

    getRawValue(value) {
        return typeof value == 'string' ? `'${value}'` : `${value}`
    }

    getValue(value) {
        return value && value.constructor && value.constructor.name == 'Object' ? this.getObjectValue(value)
            : this.getScalarValue(value);
    }

    // Todo: Check is there is a better way to do this
    isAstObject(value) {
        return value.constructor.name == 'Object'
            && value.type;
    }

    getScalarValue(value) {
        const envelope = {
            type: value === undefined ? 'Identifier' : 'Literal'
        };

        if (value === undefined) {
            envelope.name = 'undefined';
        } else {
            envelope.value = value;
            envelope.raw = this.getRawValue(value);
        }
        return envelope;
    }

    getObjectValue(json) {
        const envelope = {
            type: 'ObjectExpression',
            properties: []
        };
        for (const k in json) {
            const v = json[k];
            envelope.properties.push({
                type: 'Property',
                key: this.getIdentifier(k),
                computed: false,
                value: this.isAstObject(v) ? v : this.getValue(v),
                kind: 'init',
                method: false,
                shorthand: false
            });
        }
        return envelope;
    }

    getVariableEnvelope(variableName) {
        if (typeof variableName !== 'string') {
            throw new Error(`Unknown variable type for ${variableName}`)
        }
        return {
            type: 'VariableDeclaration',
            kind: 'let',
            declarations: [{
                type: 'VariableDeclarator',
                id: this.getIdentifier(variableName),
            }]
        };
    }

    getScalarConstantAssignmentStatement(variableName, value) {

        const envelope = this.getVariableEnvelope(variableName);
        envelope.declarations[0].init = this.getScalarValue(value);

        return envelope;
    }

    getUpdateExpression({ left, operator }) {
        return {
            type: "ExpressionStatement",
            expression: {
                type: "UpdateExpression",
                operator: operator,
                argument: left,
                prefix: false,
            }
        }
    }

    getAssignmentExpression({ left, right }) {
        return {
            "type": "ExpressionStatement",
            "expression": {
                "type": "AssignmentExpression",
                "operator": "=",
                "left": left,
                "right": right,
            },
        }
    }

    getCallExpression({ classTarget, methodName, args }) {

        const init = {
            type: 'CallExpression',
            callee: {
                type: 'MemberExpression',
                computed: false,
                object: classTarget ? {
                    type: 'Identifier',
                    name: classTarget
                } : {
                        type: 'ThisExpression'
                    },
                property: {
                    type: 'Identifier',
                    name: methodName
                }
            },
        };

        if (args.length) {
            init.arguments = args;
        }

        return init;
    }

    getMethodInvocationStatement({ variableName, classTarget, methodName, args = [] }) {

        const envelope = this.getVariableEnvelope(variableName);

        const init = this.getCallExpression({ classTarget, methodName, args });

        envelope.declarations[0].init = init;
        return envelope;
    }

    /**
     * This creates a function that just returns the provided
     * expression
     */
    wrapExpressionAsMethod({ name, addSyntheticPrefix = true, statements = [], returnExpression }) {

        const ast = {
            type: 'FunctionDeclaration',
            id: {
                type: "Identifier",
                name: name || utils.generateRandomString()
            },
            body: {
                type: "BlockStatement",
                body: []
            },
            params: [],
            generator: false,
            expression: false,
            async: false
        };

        for (const statement of statements) {
            ast.body.body.push(statement);
        }

        if (returnExpression) {
            ast.body.body.push({
                type: "ReturnStatement",
                argument: returnExpression
            })
        }

        this.componentAst.body[0].body.body
            .push(this.getMethodFromFunctionDeclaration({
                ast,
                addSyntheticPrefix
            }));

        return ast.id.name;
    }

    createInvocationWithContext({ contextList, methodName, args = [] }) {

        let parentCtx;

        if (contextList.length > 1) {

            const { rootQualifier } = TemplatePreprocessor;

            const parent = contextList[contextList.length - 1]
            [rootQualifier].value;

            parentCtx = this.getCallExpression({
                methodName: 'resolvePath',
                args: [{ fqPath: `${this.trimDataPath(parent)}` }]
                    .map(this.getValue, this)
            })
        } else {
            parentCtx = this.getValue(null);
        }

        return this.getCallExpression({
            methodName,
            args: [
                ...args,
                parentCtx
            ]
        });
    }

    /**
     * This creates a function that serves as an indirection to the method specified
     * 
     * @param {String} originalMethodName The method that is being indirected
     * @param {Array<Object>} params The array of params as parsed by hbs, possible
     * values are: PathExpression, NumberLiteral, StringLiteral, BooleanLiteral,
     * NullLiteral, UndefinedLiteral, Hash, SubExpression
     */
    addParameterizedExpression({
        contextList,
        context, method, params = [], hash = {},
        syntheticAlias
    }) {

        // Provisionally, add hash to paramList
        if (Object.keys(hash).length) {
            params.push({
                type: 'Hash',
                original: hash
            });
        }

        const ast = {
            type: context ? 'ArrowFunctionExpression' : 'FunctionDeclaration',
            id: context ? null : {
                type: "Identifier",
                name: utils.generateRandomString()
            },
            params: [],
            body: {
                type: "BlockStatement",
                body: [
                    {
                        type: "ReturnStatement",
                        argument: {
                            type: "CallExpression",
                            callee: {
                                type: "MemberExpression",
                                computed: false,
                                object: {
                                    type: "ThisExpression"
                                },
                                property: {
                                    type: "Identifier",
                                    name: method
                                }
                            }
                        }
                    }
                ]
            },
            generator: false,
            expression: false,
            async: false
        };

        const body = ast.body.body;

        const variableNames = [];

        for (let i = params.length - 1; i >= 0; i--) {
            const param = params[i];

            const name = utils.generateRandomString();
            variableNames.unshift(name);

            let statement;

            switch (true) {

                case param.type.endsWith('Literal'):
                    statement = this
                        .getScalarConstantAssignmentStatement(name, param.original);
                    break;

                case param.type == 'Hash':
                    statement = this.
                        getJsonAssignmentStatement({
                            contextList,
                            variableName: name, hash: param.original
                        })
                    break;

                case param.type == 'PathExpression':

                    if (this.methodNames.includes(param.original)) {

                        // The declared path expression is a method in
                        // in the component class, hence invoke function

                        statement = this.getVariableEnvelope(name);

                        statement.declarations[0].init = this.createInvocationWithContext({
                            contextList,
                            methodName: param.original
                        });

                    } else {

                        const path = this.resolvePath({
                            contextList,
                            value: param,
                        });

                        if (path.lookup) {

                            if (path.type.endsWith('Literal')) {
                                statement = this
                                    .getScalarConstantAssignmentStatement(name, path.original);
                            } else {

                                assert(path.type == 'PathExpression');

                                statement = this.
                                    getMethodInvocationStatement(
                                        {
                                            variableName: name,
                                            methodName: 'resolvePath',
                                            args: [{ fqPath: `${this.trimDataPath(path.original)}` }]
                                                .map(this.getValue, this)
                                        }
                                    );
                            }

                        } else {

                            // This resolves to a synthetic method

                            statement = this.getCallExpression({
                                methodName: 'getSyntheticMethod',
                                args: [path.original]
                                    .map(this.getValue, this)

                            });
                        }
                    }

                    break;

                case param.type == 'SubExpression':

                    const method = param.path.original;

                    this.validateMethod(method);

                    statement = this.getVariableEnvelope(name);

                    statement.declarations[0].init = {
                        type: 'CallExpression',
                        arguments: []
                    };

                    this.addParameterizedExpression({
                        contextList,
                        context: statement.declarations[0].init,
                        method,
                        params: param.params,
                        hash: param.hash
                    });

                    break;
            }

            body.unshift(statement);
        }

        // add function invocation params in return statement
        body[body.length - 1].argument.arguments = [];

        for (const variableName of variableNames) {
            body[body.length - 1].argument.arguments.push({
                type: 'Identifier',
                name: variableName
            });
        }

        if (context) {
            context.callee = ast;
        } else {

            if (syntheticAlias) {
                const stmt = body[body.length - 1];
                stmt.argument = this.getCallExpression({
                    methodName: 'setSyntheticContext',
                    args: [{
                        alias: syntheticAlias,
                        value: stmt.argument
                    }]
                        .map(this.getValue, this)

                });
            }

            this.componentAst.body[0].body.body
                .push(this.getMethodFromFunctionDeclaration({ ast }));

            return ast.id.name;
        }
    }

    /**
     * This creates a json assigment from a hash object
     */
    getJsonAssignmentStatement({ contextList, variableName, hash }) {

        const envelope = this.getVariableEnvelope(variableName);
        const init = {
            type: 'ObjectExpression',
            properties: []
        };

        const getProperty = (key, value) => {
            return {
                type: 'Property',
                key: this.getIdentifier(key),
                computed: false,
                value: value,
                kind: 'init',
                method: false,
                shorthand: false
            };
        }

        for (const pair of hash.pairs) {

            const { key, value } = pair;

            switch (true) {

                case value.type.endsWith('Literal'):
                    init.properties.push(getProperty(key, this.getScalarValue(value.original)));
                    break;

                case value.type == 'PathExpression':

                    if (this.methodNames.includes(value.original)) {

                        init.properties.push(getProperty(
                            key,
                            this.createInvocationWithContext({
                                contextList,
                                methodName: value.original
                            })
                        ));

                    } else {

                        const path = this.resolvePath({
                            contextList,
                            value: value,
                        });

                        if (path.lookup) {

                            if (path.type.endsWith('Literal')) {
                                init.properties.push(getProperty(key, this.getScalarValue(path.original)));
                            } else {

                                assert(path.type == 'PathExpression');

                                init.properties.push(
                                    getProperty(
                                        key,
                                        this.getCallExpression({
                                            methodName: 'resolvePath',
                                            args: [{ fqPath: `${this.trimDataPath(path.original)}` }]
                                                .map(this.getValue, this)

                                        })
                                    )
                                );
                            }

                        } else {

                            // This resolves to a synthetic method

                            init.properties.push(
                                getProperty(
                                    key,
                                    this.getCallExpression({
                                        methodName: 'getSyntheticMethod',
                                        args: [path.original]
                                            .map(this.getValue, this)
                                    })
                                )
                            );
                        }

                    }

                    break;

                case value.type == 'SubExpression':

                    const method = value.path.original;
                    this.validateMethod(method);

                    const property = getProperty(key, {
                        type: 'CallExpression',
                        arguments: []
                    });

                    this.addParameterizedExpression({
                        contextList,
                        context: property.value,
                        method,
                        params: value.params,
                        hash: value.hash
                    });

                    init.properties.push(property);
                    break;
            }
        }

        envelope.declarations[0].init = init;
        return envelope;
    }

    getMethodFromFunctionDeclaration({ ast: expression, addSyntheticPrefix = true }) {

        // Update method name, to indicate that it's synthetic
        expression.id.name =
            `${addSyntheticPrefix ? TemplatePreprocessor.synthethicMethodPrefix : ''}${expression.id.name}`

        const envelope = {
            type: 'MethodDefinition',
            key: expression.id,
            kind: 'method',
            static: false,
        };

        const program = Object.assign({}, expression)

        program.type = 'FunctionExpression'
        program.id = null

        envelope.value = program;

        return envelope;
    }

    trimDataPath(path) {
        return path.replace(new RegExp(`^${TemplatePreprocessor.dataPathRoot}${TemplatePreprocessor.pathSeparator}`), '');
    }

    createBlockOperation({ cacheKey, defaultCacheValue, path, methodName, args = {} }) {

        if (!this.blocksData[path]) {
            this.blocksData[path] = defaultCacheValue;
        }

        const blockData = this.blocksData[path];

        let synthethicMethodName = eval(`blockData.${cacheKey}`);

        if (!synthethicMethodName) {

            const returnExpression = this.getCallExpression({
                methodName,
                args: [{
                    path: this.trimDataPath(path),
                    ...args
                }]
                    .map(this.getValue, this)
            });

            synthethicMethodName = this.wrapExpressionAsMethod({
                returnExpression
            });

            this.helpers.push(synthethicMethodName);

            eval(`blockData.${cacheKey} = '${synthethicMethodName}'`)
        }

        return synthethicMethodName;
    }

    createIterateDataVariable({ path, dataVariable }) {
        return this.createBlockOperation({
            cacheKey: `dataVariableMethods[\'${dataVariable}\']`,
            path,
            methodName: 'getBlockData',
            args: { dataVariable }
        });
    }

    createIterateUpdate({ path }) {
        return this.createBlockOperation({
            cacheKey: `updateMethod`,
            path,
            methodName: 'doBlockUpdate',
        });
    }

    createIterateInit({ path, blockId }) {
        return this.createBlockOperation({
            cacheKey: `initMethod`,
            defaultCacheValue: { dataVariableMethods: {} },
            path,
            methodName: 'doBlockInit',
            args: {}
        });
    }

    addDataVariablesToContext({ contextObject, path, dataVariables }) {

        for (const qualifier in dataVariables) {
            const dataVariable = dataVariables[qualifier];

            contextObject[qualifier] = {
                type: 'PathExpression',
                value: this.createIterateDataVariable({
                    path,
                    dataVariable
                }),
                synthetic: true,
                lookup: false
            }
        }
    }

    createSubExpression({ contextList, method, params, hash, syntheticAlias }) {

        // Process sub-expression
        // Todo: Here, the context is not passed in as last parameter

        this.validateMethod(method);

        const synthethicMethodName = this.addParameterizedExpression({
            contextList,
            method,
            params, hash,
            syntheticAlias
        });

        this.helpers.push(synthethicMethodName);

        return synthethicMethodName;
    }

    createSubExpressionFromMustache({ contextList, stmt }) {

        const synthethicMethodName = this.createSubExpression({
            contextList,
            method: stmt.path.original,
            params: stmt.params,
            hash: stmt.hash
        });

        stmt.path.parts = [synthethicMethodName];
        stmt.path.original = synthethicMethodName;

        stmt.hash = undefined;
        stmt.params = [];

        return stmt;
    }

    createMethodInvocation({ contextList, stmt }) {

        // Add a synthethic method to the ast that indirects
        // the invocation call, setting the context as argument

        const returnExpression = this
            .createInvocationWithContext({
                contextList,
                methodName: stmt.path.original
            });
        const synthethicMethodName = this.wrapExpressionAsMethod({
            returnExpression
        });

        this.helpers.push(synthethicMethodName);


        stmt.path.parts = [synthethicMethodName];
        stmt.path.original = synthethicMethodName;

        return stmt;
    }

    createMustacheStatement({ original }) {
        return {
            type: 'MustacheStatement',
            path: {
                type: "PathExpression",
                data: false,
                depth: 0,
                parts: [original],
                original,
            },
            params: [],
            // This loc value is added, due to a hbs bug whereby
            // the loc object is not added correctly, hence resulting
            // in a JSON syntax error
            // Todo: Is this still happening?
            loc: {
                start: {
                    line: 0,
                    column: 0
                }
            }
        }
    }

    getBlockOptions(stmt) {

        const getBlockParam = (stmt, index) => {
            const { blockParams } = stmt.program;
            const qualifier = blockParams && blockParams.length > index
                ? blockParams[index] : null;

            if (qualifier && this.methodNames.includes(qualifier)
            ) {
                throw new Error(
                    `The qualifier: '${qualifier}' already exists as a named method`
                );
            }
            return qualifier;
        };

        const scopeQualifier = getBlockParam(stmt, 0);
        const indexQualifier = getBlockParam(stmt, 1);

        if (indexQualifier && scopeQualifier && scopeQualifier == indexQualifier) {
            // Todo: This may be already enforced by the hbs compiler
            // please verify, and remove this - if necessary
            throw new Error('The context and index qualifier cannot be the same');
        }

        delete stmt.program.blockParams;

        let validTypes = [];
        let contextSwitching = true;
        let replacementPath = null;
        let canIterate = false;
        let conditional = false;

        switch (stmt.path.original) {
            case 'unless':
            case 'if':
                validTypes = ['Literal', 'Array', 'Object'];
                contextSwitching = false;
                conditional = true;

                break;

            case 'each':
                validTypes = ['Array', 'Object'];
                canIterate = true;

                break;

            case 'with':
                validTypes = ['Object'];
                replacementPath = 'if';
                // Set this as a conditional, since it will
                // be transformed to an if
                conditional = true;

                break;
            default:
                return null;
        }

        return {
            validTypes,
            contextSwitching,
            scopeQualifier,
            indexQualifier,
            canIterate,
            replacementPath,
            conditional
        };
    }

    process0({
        contextList, 
        astNodes,
         }) {

        const _this = this;

        const bindParents = [astNodes]
        const replacements = [];

        var Visitor = handlebars.Visitor;

        function ASTParser() {
        }
        ASTParser.prototype = new Visitor();

        ASTParser.prototype.Program = function (stmt) {
            Visitor.prototype.Program.call(this, stmt);
        }

        ASTParser.prototype.ContentStatement = function (stmt) {
            Visitor.prototype.ContentStatement.call(this, stmt);
        }

        ASTParser.prototype.BlockStatement = function (stmt) {

            if (stmt.processed) {
                return;
            }

            const { rootQualifier } = TemplatePreprocessor;
            const parent = bindParents[bindParents.length - 1];

            const options = _this.getBlockOptions(stmt);
            if (!options) {
                Visitor.prototype.BlockStatement.call(this, stmt);
                return;
            }

            this.mutating = true;

            const {
                validTypes,
                contextSwitching,
                scopeQualifier,
                indexQualifier,
                canIterate,
                replacementPath,
                conditional
            } = options;

            const isSynthetic =
                stmt.params[0].type == 'SubExpression'
                ||
                (stmt.params[0].type == 'PathExpression' && _this.methodNames.includes(stmt.params[0].original));

            let path;

            let syntheticAlias;

            if (isSynthetic) {

                const method = stmt.params[0].original || stmt.params[0].path.original;

                if (contextSwitching) {
                    // We need to construct the syntheticAlias to look 
                    // like a synthetic method, because it will
                    // be used as the root qualifier for subpaths
                    syntheticAlias = `${stmt.path.original}$$${utils.generateRandomString()}`;
                }

                path = {
                    lookup: false,
                    type: 'PathExpression',
                    original: _this.createSubExpression({
                        contextList,
                        method,
                        params: stmt.params[0].params || [],
                        hash: stmt.params[0].hash || [],
                        syntheticAlias,
                    })
                }

                // Allow hbs engine to attempt to resolve this synthetic method
                _this.dataPaths.push(path.original);

                // we need to serialize, so we can invoke the method 
                // to get it's returned type (for validation purpose)

                _this.serializeAst();

                const value = _this.component[path.original]();

                _this.validateType({
                    path: method, value, validTypes
                })

                path.targetType = value.constructor.name;

            } else {

                // Note however that this can still resolve to
                // a synthetic method

                path = _this.resolvePath({
                    contextList,
                    value: stmt.params[0],
                    validTypes
                });
            }

            let { type, original, lookup, targetType } = path;

            // Do some validations

            if (contextSwitching) {
                if (type != 'PathExpression') {
                    throw new Error(`A ${type} cannot be the target of the 
                                    ${stmt.path.original} block`
                    );
                }
            }

            // Update stmt params accordingly

            let __path = original;

            if (type == 'PathExpression') {
                stmt.params[0] = {
                    depth: 0,
                    data: false
                }

                if (lookup) {
                    __path = _this.trimDataPath(original);

                    // Allow hbs engine to attempt to resolve this data path
                    _this.dataPaths.push(__path);
                }
            }

            stmt.params[0] = {
                ...stmt.params[0],
                type,
                original: __path,
                parts: [__path]
            }


            if (contextSwitching) {
                const contextObject = {};

                if (isSynthetic) {

                    original = _this.wrapExpressionAsMethod({
                        returnExpression: _this.getCallExpression({
                            methodName: 'getSyntheticContext',
                            args: [{
                                alias: syntheticAlias,
                                key: 'current'
                            }]
                                .map(_this.getValue, _this)
                        })
                    });

                    // We need to serialize, so that sub-paths
                    // can properly resolve

                    _this.serializeAst();
                }

                if (canIterate) {

                    // Todo: Implement this
                    const blockId = undefined;

                    // At the top of the #each block, invoke doBlockInit
                    replacements.push({
                        parent,
                        replacementIndex: parent.indexOf(stmt),
                        replacementNodes: [
                            _this.createMustacheStatement({
                                original:
                                    _this.createIterateInit({
                                        path: syntheticAlias || original,
                                        blockId
                                    })
                            })
                            , stmt]
                    });

                    // At the top of the #each body, doBlockUpdate
                    stmt.program.body.unshift(
                        _this.createMustacheStatement({
                            original:
                                _this.createIterateUpdate({
                                    path: syntheticAlias || original
                                })
                        })
                    );

                    // Register context qualifiers, which in hbs
                    // mean data variables

                    const dataVariables = {
                        '@first': '@first',
                        '@last': '@last',
                        '@index': '@index',
                        '@key': '@key'
                    }

                    // Register index qualifier
                    if (indexQualifier) {
                        dataVariables[indexQualifier] = targetType == 'Array'
                            ? '@index' : '@key'
                    }

                    // Register data variables in context object
                    _this.addDataVariablesToContext({
                        contextObject,
                        path: syntheticAlias || original,
                        dataVariables
                    });
                }

                original += (isSynthetic || !canIterate) ? '_@' : '_$';

                // Add scope qualifier
                if (scopeQualifier) {
                    contextObject[scopeQualifier] = {
                        type,
                        value: original,
                        lookup: true
                    }
                }

                // Add root qualifier
                contextObject[rootQualifier] = {
                    type,
                    value: original,
                    lookup: true
                }

                contextList.push(contextObject);
            }

            bindParents.push(stmt.program.body);

            Visitor.prototype.BlockStatement.call(this, stmt);

            bindParents.pop();

            if (contextSwitching) {
                contextList.pop();
            }

            stmt.processed = true;


            if (replacementPath) {
                stmt.path.original = replacementPath;
                stmt.path.parts = [replacementPath];
            }

            if (conditional && type == 'PathExpression') {

                // Todo: Update param to use a synthetic method
                // that analyzes thr condition

                // Note: the existing can either be data path or
                // synthetic method, 
                // i.e. this.component.analyzeCondition(...)

                const synthethicMethodName = _this.wrapExpressionAsMethod({
                    returnExpression: _this
                        .createInvocationWithContext({
                            contextList,
                            methodName: 'analyzeCondition',
                            args: [{ path: stmt.params[0].original }]
                                .map(_this.getValue, _this)
                        })
                });
                stmt.params[0] = {
                    ...stmt.params[0],
                    original: synthethicMethodName,
                    parts: [synthethicMethodName]
                }

                // Allow hbs engine to attempt to resolve this synthetic method
                _this.dataPaths.push(synthethicMethodName);

                // Todo: If stmt.params[0].original is a synthetic method,
                // we no longer it in _this.dataPaths
            }

            return canIterate ? false : stmt;
        }

        ASTParser.prototype.MustacheStatement = function (stmt) {

            if (stmt.processed) {
                return;
            }

            if (stmt.path.type.endsWith('Literal')) {
                return;
            }

            if (_this.helpers.includes(stmt.path.original)) {
                // This is a synthetic method
                return;
            }

            this.mutating = true;

            if (stmt.params.length || stmt.hash) {
                return {
                    ..._this.createSubExpressionFromMustache({
                        contextList,
                        stmt
                    }),
                    // Todo: this may not be necessary because the
                    // path is a synthetic method anyway
                    processed: true
                }
            }

            if (_this.methodNames.includes(stmt.path.original)) {
                return {
                    ..._this.createMethodInvocation({
                        contextList,
                        stmt
                    }),
                    // Todo: this may not be necessary because the
                    // path is a synthetic method anyway
                    processed: true
                }
            }

            // Resolve path
            let { type, original, lookup } = _this.resolvePath({
                contextList,
                value: stmt.path,
            });

            if (lookup) {
                original = _this.trimDataPath(original);
                _this.dataPaths.push(original);
            }

            stmt.path = {
                ...stmt.path,
                data: false,
                depth: 0,
                parts: [original],
                original,
                type
            }

            return {
                ...stmt,
                processed: true
            };
        }

        const decoratorBlocks = [];

        ASTParser.prototype.PartialStatement = function (partial) {

            const { name, params, hash = { type: 'Hash', pairs: [] } } = partial;

            if (decoratorBlocks.includes(name.original)) {
                Visitor.prototype.PartialStatement.call(this, partial);
                return;
            }

            if (params.length) {

                // Add params (path expressions) as hash pairs
                // For example: 
                // {{> myPartial myOtherContext }} == {{> myPartial myOtherContext = ./myOtherContext }}
                params
                    .filter(param => param.type == 'PathExpression')
                    .forEach(param => {
                        hash.pairs.push({
                            key: param.original,
                            value: {
                                type: param.type,
                                original: `./${param.original}`
                            }
                        });
                    });
            }

            // Validate hashkeys keys as words
            // Todo: Is this necessary, the ast tokenizer should
            // do this for us
            for (const h of hash.pairs) {
                if (h.key.match(/[\w]+/g) != h.key) {
                    throw new Error(`Hashkey: ${h.key} for PartialStatement must be
                                a valid word, ${this.getLine(partial)}`);
                }
            }

            this.mutating = true;

            const partialPath = _this.getPartialPath(name.original)
            const partialAST = PartialReader.read(partialPath, name.data);

            const partialContextList = []
                .concat(contextList);


            if (partialContextList.length > 1) {
                const { rootQualifier } = TemplatePreprocessor;
                let rootPath = _this.resolvePath({
                    value: {
                        type: 'PathExpression',
                        original: 'this'
                    },
                    contextList,
                });

                // Change the root path
                partialContextList[0][rootQualifier]
                    .declaredValue = rootPath.original;
            }

            // Add hash(es) as qualifier(s) to the current context
            for (const pair of hash.pairs) {

                let qualifier;

                switch (true) {

                    case pair.value.type == 'PathExpression':

                        const path = _this.resolvePath({
                            value: pair.value,
                            contextList,
                        });

                        qualifier = {
                            type: path.type,
                            value: path.original,
                            lookup: path.lookup,
                        };
                        break;

                    case pair.value.type.endsWith('Literal'):

                        qualifier = {
                            type: pair.value.type,
                            value: pair.value.original
                        }
                        break;

                    default:

                        // Todo: Are subexpressions not supprted?
                        // Verify and implement, if necessary

                        throw new Error(`Partial hash type: ${pair.value.type} is not supported`);
                }

                const contextObject = partialContextList[partialContextList.length - 1];

                if (contextObject[pair.key]) {
                    throw new Error(`The qualifier ${pair.key} already exists in the current context`);
                }

                contextObject[pair.key] = qualifier;
            }

            const partialProcessor = new TemplatePreprocessor({
                templatePath: partialPath,
                componentName: _this.componentName,
                ast: partialAST,
                contextList: partialContextList,
                dataPaths: _this.dataPaths,
                blocksData: _this.blocksData,
                component: _this.component,
                componentAst: _this.componentAst,
                helpers: _this.helpers,
                isPartial: true
            });

            partialProcessor.process();

            const parent = bindParents[bindParents.length - 1];

            replacements.push({
                parent,
                replacementIndex: parent.indexOf(partial),
                replacementNodes: partialProcessor.ast.body
            });

            return false;
        };

        ASTParser.prototype.DecoratorBlock = function (decorator) {
            const { path } = decorator;

            if (path.type === 'PathExpression' &&
                path.original === 'inline') {

                const [param] = decorator.params;
                if (param && param.type === 'StringLiteral') {
                    decoratorBlocks.push(param.value);
                }
            }
            Visitor.prototype.DecoratorBlock.call(this, decorator);
        };

        const parser = new ASTParser();
        parser.accept(this.ast);

        this.replaceNodes(replacements);
    }

    validateMethod(methodName) {
        if (!this.methodNames.includes(methodName)) {
            throw new Error(`Unknown method: ${methodName}`);
        }
    }

    getLine(stmt) {
        const { loc: { start } } = stmt;
        return `Line: ${start.line}:${start.column}`
    }

    getPartialPath(partialName) {
        const dir = path.dirname(this.templatePath);
        const partialFile = path.join(dir, `${partialName}.hbs`);

        if (!fs.existsSync(partialFile)) {
            throw new Error(`Partial: ${partialName} could not be loaded`);
        }

        return partialFile;
    }

    replaceNodes(replNodes) {

        for (let index = 0; index < replNodes.length; index++) {

            const block = replNodes[index];

            for (const replNode of block.replacementNodes) {
                block.parent.splice(block.replacementIndex, 0, replNode);
                block.replacementIndex++;
            }

            for (let index2 = index + 1; index2 < replNodes.length; index2++) {
                const b = replNodes[index2];

                if (b.parent === block.parent) {
                    b.replacementIndex += block.replacementNodes.length +
                        (block.shiftOnly ? -1 : 0);
                }
            }
        }
    }

    getSampleInput() {
        const dir = path.dirname(this.templatePath);
        const sample = fs.readFileSync(path.join(dir, 'sample.json'), 'utf8');

        return JSON.parse(sample);
    }

    isDataPath(fqPath) {
        return this.lookupDataPath({ fqPath })
            != undefined;
    }

    isPrimitive(value) {
        return value == null || ['String', 'Number', 'Boolean']
            .includes(value.constructor.name);
    }

    validateType({ path, value, validTypes = [], strict = false }) {
        if (validTypes && validTypes.length) {

            for (const type of validTypes) {
                switch (true) {

                    case type == 'Array' && value != null && value.constructor.name === 'Array':
                        if ((!!value.length) || !strict) {
                            return value;
                        }
                        break;

                    case type == 'Object' && value != null && value.constructor.name === 'Object':
                        if ((!!Object.keys(value).length) || !strict) {
                            return value;
                        }
                        break;

                    case type == 'Literal' && this.isPrimitive(value):
                        return value;
                }
            }

            // console.log(value);
            throw new Error(`${path} must resolve to a non-empty value with one of the types: ${validTypes}`);
        }
        return value;
    }

    lookupDataPath({ fqPath, validTypes = [] }) {

        const value = this.component
            .resolvePath({
                fqPath: this.trimDataPath(fqPath),
                indexResolver: () => 0
            });

        return this.validateType({
            path: fqPath,
            value, validTypes
        });
    }

    getHandleBarsDefaultHelpers() {
        return [
            'blockHelperMissing', 'each', 'helperMissing', 'if', 'log', 'lookup', 'unless', 'with'
        ];
    }

    /**
    * This returns the component instance of the template
    * that is currently being processed
    */
    getComponent() {

        const dir = path.dirname(this.templatePath);
        const BaseComponent = fs.readFileSync(path.join(path.dirname(dir), 'base.js'), 'utf8');

        const data = this.componentScript ?
            this.componentScript :
            fs.readFileSync(path.join(dir, 'index.js'), 'utf8')

        const window = {};

        // eslint-disable-next-line no-eval
        const ComponentClass = eval(`${BaseComponent}${data}`);

        const component = new ComponentClass({
            id: utils.generateRandomString(),
            input: this.getSampleInput(),
            render: false
        });

        return component;
    }
}

module.exports = TemplatePreprocessor;