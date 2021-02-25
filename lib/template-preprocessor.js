/* eslint-disable no-eval */
/* eslint-disable no-underscore-dangle */
/* eslint-disable no-restricted-globals */
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
const parser = require('@handlebars/parser');
const esprima = require('esprima');
const escodegen = require('escodegen');
const jsdom = require('jsdom');
const csso = require('csso');
const UglifyJS = require('uglify-js');
const importFresh = require('import-fresh');
const NoOpResourceLoader = require('jsdom/lib/jsdom/browser/resources/no-op-resource-loader');
const { StreamTokenizer, constructTree } = require('hyntax');

const utils = require('./utils');
const PartialReader = require('./template-reader');
const ClientHtmlGenerator = require('./client-html-generator');
const PathResolver = require('./path-resolver');
const helpers = require('./preprocessor-helpers');
const { processFile } = require('./template-processor');
const clientUtils = require('../src/assets/js/client-utils');
const LogicalExprTransformer = require('./logical-expr-transformer');
const SchemaGenerator = require('./schema-generator');

class TemplatePreprocessor {
  static minifyComponentRendererClass = false;

  static allowRootAccessByDefault = true;

  static rawDataPrefix = 'r$_';

  static syntheticMethodPrefix = 's$_';

  static literalPrefix = 'l$_';

  static rootQualifier = '@_root';

  static dataPathRoot = 'data';

  static logicGatePathRoot = 'logic_gate';

  static pathSeparator = '__';

  static allowRootAccessHashKey = 'allowRootAccess';

  static reservedDecoratorNames = ['@partial-block'];

  static blockParamHashKey = 'blockParam';

  static hookHashKey = 'transform';

  static syntheticAliasSeparator = '$$';

  static inlineParameterPrefix = '_';

  static startAttrCtxHelperName = 'startAttributeBindContext';

  static endAttrCtxHelperName = 'endAttributeBindContext';

  static setSyntheticNodeIdHelperName = 'setSyntheticNodeId';

  static getSyntheticNodeIdMethodName = 'getSyntheticNodeId';

  static startTNBCtxHelperName = 'startTextNodeBindContext';

  static customEachHelperName = 'forEach';

  static conditionalHelperName = 'conditional';

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

  static componentType = 'Component';

  static resolverComponentRefType = 'componentRef';

  static reservedComponentClassNames = [
    this.literalType, this.arrayType, this.objectType,
    this.mapType, this.componentType, this.resolverComponentRefType,
  ];

  static defaultIndexResolver = () => 0;

  static resolveLiteralsWithProxy = true;

  static componentImportPath = 'component';

  static wordPattern = /^\w+$/g;

  static ctxHashKey = 'ctx';

  static asyncHashKey = 'async';


  // If this is false, we will compile components every time it
  // is referenced via global.components, irrespective of 
  // whether it has already been processed and available in 
  // the dist folder. If this is false, it is guaranteed that 
  // circular dependencies will be detected ahead of time.

  static enableComponentCaching = true;

  static addDefaultParamToCustomBlock = false;

  static renderMethodName = 'render';

  static getLoaderMethodName = 'getLoader';

  static getStencilMethodName = 'getStencil';

  static validateTypeMethodName = 'validateType';

  static renderBlockMethodName = 'renderBlock';

  static loadComponentHelperName = 'loadInlineComponent';

  static ternaryHelperName = 'ternary';

  static logicalHelperName = 'logical';

  static concatenateHelperName = 'concatenate';

  static resolveMustacheHelperName = 'resolveMustache';

  static chainedLoadingStratedyFieldName = 'CHAINED_LOADING_STRATEGY';

  static invokeOnCompileHashKey = 'invokeOnCompile';

  static stencilCssClassname = 'stencil';

  static htmlWrapperCssClassname = 'mst-w';

  static blockNodeIdHashKey = 'nodeId';


  // This needs to be updated in app-context.js as well
  static lazyLoadComponentTemplates = true;

  constructor({
    srcDir,
    assetId,
    logger,
    templateSrc,
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
    logicGates,
    customBlockCtx = false,
    allowRootAccess,
    resolver,
    parents,
    className,
    metadata,
    globalChildCcomponents,
  }) {
    const {
      reservedComponentClassNames, getMethodNames,
      getComponentClass, createAst
    } = TemplatePreprocessor;

    this.srcDir = srcDir;
    this.assetId = assetId;
    this.logger = logger;

    if (!ast) {
      ast = createAst({ templateSrc });
    }

    this.ast = ast;

    this.contextList = contextList;
    this.bindParents = bindParents;

    this.dataPaths = dataPaths || ['@root'];

    this.blocksData = blocksData || {};

    this.customBlockCtx = customBlockCtx;
    this.allowRootAccess = allowRootAccess;

    this.resolver = resolver || new PathResolver({
      preprocessor: this,
    });

    this.isPartial = !!component;
    this.parents = parents;

    this.className = className;

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
      metadata = {};

      this.className = getComponentClass({
        dir: this.srcDir,
        clearCache: false,
      }).ComponentClass.name;

      if (reservedComponentClassNames.includes(this.className)) {
        throw new Error(`Class name: ${this.className} is reserved`);
      }

      this.parents[this.className] = this.assetId;
    }

    this.component = component;

    this.componentAst = componentAst;

    this.componentSrc = componentSrc;

    this.metadata = metadata;

    this.methodNames = this.validateMethodNames(
      getMethodNames({
        component: this.component,
      }),
    );

    this.helpers = helpers || [];

    this.globals = globals || {};

    this.logicGates = logicGates || {};

    this.globalChildCcomponents = globalChildCcomponents;
  }

  static createAst({ templateSrc }) {
    return parser.parse(templateSrc);
  }

  static getDefaultHelpers() {
    const {
      loadComponentHelperName,
      ternaryHelperName,
      logicalHelperName,
      concatenateHelperName,
    } = TemplatePreprocessor;
    return [
      loadComponentHelperName,
      ternaryHelperName,
      logicalHelperName,
      concatenateHelperName,
    ];
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
    const { getDefaultHelpers, getMetaHelpers } = TemplatePreprocessor;

    const defaultHelpers = getDefaultHelpers();
    const metaHelpers = getMetaHelpers();

    let methods = new Set();

    while ((component = Reflect.getPrototypeOf(component))
      // eslint-disable-next-line no-undef
      && component.constructor.name !== BaseComponent.name) {
      let keys = Reflect.ownKeys(component).filter(k => k !== 'constructor');
      keys.forEach((k) => {
        if (defaultHelpers.includes(k) || metaHelpers.includes(k)) {
          throw new Error(`Method name: ${k} is reserved`);
        }
        methods.add(k);
      });
    }
    return [...methods, ...defaultHelpers];
  }

  validateMethodNames(methodNames) {
    if (this.isPartial) {
      return methodNames;
    }
    const { syntheticMethodPrefix } = TemplatePreprocessor;
    for (const methodName of methodNames) {
      if (methodName.startsWith(syntheticMethodPrefix)) {
        throw new Error(`Method name: ${methodName} not allowed`);
      }
    }
    return methodNames;
  }

  static getComponentsSrcPath() {
    return pathLib
      .join(pathLib.dirname(fs.realpathSync(__filename)),
        '../src/components');
  }

  static getComponentsDistPath() {
    return pathLib
      .join(pathLib.dirname(fs.realpathSync(__filename)),
        '../dist/components');
  }

  getDistPath() {
    const { getComponentsDistPath } = TemplatePreprocessor;
    const assetPath = pathLib
      .join(getComponentsDistPath(), this.assetId);

    if (!fs.existsSync(assetPath)) {
      fs.mkdirSync(assetPath, { recursive: true });
    }
    return assetPath;
  }

  writeAssetsToFileSystem() {
    this.writeComponentJsToFileSystem();
    this.writeHtmlToFileSystem();
  }

  static getComponentListFile() {
    const { getComponentsDistPath } = TemplatePreprocessor;
    return pathLib.join(getComponentsDistPath(), 'list.json');
  }

  static getComponentList() {
    const { getComponentListFile } = TemplatePreprocessor;
    const filePath = getComponentListFile();

    let list = {};

    if (fs.existsSync(filePath)) {
      list = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }

    return list;
  }

  static getComponentListPath() {
    const { getComponentsDistPath } = TemplatePreprocessor;
    return pathLib.join(getComponentsDistPath(), 'list.json');
  }

  updateComponentList() {
    const { getComponentListPath, getComponentList } = TemplatePreprocessor;

    let list = getComponentList();
    const assetId = list[this.componentClassName];

    if (!assetId) {
      list[this.componentClassName] = this.assetId;
    } else if (assetId !== this.assetId) {
      throw new Error(`Duplicate component class name - ${this.componentClassName}, assetIds: [${assetId}, ${this.assetId}]`);
    }

    fs.writeFileSync(
      getComponentListPath(),
      JSON.stringify(list, null, 2),
    );
  }

  writeComponentJsToFileSystem({ incremental } = {}) {
    const {
      minifyComponentRendererClass,
      minifyAsset,
    } = TemplatePreprocessor;
    const distPath = this.getDistPath();

    // load component index file
    const componentSrc = this.loadComponentIndexFile();

    const indexJsMain = pathLib.join(distPath, 'index.js');
    const indexJsTest = pathLib.join(distPath, 'index.test.js');

    // Write index.js file
    fs.writeFileSync(
      indexJsMain,
      minifyComponentRendererClass
        ? minifyAsset({ data: componentSrc, type: 'js' })
        : componentSrc,
    );

    // Write index.test.js file
    fs.writeFileSync(
      indexJsTest,
      minifyComponentRendererClass
        ? minifyAsset({ data: this.componentSrc, type: 'js' })
        : this.componentSrc,
    );

    if (!incremental) {
      this.updateComponentList();
    }
  }

  // Todo: optimize this to stop reading the file every single time
  // eslint-disable-next-line class-methods-use-this
  getAssetIdFromClassName(className) {
    const { getComponentList } = TemplatePreprocessor;
    return getComponentList()[className];
  }

  static addComponentGlobals() {
    const {
      getComponentList, getComponentClass, getComponentsDistPath,
    } = TemplatePreprocessor;
    const list = getComponentList();

    const keys = Object.keys(list);

    global.components = {};

    for (const className of keys) {
      const assetId = list[className];
      const dir = pathLib.join(getComponentsDistPath(), assetId);

      const { ComponentClass } = getComponentClass({
        dir,
        useTestClass: true,
      });

      // When serializing, toJSON(...) should use the actual className, not the test class
      ComponentClass.className = className;

      global.components[className] = ComponentClass;

      const metadataFile = pathLib.join(dir, 'metadata.min.js');
      if (fs.existsSync(metadataFile)) {
        const contents = fs.readFileSync(
          metadataFile,
          'utf8',
        );
        eval(contents);
      }
    }
  }

  containsComponentImport(srcDir) {
    const { componentImportPath } = TemplatePreprocessor;
    let b = false;
    // Scan templates to check if any view files has a component import
    fs.readdirSync(srcDir)
      .filter(file => file.endsWith('.view'))
      .forEach((template) => {
        if (b) {
          return;
        }
        const tpl = fs.readFileSync(
          pathLib.join(srcDir, template),
          'utf8',
        );

        const regex = new RegExp(`\\{\\{\\s*${componentImportPath}\\s+`);
        if (tpl.match(regex)) {
          b = true;
        }
      });
    return b;
  }

  loadChildComponents() {
    if (
      this.globalChildCcomponents
      // Since, this component does not contain component imports itself,
      // there is not need to load all child components
      || !this.containsComponentImport(this.srcDir)) {
      return;
    }

    this.globalChildCcomponents = [];

    const { getComponentsSrcPath } = TemplatePreprocessor;

    const componentsFolder = fs.readdirSync(
      getComponentsSrcPath(),
    );

    for (const dirName of componentsFolder) {
      const dir = pathLib.join(getComponentsSrcPath(), dirName);

      const indexView = pathLib.join(dir, 'index.view');
      const indexJs = pathLib.join(dir, 'index.js');

      if (
        this.srcDir == dir
        // Remember that are scanning directory that contain component source
        // files, so we need to be lenient
        || fs.lstatSync(dir).isFile()
        || !fs.existsSync(indexView)
        || !fs.existsSync(indexJs)
        || this.containsComponentImport(dir)
      ) {
        continue;
      }

      const componentSrc = fs.readFileSync(
        indexJs, 'utf8',
      );

      const ComponentClass = eval(componentSrc);
      this.globalChildCcomponents.push(ComponentClass.name);
    }

    if (!Object.keys(this.globalChildCcomponents).length) {
      throw Error(`Inorder to process ${this.className}, you must create a component that does not import another component`);
    }
  }

  getTransientComponentsGlobal() {
    const {
      enableComponentCaching, getComponentsSrcPath,
      getComponentsDistPath, findMatchingComponent, getComponentClass,
    } = TemplatePreprocessor;
    const _this = this;
    return new Proxy({}, {
      get: (obj, prop) => {
        if (obj[prop]) {
          return obj[prop];
        }

        if (Object.keys(_this.parents).includes(prop)) {
          throw new Error(`Circular dependency detected for component: ${prop} in ${this.className}`);
        }

        let assetId = this.getAssetIdFromClassName(prop);
        let componentClass;

        const load = () => {
          componentClass = getComponentClass({
            dir: pathLib.join(getComponentsDistPath(), assetId),
            useTestClass: true,
          }).ComponentClass;
          // When serializing, toJSON(...) should use the actual className, not the test class
          componentClass.className = prop;
        };

        if (assetId && enableComponentCaching) {
          load();
        } else {
          const srcDirName = findMatchingComponent({ className: prop });
          if (srcDirName) {
            processFile({
              dir: pathLib.join(getComponentsSrcPath(), srcDirName),
              Preprocessor: TemplatePreprocessor,
              // We don't want to pass a copy not a reference, so
              // it's not modified
              parents: utils.deepClone(_this.parents),
            });
            assetId = this.getAssetIdFromClassName(prop);

            // As a result of the call: processFile(...), global.components
            // was overwritten, so we need to re-assign it
            global.components = _this.getTransientComponentsGlobal();

            load();
          }
        }

        return componentClass;
      },
    });
  }

  static findMatchingComponent({ className }) {
    const { getComponentsSrcPath } = TemplatePreprocessor;
    const componentsFolder = fs.readdirSync(getComponentsSrcPath());

    for (const dirName of componentsFolder) {
      const dir = pathLib.join(getComponentsSrcPath(), dirName);
      if (fs.lstatSync(dir).isFile()) {
        continue;
      }
      const componentSrc = fs.readFileSync(
        pathLib.join(dir, 'index.js'), 'utf8',
      );
      const componentAst = esprima.parseScript(
        componentSrc,
      );

      const matches = componentAst.body
        .filter(e => e.type === 'ClassDeclaration' && e.id.name === className)
        .length;

      if (matches) {
        return dirName;
      }
    }

    return null;
  }

  writeHtmlToFileSystem() {
    const distPath = this.getDistPath();
    const data = this.getComponentSampleData();

    const contents = ClientHtmlGenerator.get({
      className: this.componentClassName,
    });

    fs.writeFileSync(`${distPath}/client.html`, contents);
    fs.writeFileSync(
      `${distPath}/sample.js`,
      `/* eslint-disable */module.exports=${data}`,
    );
  }

  // eslint-disable-next-line class-methods-use-this
  getSerializedComponent(className) {

    if (className == this.className) {
      // Return null, else we will end up with a circular dependency error
      return null;
    }

    if (className == 'BaseComponent') {
      // Load an arbitrary child component
      assert(this.globalChildCcomponents.length);

      const i = utils.getRandomInt(0, this.globalChildCcomponents.length - 1);
      className = this.globalChildCcomponents[i];

      global.components[className];
    }

    const { getComponentsDistPath } = TemplatePreprocessor;
    const dirName = this.getAssetIdFromClassName(className);
    // const moduleExports = '/* eslint-disable */\nmodule.exports=';

    // eslint-disable-next-line import/no-dynamic-require
    const sampleData = require(
      pathLib.join(
        getComponentsDistPath(),
        dirName,
        'sample.js',
      ),
    );

    // eslint-disable-next-line no-unused-vars
    const componentClass = global.components[className];

    // When serializing, toJSON(...) should use the actual className, not the test class
    componentClass.className = className;

    // Todo: optimize to avoid creating new instance each time
    // eslint-disable-next-line new-cap
    return new componentClass({ input: sampleData });
  }

  getComponentSampleData() {
    return global.clientUtils.clone(this.resolver.getSample());
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
    const {
      rootQualifier, dataPathRoot,
      getLiteralType, getComponentsDistPath,
      getComponentList, getComponentListPath,
    } = TemplatePreprocessor;

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

    global.components = this.getTransientComponentsGlobal();

    this.loadChildComponents();

    try {
      this.process0({
        contextList: this.contextList || [
          defaultContext,
        ],
        bindParents: this.bindParents || [{ type: 'root', body: this.ast.body }],
        ast: this.ast,
      });
    } catch (err) {
      const list = getComponentList();

      if (!fs.existsSync(getComponentsDistPath())) {
        fs.mkdirSync(getComponentsDistPath(), { recursive: true });
      }

      for (const className in this.parents) {
        if ({}.hasOwnProperty.call(this.parents, className)) {
          const assetId = this.parents[className];
          fs.rmdirSync(
            pathLib.join(getComponentsDistPath(), assetId),
            { recursive: true },
          );
          delete list[className];
        }
      }

      fs.writeFileSync(getComponentListPath(),
        JSON.stringify(list, null, 2));

      throw err;
    }

    if (!this.isPartial) {
      this.finalize();
    }
  }

  finalize() {
    // add assetId to ast
    this.emitAssetId();

    // add helpers array to ast
    this.emitHelpers();

    // add logic gates array to ast
    this.emitLogicGates();

    // add compoonent data paths to ast
    this.emitDataPaths();

    // add css/js dependencies to ast
    this.emitDependencies();

    this.emitMetadata();

    // refresh component instance
    this.serializeAst();

    // create models
    this.createModels();

    // write assets
    this.writeAssetsToFileSystem();

    // this.logger.info(JSON.stringify(this.ast));
  }

  createModels() {
    const { data, config } = this.resolver.finalize();

    const language = process.env.targetLanguage || 'java';

    const dir = pathLib
      .join(
        process.env.PWD,
        'lib',
        'model-factories',
        language,
      );

    if (!fs.existsSync(dir)) {
      throw Error(`Language: ${language} not yet supported.`);
    }

    const ModelFactory = require(`./model-factories/${language}/factory`);

    // Create JSON schema
    const { schema, componentTypes } = SchemaGenerator.createSchema({
      data,
      config,
      className: this.className,
    });

    this.schema = schema;

    // Write server-side models
    ModelFactory.createModels({
      preprocessor: this,
      schema,
      componentTypes,
    });
  }

  static getComponentClass({ dir, clearCache = true, useTestClass = false } = {}) {
    const { makeRequire, clearRequireCache } = TemplatePreprocessor;
    const filePath = pathLib.join(dir, `index${useTestClass ? '.test' : ''}.js`);

    const data = fs.readFileSync(
      filePath,
      'utf8',
    );

    if (clearCache) {
      clearRequireCache();
    }

    // eslint-disable-next-line no-unused-vars
    const require = makeRequire(filePath);

    // eslint-disable-next-line no-eval
    return { data, ComponentClass: eval(data) };
  }

  /**
   * This returns the string that should be written as the component
   * index.js file in the dist directory.
   */
  loadComponentIndexFile() {
    const { isRootCtxValue, getComponentClass } = TemplatePreprocessor;

    // eslint-disable-next-line no-eval
    let { data, ComponentClass } = getComponentClass({ dir: this.srcDir });

    this.componentClassName = ComponentClass.name;

    const classString = ComponentClass.toString();

    const ast = esprima.parseScript(classString);

    for (const definition of this.componentAst.body[0].body.body) {
      if (isRootCtxValue(definition.key.name)) {
        ast.body[0].body.body.push(definition);
      }
    }

    data = utils.update(
      data,
      classString,
      `/* eslint-disable */\n${escodegen.generate(ast)}`,
    );

    return data;
  }

  readHeadAttributes() {
    const { lazyLoadComponentTemplates } = TemplatePreprocessor;
    const attributes = ['name', 'style', 'script'];

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const stmt = this.ast.body[0];

      if (!stmt) {
        break;
      }

      if (
        stmt.type === 'MustacheStatement'
        && attributes.includes(stmt.path.original)
      ) {
        // eslint-disable-next-line default-case
        switch (stmt.path.original) {
          case 'style':
            this.addCssDependency({ stmt });
            break;
          case 'script':
            this.addJsDependency({ stmt });
            break;
        }

        this.ast.body.shift();
      } else if (stmt.type === 'CommentStatement') {
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

    if (lazyLoadComponentTemplates) {
      this.jsDependencies.push({
        url: `/components/${this.assetId}/metadata.min.js`,
        moduleType: 'inline',
      });
    }
  }

  // Todo: new URL(...) will fail for relative URLs
  // Todo: Inform the user that any js dependency inserted here should be CJS-based
  addDependencyAsset({ stmt, type }) {
    const { minifyAsset, getHashValue } = TemplatePreprocessor;
    const value = getHashValue({ stmt, key: 'href' });
    assert(value.type === 'PathExpression' || value.type === 'StringLiteral');

    let { original } = value;
    const provisionalHost = 'http://localhost:8080';
    let withProvisionalHost;

    if (original.startsWith('/')) {
      original = `${provisionalHost}${original}`;
      withProvisionalHost = true;
    }

    // Validate URL
    let assetUrl = new URL(original).toString();

    if (withProvisionalHost) {
      assetUrl = assetUrl.replace(provisionalHost, '');
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
      componentSrc: utils.update(
        this.componentSrc,
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
    this.writeComponentJsToFileSystem({ incremental: true });
  }

  /**
   * This get the fields that should be unique across multiple
   * component instances
   */
  static getTransientFields() {
    return ['rootProxy'];
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

  emitLogicGates() {
    const { getValue } = TemplatePreprocessor;
    this.wrapExpressionAsMethod({
      name: 'logicGates',
      returnExpression: getValue(this.logicGates),
    });
  }

  emitDataPaths() {
    this.emitMethodReturningArray({ name: 'dataPaths' });
  }

  emitDependencies() {
    this.emitMethodReturningArray({ name: 'cssDependencies' });
    this.emitMethodReturningArray({ name: 'jsDependencies' });
  }

  emitMetadata() {
    const { getScalarValue } = TemplatePreprocessor;

    this.wrapExpressionAsMethod({
      name: 'hasSubComponent',
      returnExpression: getScalarValue(!!this.metadata.hasSubComponent),
    });
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
      syntheticMethodPrefix,
      rawDataPrefix,
      literalPrefix,
      syntheticAliasSeparator,
    } = TemplatePreprocessor;

    // Todo: Check if path === helpers, and fail
    if (
      path.includes('_$')
      || path.includes('$_')
      || path.includes('_@')
      || path.includes('-')
      || path.includes(pathSeparator)
      || path.includes(syntheticAliasSeparator)
      || path.startsWith(`${dataPathRoot}${pathSeparator}`)
      || path.startsWith(`${dataPathRoot}.`)
      || path.startsWith(syntheticMethodPrefix)
      || path.startsWith(rawDataPrefix)
      || path.startsWith(literalPrefix)
      || path.startsWith('__')
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
    return `${repl}${suffix.length && !suffix.startsWith('[')
      ? '.' : ''
      }${suffix}`;
  }

  // Todo: verify that this will be processes properly: {{#each [people]}}
  // eslint-disable-next-line no-unused-vars
  static getPathOffset({ original, contextList }) {
    const {
      getDataVariables,
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
      } else if (!getDataVariables().includes(first)
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

        original = `${getScopeQualifier({ contextList, index })
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
    syntheticAlias, scopeQualifier, create,
  }) {
    const prevOriginal = original;
    const {
      rootQualifier, pathSeparator: separator, dataPathRoot,
      hasObjectPrefix, syntheticMethodPrefix, getLine,
      trimObjectPath, hasDataPathFormat, getSuffix,
      defaultIndexResolver, getTargetType,
    } = TemplatePreprocessor;

    let checkType = true;
    let targetType;
    let type;

    let synthetic = false;

    const asyncContext = stmt && stmt.async;

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
      // assert(original.length);

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
              assert(utils.equals(Object.keys(v), ['lookup']));
              return { terminate: true };
            }

            if (asyncContext && contextObject[rootQualifier].inIterateContext) {
              throw new Error(`${prevOriginal} is unreachable, line ${getLine(stmt)}`);
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

      if (asyncContext && contextObject[rootQualifier].inIterateContext) {
        throw new Error(`${prevOriginal} is unreachable, line ${getLine(stmt)}`);
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
        && !original.startsWith(`${syntheticMethodPrefix}`)
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

        case original.startsWith(syntheticMethodPrefix):

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
            create,
          });

          // use regex instead
          original = original.replace(typeSuffix, '');
          break;
      }

      targetType = getTargetType(value);
    }

    return {
      original,
      type,
      targetType,
      synthetic,
    };
  }

  static getTargetType(value) {
    return value != null ? value.constructor.className || value.constructor.name : null;
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
    const contextObject = index ? contextList[index] : utils.peek(contextList);
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
    bindParents, stmt, contextList, value, validTypes, create = true,
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

      // this.logger.info(`Added inline parameter '${stmt.parts[0]}'
      // for inline block: ${inlineBlock.decoratorName}`);

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
        create,
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
    assert(typeof ctx === 'string');
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

  static getKnownTypes() {
    return [
      'PathExpression', 'BooleanLiteral', 'NumberLiteral',
      'StringLiteral', 'LogicGate', 'MustacheGroup',
    ];
  }

  // Todo: Check is there is a better way to do this
  static isCodeGenObject(value) {

    const { getKnownTypes } = TemplatePreprocessor;

    // When writing logic gate definitions, we emit object, with the type
    // property, we need to bypass these
    const knownHbsTypes = getKnownTypes();

    return value.constructor.name === 'Object'
      && value.type && !knownHbsTypes.includes(value.type);
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
    const { getIdentifier, isCodeGenObject, getValue } = TemplatePreprocessor;
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
          value: isCodeGenObject(v) ? v : getValue(v),
          kind: 'init',
          method: false,
          shorthand: false,
        });
      }
    }
    return envelope;
  }

  static getVariableEnvelope(variableName, init) {
    const { getIdentifier } = TemplatePreprocessor;
    if (typeof variableName !== 'string') {
      throw new Error(`Unknown variable type for ${variableName}`);
    }
    const stmt = {
      type: 'VariableDeclaration',
      kind: 'const',
      declarations: [{
        type: 'VariableDeclarator',
        id: getIdentifier(variableName),
      }],
    };

    if (init) {
      stmt.declarations[0].init = init;
    }

    return stmt;
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
    const { getIdentifier, createMemberExpression } = TemplatePreprocessor;
    const init = {
      type: 'CallExpression',
      callee: methodName
        ? createMemberExpression({ target, key: methodName, computed })
        : target.type ? target : getIdentifier(target),
      arguments: args || [],
    };

    return init;
  }

  /**
   * This creates a function that just returns the provided
   * expression
   */
  wrapExpressionAsMethod({
    name, addSyntheticPrefix = true,
    statements = [], returnExpression,
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
      .push(
        getMethodFromFunctionDeclaration({
          ast,
          addSyntheticPrefix,
        }),
      );

    return ast.id.name;
  }

  static getDefaultHelperHash({ contextList }) {
    const {
      rootQualifier, ctxHashKey, getProxyStatement,
    } = TemplatePreprocessor;

    const hash = {};
    if (contextList.length > 1) {
      hash[ctxHashKey] = getProxyStatement({
        path: utils.peek(contextList)[rootQualifier].value,
      });
    }

    return hash;
  }

  static createInvocationWithOptions({
    contextList, methodName,
  }) {
    const {
      getCallExpression, getValue, getDefaultHelperHash,
    } = TemplatePreprocessor;

    return getCallExpression({
      methodName,
      args: [
        getValue({ hash: getDefaultHelperHash({ contextList }) }),
      ],
    });
  }

  static createMemberExpression({ target, key, computed = false }) {
    const { getIdentifier } = TemplatePreprocessor;
    return {
      type: 'MemberExpression',
      computed,
      object: target
        ? target.type ? target : {
          type: 'Identifier',
          name: target,
        }
        : {
          type: 'ThisExpression',
        },
      property: getIdentifier(key),
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
    stmt, method, params = [], hash = { pairs: [] },
    syntheticAlias,
    async = false,
    syntheticNodeId,
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
      createInvocationWithOptions,
      getFunctionDeclarationFromArrowFunction,
      getMethodFromFunctionDeclaration,
      isRootCtxValue,
      getValue,
    } = TemplatePreprocessor;

    // Add hash to paramList
    params.push({
      type: 'Hash',
      original: hash,
    });

    const ast = {
      type: context ? 'ArrowFunctionExpression' : 'FunctionDeclaration',
      id: context ? null : {
        type: 'Identifier',
        name: `${utils.generateRandomString()}${stmt && stmt.methodNameSuffix ? stmt.methodNameSuffix : ''}`,
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
                key: method,
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
            .getHelperOptionsFromHash({
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

            statement.declarations[0].init = createInvocationWithOptions({
              contextList,
              methodName: param.original,
            });
          } else {
            const path = this.resolvePath({
              bindParents,
              stmt: param,
              contextList,
              value: param,
              validTypes: param.validTypes || null,
              create: !param.immutable,
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
            ast: utils.deepClone(statement.declarations[0].init.callee),
            name: utils.generateRandomString() + pruneKey,
          });

          const { prune = true } = param;

          // provisionally, add the generated function to component class ast
          this.componentAst.body[0].body.body
            .push({
              ...getMethodFromFunctionDeclaration({
                ast: provisionalFunction,
              }),
              prune,
            });

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
        const stmt = utils.peek(body);
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
        .push({
          ...getMethodFromFunctionDeclaration({
            ast,
            async,
            syntheticNodeId,
          }),
          prune: stmt ? stmt.prune : false,
        });

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

  getHelperOptionsFromHash({
    pruneKey, bindParents, contextList, variableName, hash,
  }) {
    const {
      syntheticMethodPrefix,
      literalPrefix,
      ctxHashKey,
      getScalarValue,
      getVariableEnvelope,
      resetPathExpression,
      getProxyStatement,
      createInvocationWithOptions,
      getFunctionDeclarationFromArrowFunction,
      getMethodFromFunctionDeclaration,
      isRootCtxValue,
      getLine,
      getValue,
      getDefaultHelperHash,
    } = TemplatePreprocessor;

    const envelope = getVariableEnvelope(variableName);

    const reservedHashKeys = [ctxHashKey];
    const hashObject = {
      type: 'ObjectExpression',
      properties: [],
    };

    const getProperty = ({ key, value, stmt }) => ({
      type: 'Property',
      key: getScalarValue(key),
      computed: false,
      value,
      kind: 'init',
      method: false,
      shorthand: false,
      stmt,
    });

    for (const pair of hash.pairs) {
      const { key, value } = pair;

      switch (true) {
        case value.type.endsWith('Literal'):
          hashObject.properties.push(
            getProperty({
              key,
              value: getScalarValue(value.original),
              stmt: value,
            }),
          );
          break;

        case value.type === 'PathExpression':

          if (value.processed) {
            assert(isRootCtxValue(value.original));

            // Param was already processed, in an inline block
            hashObject.properties.push(
              getProperty({
                key,
                value: getProxyStatement({
                  path: value.original,
                }),
                stmt: value,
              }),
            );
            continue;
          } else if (value.original.startsWith(literalPrefix)) {
            hashObject.properties.push(
              getProperty({
                key,
                value: getScalarValue(
                  value.original.replace(literalPrefix, ''),
                ),
                stmt: value,
              }),
            );
            continue;
          }

          // eslint-disable-next-line no-underscore-dangle
          let _path;

          if (this.methodNames.includes(value.original)) {
            _path = syntheticMethodPrefix + value.original;

            hashObject.properties.push(
              getProperty({
                key,
                value: createInvocationWithOptions({
                  contextList,
                  methodName: value.original,
                }),
                stmt: value,
              }),
            );
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
              hashObject.properties.push(
                getProperty({
                  key,
                  value: getScalarValue(path.original),
                  stmt: value,
                }),
              );
            } else {
              assert(path.type === 'PathExpression');

              _path = path.original;
              hashObject.properties.push(
                getProperty({
                  key,
                  value: getProxyStatement({
                    path: path.original,
                  }),
                  stmt: value,
                }),
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

          const property = getProperty({
            key,
            value: {
              type: 'CallExpression',
              arguments: [],
            },
            stmt: value,
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

          hashObject.properties.push(property);

          const provisionalFunction = getFunctionDeclarationFromArrowFunction({
            ast: utils.deepClone(property.value.callee),
            name: utils.generateRandomString() + pruneKey,
          });

          const { prune = true } = value;

          // provisionally, add the generated function to component class ast
          this.componentAst.body[0].body.body
            .push({
              ...getMethodFromFunctionDeclaration({
                ast: provisionalFunction,
              }),
              prune,
            });

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

    hashObject.properties.forEach((property) => {
      if (reservedHashKeys.includes(property.key.name)) {
        throw new Error(`Hash key '${property.key.name}' is reserved, line: ${getLine(property.stmt)}`);
      }
    });

    const defaultHelperHash = getValue(
      getDefaultHelperHash({ contextList }),
    );

    hashObject.properties = [
      ...hashObject.properties,
      ...defaultHelperHash.properties,
    ];

    envelope.declarations[0].init = getValue({
      hash: hashObject,
    });

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
      let methodName = body[i].key.name;
      if (methodName.endsWith(pruneKey) && body[i].prune) {
        delete body[i];
        const helper = this.helpers.indexOf(methodName);
        if (helper >= 0) {
          this.helpers.splice(helper, 1);
        }
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
    const { loc } = stmt;

    utils.clear(stmt);

    stmt.type = 'PathExpression';
    stmt.original = original;
    stmt.data = original.startsWith('@');
    stmt.depth = 0;
    stmt.parts = original.split('.');
    if (stmt.data) {
      stmt.parts[0] = stmt.parts[0].replace(/^@/g, '');
    }
    stmt.loc = loc;

    for (const k in properties) {
      if (
        {}.hasOwnProperty.call(properties, k)
        && properties[k] != undefined
      ) {
        stmt[k] = properties[k];
      }
    }

    return stmt;
  }

  static createPromise({ expressions, thenParameter }) {
    const { getIdentifier } = TemplatePreprocessor;
    const initial = expressions.shift();

    let ast = {
      type: 'CallExpression',
      callee: {
        type: 'MemberExpression',
        computed: false,
        object: {
          type: 'Identifier',
          name: 'Promise',
        },
        property: {
          type: 'Identifier',
          name: 'resolve',
        },
      },
      arguments: [initial],
    };

    for (const expression of expressions) {
      assert(expression.type === 'BlockStatement');

      ast = {
        type: 'CallExpression',
        callee: {
          type: 'MemberExpression',
          computed: false,
          object: ast,
          property: {
            type: 'Identifier',
            name: 'then',
          },
        },
        arguments: [
          {
            type: 'ArrowFunctionExpression',
            id: null,
            params: [getIdentifier(thenParameter)],
            body: expression,
            generator: false,
            expression: false,
            async: false,
          },
        ],
      };
    }

    return ast;
  }

  static createArrowFunctionExpression({ params, body }) {
    return {
      type: 'ArrowFunctionExpression',
      id: null,
      params,
      body: {
        type: 'BlockStatement',
        body,
      },
      generator: false,
      expression: false,
      async: false,
    };
  }


  static createASyncMethodFromFunctionDeclaration({
    expression, addSyntheticPrefix,
  }) {
    const {
      getValue, createArrowFunctionExpression, getIdentifier,
      getCallExpression,
    } = TemplatePreprocessor;
    const resolve = 'resolve';

    // Update method name, to indicate that it's synthetic
    expression.id.name = `${addSyntheticPrefix ? TemplatePreprocessor.syntheticMethodPrefix : ''}${expression.id.name}`;

    // Update return statement to resolve statement
    expression.body.body.push({
      type: 'ExpressionStatement',
      expression: getCallExpression({
        target: resolve,
        args: [expression.body.body.pop().argument],
      }),
    });

    const promise = {
      type: 'NewExpression',
      callee: {
        type: 'Identifier',
        name: 'Promise',
      },
      arguments: [
        createArrowFunctionExpression({
          params: [
            getIdentifier(resolve),
          ],
          body: expression.body.body,
        }),
      ],
    };

    return {
      type: 'MethodDefinition',
      key: expression.id,
      kind: 'method',
      static: false,
      value: {
        type: 'FunctionExpression',
        id: null,
        params: [],
        body: {
          type: 'BlockStatement',
          body: [
            {
              type: 'ExpressionStatement',
              expression: promise,
            },
            {
              type: 'ReturnStatement',
              argument: getValue(''),
            },
          ],
        },
        generator: false,
        expression: false,
        async: false,
      },
    };
  }

  static getMethodFromFunctionDeclaration({
    ast: expression, addSyntheticPrefix = true,
    async,
    syntheticNodeId,
  }) {
    const {
      createSyncMethodFromFunctionDeclaration,
      createASyncMethodFromFunctionDeclaration,
    } = TemplatePreprocessor;
    return (
      async
        ? createASyncMethodFromFunctionDeclaration
        : createSyncMethodFromFunctionDeclaration
    )({ expression, addSyntheticPrefix, syntheticNodeId });
  }

  static createSyncMethodFromFunctionDeclaration({
    expression,
    addSyntheticPrefix = true,
    syntheticNodeId,
  }) {
    const {
      renderMethodName,
      getStencilMethodName,
      getSyntheticNodeIdMethodName,
      getCallExpression, getValue,
      getIdentifier, getVariableEnvelope,
    } = TemplatePreprocessor;
    // Update method name, to indicate that it's synthetic
    expression.id.name = `${addSyntheticPrefix ? TemplatePreprocessor.syntheticMethodPrefix : ''}${expression.id.name}`;

    if (syntheticNodeId) {
      const body = expression.body.body;
      assert(utils.peek(body).type === 'ReturnStatement');

      const variableName = utils.generateRandomString();

      const stmt = getVariableEnvelope(variableName);
      stmt.declarations[0].init = utils.peek(body).argument;

      body[body.length - 1] = stmt;

      body.push({
        type: 'ExpressionStatement',
        expression: getCallExpression({
          methodName: renderMethodName,
          args: [
            getValue({
              data: getIdentifier(variableName),
              target: getCallExpression({
                methodName: getSyntheticNodeIdMethodName,
              }),
            }),
          ],
        }),
      });

      body.push({
        type: 'ReturnStatement',
        argument: getCallExpression({ methodName: getStencilMethodName }),
      });
    }

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

  addDataVariablesToContext({
    contextObject, path, dataVariables, synthetic,
  }) {
    const {
      dataPathRoot, pathSeparator,
    } = TemplatePreprocessor;

    for (const qualifier in dataVariables) {
      if ({}.hasOwnProperty.call(dataVariables, qualifier)) {
        const dataVariable = dataVariables[qualifier];

        contextObject[qualifier] = {
          type: 'PathExpression',
          lookup: false,
          ...synthetic ? {
            value: this.createIterateDataVariable({
              path,
              dataVariable,
            }),
            synthetic: true,
          } : {
              value: `${dataPathRoot}${pathSeparator}${path}_$${pathSeparator}${dataVariable}`,
            },
        };
      }
    }
  }

  createSubExpression({
    bindParents, contextList, method, params = [],
    hash, syntheticAlias, stmt, async, syntheticNodeId,
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
      syntheticNodeId,
      async,
    });

    if (!synthethicMethodName) {
      return false;
    }

    this.helpers.push(synthethicMethodName);

    return synthethicMethodName;
  }

  static createSubExpressionFromPath({ stmt }) {
    const { createPathExpression, getDefaultLoc } = TemplatePreprocessor;
    const { original, loc } = stmt;

    utils.clear(stmt);

    stmt.type = 'SubExpression';
    stmt.path = createPathExpression({ original });
    stmt.params = [];
    stmt.loc = loc;

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

  static createPathExpression({ original }) {
    return {
      type: 'PathExpression',
      data: false,
      depth: 0,
      parts: [...original.split('.')],
      original,
    };
  }

  static createMustacheStatement({ stmt = {}, original, hash }) {

    const { createPathExpression, getDefaultLoc } = TemplatePreprocessor;
    const { loc } = stmt;

    utils.clear(stmt);

    stmt.type = 'MustacheStatement';
    stmt.path = createPathExpression({ original }),
      stmt.params = [],
      stmt.hash = hash
    stmt.loc = loc || getDefaultLoc();

    // Todo: is this needed?
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
        key: 'rootProxy',
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
      syntheticMethodPrefix, getCallExpression,
      hasDataPathFormat, getProxyStatement, getValue,
    } = TemplatePreprocessor;

    if (!suffix.length) {
      suffix = false;
    }

    let synthethicMethodName = suffix ? null : `${hasDataPathFormat(path) ? syntheticMethodPrefix : ''}${path}`;

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
      const stmt = utils.peek(body);
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
        stmt,
      }),
    });
    stmt.path.processed = true;

    return scopeQualifier;
  }

  static getHashValue({
    stmt, key, type, cleanup = false,
  }) {
    const { getLine } = TemplatePreprocessor;
    if (stmt.hash) {
      const { pairs } = stmt.hash;
      // eslint-disable-next-line no-plusplus
      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        if (pair.key === key) {
          if (cleanup) {
            pairs.splice(i, 1);
          }
          if (type && pair.value.type !== type) {
            throw new Error(`Expected hash value of type '${type}' for key '${key}', line: ${getLine(stmt)}`);
          }
          return pair.value;
        }
      }
    }
    return null;
  }

  static getOptionsRetrivalStatements() {
    const {
      getCallExpression,
    } = TemplatePreprocessor;
    return [{
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
    }];
  }

  createCustomBlockPath({
    methodName,
    stmt,
  }) {
    const {
      getMethodFromFunctionDeclaration,
    } = TemplatePreprocessor;

    const ast = (stmt.async
      ? this.getCustomBlockAsyncFuntion : this.getCustomBlockSyncFuntion)({ methodName, stmt });

    this.componentAst.body[0].body.body
      .push(getMethodFromFunctionDeclaration({ ast }));

    this.helpers.push(ast.id.name);

    return ast.id.name;
  }

  getCustomBlockAsyncFuntion({ methodName, stmt }) {
    const {
      validateTypeMethodName, renderBlockMethodName, renderMethodName, getLoaderMethodName,
      chainedLoadingStratedyFieldName, getSyntheticNodeIdMethodName,
      getIdentifier, createPromise, getCallExpression,
      getValue, getOptionsRetrivalStatements, getVariableEnvelope, getShorthandObjectValue,
      createMemberExpression,
    } = TemplatePreprocessor;
    return {
      type: 'FunctionDeclaration',
      id: {
        type: 'Identifier',
        name: utils.generateRandomString(),
      },
      params: [],
      body: {
        type: 'BlockStatement',
        body: [
          ...getOptionsRetrivalStatements(),

          getVariableEnvelope('methodName', getValue(methodName)),

          getVariableEnvelope('data', createPromise({
            thenParameter: 'data',
            expressions: [
              getCallExpression({
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
              {
                type: 'BlockStatement',
                body: [
                  {
                    type: 'ExpressionStatement',
                    expression: getCallExpression({
                      methodName: validateTypeMethodName,
                      args: [{
                        path: getIdentifier('methodName'),
                        value: getIdentifier('data'),
                        validTypes: getValue(['Object']),
                      }]
                        .map(getValue, this),

                    }),
                  },
                  {
                    type: 'ReturnStatement',
                    argument: getCallExpression({
                      methodName: renderBlockMethodName,
                      args: [
                        getShorthandObjectValue(['data', 'options']),
                      ],
                    }),
                  },
                ],
              },
            ],
          })),
          {
            type: 'ExpressionStatement',
            expression: getCallExpression({
              methodName: renderMethodName,
              args: [{
                data: getIdentifier('data'),
                target: getCallExpression({
                  methodName: getSyntheticNodeIdMethodName,
                }),
                strategy: createMemberExpression({
                  target: 'BaseComponent',
                  key: chainedLoadingStratedyFieldName,
                }),
              }]
                .map(getValue, this),

            }),
          },
          {
            type: 'ReturnStatement',
            argument: getCallExpression({ methodName: getLoaderMethodName }),
          },
        ],
      },
      generator: false,
      expression: false,
      async: false,
    };
  }

  // eslint-disable-next-line class-methods-use-this
  getCustomBlockSyncFuntion({ methodName }) {
    const {
      validateTypeMethodName, getIdentifier,
      getCallExpression, getValue, getOptionsRetrivalStatements,
      getVariableEnvelope, getShorthandObjectValue,
    } = TemplatePreprocessor;
    return {
      type: 'FunctionDeclaration',
      id: {
        type: 'Identifier',
        name: utils.generateRandomString(),
      },
      params: [],
      body: {
        type: 'BlockStatement',
        body: [
          ...getOptionsRetrivalStatements(),
          getVariableEnvelope('methodName', getValue(methodName)),
          getVariableEnvelope('data', getCallExpression({
            computed: true,
            methodName: 'methodName',
            args: [{
              type: 'SpreadElement',
              argument: {
                type: 'Identifier',
                name: 'params',
              },
            }],
          })),
          {
            type: 'ExpressionStatement',
            expression: getCallExpression({
              methodName: validateTypeMethodName,
              args: [{
                path: getIdentifier('methodName'),
                value: getIdentifier('data'),
                validTypes: getValue(['Object']),
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
          },
        ],
      },
    };
  }

  static getCustomContextAsyncFunction({ stmt }) {
    const {
      getIdentifier,
      getOptionsRetrivalStatements,
      createMemberExpression,
      getCallExpression,
      getValue,
    } = TemplatePreprocessor;
    return {
      type: 'FunctionDeclaration',
      id: {
        type: 'Identifier',
        name: utils.generateRandomString(),
      },
      params: [],
      body: {
        type: 'BlockStatement',
        body: [
          ...getOptionsRetrivalStatements(),
          {
            type: 'ReturnStatement',
            argument: getCallExpression({
              methodName: stmt.path.original,
              args: [
                {
                  type: 'SpreadElement',
                  argument: getIdentifier('params'),
                },
                getValue({
                  hash: createMemberExpression({ target: 'options', key: 'hash' }),
                }),
              ],
            }),
          },
        ],
      },
    };
  }

  static getCustomContextSyncFunction({ stmt }) {
    const {
      renderMethodName,
      getStencilMethodName,
      getSyntheticNodeIdMethodName,
      getIdentifier,
      getOptionsRetrivalStatements,
      createMemberExpression,
      getCallExpression,
      getValue,
      getVariableEnvelope,
    } = TemplatePreprocessor;
    return {
      type: 'FunctionDeclaration',
      id: {
        type: 'Identifier',
        name: utils.generateRandomString(),
      },
      params: [],
      body: {
        type: 'BlockStatement',
        body: [
          ...getOptionsRetrivalStatements(),
          getVariableEnvelope('data', getCallExpression({
            methodName: stmt.path.original,
            args: [
              {
                type: 'SpreadElement',
                argument: getIdentifier('params'),
              },
              getValue({
                hash: createMemberExpression({ target: 'options', key: 'hash' }),
              }),
            ],
          })),
          {
            type: 'ExpressionStatement',
            expression: getCallExpression({
              methodName: renderMethodName,
              args: [
                getValue({
                  data: getIdentifier('data'),
                  target: getCallExpression({
                    methodName: getSyntheticNodeIdMethodName,
                  }),
                }),
              ],
            }),
          },
          {
            type: 'ReturnStatement',
            argument: getCallExpression({ methodName: getStencilMethodName }),
          },
        ],
      },
    };
  }


  static getAllValidTypes() {
    const {
      literalType, arrayType, objectType, mapType, componentType,
    } = TemplatePreprocessor;
    return [literalType, arrayType, objectType, mapType, componentType];
  }

  getBlockOptions(stmt) {
    const {
      getAllValidTypes, getLine, ensureNoLiteralParam0,
      arrayType, objectType, mapType, addDefaultParamToCustomBlock,
    } = TemplatePreprocessor;
    const {
      scopeQualifier, indexQualifier,
    } = this.getBlockQualifiers({ stmt });

    let validTypes = [];
    let contextSwitching = false;
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
        // Set this as a conditional, since it will
        // be transformed to a conditional block
        conditional = true;

        break;
      default:
        custom = true;
        allowLiteralParams = true;

        if (addDefaultParamToCustomBlock && !stmt.params.length) {
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
      if (stmt.params.length > 1) {
        throw new Error(`Only 1 param should be provided: ${getLine(stmt)}`);
      }

      // Block params are no longer useful at this point
      delete stmt.program.blockParams;
    }

    if (!allowLiteralParams) {
      ensureNoLiteralParam0({ stmt });
    }

    if (requiresScopeQualifier && !scopeQualifier) {
      // This is either an #with, #each or custom block
      throw new Error(`Scope qualifier must be specified: ${getLine(stmt)}`);
    }

    return {
      validTypes,
      contextSwitching,
      scopeQualifier,
      indexQualifier,
      canIterate,
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

  static ensureNoLiteralParam0({ stmt }) {
    const { getLine } = TemplatePreprocessor;
    const param = stmt.params[0];
    // eslint-disable-next-line default-case
    switch (true) {
      case param.type.endsWith('Literal'):
        throw new Error(`#${stmt.path.original} cannot contain a ${param.type} param, line: ${getLine(stmt)}`);

      case param.type.endsWith('PathExpression')
        && param.original === '':
        // PathExpression == []
        throw new Error(`#${stmt.path.original} cannot contain an empty ${param.type} param, line: ${getLine(stmt)}`);
    }
  }

  getSyntheticMethodValue({ path, method, validTypes = [] }) {
    const { mapType } = TemplatePreprocessor;

    // Allow hbs engine to attempt to resolve this synthetic method
    // Todo: remove, not necessary to add here
    this.dataPaths.push(method);

    // we need to serialize, so we can invoke the method
    // to get it's returned type (for validation purpose)

    this.serializeAst();

    // Note that if <method> is a mustache-based invocation, <value> will
    // always be an empty string
    const value = this.component[
      validTypes[0] == mapType
        // setSyntheticContext(...) will always return an object, hence
        // causing validation error, so call <path> directly
        ? path
        : method
    ]();

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
    const { syntheticMethodPrefix, hasDataPathFormat } = TemplatePreprocessor;
    return hasDataPathFormat(value) || value.startsWith(syntheticMethodPrefix);
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
      rawDataPrefix, syntheticMethodPrefix,
    } = TemplatePreprocessor;

    const arr = original.split('.');
    const index = arr.length - 1;

    const arr2 = arr[index].split(pathSeparator);

    if (arr2[0] === dataPathRoot) {
      if (!arr2[1].startsWith(rawDataPrefix)) {
        arr2[1] = `${rawDataPrefix}${arr2[1]}`;
      }
    } else if (!arr2[0].startsWith(rawDataPrefix)) {
      assert(arr2[0].startsWith(syntheticMethodPrefix));
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

  addDataBindTransformations() {
    const { ast } = this;

    const {
      customEachHelperName, stencilCssClassname, setSyntheticNodeIdHelperName,
      startTNBCtxHelperName, startAttrCtxHelperName, endAttrCtxHelperName,
      replaceNodes, createContentStatement, createMustacheStatement,
      getLine,
    } = TemplatePreprocessor;

    const START_TAG_START = 'token:open-tag-start';
    const START_TAG_END = 'token:open-tag-end';
    const END_TAG = 'token:close-tag';
    const ATTR_VALUE_WRAPPER_START = 'token:attribute-value-wrapper-start';
    const ATTR_VALUE_WRAPPER_END = 'token:attribute-value-wrapper-end';
    const ATTR_KEY = 'token:attribute-key';
    const ATTR_ASSIGNMENT = 'token:attribute-assignment';
    const ATTR_VALUE = 'token:attribute-value';

    const streamTokenizer = new StreamTokenizer();

    let tokenList = [];

    const createTextNodeBindWrapper = ({ stmt, addStencilClass = false }) => {
      const { parent } = stmt;

      const tagName = 'span';

      const index = parent.body.indexOf(stmt);

      replacements.push({
        parent: parent.body,
        replacementIndex: index,
        replacementNodes: [
          createContentStatement({
            original: `<${tagName} ${addStencilClass ? `class='${stencilCssClassname}' ` : ''}id='`,
          }),
        ],
      });

      replacements.push({
        parent: parent.body,
        replacementIndex: index,
        replacementNodes: [
          createMustacheStatement({ original: startTNBCtxHelperName }),
        ],
      });

      replacements.push({
        parent: parent.body,
        replacementIndex: index,
        replacementNodes: [
          createContentStatement({
            original: '\'>',
          }),
        ],
      });

      replacements.push({
        parent: parent.body,
        replacementIndex: index + 1,
        replacementNodes: [
          createContentStatement({
            original: `</${tagName}>`,
          }),
        ],
      });
    };

    const createEndAttributeCtxStatement = ({ stmt }) => {
      const { parent, original } = stmt;

      const arr = original.split('');

      let i = 0;

      while (i < arr.length) {
        if (arr[i] === '>') {
          if (arr[i - 1] === '/') {
            i -= 1;
          }
          break;
        }
        i++;
      }

      let replacementNodes = [
        createContentStatement({
          original: arr.slice(0, i).join(''),
        }),
        createContentStatement({
          original: ' id=\'',
        }),
        createMustacheStatement({ original: endAttrCtxHelperName }),
        createContentStatement({
          original: `'${arr.slice(i, arr.length).join('')}`,
        }),
      ];

      replacementNodes = replacementNodes.map((node) => {
        node.parent = parent;
        return node;
      });

      parent.body.splice(parent.body.indexOf(stmt), 1, ...replacementNodes);
    };

    const createStartAttributeCtxStatement = ({ stmt, attributeList }) => {
      const { parent, original } = stmt;

      const arr = original.split('');

      let i = arr.length - 1;

      while (i >= 0) {
        if (arr[i] === '<') {
          break;
        }
        i--;
      }

      let replacementNodes = [
        createContentStatement({
          original: arr.slice(0, i + 1).join(''),
        }),
        createMustacheStatement({ original: startAttrCtxHelperName }),
        createContentStatement({
          original: `${arr.slice(i + 1, arr.length).join('')}`,
        }),
      ];

      parent.body.splice(parent.body.indexOf(stmt), 1, ...replacementNodes);
    };

    const getCurrentAttributesList = ({ index }) => {
      const allowedTokens = [
        START_TAG_START, ATTR_KEY, ATTR_ASSIGNMENT, ATTR_VALUE,
        ATTR_VALUE_WRAPPER_START, ATTR_VALUE_WRAPPER_END,
      ];

      const arr = [];

      const startTagEnd = tokenList[index];

      assert(startTagEnd.content === '>' || startTagEnd.content === '/>');

      arr.push(startTagEnd);

      let i = index - 1;
      while (i >= 0) {
        const token = tokenList[i];
        assert(allowedTokens.includes(token.type));
        arr.push(token);
        if (token.type === START_TAG_START) {
          break;
        }
        // eslint-disable-next-line no-plusplus
        i--;
      }

      // eslint-disable-next-line no-shadow
      const { ast } = constructTree(arr.reverse());

      const node = utils.peek(ast.content.children);

      assert(node.nodeType === 'tag');

      const attributes = {};

      if (!node.content.attributes) {
        return attributes;
      }

      node.content.attributes.forEach((attribute) => {
        // eslint-disable-next-line no-shadow
        const allowedTokens = [
          ATTR_KEY, ATTR_VALUE_WRAPPER_START,
          ATTR_VALUE, ATTR_VALUE_WRAPPER_END,
        ];

        // Ensure unique token type
        for (const { type } of Object.values(attribute)) {
          assert(allowedTokens.includes(type));
          allowedTokens.splice(allowedTokens.indexOf(type), 1);
        }

        let {
          key, startWrapper, value, endWrapper,
        } = attribute;

        assert(!!key);

        // Ensure that if there is no value, there must be no wrapper
        assert(!!value || (!startWrapper && !endWrapper));

        if (!value) {
          // Default to the boolean value: true
          value = {
            type: ATTR_VALUE,
            content: 'true',
          };
        }

        if (!startWrapper) {
          // If no quote exists the value, we will need to it, because later on, we
          // will need to eval the value, and expect a string return value
          startWrapper = { type: ATTR_VALUE_WRAPPER_START, content: '"' };
          endWrapper = { type: ATTR_VALUE_WRAPPER_END, content: '"' };
        }

        // Removing surrounding quotes, Note: does not removing `
        const k = key.content.replace(/('|")*/g, '');

        let vExpr = `${startWrapper.content}${value.content}${endWrapper.content}`;

        vExpr = vExpr.replaceAll(/\s+/g, ' ');

        let v = eval(vExpr);

        assert(typeof v === 'string');

        const isNumeric = str => !isNaN(str)
          && !isNaN(parseFloat(str));


        const isBoolean = (str) => {
          const b = str.toLowerCase();
          return b === 'true' || b === 'false';
        };

        // eslint-disable-next-line default-case
        switch (true) {
          case isNumeric(v):
            v = Number(v);
            break;
          case isBoolean(v):
            v = v.toLowerCase() === 'true';
            break;
        }

        attributes[k] = v;
      });

      return attributes;
    };

    const statements = [];

    streamTokenizer
      .on('data', (tokens) => {
        const len = tokenList.length;
        tokenList = tokenList.concat(tokens);

        let startTagEnd = -1;

        // eslint-disable-next-line no-plusplus
        for (let i = 0; i < tokens.length; i++) {
          const token = tokens[i];
          if (token.type === START_TAG_END) {
            startTagEnd = i + len;
            break;
          }
        }

        const stmt = utils.peek(statements);

        if (startTagEnd >= 0) {
          assert(stmt.type === 'ContentStatement');
          assert(stmt.original.includes('>'));

          let htmlAttributeList = getCurrentAttributesList({
            index: startTagEnd,
          });

          const attributeList = {};
          const isMustacheAttr = (v) => {
            if (typeof v !== 'string') {
              return false;
            }
            const m = v.match(/{{/g);

            // We cannot data-bind for a particular attribute that consists
            // of more than one mustache statement, or at least for now
            // Todo: can the above be implemented?
            return m && m.length === 1;
          };

          for (const k in htmlAttributeList) {
            const v = htmlAttributeList[k];

            const isMstKey = isMustacheAttr(k);
            const isMstValue = isMustacheAttr(v);

            if (isMstKey || isMstValue) {
              if (isMstKey && isMstValue) {
                continue;
              }

              if (isMstKey && Object.values(htmlAttributeList).filter(a => a === v).length > 1) {
                // There are multiple attributes with the same value, so there is no way uniquely
                // identify this attribute on runtime, so we do not databing
                // Todo: we can maintain an attribute value index and then use that
                continue;
              }

              attributeList[k] = v;
            }
          }

          let hasDataPaths = Object.keys(attributeList).length;

          const hasArbitraryId = htmlAttributeList.id
            && htmlAttributeList.id !== `{${setSyntheticNodeIdHelperName}}`
            && htmlAttributeList.id !== '{{@random}}';

          if (hasArbitraryId) {
            if (stmt.inIterateContext || hasDataPaths) {
              throw new Error(`You cannot provide a HtmlElement ID: ${htmlAttributeList.id}, line ${getLine(stmt)}`);
            }
          } else if (htmlAttributeList.id) {
            assert(
              !Object.keys(attributeList).filter(k => k !== 'id').length,
              `You cannot provide a dynamic HTML attribute, line ${getLine(stmt)}`,
            );
          }

          if (hasDataPaths) {
            const { parent } = stmt;
            const index = parent.body.indexOf(stmt);

            for (let i = index - 1; i >= 0; i--) {
              const stmt = parent.body[i];
              if (stmt.type === 'ContentStatement' && stmt.original.includes('<')) {
                createStartAttributeCtxStatement({ stmt, attributeList });
                break;
              }
            }

            createEndAttributeCtxStatement({ stmt });
          }
        }
      });

    let contents = [];

    const onContentStatement = (stmt) => {
      let { original } = stmt;

      const arr = original.split('');
      contents = [...contents, ...arr];

      statements.push(stmt);
      streamTokenizer.write(original);
    };

    const getIndex = (clockwise, array, index, char, terminateChar, defaultValue = -1) => {
      while (clockwise ? index < array.length : index >= 0) {
        if (array[index] === char) {
          return index;
        }
        if (terminateChar && array[index] === terminateChar) {
          return -1;
        }
        if (clockwise) {
          // eslint-disable-next-line no-plusplus
          index++;
        } else {
          // eslint-disable-next-line no-plusplus
          index--;
        }
      }
      return defaultValue;
    };

    const onMustacheStatement = (stmt) => {
      const { rawDataPrefix, resolveMustacheHelperName } = TemplatePreprocessor;

      const { hash, path } = stmt;
      let { processed, original, dataVariable } = path;
      let tokenizerOriginal;

      if (processed) {
        if (original === resolveMustacheHelperName) {
          // Remove "data." if applicable
          original = hash.pairs[0].value.original.replace(/^data\./g, '');

          // Remove "r$_" if applicable
          original = original.replace(rawDataPrefix, '');

          tokenizerOriginal = `{{${dataVariable || original}}}`;

          const isTextNode = getIndex(false, contents, contents.length - 1, '>', '<', 0);

          if (isTextNode >= 0) {
            createTextNodeBindWrapper({ stmt });
          }
        } else {
          tokenizerOriginal = `{${original}}`;
        }
      } else {
        tokenizerOriginal = `{${utils.generateRandomString()}}`;
      }

      statements.push(stmt);
      streamTokenizer.write(tokenizerOriginal);
    };

    // AST VISITOR

    const bindParents = [{ body: ast.body }];
    const { Visitor } = handlebars;

    const allStatements = [];
    const replacements = [];

    let CLEANUP_MODE = false;

    function ASTParser() {
    }
    ASTParser.prototype = new Visitor();

    const isInIterateBlock = () => {
      for (let i = bindParents.length - 1; i > 0; i--) {
        const parent = bindParents[i];
        const { original } = parent;
        if (original === 'each' || original === customEachHelperName) {
          return true;
        }
      }
      return false;
    };
    ASTParser.prototype.ContentStatement = function (stmt) {
      if (CLEANUP_MODE) {
        this.mutating = true;
        stmt.parent = undefined;
        return stmt;
      }
      stmt.parent = utils.peek(bindParents);
      stmt.inIterateContext = isInIterateBlock();
      allStatements.push(stmt);
    };

    ASTParser.prototype.MustacheStatement = function (stmt) {
      if (CLEANUP_MODE) {
        this.mutating = true;
        stmt.parent = undefined;
        return stmt;
      }
      stmt.parent = utils.peek(bindParents);
      stmt.inIterateContext = isInIterateBlock();
      allStatements.push(stmt);
    };

    ASTParser.prototype.BlockStatement = function (stmt) {
      if (CLEANUP_MODE) {
        return;
      }

      bindParents.push({
        original: stmt.path.original,
        body: stmt.program.body,
      });

      this.acceptKey(stmt, 'program');

      bindParents.pop();

      if (stmt.inverse) {
        bindParents.push({
          body: stmt.inverse.body,
        });
        this.acceptKey(stmt, 'inverse');
        bindParents.pop();
      }
    };

    const parser = new ASTParser();

    parser.accept(ast);

    for (const stmt of allStatements) {
      switch (stmt.type) {
        case 'ContentStatement':
          onContentStatement(stmt);
          break;
        case 'MustacheStatement':
          onMustacheStatement(stmt);
          break;
      }
    }

    replaceNodes(replacements);

    CLEANUP_MODE = true;
    parser.accept(ast);
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
      syntheticMethodPrefix,
      blockParamHashKey,
      resolveLiteralsWithProxy,
      resolverComponentRefType,
      asyncHashKey,
      addDefaultParamToCustomBlock,
      invokeOnCompileHashKey,
      wordPattern,
      stencilCssClassname,
      trimObjectPath,
      hasObjectPrefix,
      getCallExpression,
      addRawDataPrefixToPath0,
      addRawDataPrefixToPath,
      resetPathExpression,
      createPathFromSubExpression,
      createPathExpression,
      createSubExpressionFromPath,
      createMustacheStatement,
      getHashValue,
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
      defaultIndexResolver,
      createContentStatement,
      getMethodFromFunctionDeclaration,
      getCustomContextAsyncFunction,
      getCustomContextSyncFunction,
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

    // Transform logical expressions
    new LogicalExprTransformer({
      Preprocessor: TemplatePreprocessor,
      preprocessor: this,
    })
      .transform();

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

    const isCustomContext = () => this.customBlockCtx || utils.peek(customBlockCtx).value;

    const allowRootAccess = ({ stmt } = {}) => {
      if (stmt) {
        const allow = getHashValue({
          stmt, key: allowRootAccessHashKey,
        }) || { original: allowRootAccessByDefault };

        return !!allow.original;
      }

      return this.allowRootAccess || utils.peek(customBlockCtx).allowRootAccess;
    };

    const isAsync = ({ stmt }) => {
      const async = stmt.async || (
        getHashValue({
          stmt, key: asyncHashKey, type: 'BooleanLiteral', cleanup: true,
        })
        || { original: false }
      ).original;
      stmt.async = async;
      return async;
    };

    const canInvokeOnCompile = ({ stmt }) => {
      const invokeOnCompile = stmt.invokeOnCompile || (
        getHashValue({
          stmt, key: invokeOnCompileHashKey, type: 'BooleanLiteral', cleanup: true,
        })
        || { original: false }
      ).original;
      stmt.invokeOnCompile = invokeOnCompile;
      return invokeOnCompile;
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

    const getClosestAsyncContext = () => {
      // eslint-disable-next-line no-plusplus
      for (let j = customBlockCtx.length - 1; j >= 0; j--) {
        const ctx = customBlockCtx[j];
        if (ctx.async) {
          return ctx;
        }
      }
      return null;
    };

    const acceptPathExpressionInCustomCtx = ({ stmt }) => {
      const { getTargetType } = TemplatePreprocessor;
      const prev = stmt.original;

      if (stmt.processed) {
        return stmt;
      }

      if (this.methodNames.includes(prev)) {
        if (isPathUnconstrained({ stmt })) {
          const expr = createSubExpressionFromPath({
            stmt,
          });

          _this.helpers.push(prev);

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

      const asyncContext = stmt.async ? {
        contextListIndex: contextList.length,
      } : getClosestAsyncContext();

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

        // eslint-disable-next-line no-plusplus
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
                if (asyncContext && contextObject[k].index < asyncContext.contextListIndex) {
                  throw new Error(`${prev} is unreachable, line ${getLine(stmt)}`);
                }

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

              if (asyncContext && contextObject[rootQualifier].inIterateContext) {
                throw new Error(`${prev} is unreachable, line ${getLine(stmt)}`);
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
                original = this.createDataPathIndirection({
                  stmt,
                  path: v.value,
                  useProxy: false,
                  suffix: k === original ? false : getSuffix(original),
                  processLiteralSegment: true,
                });
                resetPathExpression({
                  stmt,
                  original,
                  properties: {
                    processed: true,
                  },
                });
              } else {
                original = trimObjectPath({
                  value: this.component[processLiteralSegmentMethod]({ original }),
                  repl: v.value,
                });

                // Add to data model
                const path = this.component.getExecPath({
                  fqPath: original
                    .replace(`${dataPathRoot}${pathSeparator}`, '')
                    .replace(/\./g, pathSeparator),
                  indexResolver: defaultIndexResolver,
                });
                const value = this.resolver.resolve({ path, create: !stmt.immutable });
                this.component.validateType({
                  path: prev,
                  value,
                  validTypes: stmt.validTypes,
                  line: getLine(stmt),
                });
                stmt.targetType = getTargetType(value);

                resetPathExpression({
                  stmt,
                  original: addRawDataPrefixToPath(
                    original.split('.').join(pathSeparator),
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

        if (asyncContext && contextObject[rootQualifier].inIterateContext) {
          throw new Error(`${prev} is unreachable, line ${getLine(stmt)}`);
        }

        const rootValue = contextObject[rootQualifier].value;
        original = this.component[processLiteralSegmentMethod]({ original });

        original = rootValue
          + (original.length && !original.startsWith('[') ? pathSeparator : '')
          + original.split('.').join(pathSeparator);

        if (original !== dataPathRoot
          && !original.startsWith(`${dataPathRoot}${pathSeparator}`)
          && !original.startsWith(`${syntheticMethodPrefix}`)
        ) {
          // This is specifically for scenarios wheere the developer may
          // try to resolve @root.[0] where @root is the root data context
          // thereby resulting in original == data[0]
          throw new Error(`Invalid path: ${prev}`);
        }

        if (original === dataPathRoot) {
          original += pathSeparator;
        }

        // Add to data model
        const path = this.component.getExecPath({
          fqPath: original
            .replace(`${dataPathRoot}${pathSeparator}`, '')
            .replace(/\./g, pathSeparator),
          indexResolver: defaultIndexResolver,
        });

        const value = this.resolver.resolve({ path, create: !stmt.immutable });
        this.component.validateType({
          path: prev,
          value,
          validTypes: stmt.validTypes,
          line: getLine(stmt),
        });
        stmt.targetType = getTargetType(value);

        resetPathExpression({
          stmt,
          original: addRawDataPrefixToPath(original),
          properties: {
            processed: true,
          },
        });
      } else if (asyncContext && contextObject[
        Object.keys(contextObject)[0]
      ].index < asyncContext.contextListIndex) {
        throw new Error(`${prev} is unreachable, line ${getLine(stmt)}`);
      }

      if (stmt.forRoot && getOuterInlineBlock({ bindParents }) == null && !stmt.processed) {
        throw new Error(`Could not resolve root path: ${prev}, line: ${getLine(stmt)}`);
      }

      return stmt;
    };

    const acceptPathExpressionInRootCtx = ({ stmt }) => {
      if (stmt.processed) {
        return stmt;
      }

      const { getDataVariables } = TemplatePreprocessor;
      let { type, original } = stmt;

      if (getDataVariables().includes(original)) {
        stmt.dataVariable = original;
      }

      let synthetic = false;
      let lookup = false;
      let targetType;

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
          validTypes: stmt.validTypes || null,
          create: !stmt.immutable,
        });

        if (path) {
          type = path.type;
          original = path.original;
          synthetic = path.synthetic;
          targetType = path.targetType;
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
              targetType,
              dataVariable: stmt.dataVariable,
            },
          });
        case type && type.endsWith('Literal'):
          return resolveLiteralsWithProxy ? {
            ...createPathExpression({
              original: `${dataPathRoot}${pathSeparator}${literalPrefix}${original}`,
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

      bindParents.push({
        type: stmt.type,
        original: stmt.path.original,
        body: stmt.program.body,
        parent: utils.peek(bindParents),
      });

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
      bindParents.push({
        type: stmt.type,
        original: stmt.path.original,
        body: stmt.program.body,
        parent: utils.peek(bindParents),
      });

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

    const createHtmlWrapper = ({ stmt, tagName = 'div', addStencilClass = true }) => {
      const { htmlWrapperCssClassname, setSyntheticNodeIdHelperName } = TemplatePreprocessor;
      const parent = utils.peek(bindParents);

      const index = parent.body.indexOf(stmt);

      replacements.push({
        parent: parent.body,
        replacementIndex: index,
        replacementNodes: [
          createContentStatement({
            original: `<${tagName} id='`,
          }),
          createMustacheStatement({
            original: setSyntheticNodeIdHelperName,
          }),
          createContentStatement({
            original: `' class='${htmlWrapperCssClassname}${addStencilClass ? ` ${stencilCssClassname}` : ''}'>\n`,
          }),
        ],
      });

      replacements.push({
        parent: parent.body,
        replacementIndex: index + 1,
        replacementNodes: [
          createContentStatement({
            original: `\n</${tagName}>`,
          }),
        ],
      });

      stmt.syntheticNodeId = true;
    };

    const validateHash = ({ stmt, reservedKeys }) => {
      (stmt.hash || { pairs: [] }).pairs
        .forEach((pair) => {
          if (reservedKeys.includes(pair.key)) {
            throw new Error(`Hashkey: ${pair.key} not allowed, line: ${getLine(stmt)}`);
          }
        });
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

      this.mutating = true;

      const { fromMustache, async } = stmt;
      const canInvoke = fromMustache && canInvokeOnCompile({ stmt });

      if (isCustomContext()) {
        _this.validateMethod(stmt.path.original);

        _this.helpers.push(stmt.path.original);

        if (!isPathUnconstrained({ stmt: stmt.path })) {
          throw new Error(`Path ${stmt.path.original} must be unconstrained`);
        }

        Visitor.prototype.SubExpression.call(this, stmt);

        stmt.path = createPathFromSubExpression({
          stmt: stmt.path,
        });

        if (fromMustache && !stmt.synthetic) {
          // For custom contexts, SubExpressions are not "completely" transformed
          // like we do in the root context, hence we need to processed at the
          // earliest possible time

          if (canInvoke) {
            _this.getSyntheticMethodValue({
              path: stmt.path.original,
              method: stmt.path.original,
            });
          }

          // eslint-disable-next-line no-shadow
          const ast = (async ? getCustomContextAsyncFunction
            : getCustomContextSyncFunction
          )({ stmt });

          _this.componentAst.body[0].body.body
            .push(getMethodFromFunctionDeclaration({ ast, async }));

          const synthethicMethodName = ast.id.name;

          _this.helpers.push(synthethicMethodName);

          stmt.path = createPathExpression({ original: synthethicMethodName });
          stmt.synthetic = true;
        }
      } else {
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
          hash: stmt.hash,
          syntheticNodeId: stmt.syntheticNodeId,
          async,
        });

        if (stmt.type === 'PathExpression') {
          // For the root context, we want to invoke the function,
          // only when the SubExpression has been fully processed

          stmt.synthetic = true;

          let value;

          if (canInvoke || !fromMustache) {
            value = _this.getSyntheticMethodValue({
              path: prev,
              method: stmt.original,
            });
          }

          if (value) {
            // For expressions in mustache statements, lookup does not apply,
            // moreover, the target function is expected to return a String,
            // DOMElement or Component (promises also included) that is to be
            // rendered on the DOM - and in which case this synthetic function
            // will return an empty string

            stmt.lookup = value !== null && value !== undefined
              && isLookupAllowed(value.constructor.name);
          }
        }
      }

      return stmt;
    };

    ASTParser.prototype.BlockStatement = function (stmt) {
      this.mutating = true;
      const { hookHashKey } = TemplatePreprocessor;

      const addCustomBlockCtx = () => {
        if (stmt.contextObject) {
          customBlockCtx.push(stmt.customBlockCtx);
          contextList.push(stmt.contextObject);

          return;
        }

        if (getReservedBlockNames().includes(stmt.path.original)) {
          throw new Error(`The block name: ${stmt.path.original} is reserved, line: ${getLine(stmt)}`);
        }

        const async = isAsync({ stmt });

        stmt.customBlockCtx = {
          value: true,
          allowRootAccess: allowRootAccess({ stmt }),
          async,
          contextListIndex: contextList.length,
          method: stmt.path.original,
        };

        if (async) {
          createHtmlWrapper({ stmt });
        }

        customBlockCtx.push(stmt.customBlockCtx);

        const contextObj = {};

        contextObj[_this.updateCustomBlockHeaders({ stmt })] = {
          lookup: true,
          asVariable: true,
          scope: true,
          index: contextList.length,
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

      // If provided, ensure that the 'hook' hash has a string value
      getHashValue({
        stmt, key: hookHashKey, type: 'StringLiteral',
      });

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

        if (addDefaultParamToCustomBlock && !stmt.params.length) {
          stmt.params = [{
            depth: 0,
            data: false,
            type: 'PathExpression',
            original: 'this',
            parts: ['this'],
          }];
        }

        this.acceptArray(stmt.params);

        stmt.params.forEach(({ type, original }) => {
          if (type === 'PathExpression' && isRootCtxValue(original)) {
            _this.dataPaths.push(original);
          }
        });

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
              index: contextList.length,
            };

            if (qualifiers[1]) {
              contextObj[qualifiers[1]] = {
                lookup: false,
                index: contextList.length,
              };
            }

            contextList.push(contextObj);
            hasContextList = true;

          // eslint-disable-next-line no-fallthrough
          default:
            break;
        }


        bindParents.push({
          type: stmt.type,
          original: stmt.path.original,
          body: stmt.program.body,
          parent: utils.peek(bindParents),
        });

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
              hash: stmt.hash,
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
          } else {
            // For #with, #else, #if, #unless, we want to deliver the
            // param value to the helper in the format {path, value}
            // Notice that for conditional blocks, we are appending !
            // so that the underlying value will be returned, not our proxy
            _original = `${_original}!${conditional ? '!' : ''}`;
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

          utils.clear(stmt);

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

      // There should be at least one unprocessed param, if this is
      // a non-custom block
      assert(custom || paths.length);

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
          // Note: resolvedPath will be undefined if this is a #if, #unless or
          // custom block and all param(s) are literal types
          || {}
        );

      const { logicGate, logicGatePruneKey } = stmt;

      if (logicGate) {
        const original = addLogicGate({
          ...stmt,
          logicGate,
          logicGatePruneKey,
        });

        // Remove the last entry which is synthetic-based
        _this.dataPaths.pop();

        _this.dataPaths.push(`${original}!!`);

        isSynthetic = false;

        resetPathExpression({
          stmt: stmt.params[0],
          original: `${toCanonical(original)}!!`,
          properties: {
            processed: true,
          },
        });
      }

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
          // Todo: remove this
          const blockId = undefined;

          const path = original.replace(`${dataPathRoot}${pathSeparator}`, '');

          const parent = utils.peek(bindParents);

          const { customEachHelperName } = TemplatePreprocessor;

          const doBlockInitMethod = _this.createIterateInit({
            path: syntheticAlias || path,
            blockId,
          });

          const doBlockUpdateMethod = _this.createIterateUpdate({
            path: syntheticAlias || path,
          });

          // At the top of the #each block, invoke doBlockInit(..)
          replacements.push({
            parent: parent.body,
            replacementIndex: parent.body.indexOf(stmt),
            replacementNodes: [
              createMustacheStatement({
                original: doBlockInitMethod,
              }),
            ],
          });

          // At the top of the #each body, doBlockUpdate(..)
          stmt.program.body.unshift(
            createMustacheStatement({
              original: doBlockUpdateMethod,
            }),
          );

          createHtmlWrapper({ stmt, addStencilClass: false });

          stmt.path = createPathExpression({
            original: customEachHelperName,
          });

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
            '@random': '@random',
          };

          // Register index qualifier
          if (indexQualifier) {
            assert(targetType === 'Array');
            dataVariables[indexQualifier] = '@index';
          }

          // Register data variables in context object
          _this.addDataVariablesToContext({
            contextObject,
            path: syntheticAlias || path,
            dataVariables,
            synthetic: !!syntheticAlias,
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
          inIterateContext: canIterate || !!utils.peek(contextList)[rootQualifier].inIterateContext,
          index: contextList.length,
        };

        contextList.push(contextObject);

        stmt.contextObject = contextObject;
      }

      if (custom) {
        addCustomBlockCtx();
      }

      bindParents.push({
        type: stmt.type,
        original: stmt.path.original,
        body: stmt.program.body,
        parent: utils.peek(bindParents),
      });

      this.acceptKey(stmt, 'program');

      bindParents.pop();

      if (custom) {
        customBlockCtx.pop();
        contextList.pop();
      }

      if (contextSwitching) {
        contextList.pop();
      }

      if (stmt.inverse) {
        bindParents.push({
          type: stmt.type,
          body: stmt.inverse.body,
          parent: utils.peek(bindParents),
        });
        this.acceptKey(stmt, 'inverse');
        bindParents.pop();
      }

      if (conditional && type === 'PathExpression') {
        const { conditionalHelperName } = TemplatePreprocessor;

        const invert = stmt.path.original === 'unless';

        createHtmlWrapper({ stmt, addStencilClass: false });

        stmt.path = createPathExpression({
          original: conditionalHelperName,
        });

        stmt.params.push(
          createLiteral({
            type: 'BooleanLiteral',
            original: invert,
          }),
        );
      }

      stmt.processed = true;

      return stmt;
    };

    const processComponentImport = ({ stmt }) => {
      const { createStringLiteral } = TemplatePreprocessor;
      const defaultComponentName = 'BaseComponent';

      const alias = getHashValue({
        stmt, key: 'alias', type: 'StringLiteral', cleanup: true,
      }).original;

      if (!stmt.params.length) {
        stmt.params = [createStringLiteral(defaultComponentName)];
        this.metadata.hasSubComponent = true;
      }
      if (stmt.params.length !== 1 || !alias) {
        throw new Error(`Component import - Incorrect signature, line: ${getLine(stmt)}`);
      }

      if (!alias.match(wordPattern)) {
        throw new Error(`Please provide a valid alias, line: ${getLine(stmt)}`);
      }

      // The alias should not already exist as a property in the current context
      for (const contextObject of contextList) {
        const contextKeys = Object.keys(contextObject);
        if (contextKeys.includes(alias)) {
          throw new Error(`Alias name ${alias} already exists in the current context`);
        }
      }

      // The alias should not be a component name
      if (global.components[alias]) {
        throw new Error(`Component name: ${alias} cannot be used as alias, line ${getLine(stmt)}`);
      }

      const className = stmt.params[0].original;

      if (className != defaultComponentName && className != this.className) {
        // Attempt to load component class. The idea here is that
        // we want a fail fast behaviour
        // eslint-disable-next-line no-unused-expressions
        global.components[className];
      }

      const fqPath = `${utils.peek(contextList)[rootQualifier].value
        }${pathSeparator}${alias}`;

      const path = this.component.getExecPath({
        fqPath: fqPath.replace(/^data__/g, ''),
        indexResolver: defaultIndexResolver,
      });

      if (!!this.resolver.data[path]) {
        throw new Error(`Alias name ${alias} already exists in the current context`);
      }

      this.resolver.resolve({ path: `${path}%${resolverComponentRefType}/${className}` });

      return false;
    };

    const getMetaPaths = () => {
      const { componentImportPath } = TemplatePreprocessor;
      return [componentImportPath];
    };

    const processMetaStatement = ({ stmt }) => {
      const { componentImportPath } = TemplatePreprocessor;

      // eslint-disable-next-line default-case
      switch (stmt.path.original) {
        case componentImportPath:
          return processComponentImport({ stmt });
      }
    };

    const addLogicGate = (stmt) => {
      const { logicGatePathRoot, pathSeparator, hasDataPathFormat } = TemplatePreprocessor;

      const { logicGate, logicGatePruneKey } = stmt;

      assert(!!logicGate);

      // Prune the synthetic method generated for this logic gate
      this.pruneComponentAst({ pruneKey: logicGatePruneKey });

      const getValue = (item) => {
        switch (true) {
          case item.type == 'BooleanExpression':
            return {
              type: item.type,
              operator: item.operator,
              left: getValue(item.left),
              right: getValue(item.right)
            }
            break;
          case !Number.isNaN(parseInt(item, 10)):
            return {
              type: 'LogicGate',
              original: item,
            };
          case item.type == 'MustacheGroup':
            return {
              type: item.type, items: item.items.map(getValue),
            }
          default:
            return {
              type: item.type, original: item.original,
            }
        }
      };

      // Assert that all participants were properly transformed
      // as data paths
      logicGate.participants
        .forEach(({ original, processed }) => assert(
          processed && hasDataPathFormat(original),
          `Participant ${original} is not a data path, ${getLine(stmt)}`,
        ));

      // Since all participants are guaranteed to be data paths
      // convert from object: { type, original } to string: original
      logicGate.participants = logicGate.participants
        .map(({ original }) => original);

      logicGate.table = logicGate.table.map((item) => {
        item.condition = item.condition.map(getValue);

        item.left = getValue(item.left);
        item.right = getValue(item.right);

        return item;
      });

      const gateId = utils.generateRandomString();
      this.logicGates[gateId] = logicGate;

      return `${logicGatePathRoot}${pathSeparator}${gateId}`;
    };
    ASTParser.prototype.MustacheStatement = function (stmt) {
      if (stmt.path.processed) {
        return;
      }

      const { loadComponentHelperName } = TemplatePreprocessor;

      if (stmt.path.type.endsWith('Literal')) {

        // This is prohibited because attackers can bypass path validation,
        // since literals are generally not validated like PathExpressions are
        // and prefix data__ to the path, tricks the proxy into
        // performing arbitrary lookup

        throw new Error(`Invalid path: '${stmt.path.original
          }'. Only a PathExpression must be used in a MustacheStatement, line: ${getLine(stmt)}`);
      }

      const reservedMethodNames = [loadComponentHelperName];

      if (reservedMethodNames.includes(stmt.path.original) && !stmt.generated) {
        throw new Error(`Method name: ${stmt.path.original} is reserved, line: ${getLine(stmt)}`);
      }

      this.mutating = true;

      const isSubExpression = _this.methodNames.includes(stmt.path.original);
      const isMetaPath = getMetaPaths().includes(stmt.path.original);

      if ((!isSubExpression) && !isMetaPath && (stmt.params.length || stmt.hash)) {
        throw new Error(`Uknown method name: ${stmt.path.original}, line: ${getLine(stmt)}`);
      }

      const async = isAsync({ stmt });

      if (async) {
        visitNodes({
          types: ['PathExpression'],
          ast: {
            body: stmt.params,
          },
          // eslint-disable-next-line no-shadow
          consumer: ({ stmt }) => {
            if (!_this.methodNames.includes(stmt.original)) {
              stmt.async = true;
            }
          },
        });
      }

      if (isSubExpression) {
        stmt.fromMustache = true;

        if (isCustomContext()) {
          delete stmt.logicGate;
          delete stmt.logicGatePruneKey;

          delete stmt.prune;
          delete stmt.methodNameSuffix;
        }

        if (!async && !stmt.syntheticNodeId
          // If !!stmt.logicGate, then we are in the root ctx, and
          // this is not a proper sub expression, hence we should not
          // create a wrapper
          && !stmt.logicGate
        ) {
          createHtmlWrapper({ stmt });
        }
      }

      if (isCustomContext()) {
        if (isMetaPath) {
          throw new Error(`Meta definitions are not allowed within a custom context, line ${getLine(stmt)}`);
        }

        if (isSubExpression) {
          stmt.type = 'SubExpression';

          ASTParser.prototype.SubExpression.call(this, stmt);

          stmt.type = 'MustacheStatement';
        } else {
          this.acceptKey(stmt, 'path');

          if (stmt.path.processed) {
            _this.dataPaths.push(stmt.path.original);
          }
        }

        return stmt;
      }

      if (
        stmt.partialSkip
        // This is a synthetic method
        // It is likely that this was added by the BlockStatement function above
        // sequel to the _this.createIterateInit(...) invocation
        || _this.helpers.includes(stmt.path.original)) {
        return stmt;
      }

      if (
        getMetaPaths().includes(stmt.path.original)
        // Meta statements are not processed within inline blocks
        && getOuterInlineBlock({ bindParents }) === null
      ) {
        return processMetaStatement({ stmt });
      }

      if (isSubExpression) {
        if (!stmt.path.original.match(wordPattern)) {
          // Ensure that method name is a word, because hbs will treat
          // {{./[0].x.[7][5]}} as a valid expression with 5 in the param array
          // while in the real sense the user forgot to place a "." before
          // [5]. Also, {{[.][]}} is valid to hbs where . will be assumed to be a
          // helper, but is obviously not valid in our use-case
          // Note: however that a correct expression would look like
          // {{x [5]}} or {{x []}} or {{[x] [5]}}, in which case 5 is the param and x is a word

          throw new Error(`Invalid helper name: ${stmt.path.original}`);
        }

        const { logicGate, logicGatePruneKey } = stmt;

        stmt.type = 'SubExpression';
        ASTParser.prototype.SubExpression.call(this, stmt);

        if (stmt.processed) {
          const { resolveMustacheHelperName } = TemplatePreprocessor;

          if (logicGate) {
            const original = addLogicGate({
              ...stmt,
              logicGate,
              logicGatePruneKey,
            });

            _this.dataPaths.push(`${original}!!`);

            stmt = createMustacheStatement({
              stmt,
              original: resolveMustacheHelperName,
              hash: {
                type: 'Hash',
                pairs: [{
                  type: 'HashPair',
                  key: original,
                  value: {
                    ...createPathExpression({
                      original: `${toCanonical(original)}!!`,
                    }),
                    processed: true,
                  },
                }],
              },
            });
          } else {
            stmt = createMustacheStatement({
              stmt,
              original: stmt.original,
            });
          }
        } else {
          stmt.type = 'MustacheStatement';
        }

        return stmt;
      }

      this.acceptKey(stmt, 'path');

      let {
        processed, original, type, dataVariable,
      } = stmt.path;

      if (processed) {
        const { resolveMustacheHelperName, literalPrefix, hasDataPathFormat } = TemplatePreprocessor;

        assert((type === 'PathExpression'));

        if (hasDataPathFormat(original) && !original.includes(literalPrefix)) {
          _this.dataPaths.push(`${original}!!`);

          stmt = createMustacheStatement({
            stmt,
            original: resolveMustacheHelperName,
            hash: {
              type: 'Hash',
              pairs: [{
                type: 'HashPair',
                key: original,
                value: {
                  ...createPathExpression({
                    original: `${toCanonical(original)}!!`,
                  }),
                  processed: true,
                },
              }],
            },
          });

          stmt.path.dataVariable = dataVariable;
        } else {
          _this.dataPaths.push(original);

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

      const partialContextList = utils.deepClone(contextList);

      // PartialStatements are not context switching nodes
      // hence, we don't create any new context, but rather update
      // the prior context
      const contextObject = utils.peek(partialContextList);

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

    const PartialNotFoundError = class PartialNotFoundError extends Error {
      constructor({ partialName }) {
        super(`${partialName} not found`);
        this.name = 'TemplateNotFoundError';
        this.partialName = partialName;
      }
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

          block.program = utils.deepClone(block.program);

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
        try {
          block = {
            program: PartialReader.read({
              path: _this.getPartialPath(partialName),
            }),
          };
        } catch (e) {
          throw new PartialNotFoundError({ partialName });
        }
      }

      return {
        block,
        inline,
        partialBindParents: block.decoratorBindParents || bindParents,
      };
    };

    const processPartial = function ({ stmt }) {
      const { block, inline, partialBindParents } = getPartial({
        stmt,
      });

      const partialName = stmt.name.original;

      if (!isCustomContext() && stmt.hash) {
        stmt.hash.pairs.forEach((pair) => {
          if (pair.value.type === 'SubExpression') {
            throw new Error(`Partials in the root context must not contain SubExpression(s) as hash values, line: ${getLine(stmt)}`);
          }
        });
      }

      if (getOuterInlineBlock({ bindParents }) != null) {
        // _this.logger.info(`{{> ${partialName} }} - AOT partial hash resolution phase`);
        // Though, we do not process partials within inline
        // blocks, we need to attempt to process the hashpairs
        this.acceptArray(stmt.hash.pairs);
        return;
      }

      if (stmt.params.length) {
        throw new Error(`Partial contexts not supported, line: ${getLine(stmt)}`);
      }

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
        srcDir: _this.srcDir,
        assetId: _this.assetId,
        logger: _this.logger,

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
        logicGates: _this.logicGates,
        customBlockCtx: isCustomContext(),
        allowRootAccess: allowRootAccess(),

        resolver: _this.resolver,
        parents: _this.parents,
        className: _this.className,
        metadata: _this.metadata,
        globalChildCcomponents: _this.globalChildCcomponents,
      }).process();

      this.mutating = true;

      const parent = utils.peek(bindParents);

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
      const { componentType, loadComponentHelperName } = TemplatePreprocessor;
      const partialName = stmt.name.original;

      // Todo: determine scenarios when a partial is referenced before being
      // declared, this may involve fully scanning the ast prior to processing.
      // This is will help us determine really when the user means to reference
      // a partial and not a component
      // Todo: emit warning about unused inline blocks
      try {
        // First, attempt to process as a partial
        return processPartial.bind(this)({
          stmt,
        });
      } catch (err) {
        if (!(err instanceof PartialNotFoundError)) {
          throw err;
        }
      }

      if (stmt.params.length) {
        throw new Error(`Params not needed for partial declaration, line: ${getLine(stmt)}`);
      }

      const isComponentClass = partialName
        .match(wordPattern) && global.components[partialName];

      validateHash({ stmt, reservedKeys: [invokeOnCompileHashKey, asyncHashKey] });

      this.mutating = true;

      // Todo: will this work properly if partialName is a context param

      return ASTParser.prototype.MustacheStatement.call(this, Object.assign(stmt, {
        type: 'MustacheStatement',
        params: [{
          ...isComponentClass ? createStringLiteral(partialName) : {
            ...createPathExpression({
              original: partialName,
            }),
            immutable: true,
            validTypes: [componentType],
            forRoot: true,
          },
        }],
        path: createPathExpression({
          original: loadComponentHelperName,
        }),
        generated: true,
      }));
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
        type: stmt.type, body: stmt.program.body, decoratorName, parent: utils.peek(bindParents),
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

      bindParents.push({ type: 'PartialWrapper', body: stmt.body, parent: utils.peek(bindParents) });
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
    const parent = utils.peek(bindParents);

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

    // eslint-disable-next-line max-len
    // this.logger.info(`Decorator: ${param.original}${isCustomCtx ? '' : `, requiredParams: [${requiredParams}]`}`);
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

  static visitNodes({
    Visitor = handlebars.Visitor, types, ast, consumer, parentFirst = true,
  }) {
    function ASTParser() {
    }
    ASTParser.prototype = new Visitor();

    for (const type of types) {
      ASTParser.prototype[type] = function (stmt) {
        if (parentFirst) {
          consumer.bind(this)({ stmt });
        }

        Visitor.prototype[type].call(this, stmt);

        if (!parentFirst) {
          consumer.bind(this)({ stmt });
        }

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

  // Todo: as much as possible, we want to maintain the original loc object,
  // scan for uses of this, and then see if we can use the original loc that was
  // there before transformation
  static getDefaultStripOptions() {
    const strip = { open: false, close: false };
    const { getDefaultLoc } = TemplatePreprocessor;

    return {
      openStrip: strip,
      closeStrip: strip,
      loc: getDefaultLoc(),
    };
  }

  static getDefaultLoc() {
    const loc = { line: 0, column: 0 };
    return { start: loc, end: loc };
  }

  static createStringLiteral(original) {
    const { createLiteral } = TemplatePreprocessor;
    return createLiteral({ type: 'StringLiteral', original });
  }

  static createLiteral({ type, original }) {
    return { type, original, value: original };
  }

  static getLine(stmt) {
    const { loc: { start } = {} } = stmt;
    return start ? `${start.line}:${start.column}` : '';
  }

  getPartialPath(partialName) {
    // Todo: validate partialName - an attacker can access the file
    // system with this
    const partialFile = pathLib.join(this.srcDir, `${partialName}.view`);

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

      if (block.callback) {
        block.callback();
      }
    }
  }

  static createContentStatement({ original }) {
    return {
      type: 'ContentStatement',
      original,
      value: original,
    };
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

  lookupDataPath({ fqPath, validTypes = [], create }) {
    const {
      dataPathRoot, pathSeparator, literalPrefix, defaultIndexResolver,
    } = TemplatePreprocessor;
    // Todo: Re-use this regex in hasDataPathFormat(...) above
    const dataPathPrefix = new RegExp(`^${dataPathRoot}${pathSeparator}`);

    let path = fqPath.replace(dataPathPrefix, '');

    if (path.startsWith(literalPrefix)) {
      return path.replace(literalPrefix, '');
    }

    const value = this.component
      // Todo: Why not use getPathValue(...) instead?
      .resolvePath({
        fqPath: path,
        create,
        indexResolver: defaultIndexResolver,
      });

    return this.component.validateType({
      path: path.split('%')[0],
      value,
      validTypes,
    });
  }

  static getHbsExpressionTypes() {
    return [
      'ContentStatement', 'SubExpression', 'PathExpression',
      'StringLiteral', 'NumberLiteral', 'BooleanLiteral',
      'UndefinedLiteral', 'NullLiteral', 'Hash', 'HashPair',
    ];
  }

  static getReservedBlockNames() {
    const { getMetaHelpers } = TemplatePreprocessor;
    return [
      ...getMetaHelpers(),
    ];
  }

  static getMetaHelpers() {
    const {
      storeContextBlockName, loadContextBlockName,
      customEachHelperName, conditionalHelperName,
      startAttrCtxHelperName,
      endAttrCtxHelperName, startTNBCtxHelperName,
      setSyntheticNodeIdHelperName, resolveMustacheHelperName,
    } = TemplatePreprocessor;
    return [
      storeContextBlockName, loadContextBlockName,
      customEachHelperName, conditionalHelperName,
      startAttrCtxHelperName,
      endAttrCtxHelperName, startTNBCtxHelperName,
      setSyntheticNodeIdHelperName, resolveMustacheHelperName,
    ];
  }

  static getConditionalHelpers() {
    return [
      'if', 'unless',
    ];
  }

  static getContextSwitchingHelpers() {
    const { getIterateHelpers } = TemplatePreprocessor;
    return [
      'with', ...getIterateHelpers(),
    ];
  }

  static getIterateHelpers() {
    return ['each'];
  }

  static getHandleBarsBlockHelpers() {
    const { getConditionalHelpers, getContextSwitchingHelpers } = TemplatePreprocessor;
    return [
      ...getConditionalHelpers(),
      ...getContextSwitchingHelpers(),
    ];
  }

  // Todo: disable the use of ['blockHelperMissing', 'helperMissing', 'log', 'lookup']
  static getHandleBarsDefaultHelpers() {
    const { getHandleBarsBlockHelpers } = TemplatePreprocessor;
    return [
      'blockHelperMissing', 'helperMissing', 'log', 'lookup',
      ...getHandleBarsBlockHelpers(),
    ];
  }

  static getDataVariables() {
    const { getHandleBarsDataVariables } = TemplatePreprocessor;
    return [
      ...getHandleBarsDataVariables(),
      '@random',
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

  static clearRequireCache() {
    Object.keys(require.cache).forEach((key) => {
      delete require.cache[key];
    });
  }

  static makeRequire(filePath) {
    return createRequire(filePath);
  }

  static addGlobals() {
    global.console = require('fancy-log');
    global.RootProxy = importFresh('../src/assets/js/proxy');
    global.BaseRenderer = importFresh('../src/assets/js/base-renderer');
    global.RootCtxRenderer = importFresh('../src/assets/js/root-ctx-renderer');
    global.CustomCtxRenderer = importFresh('../src/assets/js/custom-ctx-renderer');
    global.WebRenderer = importFresh('../src/assets/js/web-renderer');
    global.BaseComponent = importFresh('../src/assets/js/base-component');
    global.assert = require('assert');
    global.clientUtils = clientUtils;
  }

  getTestFile() {
    return pathLib.join(this.srcDir, 'index.test.js');
  }

  createResolver({ path, target }) {
    const { literalType } = TemplatePreprocessor;
    const _this = this;

    const literal = target !== Object(target);

    return new Proxy(literal ? {} : target, {

      get(obj, prop) {
        if (prop === Symbol.toPrimitive) {
          return JSON.stringify(target);
        }

        if (Object.getPrototypeOf(obj)[prop]) {
          return obj[prop];
        }

        // resolver[0] is not valid
        assert(path !== '' || Number.isNaN(parseInt(prop, 10)));

        const isIndex = !Number.isNaN(parseInt(prop, 10));

        if (obj.constructor.name === 'Object' && !literal && isIndex) {
          throw new Error(`Object: '${path}' cannot be accessed like an array`);
        }

        if (obj instanceof Array && !isIndex && prop !== 'length') {
          throw new Error(`Array: '${path}' cannot be accessed like an object`);
        }

        const property = `${path}${isIndex ? `[${prop}]` : `${path.length ? '.' : ''}${prop}`}`;

        const value = _this.resolver.resolve({ path: `${property}%${literalType}` });

        const v = _this.createResolver({ path: property, target: value });

        return v;
      },
    });
  }

  // Todo: Stop adding globals every single time
  /**
  * This returns the component instance of the template
  * that is currently being processed
  */
  getComponent({ componentSrc, instantiate = true } = {}) {

    // Todo: During initial loading process, we need to perform
    // some code checks to prevent dangerous code, i.e. access to
    // node apis, since it's for the client side. Note that only
    // index.test.js can contain "require" becuase it needs

    // Todo: methods in the test.js class that override from index.js
    // should have no arguments and is expected to return test data,
    // that has the same type as the actual method.
    // This arg-check needs to be performed and we also need to ensure
    // that all helpers used in the template are defined in the index.js
    // file

    // Todo: components must not have a constructor defined

    // Todo: verify that behaviours() is an array of no-arg methods in index.js

    const { addGlobals, makeRequire, clearRequireCache } = TemplatePreprocessor;

    const filePath = this.getTestFile();
    const data = componentSrc || fs.readFileSync(filePath, 'utf8');

    const { window } = new jsdom.JSDOM(
      '<!DOCTYPE html><div id="container"></div>',
      {
        resources: new NoOpResourceLoader(),
        url: 'http://localhost:8080/',
        // Todo: revisit this
        runScripts: 'dangerously',
      },
    );

    window.Handlebars = handlebars;

    const allProps = [
      ...Object.keys(global),
      'console',
    ];
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

    addGlobals();

    clearRequireCache();

    // eslint-disable-next-line no-unused-vars
    const require = makeRequire(filePath);

    // Load Component Class
    // eslint-disable-next-line no-eval
    const ComponentClass = eval(data);

    // Create component instance
    let component;

    if (instantiate) {
      // eslint-disable-next-line new-cap
      component = new ComponentClass({
        input: this.createResolver({ path: '', target: {} }),
        loadable: false,
      });
      component.resolver = this.resolver;
      component.init();
    }

    // This should be called by the compile-templates gulp transform
    // after server-side rendering
    const releaseGlobal = () => {
      for (const k of polyfilledProps) {
        delete global[k];
      }
      delete global.window;
      delete global.document;
    };

    return {
      component,
      ComponentClass,
      src: data,
      releaseGlobal,
    };
  }
}

module.exports = TemplatePreprocessor;
