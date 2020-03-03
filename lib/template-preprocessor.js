const path = require('path');
const fs = require('fs');
const handlebars = require('handlebars');
const utils = require('./utils');
const PartialReader = require('./template-reader');
const esprima = require('esprima')

class TemplatePreprocessor {

    static config = {
        processStringLiterals: false
    };

    constructor({
        templatePath,
        ast,
        parentPaths = {},
        dynamicDataHelpers = [],
        registerDynamicDataHelpers = true,
        indentationSpace = '',
    }) {

        this.templatePath = templatePath;
        this.ast = ast;
        this.parentPaths = parentPaths;

        this.dynamicDataHelpers = dynamicDataHelpers;
        this.registerDynamicDataHelpers = registerDynamicDataHelpers;
        this.staticDataHelpers = [];

        this.indentationSpace = indentationSpace,

            // K: <String>fullyQualifiedMustachePath, V: <String[]> TextNodeElement ids
            // this.textNodeBindMap = {};
            // this.attributeValueBindMap = {};
            // this.arrayBlockBindMap = {};


            // constraints: components should not have constructors defined in the client-side
            // editor, use esprime in the component playground tool to verify this

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


            this.component = this.getComponent();

        // Note:
        // From the sample json input in the component playground, we get the contents
        // and save as the first comment statement in the template file
        this.flattenedSampleInput = utils.flattenJson(JSON.parse(this.ast.body.shift().value));

        this.methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(this.component))
            .filter(item => typeof this.component[item] === 'function');

        this.helpers = [];
    }

    /**
     * Process the AST
     */
    process() {

        const isPartialAst = Object.keys(this.parentPaths).length;

        // Process the AST
        this.process0({
            parentPaths: this.parentPaths,
            basePaths: isPartialAst ? [] : [{
                value: 'COMP_ID__data',
                type: 'root'
            }],
            astNodes: this.ast.body
        });

        if (this.registerDynamicDataHelpers) {

            // Register dynamic data helpers, only for template.hbs
            // console.log(`Registering ${this.dynamicDataHelpers.length} dynamic data helper(s)`);

            for (const path of this.dynamicDataHelpers) {
                this.ast.body.unshift(this.getDynamicDataHelperStatement(path));
            }
        }

        // Register static data helpers
        // console.log(`Registering ${this.staticDataHelpers.length} static data helper(s)`);

        for (const helper of this.staticDataHelpers) {
            this.ast.body.unshift(helper);
        }

        // Add helpers array
        this.ast.body.unshift({
            type: 'CommentStatement',
            value: `${JSON.stringify(this.helpers)}`
        });

        return JSON.stringify(this.ast);
    }

    getDynamicDataHelperStatement(path) {
        const code = `
        handlebars.addHelper('${path}', function () {
            return BaseComponent.lookupDataStore({fqPath: '${path}'});
        });`
        return { type: 'ContentStatement', original: code, value: code }
    }

    getStaticDataHelperStatement(value) {
        const name = `static__${utils.getRandomInt()}`;
        const code = `
        handlebars.addHelper('${name}', function () {
            return '${value}';
        });`;

        this.staticDataHelpers.push({
            type: 'ContentStatement', original: code, value: code
        });
        return name;
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

    validatePath(stmt, path) {
        if (path.includes('_$') || path.includes('__')) {
            throw new Error(`
                Invalid path: ${path},
                AST: ${JSON.stringify(stmt)}`
            );
        }

        // Paths should generally be words or a json notation
        // Todo: Validate path using regex
    }

    /**
     * This replaces the path's first segment with 
     * the parentPath provided
     * 
     * @param {*} path 
     * @param {*} parentPath 
     */
    prependParentPath(path, parentPath) {

        const parts = [];
        const arr = path.split('.');

        for (let i = 0; i < arr.length; i++) {
            if (i == 0) {
                parts[i] = parentPath;
            } else {
                parts[i] = arr[i];
            }
        }

        return `${parts.join('__')}`;
    }

    findParentPath(keys, parentPaths, path) {

        if ((!path.startsWith('../')) && !path.startsWith('./')
            && path !== 'root') {

            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                const value = parentPaths[key];

                if (value.type != 'PathExpression' && path.startsWith(`${key}.`)) {
                    throw new Error(`Cannot reference '${path}' since '${key}' is a StringLiteral`);
                }

                if (path === key || (value.type == 'PathExpression' && path.startsWith(`${key}.`))) {

                    let original;

                    if (value.type == 'PathExpression') {
                        original = this.prependParentPath(path, value.original);
                    } else {
                        original = value.original;
                    }

                    return {
                        resolved: true,
                        path: {
                            type: value.type,
                            original,
                        }
                    }
                }
            }
        }

        const key = keys[keys.indexOf('root')];
        const value = parentPaths[key];

        if (value.type !== 'PathExpression') {
            throw new Error('root must be of type: PathExpression');
        }

        return { resolved: false, path: value.original };
    }

    resolvePath(bindPaths, parentPaths, value, allowStringLiterals) {

        const pathValidator = (path) => {
            if (allowStringLiterals || path.type === 'PathExpression') {
                return path;
            }
            throw new Error(`Path: ${path.original} is not allowed`);
        }

        let context;

        if (bindPaths.length) {
            context = bindPaths[bindPaths.length - 1].value.split('__');
        } else {
            const keys = Object.keys(parentPaths);
            const { resolved, path } = this.findParentPath(keys, parentPaths, value);

            if (resolved) {
                return pathValidator(path);
            }
            context = path.split('__');
        }

        let index = context.length - 1;

        let arr = value.split(/(\.?\.\/){1}/);

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
                        if (index > 1) {
                            index--;
                        }
                    case './':
                        value = value.replace(v, '');
                        break;

                    default:
                        break whileLoop;
                }

                i++;
            }
        }


        switch (true) {
            case value === 'root':
                value = value.replace('root', '');
                break;
            case value.startsWith('root.'):
                value = value.replace('root.', '');
                break;
        }

        value = (value.length ? '__' : '') + value.split('.').join('__');

        return {
            type: 'PathExpression',
            original: context.slice(0, index + 1).join('__') + value
        };
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
                id: {
                    type: 'Identifier',
                    name: variableName
                },
            }]
        };
    }

    getRawValue(value) {
        return typeof value == 'string' ? `'${value}'` : `${value}`
    }

    getScalarConstantAssignmentStatement(variableName, value) {
        const getValue = (value) => {
            const envelope = {
                type: value == undefined ? 'Identifier' : 'Literal'
            };

            if (value == undefined) {
                envelope.name = 'undefined';
            } else {
                envelope.value = value;
                envelope.raw = this.getRawValue(value);
            }
            return envelope;
        };

        const envelope = this.getVariableEnvelope(variableName);
        envelope.declarations[0].init = getValue(value);

        return envelope;
    }

    getFunctionInvocationStatement(variableName, methodName, constantArgs = []) {

        const envelope = this.getVariableEnvelope(variableName);
        const init = {
            type: 'CallExpression',
            callee: {
                type: 'MemberExpression',
                computed: false,
                object: {
                    type: 'ThisExpression'
                },
                property: {
                    type: 'Identifier',
                    name: methodName
                }
            },
        };

        if (constantArgs.length) {
            init.arguments = constantArgs.map((arg) => {
                return {
                    type: 'Literal',
                    value: arg,
                    raw: this.getRawValue(arg)
                }
            });
        }

        envelope.declarations[0].init = init;
        return envelope;
    }

    /**
     * This creates a funtion that serves as an indirection to the method specified
     * 
     * @param {String} OriginalmethodName 
     * @param {*} constantArgs 
     */
    getFunctionDeclarationStatement(OriginalmethodName, constantArgs = []) {
        const ast = {
            type: "FunctionDeclaration",
            id: {
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
                                    name: OriginalmethodName
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

        // add variable declarations for constants
        const variableNames = [];
        for (const arg of constantArgs) {
            const name = utils.generateRandomString();
            variableNames.push(name);

            const statement = this.getScalarConstantAssignmentStatement(name, arg);
            body.unshift(statement);
        }

        // add function invocation params in return statement
        for (const variableName of variableNames) {
            body[body.length - 1].argument.arguments.push({
                type: 'Identifier',
                name: variableName
            });
        }

        return ast;
    }

    process0({ parentPaths, basePaths, astNodes }) {

        const bindPaths = [].concat(basePaths);
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

        ASTParser.prototype.BlockStatement = function (stmt) {

            switch (stmt.path.original) {

                case 'with':
                case 'each':
                case 'if':

                    console.log(`${_this.indentationSpace}\x1b[33m{{#${stmt.path.original} ${stmt.params[0].original}}}\x1b[0m`);
                    _this.indentationSpace += '   ';

                    // Validate declared path
                    _this.validatePath(stmt, stmt.params[0].original);

                    // Resolve path
                    let { type, original: path } = _this.resolvePath(
                        bindPaths,
                        parentPaths,
                        stmt.params[0].original,

                        // StringLiterals are only allowed for #if blocks
                        stmt.path.original === 'if'
                    );

                    const parent = bindParents[bindParents.length - 1];

                    this.mutating = true;

                    if (stmt.path.original == 'each' || stmt.path.original == 'if') {

                        if (type === 'PathExpression') {
                            _this.registerDynamicDataHelper(path);
                        }

                        stmt.params[0].type = type;
                        stmt.params[0].original = path;
                    }

                    if (stmt.path.original == 'each') {

                        const arrayIndexTracker = (path, operator) => {
                            const code = `<script type='text/javascript'>
                                            BaseComponent.arrayIndexTracker['${path}']${operator}
                                          </script>`;

                            return { type: 'ContentStatement', original: code, value: code }
                        };

                        // At the top of the array block, 
                        // Initialize the tracker, i.e. BaseComponent.arrayIndexTracker['${path}']==-1
                        replacements.push({
                            parent,
                            shiftOnly: true,
                            replacementIndex: parent.indexOf(stmt),
                            replacementNodes: [arrayIndexTracker(path, '=-1'), stmt]
                        });

                        // At the top of the array body, increment the tracker
                        // BaseComponent.arrayIndexTracker['${path}']++
                        stmt.program.body.unshift(
                            arrayIndexTracker(path, '++')
                        );

                        path += '_$';
                    }

                    if (stmt.path.original == 'each' || stmt.path.original == 'with') {

                        bindPaths.push({
                            value: path,
                            type: stmt.path.original
                        });
                        bindParents.push(stmt.program.body);
                    }

                    Visitor.prototype.BlockStatement.call(this, stmt);

                    _this.indentationSpace = _this.indentationSpace.replace('   ', '');
                    console.log(`${_this.indentationSpace}\x1b[33m{{/${stmt.path.original}}}\x1b[0m`);

                    if (stmt.path.original == 'each' || stmt.path.original == 'with') {
                        bindPaths.pop();
                        bindParents.pop();
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

            Visitor.prototype.BlockStatement.call(this, stmt);
        }



        const syntheticFunctions = [];

        const addVarForUndefined = (variablesAstList) => {

        }

        const addVarForScalarConstants = (variablesAstList) => {

        }

        const addVarForPathExpression = (variablesAstList) => {

        }

        const addVarForSubExpression = (variablesAstList) => {

        }

        const createFunction = (variablesAstList) => {

        }

        ASTParser.prototype.MustacheStatement = function (stmt) {

            if (stmt.path.type == 'StringLiteral') {
                Visitor.prototype.MustacheStatement.call(this, stmt);
                return;
            }

            // We only recognize a helper if the mustache statement contains one
            // or more params. If it does not, we assume it's exists in the
            // data path, else we treat it as a helper invocation

            if (stmt.params.length) {

                const helperName = stmt.path.original;

                if (_this.methodNames.indexOf(helperName) < 0) {
                    throw new Error(`Unknown helper function: ${helperName}`);
                }

                console.log(JSON.stringify(stmt.params));

                const helperString = `function ${_this.component[helperName].toString()}`;
                const helperAST = esprima.parseScript(helperString);

                console.log(JSON.stringify(helperAST));
                const declarationParams = helperAST.body[0].params.map(param => param.name);

                if (declarationParams.length > stmt.params.length + stmt.hash ? 1 : 0) {
                    // throw new Error(`Helper ${helperName} must have <= ${expectedLength} parameters`);
                }

                // An array of esprima variable declarations
                const variablesAstList = []

                let i;
                for (i = 0; i < stmt.params.length && declarationParams[i]; i++) {

                    let variableName = declarationParams[i]
                    let variableValue;

                    switch (stmt.params[i].type) {

                        case 'UndefinedLiteral':
                            variableValue = undefined;
                            break;

                        case 'PathExpression':
                            break;

                        case 'SubExpression':
                            break;

                        default:
                            variableValue = stmt.params[i].value;
                            break;
                    }
                }

                if (stmt.hash && declarationParams[i]) {

                }


                // identifier
                // this.helpers.[FUNCTION].body[0].id.name




                Visitor.prototype.MustacheStatement.call(this, stmt);
                return;
            }

            // Validate declared path
            _this.validatePath(stmt, stmt.path.original);

            // Resolve path
            const path = _this.resolvePath(
                bindPaths,
                parentPaths,
                stmt.path.original,
                true
            );

            if (path.type == 'PathExpression') {

                if (!_this.isMustacheDataPath(path.original)) {
                    Visitor.prototype.MustacheStatement.call(this, stmt);
                    return;
                }
                _this.registerDynamicDataHelper(path.original);
            }


            console.log(`${_this.indentationSpace}\x1b[37m{{${stmt.path.original}}}\x1b[0m`);

            this.mutating = true;

            stmt.path.parts[0] = path.original;
            stmt.path.original = path.original;

            stmt.path.type = path.type;

            return stmt;
        }

        const decoratorBlocks = [];

        ASTParser.prototype.PartialStatement = function (partial) {

            const { name, params, hash = { type: 'Hash', pairs: [] } } = partial;

            if (decoratorBlocks.includes(name.original)) {
                Visitor.prototype.PartialStatement.call(this, partial);
                return;
            }

            if (params.length) {
                // Add params as hash pairs
                // For example: 
                // {{> myPartial myOtherContext }} == {{> myPartial myOtherContext = ./myOtherContext }}
                for (const param of params) {
                    let key, value = param.original;
                    hash.pairs.push({
                        key: key,
                        value: {
                            type: param.type,
                            original: value
                        }
                    });
                }
            }

            if (hash.pairs.length) {
                let index;
                for (let i = 0; i < hash.pairs.length; i++) {
                    const pair = hash.pairs[i];
                    if (pair.key === undefined && pair.value.original == '.') {
                        index = i;
                        break;
                    }
                }

                if (index >= 0) {
                    hash.pairs.splice(index, 1);
                    hash.pairs.push({
                        key: 'root',
                        value: {
                            type: 'PathExpression',
                            original: './'
                        }
                    });
                }
            }

            //Ensure that there are no duplicate hash keys
            if (!utils.ensureUniqueKeys(hash.pairs, 'key')) {
                throw new Error(`PartialStatement must contain
                                unique hash keys`);
            }

            // Validate hashkeys keys as words
            for (const h of hash.pairs) {
                if (h.key.match(/[\w]+/g) != h.key) {
                    throw new Error(`Hashkey: ${h.key} for PartialStatement must be
                                a valid word`);
                }
            }

            // Todo, automatically add root, if not done already
            if (!hash.pairs.map(h => h.key).filter(k => k == 'root').length) {
                hash.pairs.push({
                    key: 'root',
                    value: {
                        type: 'PathExpression',
                        original: './'
                    }
                });
            }

            this.mutating = true;

            const partialPath = _this.getPartialPath(name.original)
            const partialAST = PartialReader.read(partialPath, name.data);

            const partialParentPaths = {};

            // Prepare parent paths from hashes
            for (const pair of hash.pairs) {

                const key = pair.key;
                let value;

                switch (pair.value.type) {

                    case 'PathExpression':

                        value = _this.resolvePath(
                            bindPaths,
                            parentPaths,
                            pair.value.original,
                            true,
                        );
                        break;

                    case 'StringLiteral':
                        value = {
                            type: 'StringLiteral',
                            original: pair.value.original
                        }
                        break;
                }

                partialParentPaths[key] = value;
            }

            console.log(`\x1b[36m${_this.indentationSpace}#include [${path.basename(partialPath)}](${JSON.stringify(partialParentPaths)})\x1b[0m`);

            const partialProcessor = new TemplatePreprocessor({
                templatePath: partialPath,
                ast: partialAST,
                parentPaths: partialParentPaths,
                dynamicDataHelpers: _this.dynamicDataHelpers,
                registerDynamicDataHelpers: false,
                indentationSpace: _this.indentationSpace,
            });

            // Process partialAST
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

    // Todo: Support globals
    isMustacheDataPath(path) {
        return true;
        // const path = this.component.getDataPath({ fqPath, indexResolver: () => 0});
        // return this.flattenedInput[path];
    }

    getHandleBarsDefaultHelpers() {
        return [
            'blockHelperMissing', 'each', 'helperMissing', 'if', 'log', 'lookup', 'unless', 'with'
        ];
    }

    /**
    * This returns the component definition in the directory of the template
    * that is currently being processed
    */
    getComponent() {
        const dir = path.dirname(this.templatePath);

        const BaseComponent = fs.readFileSync(path.join(path.dirname(dir), 'base.js'), 'utf8');
        const data = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');


        // eslint-disable-next-line no-unused-vars
        const window = {};
        // eslint-disable-next-line no-unused-vars
        const document = {};

        // eslint-disable-next-line no-eval
        const ComponentClass = eval(`${BaseComponent}${data}`);

        const component = new ComponentClass({ render: false });

        return component;
    }
}

module.exports = TemplatePreprocessor;