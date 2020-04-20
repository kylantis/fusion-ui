
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const handlebars = require('handlebars');
const utils = require('./utils');
const PartialReader = require('./template-reader');
const HtmlGenerator = require('./html-generator');
const esprima = require('esprima')
const escodegen = require('escodegen');

class TemplatePreprocessor {

    static cfg = {
        // Todo: Add config params here
    };

    // Todo: Implement this
    static autoInlinePartials = true;

    static synthethicMethodPrefix = 's$_';
    static allowContextQualifierOverrides = false;
    static dataPathRoot = 'data';
    static pathSeparator = '__';

    constructor({
        templatePath,
        componentName,
        ast,
        bindPaths,
        contextQualifiers = [],
        dynamicDataHelpers = [],
        registerDynamicDataHelpers = true,
    }) {

        this.componentName = componentName;
        this.templatePath = templatePath;
        this.ast = ast;

        this.bindPaths = bindPaths;
        this.contextQualifiers = contextQualifiers;

        this.dynamicDataHelpers = dynamicDataHelpers;
        this.registerDynamicDataHelpers = registerDynamicDataHelpers;

        this.arrayBlocks = [],

        // This is used in resolve data that cannot be gotten
        this.flattenedData = {};


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

        this.arrayMetadata = {};
        this.arrayBlockMetadata = {};

        this.sampleInput = this.getSampleInput();
        this.component = this.getComponent();

        this.componentAst = esprima.parseScript(
            this.component.constructor.toString(),
        );

        this.methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(this.component))
            .filter(item => typeof this.component[item] === 'function');

        this.validateMethodNames(this.methodNames);

        this.helpers = [];

        this.process();

        this.writeAssets();
    }

    validateMethodNames(methodNames) {
        for (const methodName of methodNames) {
            if (methodName.startsWith('s$_')) {
                throw new Error(`Method name: ${methodName} not allowed`);
            }
        }
    }

    writeAssets() {

        const componentPath = path
            .join(path.dirname(fs.realpathSync(__filename)),
                `../dist/components/${this.componentName}`);

        if (!fs.existsSync(componentPath)) {
            fs.mkdirSync(componentPath, { recursive: true });
        }

        // Write component script
        this.writeComponentScript(componentPath);

        // Write sample html
        this.writeSampleHtml(componentPath)
    }


    writeComponentScript(componentPath) {
        fs.writeFileSync(`${componentPath}/index.dist.js`, this.componentScript);
    }

    writeSampleHtml(componentPath) {

        const htmlString = HtmlGenerator.get({
            className: this.component.constructor.name,
            componentName: this.componentName
        });

        fs.writeFileSync(`${componentPath}/index.html`, htmlString);
    }

    /**
     * Process the AST
     */
    process() {

        this.process0({

            bindPaths: this.bindPaths || [{
                value: TemplatePreprocessor.dataPathRoot,
            }],
            contextQualifiers: this.contextQualifiers || [],

            astNodes: this.ast.body
        });

        if (this.registerDynamicDataHelpers) {
            // Register data helpers
            for (const path of this.dynamicDataHelpers) {
                this.addDataHelperMethod(path);
            }
        }

        // Add helpers array
        this.addCompoonentHelpers();

        // Add component name
        this.addCompoonentName();

        // Generate component class from AST
        this.componentScript = escodegen.generate(this.componentAst, { comment: true });
    }

    addDataHelperMethod(path) {

        const returnExpression = this.getCallExpression({
            methodName: 'lookupDataStore',
            args: [{ fqPath: this.trimDataPath(path) }]
        });
        
        const synthethicMethodName = this.wrapExpressionAsMethod({
            name: path,
            addSyntheticPrefix: false,
            returnExpression
        });

        this.helpers.push(synthethicMethodName);
    }

    addCompoonentName() {

        const returnExpression = this.getScalarValue(this.componentName);

        this.wrapExpressionAsMethod({
            name: 'name',
            returnExpression
        });
    }

    addCompoonentHelpers() {

        const returnExpression = {
            type: 'ArrayExpression',
            elements: this.helpers.map(this.getValue, this),
        }

        this.wrapExpressionAsMethod({
            name: 'helpers',
            returnExpression
        });
    }


    /**
     * Add dynamic data helper, hence handlebar.registerHelper(...)
     * will be generated at the end of AST processing
     * @param {String} path 
     */
    registerDynamicDataHelper(path) {
        if (!this.dynamicDataHelpers.includes(path)) {
            this.dynamicDataHelpers.push(path);
        }
    }

    /**
     * Todo: Use two arrays to to this:
     * restrictedPathsRange and restrictedPaths
     * 
     * @param {Object} stmt 
     * @param {String} path 
     */
    validatePath(stmt, path) {
        // Todo: Check if path === helpers, and fail
        if (
            path.includes('_$')
            ||
            path.includes(TemplatePreprocessor.pathSeparator)) {
            throw new Error(`Invalid path: ${path}, ${this.getLine(stmt)}`);
        }

        // Paths should generally be words or a json notation
        // Todo: Validate path using regex
    }

    hasObjectPrefix({ value, key }) {
        return value.split('.')[0] == key;
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

    // Todo: Require callers to pass in a loc object, so that we can track source
    // location in case error happens
    resolvePath({ bindPaths, contextQualifiers, value, allowLiterals = false }) {

        const pathValidator = (path) => {
            if (allowLiterals || path.type === 'PathExpression') {
                return path;
            }
            throw new Error(`Path: ${path.original} is not allowed becuase resolves to a literal`);
        }

        if (value.type != 'PathExpression') {
            return pathValidator({
                type, original
            } = value);
        }

        const separator = TemplatePreprocessor.pathSeparator;
        let { original } = value;

        const qualifier = (() => {

            for (const ctx of contextQualifiers) {

                if (
                    this.hasObjectPrefix({
                        value: original,
                        key: ctx.key
                    })
                ) {

                    if (ctx.type != 'PathExpression') {
                        if (ctx.key != original) {
                            throw new Error(`${ctx.key} refers to  a Literal (${ctx.value}) rather a PathExpression`);
                        } else {
                            return {
                                type: ctx.type,
                                original: ctx.value
                            }
                        }
                    } else {

                        original = this.trimObjectPath({
                            value: original,
                            key: ctx.key,
                            repl: './',
                            processReplAsEmpty: true
                        });

                        return {
                            type: ctx.type,
                            original: ctx.index ? bindPaths[ctx.index].value
                                : ctx.value
                        }
                    }
                }
            }

            return {
                type: 'PathExpression',
                original: bindPaths[bindPaths.length - 1].value
            };
        })();

        if (qualifier.type != 'PathExpression') {
            return pathValidator({
                ...qualifier
            });
        }

        const context = qualifier.original.split(separator);
        let index = context.length - 1;

        let arr = original.split(/(\.?\.\/){1}/);

        if (arr.length > 1) {

            let i = 0;

            whileLoop:
            while (i < arr.length) {

                const v = arr[i];

                if (v == '') {
                    i++;
                    continue;
                }

                switch (v) {
                    case '../':
                        // we are preventing ../ from
                        // overflowing the root segment(s)
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

        original = (original.length ? separator : '') + original.split('.').join(separator);

        return {
            type: 'PathExpression',
            original: context.slice(0, index + 1).join(separator) + original
        };
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
        return value.constructor && value.constructor.name == 'Object' ? this.getObjectValue(value)
            : this.getScalarValue(value);
    }

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
            init.arguments = args.map(this.getValue, this);
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

    createInvocationWithContext({ bindPaths, contextQualifiers, methodName }) {

        const parent = this.resolvePath({
            bindPaths,
            contextQualifiers,
            value: {
                type: 'PathExpression',
                original: methodName
            },
        })
            .original
            .replace(new RegExp(`${TemplatePreprocessor.pathSeparator}${methodName}$`), '');

        return this.getCallExpression({
            methodName,
            args: [
                {
                    ctx: this.getCallExpression({
                        methodName: 'lookupDataStore',
                        args: [{ fqPath: `${parent}` }]
                    })
                }
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
    addParameterizedExpression({ bindPaths, contextQualifiers, context, method, params = [], hash = {} }) {

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
                            bindPaths,
                            contextQualifiers,
                            variableName: name, hash: param.original
                        })
                    break;

                case param.type == 'PathExpression':

                    const path = this.resolvePath({
                        bindPaths,
                        contextQualifiers,
                        value: param,
                        allowLiterals: true
                    });

                    if (this.isMustacheDataPath(path.original)) {

                        if (path.type.endsWith('Literal')) {
                            statement = this
                                .getScalarConstantAssignmentStatement(name, path.original);
                        } else {

                            assert(path.type == 'PathExpression');

                            statement = this.
                                getMethodInvocationStatement(
                                    {
                                        variableName: name,
                                        methodName: 'lookupDataStore',
                                        args: [{ fqPath: `${path.original}` }]
                                    }
                                );
                        }

                    } else {

                        // The declared path expression is a method in
                        // in the component class, hence invoke function

                        this.validateHelper(param.original);

                        statement = this.getVariableEnvelope(name);

                        statement.declarations[0].init = this.createInvocationWithContext({
                            bindPaths, contextQualifiers,
                            methodName: param.original
                        });
                    }

                    break;

                case param.type == 'SubExpression':

                    const method = param.path.original;

                    this.validateHelper(method);

                    statement = this.getVariableEnvelope(name);

                    statement.declarations[0].init = {
                        type: 'CallExpression',
                        arguments: []
                    };

                    this.addParameterizedExpression({
                        bindPaths, contextQualifiers,
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

            this.componentAst.body[0].body.body
                .push(this.getMethodFromFunctionDeclaration({ ast }));

            return ast.id.name;
        }
    }

    /**
     * This creates a json assigment from a hash object
     */
    getJsonAssignmentStatement({ bindPaths, contextQualifiers, variableName, hash }) {

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

                    const path = this.resolvePath({
                        bindPaths,
                        contextQualifiers,
                        value: value,
                        allowLiterals: true
                    });

                    if (this.isMustacheDataPath(path.original)) {

                        if (path.type.endsWith('Literal')) {
                            init.properties.push(getProperty(key, this.getScalarValue(path.original)));
                        } else {

                            assert(path.type == 'PathExpression');

                            init.properties.push(getProperty(key, this.getCallExpression({
                                methodName: 'lookupDataStore',
                                args: [{ fqPath: `${path.original}` }]
                            })));
                        }

                    } else {

                        // The declared path expression is a method in
                        // in the component class, hence invoke function

                        this.validateHelper(value.original);

                        init.properties.push(getProperty(
                            key,
                            this.createInvocationWithContext({
                                bindPaths,
                                contextQualifiers,
                                methodName: value.original
                            })
                        ));
                    }
                    break;

                case value.type == 'SubExpression':

                    const method = value.path.original;
                    this.validateHelper(method);

                    const property = getProperty(key, {
                        type: 'CallExpression',
                        arguments: []
                    });

                    this.addParameterizedExpression({
                        bindPaths,
                        contextQualifiers,
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

    getMethodFromFunctionDeclaration({ ast: expression, addSyntheticPrefix  = true }) {

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

    /**
     * 
     */
    trimDataPath(path) {
        return path.replace(new RegExp(`^${TemplatePreprocessor.dataPathRoot}${TemplatePreprocessor.pathSeparator}`), '');
    }

    getArrayIndexTracker({ path, rhs }) {

        path = this.trimDataPath(path);
        const left = {
            type: 'MemberExpression',
            computed: true,
            object: {
                type: 'MemberExpression',
                computed: false,
                object: {
                    type: 'Identifier',
                    name: 'BaseComponent',
                },
                property: {
                    type: 'Identifier',
                    name: 'arrayIndexTracker',
                },
            },
            property: {
                type: 'Literal',
                value: `${path}`,
                raw: `'${path}'`,
            },
        }

        let expressions;

        switch (rhs.value == true) {

            case true:

                expressions = [this.getAssignmentExpression({
                    left,
                    right: {
                        type: "UnaryExpression",
                        operator: rhs.operator,
                        argument: {
                            type: 'Literal',
                            value: rhs.value,
                            raw: `${rhs.value}`,
                        },
                        prefix: true,
                    }
                })];

                break;

            case false:

                expressions = [this.getUpdateExpression({
                    left,
                    operator: rhs.operator
                })];

                break;
        }

        const synthethicMethodName = this.wrapExpressionAsMethod({
            statements: expressions,
            returnExpression: this.getScalarValue('')
        });

        this.helpers.push(synthethicMethodName);

        // We also need to push to this.methodNames to
        // let the mustache statement ast visitor know
        // that this is a valid helper method
        this.methodNames.push(synthethicMethodName);

        return {
            type: 'MustacheStatement',
            path: {
                type: "PathExpression",
                data: false,
                depth: 0,
                parts: [`${synthethicMethodName}`],
                original: `${synthethicMethodName}`,
            },
            params: [],
            // This null value is added, due to a hbs bug whereby
            // the loc object is not added correctly, hence resulting
            // in a JSON syntax error
            loc: {
                start: {
                    line: 0,
                    column: 0
                }
            }
        }
    };

    pushContextQualifier({ contextQualifiers, value }) {
        let currentIndex;
        contextQualifiers.forEach((ctx, index) => {
            if (ctx.key == value.key) {
                if (!TemplatePreprocessor.allowContextQualifierOverrides
                ) {
                    throw new Error(`The qualifier ${value.key} already exists in the current context`);
                }
                currentIndex = index;
            }
        });
        contextQualifiers.push(value);

        if (currentIndex) {
            return contextQualifiers.splice(currentIndex, 1)
        }
    }

    popContextQualifier({ contextQualifiers }) {
        contextQualifiers.pop();
    }

    log

    process0({ bindPaths, contextQualifiers, astNodes }) {

        const bindParents = [astNodes]

        const replacements = [];

        var Visitor = handlebars.Visitor;
        const _this = this;

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

            switch (stmt.path.original) {

                case 'with':
                case 'each':
                case 'if':

                    // Validate declared path
                    _this.validatePath(stmt, stmt.params[0].original);

                    // Resolve path
                    let { type, original: path } = _this.resolvePath({
                        bindPaths,
                        contextQualifiers,
                        value: stmt.params[0],
                        allowLiterals: stmt.path.original == 'if'
                    });

                    const parent = bindParents[bindParents.length - 1];

                    this.mutating = true;

                    if (stmt.path.original == 'each' || stmt.path.original == 'if') {

                        if (type === 'PathExpression') {
                            _this.registerDynamicDataHelper(path);
                        }

                        stmt.params[0].type = type;

                        stmt.params[0].parts[0] = path;
                        stmt.params[0].original = path;

                        
                    }

                    if (stmt.path.original == 'each') {

                        // At the top of the array block, 
                        // Initialize the tracker, i.e. BaseComponent.arrayIndexTracker['${path}']==-1
                        replacements.push({
                            parent,
                            shiftOnly: true,
                            replacementIndex: parent.indexOf(stmt),
                            replacementNodes: [_this.getArrayIndexTracker({
                                path,
                                rhs: {
                                    operator: '-',
                                    value: 1
                                }
                            }), stmt]
                        });

                        // At the top of the array body, increment the tracker
                        // i.e. BaseComponent.arrayIndexTracker['${path}']++
                        stmt.program.body.unshift(
                            _this.getArrayIndexTracker({
                                path,
                                rhs: {
                                    operator: '++',
                                }
                            })
                        );

                        path += '_$';
                    }

                    const getBlockParam = (index) => {
                        const { blockParams } = stmt.program;
                        return blockParams && blockParams.length > index
                            ? blockParams[index] : undefined;
                    };

                    const contextKey = getBlockParam(0);
                    let prevContextValue;

                    if (stmt.path.original == 'each' || stmt.path.original == 'with') {

                        bindPaths.push({
                            value: path,
                            construct: stmt.path.original
                        });

                        bindParents.push(stmt.program.body);

                        if (contextKey) {
                            prevContextValue = _this.pushContextQualifier({
                                contextQualifiers,
                                value: {
                                    key: contextKey,
                                    type: 'PathExpression',
                                    index: bindPaths.length - 1,
                                }
                            })
                        }
                    }

                    Visitor.prototype.BlockStatement.call(this, stmt);

                    if (stmt.path.original == 'each' || stmt.path.original == 'with') {

                        bindPaths.pop();
                        bindParents.pop();

                        if (contextKey) {
                            _this.popContextQualifier({
                                contextQualifiers,
                            });

                            if (prevContextValue) {
                                _this.pushContextQualifier({
                                    contextQualifiers,
                                    value: prevContextValue
                                });
                            }
                        }
                    }

                    if (stmt.path.original == 'with') {

                        // Replace #with block with the content of it's body
                        replacements.push({
                            parent,
                            replacementIndex: parent.indexOf(stmt),
                            replacementNodes: stmt.program.body
                        });

                        return false;
                    }

                    return stmt;
            }


            // Todo: process custom block

            Visitor.prototype.BlockStatement.call(this, stmt);
        }


        ASTParser.prototype.MustacheStatement = function (stmt) {

            if (stmt.path.type.endsWith('Literal')) {
                Visitor.prototype.MustacheStatement.call(this, stmt);
                return;
            }

            if (stmt.path.original
                .startsWith(`${TemplatePreprocessor.dataPathRoot}${TemplatePreprocessor.pathSeparator}`)) {
                throw new Error(`Mustache path: ${stmt.path.original} not allowed, ${this.getLine(stmt)}`);
            }

            if (stmt.params.length || stmt.hash) {

                _this.validateHelper(stmt.path.original);

                const synthethicMethodName = _this.addParameterizedExpression({
                    bindPaths, contextQualifiers,
                    method: stmt.path.original,
                    params: stmt.params, hash: stmt.hash
                });

                _this.helpers.push(synthethicMethodName);

                this.mutating = true;

                stmt.path.parts[0] = synthethicMethodName;
                stmt.path.original = synthethicMethodName;

                // stmt.path.type = path.type;
                stmt.hash = undefined;
                stmt.params = [];

                return stmt;
            }

            if (_this.transformMustacheStatement({
                stmt, bindPaths, contextQualifiers
            })) {

                _this.registerDynamicDataHelper(stmt.path.original);

                this.mutating = true;
                return stmt;

            } else {

                if (_this.helpers.includes(stmt.path.original)) {
                    // This is synthetic method that was added in the ast
                    // as a result of:
                    // 1. Array block transformations, e.t.c
                    // Hence, skip and continue
                    return;
                }

                // This is a helper invocation
                // Add a synthethic method to the ast that indirects
                // the invocation call, setting the context as argument

                const returnExpression = _this.createInvocationWithContext({
                    bindPaths, contextQualifiers,
                    methodName: stmt.path.original
                });
                const synthethicMethodName = _this.wrapExpressionAsMethod({
                    returnExpression
                });

                _this.helpers.push(synthethicMethodName);

                this.mutating = true;

                stmt.path.parts[0] = synthethicMethodName;
                stmt.path.original = synthethicMethodName;

                return stmt;
            }
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

            const partialContextQualifiers = []
                .concat(contextQualifiers);

            // Add hashes to context qualifiers
            for (const pair of hash.pairs) {

                let value;

                switch (true) {

                    case pair.value.type == 'PathExpression':

                        value = _this.resolvePath({
                            bindPaths,
                            contextQualifiers,
                            value: pair.value,
                            allowLiterals: true,
                        });
                        break;

                    case pair.value.type.endsWith('Literal'):

                        value = {
                            type: pair.value.type,
                            original: pair.value.original
                        }
                        break;

                    // Todo: Are subexpressions not supprted?
                    // Verify and implement, if necessary
                }

                _this.pushContextQualifier({
                    partialContextQualifiers,
                    value: {
                        key: pair.key,
                        type: value.type,
                        value: value.original
                    }
                });
            }

            const partialProcessor = new TemplatePreprocessor({
                templatePath: partialPath,
                ast: partialAST,
                bindPaths,
                contextQualifiers: partialContextQualifiers,
                dynamicDataHelpers: _this.dynamicDataHelpers,
                registerDynamicDataHelpers: false,
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

    validateHelper(helperName) {
        // Ensure that the declared helper is an existing method of the
        // component class
        if (!this.methodNames.includes(helperName)) {
            throw new Error(`Unknown helper function: ${helperName}`);
        }
    }

    transformMustacheStatement({ stmt, bindPaths, contextQualifiers }) {

        // Validate declared path
        this.validatePath(stmt, stmt.path.original);

        const original = stmt.path.original;

        // Resolve path
        const path = this.resolvePath({
            bindPaths,
            contextQualifiers,
            value: stmt.path,
            allowLiterals: true
        });

        if (path.type == 'PathExpression') {

            if (!this.isMustacheDataPath(path.original)) {

                try {
                    // Ensure that this is a helper invocation
                    this.validateHelper(original);
                } catch (e) {
                    throw new Error(`Unknown path: ${original}, ${this.getLine(stmt)}`);
                }

                return false;
            }
        }

        stmt.path.parts[0] = path.original;
        stmt.path.original = path.original;

        stmt.path.type = path.type;

        return true;
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

    // Todo: Support globals
    isMustacheDataPath(fqPath) {
        return this.component
            .lookupDataStore({ fqPath: this.trimDataPath(fqPath), indexResolver: () => 0 })
            != null;
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

        let data;

        if (this.componentAst) {
            data = (escodegen.generate(this.componentAst) +
                `\nmodule.exports = ${this.componentAst.body[0].id.name};`);
        } else {
            data = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
        }

        // eslint-disable-next-line no-unused-vars
        const window = {};
        // eslint-disable-next-line no-unused-vars
        const document = {};

        // eslint-disable-next-line no-eval
        const ComponentClass = eval(`${BaseComponent}${data}`);

        const component = new ComponentClass({ input: this.sampleInput, render: false });

        return component;
    }
}

module.exports = TemplatePreprocessor;