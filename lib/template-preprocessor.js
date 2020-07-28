
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const handlebars = require('handlebars');
const esprima = require('esprima')
const escodegen = require('escodegen');
const jsdom = require("jsdom");
const csso = require('csso');
const UglifyJS = require("uglify-js");
const utils = require('./utils');
const PartialReader = require('./template-reader');
const ClientHtmlGenerator = require('./client-html-generator');
const BaseComponent = require('../src/assets/js/base-component');
const PathResolver = require('./path-resolver');

class TemplatePreprocessor {

    static minifyComponentRendererClass = false;
    static futilizeInvalidRootAccess = true;
    static allowRootAccessByDefault = true;
    static customBlockPrefix = 'c$_';
    static synthethicMethodPrefix = 's$_';
    static literalPrefix = 'l$_';
    static rootQualifier = '@_root';
    static dataPathRoot = 'data';
    static pathSeparator = '__';
    static allowRootAccessHashKey = 'allowRootAccess';
    static reservedDecoratorNames = ['@partial-block'];
    static blockParamHashKey = 'blockParam';
    static syntheticAliasSeparator = '$$';
    static inlineParameterPrefix = '_';

    constructor({
        assetId,
        pluginName,
        componentName,
        ast,
        contextList,
        bindParents,
        dataPaths,
        blocksData,
        component,
        componentAst,
        helpers,
        globals,
        isPartial = false,
        customBlockCtx = false,
        allowRootAccess,
        resolver,
    }) {

        utils.addPloyfills();

        this.assetId = assetId;

        this.pluginName = pluginName;
        this.componentName = componentName;

        this.srcDir = path
            .join(path.dirname(fs.realpathSync(__filename)),
                `../src/plugins/${pluginName}/${componentName}`);

        this.ast = ast;

        this.contextList = contextList;
        this.bindParents = bindParents;

        this.dataPaths = dataPaths || [];

        this.blocksData = blocksData || {};

        this.customBlockCtx = customBlockCtx;
        this.allowRootAccess = allowRootAccess;

        this.resolver = resolver;

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
            componentAst = esprima.parseScript(
                component.constructor.toString(),
            );

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

        this.globals = globals || {};

        this.isPartial = isPartial;

        this.cssDependencies = [];
        this.jsDependencies = [];

        this.process();
    }

    getMethodNames({ component }) {
        return Object.getOwnPropertyNames(Object.getPrototypeOf(component))
            .filter(item => typeof component[item] === 'function');
    }

    validateMethodNames(methodNames) {
        for (const methodName of methodNames) {
            if (methodName.startsWith('s$_')) {
                throw new Error(`Method name: ${methodName} not allowed`);
            }
        }
    }

    getDistPath() {
        const assetPath = path
            .join(path.dirname(fs.realpathSync(__filename)),
                `../dist/component-assets/${this.assetId}`);

        if (!fs.existsSync(assetPath)) {
            fs.mkdirSync(assetPath, { recursive: true });
        }
        return assetPath;
    }

    writeAssetsToFileSystem() {

        const { minifyComponentRendererClass } = TemplatePreprocessor;
        const distPath = this.getDistPath();

        // Write component renderer class
        // First, we want to move all synthr
        fs.writeFileSync(
            `${distPath}/index.min.js`,
            minifyComponentRendererClass ?
                this.minifyAsset({ data: this.componentScript, type: 'js' }) :
                this.componentScript
        );

        // Write html stub
        fs.writeFileSync(`${distPath}/client.html`, ClientHtmlGenerator.get({
            className: this.component.constructor.name,
            assetId: this.assetId,
            resolver: this.resolver
        }));
    }

    getLiteralType({ value }) {

        switch (true) {

            case value == null:
                return 'NullLiteral';

            case value == undefined:
                return 'UndefinedLiteral';

            case value.constructor.name == 'String':
                return 'StringLiteral';

            case value.constructor.name == 'Number':
                return 'NumberLiteral';

            case value.constructor.name == 'Boolean':
                return 'BooleanLiteral';
        }

        throw new Error(`Unknown literal value: ${value}`);
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

        for (let k in this.globals) {
            const value = this.globals;
            defaultContext[k] = {
                type: this.getLiteralType({ value }),
                value
            };
        }

        if (!this.isPartial) {

            this.assetId = utils.generateRandomString();
            this.readHeadAttributes();
        }

        this.process0({
            contextList: this.contextList || [
                defaultContext
            ],
            bindParents: this.bindParents || [{ type: 'root', body: this.ast.body }],
            ast: this.ast
        });

        if (!this.isPartial) {
            // add assetId to ast
            this.emitAssetId();

            // add helpers array to ast
            this.emitHelpers();

            // add compoonent data paths to ast
            this.emitDataPaths();

            // add css/js dependencies to ast
            this.emitDependencies();

            // migrate synthetic methods from *test.js to *.js
            this.migrateSyntheticMethods();

            // write component model
            this.resolver.finalize();

            // write assets
            this.writeAssetsToFileSystem();

            // console.log(JSON.stringify(this.ast));
        }
    }

    migrateSyntheticMethods() {

        const data = fs.readFileSync(
            path.join(this.srcDir, 'index.js'),
            'utf8'
        );

        const ast = esprima.parseScript(data);

        for (const definition of this.componentAst.body[0].body.body) {
            if (this.isRootCtxValue(definition.key.name)) {
                ast.body[0].body.body.push(definition);
            }
        }

        this.componentScript = escodegen.generate(ast);
    }

    readHeadAttributes() {
        const attributes = ['server-stub', 'style', 'script'];

        while (true) {
            const stmt = this.ast.body[0];

            if (
                stmt.type == 'MustacheStatement' &&
                stmt.path.type != 'SubExpression' &&
                attributes.includes(stmt.path.path.original)) {

                switch (stmt.path.path.original) {
                    case 'server-stub':
                        this.addServerStub({ stmt });
                        break;
                    case 'style':
                        this.addCssDependency({ stmt });
                        break;
                    case 'script':
                        this.addJsDependency({ stmt });
                        break;
                }

                this.ast.body.shift();
            } else {
                break;
            }
        }

        // Add path to pre-compiled template
        this.jsDependencies.push(`/component-assets/${this.assetId}/template.min.js`);

        if (!this.resolver) {
            throw new Error(`Meta-attribute: ${attributes[0]} is required`);
        }
    }

    addServerStub({ stmt }) {

        const param = stmt.path.params[0];

        assert(param.type == 'PathExpression' || param.type == 'StringLiteral');

        this.resolver = new PathResolver({
            pluginName: this.pluginName,
            componentName: this.componentName,
            path: param.original
        });
    }

    addDependencyAsset({ stmt, type }) {

        const value = this.getHashValue({ stmt: stmt.path, key: 'href' });
        assert(value.type == 'PathExpression' || value.type == 'StringLiteral');

        const assetUrl = new URL(value.original);

        if (!assetUrl.hostname) {

            // This is relative path
            const pathName = assetUrl.pathname
                .replace(/^\//);

            const exp = new RegExp(`(\.min)?.${type}$`);

            if (pathName.match(exp)) {
                pathName.replace(exp, '');
            }

            let data =
                fs.readFileSync(
                    path.join(this.srcDir, pathName),
                    'utf8'
                );

            data = this.minifyAsset({ data, type })

            const assetPath = this.getDistPath();
            const fileName = `${utils.generateRandomString()}.min.${type}`;

            fs.writeFileSync(
                `${assetPath}/${fileName}`, data);

            assetUrl = `/component-assets/${this.assetId}/${fileName}`;
        }

        this[`${type}Dependencies`].push(assetUrl);
    }

    minifyAsset({ data, type }) {

        switch (type) {
            case 'css':
                return csso.minify(data, {
                    restructure: false,
                });

            case 'js':
                const js = UglifyJS.minify(data);
                if (js.error) {
                    throw new Error(js.error);
                }
                return js.code;
        }
    }

    addJsDependency({ stmt }) {
        this.addDependencyAsset({ stmt, type: 'js' });
    }

    addCssDependency({ stmt }) {
        this.addDependencyAsset({ stmt, type: 'css' });
    }

    serializeAst() {

        let fields = {};

        if (this.component) {
            for (const k of Object.getOwnPropertyNames(this.component)
                .filter(prop => prop != 'id')) {
                fields[k] = this.component[k];
            }
        }

        this.componentScript = escodegen.generate(this.componentAst);
        this.component = this.getComponent();

        for (const k in fields) {
            this.component[k] = fields[k];
        }
    }

    emitAssetId() {
        this.wrapExpressionAsMethod({
            name: 'assetId',
            returnExpression: this.getScalarValue(this.assetId)
        });
    }

    emitHelpers() {
        this.emitMethodReturningArray({ name: 'helpers' });
    }

    emitDataPaths() {
        this.emitMethodReturningArray({ name: 'dataPaths' });
    }

    emitDependencies() {
        this.emitMethodReturningArray({ name: 'cssDependencies' });
        this.emitMethodReturningArray({ name: 'jsDependencies' });
    }

    emitMethodReturningArray({ name, value }) {
        assert(value.constructor.name == 'Array');
        this.wrapExpressionAsMethod({
            name,
            returnExpression: {
                type: 'ArrayExpression',
                elements: [...new Set(value ? value : this[name])]
                    .map(this.getValue, this),
            }
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
            synthethicMethodPrefix,
            customBlockPrefix,
            literalPrefix
        } = TemplatePreprocessor;

        // Todo: Check if path === helpers, and fail
        if (
            path.includes('_$')
            ||
            path.includes('_@')
            ||
            path.includes(pathSeparator)
            ||
            path.startsWith(`${dataPathRoot}${pathSeparator}`)
            ||
            path.startsWith(`${dataPathRoot}.`)
            ||
            path.startsWith(synthethicMethodPrefix)
            ||
            path.startsWith(customBlockPrefix)
            ||
            path.startsWith(literalPrefix)
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

    // Todo: verify that this will be processes properly: {{#each [people]}}
    getPathOffset({ original, contextList }) {

        if (original.match(/\.$/)) {
            original.replace(/\.$/, './');
        }

        const prev = original;

        let index = contextList.length - 1;
        let hasOffset = false

        let arr = original.split(/(\.?\.\/){1}/);

        const isDataVariable = original.startsWith('@');

        if (arr.length > 1) {

            hasOffset = true;

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


        if (original.startsWith('@')) {
            // Validate data variable format
            if (
                // wrong: ../@root, correct: @root
                (original == '@root' && arr.length) ||
                // wrong: ../@key, correct: @../key
                !isDataVariable ||
                // wrong: @xyz, correct @index
                !this.getHandleBarsDataVariables().includes(original)
            ) {
                throw new Error(`Unknown data variable: ${prev}`);
            }
        }

        return {
            path: original,
            index,
            hasOffset
        }
    }

    /**
     * 
     * expectedTypes: The passed in expectedTypes should an array of strings containing any of:
     * 'Array', 'Object' or 'Literal'. An empty array means we only check that the
     * value is not undefined
     */
    resolvePathFromContext({
        stmt,
        contextList, contextIndex, hasOffset,
        original, validTypes = [],
        syntheticAlias, scopeQualifier }) {

        const prevOriginal = original;
        const { rootQualifier, pathSeparator: separator } = TemplatePreprocessor;

        let checkType = true;
        let targetType;
        let type;

        let synthetic = false;

        const contextObjects = [];

        // i.e. {{xyx}}, not {{./xyz}} or {{../xyz}}
        const isPurePath = contextIndex == contextList.length - 1 && !hasOffset;

        if (isPurePath) {
            for (let j = contextList.length - 1; j >= 0; j--) {
                contextObjects.push(contextList[j]);
            }
        } else {
            contextObjects.push(contextList[contextIndex]);
        }

        if (isPurePath) {
            assert(original.length);

            for (const contextObject of contextObjects) {

                const contextKeys = Object.keys(contextObject);
                contextKeys.splice(contextKeys.indexOf(rootQualifier), 1);

                for (let i = 0; i < contextKeys.length; i++) {

                    const k = contextKeys[i];
                    const v = contextObject[k];

                    if (
                        this.hasObjectPrefix({
                            value: original,
                            key: k,
                            rangeAllowed: !!v.lookup
                        })
                    ) {

                        if (!contextObject[rootQualifier]) {
                            assert(Object.keys(v).equals(['lookup']));
                            return { terminate: true };
                        }

                        type = v.type;

                        if (type.endsWith('Literal')) {

                            assert(k == original && v.lookup == false);

                            original = v.value;
                            checkType = false;

                        } else {

                            if (v.synthetic) {

                                if (!v.lookup) {

                                    checkType = false;

                                    if (syntheticAlias) {
                                        throw new Error(`Path: ${k} cannot be used in a context switching context`);
                                    }
                                }

                                if (k != original || syntheticAlias) {
                                    let suffix = false;

                                    if (k != original) {
                                        const arr = original.split('.')
                                        arr.splice(0, 1)
                                        suffix = arr.join('.');
                                    }

                                    original = this.createDataPathIndirection({
                                        stmt, // I don't think passing stmt here, really makes any difference
                                        path: v.value,
                                        useProxy: true,
                                        suffix,
                                        syntheticAlias
                                    });
                                } else {
                                    original = v.value;
                                }

                                synthetic = true;

                            } else {

                                original = this.trimObjectPath({
                                    value: original,
                                    key: k,
                                    repl: v.value,
                                })
                                    .split('.').join(separator);
                            }
                        }

                        break;
                    }
                }
            }
        }

        if (!type) {

            const contextObject = contextList[contextIndex];

            if (!contextObject[rootQualifier]) {
                assert(
                    contextObject[Object.keys(contextObject)[0]]
                        .equals(['lookup'])
                );
                return { terminate: true };
            }

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

        if (checkType) {

            let value;

            if (synthetic) {

                value = this.getSyntheticMethodValue({
                    path: prevOriginal,
                    method: original, validTypes
                });

            } else {

                let typeSuffix = false;

                if (this.hasDataPathFormat(original) && validTypes.length) {

                    // Append the expected type, inorder to hint our
                    // resolver of what value to return for this path
                    // i.e. Object or Array

                    typeSuffix = scopeQualifier ?
                        `_(${validTypes[0]}
                        /${scopeQualifier})`
                        :
                        '_(*)'

                    original += typeSuffix;
                }

                value = this.lookupDataPath({
                    fqPath: original,
                    validTypes,
                });

                if (typeSuffix) {
                    original = original.replace(typeSuffix, '');
                }
            }

            targetType = value != null ? value.constructor.name : null;
        }

        return {
            original,
            type,
            targetType,
            synthetic
        }
    }

    // Todo: Add support for delimiting paths with "/" as well, in addition to .
    // The above is deprecated in hbs, so it's not important
    resolvePath({
        bindParents, stmt, contextList, value, validTypes = [],
        syntheticAlias, scopeQualifier
    }) {

        const { inlineParameterPrefix } = TemplatePreprocessor;

        if (
            stmt != null
            && (inlineBlock = this.getOuterInlineBlock({ bindParents })) != null
            && stmt.original.startsWith(inlineParameterPrefix)
        ) {
            stmt.original = stmt.original.replace(/^_/, '');
            stmt.parts = stmt.original.split('.');

            inlineBlock.requiredParams || (inlineBlock.requiredParams = [])
                .push(stmt.parts[0]);

            console.log(`Adding inline parameter '${stmt.parts[0]}' for inline block: ${inlineBlock.params[0].original}`);

            return {
                // Indicate that the ast caller should not process
                // this path, as it is an inline parameter.
                terminate: true
            };
        }

        let { type, original } = value;
        let synthetic;
        let targetType;
        let terminate;

        if (type == 'PathExpression') {

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
            const { index, hasOffset } = offset;
            original = offset.path;

            original = this.component.processLiteralSegment({ original });

            const resolvedPath = this.resolvePathFromContext({
                bindParents, stmt, contextList,
                contextIndex: index, hasOffset,
                original, validTypes,
                syntheticAlias, scopeQualifier
            });

            type = resolvedPath.type;
            original = resolvedPath.original;
            targetType = resolvedPath.targetType;
            synthetic = resolvedPath.synthetic;
            terminate = resolvedPath.terminate || false;
        }

        if (type.endsWith('Literal')) {

            if (validTypes.length > 0 && !validTypes.includes('Literal')) {
                throw new Error(`Path: ${original} cannot resolve to the Literal value`);
            }
        }

        return {
            type,
            original,
            targetType,
            synthetic,
            terminate
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

    getShorthandObjectValue(identifiers) {
        return {
            type: 'ObjectExpression',
            properties: identifiers.map(identifier => {
                return {
                    type: 'Property',
                    key: {
                        type: 'Identifier',
                        name: identifier
                    },
                    computed: false,
                    value: {
                        type: 'Identifier',
                        name: identifier
                    },
                    kind: 'init',
                    method: false,
                    shorthand: true
                };
            })
        };
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

    getCallExpression({ target, computed = false, literal = false, methodName, args }) {

        const init = {
            type: 'CallExpression',
            callee: {
                type: 'MemberExpression',
                computed,
                object: target ? {
                    type: 'Identifier',
                    name: target
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

        const init = this.getCallExpression({ target: classTarget, methodName, args });

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

        if (contextList && contextList.length > 1) {

            const { rootQualifier } = TemplatePreprocessor;

            const parent = contextList.peek();
            [rootQualifier].value;

            const parentCtx = this.getCallExpression({
                methodName: 'resolvePath',
                args: [{ fqPath: `${this.trimDataPath(parent)}` }]
                    .map(this.getValue, this)
            });

            args.push(parentCtx);
        }

        return this.getCallExpression({
            methodName,
            args
        });
    }

    createMemberExpression({ property }) {
        return {
            type: "MemberExpression",
            computed: false,
            object: {
                type: "ThisExpression"
            },
            property
        }
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
        pruneKey,
        bindParents,
        contextList,
        context,
        stmt, method, params = [], hash = {},
        syntheticAlias
    }) {

        if (!pruneKey) {
            assert(context == null);
            pruneKey = utils.generateRandomString();
        }

        const { syntheticMethodPrefix, literalPrefix } = TemplatePreprocessor;

        // Add hash to paramList
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
                            callee: this.createMemberExpression({
                                property: {
                                    type: "Identifier",
                                    name: method
                                }
                            })
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
                            pruneKey,
                            bindParents,
                            contextList,
                            variableName: name, hash: param.original
                        })

                    if (!statement) {
                        return false;
                    }

                    break;

                case param.type == 'PathExpression':

                    if (param.processed) {

                        assert(this.isRootCtxValue(param.original));

                        // Param was already processed, in an inline block
                        statement = this.getVariableEnvelope(name);
                        statement.declarations[0].init = {
                            type: 'CallExpression',
                            callee: this.getProxyStatement({
                                path: this.trimDataPath(param.original)
                            })
                        }
                        continue;

                    } else if (param.original.startsWith(literalPrefix)) {

                        statement = this
                            .getScalarConstantAssignmentStatement(
                                name, param.original.replace(literalPrefix, '')
                            );
                        continue;
                    }

                    let _path;

                    if (this.methodNames.includes(param.original)) {

                        _path = syntheticMethodPrefix + param.original;

                        // The declared path expression is a method in
                        // in the component class, hence invoke function

                        statement = this.getVariableEnvelope(name);

                        statement.declarations[0].init = this.createInvocationWithContext({
                            contextList,
                            methodName: param.original
                        });

                    } else {

                        const path = this.resolvePath({
                            bindParents,
                            stmt: param,
                            contextList,
                            value: param,
                        });

                        if (path.terminate) {
                            return false;
                        }


                        // TODO: Instead of doing this, use this.proxy[...]
                        if (!path.synthetic) {

                            if (path.type.endsWith('Literal')) {
                                _path = literalPrefix + path.original;
                                statement = this
                                    .getScalarConstantAssignmentStatement(name, path.original);
                            } else {

                                assert(path.type == 'PathExpression');

                                _path = path.original;
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
                            _path = path.original;
                            statement = this.getCallExpression({
                                methodName: 'getSyntheticMethod',
                                args: [path.original]
                                    .map(this.getValue, this)

                            });
                        }
                    }

                    // update param
                    this.resetPathExpression({
                        stmt: param,
                        original: _path,
                        properties: { processed: true }
                    });

                    break;

                case param.type == 'SubExpression':

                    const method = param.path.original;
                    this.validateMethod(method);

                    statement = this.getVariableEnvelope(name);
                    statement.declarations[0].init = {
                        type: 'CallExpression',
                        arguments: []
                    };

                    const b = this.addParameterizedExpression({
                        pruneKey,
                        bindParents,
                        contextList,
                        context: statement.declarations[0].init,
                        method,
                        params: param.params,
                        hash: param.hash
                    });

                    if (!b) {
                        return false;
                    }

                    // provisionally, add the generated function to component class ast
                    this.componentAst.body[0].body.body
                        .push(this.getMethodFromFunctionDeclaration(
                            this.getFunctionDeclarationFromArrowFunction({
                                ast: statement.declarations[0].init.callee,
                                name: pruneKey + utils.generateRandomString()
                            })
                        ));

                    // update param
                    this.resetPathExpression({
                        stmt: param,
                        original: statement.declarations[0].init.callee.id.name,
                        properties: { processed: true }
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
                const stmt = body.peek();
                stmt.argument = this.getCallExpression({
                    methodName: 'setSyntheticContext',
                    args: [{
                        alias: syntheticAlias,
                        value: stmt.argument
                    }]
                        .map(this.getValue, this)

                });
            }

            // Prune ast
            this.pruneComponentAst({ pruneKey });

            // Append method to ast
            this.componentAst.body[0].body.body
                .push(this.getMethodFromFunctionDeclaration({ ast }));

            const synthethicMethodName = ast.id.name;

            if (stmt) {
                // Update stmt, if available
                this.resetPathExpression({
                    stmt,
                    original: synthethicMethodName,
                    properties: { processed: true }
                });
            }

            return synthethicMethodName;
        }
    }

    /**
     * This creates a json assigment from a hash object
     */
    getJsonAssignmentStatement({ pruneKey, bindParents, contextList, variableName, hash }) {

        const { syntheticMethodPrefix, literalPrefix } = TemplatePreprocessor;

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

                    if (value.processed) {

                        assert(this.isRootCtxValue(value.original));

                        // Param was already processed, in an inline block
                        init.properties.push(
                            getProperty(key, {
                                type: 'CallExpression',
                                callee: this.getProxyStatement({
                                    path: this.trimDataPath(value.original)
                                })
                            })
                        );
                        continue;

                    } else if (value.original.startsWith(literalPrefix)) {

                        init.properties.push(getProperty(key, this.getScalarValue(
                            value.original.replace(literalPrefix, '')
                        )));
                        continue;
                    }

                    let _path;

                    if (this.methodNames.includes(value.original)) {

                        _path = syntheticMethodPrefix + value.original;

                        init.properties.push(getProperty(
                            key,
                            this.createInvocationWithContext({
                                contextList,
                                methodName: value.original
                            })
                        ));

                    } else {

                        const path = this.resolvePath({
                            bindParents,
                            stmt: value,
                            contextList,
                            value: value,
                        });

                        if (path.terminate) {
                            return false;
                        }

                        // TODO: Instead of doing this, use this.proxy[...]
                        if (!path.synthetic) {

                            if (path.type.endsWith('Literal')) {
                                _path = literalPrefix + path.original;
                                init.properties.push(getProperty(key, this.getScalarValue(path.original)));
                            } else {

                                assert(path.type == 'PathExpression');

                                _path = path.original;
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
                            _path = path.original;
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

                    // update param
                    this.resetPathExpression({
                        stmt: value,
                        original: _path,
                        properties: { processed: true }
                    });

                    break;

                case value.type == 'SubExpression':

                    const method = value.path.original;
                    this.validateMethod(method);

                    const property = getProperty(key, {
                        type: 'CallExpression',
                        arguments: []
                    });

                    const b = this.addParameterizedExpression({
                        pruneKey,
                        bindParents,
                        contextList,
                        context: property.value,
                        method,
                        params: value.params,
                        hash: value.hash
                    });

                    if (!b) {
                        return false;
                    }

                    init.properties.push(property);

                    // provisionally, add the generated function to component class ast
                    this.componentAst.body[0].body.body
                        .push(this.getMethodFromFunctionDeclaration(
                            this.getFunctionDeclarationFromArrowFunction({
                                ast: property.value.callee,
                                name: pruneKey + utils.generateRandomString()
                            })
                        ));

                    // update param
                    this.resetPathExpression({
                        stmt: value,
                        original: property.value.callee.id.name,
                        properties: { processed: true }
                    });

                    break;
            }
        }

        envelope.declarations[0].init = init;
        return envelope;
    }

    /**
     * Cleanup temporary methods that were added to the component
     * class ast to support inline parameters
     */
    pruneComponentAst({ pruneKey }) {
        const { syntheticMethodPrefix } = TemplatePreprocessor;
        const body = this.componentAst.body[0].body.body;

        for (let i = 0; i < body.length; i++) {
            if (body[i].key.name.startsWith(syntheticMethodPrefix + pruneKey)) {
                delete body[i];
            }
        }
    }

    getFunctionDeclarationFromArrowFunction({ ast, name }) {
        ast.type = 'FunctionDeclaration';
        ast.id = {
            type: "Identifier",
            name: name || utils.generateRandomString()
        };
        return ast;
    }

    resetPathExpression({ stmt, original, properties = {} }) {
        stmt.clear();

        stmt.type = 'PathExpression'
        stmt.original = original;
        stmt.parts = original.split('.');
        stmt.depth = 0;
        stmt.data = false;

        for (const k in properties) {
            stmt[k] = properties[k];
        }

        return stmt;
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

    trimDataPath(path, isRoot) {
        const { dataPathRoot, pathSeparator } = TemplatePreprocessor;
        const p = path.replace(new RegExp(`^${dataPathRoot}${pathSeparator}`), '');

        if (isRoot) {
            p = `${dataPathRoot}.${p}`;
        }
        return p;
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

    createSubExpression({
        bindParents, contextList, method, params = [],
        hash = [], syntheticAlias, stmt }) {

        // Process sub-expression
        // Todo: Here, the context is not passed in as last parameter

        this.validateMethod(method);

        const synthethicMethodName = this.addParameterizedExpression({
            bindParents,
            contextList,
            method, stmt,
            params, hash,
            syntheticAlias
        });

        if (!synthethicMethodName) {
            return false;
        }

        this.helpers.push(synthethicMethodName);

        return synthethicMethodName;
    }

    createSubExpressionFromPath({ stmt }) {
        const { original } = stmt;

        stmt.clear();

        stmt.type = 'SubExpression';
        stmt.path = this.createPathExpression({ original });
        stmt.params = [];
        stmt.fromPath = true;

        return stmt;
    }

    createPathFromSubExpression({ stmt }) {
        assert(
            stmt.fromPath == true &&
            stmt.type == 'SubExpression'
        );
        return stmt.path;
    }

    createMethodInvocation({ contextList, path, name }) {

        // Add a synthethic method to the ast that indirects
        // the invocation call, setting the context as argument

        const synthethicMethodName = this.wrapExpressionAsMethod({
            name,
            returnExpression: this
                .createInvocationWithContext({
                    contextList,
                    methodName: path.original
                })
        });

        this.helpers.push(synthethicMethodName);

        path.parts = [synthethicMethodName];
        path.original = synthethicMethodName;

        return stmt;
    }

    getEmptyPathExpression({ stmt } = {}) {
        const original = '@root.emptyString';
        return stmt ?
            this.resetPathExpression({
                stmt, original
            })
            : this.createPathExpression({
                original
            });
    }

    createPathExpression({ original }) {
        return {
            type: 'PathExpression',
            data: false,
            depth: 0,
            parts: [...original.split('.')],
            original,
        }
    }

    createMustacheStatement({ original }) {
        return {
            type: 'MustacheStatement',
            path: this.createPathExpression({ original }),
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

    getProxyStatement({ path, useProxy = true }) {
        const { customBlockPrefix } = TemplatePreprocessor;
        return {
            type: "MemberExpression",
            computed: true,
            object: this.createMemberExpression({
                property: {
                    type: "Identifier",
                    name: "proxy",
                }
            }),
            property: this.getScalarValue(
                `${!useProxy ? customBlockPrefix : ''}${path}`
            ),
        };
    }

    /**
     * Add a helper method that resolves the path using the
     * component's proxy instance
     * 
     * @param useProxy This specifies whether the result should be proxied as well
     */
    // Todo: The resulting function should be invokes on compile-time, 
    // so the path can be resolved
    createDataPathIndirection({ stmt, path, useProxy = true, suffix = false, syntheticAlias }) {

        const { synthethicMethodPrefix, customBlockPrefix } = TemplatePreprocessor;

        let synthethicMethodName = suffix ? null : `${this.hasDataPathFormat(path) ? synthethicMethodPrefix : ''}${path}`;

        if (suffix || !this.helpers.includes(synthethicMethodName)) {

            let expression = {
                type: "MemberExpression",
                computed: true,
                object: this.createMemberExpression({
                    property: {
                        type: "Identifier",
                        "name": "proxy",
                    }
                }),
                property: this.getScalarValue(
                    `${!useProxy ? customBlockPrefix : ''}${this.trimDataPath(path)}`
                ),
            };

            if (suffix) {

                synthethicMethodName = this.appendDataPathLiteralSegment({
                    expression,
                    literalSegment: suffix,
                    syntheticAlias
                });

            } else {

                if (syntheticAlias) {
                    expression = this.getCallExpression({
                        methodName: 'setSyntheticContext',
                        args: [{
                            alias: syntheticAlias,
                            value: expression
                        }]
                            .map(this.getValue, this)
                    });
                }

                synthethicMethodName = this.wrapExpressionAsMethod({
                    name: path,
                    returnExpression: {
                        type: "ExpressionStatement",
                        expression
                    }
                });
            }

            this.helpers.push(synthethicMethodName);
        }

        // stmt.parts = [synthethicMethodName];
        stmt.original = synthethicMethodName;

        this.createSubExpressionFromPath({ stmt });

        return synthethicMethodName;
    }

    appendDataPathLiteralSegment({
        expression, literalSegment, syntheticAlias
    }) {

        const ast = {
            type: 'FunctionDeclaration',
            id: {
                type: "Identifier",
                name: utils.generateRandomString()
            },
            params: [],
            body: {
                type: "BlockStatement",
                body: [
                    {
                        type: "VariableDeclaration",
                        declarations: [
                            {
                                type: "VariableDeclarator",
                                id: {
                                    type: "Identifier",
                                    name: "first",
                                },
                                init: expression,
                            }
                        ],
                        kind: "const",
                    },
                    {
                        type: "VariableDeclaration",
                        declarations: [
                            {
                                type: "VariableDeclarator",
                                id: {
                                    type: "Identifier",
                                    name: "value",
                                },
                                init: this.getCallExpression({
                                    methodName: 'processLiteralSegment',
                                    args: [
                                        {
                                            type: "Literal",
                                            value: `first.${literalSegment}`,
                                            raw: `'first.${literalSegment}'`,
                                        }
                                    ]
                                }),
                            }
                        ],
                        kind: "const",
                    },
                    {
                        type: "ReturnStatement",
                        argument: {
                            type: "CallExpression",
                            callee: {
                                type: "Identifier",
                                name: "eval"
                            },
                            arguments: [
                                {
                                    type: "Identifier",
                                    name: "value"
                                }
                            ]
                        }
                    }
                ]
            },
            generator: false,
            expression: false,
            async: false
        };

        if (syntheticAlias) {
            const body = ast.body.body;
            const stmt = body.peek();
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

    getBlockParam(stmt, index) {
        const { blockParams } = stmt.program;
        const qualifier = blockParams && blockParams.length > index
            ? blockParams[index] : null;

        if (qualifier && this.methodNames.includes(qualifier)
        ) {
            throw new Error(
                `The qualifier: '${qualifier}' already exists as a named method`
            );
        }

        if (this.getReservedQualifierNames().includes(qualifier)) {
            throw new Error(
                `The qualifier: '${qualifier}' is an internal qualifer and is not allowed`
            );
        }

        return qualifier;
    };

    getBlockQualifiers({ stmt }) {

        const scopeQualifier = this.getBlockParam(stmt, 0);
        const indexQualifier = this.getBlockParam(stmt, 1);

        return {
            scopeQualifier,
            indexQualifier
        };
    }

    validateCustomBlock({ stmt }) {

        assert(!stmt.program.inverse);

        // Ensure that the path is a valid component method
        this.validateMethod(stmt.path.original);

        if (stmt.program.blockParams != 1) {
            throw new Error(`Please provide one block parameter for block: ${stmt.path.original}`);
        }

        if (stmt.hash.pairs.filter(pair => pair.key == blockParamHashKey).length) {
            throw new Error(`Hashkey '${rootQualifier}' is not allowed`);
        }
    }

    updateCustomBlockHeaders({ stmt }) {

        const { blockParamHashKey } = TemplatePreprocessor;

        this.validateCustomBlock({ stmt });

        const { scopeQualifier } = this.getBlockQualifiers({ stmt });

        // Add blockParam hash
        const hash = stmt.hash || (stmt.hash = { pairs: [] });
        hash.pairs.push({
            key: blockParamHashKey,
            value: {
                type: 'StringLiteral',
                original: scopeQualifier
            }
        });
        delete stmt.program.blockParams;

        // Rewrite custom block path
        stmt.path = this.createPathExpression({
            original: this.createCustomBlockPath({
                methodName: stmt.path.original
            })
        });

        return scopeQualifier;
    }

    getHashValue({ stmt, key, cleanup = false }) {
        if (stmt.hash) {
            const pairs = stmt.hash.pairs;
            for (let i = 0; i < pairs.length; i++) {
                const pair = pairs[i];
                if (pair.key == key) {
                    if (cleanup) {
                        delete pairs[i];
                    }
                    return pair.value;
                }
            }
        }
        return null;
    }

    createCustomBlockPath({
        methodName
    }) {
        const ast = {
            type: 'FunctionDeclaration',
            id: {
                type: "Identifier",
                name: utils.generateRandomString()
            }, params: [], body: {
                type: "BlockStatement",
                body: [{
                    type: 'VariableDeclaration',
                    declarations: [
                        {
                            type: 'VariableDeclarator',
                            id: { type: 'Identifier', name: 'params' },
                            init: this.getCallExpression({
                                target: 'Array',
                                methodName: 'from',
                                args: [{ type: 'Identifier', name: 'arguments' }]
                            })
                        }],
                    kind: 'const'
                },
                {
                    type: 'VariableDeclaration',
                    declarations: [
                        {
                            type: 'VariableDeclarator',
                            id: { type: 'Identifier', name: 'options' },
                            init: this.getCallExpression({
                                target: 'params',
                                methodName: 'pop',
                            })
                        }],
                    kind: 'const'
                },
                {
                    type: 'VariableDeclaration',
                    declarations: [
                        {
                            type: 'VariableDeclarator',
                            id: {
                                type: 'Identifier',
                                name: 'methodName',
                            },
                            init: {
                                type: 'Literal',
                                value: methodName,
                                raw: `'${methodName}'`,
                            },
                        }
                    ],
                    kind: 'const',
                },
                {
                    type: 'VariableDeclaration',
                    declarations: [
                        {
                            type: 'VariableDeclarator',
                            id: { type: 'Identifier', name: 'data' },
                            init: this.getCallExpression({
                                computed: true,
                                methodName: 'methodName',
                                args: [{
                                    type: 'SpreadElement',
                                    argument: {
                                        type: 'Identifier',
                                        name: 'params'
                                    }
                                }],
                            })
                        }
                    ],
                    kind: 'const'
                },
                {
                    type: 'ReturnStatement',
                    argument: this.getCallExpression({
                        methodName: 'renderBlock',
                        args: [this.getShorthandObjectValue(['methodName', 'data', 'options'])]
                    })
                }]
            },
            generator: false,
            expression: false,
            async: false
        };

        this.componentAst.body[0].body.body
            .push(this.getMethodFromFunctionDeclaration({ ast }));

        this.helpers.push(ast.id.name);

        return ast.id.name;
    }

    getBlockOptions(stmt) {

        const { scopeQualifier, indexQualifier } = this.getBlockQualifiers({ stmt });

        let validTypes = [];
        let contextSwitching = false;
        let replacementPath = null;
        let canIterate = false;
        let conditional = false;
        let custom = false;
        let requiresScopeQualifier = true;

        switch (stmt.path.original) {
            case 'unless':
            case 'if':
                validTypes = ['Literal', 'Array', 'Object'];
                conditional = true;
                requiresScopeQualifier = false;
                break;

            case 'each':
                validTypes = [indexQualifier ? 'Array' : 'Object'];
                contextSwitching = true;
                canIterate = true;

                break;

            case 'with':
                validTypes = ['Object'];
                contextSwitching = true;
                replacementPath = 'if';
                // Set this as a conditional, since it will
                // be transformed to an if
                conditional = true;

                break;
            default:
                custom = true;

                if (!stmt.params.length) {
                    stmt.params = [{
                        depth: 0,
                        data: false,
                        type: 'PathExpression',
                        original: 'this',
                        parts: ['this']
                    }]
                }

                break;
        }

        if (!custom) {

            // hbs allows hashes on well-knonw blocks by default
            // however, these hashes are not referenceable from
            // inside the block, hence we want to explicitly reject hashes
            this.ensureNoHash({ stmt });

            // Block params are no longer useful at this point
            delete stmt.program.blockParams;
        }

        if (requiresScopeQualifier && !scopeQualifier) {
            // This is either an #with or #each block
            throw new Error(`Scope qualifier must be specified on line: ${this.getLine(stmt)}`);
        }


        if (contextSwitching
            && stmt.params[0].type.endsWith('Literal')) {
            throw new Error(`A literal parameter cannot be used on line: ${this.getLine(stmt)}`);
        }

        return {
            validTypes,
            contextSwitching,
            scopeQualifier,
            indexQualifier,
            canIterate,
            replacementPath,
            conditional,
            custom
        };
    }

    ensureNoHash({ stmt }) {
        const { hash } = stmt;
        if (hash && hash.pairs && hash.pairs.length) {
            throw new Error(`Hashes are not allowed for a #${stmt.path.original} block`);
        }
    }

    getSyntheticMethodValue({ path, method, validTypes = [] }) {
        // Allow hbs engine to attempt to resolve this synthetic method
        this.dataPaths.push(method);

        // we need to serialize, so we can invoke the method 
        // to get it's returned type (for validation purpose)

        this.serializeAst();

        const value = this.component[method]();

        // Remove from dataPaths. Note, that it will be re-added
        // later, after any necessary transformation has been done.
        // e.g. if it's a custom block param - after
        // customBlockPrefix has been prepended
        const i = this.dataPaths.indexOf(method);
        this.dataPaths.splice(i, 1);

        return this.component.validateType({
            path,
            value, validTypes
        });
    }

    isRootCtxValue(value) {
        const { synthethicMethodPrefix } = TemplatePreprocessor;
        return this.hasDataPathFormat(value) || value.startsWith(synthethicMethodPrefix);
    }

    /**
     * This is called when resolving params in the root context. It 
     * ensures that any available inline parameters appear at the end of the list
     */
    ensureParamsOrder({ params, bindParents }) {

        if (this.getOuterInlineBlock({ bindParents }) == null) {
            // Inline parameters must be in an inline block
            return false;
        }

        const { inlineParameterPrefix } = TemplatePreprocessor;
        let allowNonInline = true;

        for (const param of params) {
            switch (true) {
                case param.type.endsWith('Literal'):
                    break;

                case param.type == 'PathExpression':
                    if (param.original.startsWith(inlineParameterPrefix)) {
                        allowNonInline = false;
                    } else if (!allowNonInline) {
                        throw new Error(`The param: ${param.original} is in an invalid position, line: ${this.getLine(param)}`);
                    }
                    break;

                case param.type == 'SubExpression':
                    this.ensureParamsOrder({ params: param.params, bindParents });
                    break;
            }
        }

        return !allowNonInline;
    }

    process0({
        contextList,
        bindParents,
        ast,
    }) {

        // Validate all PathExpressions
        this.visitNodes({
            types: ['PathExpression'],
            ast,
            consumer: ({ stmt }) => {
                this.validatePath(stmt.original);
                assert(!this.isRootCtxValue(stmt.original));
            }
        });

        const {
            rootQualifier, synthethicMethodPrefix,
            allowRootAccessHashKey, blockParamHashKey,
            futilizeInvalidRootAccess, allowRootAccessByDefault
        } = TemplatePreprocessor;

        let customBlockCtx = [{
            value: false,
        }];

        const _this = this;

        const replacements = [];

        const Visitor = handlebars.Visitor;

        function ASTParser() {
        }
        ASTParser.prototype = new Visitor();

        const isCustomContext = () => {
            return this.customBlockCtx || customBlockCtx.peek().value;
        }

        const allowRootAccess = () => {
            return this.allowRootAccess || customBlockCtx.peek().allowRootAccess;
        }

        const isPathUnconstrained = ({ stmt }) => {
            // Check context keys both in the outer root context, as well
            // as those that may have been added through partial hashes
            for (const contextObj of contextList) {
                if (Object.keys(contextObj).includes(stmt.original.split('.')[0])) {
                    return false;
                }
            }
            return true;
        }

        const getQualifiers = ({ stmt }) => {
            const qualifiers = [];

            const { scopeQualifier, indexQualifier } =
                _this.getBlockQualifiers({ stmt });

            if (scopeQualifier) {
                qualifiers.push(scopeQualifier);
            }
            if (indexQualifier) {
                qualifiers.push(indexQualifier);
            }

            return qualifiers;
        }

        const acceptPathExpressionInCustomCtx = ({ stmt }) => {

            const prev = stmt.original;

            if (
                // This is a method that has already been added as an helper
                // by this method
                this.helpers.includes(`${synthethicMethodPrefix}${prev}`) ||

                // Due to the manner that inline partials are processed, we
                // may traverse the same ast more than once. Also, for root-ccontext
                // based inline blocks referenced from a custom context, the paths
                // are transformed to helpers
                this.isRootCtxValue(prev)
            ) {
                return stmt;
            }

            if (this.methodNames.includes(prev)) {

                if (isPathUnconstrained({ stmt })) {

                    // create method invocation indirection
                    this.createMethodInvocation({
                        contextList, path: stmt,
                        name: stmt.original
                    });

                    return this.createSubExpressionFromPath({
                        stmt
                    });

                } else {
                    console.warn(`The path: ${prev} is constrained and cannot be registered as a helper`);
                }
            }

            const offset = this.getPathOffset({
                original: stmt.original,
                contextList
            });
            const { index, path: original, hasOffset } = offset;

            const contextObjects = [];

            // i.e. {{xyx}}, not {{./xyz}} or {{../xyz}}
            const isPurePath = index == contextList.length - 1 && !hasOffset;

            if (isPurePath) {
                for (let j = contextList.length - 1; j >= 0; j--) {
                    contextObjects.push(contextList[j]);
                }
            } else {
                contextObjects.push(contextList[index]);
            }

            if (isPurePath) {
                assert(original.length);

                for (const contextObject of contextObjects) {

                    const contextKeys = Object.keys(contextObject);
                    contextKeys.splice(contextKeys.indexOf(rootQualifier), 1);

                    for (const k of contextKeys) {
                        const v = contextObject[k];

                        if (this.hasObjectPrefix({
                                value: original,
                                key: k,
                                rangeAllowed: !!v.lookup,
                            })
                        ) {

                            if (!contextObject[rootQualifier]) {
                                assert(
                                    // The referenced context either exists in the custom context or
                                    !Object.keys(v).length)
                                     // is a pending block in the root context
                                    || Object.keys(v).equals(['lookup'])
                                    
                                return stmt;
                            }

                            Add support for PathMeshExpression

                            if (!allowRootAccess()) {
                                    const msg = `Root access is not permitted for path: ${k}`;
                                    if (futilizeInvalidRootAccess) {
                                        throw new Error(msg);
                                    } else {
                                        console.warn(msg);
                                        return this.getEmptyPathExpression({ stmt });
                                    }
                            }

                            if (v.type.endsWith('Literal')) {

                                assert(k == original && v.lookup == false);

                                stmt = {
                                    ...stmt,
                                    type: v.type,
                                    original: v.value,
                                    parts: [v.value]
                                };

                            } else {

                                let suffix = false;

                                if (k != original) {
                                    const arr = original.split('.')
                                    arr.splice(0, 1)
                                    suffix = arr.join('.');
                                }

                                this.createDataPathIndirection({
                                    stmt,
                                    path: v.value,
                                    useProxy: false,
                                    suffix,
                                });
                            }


                            return stmt;
                        }
                    }

                }
            }

            const contextObject = contextList[index];

            if (contextObject[rootQualifier]) {

                assert(index < contextList.length - 1);

                if (!allowRootAccess()) {
                    const msg = `Root access is not permitted for path: ${k}`;
                    if (futilizeInvalidRootAccess) {
                        throw new Error(msg);
                    } else {
                        console.warn(msg);
                        return this.getEmptyPathExpression();
                    }
                }

                this.createDataPathIndirection({
                    stmt,
                    path: contextObject[rootQualifier],
                    useProxy: false,
                    suffix: original,
                });
            
            }

            return stmt;
        }

        const acceptPathExpressionInRootCtx = ({ stmt }) => {

            if (stmt.processed) {
                return stmt;
            }

            let { type, original } = stmt;

            let synthetic, lookup = false;

            if (this.methodNames.includes(original)) {

                original = this.createSubExpression({
                    bindParents,
                    contextList,
                    method: original,
                    // Notice that we are not passing in stmt here
                    // becuase, it's not necessary, since we already
                    // calling resetPathExpression(...) below
                });
                synthetic = true;

                const value = this.getSyntheticMethodValue({
                    path: stmt.original,
                    method: original,
                });
                lookup = value !== null && typeof value === 'object'

            } else {

                const path = _this.resolvePath({
                    bindParents,
                    contextList,
                    stmt: stmt,
                    value: stmt,
                });

                if (path) {
                    type = path.type;
                    original = path.original;
                    synthetic = path.synthetic;
                    lookup = path.targetType !== null && value.constructor.name === 'Object';
                } else {
                    type = null;
                }
            }

            return type ? this.resetPathExpression({
                stmt, original, properties: {
                    type, synthetic, lookup, processed: true
                }
            }) : stmt;
        }

        ASTParser.prototype.PathExpression = function (stmt) {
            this.mutating = true;

            const fn = isCustomContext() ? acceptPathExpressionInCustomCtx :
                acceptPathExpressionInRootCtx;

            return fn({
                stmt
            });
        }

        ASTParser.prototype.SubExpression = function (stmt) {

            if (isCustomContext()) {

                _this.validateMethod(stmt.path.original);

                if (!isPathUnconstrained({ stmt: stmt.path })) {
                    throw new Error(`Path ${stmt.path.original} must be unconstrained`);
                }

                Visitor.prototype.SubExpression.call(this, stmt);

                this.mutating = true;

                stmt.path = _this.createPathFromSubExpression({
                    stmt: stmt.path
                });

            } else {

                const { original: prev } = stmt.path;

                _this.ensureParamsOrder({
                    bindParents, params: stmt.params || []
                });

                _this.createSubExpression({
                    bindParents,
                    contextList,
                    stmt,
                    method: stmt.path.original,
                    params: stmt.params || [],
                    hash: stmt.hash || [],
                });

                if (stmt.type == 'PathExpression') {
                    stmt.synthetic = true;
                    const value = _this.getSyntheticMethodValue({
                        path: prev,
                        method: stmt.original,
                    });
                    stmt.lookup = value !== null && typeof value === 'object'
                }
            }

            return stmt;
        }

        ASTParser.prototype.BlockStatement = function (stmt) {

            this.mutating = true;

            const addCustomBlockCtx = () => {

                const allowRootAccess = _this.getHashValue({
                    stmt, key: allowRootAccessHashKey, cleanup: true
                }) || { original: allowRootAccessByDefault };

                customBlockCtx.push({
                    value: true,
                    allowRootAccess: !!allowRootAccess.original,
                });

                const contextObj = {};
                contextObj[
                    _this.updateCustomBlockHeaders({ stmt })
                ] = {
                    lookup: true
                };
                contextList.push(contextObj);
            }

            if (isCustomContext()) {

                let popContextList = false;
                let popCustomBlockCtx = false;

                const qualifiers = getQualifiers({ stmt });

                // If this block is inside an inline block, update <blockQualifiers>
                if (inlineBlock = _this.getOuterInlineBlock({ bindParents })) {
                    let arr = inlineBlock.blockQualifiers || (inlineBlock.blockQualifiers = []);
                    arr = [
                        ...arr,
                        ...qualifiers
                    ];
                }

                this.acceptArray(stmt.params);

                if (!_this.getHandleBarsBlockHelpers().includes(stmt.path.original)) {

                    this.acceptKey(stmt, 'hash');

                    addCustomBlockCtx();

                    popCustomBlockCtx = true;
                    popContextList = true;

                } else {

                    _this.ensureNoHash({ stmt });

                    if (_this.getContextSwitchingHelpers().includes(stmt.path.original)) {
                        const contextObj = {};

                        contextObj[qualifiers[0]] = {
                            lookup: true
                        };

                        if (qualifiers[1]) {
                            contextObj[qualifiers[1]] = {
                                lookup: false
                            };
                        }

                        contextList.push(contextObj);
                        popContextList = true;
                    }
                }

                bindParents.push({ type: stmt.type, body: stmt.program.body });
                
                this.acceptKey(stmt, 'program');
        
                bindParents.pop();
                
                if (popContextList) {
                    contextList.pop();
                }

                if (popCustomBlockCtx) {
                    customBlockCtx.pop();
                }

                return stmt;

            } else {

                if (stmt.partialSkip || stmt.processed) {
                    return stmt;
                }

                const { rootQualifier, customBlockPrefix,
                    syntheticAliasSeparator,
                } = TemplatePreprocessor;

                const {
                    validTypes,
                    contextSwitching,
                    scopeQualifier,
                    indexQualifier,
                    canIterate,
                    replacementPath,
                    conditional,
                    custom
                } = _this.getBlockOptions(stmt);

                const resolvePathParam = ({ blockName, stmt }) => {

                    const isSynthetic =
                        stmt.type == 'SubExpression' ||
                        (stmt.type == 'PathExpression' && _this.methodNames.includes(stmt.original));

                    let path, syntheticAlias;

                    if (contextSwitching) {
                        // We need to construct the syntheticAlias to look 
                        // like a synthetic method, because it will
                        // be used as the root qualifier for subpaths
                        syntheticAlias = `${blockName}${syntheticAliasSeparator}${utils.generateRandomString()}`;
                    }

                    if (isSynthetic) {

                        const method = stmt.original || stmt.path.original;

                        path = {
                            type: 'PathExpression',
                            original: _this.createSubExpression({
                                bindParents,
                                contextList,
                                method,
                                params: stmt.params || [],
                                hash: stmt.hash || [],
                                syntheticAlias,
                                // Notice that we are not passing in stmt here
                                // becuase, it's not necessary, since we already
                                // setting stmt.processed = true below
                            })
                        }

                        if (path.original == false) {
                            return false;
                        }

                        // Notice that if this is a contextSwitching statement, 
                        // setSyntheticContext(..) is called
                        const value = _this.getSyntheticMethodValue({
                            path: method,
                            method: path.original,
                            validTypes
                        });

                        path.targetType = value.constructor.name;

                    } else {

                        path = _this.resolvePath({
                            bindParents,
                            stmt,
                            contextList,
                            value: stmt,
                            validTypes,
                            syntheticAlias,
                            scopeQualifier
                        });

                        if (path.terminate) {
                            return false;
                        }

                        isSynthetic = path.synthetic;
                    }

                    let { type, original, targetType } = path;

                    if (contextSwitching) {

                        // This check is necessary because it's possible for a 
                        // block to have a path expression as it's target, and it
                        // then resolves to a Literal. In this case, there is no
                        // way for hbs to know @ parse time

                        if (type != 'PathExpression') {
                            throw new Error(`A ${type} cannot be the target of the 
                                        ${blockName} block`
                            );
                        }
                    }

                    // Update stmt

                    if (type == 'PathExpression') {

                        original = _this.trimDataPath(
                            original, 
                            contextList.length == 1,
                        );

                        if (custom) {
                            // When processing param(s) of a custom block, we
                            // want to return the underlying object, rather than
                            // our proxy
                            const arr = original.split('.');
                            arr[arr.length - 1] = `${customBlockPrefix}${arr[1]}`
                            original = arr.join('.');
                        }

                        // Allow hbs engine to attempt to resolve this data path
                        _this.dataPaths.push(original);

                        _this.resetPathExpression({
                            stmt, original, properties: {
                                processed: true
                            }
                        });

                    } else {

                        assert(type.endsWith('Literal'));

                        stmt.clear();

                        stmt.type = type;
                        stmt.original = original;
                    }

                    return {
                        isSynthetic, syntheticAlias, type, original, targetType
                    }
                }

                const hasInlineParam = _this.ensureParamsOrder({
                    bindParents, params: stmt.params
                });

                let paths = [...stmt.params];

                if (custom) {
                    // Add hash values, if present
                    const { hash } = stmt;
                    if (hash) {
                        hash.pairs.forEach(pair => {
                            paths.push(pair.value);
                        });
                    }
                }

                // Removed already processed params
                paths = paths.filter(path => path.processed == undefined);

                // Theer should be at least one unprocessed param
                assert(paths.length);

                paths = paths.filter(path => !path.type.endsWith('Literal'));

                let resolvedPath;

                for (const path of paths) {

                    resolvedPath = resolvePathParam({
                        blockName: stmt.path.original,
                        stmt: path
                    });

                    if (!resolvedPath) {
                        // As you can imagine, there are scenarios when a block
                        // may not itself declare any inline parameters as part of
                        // it's own parameter list, but becuase it reference a block
                        hasInlineParam = true;
                    }
                }

                if (hasInlineParam) {

                    // Add a provisional context object
                    const contextObject = {};
                    contextObject[scopeQualifier] = { lookup: true };

                    if (indexQualifier) {
                        contextObject[indexQualifier] = { lookup: false };
                    }

                    contextList.push(contextObject);
                    bindParents.push({ type: stmt.type, body: stmt.program.body });

                    this.acceptKey(stmt, 'program');

                    bindParents.pop();
                    contextList.pop();

                    return stmt;
                }

                const {
                    isSynthetic, syntheticAlias, type, original, targetType
                } = resolvedPath;

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

                        // At the top of the #each block, invoke doBlockInit(..)
                        replacements.push({
                            parent: parent.body,
                            replacementIndex: parent.body.indexOf(stmt),
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

                        // At the top of the #each body, doBlockUpdate(..)
                        stmt.program.body.unshift(
                            _this.createMustacheStatement({
                                original:
                                    _this.createIterateUpdate({
                                        path: syntheticAlias || original
                                    })
                            })
                        );

                        // Register context qualifiers, which in hbs
                        // is synonymous to data variables

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

                if (custom) {
                    addCustomBlockCtx();
                }

                bindParents.push({ type: stmt.type, body: stmt.program.body });

                this.acceptKey(stmt, 'program');

                bindParents.pop();

                if (custom) {
                    customBlockCtx.pop();
                    contextList.pop();
                }

                if (contextSwitching) {
                    contextList.pop();
                }

                if (replacementPath) {
                    stmt.path.original = replacementPath;
                    stmt.path.parts = [replacementPath];
                }

                if (conditional && type == 'PathExpression') {

                    // Note: the existing can either be data path or
                    // synthetic method, 
                    // i.e. analyzeCondition(...)

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

                stmt.processed = true;

                return canIterate ? false : stmt;
            }
        }

        ASTParser.prototype.MustacheStatement = function (stmt) {

            if (isCustomContext()) {

                Visitor.prototype.MustacheStatement.call(this, stmt);

                if (stmt.path.type == 'SubExpression') {

                    // By convention, mustache paths resolve to a PathExpression
                    // even though it's a reference to a helper.
                    stmt.path = _this.createPathFromSubExpression({ stmt: stmt.path });
                }

                this.mutating = true;
                return stmt;
            }

            if (
                stmt.partialSkip ||
                stmt.path.type.endsWith('Literal') ||
                stmt.path.processed ||
                // This is a synthetic method
                // It is likely that this was added by the BlockStatement function above
                // sequel to the _this.createIterateInit(...) invocation
                _this.helpers.includes(stmt.path.original)) {
                return;
            }

            this.acceptKey(stmt, 'path');

            let { processed, original, type } = stmt.path;

            if (processed) {

                assert(type == 'PathExpression');

                this.mutating = true;

                original = _this.trimDataPath(
                    original, 
                    contextList.length == 1,
                );
                _this.dataPaths.push(original);

                _this.resetPathExpression({ stmt: stmt.path, original });
            }

            return stmt;
        }

        const addParamsAsHashes = (stmt) => {

            const hash = stmt.hash || (stmt.hash = { type: 'Hash', pairs: [] });
            const { params } = stmt;

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
        }

        const getPartialContextList = ({ stmt, inline }) => {

            if (_this.getHashValue({ stmt, key: rootQualifier })) {
                throw new Error(`Root qualifier '${rootQualifier}' cannot be a hashpair key`);
            }

            const { hash } = stmt;

            const partialContextList = contextList.clone();

            // PartialStatements are not context switching nodes
            // hence, we don't create any new context, but rather update
            // the prior context
            const contextObject = partialContextList.peek();

            if (isCustomContext()) {

                const rootKeys = [];

                for (const pair of hash.pairs) {

                    const prev = `${pair.value.original}`;

                    // We want to process the hashpair value(s) that
                    // have root-based paths
                    if (!pair.value.type.endsWith('Literal')) {
                        this.acceptRequired(pair, 'value');
                    }

                    let qualifier;

                    const rootValue =
                        pair.value.type == 'SubExpression' &&
                        pair.value.fromPath == true;

                    if (rootValue) {

                        qualifier = {
                            type: 'PathExpression',
                            value: pair.value.path.original,
                            synthetic: true,
                        };
                        const value = _this.getSyntheticMethodValue({
                            path: prev,
                            method: qualifier.value,
                        });
                        qualifier.lookup = value !== null && typeof value === 'object'

                        rootKeys.push(pair.key);

                    } else {

                        const { type } = {};

                        Add support for PathMeshExpression

                        assert();

                            {

                            }

                        qualifer = {
                                Literal,
                                Pathxpression,
                                PathMeshExpression,
                                SubExpression
                            };
                    }

                    contextObject[pair.key] = qualifier;
                }

                // Remove hashpairs with a root-based value because it 
                // will no longer be used in there after it's value has 
                // being added to the contextObject
                hash.pairs = hash.pairs.filter(pair => !rootKeys.includes(pair.key));

            } else {

                if (partialContextList.length > 1 && !inline) {

                    // This is only needed, if and only if, this is an
                    // external partial because all references to @root
                    // has already been resolved within the context of the
                    // inline block

                    Figure @root out for custom ctx scenario

                    

                    const rootPath = _this.resolvePath({
                        // This is only attempting to resolve {{this}}, 
                        // inlined parameters are not supported
                        stmt: false,
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

                for (const pair of hash.pairs) {

                    if (contextObject[pair.key]) {
                        throw new Error(`The qualifier ${pair.key} already exists in the current context`);
                    }

                    if (!pair.value.type.endsWith('Literal')) {
                        this.acceptRequired(pair, 'value');

                        assert(
                            pair.value.type == 'PathExpression' &&
                            pair.value.processed == true
                        );
                    }
                    const { type, original, lookup = false, synthetic = false } = pair.value;

                    contextObject[pair.key] = { type, value: original, lookup, synthetic };
                }
            }

            return {
                ctxList: partialContextList
            };
        }

        const getPartialAst = ({ stmt }) => {

            if (stmt.name.type == 'SubExpression') {
                // Todo: ensure that this captures both
                //  {{#?>(..)}} and {{#?>lookup(..)}}
                throw new Error(`Dynamic partials are not supported, ${_this.getLine(stmt)}`);
            }

            const partialName = stmt.name.original;

            let inline = false;
            let ast;

            // First, check inline blocks in the scope
            const inlineBlocks = _this.getAvailableInlineBlocks({
                bindParents
            });
            for (const blockName in inlineBlocks) {
                if (blockName == partialName) {

                    const block = inlineBlocks[blockName].clone();

                    if (block.requiredParams) {
                        // This is possbible if the block is not a
                        // custom block

                        // Ensure that those params are avaiable
                        // on the hash array
                        const { hash = { type: 'Hash', pairs: [] } } = stmt;

                        block.requiredParams.forEach(param => {
                            if (!hash.pairs.filter(pair => pair.key == param).length) {
                                throw new Error(`The hash key: '${param}' is required to load inline block: ${blockName}`);
                            }
                        });
                    }

                    if (block.blockQualifiers) {

                        block.blockQualifiers.forEach(qualifier => {
                            if (hash.pairs.filter(pair => pair.key == qualifier).length) {
                                throw new Error(`The hash key: '${param}' is already a context qualifier in the inline block: ${blockName}`);
                            }
                        });
                    }

                    // Note for scenarios where custom block(s) exists within the
                    // inline block, it's possbible in some cases for requiredParams and 
                    // blockQualifiers to exist at the same time

                    inline = true;
                    ast = block;

                    break;
                }
            }

            // If not found, attempt to load the partial file
            if (!ast) {
                ast = PartialReader.read({
                    path: _this.getPartialPath(partialName)
                });
            }

            return {
                ast,
                inline,
            }
        }

        const processPartial = ({ stmt }) => {

            if (_this.getOuterInlineBlock({ bindParents }) != null) {

                // Though, we do not process partials within inline
                // blocks, we need to attempt to process the hashpairs,
                // for the ones that access the root access

                this.acceptArray(stmt.hash.pairs);
                return;
            }

            let { ast, inline } = getPartialAst({
                stmt
            });

            addParamsAsHashes(stmt);

            if (isCustomContext()) {
                if (inline && !ast.isCustomCtx) {
                    _this.createDataPathIndirection();
                }
            }

            assert(ast.type == 'Program');

            // Wrap ast inside PartialWrapper. For more info, see below:
            // ASTParser.prototype.PartialWrapper
            ast = {
                ...ast,
                type: 'PartialWrapper',
            }

            const ctxList = getPartialContextList.bind(this)({ stmt, inline });

            const partialProcessor = new TemplatePreprocessor({
                assetId: _this.assetId,
                pluginName: _this.pluginName,
                componentName: _this.componentName,

                ast,
                contextList: ctxList,
                bindParents,
                globals: _this.globals,
                dataPaths: _this.dataPaths,
                blocksData: _this.blocksData,
                component: _this.component,

                componentAst: _this.componentAst,

                helpers: _this.helpers,
                isPartial: true,
                customBlockCtx: isCustomContext(),
                allowRootAccess: allowRootAccess(),

                resolver: _this.resolver
            });

            partialProcessor.process();

            this.mutating = true;

            if (isCustomContext()) {
                &*^% $#@
                Wrap ast in loadContext block

                Determine a way to transform inline block
                    in rootCtx to storeContext if being reference
                by a partial in a custom Context
            }

            // Indicate that the ast statements should be not be processed
            // after replacing the current partial statement because
            // because this has already been done by partialProcessor above

            _this.visitNodes({
                types: ['MustacheStatement', 'BlockStatement'],
                ast,
                consumer: ({ stmt }) => {
                    stmt.partialSkip = true;
                }
            });

            const parent = bindParents.peek();

            replacements.push({
                parent: parent.body,
                replacementIndex: parent.body.indexOf(stmt),
                replacementNodes: ast.body
            });

            return false;
        }

        ASTParser.prototype.PartialStatement = function (stmt) {
            return processPartial.bind(this)({
                stmt,
            });
        };

        ASTParser.prototype.PartialBlockStatement = function (stmt) {
            throw new Error(`PartialBlockStatements are not supported`);
        };

        ASTParser.prototype.DecoratorBlock = function (stmt) {

            const { reservedDecoratorNames } = TemplatePreprocessor;
            const decoratorName = stmt.params[0].original;

            if (reservedDecoratorNames.includes(decoratorName)) {
                throw new Error(`Decorator name: ${decoratorName} not reserved`);
            }

            stmt.program.isCustomCtx = isCustomContext();

            bindParents.push({ type: stmt.type, body: stmt.program.body });
            Visitor.prototype.DecoratorBlock.call(this, stmt);
            bindParents.pop();

            _this.addInlineBlock({ bindParents, stmt });

            console.info(`Decorator block: ${decoratorName}, requiredParams: ${stmt.requiredParams}, blockQualifiers: ${stmt.blockQualifiers}`);

            this.mutating = true;
            return false;
        };

        /**
         * This is a custom AST type that is wrapped around a partial's
         * AST program, inorder to create a clearly defined boundary between
         * decorators defined inside the partial and any decorator
         * that may be wrapped out the partial declaration
         * 
         */
        ASTParser.prototype.PartialWrapper = function (stmt) {

            const program = {
                type: 'Program',
                body: stmt.body
            };

            bindParents.push({ type: stmt.type, body: stmt.body });
            Visitor.prototype.Program.call(this, program);
            bindParents.pop();

            this.mutating = true;

            // The use of this wrapper has been finalized,
            // hence dispose it and replace it with it's program
            // equivalent
            return program;
        }

        const parser = new ASTParser();
        parser.accept(ast);

        assert(bindParents.length == 1);
        assert(contextList.length == 1);

        this.replaceNodes(replacements);
    }

    addInlineBlock({ bindParents, stmt }) {

        assert(stmt.path.type === 'PathExpression' && stmt.path.original === 'inline')

        const [param] = stmt.params;
        assert(param && param.type === 'StringLiteral')

        const blockName = param.original;

        // First, verify that no other decorator exists with
        // the same name
        if (Object.keys(this.getAvailableInlineBlocks({ bindParents }))
            .filter(name => name == blockName).length) {
            console.warn(`Inline block: '${blockName}' already exists: ${this.getLine(stmt)}, skipping`);
        }

        // Add a reference to the parent
        const parent = bindParents.peek();

        const decorators = parent.decorators || (parent.decorators = {});
        // Todo: Validate that param.original is a word
        decorators[param.original] = stmt.program;

        // Todo: create a mechanism to cleanup unused
        // decorator block after adding here
    }

    getAvailableInlineBlocks({ bindParents }) {
        const blocks = {};
        for (const parent of bindParents) {
            blocks = {
                ...blocks,
                ...parent.decorators.map(block => {
                    block.parent = parent;
                }) || {},
            };
        }

        return blocks;
    }

    getOuterInlineBlock({ bindParents }) {
        loop:
        for (let i = bindParents.length - 1; i >= 0; i--) {
            const parent = bindParents[i];

            switch (parent.type) {
                case 'PartialWrapper':
                    break loop;
                case 'DecoratorBlock':
                    return parent;
                default:
                    continue loop;
            }
        }
        return null;
    }

    visitNodes({ types, ast, consumer }) {

        const Visitor = handlebars.Visitor;
        function ASTParser() {
        }
        ASTParser.prototype = new Visitor();

        for (const type of types) {
            ASTParser.prototype[type] = function (stmt) {
                consumer({ stmt });
                Visitor.prototype[type].call(this, stmt);
                this.mutating = true;
                return stmt;
            }
        }

        const parser = new ASTParser();
        parser.accept(ast);
    }

    getLine(stmt) {
        const { loc: { start } } = stmt;
        return `Line: ${start.line}:${start.column}`
    }

    getPartialPath(partialName) {

        // Todo: validate partialName - an attacker can access the file
        // system with this
        const partialFile = path.join(this.srcDir, `${partialName}.hbs`);

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

    validateMethod(methodName) {
        if (!this.methodNames.includes(methodName)) {
            throw new Error(`Unknown method: ${methodName}`);
        }
    }

    isDataPath(fqPath) {
        return this.lookupDataPath({ fqPath })
            != undefined;
    }

    hasDataPathFormat(path) {
        const { dataPathRoot, pathSeparator } = TemplatePreprocessor;
        return path.startsWith(`${dataPathRoot}${pathSeparator}`)
            // In the case of BlockStatement param(s) and MustacheStatement
            // paths, that are hbs-intrinsic elements, they are prefixed
            // with 'data.' after trimming
            || path.startsWith(`${dataPathRoot}.`);
    }

    lookupDataPath({ fqPath, validTypes = [] }) {

        const value = this.component
            .resolvePath({
                fqPath: this.trimDataPath(fqPath),
                indexResolver: () => 0
            });

        return this.component.validateType({
            path: fqPath,
            value, validTypes
        });
    }

    getMetaHelpers() {
        return [
            'storeContext', 'updateContext', 'loadContext'
        ];
    }

    getConditionalHelpers() {
        return [
            'if', 'unless'
        ];
    }

    getContextSwitchingHelpers() {
        return [
            'each', 'with'
        ];
    }

    getHandleBarsBlockHelpers() {
        return [
            ...this.getConditionalHelpers(),
            ...this.getContextSwitchingHelpers()
        ];
    }

    // Todo: disable the use of "lookup" helper
    getHandleBarsDefaultHelpers() {
        return [
            'blockHelperMissing', 'helperMissing', 'log', 'lookup',
            ...this.getHandleBarsBlockHelpers()
        ];
    }

    getHandleBarsDataVariables() {
        return ['@root', '@first', '@index', '@key', '@last', '@level'];
    }

    getReservedQualifierNames() {
        const { rootQualifier } = TemplatePreprocessor;
        return [rootQualifier];
    }

    /**
    * This returns the component instance of the template
    * that is currently being processed
    */
    getComponent() {

        // Todo: During initial loading process, we need to perform
        // some code checks to prevent dangerous code, i.e. access to
        // node apis, since it's for the client side. Note that only
        // index.test.js can contain "require" becuase it needs

        const data = this.componentScript || fs.readFileSync(
            path.join(this.srcDir, 'index.test.js'),
            'utf8'
        );

        const window = {
            ...new jsdom.JSDOM(`...`).window,
            RootProxy: require('../src/assets/js/proxy'),
            Handlebars: handlebars,
            assert,
            BaseComponent
        };

        for (const k in window) {
            global[k] = window[k];
        }
        global.window = window;

        // Setup NODE_PATH, inorder to properly resolve "require"s
        process.env.NODE_PATH = this.srcDir;
        require('module').Module._initPaths();

        // Load Component Class
        // eslint-disable-next-line no-eval
        const ComponentClass = eval(data);

        // Tear down NODE_PATH
        delete process.env.NODE_PATH;
        require('module').Module._initPaths();

        // Create component instance
        const component = new ComponentClass({
            id: utils.generateRandomString(),
            input: this.resolver.resolve
        });

        // This should be called by the compile-templates gulp transform
        // after server-side rendering
        component.releaseGlobal = () => {
            for (const k in window) {
                delete global[k];
            }
            delete global.window;
        }

        return component;
    }
}

module.exports = TemplatePreprocessor;