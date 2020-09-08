/* eslint-disable no-new */
/* eslint-disable no-cond-assign */
/* eslint-disable global-require */
/* eslint-disable prefer-destructuring */
/* eslint-disable no-continue */
/* eslint-disable prefer-const */
/* eslint-disable no-case-declarations */
/* eslint-disable no-param-reassign */
/* eslint-disable consistent-return */
/* eslint-disable func-names */
/* eslint-disable no-restricted-syntax */

const { createRequire } = require('module').Module;
const assert = require('assert');
const pathLib = require('path');
const fs = require('fs');
const handlebars = require('handlebars');
const esprima = require('esprima');
const escodegen = require('escodegen');
const jsdom = require('jsdom');
const csso = require('csso');
const UglifyJS = require('uglify-js');
const utils = require('./utils');
const PartialReader = require('./template-reader');
const ClientHtmlGenerator = require('./client-html-generator');
const PathResolver = require('./path-resolver');
const helpers = require('./preprocessor-helpers');

class TemplatePreprocessor {
  static minifyComponentRendererClass = false;

  static allowRootAccessByDefault = true;

  static rawDataPrefix = 'r$_';

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

  static storeContextBlockName = 'storeContext';

  static loadContextBlockName = 'loadContext';

  static emptyStringPath = '@root.emptyString';

  static processLiteralSegmentMethod = 'processLiteralSegment';

  static partialIdHash = '__id';

  static partialNameHash = '__name';

  static literalType = 'Literal';

  static arrayType = 'Array';

  static objectType = 'Object';

  static mapType = 'Map';

  static defaultIndexResolver = () => 0;

  static resolveLiteralsWithProxy = true;

  constructor({
    assetId,
    logger,
    componentName,
    ast,
    contextList,
    bindParents,
    dataPaths,
    blocksData,
    component,
    componentAst,
    componentSrc,
    // eslint-disable-next-line no-shadow
    helpers,
    globals,
    customBlockCtx = false,
    allowRootAccess,
    resolver,
  }) {
    const { getMethodNames } = TemplatePreprocessor;
    utils.addPloyfills();

    this.assetId = assetId;
    this.logger = logger;

    this.componentName = componentName;

    this.srcDir = pathLib
      .join(pathLib.dirname(fs.realpathSync(__filename)),
        `../src/components/${componentName}`);

    this.ast = ast;

    this.contextList = contextList;
    this.bindParents = bindParents;

    this.dataPaths = dataPaths || ['@root'];

    this.blocksData = blocksData || {};

    this.customBlockCtx = customBlockCtx;
    this.allowRootAccess = allowRootAccess;

    this.resolver = resolver;
    this.isPartial = !!component;

    if (!component) {
      this.cssDependencies = [];
      this.jsDependencies = [];

      this.readHeadAttributes();

      const componentData = this.getComponent();

      component = componentData.component;
      componentAst = esprima.parseScript(
        component.constructor.toString(),
      );

      componentSrc = componentData.src;
    }

    this.component = component;

    this.componentAst = componentAst;

    this.componentSrc = componentSrc;

    this.methodNames = this.validateMethodNames(
      getMethodNames({
        component: this.component,
      }),
    );

    this.helpers = helpers || [];

    this.globals = globals || {};

    this.process();
  }

  static getMethodDefintion({ ast, name }) {
    for (const definition of ast.body[0].body.body) {
      if (definition.key.name === name) {
        return definition;
      }
    }
    return null;
  }

  static getMethodNames({ component }) {
    let methods = new Set();

    while ((component = Reflect.getPrototypeOf(component))
      // eslint-disable-next-line no-undef
      && component.constructor.name !== BaseComponent.name) {
      let keys = Reflect.ownKeys(component).filter(k => k !== 'constructor');
      keys.forEach(k => methods.add(k));
    }
    return [...methods];
  }

  validateMethodNames(methodNames) {
    if (this.isPartial) {
      return methodNames;
    }
    const { synthethicMethodPrefix } = TemplatePreprocessor;
    for (const methodName of methodNames) {
      if (methodName.startsWith(synthethicMethodPrefix)) {
        throw new Error(`Method name: ${methodName} not allowed`);
      }
    }
    return methodNames;
  }

  getDistPath() {
    const assetPath = pathLib
      .join(pathLib.dirname(fs.realpathSync(__filename)),
        `../dist/components/${this.assetId}`);

    if (!fs.existsSync(assetPath)) {
      fs.mkdirSync(assetPath, { recursive: true });
    }
    return assetPath;
  }

  writeAssetsToFileSystem() {
    this.writeComponentJsToFileSystem();
    this.writeHtmlToFileSystem();
  }

  writeComponentJsToFileSystem() {
    const { minifyComponentRendererClass, minifyAsset } = TemplatePreprocessor;
    const distPath = this.getDistPath();

    // load component index file
    const componentSrc = this.loadComponentIndexFile();

    // eslint-disable-next-line no-unused-vars
    const require = createRequire(`${distPath}/index.dist.js`);

    // Write index.js file
    fs.writeFileSync(
      `${distPath}/index.dist.js`,
      minifyComponentRendererClass
        ? minifyAsset({ data: componentSrc, type: 'js' })
        : componentSrc,
    );
  }

  writeHtmlToFileSystem() {
    const distPath = this.getDistPath();

    // load component index file
    const componentSrc = this.loadComponentIndexFile();

    // eslint-disable-next-line no-unused-vars
    const require = createRequire(`${distPath}/index.dist.js`);

    // eslint-disable-next-line no-eval
    const ComponentClass = eval(componentSrc);
    // Write html stub
    fs.writeFileSync(`${distPath}/client.html`, ClientHtmlGenerator.get({
      className: ComponentClass.name,
      assetId: this.assetId,
      resolver: this.resolver,
    }));
  }

  static getLiteralType({ value }) {
    switch (true) {
      case value == null:
        return 'NullLiteral';

      case value === undefined:
        return 'UndefinedLiteral';

      case value.constructor.name === 'String':
        return 'StringLiteral';

      case value.constructor.name === 'Number':
        return 'NumberLiteral';

      case value.constructor.name === 'Boolean':
        return 'BooleanLiteral';
      default:
        throw new Error(`Unknown literal value: ${value}`);
    }
  }

  /**
   * Process the AST
   */
  process() {
    const { rootQualifier, dataPathRoot, getLiteralType } = TemplatePreprocessor;

    const defaultContext = {};

    defaultContext[rootQualifier] = {

      type: 'PathExpression',
      value: dataPathRoot,

      // This is only used to resolve @root
      // and will be mutated as partials are processed
      declaredValue: dataPathRoot,
    };

    for (const k in this.globals) {
      if ({}.hasOwnProperty.call(this.globals, k)) {
        const value = this.globals[k];
        defaultContext[k] = {
          type: getLiteralType({ value }),
          value,
        };
      }
    }

    this.process0({
      contextList: this.contextList || [
        defaultContext,
      ],
      bindParents: this.bindParents || [{ type: 'root', body: this.ast.body }],
      ast: this.ast,
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

      // refresh component instance
      this.serializeAst();

      // write component model
      this.resolver.finalize();

      // write assets
      this.writeAssetsToFileSystem();

      // this.logger.info(JSON.stringify(this.ast));
    }
  }

  /**
   * This returns the string that should be written as the component
   * index.js file in the dist directory.
   */
  loadComponentIndexFile() {
    const { isRootCtxValue } = TemplatePreprocessor;
    const filePath = pathLib.join(this.srcDir, 'index.js');

    let data = fs.readFileSync(
      filePath,
      'utf8',
    );

    // eslint-disable-next-line no-unused-vars
    const require = createRequire(filePath);

    // eslint-disable-next-line no-eval
    const ComponentClass = eval(data);

    const classString = ComponentClass.toString();

    const ast = esprima.parseScript(classString);

    for (const definition of this.componentAst.body[0].body.body) {
      if (isRootCtxValue(definition.key.name)) {
        ast.body[0].body.body.push(definition);
      }
    }

    data = data.update(
      classString,
      `/* eslint-disable */\n${escodegen.generate(ast)}`,
    );

    return data;
  }

  readHeadAttributes() {
    const attributes = ['name', 'style', 'script'];

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const stmt = this.ast.body[0];

      if (
        stmt.type === 'MustacheStatement'
        && attributes.includes(stmt.path.original)
      ) {
        // eslint-disable-next-line default-case
        switch (stmt.path.original) {
          case 'name':
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
      } else if (stmt.type === 'ContentStatement') {
        const original = stmt.original.trim();
        const whitespace = /^[\s]*$/g;

        if (original.match(whitespace)) {
          this.ast.body.shift();
        } else {
          break;
        }
      } else {
        break;
      }
    }

    // Add path to pre-compiled template
    this.jsDependencies.push(`/components/${this.assetId}/template.min.js`);

    if (!this.resolver) {
      throw new Error(`Meta-attribute: ${attributes[0]} is required`);
    }
  }

  addServerStub({ stmt }) {
    const param = stmt.params[0];

    assert(param.type === 'PathExpression' || param.type === 'StringLiteral');

    this.resolver = new PathResolver({
      componentName: this.componentName,
      path: param.original,
    });
  }

  addDependencyAsset({ stmt, type }) {
    const { minifyAsset, getHashValue } = TemplatePreprocessor;
    const value = getHashValue({ stmt, key: 'href' });
    assert(value.type === 'PathExpression' || value.type === 'StringLiteral');

    let assetUrl = new URL(value.original);

    if (!assetUrl.hostname) {
      // This is relative path
      const pathName = assetUrl.pathname
        .replace(/^\//);

      const exp = new RegExp(`(.min)?.${type}$`);

      if (pathName.match(exp)) {
        pathName.replace(exp, '');
      }

      let data = fs.readFileSync(
        pathLib.join(this.srcDir, pathName),
        'utf8',
      );

      data = minifyAsset({ data, type });

      const assetPath = this.getDistPath();
      const fileName = `${utils.generateRandomString()}.min.${type}`;

      fs.writeFileSync(
        `${assetPath}/${fileName}`, data,
      );

      assetUrl = `/components/${this.assetId}/${fileName}`;
    } else {
      assetUrl = assetUrl.toString();
    }

    this[`${type}Dependencies`].push(assetUrl);
  }

  static minifyAsset({ data, type }) {
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
      default:
        throw new Error(`Unknown type: ${type}`);
    }
  }

  addJsDependency({ stmt }) {
    this.addDependencyAsset({ stmt, type: 'js' });
  }

  addCssDependency({ stmt }) {
    this.addDependencyAsset({ stmt, type: 'css' });
  }

  serializeAst() {
    const { getTransientFields } = TemplatePreprocessor;
    const fields = {};

    if (this.component) {
      const propertyNames = Object.getOwnPropertyNames(this.component)
        .filter(prop => !getTransientFields().includes(prop));
      for (const k of propertyNames) {
        fields[k] = this.component[k];
      }
    }

    const componentData = this.getComponent({
      componentSrc: this.componentSrc
        .update(
          this.component.constructor.toString(),
          escodegen.generate(this.componentAst),
        ),
    });

    this.componentSrc = componentData.src;
    this.component = componentData.component;

    for (const k in fields) {
      if ({}.hasOwnProperty.call(fields, k)) {
        this.component[k] = fields[k];
      }
    }

    // Incrementally write component js file. This is mainly
    // for debugging purpose
    this.writeComponentJsToFileSystem();
  }

  /**
   * This get the fields that should be unique across multiple
   * component instances
   */
  static getTransientFields() {
    return ['id', 'rootProxy'];
  }

  emitAssetId() {
    const { getScalarValue } = TemplatePreprocessor;
    this.wrapExpressionAsMethod({
      name: 'assetId',
      returnExpression: getScalarValue(this.assetId),
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
    const { getValue } = TemplatePreprocessor;
    if (!value) {
      value = this[name];
    }
    assert(value.constructor.name === 'Array');
    this.wrapExpressionAsMethod({
      name,
      returnExpression: {
        type: 'ArrayExpression',
        elements: [...new Set(value)]
          .map(getValue, this),
      },
    });
  }

  /**
   * Todo: Use two arrays to to this:
   * restrictedPathsRange and restrictedPaths
   *
   * @param {String} path
   */
  static validatePath(path) {
    const {
      pathSeparator,
      dataPathRoot,
      synthethicMethodPrefix,
      rawDataPrefix,
      literalPrefix,
    } = TemplatePreprocessor;

    // Todo: Check if path === helpers, and fail
    if (
      path.includes('_$')
      || path.includes('_@')
      || path.includes(pathSeparator)
      || path.startsWith(`${dataPathRoot}${pathSeparator}`)
      || path.startsWith(`${dataPathRoot}.`)
      || path.startsWith(synthethicMethodPrefix)
      || path.startsWith(rawDataPrefix)
      || path.startsWith(literalPrefix)
    ) {
      throw new Error(`Invalid path: ${path}`);
    }

    // Paths should generally be words or a json notation or array notation
    // Todo: Validate path using regex
  }

  static getSuffix(value) {
    const { getSegments } = helpers;

    const arr = value.split('.');
    const first = arr[0];
    const suffix = arr.slice(1);

    const segments = getSegments({
      original: first,
    });
    segments.splice(0, 1);
    const indexes = segments.join('');

    if (indexes.length) {
      suffix.unshift(indexes);
    }

    return suffix.join('.');
  }

  static hasObjectPrefix({ value, key, rangeAllowed = true }) {
    const { getSegments } = helpers;

    const arr = value.split('.');
    const arr2 = getSegments({ original: arr[0] });
    const prefix = arr2[0];

    const match = prefix === key;

    if (!match) {
      return false;
    }

    const isRange = arr.length > 1 || arr2.length > 1;

    if (isRange && !rangeAllowed) {
      throw new Error(`Invalid property: ${value}`);
    }

    return true;
  }

  static trimObjectPath({ value, repl }) {
    const { getSuffix } = TemplatePreprocessor;
    const suffix = getSuffix(value);
    return `${repl}${
      suffix.length && !suffix.startsWith('[')
        ? '.' : ''
    }${suffix}`;
  }

  // Todo: verify that this will be processes properly: {{#each [people]}}
  // eslint-disable-next-line no-unused-vars
  static getPathOffset({ stmt, original, contextList }) {
    const {
      getHandleBarsDataVariables,
      getScopeQualifier,
      hasObjectPrefix,
    } = TemplatePreprocessor;

    if (original.match(/\.$/)) {
      // Note: [] is parsed into ''
      original = original.replace(/\.$/, './');
    }

    const prev = original;

    let index = contextList.length - 1;
    let hasOffset = false;

    const arr = original.split(/(\.?\.\/){1}/);

    const isDataVariable = original.startsWith('@');

    if (arr.length > 1) {
      hasOffset = true;

      let i = isDataVariable ? 1 : 0;

      // eslint-disable-next-line no-labels
      whileLoop:
      while (i < arr.length) {
        const v = arr[i];

        if (v === '') {
          // eslint-disable-next-line no-plusplus
          i++;
          continue;
        }

        switch (v) {
          case '../':
            if (index > 0) {
              // eslint-disable-next-line no-plusplus
              index--;
            }
          // eslint-disable-next-line no-fallthrough
          case './':
            original = original.replace(v, '');
            break;

          default:
            // eslint-disable-next-line no-labels
            break whileLoop;
        }

        // eslint-disable-next-line no-plusplus
        i++;
      }
    }

    if (isDataVariable) {
      const arr2 = original.split('.');
      const first = arr2[0];

      if (first === '@root') {
        if (
          // wrong: @../root, correct: @root
          arr.length > 1
        ) {
          throw new Error(`Invalid path: ${prev}`);
        }
      } else if (!getHandleBarsDataVariables().includes(first)
      ) {
        throw new Error(`Invalid path: ${prev}`);
      }
    } else {
      // "." should have been replaced by "" above
      // Todo: remove this later
      assert(original !== '.');

      // Perform normalization

      if (hasObjectPrefix({ value: original, key: 'this' })) {
        if (hasOffset) {
          throw new Error(`Glob clause not expected when using 'this': ${prev}`);
        }
        original = original.replace(/^this\.?/g, '');
      }

      if (!index) {
        if (original.match(/^[0-9]+/g)) {
          // The root context should not be accessed like an array
          throw new Error(`The root context should not be accessed like an array: ${prev}`);
        }
      } else if (hasOffset || !original.length || original.match(/^[0-9]+/g)) {
        // !hasScopeQualifier({ contextList, original })

        // Normalize path by prefixing the corrresponding scope qualifier
        // This is useful if original startsWith '[' as this will prevent
        // processLiteralSegment(...) from throwing an exception

        original = `${
          getScopeQualifier({ contextList, index })
        }${original.length ? `.${original}` : ''}`;

        index = contextList.length - 1;
        hasOffset = false;
      }
    }

    return {
      path: original,
      index,
      hasOffset,
    };
  }

  resolvePathFromContext({
    contextList, contextIndex, hasOffset,
    original, validTypes, stmt,
    syntheticAlias, scopeQualifier,
  }) {
    const prevOriginal = original;
    const {
      rootQualifier, pathSeparator: separator, dataPathRoot,
      hasObjectPrefix, synthethicMethodPrefix, getLine,
      trimObjectPath, hasDataPathFormat, getSuffix,
      defaultIndexResolver,
    } = TemplatePreprocessor;

    let checkType = true;
    let targetType;
    let type;

    let synthetic = false;

    const contextObjects = [];

    // i.e. {{xyx}}, not {{./xyz}} or {{../xyz}}
    const isPurePath = original.startsWith('@')
        || (contextIndex === contextList.length - 1
          && !hasOffset && !original.startsWith('['));

    if (isPurePath) {
      // eslint-disable-next-line no-plusplus
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
        const rootQualifierIndex = contextKeys.indexOf(rootQualifier);

        if (rootQualifierIndex >= 0) {
          contextKeys.splice(rootQualifierIndex, 1);
        }

        // eslint-disable-next-line no-plusplus
        for (const k of contextKeys) {
          const v = contextObject[k];

          if (
            hasObjectPrefix({
              value: original,
              key: k,
              rangeAllowed: !!v.lookup,
            })
          ) {
            if (!contextObject[rootQualifier]) {
              assert(Object.keys(v).equals(['lookup']));
              return { terminate: true };
            }

            // eslint-disable-next-line prefer-destructuring
            type = v.type;

            if (type.endsWith('Literal')) {
              assert(k === original && v.lookup === false);

              original = v.value;
              checkType = false;
            } else if (v.synthetic) {
              if (!v.lookup) {
                checkType = false;

                if (syntheticAlias) {
                  throw new Error(`Path: ${k} cannot be used in a context switching context`);
                }
              }

              if (k !== original || syntheticAlias) {
                const suffix = getSuffix(original);
                original = this.createDataPathIndirection({
                  path: v.value,
                  useProxy: true,
                  suffix: k === original ? false
                  // Note: processLiteralSegment is false, we are responsible
                  // for deciding whether or not to prefix "."
                    : `${suffix.startsWith('[') ? '' : '.'}${suffix}`,
                  processLiteralSegment: false,
                  syntheticAlias,
                });
              } else {
                original = v.value;
              }

              synthetic = true;
            } else {
              original = trimObjectPath({
                value: original,
                repl: v.value,
              })
                .split('.').join(separator);
            }

            break;
          }
        }
      }
    }

    if (!type) {
      const contextObject = contextList[contextIndex];

      if (!contextObject[rootQualifier]) {
        // Only the scope and index qualifier should exist on the
        // contextObject
        assert(Object.keys(contextObject).length === 2);
        return { terminate: true };
      }

      let rootValue = contextObject[rootQualifier].value;

      if (hasObjectPrefix({ value: original, key: '@root' })) {
        rootValue = contextList[0][rootQualifier].declaredValue;
        original = original.replace(/^@root\.?/g, '');
      } else if (original.startsWith('@')) {
        // It is expected that any data variables must have been
        // resolved by now
        throw new Error(`Unknown data variable: ${original}`);
      }

      original = rootValue
          + (original.length && !original.startsWith('[') ? separator : '')
          + original.split('.').join(separator);

      if (original !== dataPathRoot
          && !original.startsWith(`${dataPathRoot}${separator}`)
          && !original.startsWith(`${synthethicMethodPrefix}`)
      ) {
        // This is specifically for scenarios wheere the developer may
        // try to resolve @root.[0] where @root is the root data context
        // thereby resulting in original == data[0]
        throw new Error(`Invalid path: ${prevOriginal}`);
      }

      type = 'PathExpression';

      if (stmt) {
        stmt.isResolvedPath = true;
      }
    }

    if (original === dataPathRoot) {
      original += separator;
      checkType = false;
      targetType = 'Object';
    }

    // original = this.component[processLiteralSegmentMethod]({
    //   original: original.split(separator).join('.'),
    // }).split('.').join(separator);

    // If applicable, we will then attempt to lookup
    // the original path to verify the value matches
    // the validTypes specified

    if (checkType) {
      let value;

      switch (true) {
        case synthetic:
          value = this.getSyntheticMethodValue({
            path: prevOriginal,
            method: original,
            validTypes,
          });
          break;

        case original.startsWith(synthethicMethodPrefix):

          value = this.component.resolvePath({
            fqPath: original,
            indexResolver: defaultIndexResolver,
          });

          this.component.validateType({
            path: prevOriginal,
            value,
            validTypes,
            line: stmt ? getLine(stmt) : null,
          });

          break;

        default:

          let typeSuffix = `%${validTypes.join(',')}`;

          // Append the expected type, inorder to hint our
          // resolver of what value to return for this path
          // i.e. Object or Array

          // Append scope qualifier, if available.
          if (scopeQualifier) {
            typeSuffix += `/${scopeQualifier}`;
          }

          original += typeSuffix;

          assert(hasDataPathFormat(original));
          value = this.lookupDataPath({
            fqPath: original,
            validTypes,
          });

          // use regex instead
          original = original.replace(typeSuffix, '');
          break;
      }

      targetType = value != null ? value.constructor.name : null;
    }

    return {
      original,
      type,
      targetType,
      synthetic,
    };
  }

  static hasScopeQualifier({ contextList, original }) {
    const first = original.split('.')[0];
    for (const contextObject of contextList) {
      const keys = Object.keys(contextObject);
      if (keys.filter(k => k === first).length) {
        return true;
      }
    }
    return false;
  }

  static getScopeQualifier({ contextList, index }) {
    const contextObject = index ? contextList[index] : contextList.peek();
    const keys = Object.keys(contextObject);
    for (const k of keys) {
      if (contextObject[k].scope) {
        return k;
      }
    }
    return null;
  }

  // {{this.[0]..x.[0].[0]}}
  // {{this.[0]x.[0].[0]}}
  // The above paths works - find out what they are and implement
  // accordingly
  resolvePath({
    bindParents, stmt, contextList, value, validTypes,
    syntheticAlias, scopeQualifier,
  }) {
    const {
      inlineParameterPrefix, processLiteralSegmentMethod,
      resetPathExpression, getAllValidTypes, getOuterInlineBlock,
      getPathOffset,
    } = TemplatePreprocessor;

    if (!validTypes) {
      validTypes = getAllValidTypes();
    }

    const inlineBlock = getOuterInlineBlock({ bindParents });

    if (
      stmt != null
      && inlineBlock != null
      && stmt.original.startsWith(inlineParameterPrefix)
    ) {
      resetPathExpression({
        stmt,
        original: stmt.original.replace(/^_/, ''),
        // Indicate that this path is an inline parameter. This is used if
        // the inline block is inlined within a custom context
        // to determine path expressions that are inline parameters, and then
        // transform them into a data vartiable
        properties: { parameter: true },
      });

      const param = stmt.parts[0];

      // Indicate that this is an inline parameter

      const requiredParams = inlineBlock.requiredParams || (inlineBlock.requiredParams = []);

      if (!requiredParams.includes(param)) {
        requiredParams.push(param);
      }

      this.logger.info(`Added inline parameter '${stmt.parts[0]}' for inline block: ${inlineBlock.decoratorName}`);

      return {
        // Indicate that the ast caller should not process
        // this path, as it is an inline parameter.
        terminate: true,
      };
    }

    let { type, original } = value;
    // eslint-disable-next-line no-unused-vars
    const prevOriginal = original;
    let synthetic;
    let targetType;
    let terminate;

    if (type === 'PathExpression') {
      const offset = getPathOffset({
        stmt,
        original,
        contextList,
      });
      let { index, hasOffset } = offset;

      offset.path = this.component[processLiteralSegmentMethod]({
        original: offset.path,
      });

      original = offset.path;

      const resolvedPath = this.resolvePathFromContext({
        bindParents,
        contextList,
        contextIndex: index,
        stmt,
        hasOffset,
        original,
        validTypes,
        syntheticAlias,
        scopeQualifier,
      });

      // eslint-disable-next-line prefer-destructuring
      type = resolvedPath.type;
      // eslint-disable-next-line prefer-destructuring
      original = resolvedPath.original;
      // eslint-disable-next-line prefer-destructuring
      targetType = resolvedPath.targetType;
      // eslint-disable-next-line prefer-destructuring
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
      terminate,
    };
  }

  static getIdentifier(ctx) {
    return {
      type: 'Identifier',
      name: ctx,
    };
  }

  static getRawValue(value) {
    return typeof value === 'string' ? `'${value}'` : `${value}`;
  }

  static getValue(value) {
    const { getScalarValue, getArrayValue, getObjectValue } = TemplatePreprocessor;

    switch (true) {
      case value !== Object(value):
        return getScalarValue(value);
      case value.constructor.name === 'Object':
        return getObjectValue(value);
      default:
        assert(value.constructor.name === 'Array');
        return getArrayValue(value);
    }
  }

  // Todo: Check is there is a better way to do this
  static isAstObject(value) {
    return value.constructor.name === 'Object'
      && value.type;
  }

  static getArrayValue(value) {
    const { getValue } = TemplatePreprocessor;
    return {
      type: 'ArrayExpression',
      elements: value.map(getValue, this),
    };
  }

  static getScalarValue(value) {
    const { getRawValue } = TemplatePreprocessor;
    const envelope = {
      type: value === undefined ? 'Identifier' : 'Literal',
    };

    if (value === undefined) {
      envelope.name = 'undefined';
    } else {
      envelope.value = value;
      envelope.raw = getRawValue(value);
    }
    return envelope;
  }

  static getShorthandObjectValue(identifiers) {
    return {
      type: 'ObjectExpression',
      properties: identifiers.map(identifier => ({
        type: 'Property',
        key: {
          type: 'Identifier',
          name: identifier,
        },
        computed: false,
        value: {
          type: 'Identifier',
          name: identifier,
        },
        kind: 'init',
        method: false,
        shorthand: true,
      })),
    };
  }

  static getObjectValue(json) {
    const { getIdentifier, isAstObject, getValue } = TemplatePreprocessor;
    const envelope = {
      type: 'ObjectExpression',
      properties: [],
    };
    for (const k in json) {
      if ({}.hasOwnProperty.call(json, k)) {
        const v = json[k];
        envelope.properties.push({
          type: 'Property',
          key: getIdentifier(k),
          computed: false,
          value: isAstObject(v) ? v : getValue(v),
          kind: 'init',
          method: false,
          shorthand: false,
        });
      }
    }
    return envelope;
  }

  static getVariableEnvelope(variableName) {
    const { getIdentifier } = TemplatePreprocessor;
    if (typeof variableName !== 'string') {
      throw new Error(`Unknown variable type for ${variableName}`);
    }
    return {
      type: 'VariableDeclaration',
      kind: 'const',
      declarations: [{
        type: 'VariableDeclarator',
        id: getIdentifier(variableName),
      }],
    };
  }

  static getScalarConstantAssignmentStatement(variableName, value) {
    const { getScalarValue, getVariableEnvelope } = TemplatePreprocessor;
    const envelope = getVariableEnvelope(variableName);
    envelope.declarations[0].init = getScalarValue(value);

    return envelope;
  }

  static getCallExpression({
    target, computed = false, methodName, args,
  }) {
    const init = {
      type: 'CallExpression',
      callee: {
        type: 'MemberExpression',
        computed,
        object: target ? {
          type: 'Identifier',
          name: target,
        } : {
          type: 'ThisExpression',
        },
        property: {
          type: 'Identifier',
          name: methodName,
        },
      },
      arguments: [],
    };

    if (args && args.length) {
      init.arguments = args;
    }

    return init;
  }

  /**
   * This creates a function that just returns the provided
   * expression
   */
  wrapExpressionAsMethod({
    name, addSyntheticPrefix = true, statements = [], returnExpression,
  }) {
    const { getMethodFromFunctionDeclaration } = TemplatePreprocessor;
    const ast = {
      type: 'FunctionDeclaration',
      id: {
        type: 'Identifier',
        name: name || utils.generateRandomString(),
      },
      body: {
        type: 'BlockStatement',
        body: [],
      },
      params: [],
      generator: false,
      expression: false,
      async: false,
    };

    for (const statement of statements) {
      ast.body.body.push(statement);
    }

    if (returnExpression) {
      ast.body.body.push({
        type: 'ReturnStatement',
        argument: returnExpression,
      });
    }

    this.componentAst.body[0].body.body
      .push(getMethodFromFunctionDeclaration({
        ast,
        addSyntheticPrefix,
      }));

    return ast.id.name;
  }

  static createInvocationWithContext({ contextList, methodName, args = [] }) {
    const { rootQualifier, getProxyStatement, getCallExpression } = TemplatePreprocessor;
    if (contextList && contextList.length > 1) {
      args.push(
        getProxyStatement({
          path: contextList.peek()[rootQualifier].value,
        }),
      );
    }

    return getCallExpression({
      methodName,
      args,
    });
  }

  static createMemberExpression({ property }) {
    return {
      type: 'MemberExpression',
      computed: false,
      object: {
        type: 'ThisExpression',
      },
      property,
    };
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
    syntheticAlias,
  }) {
    if (!pruneKey) {
      assert(context == null);
      pruneKey = utils.generateRandomString();
    }

    const {
      syntheticMethodPrefix,
      literalPrefix,
      getVariableEnvelope,
      getScalarConstantAssignmentStatement,
      getCallExpression,
      createMemberExpression,
      resetPathExpression,
      getProxyStatement,
      createInvocationWithContext,
      getFunctionDeclarationFromArrowFunction,
      getMethodFromFunctionDeclaration,
      isRootCtxValue,
      getValue,
    } = TemplatePreprocessor;

    // Add hash to paramList
    if (Object.keys(hash).length) {
      params.push({
        type: 'Hash',
        original: hash,
      });
    }

    const ast = {
      type: context ? 'ArrowFunctionExpression' : 'FunctionDeclaration',
      id: context ? null : {
        type: 'Identifier',
        name: utils.generateRandomString(),
      },
      params: [],
      body: {
        type: 'BlockStatement',
        body: [
          {
            type: 'ReturnStatement',
            argument: {
              type: 'CallExpression',
              callee: createMemberExpression({
                property: {
                  type: 'Identifier',
                  name: method,
                },
              }),
            },
          },
        ],
      },
      generator: false,
      expression: false,
      async: false,
    };

    const { body } = ast.body;

    const variableNames = [];

    // eslint-disable-next-line no-plusplus
    for (let i = params.length - 1; i >= 0; i--) {
      const param = params[i];

      const name = utils.generateRandomString();
      variableNames.unshift(name);

      let statement;

      switch (true) {
        case param.type.endsWith('Literal'):
          statement = getScalarConstantAssignmentStatement(name, param.original);
          break;

        case param.type === 'Hash':
          statement = this
            .getJsonAssignmentStatement({
              pruneKey,
              bindParents,
              contextList,
              variableName: name,
              hash: param.original,
            });

          if (!statement) {
            return false;
          }

          break;

        case param.type === 'PathExpression':
          if (param.processed) {
            assert(isRootCtxValue(param.original));

            // Param was already processed, in an inline block
            statement = getVariableEnvelope(name);
            statement.declarations[0].init = getProxyStatement({
              path: param.original,
            });
            continue;
          } else if (param.original.startsWith(literalPrefix)) {
            statement = getScalarConstantAssignmentStatement(
              name, param.original.replace(literalPrefix, ''),
            );
            continue;
          }

          // eslint-disable-next-line no-underscore-dangle
          let _path;

          if (this.methodNames.includes(param.original)) {
            _path = syntheticMethodPrefix + param.original;

            // The declared path expression is a method in
            // in the component class, hence invoke function

            statement = getVariableEnvelope(name);

            statement.declarations[0].init = createInvocationWithContext({
              contextList,
              methodName: param.original,
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

            if (path.type.endsWith('Literal')) {
              _path = literalPrefix + path.original;
              statement = getScalarConstantAssignmentStatement(name, path.original);
            } else {
              assert(path.type === 'PathExpression');

              _path = path.original;

              statement = getVariableEnvelope(name);
              statement.declarations[0].init = getProxyStatement({
                path: path.original,
              });
            }
          }

          // update param
          resetPathExpression({
            stmt: param,
            original: _path,
            properties: { processed: true },
          });

          break;

        case param.type === 'SubExpression':

          // eslint-disable-next-line no-shadow
          const method = param.path.original;
          this.validateMethod(method);

          statement = getVariableEnvelope(name);
          statement.declarations[0].init = {
            type: 'CallExpression',
            arguments: [],
          };

          const b = this.addParameterizedExpression({
            pruneKey,
            bindParents,
            contextList,
            context: statement.declarations[0].init,
            method,
            params: param.params,
            hash: param.hash,
          });

          if (b === false) {
            return false;
          }

          const provisionalFunction = getFunctionDeclarationFromArrowFunction({
            ast: statement.declarations[0].init.callee.clone(),
            name: utils.generateRandomString() + pruneKey,
          });

          // provisionally, add the generated function to component class ast
          this.componentAst.body[0].body.body
            .push(getMethodFromFunctionDeclaration({
              ast: provisionalFunction,
            }));

          // update param
          resetPathExpression({
            stmt: param,
            original: provisionalFunction.id.name,
            properties: { processed: true },
          });

          break;

        default:
          throw new Error(`Unknown type: ${param.type}`);
      }

      body.unshift(statement);
    }

    // add function invocation params in return statement
    body[body.length - 1].argument.arguments = [];

    for (const variableName of variableNames) {
      body[body.length - 1].argument.arguments.push({
        type: 'Identifier',
        name: variableName,
      });
    }

    if (context) {
      context.callee = ast;
    } else {
      if (syntheticAlias) {
        // eslint-disable-next-line no-shadow
        const stmt = body.peek();
        stmt.argument = getCallExpression({
          methodName: 'setSyntheticContext',
          args: [{
            alias: syntheticAlias,
            value: stmt.argument,
          }]
            .map(getValue, this),

        });
      }

      // Prune ast
      this.pruneComponentAst({ pruneKey });

      // Append method to ast
      this.componentAst.body[0].body.body
        .push(getMethodFromFunctionDeclaration({ ast }));

      const synthethicMethodName = ast.id.name;

      if (stmt) {
        // Update stmt, if available
        resetPathExpression({
          stmt,
          original: synthethicMethodName,
          properties: { processed: true },
        });
      }

      return synthethicMethodName;
    }
  }

  /**
   * This creates a json assigment from a hash object
   */
  getJsonAssignmentStatement({
    pruneKey, bindParents, contextList, variableName, hash,
  }) {
    const {
      syntheticMethodPrefix,
      literalPrefix,
      getIdentifier,
      getScalarValue,
      getVariableEnvelope,
      resetPathExpression,
      getProxyStatement,
      createInvocationWithContext,
      getFunctionDeclarationFromArrowFunction,
      getMethodFromFunctionDeclaration,
      isRootCtxValue,
    } = TemplatePreprocessor;

    const envelope = getVariableEnvelope(variableName);
    const init = {
      type: 'ObjectExpression',
      properties: [],
    };

    const getProperty = (key, value) => ({
      type: 'Property',
      key: getIdentifier(key),
      computed: false,
      value,
      kind: 'init',
      method: false,
      shorthand: false,
    });

    for (const pair of hash.pairs) {
      const { key, value } = pair;

      switch (true) {
        case value.type.endsWith('Literal'):
          init.properties.push(getProperty(key, getScalarValue(value.original)));
          break;

        case value.type === 'PathExpression':

          if (value.processed) {
            assert(isRootCtxValue(value.original));

            // Param was already processed, in an inline block
            init.properties.push(
              getProperty(key, getProxyStatement({
                path: value.original,
              })),
            );
            continue;
          } else if (value.original.startsWith(literalPrefix)) {
            init.properties.push(getProperty(key, getScalarValue(
              value.original.replace(literalPrefix, ''),
            )));
            continue;
          }

          // eslint-disable-next-line no-underscore-dangle
          let _path;

          if (this.methodNames.includes(value.original)) {
            _path = syntheticMethodPrefix + value.original;

            init.properties.push(getProperty(
              key,
              createInvocationWithContext({
                contextList,
                methodName: value.original,
              }),
            ));
          } else {
            const path = this.resolvePath({
              bindParents,
              stmt: value,
              contextList,
              value,
            });

            if (path.terminate) {
              return false;
            }

            if (path.type.endsWith('Literal')) {
              _path = literalPrefix + path.original;
              init.properties.push(getProperty(key, getScalarValue(path.original)));
            } else {
              assert(path.type === 'PathExpression');

              _path = path.original;
              init.properties.push(
                getProperty(
                  key,
                  getProxyStatement({
                    path: path.original,
                  }),
                ),
              );
            }
          }

          // update param
          resetPathExpression({
            stmt: value,
            original: _path,
            properties: { processed: true },
          });

          break;

        case value.type === 'SubExpression':

          const method = value.path.original;
          this.validateMethod(method);

          const property = getProperty(key, {
            type: 'CallExpression',
            arguments: [],
          });

          const b = this.addParameterizedExpression({
            pruneKey,
            bindParents,
            contextList,
            context: property.value,
            method,
            params: value.params,
            hash: value.hash,
          });

          if (b === false) {
            return false;
          }

          init.properties.push(property);

          const provisionalFunction = getFunctionDeclarationFromArrowFunction({
            ast: property.value.callee.clone(),
            name: utils.generateRandomString() + pruneKey,
          });

          // provisionally, add the generated function to component class ast
          this.componentAst.body[0].body.body
            .push(getMethodFromFunctionDeclaration({
              ast: provisionalFunction,
            }));

          // update param
          resetPathExpression({
            stmt: value,
            original: provisionalFunction.id.name,
            properties: { processed: true },
          });

          break;

        default:
          throw new Error(`Unknown type: ${value.type}`);
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
    const { body } = this.componentAst.body[0].body;

    // First, remove all redundant methods from class body
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < body.length; i++) {
      if (body[i].key.name.endsWith(pruneKey)) {
        delete body[i];
      }
    }

    // Then remove all method definitions that are null as
    // a result of the above operation
    const prunedBody = [];
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < body.length; i++) {
      if (body[i] != null) {
        prunedBody.push(body[i]);
      }
    }

    this.componentAst.body[0].body.body = prunedBody;
  }

  static getFunctionDeclarationFromArrowFunction({ ast, name }) {
    ast.type = 'FunctionDeclaration';
    ast.id = {
      type: 'Identifier',
      name: name || utils.generateRandomString(),
    };
    return ast;
  }

  static resetPathExpression({ stmt, original, properties = {} }) {
    stmt.clear();

    stmt.type = 'PathExpression';
    stmt.original = original;
    stmt.data = original.startsWith('@');
    stmt.depth = 0;
    stmt.parts = original.split('.');
    if (stmt.data) {
      stmt.parts[0] = stmt.parts[0].replace(/^@/g, '');
    }

    for (const k in properties) {
      if ({}.hasOwnProperty.call(properties, k)) {
        stmt[k] = properties[k];
      }
    }

    return stmt;
  }

  static getMethodFromFunctionDeclaration({ ast: expression, addSyntheticPrefix = true }) {
    // Update method name, to indicate that it's synthetic
    expression.id.name = `${addSyntheticPrefix ? TemplatePreprocessor.synthethicMethodPrefix : ''}${expression.id.name}`;

    const envelope = {
      type: 'MethodDefinition',
      key: expression.id,
      kind: 'method',
      static: false,
    };

    const program = Object.assign({}, expression);

    program.type = 'FunctionExpression';
    program.id = null;

    envelope.value = program;

    return envelope;
  }

  createBlockOperation({
    cacheKey, defaultCacheValue, path, methodName, args = {},
  }) {
    const { getCallExpression, getValue } = TemplatePreprocessor;
    if (!this.blocksData[path]) {
      this.blocksData[path] = defaultCacheValue;
    }

    // eslint-disable-next-line no-unused-vars
    const blockData = this.blocksData[path];

    // eslint-disable-next-line no-eval
    let synthethicMethodName = eval(`blockData.${cacheKey}`);

    if (!synthethicMethodName) {
      const returnExpression = getCallExpression({
        methodName,
        args: [{
          path,
          ...args,
        }]
          .map(getValue, this),
      });

      synthethicMethodName = this.wrapExpressionAsMethod({
        returnExpression,
      });

      this.helpers.push(synthethicMethodName);

      // eslint-disable-next-line no-eval
      eval(`blockData.${cacheKey} = '${synthethicMethodName}'`);
    }

    return synthethicMethodName;
  }

  createIterateDataVariable({ path, dataVariable }) {
    return this.createBlockOperation({
      cacheKey: `dataVariableMethods['${dataVariable}']`,
      path,
      methodName: 'getBlockData',
      args: { dataVariable },
    });
  }

  createIterateUpdate({ path }) {
    return this.createBlockOperation({
      cacheKey: 'updateMethod',
      path,
      methodName: 'doBlockUpdate',
    });
  }

  // eslint-disable-next-line no-unused-vars
  createIterateInit({ path, blockId }) {
    return this.createBlockOperation({
      cacheKey: 'initMethod',
      defaultCacheValue: { dataVariableMethods: {} },
      path,
      methodName: 'doBlockInit',
      args: {},
    });
  }

  addDataVariablesToContext({ contextObject, path, dataVariables }) {
    for (const qualifier in dataVariables) {
      if ({}.hasOwnProperty.call(dataVariables, qualifier)) {
        const dataVariable = dataVariables[qualifier];

        contextObject[qualifier] = {
          type: 'PathExpression',
          value: this.createIterateDataVariable({
            path,
            dataVariable,
          }),
          synthetic: true,
          lookup: false,
        };
      }
    }
  }

  createSubExpression({
    bindParents, contextList, method, params = [],
    hash = [], syntheticAlias, stmt,
  }) {
    // Process sub-expression
    // Todo: Here, the context is not passed in as last parameter

    this.validateMethod(method);

    const synthethicMethodName = this.addParameterizedExpression({
      bindParents,
      contextList,
      method,
      stmt,
      params,
      hash,
      syntheticAlias,
    });

    if (!synthethicMethodName) {
      return false;
    }

    this.helpers.push(synthethicMethodName);

    return synthethicMethodName;
  }

  static createSubExpressionFromPath({ stmt }) {
    const { createPathExpression } = TemplatePreprocessor;
    const { original } = stmt;

    stmt.clear();

    stmt.type = 'SubExpression';
    stmt.path = createPathExpression({ original });
    stmt.params = [];
    stmt.fromPath = true;

    return stmt;
  }

  static createPathFromSubExpression({ stmt }) {
    assert(
      stmt.fromPath === true
      && stmt.type === 'SubExpression',
    );
    return stmt.path;
  }

  createMethodInvocation({ contextList, path, name }) {
    // Add a synthethic method to the ast that indirects
    // the invocation call, setting the context as argument
    const { createInvocationWithContext } = TemplatePreprocessor;
    const synthethicMethodName = this.wrapExpressionAsMethod({
      name,
      returnExpression: createInvocationWithContext({
        contextList,
        methodName: path.original,
      }),
    });

    this.helpers.push(synthethicMethodName);

    path.parts = [synthethicMethodName];
    path.original = synthethicMethodName;

    return path;
  }

  static createPathExpression({ original }) {
    return {
      type: 'PathExpression',
      data: false,
      depth: 0,
      parts: [...original.split('.')],
      original,
    };
  }

  static createMustacheStatement({ original }) {
    const { createPathExpression } = TemplatePreprocessor;
    const stmt = {
      type: 'MustacheStatement',
      path: createPathExpression({ original }),
      params: [],
      // This loc value is added, due to a hbs bug whereby
      // the loc object is not added correctly, hence resulting
      // in a JSON syntax error
      // Todo: Is this still happening?
      loc: {
        start: {
          line: 0,
          column: 0,
        },
      },
    };

    stmt.path.processed = true;
    return stmt;
  }

  static getProxyStatement({ path, useProxy = false }) {
    const {
      getScalarValue, createMemberExpression,
      addRawDataPrefixToPath,
    } = TemplatePreprocessor;
    return {
      type: 'MemberExpression',
      computed: true,
      object: createMemberExpression({
        property: {
          type: 'Identifier',
          name: 'rootProxy',
        },
      }),
      property: getScalarValue(
        `${!useProxy ? addRawDataPrefixToPath(path) : path}`,
      ),
    };
  }

  /**
   * Add a helper method that resolves the path using the
   * component's proxy instance
   *
   * @param useProxy This specifies whether the result should be proxied as well
   */
  // Todo: The resulting function should be invoked on compile-time,
  // so the path can be resolved
  createDataPathIndirection({
    path, useProxy = false, suffix = false, syntheticAlias,
    processLiteralSegment = true,
  }) {
    const {
      synthethicMethodPrefix, getCallExpression,
      hasDataPathFormat, getProxyStatement, getValue,
    } = TemplatePreprocessor;

    if (!suffix.length) {
      suffix = false;
    }

    let synthethicMethodName = suffix ? null : `${hasDataPathFormat(path) ? synthethicMethodPrefix : ''}${path}`;

    if (suffix || !this.helpers.includes(synthethicMethodName)) {
      let expression = getProxyStatement({ useProxy, path });

      if (suffix) {
        synthethicMethodName = this.createDataPathIndirection0({
          expression,
          suffix,
          processLiteralSegment,
          syntheticAlias,
        });
      } else {
        if (syntheticAlias) {
          expression = getCallExpression({
            methodName: 'setSyntheticContext',
            args: [{
              alias: syntheticAlias,
              value: expression,
            }]
              .map(getValue, this),
          });
        }

        synthethicMethodName = this.wrapExpressionAsMethod({
          name: path,
          returnExpression: {
            type: 'ExpressionStatement',
            expression,
          },
        });
      }

      this.helpers.push(synthethicMethodName);
    }

    return synthethicMethodName;
  }

  createDataPathIndirection0({
    expression, suffix, processLiteralSegment, syntheticAlias,
  }) {
    const {
      processLiteralSegmentMethod, getCallExpression,
      getMethodFromFunctionDeclaration, getScalarValue,
      getValue,
    } = TemplatePreprocessor;

    const ast = {
      type: 'FunctionDeclaration',
      id: {
        type: 'Identifier',
        name: utils.generateRandomString(),
      },
      params: [],
      body: {
        type: 'BlockStatement',
        body: [
          {
            type: 'VariableDeclaration',
            declarations: [
              {
                type: 'VariableDeclarator',
                id: {
                  type: 'Identifier',
                  name: 'first',
                },
                init: expression,
              },
            ],
            kind: 'const',
          },
          {
            type: 'VariableDeclaration',
            declarations: [
              {
                type: 'VariableDeclarator',
                id: {
                  type: 'Identifier',
                  name: 'value',
                },
                init: processLiteralSegment
                  ? getCallExpression({
                    methodName: processLiteralSegmentMethod,
                    args: [getScalarValue(`first.${suffix}`)],
                  })
                  : getScalarValue(`first${suffix}`),
              },
            ],
            kind: 'const',
          },
          {
            type: 'ReturnStatement',
            argument: {
              type: 'CallExpression',
              callee: {
                type: 'Identifier',
                name: 'eval',
              },
              arguments: [
                {
                  type: 'Identifier',
                  name: 'value',
                },
              ],
            },
          },
        ],
      },
      generator: false,
      expression: false,
      async: false,
    };

    if (syntheticAlias) {
      const { body } = ast.body;
      const stmt = body.peek();
      stmt.argument = getCallExpression({
        methodName: 'setSyntheticContext',
        args: [{
          alias: syntheticAlias,
          value: stmt.argument,
        }]
          .map(getValue, this),

      });
    }

    this.componentAst.body[0].body.body
      .push(getMethodFromFunctionDeclaration({ ast }));

    return ast.id.name;
  }

  getBlockParam(stmt, index) {
    const { getReservedQualifierNames } = TemplatePreprocessor;
    const { blockParams } = stmt.program;
    const qualifier = blockParams && blockParams.length > index
      ? blockParams[index] : null;

    if (qualifier && this.methodNames.includes(qualifier)
    ) {
      throw new Error(
        `The qualifier: '${qualifier}' already exists as a named method`,
      );
    }

    if (getReservedQualifierNames().includes(qualifier)) {
      throw new Error(
        `The qualifier: '${qualifier}' is an internal qualifer and is not allowed`,
      );
    }

    return qualifier;
  }

  getBlockQualifiers({ stmt }) {
    const scopeQualifier = this.getBlockParam(stmt, 0);
    const indexQualifier = this.getBlockParam(stmt, 1);

    return {
      scopeQualifier,
      indexQualifier,
    };
  }

  addBlockParamHashKey({ stmt }) {
    const { blockParamHashKey, createStringLiteral } = TemplatePreprocessor;

    const hash = stmt.hash || (stmt.hash = { type: 'Hash', pairs: [] });

    if (hash.pairs.filter(pair => pair.key === blockParamHashKey).length) {
      throw new Error(`Hashkey '${blockParamHashKey}' is not allowed`);
    }

    const key = this.getBlockQualifiers({ stmt }).scopeQualifier;

    assert(key != null);

    hash.pairs.push({
      type: 'HashPair',
      key: blockParamHashKey,
      value: createStringLiteral(key),
    });

    return key;
  }

  validateCustomBlock({ stmt }) {
    assert(!stmt.program.inverse);

    // Ensure that the path is a valid component method
    this.validateMethod(stmt.path.original);

    if (stmt.program.blockParams.length !== 1) {
      throw new Error(`Please provide one block parameter for block: ${stmt.path.original}`);
    }
  }

  updateCustomBlockHeaders({ stmt }) {
    const { createPathExpression } = TemplatePreprocessor;
    this.validateCustomBlock({ stmt });

    const scopeQualifier = this.addBlockParamHashKey({ stmt });

    delete stmt.program.blockParams;

    // Rewrite custom block path
    stmt.path = createPathExpression({
      original: this.createCustomBlockPath({
        methodName: stmt.path.original,
      }),
    });
    stmt.path.processed = true;

    return scopeQualifier;
  }

  static getHashValue({ stmt, key, cleanup = false }) {
    if (stmt.hash) {
      const { pairs } = stmt.hash;
      // eslint-disable-next-line no-plusplus
      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        if (pair.key === key) {
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
    methodName,
  }) {
    const {
      getIdentifier, getShorthandObjectValue,
      getCallExpression, getMethodFromFunctionDeclaration,
      getValue,
    } = TemplatePreprocessor;
    const ast = {
      type: 'FunctionDeclaration',
      id: {
        type: 'Identifier',
        name: utils.generateRandomString(),
      },
      params: [],
      body: {
        type: 'BlockStatement',
        body: [{
          type: 'VariableDeclaration',
          declarations: [
            {
              type: 'VariableDeclarator',
              id: { type: 'Identifier', name: 'params' },
              init: getCallExpression({
                target: 'Array',
                methodName: 'from',
                args: [{ type: 'Identifier', name: 'arguments' }],
              }),
            }],
          kind: 'const',
        },
        {
          type: 'VariableDeclaration',
          declarations: [
            {
              type: 'VariableDeclarator',
              id: { type: 'Identifier', name: 'options' },
              init: getCallExpression({
                target: 'params',
                methodName: 'pop',
              }),
            }],
          kind: 'const',
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
            },
          ],
          kind: 'const',
        },
        {
          type: 'VariableDeclaration',
          declarations: [
            {
              type: 'VariableDeclarator',
              id: { type: 'Identifier', name: 'data' },
              init: getCallExpression({
                computed: true,
                methodName: 'methodName',
                args: [{
                  type: 'SpreadElement',
                  argument: {
                    type: 'Identifier',
                    name: 'params',
                  },
                }],
              }),
            },
          ],
          kind: 'const',
        },
        {
          type: 'ExpressionStatement',
          expression: getCallExpression({
            methodName: 'validateType',
            args: [{
              path: getIdentifier('methodName'),
              value: getIdentifier('data'),
            }]
              .map(getValue, this),

          }),
        },
        {
          type: 'ReturnStatement',
          argument: getCallExpression({
            methodName: 'renderBlock',
            args: [getShorthandObjectValue(['data', 'options'])],
          }),
        }],
      },
      generator: false,
      expression: false,
      async: false,
    };

    this.componentAst.body[0].body.body
      .push(getMethodFromFunctionDeclaration({ ast }));

    this.helpers.push(ast.id.name);

    return ast.id.name;
  }

  static getAllValidTypes() {
    const {
      literalType, arrayType, objectType, mapType,
    } = TemplatePreprocessor;
    return [literalType, arrayType, objectType, mapType];
  }

  getBlockOptions(stmt) {
    const {
      getAllValidTypes, ensureNoHash, getLine, ensureNoLiteralParams,
      arrayType, objectType, mapType,
    } = TemplatePreprocessor;
    const {
      scopeQualifier, indexQualifier,
    } = this.getBlockQualifiers({ stmt });

    let validTypes = [];
    let contextSwitching = false;
    let replacementPath = null;
    let canIterate = false;
    let conditional = false;
    let custom = false;
    let requiresScopeQualifier = true;
    let allowLiteralParams = false;

    switch (stmt.path.original) {
      case 'unless':
      case 'if':
        validTypes = getAllValidTypes();
        conditional = true;
        requiresScopeQualifier = false;
        allowLiteralParams = true;
        break;

      case 'each':
        validTypes = [indexQualifier ? arrayType : mapType];
        contextSwitching = true;
        canIterate = true;

        break;

      case 'with':
        validTypes = [objectType];
        contextSwitching = true;
        replacementPath = 'if';
        // Set this as a conditional, since it will
        // be transformed to an if
        conditional = true;

        break;
      default:
        custom = true;
        allowLiteralParams = true;

        if (!stmt.params.length) {
          stmt.params = [{
            depth: 0,
            data: false,
            type: 'PathExpression',
            original: 'this',
            parts: ['this'],
          }];
        }

        break;
    }

    if (!custom) {
      // hbs allows hashes on well-knonw blocks by default
      // however, these hashes are not referenceable from
      // inside the block, hence we want to explicitly reject hashes
      ensureNoHash({ stmt });

      // Block params are no longer useful at this point
      delete stmt.program.blockParams;
    }

    if (!allowLiteralParams) {
      ensureNoLiteralParams({ stmt });
    }

    if (requiresScopeQualifier && !scopeQualifier) {
      // This is either an #with, #each or custom block
      throw new Error(`Scope qualifier must be specified on line: ${getLine(stmt)}`);
    }


    if (contextSwitching
      && stmt.params[0].type.endsWith('Literal')) {
      throw new Error(`A literal parameter cannot be used on line: ${getLine(stmt)}`);
    }

    return {
      validTypes,
      contextSwitching,
      scopeQualifier,
      indexQualifier,
      canIterate,
      replacementPath,
      conditional,
      custom,
    };
  }

  static ensureNoHash({ stmt }) {
    const { getLine } = TemplatePreprocessor;
    const { hash } = stmt;
    if (hash && hash.pairs && hash.pairs.length) {
      throw new Error(`Hashes are not allowed for a #${stmt.path.original} block, line: ${getLine(stmt)}`);
    }
  }

  static ensureNoLiteralParams({ stmt }) {
    const { getLine } = TemplatePreprocessor;
    stmt.params.forEach((param) => {
      // eslint-disable-next-line default-case
      switch (true) {
        case param.type.endsWith('Literal'):
          throw new Error(`#${stmt.path.original} cannot contain a ${param.type} param, line: ${getLine(stmt)}`);

        case param.type.endsWith('PathExpression')
          && param.original === '':
          // PathExpression == []
          throw new Error(`#${stmt.path.original} cannot contain an empty ${param.type} param, line: ${getLine(stmt)}`);
      }
    });
  }

  getSyntheticMethodValue({ path, method, validTypes = [] }) {
    // Allow hbs engine to attempt to resolve this synthetic method
    // Todo: remove, not necessary to add here
    this.dataPaths.push(method);

    // we need to serialize, so we can invoke the method
    // to get it's returned type (for validation purpose)

    this.serializeAst();

    const value = this.component[method]();

    // Remove from dataPaths. Note, that it will be re-added
    // later, after any necessary transformation has been done.
    // e.g. if it's a custom block param - after
    // rawDataPrefix has been prepended
    const i = this.dataPaths.indexOf(method);

    assert(i >= 0);
    this.dataPaths.splice(i, 1);

    return this.component.validateType({
      path,
      value,
      validTypes,
    });
  }

  static isRootCtxValue(value) {
    const { synthethicMethodPrefix, hasDataPathFormat } = TemplatePreprocessor;
    return hasDataPathFormat(value) || value.startsWith(synthethicMethodPrefix);
  }

  /**
   * This is called when resolving params in the root context. It
   * ensures that any available inline parameters appear at the end of the list
   */
  // Todo: make this static
  ensureParamsOrder({ params, bindParents }) {
    const { inlineParameterPrefix, getOuterInlineBlock, getLine } = TemplatePreprocessor;

    if (getOuterInlineBlock({ bindParents }) == null) {
      // Inline parameters must be in an inline block
      return false;
    }

    let allowNonInline = true;

    for (const param of params) {
      switch (true) {
        case param.type.endsWith('Literal'):
          break;

        case param.type === 'PathExpression':
          if (param.original.startsWith(inlineParameterPrefix)) {
            allowNonInline = false;
          } else if (!allowNonInline) {
            throw new Error(`The param: ${param.original} is in an invalid position, line: ${getLine(param)}`);
          }
          break;

        case param.type === 'SubExpression':
          this.ensureParamsOrder({ params: param.params, bindParents });
          break;

        default:
          throw new Error(`Unknown type: ${param.type}`);
      }
    }

    return !allowNonInline;
  }

  static addRawDataPrefixToPath0(original) {
    const {
      pathSeparator, dataPathRoot,
      rawDataPrefix, synthethicMethodPrefix,
    } = TemplatePreprocessor;

    const arr = original.split('.');
    const index = arr.length - 1;

    const arr2 = arr[index].split(pathSeparator);

    if (arr2[0] === dataPathRoot) {
      if (!arr2[1].startsWith(rawDataPrefix)) {
        arr2[1] = `${rawDataPrefix}${arr2[1]}`;
      }
    } else if (!arr2[0].startsWith(rawDataPrefix)) {
      assert(arr2[0].startsWith(synthethicMethodPrefix));
      arr2[0] = `${rawDataPrefix}${arr2[0]}`;
    }

    arr[index] = arr2.join(pathSeparator);

    return arr.join('.');
  }

  static addRawDataPrefixToPath(stmt) {
    const {
      addRawDataPrefixToPath0, hasDataPathFormat,
      addRawDataPrefixToPath, resetPathExpression,
    } = TemplatePreprocessor;

    if (stmt.constructor.name === 'String') {
      return addRawDataPrefixToPath({
        type: 'PathExpression',
        original: stmt,
      }).original;
    }

    if (stmt.type === 'SubExpression' && stmt.fromPath) {
      resetPathExpression({
        stmt,
        original: stmt.path.original,
      });
    }

    if (stmt.type !== 'PathExpression') {
      return stmt;
    }

    let { original } = stmt;

    if (hasDataPathFormat(original)) {
      original = addRawDataPrefixToPath0(original);
    }

    resetPathExpression({
      stmt,
      original,
    });

    return stmt;
  }

  static isLookupAllowed(targetType) {
    const { arrayType, objectType } = TemplatePreprocessor;
    return targetType === arrayType || targetType === objectType;
  }

  process0({
    contextList,
    bindParents,
    ast,
  }) {
    const {
      rootQualifier,
      allowRootAccessHashKey,
      allowRootAccessByDefault,
      storeContextBlockName,
      loadContextBlockName,
      syntheticAliasSeparator,
      dataPathRoot,
      pathSeparator,
      inlineParameterPrefix,
      partialIdHash,
      partialNameHash,
      processLiteralSegmentMethod,
      literalPrefix,
      synthethicMethodPrefix,
      blockParamHashKey,
      resolveLiteralsWithProxy,
      trimObjectPath,
      hasObjectPrefix,
      getCallExpression,
      addRawDataPrefixToPath0,
      addRawDataPrefixToPath,
      resetPathExpression,
      createInvocationWithContext,
      createPathFromSubExpression,
      createPathExpression,
      createSubExpressionFromPath,
      createMustacheStatement,
      getHashValue,
      ensureNoHash,
      isLookupAllowed,
      getSuffix,
      getAvailableInlineBlocks,
      getOuterInlineBlock,
      visitNodes,
      getLine,
      replaceNodes,
      getContextSwitchingHelpers,
      getReservedBlockNames,
      getHandleBarsBlockHelpers,
      getPathOffset,
      getReservedPartialHashes,
      getValue,
      getDefaultStripOptions,
      createStringLiteral,
      createLiteral,
      isRootCtxValue,
    } = TemplatePreprocessor;

    // Validate all PathExpressions
    visitNodes({
      types: ['PathExpression'],
      ast,
      consumer: ({ stmt }) => {
        if (!stmt.processed) {
          const { validatePath } = TemplatePreprocessor;
          validatePath(stmt.original);
          assert(!isRootCtxValue(stmt.original));
        }
      },
    });

    const customBlockCtx = [{
      value: false,
    }];

    // eslint-disable-next-line no-underscore-dangle
    const _this = this;

    const replacements = [];

    const { Visitor } = handlebars;

    function ASTParser() {
    }
    ASTParser.prototype = new Visitor();

    const isCustomContext = () => this.customBlockCtx || customBlockCtx.peek().value;

    const allowRootAccess = ({ stmt } = {}) => {
      if (stmt) {
        const allow = getHashValue({
          stmt, key: allowRootAccessHashKey,
        }) || { original: allowRootAccessByDefault };

        return !!allow.original;
      }

      return this.allowRootAccess || customBlockCtx.peek().allowRootAccess;
    };

    const isPathUnconstrained = ({ stmt }) => {
      // Check context keys both in the outer root context, as well
      // as those that may have been added through partial hashes
      for (const contextObj of contextList) {
        if (Object.keys(contextObj).includes(stmt.original.split('.')[0])) {
          return false;
        }
      }
      return true;
    };

    const getQualifiers = ({ stmt }) => {
      const qualifiers = [];

      const { scopeQualifier, indexQualifier } = _this.getBlockQualifiers({ stmt });

      if (scopeQualifier) {
        qualifiers.push(scopeQualifier);
      }
      if (indexQualifier) {
        qualifiers.push(indexQualifier);
      }

      return qualifiers;
    };

    const acceptPathExpressionInCustomCtx = ({ stmt }) => {
      const prev = stmt.original;

      if (stmt.processed) {
        return stmt;
      }

      if (this.methodNames.includes(prev)) {
        if (isPathUnconstrained({ stmt })) {
          // create method invocation indirection
          this.createMethodInvocation({
            contextList,
            path: stmt,
            name: stmt.original,
          });

          const expr = createSubExpressionFromPath({
            stmt,
          });

          expr.path.processed = true;
          return expr;
        }
        this.logger.warn(`The path: ${prev} is constrained and cannot be registered as a helper`);
      }

      if (prev.startsWith(inlineParameterPrefix)) {
        throw new Error(`Inline parameters are not allowed in custom context: ${prev.split('.')[0]}`);
      }

      const offset = getPathOffset({
        stmt,
        original: stmt.original,
        contextList,
      });
      let { index, path: original, hasOffset } = offset;

      // i.e. {{xyx}}, not {{./xyz}} or {{../xyz}}
      const isPurePath = original.startsWith('@')
        || (index === contextList.length - 1 && !hasOffset
          && !original.startsWith('['));

      if (original.split('.')[0] === '@root') {
        assert(isPurePath, `${stmt.original} should be a pure path, line: ${getLine(stmt)}`);

        // We want to transform @root to reference the nearest
        // custom context scope qualifier

        // eslint-disable-next-line no-plusplus
        for (let j = contextList.length - 1; j >= 0; j--) {
          const contextObject = contextList[j];
          const contextKey = Object.keys(contextObject)[0];

          if (contextObject[contextKey].asVariable) {
            const arr = original.split('.');
            arr.splice(0, 1);
            let suffix = arr.join('.');

            if (suffix.length) {
              suffix = `.${suffix}`;
            }

            resetPathExpression({
              stmt,
              original: `@${contextKey}${suffix}`,
              properties: {
                processed: true,
              },
            });

            return stmt;
          }
        }
      }

      const contextObjects = [];

      if (isPurePath) {
        // eslint-disable-next-line no-plusplus
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
          const rootQualifierIndex = contextKeys.indexOf(rootQualifier);

          if (rootQualifierIndex >= 0) {
            contextKeys.splice(rootQualifierIndex, 1);
          }

          for (const k of contextKeys) {
            const v = contextObject[k];

            if (hasObjectPrefix({
              value: original,
              key: k,
              rangeAllowed: !!v.lookup,
            })
            ) {
              if (!contextObject[rootQualifier]) {
                if (v.asVariable) {
                  // {original} is a scope qualifier in a custom context
                  resetPathExpression({
                    stmt,
                    original: `@${original}`,
                    properties: {
                      processed: true,
                    },
                  });
                } else {
                  // {original} is either a scope or index qualifier
                  // for a pending context.
                  // This will be processed later
                }

                return stmt;
              }

              if (!allowRootAccess()) {
                throw new Error(`Root access is not permitted for path: ${k}`);
              }

              if (v.type.endsWith('Literal')) {
                assert(k === original && v.lookup === false);

                stmt = {
                  ...stmt,
                  type: v.type,
                  original: v.value,
                  parts: [v.value],
                };
              } else if (v.synthetic) {
                stmt.original = this.createDataPathIndirection({
                  stmt,
                  path: v.value,
                  useProxy: false,
                  suffix: k === original ? false : getSuffix(original),
                  processLiteralSegment: true,
                });

                const expr = createSubExpressionFromPath({
                  stmt,
                });

                expr.path.processed = true;
              } else {
                original = this.component[processLiteralSegmentMethod]({ original });
                resetPathExpression({
                  stmt,
                  original: addRawDataPrefixToPath(
                    trimObjectPath({
                      value: original,
                      repl: v.value,
                    }).split('.').join(pathSeparator),
                  ),
                  properties: {
                    processed: true,
                  },
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
          throw new Error(`Root access is not permitted, path: ${prev}, line: ${getLine(stmt)}`);
        }

        const rootValue = contextObject[rootQualifier].value;
        original = this.component[processLiteralSegmentMethod]({ original });

        original = rootValue
        + (original.length && !original.startsWith('[') ? pathSeparator : '')
        + original.split('.').join(pathSeparator);

        if (original !== dataPathRoot
          && !original.startsWith(`${dataPathRoot}${pathSeparator}`)
          && !original.startsWith(`${synthethicMethodPrefix}`)
        ) {
        // This is specifically for scenarios wheere the developer may
        // try to resolve @root.[0] where @root is the root data context
        // thereby resulting in original == data[0]
          throw new Error(`Invalid path: ${prev}`);
        }

        if (original === dataPathRoot) {
          original += pathSeparator;
        }

        resetPathExpression({
          stmt,
          original: addRawDataPrefixToPath(original),
          properties: {
            processed: true,
          },
        });
      }

      return stmt;
    };

    const acceptPathExpressionInRootCtx = ({ stmt }) => {
      if (stmt.processed) {
        return stmt;
      }

      let { type, original } = stmt;
      console.info(type, original);

      let synthetic = false;
      let lookup = false;

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

        lookup = value !== null && value !== undefined && isLookupAllowed(value.constructor.name);
      } else {
        const path = _this.resolvePath({
          bindParents,
          contextList,
          stmt,
          value: stmt,
        });

        if (path) {
          // eslint-disable-next-line prefer-destructuring
          type = path.type;
          // eslint-disable-next-line prefer-destructuring
          original = path.original;
          // eslint-disable-next-line prefer-destructuring
          synthetic = path.synthetic;
          lookup = isLookupAllowed(path.targetType);
        } else {
          type = null;
        }
      }

      switch (true) {
        case type === 'PathExpression':
          return resetPathExpression({
            stmt,
            original,
            properties: {
              type,
              synthetic,
              lookup,
              processed: true,
              isResolvedPath: !!stmt.isResolvedPath,
            },
          });
        case type && type.endsWith('Literal'):
          return resolveLiteralsWithProxy ? {
            ...createPathExpression({
              original: `${dataPathRoot}${pathSeparator}${literalPrefix}${original}`
            }),
            processed: true,
            lookup: false,
          } : createLiteral({ type, original });
        default:
          return stmt;
      }
    };

    const visitProcessedBlock = ({ stmt }) => {
      const hasContextList = !!stmt.contextObject;
      const hasCustomBlockCtx = !!stmt.customBlockCtx;

      if (hasContextList) {
        contextList.push(stmt.contextObject);
      }

      if (hasCustomBlockCtx) {
        customBlockCtx.push(stmt.customBlockCtx);
      }

      bindParents.push({ type: stmt.type, body: stmt.program.body, parent: bindParents.peek() });

      this.acceptKey(stmt, 'program');

      bindParents.pop();

      if (hasCustomBlockCtx) {
        customBlockCtx.pop();
      }

      if (hasContextList) {
        contextList.pop();
      }

      return stmt;
    };

    const visitDeferredBlock = ({ stmt }) => {
      const { original } = stmt.path;

      const custom = !getHandleBarsBlockHelpers().includes(original);
      const contextSwitching = custom || getContextSwitchingHelpers().includes(original);

      if (contextSwitching) {
        const { scopeQualifier, indexQualifier } = this.getBlockQualifiers({ stmt });

        // Add a provisional context object
        const contextObject = {};
        contextObject[scopeQualifier] = { lookup: true, scope: true };

        if (indexQualifier) {
          contextObject[indexQualifier] = { lookup: false };
        }

        contextList.push(contextObject);
      }

      if (custom) {
        customBlockCtx.push({
          value: true,
          allowRootAccess: allowRootAccess({ stmt }),
        });
      }

      // Todo: this may be necessary because we don't process
      // partials within inline blocks anyway
      bindParents.push({ type: stmt.type, body: stmt.program.body, parent: bindParents.peek() });

      this.acceptKey(stmt, 'program');

      bindParents.pop();

      if (custom) {
        customBlockCtx.pop();
      }

      if (contextSwitching) {
        contextList.pop();
      }

      return stmt;
    };

    const toCanonical = (original) => {
      let isRoot = true;
      for (const contextObject of contextList) {
        if (contextObject[rootQualifier].ctxSwitching) {
          isRoot = false;
        }
      }
      return isRoot ? `${dataPathRoot}.${original}` : original;
    };

    ASTParser.prototype.PathExpression = function (stmt) {
      this.mutating = true;

      const fn = isCustomContext() ? acceptPathExpressionInCustomCtx
        : acceptPathExpressionInRootCtx;

      return fn({
        stmt,
      });
    };

    ASTParser.prototype.SubExpression = function (stmt) {
      if (stmt.path.type.endsWith('Literal')) {
        // If path is a Literal, convert to PathExpression
        _this.resetPathExpression({ stmt: stmt.path, original: stmt.path.original });
      }

      if (isCustomContext()) {
        _this.validateMethod(stmt.path.original);

        if (!isPathUnconstrained({ stmt: stmt.path })) {
          throw new Error(`Path ${stmt.path.original} must be unconstrained`);
        }

        Visitor.prototype.SubExpression.call(this, stmt);

        this.mutating = true;

        stmt.path = createPathFromSubExpression({
          stmt: stmt.path,
        });
      } else {
        this.mutating = true;

        const { original: prev } = stmt.path;

        _this.ensureParamsOrder({
          bindParents, params: stmt.params || [],
        });

        _this.createSubExpression({
          bindParents,
          contextList,
          stmt,
          method: stmt.path.original,
          params: stmt.params || [],
          hash: stmt.hash || [],
        });

        if (stmt.type === 'PathExpression') {
          stmt.synthetic = true;
          const value = _this.getSyntheticMethodValue({
            path: prev,
            method: stmt.original,
          });
          stmt.lookup = value !== null && value !== undefined
            && isLookupAllowed(value.constructor.name);
        }
      }

      return stmt;
    };

    ASTParser.prototype.BlockStatement = function (stmt) {
      this.mutating = true;

      const addCustomBlockCtx = () => {
        if (stmt.contextObject) {
          customBlockCtx.push(stmt.customBlockCtx);
          contextList.push(stmt.contextObject);

          return;
        }

        if (getReservedBlockNames().includes(stmt.path.original)) {
          throw new Error(`The block name: ${stmt.path.original} is reserved, line: ${getLine(stmt)}`);
        }

        stmt.customBlockCtx = {
          value: true,
          allowRootAccess: allowRootAccess({ stmt }),
        };

        customBlockCtx.push(stmt.customBlockCtx);

        const contextObj = {};

        contextObj[_this.updateCustomBlockHeaders({ stmt })] = {
          lookup: true,
          asVariable: true,
          scope: true,
        };

        if (stmt.hash) {
          for (const pair of stmt.hash.pairs
            // eslint-disable-next-line no-shadow
            .filter(pair => pair.key !== blockParamHashKey)) {
            contextObj[pair.key] = {
              // Todo: use a better better for "lookup"
              lookup: !pair.value.type.endsWith('Literal'),
              asVariable: true,
            };
          }
        }
        contextList.push(contextObj);

        stmt.contextObject = contextObj;
      };

      if (isCustomContext()) {
        let hasContextList = false;
        let hasCustomBlockCtx = false;

        const qualifiers = getQualifiers({ stmt });

        // If this block is inside an inline block, update <blockQualifiers>
        const inlineBlock = getOuterInlineBlock({ bindParents });
        if (inlineBlock) {
          const arr = inlineBlock.blockQualifiers || (inlineBlock.blockQualifiers = []);
          for (const qualifier of qualifiers) {
            if (!arr.includes(qualifier)) {
              arr.push(qualifier);
            }
          }
        }

        this.acceptArray(stmt.params);

        switch (true) {
          case !getHandleBarsBlockHelpers().includes(stmt.path.original):
            this.acceptKey(stmt, 'hash');

            addCustomBlockCtx();

            hasCustomBlockCtx = true;
            hasContextList = true;

            break;

          case getContextSwitchingHelpers().includes(stmt.path.original):
            const contextObj = {};

            if (!qualifiers[0]) {
              throw new Error(`Scope qualifier for #${stmt.path.original} block must be specified on line: ${getLine(stmt)}`);
            }

            contextObj[qualifiers[0]] = {
              lookup: true,
              scope: true,
            };

            if (qualifiers[1]) {
              contextObj[qualifiers[1]] = {
                lookup: false,
              };
            }

            contextList.push(contextObj);
            hasContextList = true;

          // eslint-disable-next-line no-fallthrough
          default:
            ensureNoHash({ stmt });
            break;
        }


        bindParents.push({ type: stmt.type, body: stmt.program.body, parent: bindParents.peek() });

        this.acceptKey(stmt, 'program');

        bindParents.pop();

        if (hasContextList) {
          contextList.pop();
        }

        if (hasCustomBlockCtx) {
          customBlockCtx.pop();
        }

        return stmt;
      }

      if (stmt.partialSkip) {
        return stmt;
      }

      if (stmt.processed) {
        return visitProcessedBlock({ stmt });
      }

      const {
        validTypes,
        contextSwitching,
        scopeQualifier,
        indexQualifier,
        canIterate,
        replacementPath,
        conditional,
        custom,
      } = _this.getBlockOptions(stmt);

      // eslint-disable-next-line no-shadow
      const resolvePathParam = ({ blockName, stmt }) => {
        let isSynthetic = stmt.type === 'SubExpression'
          || (stmt.type === 'PathExpression' && _this.methodNames.includes(stmt.original));

        let path; let
          syntheticAlias;

        if (isSynthetic) {
          if (contextSwitching) {
            syntheticAlias = `${blockName}${syntheticAliasSeparator}${utils.generateRandomString()}`;
          }
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
            }),
          };

          if (path.original === false) {
            return false;
          }

          // Notice that if this is a contextSwitching statement,
          // setSyntheticContext(..) is called
          const value = _this.getSyntheticMethodValue({
            path: method,
            method: path.original,
            validTypes,
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
            scopeQualifier,
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

          if (type !== 'PathExpression') {
            throw new Error(`A ${type} cannot be the target of the 
                                        ${blockName} block`);
          }
        }

        // Update stmt

        if (type === 'PathExpression') {
          // eslint-disable-next-line no-underscore-dangle
          let _original = `${toCanonical(original)}`;

          if (custom) {
            // When processing param(s) of a custom block, we
            // want to return the underlying object, rather than
            // our proxy
            _original = addRawDataPrefixToPath0(_original);
          }

          // Allow hbs engine to attempt to resolve this data path
          _this.dataPaths.push(_original.replace(`${dataPathRoot}.`, ''));

          resetPathExpression({
            stmt,
            original: _original,
            properties: {
              processed: true,
            },
          });
        } else {
          assert(type.endsWith('Literal'));

          stmt.clear();

          stmt.type = type;
          stmt.original = original;
        }

        return {
          isSynthetic, syntheticAlias, type, original, targetType,
        };
      };

      let hasInlineParam = _this.ensureParamsOrder({
        bindParents, params: stmt.params,
      });

      let paths = [...stmt.params];

      if (custom) {
        // Add hash values, if present
        const { hash } = stmt;
        if (hash) {
          hash.pairs.forEach((pair) => {
            paths.push(pair.value);
          });
        }
      }

      // Removed already processed params
      paths = paths.filter(path => path.processed === undefined);

      // There should be at least one unprocessed param
      assert(paths.length);

      paths = paths.filter(path => !path.type.endsWith('Literal'));

      let resolvedPath;

      for (const path of paths) {
        resolvedPath = resolvePathParam({
          blockName: stmt.path.original,
          stmt: path,
        });

        if (!resolvedPath) {
          // As you can imagine, there are scenarios when a block
          // may not itself declare any inline parameters as part of
          // it's own parameter list, but becuase it reference a block
          hasInlineParam = true;
        }
      }

      if (hasInlineParam) {
        return visitDeferredBlock({ stmt });
      }

      let {
        isSynthetic, syntheticAlias, type, original, targetType,
      } = (
        resolvedPath
          // resolvedPath will be undefined if this is a #if, #unless or
          // custom block and all param(s) are literal types
          || {}
      );

      if (contextSwitching) {
        const contextObject = {};

        if (isSynthetic) {
          original = _this.wrapExpressionAsMethod({
            returnExpression: getCallExpression({
              methodName: 'getSyntheticContext',
              args: [{
                alias: syntheticAlias,
                key: 'current',
              }]
                .map(getValue, _this),
            }),
          });

          // We need to serialize, so that sub-paths
          // can properly resolve

          _this.serializeAst();
        }

        if (canIterate) {
          // Todo: Implement this
          const blockId = undefined;

          const parent = bindParents.peek();

          const doBlockInitMethod = _this.createIterateInit({
            path: syntheticAlias || original.replace(`${dataPathRoot}${pathSeparator}`, ''),
            blockId,
          });

          const doBlockUpdateMethod = _this.createIterateUpdate({
            path: syntheticAlias || original.replace(`${dataPathRoot}${pathSeparator}`, ''),
          });


          // At the top of the #each block, invoke doBlockInit(..)
          replacements.push({
            parent: parent.body,
            replacementIndex: parent.body.indexOf(stmt),
            replacementNodes: [
              createMustacheStatement({
                original: doBlockInitMethod,
              }),
              stmt],
          });

          // At the top of the #each body, doBlockUpdate(..)
          stmt.program.body.unshift(
            createMustacheStatement({
              original: doBlockUpdateMethod,
            }),
          );

          _this.serializeAst();
          _this.component[doBlockInitMethod]();
          _this.component[doBlockUpdateMethod]();

          // Register context qualifiers, which in hbs
          // is synonymous to data variables

          const dataVariables = {
            '@first': '@first',
            '@last': '@last',
            '@index': '@index',
            '@key': '@key',
          };

          // Register index qualifier
          if (indexQualifier) {
            assert(targetType === 'Array');
            dataVariables[indexQualifier] = '@index';
          }

          // Register data variables in context object
          _this.addDataVariablesToContext({
            contextObject,
            path: syntheticAlias || original.replace(`${dataPathRoot}${pathSeparator}`, ''),
            dataVariables,
          });
        }

        original += (isSynthetic || !canIterate) ? '_@' : '_$';

        // Add scope qualifier
        if (scopeQualifier) {
          contextObject[scopeQualifier] = {
            type,
            value: original,
            lookup: true,
            scope: true,
          };
        }

        // Add root qualifier
        contextObject[rootQualifier] = {
          type,
          value: original,
          lookup: true,
          ctxSwitching:
            // Note: that #with blocks will be transformed to #if, so
            // hbs will not switch context on runtime
            canIterate,
        };

        contextList.push(contextObject);

        stmt.contextObject = contextObject;
      }

      if (custom) {
        addCustomBlockCtx();
      }

      bindParents.push({ type: stmt.type, body: stmt.program.body, parent: bindParents.peek() });

      this.acceptKey(stmt, 'program');

      bindParents.pop();

      if (custom) {
        customBlockCtx.pop();
        contextList.pop();
      }

      if (contextSwitching) {
        contextList.pop();
      }

      this.acceptKey(stmt, 'inverse');

      if (replacementPath) {
        stmt.path.original = replacementPath;
        stmt.path.parts = [replacementPath];
      }

      if (conditional && type === 'PathExpression') {
        // Note: the existing can either be data path or
        // synthetic method,
        // i.e. analyzeCondition(...)

        const synthethicMethodName = _this.wrapExpressionAsMethod({
          returnExpression: createInvocationWithContext({
            contextList,
            methodName: 'analyzeCondition',
            args: [{
              path: stmt.params[0].original
                .replace(`${dataPathRoot}.`, '')
                // If this is a data path
                .replace(`${dataPathRoot}${pathSeparator}`, ''),
            }]
              .map(getValue, _this),
          }),
        });
        stmt.params[0] = createPathExpression({
          // hbs will only attempt to resolve as a property
          // and not as a property or helper
          original: toCanonical(synthethicMethodName),
        });

        // Allow hbs engine to attempt to resolve this synthetic method
        _this.dataPaths.push(synthethicMethodName);

        // Todo: If stmt.params[0].original is a synthetic method,
        // we no longer it in _this.dataPaths
      }

      stmt.processed = true;

      return canIterate ? false : stmt;
    };

    ASTParser.prototype.MustacheStatement = function (stmt) {
      if (stmt.path.processed) {
        return;
      }

      if (stmt.path.type.endsWith('Literal')) {
        // This is prohibited because attackers can bypass path validation,
        // since literals are generally not validated like PathExpressions are
        // and prefix data__ to the path, tricks the proxy into
        // performing arbitrary lookup
        throw new Error(`Invalid path: '${
          stmt.path.original
        }'. Only a PathExpression must be used in a MustacheStatement, line: ${getLine(stmt)}`);
      }

      if (isCustomContext()) {
        Visitor.prototype.MustacheStatement.call(this, stmt);

        if (stmt.path.type === 'SubExpression') {
          // By convention, mustache paths resolve to a PathExpression
          // even though it's a reference to a helper.
          stmt.path = createPathFromSubExpression({ stmt: stmt.path });
        }

        if (isRootCtxValue(stmt.path.original)) {
          _this.dataPaths.push(stmt.path.original);
        }

        this.mutating = true;
        return stmt;
      }

      if (
        stmt.partialSkip
        // This is a synthetic method
        // It is likely that this was added by the BlockStatement function above
        // sequel to the _this.createIterateInit(...) invocation
        || _this.helpers.includes(stmt.path.original)) {
        return;
      }

      if (stmt.params.length || stmt.hash || _this.methodNames.includes(stmt.path.original)) {
        if (!stmt.path.original.match(/^\w+$/g)) {
          // Ensure that method name is a word, because hbs will treat
          // {{./[0].x.[7][5]}} as a valid expression with 5 in the param array
          // while in the real sense the user forgot to place a "." before
          // [5]. Also, {{[.][]}} is valid to hbs where . will be assumed to be a
          // helper, but is obviously not valid in our use-case
          // Note: however that a correct expression would look like
          // {{x [5]}} or {{x []}} or {{[x] [5]}}, in which case 5 is the param and x is a word

          throw new Error(`Invalid helper name: ${stmt.path.original}`);
        }

        stmt.type = 'SubExpression';
        ASTParser.prototype.SubExpression.call(this, stmt);

        if (stmt.processed) {
          stmt = createMustacheStatement({
            original: stmt.original,
          });
        } else {
          stmt.type = 'MustacheStatement';
        }

        return stmt;
      }

      this.acceptKey(stmt, 'path');

      let { processed, original, type } = stmt.path;

      if (processed) {
        this.mutating = true;

        // Note that even when the path is a literal, hbs will
        // still do a lookup. This is because paths can be referenced
        // as literals, hence we still need to add to dataPaths, to allow
        // our proxy resolve the path, even if it's a literal

        _this.dataPaths.push(original);

        if (type === 'PathExpression') {
          original = toCanonical(original);

          stmt.path.original = original;
          stmt.path.parts = original.split('.');
        }
      }

      return stmt;
    };

    const addParamsAsHashes = (stmt) => {
      const hash = stmt.hash || (stmt.hash = { type: 'Hash', pairs: [] });
      const { params } = stmt;

      if (params.length) {
        // Add params (path expressions) as hash pairs
        // For example:
        // {{> myPartial myOtherContext }} == {{> myPartial myOtherContext = ./myOtherContext }}
        params
          .filter(param => param.type === 'PathExpression')
          .forEach((param) => {
            hash.pairs.push({
              type: 'HashPair',
              key: param.original,
              value: {
                type: param.type,
                original: `./${param.original}`,
              },
            });
          });
      }
    };

    const getPartialContextList = function ({ stmt, inline }) {
      if (getHashValue({ stmt, key: rootQualifier })) {
        throw new Error(`Root qualifier '${rootQualifier}' cannot be a hashpair key`);
      }

      const { hash } = stmt;

      const partialContextList = contextList.clone();

      // PartialStatements are not context switching nodes
      // hence, we don't create any new context, but rather update
      // the prior context
      const contextObject = partialContextList.peek();

      if (isCustomContext()) {
        for (const pair of hash.pairs) {
          if (getReservedPartialHashes().includes(pair.key)) {
            throw new Error(`The hash key: ${pair.key} is reserved, line: ${getLine(stmt)}`);
          }

          if (!pair.value.type.endsWith('Literal')) {
            this.acceptRequired(pair, 'value');
          }

          contextObject[pair.key] = {
            // Todo: use a better value for "lookup"
            lookup: !pair.value.type.endsWith('Literal'),
            asVariable: true,
          };
        }
      } else {
        if (partialContextList.length > 1 && !inline) {
          // This is only needed, if and only if, this is an
          // external partial because all references to @root
          // has already been resolved within the context of the
          // inline block

          const rootPath = _this.resolvePath({
            // This is only attempting to resolve {{this}},
            // inlined parameters are not supported
            stmt: false,
            value: {
              type: 'PathExpression',
              original: 'this',
            },
            contextList,
            bindParents,
          });

          // Change the root path
          partialContextList[0][rootQualifier]
            .declaredValue = rootPath.original;
        }

        for (const pair of hash.pairs) {
          // Note: if !!contextObject[pair.key], then overwrite it

          if (!pair.value.type.endsWith('Literal')) {
            this.acceptRequired(pair, 'value');

            // At this point, all hash values should be a PathExpression
            // Even in scenarios where the value is a SubExpressions, we
            // expect that all inline parameters must have been processed,
            // due to our AOT partial hash resolution strategy

            assert(
              pair.value.type.endsWith('Literal')
              || (pair.value.type === 'PathExpression'
              && pair.value.processed === true),
            );
          }
          let {
            type, original, lookup = false, synthetic = false,
          } = pair.value;

          if (pair.value.type === 'PathExpression' && pair.value.isResolvedPath) {
            // By default PathExpressions will resolve to a Literal due to
            // the way that resolvePath(...) defaults to getAllValidTypes(),
            // and since 'Literal' is at index 0, our path resolver uses that.
            // For paths that were directly resolved, set lookup to true
            // inorder to allow potential sub-path resolution

            lookup = true;
          }

          contextObject[pair.key] = {
            type, value: original, lookup, synthetic,
          };
        }
      }

      return partialContextList;
    };

    const getPartial = ({ stmt }) => {
      if (stmt.name.type === 'SubExpression') {
        // Todo: ensure that this captures both
        //  {{#?>(..)}} and {{#?>lookup(..)}}

        // We may actually be able to support SubExpression,
        // please investigate
        throw new Error(`Dynamic partials are not supported, ${getLine(stmt)}`);
      }

      const partialName = stmt.name.original;

      let inline = false;
      // eslint-disable-next-line no-shadow
      let block;

      // First, check inline blocks in the scope
      const inlineBlocks = getAvailableInlineBlocks({
        bindParents,
      });
      for (const blockName in inlineBlocks) {
        if (blockName === partialName) {
          block = inlineBlocks[blockName];

          block.program = block.program.clone();

          const { hash = { type: 'Hash', pairs: [] } } = stmt;

          if (block.requiredParams) {
            // This is possbible if the block is not a
            // custom block

            // Ensure that those params are avaiable
            // on the hash array

            block.requiredParams.forEach((param) => {
              if (!hash.pairs.filter(pair => pair.key === param).length) {
                throw new Error(`The hash key: '${param}' is required to load inline block: ${blockName}`);
              }
            });
          }

          if (block.blockQualifiers) {
            // eslint-disable-next-line no-loop-func
            block.blockQualifiers.forEach((qualifier) => {
              if (hash.pairs.filter(pair => pair.key === qualifier).length) {
                throw new Error(`The hash key: '${qualifier}' is already a context qualifier in the inline block: ${blockName}`);
              }
            });
          }

          // Note for scenarios where custom block(s) exists within the
          // inline block, it's possbible in some cases for requiredParams and
          // blockQualifiers to exist at the same time

          inline = true;

          break;
        }
      }

      // If not found, attempt to load the partial file
      if (!block) {
        block = {
          program: PartialReader.read({
            path: _this.getPartialPath(partialName),
          }),
        };
      }

      return {
        block,
        inline,
        partialBindParents: block.decoratorBindParents || bindParents,
      };
    };

    const processPartial = function ({ stmt }) {
      const partialName = stmt.name.original;

      if (getOuterInlineBlock({ bindParents }) != null) {
        _this.logger.info(`{{> ${partialName} }} - AOT partial hash resolution phase`);
        // Though, we do not process partials within inline
        // blocks, we need to attempt to process the hashpairs
        this.acceptArray(stmt.hash.pairs);
        return;
      }

      if (stmt.params.length) {
        throw new Error(`Partial contexts not supported, line: ${getLine(stmt)}`);
      }

      _this.logger.info(`{{> ${partialName} }}`);

      const { block, inline, partialBindParents } = getPartial({
        stmt,
      });

      // eslint-disable-next-line no-shadow
      let ast = block.program;

      // Add params as hashes
      addParamsAsHashes(stmt);

      // Wrap ast inside PartialWrapper. For more info, see below:
      // ASTParser.prototype.PartialWrapper
      ast = {
        ...ast,
        type: 'PartialWrapper',
      };

      const ctxList = getPartialContextList.bind(this)({ stmt, inline });

      // Recurse partial ast
      new TemplatePreprocessor({
        assetId: _this.assetId,
        logger: _this.logger,
        componentName: _this.componentName,

        ast,
        contextList: ctxList,
        bindParents: partialBindParents,
        globals: _this.globals,
        dataPaths: _this.dataPaths,
        blocksData: _this.blocksData,
        component: _this.component,
        componentAst: _this.componentAst,
        componentSrc: _this.componentSrc,
        helpers: _this.helpers,
        customBlockCtx: isCustomContext(),
        allowRootAccess: allowRootAccess(),

        resolver: _this.resolver,
      });

      this.mutating = true;

      const parent = bindParents.peek();

      if (isCustomContext()) {
        let contextId;

        if (inline) {
          if (!block.isCustomCtx) {
            visitNodes({
              types: ['PathExpression'],
              ast,
              // eslint-disable-next-line no-shadow
              consumer: ({ stmt }) => {
                let { original } = stmt;

                if (stmt.parameter) {
                  // Transform into a data variable
                  original = `@${original}`;
                } else {
                // Replace "data." with "" if applicable
                  original = original.replace(/^data\./g, '');

                  // Return raw data on resolve, not proxy
                  original = addRawDataPrefixToPath(original);

                  _this.dataPaths.push(original);
                }
                resetPathExpression({
                  stmt,
                  original,
                  properties: {
                    processed: true,
                  },
                });
              },
            });
          } else {
            contextId = utils.generateRandomString();

            const storeContextBlock = {
              type: 'BlockStatement',
              path: createPathExpression({ original: storeContextBlockName }),
              params: [],
              hash: {
                type: 'Hash',
                pairs: [{
                  type: 'HashPair',
                  key: partialIdHash,
                  value: createStringLiteral(contextId),
                }],
              },
              program: {
                type: 'Program',
                body: ast.body,
              },
              ...getDefaultStripOptions(),
            };

            replacements.push({
              parent: block.parent.body,
              replacementIndex: block.parent.body.indexOf(
                block.marker,
              ),
              replacementNodes: [storeContextBlock],
              shiftOnly: true,
            });
          }
        }

        const loadCtxBlock = {
          type: 'BlockStatement',
          path: createPathExpression({ original: loadContextBlockName }),
          params: [],
          hash: {
            type: 'Hash',
            pairs: [
              ...stmt.hash.pairs,
              {
                type: 'HashPair',
                key: partialNameHash,
                value: createStringLiteral(partialName),
              },
            ],
          },
          program: {
            type: 'Program',
            body: contextId ? [] : ast.body,
          },
          ...getDefaultStripOptions(),
        };

        if (contextId) {
          loadCtxBlock.hash.pairs.push({
            type: 'HashPair',
            key: partialIdHash,
            value: createStringLiteral(contextId),
          });
        }

        return loadCtxBlock;
      }

      // Indicate that the ast statements should be not be processed
      // after replacing the current partial statement because
      // because this has already been done by partialProcessor above

      visitNodes({
        types: ['MustacheStatement', 'BlockStatement'],
        ast,
        // eslint-disable-next-line no-shadow
        consumer: ({ stmt }) => {
          stmt.partialSkip = true;
        },
      });

      replacements.push({
        parent: parent.body,
        replacementIndex: parent.body.indexOf(stmt),
        replacementNodes: ast.body,
      });

      return false;
    };

    ASTParser.prototype.PartialStatement = function (stmt) {
      return processPartial.bind(this)({
        stmt,
      });
    };

    ASTParser.prototype.PartialBlockStatement = function () {
      throw new Error('PartialBlockStatements are not supported');
    };

    ASTParser.prototype.DecoratorBlock = function (stmt) {
      const { reservedDecoratorNames } = TemplatePreprocessor;
      const decoratorName = stmt.params[0].original;

      if (reservedDecoratorNames.includes(decoratorName)) {
        throw new Error(`Decorator name: ${decoratorName} not reserved`);
      }

      if (stmt.hash && stmt.hash.pairs) {
        this.logger.warn(`Found partial hashes on decorator: ${decoratorName}`);
      }

      const parent = {
        type: stmt.type, body: stmt.program.body, decoratorName, parent: bindParents.peek(),
      };
      bindParents.push(parent);
      const decoratorBindParents = [...bindParents];

      this.acceptKey(stmt, 'program');
      bindParents.pop();

      this.mutating = true;
      return _this.addInlineBlock({
        bindParents,
        decoratorBindParents,
        stmt,
        requiredParams: parent.requiredParams,
        isCustomCtx: isCustomContext(),
      });
    };

    /**
       * This is a custom AST type that is wrapped around a partial's
       * AST program, inorder to create a clearly defined boundary between
       * decorators defined inside the partial and any decorator
       * that may be wrapped out the partial declaration
       *
       */
    ASTParser.prototype.PartialWrapper = function (stmt) {
      // eslint-disable-next-line no-multi-assign
      this.current.type = stmt.type = 'Program';

      bindParents.push({ type: 'PartialWrapper', body: stmt.body, parent: bindParents.peek() });
      Visitor.prototype.Program.call(this, stmt);
      bindParents.pop();

      this.mutating = true;

      // The use of this wrapper has been finalized,
      // hence dispose it and replace it with it's program
      // equivalent
      return stmt;
    };

    Visitor.prototype.PartialWrapper = function () { };

    const parser = new ASTParser();
    parser.accept(ast);

    if (!this.isPartial) {
      assert(bindParents.length === 1);
      assert(contextList.length === 1);
    }

    replaceNodes(replacements);
  }

  addInlineBlock({
    bindParents, decoratorBindParents, stmt, requiredParams, isCustomCtx,
  }) {
    const { getAvailableInlineBlocks, getLine } = TemplatePreprocessor;
    assert(stmt.path.type === 'PathExpression' && stmt.path.original === 'inline');

    const [param] = stmt.params;
    assert(param && param.type === 'StringLiteral');

    const decoratorName = param.original;

    const availableBlocks = getAvailableInlineBlocks({ bindParents });

    // First, verify that no other decorator exists with
    // the same name
    if (Object.keys(availableBlocks)
      .filter(name => name === decoratorName).length) {
      this.logger.warn(`Inline block: '${decoratorName}' already exists: ${getLine(stmt)}, skipping`);
    }

    // Add a reference to the parent
    const parent = bindParents.peek();

    // We need some sort of marker on the ast to be used for
    // replacement purpose, if we need to add a 'storeContext'
    // block later on
    const { emptyStringPath, createMustacheStatement } = TemplatePreprocessor;
    const marker = createMustacheStatement({ original: emptyStringPath });

    parent.decorators[param.original] = {
      program: stmt.program,
      decoratorName,
      decoratorBindParents,
      requiredParams,
      marker,
      isCustomCtx,
    };

    this.logger.info(`Decorator: ${param.original}${isCustomCtx ? '' : `, requiredParams: [${requiredParams}]`}`);
    return marker;
  }

  static getAvailableInlineBlocks({ bindParents }) {
    let blocks = {};
    for (const parent of bindParents) {
      const keys = Object.keys(parent.decorators || (parent.decorators = {}));
      for (const k of keys) {
        const block = parent.decorators[k];
        blocks[k] = {
          ...block,
          parent,
        };
      }
    }

    return blocks;
  }

  static getOuterInlineBlock({ bindParents }) {
    // eslint-disable-next-line no-labels
    loop:
    // eslint-disable-next-line no-plusplus
    for (let i = bindParents.length - 1; i >= 0; i--) {
      const parent = bindParents[i];

      switch (parent.type) {
        case 'PartialWrapper':
          // eslint-disable-next-line no-labels
          break loop;
        case 'DecoratorBlock':
          return parent;
        default:
          // eslint-disable-next-line no-labels
          continue loop;
      }
    }
    return null;
  }

  static visitNodes({ types, ast, consumer }) {
    const { Visitor } = handlebars;
    function ASTParser() {
    }
    ASTParser.prototype = new Visitor();

    for (const type of types) {
      ASTParser.prototype[type] = function (stmt) {
        consumer({ stmt });
        Visitor.prototype[type].call(this, stmt);
        this.mutating = true;
        return stmt;
      };
    }

    const parser = new ASTParser();
    parser.accept({
      ...ast,
      type: 'Program',
    });
  }

  static getDefaultStripOptions() {
    const strip = { open: false, close: false };
    const loc = { line: 0, column: 0 };
    return {
      openStrip: strip,
      closeStrip: strip,
      loc: { start: loc, end: loc },
    };
  }

  static createStringLiteral(original) {
    const { createLiteral } = TemplatePreprocessor;
    return createLiteral({ type: 'StringLiteral', original });
  }

  static createLiteral({ type, original }) {
    return { type, original, value: original };
  }

  static getLine(stmt) {
    const { loc: { start } } = stmt;
    return `Line: ${start.line}:${start.column}`;
  }

  getPartialPath(partialName) {
    // Todo: validate partialName - an attacker can access the file
    // system with this
    const partialFile = pathLib.join(this.srcDir, `${partialName}.hbs`);

    if (!fs.existsSync(partialFile)) {
      throw new Error(`Partial: ${partialName} could not be loaded`);
    }

    return partialFile;
  }

  static replaceNodes(replNodes) {
    // eslint-disable-next-line no-plusplus
    for (let index = 0; index < replNodes.length; index++) {
      const block = replNodes[index];

      for (const replNode of block.replacementNodes) {
        assert(block.replacementIndex >= 0);
        block.parent.splice(block.replacementIndex, 0, replNode);
        // eslint-disable-next-line no-plusplus
        block.replacementIndex++;
      }

      // eslint-disable-next-line no-plusplus
      for (let index2 = index + 1; index2 < replNodes.length; index2++) {
        const b = replNodes[index2];

        if (b.parent === block.parent) {
          b.replacementIndex += block.replacementNodes.length
            + (block.shiftOnly ? -1 : 0);
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
      !== undefined;
  }

  static hasDataPathFormat(path) {
    const { dataPathRoot, pathSeparator } = TemplatePreprocessor;
    return path.startsWith(`${dataPathRoot}${pathSeparator}`)
      // In the case of BlockStatement param(s) and MustacheStatement
      // paths, that are hbs-intrinsic elements, they are prefixed
      // with 'data.' after trimming
      || path.startsWith(`${dataPathRoot}.`);
  }

  lookupDataPath({ fqPath, validTypes = [] }) {
    const { dataPathRoot, pathSeparator, defaultIndexResolver } = TemplatePreprocessor;
    // Todo: Re-use this regex in hasDataPathFormat(...) above
    const dataPathPrefix = new RegExp(`^${dataPathRoot}${pathSeparator}`);

    const value = this.component
      // Todo: Why not use getPathValue(...) instead?
      .resolvePath({
        fqPath: fqPath.replace(dataPathPrefix, ''),
        indexResolver: defaultIndexResolver,
      });

    return this.component.validateType({
      path: fqPath,
      value,
      validTypes,
    });
  }

  static getReservedBlockNames() {
    const { getMetaHelpers } = TemplatePreprocessor;
    return [
      ...getMetaHelpers(),
    ];
  }

  static getMetaHelpers() {
    const { storeContextBlockName, loadContextBlockName } = TemplatePreprocessor;
    return [
      storeContextBlockName, loadContextBlockName,
    ];
  }

  static getConditionalHelpers() {
    return [
      'if', 'unless',
    ];
  }

  static getContextSwitchingHelpers() {
    return [
      'each', 'with',
    ];
  }

  static getHandleBarsBlockHelpers() {
    const { getConditionalHelpers, getContextSwitchingHelpers } = TemplatePreprocessor;
    return [
      ...getConditionalHelpers(),
      ...getContextSwitchingHelpers(),
    ];
  }

  // Todo: disable the use of "lookup" helper
  static getHandleBarsDefaultHelpers() {
    const { getHandleBarsBlockHelpers } = TemplatePreprocessor;
    return [
      'blockHelperMissing', 'helperMissing', 'log', 'lookup',
      ...getHandleBarsBlockHelpers(),
    ];
  }

  static getHandleBarsDataVariables() {
    return ['@root', '@first', '@index', '@key', '@last', '@level'];
  }

  static getReservedPartialHashes() {
    const {
      partialIdHash,
      partialNameHash,
    } = TemplatePreprocessor;
    return [partialIdHash, partialNameHash];
  }

  static getReservedQualifierNames() {
    const { rootQualifier } = TemplatePreprocessor;
    return [rootQualifier];
  }

  static addPolyfills() {
    global.console = require('fancy-log');
    global.RootProxy = require('../src/assets/js/proxy');
    global.BaseRenderer = require('../src/assets/js/base-renderer');
    global.RootCtxRenderer = require('../src/assets/js/root-ctx-renderer');
    global.CustomCtxRenderer = require('../src/assets/js/custom-ctx-renderer');
    global.WebRenderer = require('../src/assets/js/web-renderer');
    global.BaseComponent = require('../src/assets/js/base-component');
    global.assert = require('assert');
  }


  /**
  * This returns the component instance of the template
  * that is currently being processed
  */
  getComponent({ componentSrc } = {}) {
    // Todo: During initial loading process, we need to perform
    // some code checks to prevent dangerous code, i.e. access to
    // node apis, since it's for the client side. Note that only
    // index.test.js can contain "require" becuase it needs

    const { addPolyfills } = TemplatePreprocessor;

    addPolyfills();

    const filePath = pathLib.join(this.srcDir, 'index.test.js');
    const data = componentSrc || fs.readFileSync(filePath, 'utf8');

    const { window } = new jsdom.JSDOM('...', {
      url: 'http://localhost/',
    });

    window.Handlebars = handlebars;

    const allProps = Object.keys(global);
    const polyfilledProps = [];

    for (const k in window) {
      if ({}.hasOwnProperty.call(window, k)) {
        if (!allProps.includes(k)) {
          global[k] = window[k];
          polyfilledProps.push(k);
        }
      }
    }
    global.window = window;

    // eslint-disable-next-line no-unused-vars
    const require = createRequire(filePath);

    // Load Component Class
    // eslint-disable-next-line no-eval
    const ComponentClass = eval(data);

    // Create component instance
    const component = new ComponentClass({
      id: utils.generateRandomString(),
      input: this.resolver,
    });
    component.onClient = false;

    // This should be called by the compile-templates gulp transform
    // after server-side rendering
    component.releaseGlobal = () => {
      for (const k of polyfilledProps) {
        delete global[k];
      }
      delete global.window;
    };

    return {
      component,
      src: data,
    };
  }
}

module.exports = TemplatePreprocessor;
