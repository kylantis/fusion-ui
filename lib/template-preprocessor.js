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
const acorn = require("acorn");
const astring = require('astring')
const acornWalk = require("acorn-walk")
const jsdom = require('jsdom');
const csso = require('csso');
const UglifyJS = require('uglify-js');
const importFresh = require('import-fresh');
const NoOpResourceLoader = require('jsdom/lib/jsdom/browser/resources/no-op-resource-loader');
const { StreamTokenizer, constructTree } = require('hyntax');
const { HtmlValidate } = require('html-validate');
const lineColumn = require("line-column");
const babel = require('@babel/core');

const utils = require('./utils');
const PartialReader = require('./template-reader');
const ClientHtmlGenerator = require('./client-html-generator');
const PathResolver = require('./path-resolver');
const { processFile } = require('./template-processor');
const clientUtils = require('../src/assets/js/client-utils');
const Transformers = require('./transformers');
const SchemaGenerator = require('./schema-generator');
const CircularDependencyError = require('./circular-dependency-error');

class TemplatePreprocessor {

  static allowRootAccessByDefault = true;

  static rawDataPrefix = 'r$_';

  static syntheticMethodPrefix = 's$_';

  static literalPrefix = 'l$_';

  static rootQualifier = '@_root';

  static dataPathRoot = 'data';

  static logicGatePathRoot = 'logic_gate';

  static pathSeparator = '__';

  static dataPathPrefixRegex = RegExp(`^${this.dataPathRoot}${this.pathSeparator}`);

  static literalPathPrefixRegex = RegExp(`^${this.dataPathRoot}${this.pathSeparator}${utils.escapeRegex(this.literalPrefix)}`);

  static reservedDecoratorNames = ['@partial-block'];

  static syntheticAliasSeparator = '$$';

  static startAttrCtxHelperName = 'startAttributeBindContext';

  static endAttrCtxHelperName = 'endAttributeBindContext';

  static setSyntheticNodeIdHelperName = 'setSyntheticNodeId';

  static getSyntheticNodeIdMethodName = 'getSyntheticNodeId';

  static startTNBCtxHelperName = 'startTextNodeBindContext';

  static customEachHelperName = 'forEach';

  static conditionalHelperName = 'conditional';

  static storeContextBlockName = 'storeContext';

  static loadContextBlockName = 'loadContext';

  static globalsBasePath = 'globals';

  static literalType = PathResolver.literalType;

  static arrayType = PathResolver.arrayType;

  static objectType = PathResolver.objectType;

  static mapType = PathResolver.mapType;

  static componentRefType = PathResolver.componentRefType;

  static reservedComponentClassNames = [
    this.literalType, this.arrayType, this.objectType, this.mapType, this.componentRefType,
  ];

  static defaultIndexResolver = () => 0;

  static componentImportPath = 'component';

  static wordPattern = /^\w+$/g;


  static blockParamHashKey = 'blockParam';

  static stateHashKey = 'state';


  static partialIdHashKey = '__id';

  static partialNameHashKey = '__name';

  static partialDeferHashKey = 'defer';

  static partialRuntimeHashKey = 'runtime';

  static generatedPartialHashKeyPrefix = '$$$_';

  static partialBaseDirHashKey = `${this.generatedPartialHashKeyPrefix}_baseDir`;

  static partialBaseLocHashKey = `${this.generatedPartialHashKeyPrefix}_baseLoc`;


  static runtimeDecoratorHashKey = 'runtime';

  static eagerDecoratorHashKey = 'eager';


  static ctxHashKey = 'ctx';


  static allowRootAccessHashKey = 'allowRootAccess';

  static transformHashKey = 'transform';

  static hookHashKey = 'hook';

  static hookOrderHashKey = 'hookOrder';

  static asyncHashKey = 'async';

  static escapedHashKey = 'escaped';

  // If this is false, we will compile components every time it
  // is referenced via global.components, irrespective of 
  // whether it has already been processed and available in 
  // the dist folder. If this is false, it is guaranteed that 
  // circular dependencies will be detected ahead of time.

  static enableComponentClassCaching = true;

  static addDefaultParamToCustomBlock = false;

  static renderMethodName = 'render';

  static toHtmlMethodName = 'toHtml';

  static getLoaderMethodName = 'getLoader';

  static validateTypeMethodName = 'validateType';

  static captureStateMethodName = 'captureState';

  static renderBlockMethodName = 'renderBlock';

  static loadComponentHelperName = 'loadInlineComponent';

  static ternaryHelperName = 'ternary';

  static logicalHelperName = 'logical';

  static concatenateHelperName = 'concatenate';

  static resolveMustacheInRootHelperName = 'resolveMustacheInRoot';

  static resolveMustacheInCustomHelperName = 'resolveMustacheInCustom';

  static noOpHelperName = 'noOpHelper';

  static fnHelperName = 'fn';

  static variableHelperName = 'var';

  static contentHelperName = 'c';


  static htmlWrapperCssClassname = 'mst-w';


  static PARTICIPANT_TYPE_ALL = 'all';
  static PARTICIPANT_TYPE_CONDITIONAL = 'condition';
  static PARTICIPANT_TYPE_TERNARY = 'ternary';

  static DOM_PARTICIPANT_TYPE = this.PARTICIPANT_TYPE_CONDITIONAL;

  static lenientPathResolution = false;

  static allowOutOfBoundsContextAccess = true;

  static incremetallyWriteComponentJs = true;

  constructor({
    srcDir,
    assetId,
    logger,
    templateSrc,
    ast,
    contextList,
    bindParents,
    allowedPaths,
    blocksData,
    component,
    componentAst,
    componentSrc,
    methodNames,
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
    htmlConfig,
    preprocessors,
  }) {

    // This is used to keep track of preprocessor instances created as a result of the call
    // to processFile(...) in getTransientComponentsGlobal(...). The instances will be used
    //  later to generate models
    this.preprocessors = preprocessors || [];

    this.srcDir = srcDir;
    this.assetId = assetId;
    this.logger = logger;

    this.templateSrc = templateSrc;

    this.ast = ast;

    this.contextList = contextList;
    this.bindParents = bindParents;

    this.allowedPaths = allowedPaths || [];

    this.blocksData = blocksData || {};

    this.customBlockCtx = customBlockCtx;
    this.allowRootAccess = allowRootAccess;

    this.resolver = resolver || new PathResolver({
      preprocessor: this,
    });

    this.isPartial = !!component;
    this.parents = parents;

    this.className = className;

    this.component = component;

    this.componentAst = componentAst;

    this.componentSrc = componentSrc;

    this.metadata = metadata;

    this.methodNames = methodNames;

    this.helpers = helpers || [];

    this.globals = globals || {};

    this.logicGates = logicGates || {};

    this.htmlConfig = htmlConfig || {};
  }

  static checkPreconditions() {
    const { APP_ID } = process.env;

    if (!APP_ID) {
      throw Error(`Please specify your APP_ID`);
    }
  }

  static getReservedAssetIds() {
    // This is used by our model factory to store shared class files, including enums
    return ['shared'];
  }

  static createAst0(templateSrc) {
    return parser.parse(templateSrc);
  }

  createProgram({ locSource, templateSrc }) {
    const { createAst0, registerProgram } = TemplatePreprocessor;

    const program = createAst0(templateSrc);

    registerProgram({ locSource, templateSrc, program });

    return program;
  }

  static registerProgram({ locSource, templateSrc, program }) {
    const {
      setLocSource, getAstRegistry, isProgramInRegistry,
    } = TemplatePreprocessor;

    const astRegistry = getAstRegistry();
    assert(program.type == 'Program');
    assert(!isProgramInRegistry(program) && !program.programId);

    program.programId = utils.generateRandomString();
    program.templateSource = templateSrc;

    astRegistry[program.programId] = program;

    if (locSource) {
      setLocSource(program, locSource)
    }

    return program.programId;
  }

  static setLocSource(program, locSource) {
    const { visitNodes, getAllHandlebarsTypes } = TemplatePreprocessor;

    visitNodes({
      types: getAllHandlebarsTypes(),
      ast: program,
      consumer: ({ stmt }) => {
        const { loc } = stmt;
        if (loc) {
          loc.source = locSource;
        }
      },
    });
  }

  static getAstRegistry() {
    return global.astRegistry || (global.astRegistry = {});
  }

  static isProgramInRegistry(program) {
    const { getAstRegistry } = TemplatePreprocessor;
    return Object.values(getAstRegistry()).includes(program);
  }

  static createLocSource({ remote, base, fileName, decoratorName }) {
    let s = `${remote ? 'remote:' : ''}${base}/${fileName}`;
    if (decoratorName) {
      s += `/decorator:${decoratorName}`;
    }
    return s;
  }

  static getDefaultHelpers() {
    const {
      loadComponentHelperName,
      ternaryHelperName,
      logicalHelperName,
      concatenateHelperName,
      noOpHelperName,
    } = TemplatePreprocessor;
    return [
      loadComponentHelperName,
      ternaryHelperName,
      logicalHelperName,
      concatenateHelperName,
      noOpHelperName,
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

  static getOwnMethod({ component, name, className }) {

    let c = component;

    while ((c = Reflect.getPrototypeOf(c)) && c !== null) {
      if (c.constructor.name == className) {
        if (Reflect.ownKeys(c).includes(name)) {
          return c[name].bind(component);
        }
        break;
      }
    }

    return null;
  }

  // Blocker todo: this implementation is wrong because it does
  // not consider methods that were overriden from BaseComponent, e.t.c
  static getMethodNames({ component }) {
    const { syntheticMethodPrefix, getDefaultHelpers, getMetaHelpers } = TemplatePreprocessor;

    const defaultHelpers = getDefaultHelpers();
    const metaHelpers = getMetaHelpers();

    let methods = new Set();
    let isParentComponent;

    while ((component = Reflect.getPrototypeOf(component))
      // eslint-disable-next-line no-undef
      && component.constructor.name !== BaseComponent.name
    ) {

      if (!isParentComponent) {
        isParentComponent = component.constructor.extends == component.constructor.name;
      }

      let keys = Reflect.ownKeys(component).filter(k => k !== 'constructor');

      keys.forEach((k) => {
        if (defaultHelpers.includes(k) || metaHelpers.includes(k)) {
          throw Error(`Method name: ${k} is reserved`);
        }

        if (k.startsWith(syntheticMethodPrefix)) {
          if (isParentComponent) {
            // This is a synthetic method that exists on the compiled
            // version of the parent component loaded in loadCompiledComponents(...)
            return;
          } else {
            throw Error(`Method name: ${k} not allowed`);
          }
        }

        methods.add(k);
      });
    }
    return [...methods, ...defaultHelpers, ...metaHelpers];
  }

  validateMethodNames(methodNames) {
    if (this.isPartial) {
      return methodNames;
    }
    const { isRootCtxValue, throwError } = TemplatePreprocessor;
    for (const methodName of methodNames) {
      if (isRootCtxValue(methodName)) {
        throwError(`Method name: ${methodName} not allowed`);
      }
    }
    return methodNames;
  }

  static getComponentsSrcPath() {
    return pathLib.join(process.env.PWD, 'src', 'components');
  }

  static getDistPath() {
    return pathLib.join(process.env.PWD, 'dist');
  }

  static getComponentsDistPath() {
    const { getDistPath } = TemplatePreprocessor;
    return pathLib.join(getDistPath(), 'components');
  }

  static getSkipFile(assetId) {
    const { getComponentsDistPath } = TemplatePreprocessor;
    return pathLib.join(
      getComponentsDistPath(), assetId, '.skip'
    )
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
    this.writeHtmlFileToFileSystem();
    this.writeSamplesFileToFileSystem();
    this.writeConfigFileToFileSystem();
    this.writeClassesInfoToFileSystem();
  }

  writeStringifiedAst() {
    const { stringifyHandlebarsNode } = TemplatePreprocessor;

    fs.writeFileSync(
      pathLib.join(this.getDistPath(), 'index.ast'),
      stringifyHandlebarsNode(this.ast),
    );
  }

  static getComponentListPath() {
    const { getComponentsDistPath } = TemplatePreprocessor;

    const distPath = getComponentsDistPath();
    return pathLib.join(distPath, 'list.json');
  }

  static loadJson(filePath) {
    const { throwError } = TemplatePreprocessor;
    let o;
    try {
      o = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      throwError(
        `Error occured while loading JSON file "${filePath}": ${e.message}`
      );
    }
    return o;
  }

  static fetchDistComponentList(verify = true) {
    const { getComponentsDistPath, getComponentListPath, loadJson } = TemplatePreprocessor;

    const distPath = getComponentsDistPath();
    const filePath = getComponentListPath();

    let list = {};

    if (fs.existsSync(filePath)) {
      list = loadJson(filePath);
    }

    let updateList = false;

    Object.entries(list).forEach(([key, value]) => {
      if (verify) {

        // Remove from list, if folder does not exist
        if (!fs.existsSync(pathLib.join(distPath, value))) {
          delete list[key];
          updateList = true;
        }

        // Todo: ensure that all resource are present before giving this a pass
      }
    });

    if (updateList) {
      fs.writeFileSync(filePath, JSON.stringify(list, null, 2))
    }

    return list;
  }


  static getComponentListRelativePath() {
    const { getComponentListPath } = TemplatePreprocessor;
    return pathLib.relative(process.env.PWD, getComponentListPath());
  }

  suggestFixSequelToComponentRename() {
    const { getComponentListRelativePath } = TemplatePreprocessor;
    this.logger.warn(
      `Did you rename the source folder for "${this.className}"? If so, remove "${this.className}" from ${getComponentListRelativePath()}, and recompile "${this.className}"`
    );
  }

  updateComponentList() {
    const { getComponentListPath, fetchDistComponentList } = TemplatePreprocessor;

    const list = fetchDistComponentList(false);
    const assetId = list[this.className];

    if (!assetId) {
      list[this.className] = this.assetId;
      this.metadata.distComponentList[this.className] = this.assetId;
    } else {
      assert((assetId == this.assetId));
    }

    fs.writeFileSync(
      getComponentListPath(),
      JSON.stringify(list, null, 2),
    );
  }

  writeComponentJsToFileSystem() {
    const { getComponentClass } = TemplatePreprocessor;

    const distPath = this.getDistPath();

    const fileName = 'index.js';
    const testFileName = 'index.test.js';

    let testComponentSrc = fs.readFileSync(pathLib.join(this.srcDir, testFileName), 'utf8');

    let { data: componentSrc, ComponentClass } = getComponentClass({ dir: this.srcDir });

    // Merge AST into the component main js
    componentSrc = this.mergeAst(componentSrc, ComponentClass)

    // Write js files
    fs.writeFileSync(pathLib.join(distPath, testFileName), testComponentSrc);
    fs.writeFileSync(pathLib.join(distPath, fileName), componentSrc);

    // Write minified js files (for use in the browser)
    this.writeMinifiedComponentJsFile({ data: testComponentSrc, fileName: testFileName });
    this.writeMinifiedComponentJsFile({ data: componentSrc, fileName: fileName });
  }

  getAssetIdFromClassName(className) {
    return this.metadata.distComponentList[className];
  }

  loadCompiledComponentClasses() {
    const {
      getComponentClass, getComponentsDistPath, getComponentListRelativePath,
    } = TemplatePreprocessor;

    global.components = {};
    global.templates = {};

    Object.entries(this.metadata.distComponentList)
      .forEach(([className, assetId]) => {

        const dir = pathLib.join(getComponentsDistPath(), assetId);

        let testComponentClass;

        try {
          testComponentClass = getComponentClass({
            dir,
            useTestClass: true,
          }).ComponentClass;
        } catch (e) {
          this.throwError(`Error occured while loading component: ${className}. To proceed, remove the entry "${className}" from ${getComponentListRelativePath()}`);
        }

        // When serializing, BaseRenderer.toJSON(...) should use the actual className, not the test class
        testComponentClass.className = className;

        RootProxy.getGlobalSchemasObject()[className] = this.getConfig(className).schema;

        global.components[className] = testComponentClass;

        const metadataFile = pathLib.join(dir, 'metadata.min.js');

        if (fs.existsSync(metadataFile)) {
          const contents = fs.readFileSync(
            metadataFile,
            'utf8',
          );
          eval(contents);
        } else {
          throw Error(`Could not find metadata file: ${metadataFile}`);
        }
      });
  }

  static getAppContextObject() {
    const { loadJson } = TemplatePreprocessor;
    const enumsFile = pathLib.join(process.env.PWD, 'src', 'components', 'enums.json');
    return {
      // Add enums
      enums: fs.existsSync(enumsFile) ? loadJson(enumsFile) : {},
      // Add globals
      userGlobals: {
        rtl: false
      },
      components: {},
      testMode: true,
      logger: console,
    };
  }

  getTransientComponentsGlobal() {
    const {
      enableComponentClassCaching, getComponentsDistPath, getComponentClass, getSkipFile, throwError
    } = TemplatePreprocessor;

    const componentClasses = this.componentClasses || (this.componentClasses = {});

    return new Proxy({}, {
      get: (obj, prop) => {
        if (obj[prop]) {
          return obj[prop];
        }

        if (Object.keys(this.parents).includes(prop)) {
          throwError(new CircularDependencyError(prop, this.className));
        }

        let assetId = this.getAssetIdFromClassName(prop);
        let componentClass;

        const load = () => {

          componentClass = componentClasses[prop];

          if (!componentClass) {

            componentClass = getComponentClass({
              dir: pathLib.join(getComponentsDistPath(), assetId),
              useTestClass: true,
            }).ComponentClass;

            // When serializing, BaseRenderer.toJSON(...) should use the actual className, not the test class
            // Also, this is needed for component type validation in validateType(...)
            componentClass.className = prop;

            componentClasses[prop] = componentClass;
          }
        };

        if (assetId && enableComponentClassCaching) {
          load();
        } else {
          const { dir } = global.classesInfo[prop] || {};
          const {
            fromWatch, srcComponentList, distComponentList, rootAssetId
          } = this.metadata;

          if (dir) {

            this.preprocessors.push(
              processFile({
                dir,
                // We don't want to pass a copy not a reference, so it's not modified
                parents: utils.deepClone(this.parents),
                fromWatch,
                srcComponentList, distComponentList,
                rootAssetId,
                preprocessors: this.preprocessors,
              })
            );

            assetId = this.getAssetIdFromClassName(prop);

            assert(assetId);

            if (!fromWatch) {

              const index0 = srcComponentList.indexOf(rootAssetId);
              const index1 = srcComponentList.indexOf(assetId);

              const skipFile = getSkipFile(assetId);

              assert(index0 >= 0);

              if (index1 > index0 && !fs.existsSync(skipFile)) {
                // As part of the current gulp process, <assetId> will be loaded
                // later, hence we want to do a one-time skip when gulp task is 
                // triggered for that component

                fs.writeFileSync(skipFile, '',);
              }
            }

            // As a result of the call: processFile(...), global.components and global.preprocessor
            // were overwritten, so we need to re-assign them
            global.components = this.getTransientComponentsGlobal();
            global.preprocessor = this;

            load();
          }
        }

        return componentClass;
      },
    });
  }

  writeHtmlFileToFileSystem() {
    fs.writeFileSync(
      `${this.getDistPath()}/client.html`,
      ClientHtmlGenerator.get({
        className: this.className,
      }));
  }

  writeSamplesFileToFileSystem() {
    fs.writeFileSync(
      `${this.getDistPath()}/samples.js`,
      `module.exports=${this.samplesString}`,
    );
  }

  writeClassesInfoToFileSystem() {
    const { getComponentsDistPath } = TemplatePreprocessor;

    const replacer = (name, val) => {
      if (['templateAst', 'templateSrc'].includes(name)) {
        return undefined;
      }
      return val;
    }

    fs.writeFileSync(
      pathLib.join(getComponentsDistPath(), 'classes-info.json'),
      JSON.stringify(global.classesInfo, replacer, 2),
    );
  }

  writeConfigFileToFileSystem() {
    const { getComponentsDistPath } = TemplatePreprocessor;

    const [parent] = this.metadata.parents;

    let scalars = this.resolver.getScalars();

    if (parent) {
      const { scalars: parentScalars } = this.getNonNullConfig(parent);
      scalars = {
        ...scalars,
        ...parentScalars,
      }
    }

    // Write config file
    fs.writeFileSync(
      pathLib.join(getComponentsDistPath(), this.assetId, 'config.json'),
      JSON.stringify({
        scalars,
        schema: this.clientSchema,
        recursive: !!this.metadata.recursive,
        parents: this.metadata.parents,
        isAbstract: this.metadata.isAbstract,
        inlineBlocks: this.metadata.inlineBlocks,
        srcDir: this.srcDir,
      }, null, 2),
    );
  }

  static getSrcConfigFile() {
    const componentsFolder = pathLib.join(
      process.env.PWD, 'src', 'components'
    );

    return pathLib.join(componentsFolder, 'config.js');
  }

  static getSrcConfig() {
    const { getSrcConfigFile } = TemplatePreprocessor;

    const configFile = getSrcConfigFile();
    return fs.existsSync(configFile) ? require(configFile) : null;
  }

  static getAnyScalarComponent() {
    const { throwError, getSrcConfig, getSrcConfigFile } = TemplatePreprocessor;

    const { scalarComponents } = getSrcConfig() || {};

    const scalarComponent = (scalarComponents && scalarComponents.length) ?
      scalarComponents[utils.getRandomInt(0, scalarComponents.length - 1)] :
      null;

    if (!scalarComponent) {
      throwError(
        `No scalar components were defined in ${pathLib.relative(process.env.PWD, getSrcConfigFile())}`
      );
    }

    return scalarComponent;
  }

  getSerializedComponent(className) {
    if (this.resolver.processing) {
      const componentInstances = this.componentInstances || (this.componentInstances = {});

      if (!componentInstances[className]) {
        componentInstances[className] = this.getSerializedComponent0(className);
      }
      return componentInstances[className];
    } else {
      return this.getSerializedComponent0(className);
    }
  }

  getSerializedComponent0(className) {

    const { getComponentsDistPath, getAnyScalarComponent } = TemplatePreprocessor;

    if (className === this.className) {

      // We need to indicate that this component is a rescursive one, i.e. it references
      // itself in it's data model.
      this.metadata.recursive = true;

      // Return null, else we will end up with a circular dependency error
      return null;
    }

    if (className === BaseComponent.name) {
      // Load an arbitrary scalar component, if available
      const anyScalar = getAnyScalarComponent();

      if (anyScalar == null) {
        return null;
      }

      className = anyScalar;

    } else if (this.getNonNullConfig(className).isAbstract) {

      const l = global.classesInfo;

      // Get concrete subclasses 
      const implClasses = l[className].children.filter(n => !l[n].isAbstract);

      if (!implClasses.length) {
        // No concrete implementation(s) were found
        return null;
      }

      const arr = implClasses
        .filter(n => !this.getNonNullConfig(n).recursive);

      if (!arr.length) {
        // <implClasses> does not contain any non-recursive components, return null to avoid a circular dependency error
        return null;
      }

      className = arr[utils.getRandomInt(0, arr.length - 1)];
    }

    // Load component test class
    const testComponentClass = global.components[className];

    // eslint-disable-next-line import/no-dynamic-require
    const samples = require(
      pathLib.join(
        getComponentsDistPath(),
        this.getAssetIdFromClassName(className),
        'samples.js',
      ),
    );

    const sampleIndex = utils.getRandomInt(0, samples.length - 1);

    const sample = samples[sampleIndex];

    // Todo: optimize to avoid creating new instance each time
    // eslint-disable-next-line new-cap
    return new testComponentClass({ input: sample });
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
        throw Error(`Unknown literal value: ${value}`);
    }
  }

  process() {
    const {
      reservedComponentClassNames, getMethodNames, parseScript, getComponentParents, isAbstractComponent,
      generateClassesInfo,
    } = TemplatePreprocessor;

    if (!this.ast) {

      this.cssDependencies = [];
      this.jsDependencies = [];

      generateClassesInfo();

      global.components = this.getTransientComponentsGlobal();

      global.preprocessor = this;

      const {
        ComponentClass, testComponentClass, testComponentClassSrc
      } = this.loadComponentClass();

      this.className = ComponentClass.name;

      const assetId = this.metadata.distComponentList[this.className];

      if (assetId && assetId != this.assetId) {
        this.suggestFixSequelToComponentRename();

        this.throwError(
          `Cannot load ${this.srcDir} because "${this.className}" already exists in a separate folder`
        );
      }

      this.metadata.parents = getComponentParents(ComponentClass);
      this.metadata.isAbstract = isAbstractComponent(ComponentClass);

      this.componentAst = parseScript(
        testComponentClass.toString(),
      );

      this.componentSrc = testComponentClassSrc;

      if (reservedComponentClassNames.includes(this.className)) {
        throw Error(`Class name: ${this.className} is reserved`);
      }

      this.parents[this.className] = this.assetId;

      this.component = this.getComponent({
        ComponentClass: testComponentClass,
      });

      this.methodNames = this.validateMethodNames(
        getMethodNames({
          component: this.component,
        }),
      );

      const program = this.createProgram({
        locSource: this.createOwnLocSource(),
        templateSrc: this.templateSrc,
      });

      this.ast = program;

      this.readHeadAttributes();

      this.bindParents = [{ type: 'root', body: this.ast.body, index: 0 }];
    }

    if (!this.isProgramTrasformed(this.ast)) {
      this.transformProgram(this.ast);
    }

    this.process0({
      contextList: this.contextList || this.getDefaultContextList(),
      bindParents: this.bindParents,
      program: this.ast,
    });
  }

  createOwnLocSource(decoratorName) {
    const { createLocSource } = TemplatePreprocessor;
    return createLocSource({
      base: this.className, fileName: 'index.view', decoratorName,
    });
  }

  static generateClassesInfo() {
    if (global.classesInfo) {
      return;
    }

    const {
      getComponentsSrcPath, parseScript, getMainClassDeclaration, getIsAbstractFromClassDeclaration,
      getParentComponentFromClassDeclaration, throwError,
    } = TemplatePreprocessor;

    const classesInfo = {};

    const componentsFolder = fs.readdirSync(getComponentsSrcPath());

    // Populate <classesInfo> with preliminary metadata

    for (const dirName of componentsFolder) {
      const dir = pathLib.join(getComponentsSrcPath(), dirName);
      if (fs.lstatSync(dir).isFile()) {
        continue;
      }

      const filePath = pathLib.join(dir, 'index.js');

      const componentSrc = fs.readFileSync(
        filePath, 'utf8',
      );

      const ast = parseScript(componentSrc);
      const cd = getMainClassDeclaration(ast);

      const o = classesInfo[cd.id.name];

      if (!o) {
        classesInfo[cd.id.name] = {
          dir,
          classDeclaration: cd,
          isAbstract: getIsAbstractFromClassDeclaration(cd),
          parents: [], children: []
        }
      } else {
        throwError(`[${dirName}/${cd.id.name}] Component class name is already defined in ${o.dir}`);
      }
    }


    // Register direct parents

    Object.entries(classesInfo).forEach(([className, classInfo]) => {
      const { classDeclaration: cd, parents } = classInfo;

      const parent = getParentComponentFromClassDeclaration(cd);

      if (parent) {

        const parentInfo = classesInfo[parent];
        if (!parentInfo) {
          throwError(`[${className}] Unknown parent component "${parent}"`);
        }

        parents.push(parent);
      }

      // Prune class declaration, no longer needed
      delete classInfo.classDeclaration;
    });


    // Register parents

    Object.values(classesInfo).forEach(classInfo => {
      const { parents } = classInfo;
      let [parent] = parents;

      while (parent && (parent = classesInfo[parent].parents[0])) {
        parents.push(parent);
      }
    });


    // Register children
    Object.entries(classesInfo).forEach(([className, { children }]) => {

      Object.entries(classesInfo).forEach(([k, { parents }]) => {
        if (parents.includes(className)) {
          children.push(k);
        }
      });
    });

    global.classesInfo = classesInfo;
  }

  // Todo: Instead of looking for the first class declaration, we need to design a more
  // reliable approach, i.e. check the default exported class in the file (amd and cjs alike)
  static getMainClassDeclaration(ast) {
    return ast.body.filter(({ type }) => type === 'ClassDeclaration')[0];
  }

  static getParentComponentFromClassDeclaration(cd) {
    const { throwError } = TemplatePreprocessor;

    const { superClass: p } = cd;

    if (p.name == 'BaseComponent') {
      return null;
    }

    if (
      p.type != 'MemberExpression' || p.object.type != 'Identifier' ||
      p.object.name != 'components'
    ) {
      throwError(
        `[${cd.id.name}] superClass should be defined like => class ${cd.id.name} extends BaseComponent|components.NAME { ... }`
      )
    }

    return p.property.name;
  }

  static getIsAbstractFromClassDeclaration(cd) {
    const { throwError, getReturnStatementArg: getReturnStatementArg } = TemplatePreprocessor;

    const m = cd.body.body
      .filter(n =>
        n.type == 'MethodDefinition' && n.static &&
        n.key.name == 'isAbstract'
      )[0];

    if (!m) {
      // No static method called isAbstract(...) was defined, so return false
      return false;
    }

    const v = getReturnStatementArg(m);

    if (!v || ![true, false].includes(v.value)) {
      throwError(
        `[${cd.id.name}] isAbstract(...) should have a single statement => return true|false`
      )
    }

    return v.value;
  }

  static getReturnStatementArg(m) {
    const arr = m.value.body.body;
    if (arr.length == 1 && arr[0].type == 'ReturnStatement') {
      return arr[0].argument;
    }
  }

  getDefaultContextList() {
    const { dataPathRoot, rootQualifier, getLiteralType, isLookupAllowed } = TemplatePreprocessor;

    const defaultContext = {};

    defaultContext[rootQualifier] = {

      type: 'PathExpression',
      value: dataPathRoot,

      // This is only used to resolve @root
      // and will be mutated as partials are processed
      declaredValue: dataPathRoot,
      index: 0
    };

    for (const k in this.globals) {
      if ({}.hasOwnProperty.call(this.globals, k)) {
        const value = this.globals[k];
        defaultContext[k] = {
          type: getLiteralType({ value }),
          value,
          index: 0,
          lookup: false,
        };
      }
    }

    defaultContext['@random'] = (() => {
      const { type, original, targetType } = this.getGlobalVariableResolvedPath('random');
      return {
        type, value: original, index: 0, lookup: isLookupAllowed(targetType), synthetic: false,
      }
    })();

    return [
      defaultContext,
    ];
  }

  static isAbstractComponent(ComponentClass) {
    return Reflect.ownKeys(ComponentClass).includes('isAbstract') ?
      ComponentClass.isAbstract() : false
  }

  loadComponentClass() {
    const { getComponentClass } = TemplatePreprocessor;

    const { ComponentClass } = getComponentClass({
      dir: this.srcDir,
      disableRequire: true,
    });

    const {
      ComponentClass: testComponentClass, data: testComponentClassSrc
    } = getComponentClass({
      dir: this.srcDir,
      useTestClass: true,
    });

    // This is used by getMethodNames(...) to indicate that methods
    // defined in this class as owned by the subclass
    testComponentClass.extends = testComponentClass.name;

    return {
      ComponentClass, testComponentClass, testComponentClassSrc
    };
  }

  static getComponentParents(clazz) {
    const { getSuperClasses } = TemplatePreprocessor;
    const arr = [];

    const classes = getSuperClasses(clazz);

    assert(
      classes.map(c => c.name).includes(BaseComponent.name)
    );

    for (const clazz of classes) {
      if (clazz.name == BaseComponent.name) {
        break;
      }
      if (clazz.className) {
        arr.push(clazz.className);
      }
    }

    return [...new Set(arr)];
  }

  static getSuperClasses(clazz) {
    const arr = [];
    let parent = Reflect.getPrototypeOf(clazz)

    while (parent != null) {
      arr.push(parent);
      parent = Reflect.getPrototypeOf(parent)
    }

    return arr;
  }

  finalize() {

    // add assetId to ast
    this.emitAssetId();

    // add helpers array to ast
    this.emitHelpers();

    // add logic gates array to ast
    this.emitLogicGates();

    // add compoonent data paths to ast
    this.emitAllowedPaths();

    // add css/js dependencies to ast
    this.emitDependencies();

    // create schema
    this.createSchema();

    // generate schema and sample data for the client
    this.generateSchemaAndSamples();

    // emit necessary methods to the ast
    this.emitMetadata();

    // refresh component instance
    this.serializeAst();

    // write assets
    this.writeAssetsToFileSystem();
  }

  getModelFactory() {
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

    return require(`./model-factories/${language}/factory`);
  }

  getNonNullConfig(className) {
    return this.getConfig(className, true);
  }

  getConfig(className, ensureNonNull = false) {
    const { getComponentsDistPath, loadJson } = TemplatePreprocessor;

    const componentConfigs = this.componentConfigs || (this.componentConfigs = []);

    let config = componentConfigs[className];

    if (config) {
      return config;
    }

    this.getComponentClass(className);

    const assetId = this.metadata.distComponentList[className];

    if (!assetId) {

      if (ensureNonNull) {
        this.throwError(`No configuration could be loaded for component "${className}"`);
      }

      return null;
    }

    config = loadJson(
      pathLib.join(
        getComponentsDistPath(), assetId, 'config.json'
      )
    );

    componentConfigs[className] = config;
    return config;
  }

  generateSchemaAndSamples() {

    const { getComponentsDistPath } = TemplatePreprocessor;

    const samples = this.resolver.getSamples();

    const schema = utils.deepClone(this.schema);


    // Remove the "description" attribute from definition properties - because it is used internally to
    // attach metedata to properties for the purpose of model generation, and does not serve any purpose
    // as far as validation goes

    Object.values(schema.definitions)
      .forEach(def => {
        Object.values(def.properties)
          .forEach(p => {
            delete p.description;
          });
      })

    const { parents: [parent] } = this.metadata;

    if (parent) {

      const dir = pathLib.join(getComponentsDistPath(), this.getAssetIdFromClassName(parent));

      const { recursive, schema: parentSchema } = this.getConfig(parent);

      if (recursive) {

        // Recursive components cannot be extended, because their schema cannot be merged with 
        // that of another component. During merging, we cherrypick from the parent's schema - 
        // the root properties, and also copy non-root schema definitions to the child's schema. 
        // This will not work for recursive components because the root schema definition is an 
        // intrinsic part of their data model, and is referenced by other definitions in the schema

        // Todo: This needs more investigation, I think recursive components should be extendable

        throw Error(`Recursive component ${parent} cannot be extended`);
      }

      // Ensure unique keys in component data
      parentSchema.definitions[parent].required
        .forEach(k => {
          if (schema.definitions[this.className].required.includes(k)) {
            throw Error(`Duplicate field '${k}' found when comparing schema from parent`);
          }
        })

      Object.entries(parentSchema.definitions)
        .forEach(([k, v]) => {

          if (k === parent) {
            const rootDef = schema.definitions[this.className];

            Object.entries(v.properties).forEach(([k, v]) => {
              rootDef.required.push(k);
              rootDef.properties[k] = v;
            });

          } else {

            if (v.isComponent) {
              if (k === this.className) {
                throw Error(
                  `${this.className} cannot extend' ${parent}' because ${parent} or one of it's parents imports ${this.className}`
                );
              }
            } else if (schema.definitions[k] && !v.isEnumRef) {
              throw Error(`Duplicate class '${k}' found when comparing schema data from parent`);
            }

            schema.definitions[k] = v;
          }
        });

      const parentSamples = require(pathLib.join(dir, 'samples.js'));

      for (let i = 0; i < samples.length; i++) {
        const sample = samples[i];
        let parentSample = parentSamples[i];

        if (!parentSample) {
          parentSample = parentSamples[utils.getRandomInt(0, parentSamples.length - 1)];
        }

        Object.entries(parentSample).forEach(([k, v]) => {
          sample[k] = v;
        });
      }
    }

    this.clientSchema = schema;
    this.samplesString = clientUtils.stringifyComponentData(samples);
  }

  createSchema() {
    const { data, config } = this.resolver.finalize();
    // Create JSON schema
    const { schema, componentTypes, enumTypes } = SchemaGenerator.createSchema({
      data,
      config,
      preprocessor: this
    });

    this.schema = schema;
    this.componentTypes = componentTypes;
    this.enumTypes = enumTypes;
  }

  async createModels() {
    const { schema, componentTypes, enumTypes } = this;

    // Write server-side models
    await this.getModelFactory().createModels({
      preprocessor: this,
      schema: utils.deepClone(schema),
      componentTypes,
      enumTypes,
    });
  }

  static getComponentClass({
    reference, disableRequire, requirePath, data, dir, clearCache = true, useTestClass = false,
  } = {}) {
    const {
      makeRequire, clearRequireCache, evalScript, getSuperClasses, throwError
    } = TemplatePreprocessor;

    const filePath = dir ? pathLib.join(dir, `index${useTestClass ? '.test' : ''}.js`) : null;

    const data0 = filePath ? fs.readFileSync(
      filePath,
      'utf8',
    ) : data;

    if (!reference) {
      reference = filePath;
    }

    assert(reference);

    if (!data0) {
      throwError(`[${reference}] No component data was provided`);
    }

    const requirePath0 = filePath ? filePath : requirePath;
    let require;

    if (requirePath0 && !disableRequire) {
      if (clearCache) {
        clearRequireCache();
      }
      require = makeRequire(requirePath0);
    }

    const ComponentClass = evalScript({
      script: data0,
      requireFn: require,
      reference: reference,
    });

    if (typeof ComponentClass != 'function') {
      throwError(`[${reference}] Could not load a class`);
    }

    const superClasses = getSuperClasses(ComponentClass).map(c => c.name);

    if (!superClasses.includes(BaseComponent.name)) {
      throwError(
        `[${reference}] Component: ${ComponentClass.name} must extend ${BaseComponent.name}`
      );
    }

    return {
      data: data0,
      ComponentClass,
    };
  }

  static parseScript(scriptString) {
    return acorn.parse(scriptString, { ecmaVersion: "latest" });
  }

  static toAstString(ast) {
    return astring.generate(ast);
  }

  mergeAst(componentSrc, ComponentClass) {
    const { isRootCtxValue, parseScript, toAstString } = TemplatePreprocessor;

    const classString = ComponentClass.toString();
    const ast = parseScript(classString);

    for (const definition of this.componentAst.body[0].body.body) {
      if (isRootCtxValue(definition.key.name)) {
        ast.body[0].body.body.push(definition);
      }
    }

    componentSrc = utils.update(
      componentSrc,
      classString,
      `${toAstString(ast)}`,
    );

    return componentSrc;
  }

  readHeadAttributes() {
    const attributes = ['style', 'script'];

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

    this.jsDependencies.push(`/components/${this.assetId}/metadata.min.js`);
  }

  // Todo: new URL(...) will fail for relative URLs
  // Todo: Inform the user that any js dependency inserted here should be CJS-based
  addDependencyAsset({ stmt, type }) {
    const { getHashValue } = TemplatePreprocessor;

    const urlValue = getHashValue({ stmt, key: 'url' });
    const namespaceValue = getHashValue({ stmt, key: 'namespace' });

    assert(urlValue.type === 'PathExpression' || urlValue.type === 'StringLiteral');

    if (namespaceValue) {
      assert(namespaceValue.type === 'PathExpression' || namespaceValue.type === 'StringLiteral');
    }

    let { original: url } = urlValue;
    let { original: namespace } = namespaceValue || {};

    const provisionalHost = 'http://localhost:8080';
    let withProvisionalHost;

    if (url.startsWith('/')) {
      url = `${provisionalHost}${url}`;
      withProvisionalHost = true;
    }

    // Validate URL
    let assetUrl = new URL(url).toString();

    if (withProvisionalHost) {
      assetUrl = assetUrl.replace(provisionalHost, '');
    }

    this[`${type}Dependencies`].push(
      (namespace && type == 'js') ? {
        url: assetUrl,
        namespace,
      } : assetUrl
    );
  }

  // Todo: Do we need a version of this version for component css file, i.e.
  // csso.minify(data, { restructure: false }). If not remove csso dependency

  writeMinifiedComponentJsFile({ data, fileName }) {

    const distPath = this.getDistPath();
    const minifiedFileName = fileName.replace('.js', '.min.js');

    const { error, code, map } = UglifyJS.minify(
      {
        [fileName]: data,
      },
      {
        sourceMap: {
          filename: minifiedFileName,
          url: `${minifiedFileName}.map`,
        },
        compress: false,
        mangle: true,
      });
    if (error) {
      throw Error(error);
    }


    // Integrate Babel here


    fs.writeFileSync(pathLib.join(distPath, `${minifiedFileName}.map`), map);
    fs.writeFileSync(
      pathLib.join(distPath, minifiedFileName),
      `${code}\n//# sourceURL=/components/${this.assetId}/${minifiedFileName}`
    );
  }

  addJsDependency({ stmt }) {
    this.addDependencyAsset({ stmt, type: 'js' });
  }

  addCssDependency({ stmt }) {
    this.addDependencyAsset({ stmt, type: 'css' });
  }

  serializeAst() {
    const {
      incremetallyWriteComponentJs, getTransientFields, getComponentClass, toAstString
    } = TemplatePreprocessor;
    const fields = {};

    if (this.component) {

      // Snapshot non-transient fields, so we don't lose component data
      const propertyNames = Object.getOwnPropertyNames(this.component)
        .filter(prop => !getTransientFields().includes(prop));
      for (const k of propertyNames) {
        fields[k] = this.component[k];
      }
    }

    const componentSrc = utils.update(
      this.componentSrc,
      this.component.constructor.toString(),
      toAstString(this.componentAst),
    );

    const filePath = pathLib.join(this.srcDir, 'index.test.js');

    const { ComponentClass } = getComponentClass({
      requirePath: filePath,
      reference: filePath,
      data: componentSrc,
    });

    if (incremetallyWriteComponentJs) {
      fs.writeFileSync(
        pathLib.join(this.getDistPath(), 'index.js'), componentSrc,
      )
    }

    this.componentSrc = componentSrc;
    this.component = this.getComponent({
      ComponentClass,
    });

    // Restore non-transient fields
    for (const k in fields) {
      if ({}.hasOwnProperty.call(fields, k)) {
        this.component[k] = fields[k];
      }
    }
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
    this.emitMethodReturningArray({ name: 'helpers', canMergeWithParent: true });
  }

  emitLogicGates() {
    const { getValue } = TemplatePreprocessor;
    this.wrapExpressionAsMethod({
      name: 'logicGates',
      returnExpression: getValue(this.logicGates),
      canMergeWithParent: true,
    });
  }

  emitAllowedPaths() {
    this.emitMethodReturningArray({ name: 'allowedPaths', canMergeWithParent: true });
  }

  emitDependencies() {
    this.emitMethodReturningArray({ name: 'cssDependencies', canMergeWithParent: true });
    this.emitMethodReturningArray({ name: 'jsDependencies', canMergeWithParent: true });
  }

  emitMetadata() {
    const { getScalarValue, getArrayValue } = TemplatePreprocessor;

    this.wrapExpressionAsMethod({
      name: 'globalHelpers',
      returnExpression: getArrayValue(this.metadata.globalHelpers || []),
      canMergeWithParent: true,
    });

    this.wrapExpressionAsMethod({
      name: 'enableDataBinding',
      returnExpression: getScalarValue(!!this.metadata.enableDataBinding),
      canMergeWithParent: true,
    });

    this.wrapExpressionAsMethod({
      name: 'getComponentName',
      returnExpression: getScalarValue(this.className),
    });
  }

  emitMethodReturningArray({ name, value, canMergeWithParent }) {
    const { getArrayValue } = TemplatePreprocessor;

    if (!value) {
      value = this[name];
    }
    assert(value.constructor.name === 'Array');
    this.wrapExpressionAsMethod({
      name,
      returnExpression: getArrayValue([
        ...value,
      ]),
      canMergeWithParent,
    });
  }

  static validatePathExpression(stmt) {
    const {
      pathSeparator, wordPattern, isRootCtxValue, getLine, throwError, getReservedProperties,
      getDataVariables,
    } = TemplatePreprocessor;

    const indexPattern = /^\[[0-9]+\]$/g;
    const ternaryPattern = /^:|\?$/g;

    const allowedPatterns = [
      wordPattern, indexPattern, ternaryPattern,
    ];

    let { original } = stmt;

    if (original.includes(pathSeparator) || isRootCtxValue(original)) {
      throwError(`Invalid PathExpression: ${original}`, stmt);
    }

    original = original.replace(/^@?(\.?\.\/)+/, '').replace(/\.$/, '');

    if (original == '') {
      return;
    }

    const parts = original.split('.');

    parts.forEach((p, i) => {

      if (getDataVariables().includes(p)) {
        return;
      }

      let b = false;

      allowedPatterns.forEach(pattern => {
        if (!b && p.match(pattern)) {
          b = true;
        }
      });

      if (!b) {
        throwError(`Invalid PathExpression "${original}"`, stmt);
      }

      if (i == 0 && getReservedProperties().includes(p)) {
        throwError(
          `"${p}" is a reserved property and connot be used in templates`,
          stmt
        );
      }
    });
  }

  static getReservedProperties() {
    const { globalsBasePath, dataPathRoot } = TemplatePreprocessor;
    return [
      // Todo: add a comment on why this is reserved
      'helpers',
      dataPathRoot,
      globalsBasePath
    ]
  }

  static getPrefix(value) {
    return value.split('.')[0];
  }

  static getSuffix(value) {

    const arr = value.split('.');
    const first = arr[0];
    const suffix = arr.slice(1);

    const segments = global.clientUtils.getSegments({
      original: first,
    });

    segments.splice(0, 1);

    const indexes = segments.join('');

    if (indexes.length) {
      suffix.unshift(indexes);
    }

    return suffix.join('.');
  }

  static hasObjectPrefix({ stmt, value, key, rangeAllowed = true }) {
    const { throwError } = TemplatePreprocessor

    const arr = value.split('.');
    const arr2 = global.clientUtils.getSegments({ original: arr[0] });
    const prefix = arr2[0];

    const match = prefix === key;

    if (!match) {
      return false;
    }

    const isRange = arr.length > 1 || arr2.length > 1;

    if (isRange && !rangeAllowed) {
      throwError(
        `Property "${value}" is not allowed because "${key}" seems to be a literal`, stmt
      );
    }

    return true;
  }

  static appendSuffix(first, suffix, separator = '.') {
    return `${first}${suffix && !suffix.startsWith('[') ? separator : ''}${suffix}`;
  }

  static getPathInfo({ original, contextList, stmt }) {
    const {
      allowOutOfBoundsContextAccess, getDataVariables, getScopeQualifier, hasObjectPrefix,
      getLine, throwError, getPrefix,
    } = TemplatePreprocessor;

    const prev = original;

    const throwInvalidPath = () => throwError(`Invalid path "${prev}"`, stmt);

    const throwOutOfBoundCtx = () => {
      if (!allowOutOfBoundsContextAccess) {
        throwError(
          `Cannot access context for path "${prev}" because it is out of bounds`,
          stmt
        )
      }
    };

    if (original.match(/\.$/)) {
      original = original.replace(/\.$/, './');
    }

    let index = contextList.length - 1;

    assert(index >= 0);

    let withOffset = false;

    const arr = original.split(/(\.?\.\/){1}/);

    const isDataVariable = original.startsWith('@');

    if (arr.length > 1) {
      withOffset = true;

      let i = isDataVariable ? 1 : 0;

      // eslint-disable-next-line no-labels
      whileLoop:
      while (i < arr.length) {
        const v = arr[i];

        if (v === '') {
          // If we encounter empty string, just continue. This is because for every valid match
          // an empty string preceeds and succeeds it.

          // eslint-disable-next-line no-plusplus
          i++;
          continue;
        }

        switch (v) {
          case '../':
            if (index == 0) {
              throwOutOfBoundCtx();
            } else {
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

    const onRoot = index == 0;

    if (isDataVariable) {

      const dataVariableName = getPrefix(original);

      switch (true) {
        case dataVariableName === '@root':
          if (withOffset) {
            // wrong: @../root, correct: @root
            throwInvalidPath();
          }

          // Note: if the user accesses @root like an array, i.e. @root.[0], that's perfectly
          // fine because remember within partials, @root does not refer to the contextObject
          // at index 0, but rather it refers the context where the partial was loaded, which
          // could very well be an array
          break;
        case !getDataVariables().includes(dataVariableName):
          // Unknown data variable
          throwError(`Unknown data variable: ${dataVariableName}`, stmt);
          break;
        case index == 0 && dataVariableName != '@random':
          // At index 0, only @root and @random is allowed
          // console.info(stmt);

          throwError(
            `Data variable "${dataVariableName}" not allowed at context 0`,
            stmt
          );
          break;
      }

    } else {

      let forceUseOfScopeQualifier;

      if (hasObjectPrefix({ stmt, value: original, key: 'this' })) {

        if (withOffset) {
          // wrong: ../../this, correct: this
          throwInvalidPath();
        }

        original = original.replace(/^this\.?/g, '');
        forceUseOfScopeQualifier = true;
      }

      const startsWithIndex = original.match(/^[0-9]+/g);

      if (onRoot) {

        if (startsWithIndex) {
          throwInvalidPath();
        }

      } else if (withOffset || !original.length || startsWithIndex || forceUseOfScopeQualifier) {

        // Normalize path by prefixing the nearest scope qualifier

        const contextConsumer = startsWithIndex ?
          ({ targetType }) => {

            // If targetType is undefined, it could mean that the context represents either: a deffered
            // block, custom block or a context-switching block inside a custom block. Hence, we are not
            // able to validate <targetType>.

            if (targetType && targetType != 'Array') {
              throwError(`Only an array-based scope can be accessed with an index`, stmt);
            }
          } :
          null;

        const scopeQualifier = getScopeQualifier({ contextList, index, consumer: contextConsumer });

        // As stipulated in getBlockOptions(...), scope qualifiers are required for context-switching 
        // blocks, and for good reason. So, we know that every context (including custom contexts) 
        // has a scope
        assert(scopeQualifier)

        if (withOffset) {
          // For correctness, we need to ensure that contexts with a higher index do not have a key 
          // with the same name as the scopeQualifier, else such a context will be erroneously selected
          // during path resolution

          for (let i = index + 1; i <= contextList.length - 1; i++) {
            const ctx = contextList[i];

            if (Object.keys(ctx).includes(scopeQualifier)) {
              const lineX = getLine(ctx[scopeQualifier]);
              const lineY = getLine(contextList[index][scopeQualifier]);

              throw Error(
                `Cannot reference context at (${lineY}) because it is shadowed by context at (${lineX})`
              );
            }
          }
        }

        original = `${scopeQualifier}${original.length ? `.${original}` : ''}`;

        index = contextList.length - 1;
      }
    }

    return {
      path: original,
      index,
      onRoot,
    };
  }

  static isResolvableInScope(pathInfo) {
    const { path } = pathInfo;
    return path.length && path != '@root';
  }

  resolveGlobalVariable({ pathInfo, original, validType, stmt }) {
    const { getLine } = TemplatePreprocessor;

    let { path, index } = pathInfo;

    let resolvedPath;

    switch (true) {
      case path.startsWith('@root.'):
        path = path.replace(/^@root\./g, '');
        assert(!!path.length);
      case index === 0:
        resolvedPath = this.getGlobalVariableResolvedPath(path);
        break;
    }

    if (resolvedPath) {

      this.component.validateType({
        path: original,
        value: resolvedPath.targetValue,
        validType,
        line: stmt ? getLine(stmt) : null,
      });
    }

    return resolvedPath;
  }

  getGlobalVariableResolvedPath(path) {
    const {
      dataPathRoot, pathSeparator, globalsBasePath, wordPattern, getTargetType, throwError,
    } = TemplatePreprocessor;

    const first = path.split('.')[0];

    if (!first || !first.match(wordPattern)) {
      return null;
    }

    const type = this.component.getGlobalVariableTypes()[first];

    if (!type) {
      return null;
    }

    const targetValue = this.getSampleValueForType(type);

    if (!targetValue) {
      throwError(`Unknown type "${type}" specified for global variable "${first}"`);
    }

    return {
      type: 'PathExpression',
      original: [
        dataPathRoot,
        globalsBasePath,
        ...this.component.processLiteralSegment({
          original: path,
        }).split('.')
      ].join(pathSeparator),
      targetValue,
      targetType: getTargetType(targetValue),
    };
  }

  static getSampleValueForLiteralType(type) {
    switch (type) {
      case 'BooleanLiteral':
        return true;
      case 'NumberLiteral':
        return 1234;
      case 'StringLiteral':
        return 'sample';
      case 'NullLiteral':
        return null;
      case 'UndefinedLiteral':
        return undefined;
    }
  }

  getSampleValueForType(type) {
    const {
      objectType, arrayType, literalType, componentRefType, mapType,
    } = TemplatePreprocessor;

    const anyString = utils.generateRandomString(1);

    switch (type) {
      case objectType:
        return { [anyString]: anyString };
      case arrayType:
        return [anyString];
      case literalType:
        return anyString;
      case mapType:
        const map = new Map();
        map.set(anyString, anyString);
        return map;
      case componentRefType:
        return this.getSerializedComponent(BaseComponent.name);
    }
  }

  resolveSyntheticContext({ ctx, suffix, syntheticAlias, stmt }) {
    assert(ctx.synthetic && ctx.canonicalSource);

    let original, canonicalSource;

    if (
      suffix ||
      // even though there's no suffix, setSyntheticMethod(...) will need to be added
      // to the return expression
      syntheticAlias
    ) {

      original = this.createRootProxyIndirection({
        stmt,
        canonicalSource: ctx.canonicalSource,
        path: ctx.value,
        suffix,
        syntheticAlias,
      });

      if (suffix) {
        canonicalSource = `${ctx.canonicalSource}.${suffix}`;
      }

      if (syntheticAlias) {
        canonicalSource += '[i]';
      }

    } else {
      original = ctx.value;
      canonicalSource = ctx.canonicalSource;
    }

    return {
      original, canonicalSource,
    }
  }

  static throwCannotAccessRestrictedPath(targetPath, stmt) {
    const { throwError } = TemplatePreprocessor;
    assert(stmt);

    throwError(
      `"${stmt.original}" cannot resolve to "${targetPath}", access not permitted`,
      stmt,
    )
  }

  static throwCannotAccessIterateContextInAsync(targetPath, original, stmt) {
    const { throwError } = TemplatePreprocessor;

    throwError(
      `"${original}" cannot resolve to "${targetPath}" from inside an async block`,
      stmt,
    )
  }

  resolvePathFromContext({
    contextList, bindParents, pathInfo, declaredOriginal, original, validType, stmt, syntheticAlias, nameQualifier, create,
  }) {
    const {
      rootQualifier, pathSeparator, dataPathPrefixRegex, dataPathRoot, syntheticMethodPrefix, literalPathPrefixRegex,
      objectType, appendSuffix, hasObjectPrefix, defaultIndexResolver, getTargetType, getLine,
      getSuffix, isResolvableInScope, throwCannotAccessIterateContextInAsync, getSampleValueForLiteralType,
      getOuterInlineBlock,
    } = TemplatePreprocessor;

    if (!declaredOriginal) {
      declaredOriginal = original;
    }

    const { index: contextIndex } = pathInfo;

    let canonicalSource;

    let targetType;
    let targetValue;
    let type;
    let value;

    let synthetic = false;

    const asyncContext = stmt && stmt.async;

    const lookupScopes = isResolvableInScope(pathInfo);

    if (lookupScopes) {
      loop:
      for (const contextObject of [...contextList].reverse()) {
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
              stmt,
              value: original,
              key: k,
              rangeAllowed: v.lookup !== undefined ? v.lookup : true,
            })
          ) {

            if (!contextObject[rootQualifier]) {
              // This is likely a scope/index qualifier for a deferred block
              return { terminate: true };
            }

            if (v.variable) {
              assert(v.contextId);

              if (stmt) {
                stmt.variable = true;
                stmt.contextId = v.contextId;
              }

              return { terminate: true };
            }

            if (asyncContext && contextObject[rootQualifier].inIterateContext) {
              throwCannotAccessIterateContextInAsync(v.value, declaredOriginal, stmt);
            }

            // eslint-disable-next-line prefer-destructuring
            type = v.type;

            if (type.endsWith('Literal')) {
              assert(k === original && v.lookup === false);

              original = v.value;
              value = getSampleValueForLiteralType(type);

              canonicalSource = `'${type == 'StringLiteral' ? `"${original}"` : original}'`;

            } else if (v.synthetic) {

              const r = this.resolveSyntheticContext({
                ctx: v, suffix: getSuffix(original), syntheticAlias, stmt
              });

              original = r.original;
              canonicalSource = r.canonicalSource;

              synthetic = true;

            } else {

              original = appendSuffix(
                v.value,
                getSuffix(original).split('.').join(pathSeparator),
                pathSeparator
              );

              canonicalSource = declaredOriginal;
            }

            break loop;
          }
        }
      }
    }

    if (!type) {
      const contextObject = contextList[contextIndex];
      const hasRootPrefix = hasObjectPrefix({ stmt, value: original, key: '@root' })

      const inlineBlock = getOuterInlineBlock({ bindParents });

      if (
        // This is a deferred block, terminate
        !contextObject[rootQualifier] ||
        // @root paths are not resolved in inline blocks, terminate
        (hasRootPrefix && inlineBlock)
      ) {
        return { terminate: true };
      }

      let rootValue = contextObject[rootQualifier].value;

      if (asyncContext && contextObject[rootQualifier].inIterateContext) {
        throwCannotAccessIterateContextInAsync(rootValue, declaredOriginal, stmt);
      }

      if (hasRootPrefix) {
        rootValue = contextList[0][rootQualifier].declaredValue;
        original = original.replace(/^@root\.?/g, '');
      }

      if (original == '') {
        value = this.getSampleValueForType(objectType);
      }

      if (contextObject[rootQualifier].synthetic) {

        const r = this.resolveSyntheticContext({
          ctx: contextObject[rootQualifier],
          suffix: original,
          syntheticAlias,
          stmt,
        });

        original = r.original;
        canonicalSource = r.canonicalSource;

        synthetic = true;

      } else {

        original = appendSuffix(
          rootValue,
          original.split('.').join(pathSeparator),
          pathSeparator
        );

        canonicalSource = declaredOriginal;

        if (original === dataPathRoot) {
          original += pathSeparator;
        }
      }

      type = 'PathExpression';

      if (stmt) {
        stmt.isResolvedPath = true;
      }
    }

    // Perform type validation
    const line = stmt ? getLine(stmt) : null;

    switch (true) {
      case synthetic:
        assert(original.startsWith(syntheticMethodPrefix));

        value = this.getSyntheticMethodValue({
          stmt,
          source: canonicalSource,
          method: original,
          validType,
          line,
        });

        break;

      case original == `${dataPathRoot}${pathSeparator}` || type.endsWith('Literal'):
        assert(value);

        this.component.validateType({
          path: canonicalSource,
          value, validType,
          line,
        })

        break;

      default:

        assert(original.match(dataPathPrefixRegex));

        // We want to validate if <fqPath> is not added to the data model by our resolver
        let validateType = !create;

        if (original.match(literalPathPrefixRegex)) {

          value = original.replace(literalPathPrefixRegex, '');
          validateType = true;

        } else {
          const typeSuffix = `%${validType}${nameQualifier ? `/${nameQualifier}` : ''}`;
          const fqPath = `${original.replace(dataPathPrefixRegex, '')}${typeSuffix}`;

          value = this.component
            .resolvePath({
              fqPath,
              create,
              indexResolver: defaultIndexResolver,
            })
        }

        if (validateType) {

          this.component.validateType({
            path: canonicalSource,
            value,
            validType,
            line,
          })
        }

        break;
    }

    if (stmt) {
      stmt.canonicalSource = canonicalSource;

      delete stmt.variable;
      delete stmt.contextId;
    }

    targetType = getTargetType(value);
    targetValue = value;

    return {
      type,
      original,
      targetType,
      targetValue,
      synthetic,
      canonicalSource,
    };
  }

  static getTargetType(value) {
    return value != null ? value.constructor.className || value.constructor.name : null;
  }

  /**
   * This is usually called when we want to add a path (that is already constructed) to the data model.
   * This does not return any result, but instead registers a targetType on stmt to indicate the type
   * that was resolved
   */
  lookupRootPath({ stmt, original }) {
    const {
      dataPathRoot, pathSeparator, defaultIndexResolver, getLine, getTargetType,
    } = TemplatePreprocessor;

    if (stmt.targetType) {
      // <stmt> was already resolved
      return;
    }

    const path = this.component.getExecPath0({
      fqPath: original
        .replace(`${dataPathRoot}${pathSeparator}`, ''),
      indexResolver: defaultIndexResolver,
      allowSynthetic: false,
      addBasePath: false,
    });

    const value = this.resolver.resolve({ path, create: !stmt.immutable });

    this.component.validateType({
      path: original.split(pathSeparator).join('.'),
      value,
      validType: stmt.validType,
      line: getLine(stmt),
    });

    stmt.targetType = getTargetType(value);
  }

  static getScopeQualifier({ contextList, index, consumer }) {
    const contextObject = index ? contextList[index] : utils.peek(contextList);
    const keys = Object.keys(contextObject);
    for (const k of keys) {
      if (contextObject[k].scope) {
        if (consumer) {
          consumer(contextObject[k]);
        }
        return k;
      }
    }
    return null;
  }

  // Todo: Use this method in resolvePathFromContext(...)
  static toValidTypeString(validType, nameQualifier) {
    return `${validType}/${nameQualifier}`;
  }

  resolvePath({
    bindParents, stmt, contextList, value, validType, create = true, syntheticAlias, nameQualifier,
  }) {
    const { literalType, getPathInfo } = TemplatePreprocessor;

    if (!validType) {
      validType = (stmt ? stmt.validType : null) || literalType;
    }

    assert(!stmt || stmt.type == 'PathExpression');

    let { type, original } = value;

    assert(type === 'PathExpression');

    if (stmt && stmt.decoratorParameter) {
      return {
        terminate: true,
      };
    }

    const pathInfo = getPathInfo({ original, contextList, stmt });

    const globalVariable = this.resolveGlobalVariable({
      pathInfo, original,
      validType: (validType != literalType) ? validType : null,
      stmt
    });

    if (globalVariable) {
      return globalVariable;
    }

    pathInfo.path = this.component.processLiteralSegment({
      original: pathInfo.path,
    });

    return this.resolvePathFromContext({
      contextList,
      bindParents,
      pathInfo,
      stmt,
      declaredOriginal: original,
      original: pathInfo.path,
      validType,
      syntheticAlias,
      nameQualifier,
      create,
    });
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
    const { getScalarValue, getArrayValue, getObjectValue, isCodeGenObject } = TemplatePreprocessor;

    switch (true) {
      case value !== Object(value):
        return getScalarValue(value);
      case value.constructor.name === 'Object':
        return isCodeGenObject(value) ? value : getObjectValue(value);
      default:
        assert(value.constructor.name === 'Array');
        return getArrayValue(value);
    }
  }

  /**
   * This is return a list of well-known types. When generating a codegen ast object from an
   * object, the array returned here helps us differentiate if the object was intended to be a
   * json to be serialized or an actual ast object
   */
  static getKnownNonEcmaTypes() {
    return [
      // Handlebars
      'PathExpression', 'BooleanLiteral', 'NumberLiteral', 'StringLiteral',
      'NullLiteral', 'UndefinedLiteral', 'BooleanExpression',

      // Custom
      'LogicGate', 'MustacheGroup',

      // JSON Schema
      'object', 'string', 'array', 'boolean', 'timestamp', 'number',
      'int8', 'uint8', 'int16', 'uint16', 'int32', 'uint32', 'float32', 'float64'
    ];
  }

  static isCodeGenObject(value) {

    const { getKnownNonEcmaTypes } = TemplatePreprocessor;

    return value.constructor.name === 'Object' &&
      value.type && typeof value.type == 'string' &&
      !getKnownNonEcmaTypes().includes(value.type);
  }

  static getArrayValue(value) {
    const { getValue } = TemplatePreprocessor;
    return {
      type: 'ArrayExpression',
      elements: value.map(getValue),
    };
  }

  static getScalarValue(value) {
    const { getRawValue } = TemplatePreprocessor;

    if (typeof value == 'string') {
      return {
        type: 'TemplateLiteral',
        expressions: [],
        quasis: [{
          type: 'TemplateElement',
          value: {
            raw: value,
            cooked: value,
          },
          tail: true,
        }]
      }
    } else {
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
  }

  static getObjectValue(json) {
    const { getObjectValueProperty } = TemplatePreprocessor;
    const envelope = {
      type: 'ObjectExpression',
      properties: [],
    };
    for (const k in json) {
      if ({}.hasOwnProperty.call(json, k)) {
        const v = json[k];

        envelope.properties.push(
          getObjectValueProperty(k, v)
        );
      }
    }
    return envelope;
  }

  static getObjectValueProperty(k, v) {
    const { isCodeGenObject, getValue, getScalarValue } = TemplatePreprocessor;
    return {
      type: 'Property',
      key: getScalarValue(k),
      computed: true,
      value: v && isCodeGenObject(v) ? v : getValue(v),
      kind: 'init',
      method: false,
      shorthand: false,
    };
  }

  static getVariableEnvelope(variableName, init) {
    const { getIdentifier } = TemplatePreprocessor;
    if (typeof variableName !== 'string') {
      throw Error(`Unknown variable type for ${variableName}`);
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
    return {
      type: 'CallExpression',
      callee: methodName
        ? createMemberExpression({ target, key: methodName, computed })
        : target.type ? target : getIdentifier(target),
      arguments: args || [],
    };
  }

  // Todo: remove if not used
  static mergeExpressionWithParentInvocation(expr, methodName) {
    const { getCallExpression } = TemplatePreprocessor;

    const arr = [
      {
        type: 'SpreadElement',
        argument: getCallExpression({
          methodName,
          target: {
            type: 'Super'
          }
        }),
      },
      {
        type: 'SpreadElement',
        argument: expr,
      }
    ];

    switch (true) {
      case expr.type == 'ArrayExpression':
        return {
          type: expr.type,
          elements: arr,
        }

      case expr.type == 'ObjectExpression':
        return {
          type: expr.type,
          properties: arr,
        }

      case typeof expr.value == 'boolean':
        return {
          type: 'LogicalExpression',
          operator: '&&',
          left: arr[0].argument,
          right: expr,
        }

      default:
        throwError(`Unknown expression "${expr.type}"`);
        break;
    }
  }

  static mergeExpressionWithRawValue(expr, rawValue) {
    const { getValue, getObjectValueProperty, getRawValue, throwError } = TemplatePreprocessor;

    switch (true) {
      case expr.type == 'ArrayExpression':
        assert(rawValue instanceof Array);

        expr.elements = [
          ...rawValue.map(getValue),
          ...expr.elements,
        ];

        break;

      case expr.type == 'ObjectExpression':
        assert(rawValue.constructor.name == 'Object');

        expr.properties = [
          ...Object.entries(rawValue).map(([k, v]) => getObjectValueProperty(k, v)),
          ...expr.properties,
        ];

        break;

      case typeof expr.value == 'boolean':
        assert(typeof rawValue == 'boolean');

        expr.value = expr.value && rawValue;
        expr.raw = getRawValue(expr.value);

        break;

      default:
        throwError(`Unknown expression "${expr.type}"`);
        break;
    }

    return expr;
  }

  /**
   * This creates a function that just returns the provided
   * expression
   */
  wrapExpressionAsMethod({
    name, addSyntheticPrefix = true, statements = [], returnExpression, canMergeWithParent = false
  }) {
    const {
      syntheticMethodPrefix, getMethodFromFunctionDeclaration, mergeExpressionWithParentInvocation
    } = TemplatePreprocessor;

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

      // if (canMergeWithParent) {
      //   assert(addSyntheticPrefix && name);

      //   returnExpression = mergeExpressionWithParentInvocation(
      //     returnExpression,
      //     `${syntheticMethodPrefix}${name}`,
      //   )
      // }

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

  static onSubExpressionProcessed(stmt) {
    const {
      literalPrefix, resetPathExpression, visitNodes, toPathExpressionLiteral,
    } = TemplatePreprocessor;

    // If there is any literal-based path expressions in this sub expression, 
    // we need to transform it to it's canonical form
    // Note: This is necessary for correct processing of logic gates. Remember
    // that the logic gate objects maintain references to these PathExpressions

    visitNodes({
      types: ['PathExpression'],
      ast: {
        type: 'Program',
        body: [stmt]
      },
      // eslint-disable-next-line no-shadow
      consumer: ({ stmt }) => {
        if (stmt.original.startsWith(literalPrefix)) {
          resetPathExpression({
            stmt,
            original: toPathExpressionLiteral(
              stmt.original.replace(literalPrefix, '')
            ),
            properties: { processed: true },
          });
        }
      },
    });
  }

  addParameterizedExpression({
    pruneKey, bindParents, contextList, context, stmt, invokeMethodName, methodName,
    params = [], hash = { pairs: [] }, syntheticAlias, astHook,
  }) {

    const {
      syntheticMethodPrefix, literalPrefix, getVariableEnvelope, getScalarConstantAssignmentStatement,
      getCallExpression, createMemberExpression, resetPathExpression, getProxyStatement, createInvocationWithOptions,
      getFunctionDeclarationFromArrowFunction, getMethodFromFunctionDeclaration, isRootCtxValue, getValue,
      onSubExpressionProcessed, hasDataPathFormat, invokeDataPathTransform, createArrowFunctionExpression,
      stringifyHandlebarsNode, getLiteralValueFromPathExpression, getScalarValue,
    } = TemplatePreprocessor;

    if (!pruneKey) {
      assert(context == null);
      pruneKey = `_${utils.generateRandomString()}`;
    }

    if (stmt && !stmt.canonicalSource) {
      stmt.canonicalSource = stringifyHandlebarsNode(stmt);
    }

    // Add hash to paramList
    const paramList = [
      ...params,
      {
        type: 'Hash',
        original: hash,
      }
    ];

    const ast = {
      type: context ? 'ArrowFunctionExpression' : 'FunctionDeclaration',
      id: context ? null : {
        type: 'Identifier',
        name: methodName || utils.generateRandomString(),
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
                key: invokeMethodName,
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

    let hasUnprocessedParams = false;

    // eslint-disable-next-line no-plusplus
    for (let i = paramList.length - 1; i >= 0; i--) {
      const param = paramList[i];

      const name = utils.generateRandomString();
      variableNames.unshift(name);

      let statement;

      switch (true) {
        case param.type.endsWith('Literal'):
          statement = getScalarConstantAssignmentStatement(name, param.original);
          break;

        case param.type === 'Hash':
          statement = this
            .getHelperOptions({
              pruneKey,
              bindParents,
              contextList,
              variableName: name,
              hash: param.original,
              loc: stmt ? stmt.loc : null,
            });

          if (!statement) {
            hasUnprocessedParams = true;
          }
          break;

        case param.type === 'PathExpression':

          if (param.original.startsWith(literalPrefix)) {
            statement = getScalarConstantAssignmentStatement(
              name, param.original.replace(literalPrefix, ''),
            );
            break;
          } else if (param.processed) {
            assert(isRootCtxValue(param.original));
            // Param was already processed

            statement = getVariableEnvelope(name);

            statement.declarations[0].init = param.literalType ?
              getScalarValue(getLiteralValueFromPathExpression(param)) :
              getProxyStatement({
                path: param.original,
              });

            break;
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
              create: !param.immutable,
              validType: param.validType,
            });

            if (path.terminate) {
              hasUnprocessedParams = true;
              break;
            }

            if (path.type.endsWith('Literal')) {
              _path = literalPrefix + path.original;
              statement = getScalarConstantAssignmentStatement(name, path.original);
            } else {
              assert(path.type === 'PathExpression');

              if (hasDataPathFormat(path.original)) {
                path.original = invokeDataPathTransform(path.original, param);
              }

              _path = path.original;

              statement = getVariableEnvelope(name);
              statement.declarations[0].init = getProxyStatement({
                path: _path,
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
          const invokeMethodName = param.path.original;
          this.validateMethod(invokeMethodName);

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
            invokeMethodName,
            params: param.params,
            hash: param.hash,
          });

          if (b === false) {
            hasUnprocessedParams = true;
            break;
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

          onSubExpressionProcessed(param);

          // update param
          resetPathExpression({
            stmt: param,
            original: provisionalFunction.id.name,
            properties: { processed: true },
          });

          break;

        default:
          throw Error(`Unknown type: ${param.type}`);
      }

      body.unshift(statement);
    }

    if (hasUnprocessedParams) {
      return false;
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

      assert(stmt);

      // This high-level SubExpression has now been fully processed
      // During the course of processing, we may have added provisional functions to the ast for nested 
      // sub expressions... those are not longer needed and should be removed from the ast...
      // Note: In some cases (e.g. see excludeSubExpressionsFromPrune(...)), we may not want to prune some 
      // provisional functions that have been added to the ast, in which case those ast entries will be 
      // marked "prune: false"

      this.pruneComponentAst({ pruneKey });

      if (syntheticAlias) {
        // eslint-disable-next-line no-shadow
        const _stmt = utils.peek(body);
        _stmt.argument = getCallExpression({
          methodName: 'setSyntheticContext',
          args: [{
            alias: syntheticAlias,
            fn: createArrowFunctionExpression({
              body: [
                {
                  type: 'ReturnStatement',
                  argument: _stmt.argument,
                },
              ],
            }),
            loc: { ...stmt.loc },
            canonicalSource: stmt.canonicalSource,
          }]
            .map(getValue),

        });
      }

      if (astHook) {
        astHook(ast);
      }

      // Append method to ast
      this.componentAst.body[0].body.body
        .push({
          ...getMethodFromFunctionDeclaration({
            ast,
          }),
          // In some cases (e.g. see addLogicGate(...)), this method may need to be 
          // pruned, in which case <stmt.prune> will likely be set to true
          prune: stmt ? stmt.prune : false,
        });

      const synthethicMethodName = ast.id.name;

      // Update stmt

      onSubExpressionProcessed(stmt);

      // Finally, update from SUB_EXPR to P_EXPR
      resetPathExpression({
        stmt,
        original: synthethicMethodName,
        properties: { processed: true },
      });

      return synthethicMethodName;
    }
  }

  getHelperOptions({ pruneKey, bindParents, contextList, variableName, hash, loc }) {
    const {
      syntheticMethodPrefix, literalPrefix, getScalarValue, getVariableEnvelope, resetPathExpression,
      getProxyStatement, createInvocationWithOptions, getFunctionDeclarationFromArrowFunction, hasDataPathFormat,
      getMethodFromFunctionDeclaration, isRootCtxValue, getValue, getDefaultHelperHash, onSubExpressionProcessed,
      invokeDataPathTransform, getLiteralValueFromPathExpression
    } = TemplatePreprocessor;

    const envelope = getVariableEnvelope(variableName);

    const hashObject = {
      type: 'ObjectExpression',
      properties: [],
    };

    const getProperty = ({ key, value, stmt }) => ({
      type: 'Property',
      key: getScalarValue(key),
      computed: true,
      value,
      kind: 'init',
      method: false,
      shorthand: false,
      stmt,
    });

    let hasUnprocessedParams = false;

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

          if (value.original.startsWith(literalPrefix)) {
            hashObject.properties.push(
              getProperty({
                key,
                value: getScalarValue(
                  value.original.replace(literalPrefix, ''),
                ),
                stmt: value,
              }),
            );
            break;
          } else if (value.processed) {
            assert(isRootCtxValue(value.original));
            // Param was already processed

            hashObject.properties.push(
              getProperty({
                key,
                value: value.literalType ? getScalarValue(getLiteralValueFromPathExpression(value)) : getProxyStatement({
                  path: value.original,
                }),
                stmt: value,
              }),
            );
            break;
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
              create: !value.immutable,
              validType: value.validType,
            });

            if (path.terminate) {
              hasUnprocessedParams = true;
              break;
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

              if (hasDataPathFormat(path.original)) {
                path.original = invokeDataPathTransform(path.original, value);
              }

              _path = path.original;

              hashObject.properties.push(
                getProperty({
                  key,
                  value: getProxyStatement({
                    path: _path,
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

          const invokeMethodName = value.path.original;
          this.validateMethod(invokeMethodName);

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
            invokeMethodName,
            params: value.params,
            hash: value.hash,
          });

          if (b === false) {
            hasUnprocessedParams = true;
            break;
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

          onSubExpressionProcessed(value);

          // update param
          resetPathExpression({
            stmt: value,
            original: provisionalFunction.id.name,
            properties: { processed: true },
          });

          break;

        default:
          throw Error(`Unknown type: ${value.type}`);
      }
    }

    if (hasUnprocessedParams) {
      return false;
    }

    const defaultHelperHash = getValue(
      getDefaultHelperHash({ contextList }),
    );

    hashObject.properties = [
      ...hashObject.properties,
      ...defaultHelperHash.properties,
    ];

    envelope.declarations[0].init = getValue({
      hash: hashObject,
      loc: { ...loc },
    });

    return envelope;
  }

  static getLiteralValueFromPathExpression(stmt) {
    const { literalPathPrefixRegex } = TemplatePreprocessor;
    assert(stmt.literalType && stmt.original.match(literalPathPrefixRegex));

    const val = stmt.original.replace(literalPathPrefixRegex, '');

    switch (stmt.literalType) {
      case 'NullLiteral':
        assert(val == 'null');
        return null;
      case 'UndefinedLiteral':
        assert(val == 'undefined');
        return undefined;
      case 'BooleanLiteral':
        assert(['true', 'false'].includes(val));
        return Boolean(val);
      case 'NumberLiteral':
        assert(Number.isInteger(val));
        return Number(val);
      case 'StringLiteral':
        return val;
      default:
        throw Error(`Unknown type "${stmt.literalType}"`);
    }
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

  static getPreservedPathExpressionAttibutes() {
    return ['loc', 'participantType', 'canonicalSource'];
  }

  static toParts(original) {
    return original.split('.');
  }

  static resetPathExpression({ stmt, original, properties = {} }) {
    const { getPreservedPathExpressionAttibutes, toParts } = TemplatePreprocessor;

    getPreservedPathExpressionAttibutes()
      .forEach(k => {
        if (properties[k] === undefined && stmt[k] !== undefined) {
          properties[k] = stmt[k];
        }
      });

    utils.clear(stmt);

    stmt.type = 'PathExpression';
    stmt.original = original;
    stmt.data = original.startsWith('@');
    stmt.depth = 0;
    stmt.parts = toParts(original);
    if (stmt.data) {
      stmt.parts[0] = stmt.parts[0].replace(/^@/g, '');
    }

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

    assert(initial && (thenParameter || !expressions.length));

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

  static createArrowFunctionExpression({ params = [], body }) {
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

  static getMethodFromFunctionDeclaration({
    ast: expression, addSyntheticPrefix = true, syntheticNodeId, addOptionsRetrievalStatements = true,
  }) {
    const {
      syntheticMethodPrefix, renderMethodName, getSyntheticNodeIdMethodName,
      getCallExpression, getValue, getIdentifier, getVariableEnvelope, getOptionsRetrievalStatements,
      createPromise, createArrowFunctionExpression,
    } = TemplatePreprocessor;

    // Update method name, to indicate that it's synthetic
    expression.id.name = `${addSyntheticPrefix ? syntheticMethodPrefix : ''}${expression.id.name}`;

    if (syntheticNodeId) {
      const body = expression.body.body;

      const returnStmt = utils.peek(body);

      assert(returnStmt.type === 'ReturnStatement');
      assert(returnStmt.argument.type === 'CallExpression');

      const variableName = utils.generateRandomString();

      body[body.length - 1] = getVariableEnvelope(
        variableName,
        createPromise({
          expressions: [
            {
              type: 'CallExpression',
              callee: {
                ...createArrowFunctionExpression({
                  body: [returnStmt]
                }),
                async: true,
              },
              arguments: [],
            },
          ],
        })
      );

      if (addOptionsRetrievalStatements) {
        getOptionsRetrievalStatements().forEach(stmt => {
          body.push(stmt);
        })
      }

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
              options: getIdentifier('options'),
            }),
          ],
        })
      });

      body.push({
        type: 'ReturnStatement',
        argument: getValue(''),
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
          .map(getValue),
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

  createIterateNext({ path }) {
    return this.createBlockOperation({
      cacheKey: 'nextMethod',
      path,
      methodName: 'doBlockNext',
    });
  }

  createIterateUpdate({ path }) {
    return this.createBlockOperation({
      cacheKey: 'updateMethod',
      path,
      methodName: 'doBlockUpdate',
    });
  }

  createIterateFinalize({ path }) {
    return this.createBlockOperation({
      cacheKey: 'finalizeMethod',
      path,
      methodName: 'doBlockFinalize',
    });
  }

  createIterateInit({ path }) {
    return this.createBlockOperation({
      cacheKey: 'initMethod',
      defaultCacheValue: { dataVariableMethods: {} },
      path,
      methodName: 'doBlockInit',
    });
  }

  addDataVariablesToContext({
    contextObject, path, dataVariables, synthetic,
  }) {
    const { dataPathRoot, pathSeparator } = TemplatePreprocessor;

    for (const qualifier in dataVariables) {
      if ({}.hasOwnProperty.call(dataVariables, qualifier)) {
        const dataVariable = dataVariables[qualifier];

        contextObject[qualifier] = {
          type: 'PathExpression',
          lookup: false,
          ...synthetic ?
            {
              value: this.createIterateDataVariable({
                path,
                dataVariable,
              }),
              synthetic: true,
            } :
            {
              value: `${dataPathRoot}${pathSeparator}${path}_$${pathSeparator}${dataVariable}`,
            },
        };
      }
    }
  }

  createSubExpression({
    bindParents, contextList, method, params = [], hash, syntheticAlias, stmt,
  }) {
    const { getPathFromSyntheticAlias } = TemplatePreprocessor;

    // Process sub-expression
    // Todo: Here, the context is not passed in as last parameter

    this.validateMethod(method);

    let { methodNameSuffix } = stmt || {};

    let methodName = syntheticAlias ? getPathFromSyntheticAlias(syntheticAlias)
      : utils.generateRandomString();

    if (methodNameSuffix) {
      methodName += methodNameSuffix;
    }

    const synthethicMethodName = this.addParameterizedExpression({
      bindParents,
      contextList,
      invokeMethodName: method,
      methodName,
      stmt,
      params,
      hash,
      syntheticAlias,
    });

    if (!synthethicMethodName) {
      return false;
    }

    assert(!this.helpers.includes(synthethicMethodName));

    this.helpers.push(synthethicMethodName);

    return synthethicMethodName;
  }

  static createSubExpressionFromPath({ stmt }) {
    const { createPathExpression } = TemplatePreprocessor;
    const { original, loc } = stmt;

    utils.clear(stmt);

    stmt.type = 'SubExpression';
    stmt.path = createPathExpression({ original });
    stmt.params = [];
    stmt.loc = loc;

    stmt.fromPath = true;
    return stmt;
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

  static createMustacheStatement({ original, hash, params = [], loc, processed = true }) {

    const { createPathExpression, getDefaultLoc } = TemplatePreprocessor;

    if (!loc) {
      loc = getDefaultLoc();
    }

    return {
      type: 'MustacheStatement',
      path: {
        ...createPathExpression({ original }),
        loc, processed,
      },
      params,
      hash,
      loc,
    }
  }

  static getProxyStatement({ path }) {
    const {
      getScalarValue, createMemberExpression, addRawDataPrefixToPath
    } = TemplatePreprocessor;
    return {
      type: 'MemberExpression',
      computed: true,
      object: createMemberExpression({
        key: 'rootProxy',
      }),
      property: getScalarValue(
        addRawDataPrefixToPath(path),
      ),
    };
  }

  static getPathFromSyntheticAlias(syntheticAlias) {
    const { syntheticAliasSeparator } = TemplatePreprocessor;
    return syntheticAlias.split(syntheticAliasSeparator)[1];
  }

  static getChildPathFromSyntheticAlias(syntheticAlias) {
    const { getPathFromSyntheticAlias } = TemplatePreprocessor;
    return `${getPathFromSyntheticAlias(syntheticAlias)}_child`;
  }

  /**
   * Add a helper method that resolves the path using the component's proxy instance.
   * Todo: Support async function invocation
   */
  createRootProxyIndirection({ stmt, canonicalSource, path, suffix = false, syntheticAlias }) {

    assert(suffix || syntheticAlias);

    const synthethicMethodName = this.createRootProxyIndirection0({
      stmt, canonicalSource, path, suffix, syntheticAlias
    });

    this.helpers.push(synthethicMethodName);

    return synthethicMethodName;
  }

  createRootProxyIndirection0({ stmt, canonicalSource, path, suffix, syntheticAlias }) {
    const {
      getCallExpression, getMethodFromFunctionDeclaration, getScalarValue, getValue,
      getPathFromSyntheticAlias, isConditionalParticipant, createArrowFunctionExpression,
      getProxyStatement, throwMethodInvocationCannotBeConditional, appendSuffix,
      getIdentifier,
    } = TemplatePreprocessor;

    const lenientResolution = stmt && isConditionalParticipant(stmt);

    if (!suffix && lenientResolution) {
      // We are effectively just peforming a method invocation, so it would be semantically incorrect
      // to imply support for leniency
      // Todo: determine if we don't need to throw this error...
      throwMethodInvocationCannotBeConditional(stmt.original, stmt);
    }

    const loc = stmt ? { ...stmt.loc } : null;

    let valueVariableName = 'value';
    const scope = {};

    const getFirstVariableDeclaration = () => ({
      type: 'VariableDeclaration',
      declarations: [
        {
          type: 'VariableDeclarator',
          id: {
            type: 'Identifier',
            name: valueVariableName,
          },
          init: getProxyStatement({ path }),
        },
      ],
      kind: 'const',
    });

    const getSecondVariableDeclaration = () => {
      const result = {
        type: 'VariableDeclaration',
        declarations: [
          {
            type: 'VariableDeclarator',
            id: {
              type: 'Identifier',
              name: 'r',
            },
            init: getScalarValue(
              appendSuffix(valueVariableName, suffix),
            ),
          },
        ],
        kind: 'const',
      }

      scope[valueVariableName] = getIdentifier(valueVariableName);
      valueVariableName = result.declarations[0].id.name;

      return result;
    };

    const getExecStatement = () => ({
      ...getCallExpression({
        methodName: 'evalPath',
        args: [
          {
            type: 'Identifier',
            name: valueVariableName,
          },
          lenientResolution,
          loc,
          scope,
        ]
          .map(getValue),
      }),
    });

    const body = [
      getFirstVariableDeclaration(),
    ]

    if (suffix) {
      body.push(
        getSecondVariableDeclaration()
      );
    }

    if (syntheticAlias) {
      body.push(
        {
          type: 'ReturnStatement',
          argument: getCallExpression({
            methodName: 'setSyntheticContext',
            args: [{
              alias: syntheticAlias,
              fn: createArrowFunctionExpression({
                body: [
                  {
                    type: 'ReturnStatement',
                    argument: getExecStatement(),
                  },
                ],
              }),
              loc,
              canonicalSource,
            }]
              .map(getValue),

          })
        }
      )
    } else {
      body.push(
        {
          type: 'ReturnStatement',
          argument: getExecStatement(),
        }
      )
    }

    const ast = {
      type: 'FunctionDeclaration',
      id: {
        type: 'Identifier',
        name: syntheticAlias ?
          getPathFromSyntheticAlias(syntheticAlias)
          : utils.generateRandomString(),
      },
      params: [],
      body: {
        type: 'BlockStatement',
        body,
      },
      generator: false,
      expression: false,
      async: false,
    };

    this.componentAst.body[0].body.body
      .push(getMethodFromFunctionDeclaration({ ast }));

    return ast.id.name;
  }

  getBlockParam(stmt, index) {
    const { getReservedBlockParamNames, throwError } = TemplatePreprocessor;
    const { blockParams } = stmt.program;
    const blockParam = blockParams && blockParams.length > index
      ? blockParams[index] : null;

    if (blockParam && this.methodNames.includes(blockParam)
    ) {
      throwError(
        `The blockParam '${blockParam}' already exists as a named method`, stmt,
      );
    }

    if (getReservedBlockParamNames().includes(blockParam)) {
      this.throwError(
        `The blockParam '${blockParam}' is an internal qualifer and is not allowed on this block`,
        stmt,
      );
    }

    return blockParam;
  }

  getBlockQualifiers({ stmt }) {
    const scopeQualifier = this.getBlockParam(stmt, 0);
    const indexQualifier = this.getBlockParam(stmt, 1);

    return {
      scopeQualifier,
      indexQualifier,
    };
  }

  static addBlockParamHashKey(stmt, value) {
    const { blockParamHashKey, createStringLiteral } = TemplatePreprocessor;
    const hash = stmt.hash || (stmt.hash = { type: 'Hash', pairs: [] });

    hash.pairs.push({
      type: 'HashPair',
      key: blockParamHashKey,
      value: createStringLiteral(value)
    });
  }

  validateCustomBlock({ stmt }) {
    const { getReservedBlockNames, throwError } = TemplatePreprocessor;

    // Ensure that the path is a valid component method
    this.validateMethod(stmt.path.original);

    if (stmt.program.blockParams.length !== 1) {
      throwError(
        `Please provide one block parameter for block: ${stmt.path.original}`,
        stmt,
      );
    }

    if (getReservedBlockNames().includes(stmt.path.original)) {
      throwError(`The block name: ${stmt.path.original} is reserved`, stmt);
    }
  }

  updateCustomBlockPath({ stmt, isCustomContext }) {
    const { createPathExpression } = TemplatePreprocessor;

    stmt.path = createPathExpression({
      original: this.createCustomBlockPath({
        methodName: stmt.path.original,
        stmt,
        isCustomContext,
      }),
    });
    stmt.path.processed = true;
  }

  static getHashValue({
    stmt, key, type, cleanup = false,
  }) {
    const { generatedPartialHashKeyPrefix, throwError } = TemplatePreprocessor;
    if (stmt.hash) {
      const { pairs } = stmt.hash;
      // eslint-disable-next-line no-plusplus
      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        if (pair.key === key) {
          if (cleanup) {
            pairs.splice(i, 1);
          }

          if (type) {
            if (typeof type == 'string' && pair.value.type !== type) {
              throwError(`Expected hash value for key '${key}' to be of type '${type}'`, stmt);
            }
            if (type instanceof Array && !type.includes(pair.value.type)) {
              throwError(`Expected hash value for key '${key}' to be any of the types: ${type}`, stmt);
            }
          }

          if (pair.key.startsWith(generatedPartialHashKeyPrefix) && !pair.generated) {
            throwError(`Illegal hashkey "${pair.key}" defined on partial statement`, stmt);
          }

          return pair.value;
        }
      }
    }
    return null;
  }

  static getOptionsRetrievalStatements() {
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

  createCustomBlockPath({ methodName, stmt, isCustomContext }) {
    const { getMethodFromFunctionDeclaration } = TemplatePreprocessor;

    const { syntheticNodeId } = stmt;

    const ast = (
      syntheticNodeId
        ? this.getCustomBlockFuntionInHtmlWrapper : this.getCustomBlockFuntion
    )({ methodName, stmt, isCustomContext });

    this.componentAst.body[0].body.body
      .push(getMethodFromFunctionDeclaration({ ast }));

    this.helpers.push(ast.id.name);

    return ast.id.name;
  }

  getCustomBlockFuntionInHtmlWrapper({ methodName, stmt, isCustomContext }) {
    const {
      validateTypeMethodName, renderBlockMethodName, renderMethodName, getLoaderMethodName,
      getSyntheticNodeIdMethodName, captureStateMethodName, getIdentifier, createPromise,
      getCallExpression, getValue, getOptionsRetrievalStatements, getVariableEnvelope, getLine,
      createArrowFunctionExpression,
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
          ...getOptionsRetrievalStatements(),
          getVariableEnvelope('state',
            isCustomContext ?
              getValue(null)
              : getCallExpression({
                methodName: captureStateMethodName,
              })
          ),
          getVariableEnvelope('nodeId',
            getCallExpression({
              methodName: getSyntheticNodeIdMethodName,
            })
          ),
          getVariableEnvelope('data', createPromise({
            thenParameter: 'data',
            expressions: [
              {
                type: 'CallExpression',
                callee: {
                  ...createArrowFunctionExpression({
                    body: [{
                      type: 'ReturnStatement',
                      argument: getCallExpression({
                        methodName,
                        args: [{
                          type: 'SpreadElement',
                          argument: {
                            type: 'Identifier',
                            name: 'params',
                          },
                        },
                        getIdentifier('options')
                        ]
                      })
                    }]
                  }),
                  async: true,
                },
                arguments: [],
              },
              {
                type: 'BlockStatement',
                body: [
                  // Ensure that the resolved data is an object, as per the requirements of
                  // renderBlock(...)
                  {
                    type: 'ExpressionStatement',
                    expression: getCallExpression({
                      methodName: validateTypeMethodName,
                      args: [{
                        path: getValue(methodName),
                        value: getIdentifier('data'),
                        validType: getValue('Object'),
                        line: getValue(getLine(stmt)),
                      }]
                        .map(getValue),
                    }),
                  },
                  {
                    type: 'ReturnStatement',
                    argument: getCallExpression({
                      methodName: renderBlockMethodName,
                      args: [{
                        options: getIdentifier('options'),
                        ctx: getIdentifier('data'),
                        scope: getValue(true),
                        state: getIdentifier('state'),
                        nodeId: getIdentifier('nodeId'),
                      }]
                        .map(getValue),
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
                target: getIdentifier('nodeId'),
              }]
                .map(getValue),

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
  getCustomBlockFuntion({ methodName, stmt, isCustomContext }) {
    const {
      validateTypeMethodName, renderBlockMethodName, captureStateMethodName, getIdentifier,
      getCallExpression, getValue, getOptionsRetrievalStatements, getVariableEnvelope, getLine,
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
          ...getOptionsRetrievalStatements(),
          getVariableEnvelope('state',
            isCustomContext ?
              getValue(null)
              : getCallExpression({
                methodName: captureStateMethodName,
              })
          ),
          getVariableEnvelope(
            'data',
            getCallExpression({
              methodName,
              args: [{
                type: 'SpreadElement',
                argument: {
                  type: 'Identifier',
                  name: 'params',
                },
              },
              getIdentifier('options')
              ],
            })),
          // Ensure that the resolved data is an object, as per the requirements of
          // renderBlock(...)
          {
            type: 'ExpressionStatement',
            expression: getCallExpression({
              methodName: validateTypeMethodName,
              args: [{
                path: getValue(methodName),
                value: getIdentifier('data'),
                validType: getValue('Object'),
                line: getValue(getLine(stmt)),
              }]
                .map(getValue),

            }),
          },
          {
            type: 'ReturnStatement',
            argument: getCallExpression({
              methodName: renderBlockMethodName,
              args: [{
                options: getIdentifier('options'),
                ctx: getIdentifier('data'),
                scope: getValue(true),
                state: getIdentifier('state'),
              }]
                .map(getValue),
            }),
          },
        ],
      },
    };
  }

  static getCustomContextInvokeFunction({ stmt }) {
    const {
      getIdentifier,
      createMemberExpression,
      getCallExpression,
      getValue,
      getOptionsRetrievalStatements,
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
          ...getOptionsRetrievalStatements(),
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

  static getAllValidTypes() {
    const {
      literalType, arrayType, objectType, mapType, componentRefType,
    } = TemplatePreprocessor;
    return [literalType, arrayType, objectType, mapType, componentRefType];
  }

  getBlockOptions(stmt) {
    const {
      arrayType, objectType, mapType, addDefaultParamToCustomBlock, createBooleanLiteral, ensureNoLiteralParam0,
      createPathExpression, throwError, resetPathExpression
    } = TemplatePreprocessor;

    const blockName = stmt.path.original;
    const {
      scopeQualifier, indexQualifier,
    } = this.getBlockQualifiers({ stmt });

    let validType;
    let contextSwitching = false;
    let canIterate = false;
    let conditional = false;
    let custom = false;
    let requiresScopeQualifier = true;
    let allowLiteralParams = false;

    switch (stmt.path.original) {
      case 'block':
        if (stmt.params.length) {
          throwError(`No params are expected on a #block statement`, stmt);
        }
        if (scopeQualifier || indexQualifier) {
          throwError(
            `No qualifiers (i.e "${scopeQualifier || indexQualifier}") are expected on an #block statement`, stmt
          );
        }

        resetPathExpression({ stmt: stmt.path, original: 'if' });
        stmt.params = [
          createBooleanLiteral(true)
        ]

      case 'unless':
      case 'if':
        conditional = true;
        requiresScopeQualifier = false;
        allowLiteralParams = true;
        break;

      case 'each':
        validType = indexQualifier ? arrayType : mapType;
        contextSwitching = true;
        canIterate = true;

        break;

      case 'with':
        validType = objectType;
        contextSwitching = true;
        // Set this as a conditional, since it will
        // be transformed to a conditional block
        conditional = true;

        break;
      default:
        custom = true;
        allowLiteralParams = true;

        if (addDefaultParamToCustomBlock && !stmt.params.length) {
          stmt.params = [
            {
              ...createPathExpression({ original: 'this' }),
              // Provisionally add a loc object
              loc: stmt.path.loc,
            }
          ];
        }

        break;
    }

    if (!custom) {
      if (stmt.params.length > 1) {
        throwError(`Only 1 param should be provided`, stmt);
      }
    }

    if (!allowLiteralParams) {
      ensureNoLiteralParam0({ stmt });
    }

    if (requiresScopeQualifier && !scopeQualifier) {

      if (blockName == 'with') {
        // Since we know that the target of a #with block is always an object, we can add a generated scope qualifier...
        // unlike an #each block where we need to use the block qualifiers to infer the collection type of the target path.

        const blockParams = stmt.program.blockParams || (stmt.program.blockParams = []);

        blockParams.push(utils.generateRandomString());
      } else {
        throwError(`Scope qualifier must be specified`, stmt);
      }
    }

    return {
      blockName,
      validType,
      contextSwitching,
      scopeQualifier,
      indexQualifier,
      canIterate,
      conditional,
      custom,
    };
  }

  static ensureNoHash({ stmt }) {
    const { throwError } = TemplatePreprocessor;
    const { hash } = stmt;
    if (hash && hash.pairs && hash.pairs.length) {
      throwError(`Hashes are not allowed for a #${stmt.path.original} block`, stmt);
    }
  }

  static ensureNoLiteralParam0({ stmt }) {
    const { throwError } = TemplatePreprocessor;
    const param = stmt.params[0];
    // eslint-disable-next-line default-case
    switch (true) {
      case param.type.endsWith('Literal'):
        throwError(`#${stmt.path.original} cannot contain a ${param.type} param`, stmt);

      case param.type.endsWith('PathExpression')
        && param.original === '':
        // PathExpression == []
        throwError(`#${stmt.path.original} cannot contain an empty ${param.type} param`, stmt);
    }
  }

  /**
   * Todo: Integrate advanced reporting capabilities here, inorder to understand the most
   * common errors developers using the SDK are experiencing
   */
  static throwError(err, stmt) {
    const { getLine } = TemplatePreprocessor;
    if (typeof err == 'string') {
      throw Error(`${stmt ? `[${getLine(stmt)}] ` : ''}${err}`);
    } else {
      throw err;
    }
  }

  throwError(msg, stmt) {
    const { throwError } = TemplatePreprocessor;
    throwError(msg, stmt);
  }

  getSyntheticMethodValue({ stmt, source, method, validType, line }) {
    const { throwError, getLine } = TemplatePreprocessor;

    // Allow hbs engine to attempt to resolve this synthetic method
    // Todo: remove, not necessary to add here
    this.allowedPaths.push(method);

    // we need to serialize, so we can invoke the method
    // to get it's returned type (for validation purpose)

    this.serializeAst();

    // Note that if <method> is a mustache-based invocation, <value> will
    // always be an empty string
    let value;

    try {
      value = this.component[method]();
    } catch (e) {
      this.logger.error(
        `${stmt ? `[${getLine(stmt)}] ` : ''}Exception thrown while executing => ${source}`
      );
      throwError(e);
    }

    // Remove from allowedPaths. Note, that it will be re-added
    // later, after any necessary transformation has been done.
    // e.g. if it's a custom block param - after
    // rawDataPrefix has been prepended
    const i = this.allowedPaths.indexOf(method);

    assert(i >= 0);
    this.allowedPaths.splice(i, 1);

    return validType ? this.component.validateType({
      path: source,
      value,
      validType,
      line,
    }) : value;
  }

  static isRootCtxValue(value) {
    const { syntheticMethodPrefix, dataPathPrefixRegex } = TemplatePreprocessor;
    return value.match(dataPathPrefixRegex) || value.startsWith(syntheticMethodPrefix);
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
    const { arrayType, objectType, mapType } = TemplatePreprocessor;
    return [arrayType, objectType, mapType].includes(targetType);
  }

  addDataBindTransformations(ast) {

    const {
      customEachHelperName, startTNBCtxHelperName, startAttrCtxHelperName, endAttrCtxHelperName, htmlWrapperCssClassname,
      createContentStatement, createMustacheStatement, throwError, visitNodes
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

    const createBlockHtmlWrapper = ({ stmt }) => {
      const { htmlWrapperCssClassname, setSyntheticNodeIdHelperName } = TemplatePreprocessor;

      const tagName = 'div';

      const { parent } = stmt;

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
            original: `' class='${htmlWrapperCssClassname}'>\n`,
          }),
        ]
          .map(s => {
            s.loc = stmt.loc;
            return s;
          }),
      });

      replacements.push({
        parent: parent.body,
        replacementIndex: index + 1,
        replacementNodes: [
          createContentStatement({
            original: `\n</${tagName}>`,
          }),
        ]
          .map(s => {
            s.loc = stmt.loc;
            return s;
          }),
      });
    };

    const canCreateBlockHtmlWrapper = () => {

      let i = tokenList.length - 1;
      while (i >= 0) {
        const token = tokenList[i];
        switch (token.type) {
          case START_TAG_END:
            return true;
          case START_TAG_START:
            return false;
        }
        // eslint-disable-next-line no-plusplus
        i--;
      }
      return true;
    }

    const createTextNodeBindWrapper = ({ stmt }) => {
      const { parent } = stmt;

      const tagName = 'span';

      const index = parent.body.indexOf(stmt);

      replacements.push({
        parent: parent.body,
        replacementIndex: index,
        replacementNodes: [
          createContentStatement({
            original: `<${tagName} class='${htmlWrapperCssClassname}' id='`,
          }),
          createMustacheStatement({ original: startTNBCtxHelperName, loc: stmt.loc, }),
          createContentStatement({
            original: '\'>',
          }),
        ]
          .map(s => {
            s.loc = stmt.loc;
            return s;
          }),
      });

      replacements.push({
        parent: parent.body,
        replacementIndex: index + 1,
        replacementNodes: [
          createContentStatement({
            original: `</${tagName}>`,
          }),
        ]
          .map(s => {
            s.loc = stmt.loc;
            return s;
          }),
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
        createMustacheStatement({ original: endAttrCtxHelperName, loc: stmt.loc }),
        createContentStatement({
          original: arr.slice(i, arr.length).join(''),
        }),
      ];

      replacementNodes = replacementNodes.map((node) => {
        node.parent = parent;
        return node;
      });

      parent.body.splice(parent.body.indexOf(stmt), 1, ...replacementNodes);
    };

    const createStartAttributeCtxStatement = ({ stmt }) => {
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
        createMustacheStatement({ original: startAttrCtxHelperName, loc: stmt.loc }),
        createContentStatement({
          original: `${arr.slice(i + 1, arr.length).join('')}`,
        }),
      ];

      parent.body.splice(
        parent.body.indexOf(stmt), 1, ...replacementNodes
      );
    };

    const getCurrentAttributesList = ({ index, loc }) => {
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

        if (!key) {
          throwError(`Expected attribute with value "${value.content}" to have an attribute key`, { loc });
        }

        // Ensure that if there is no value, there must be no wrapper
        assert(!!value || (!startWrapper && !endWrapper));

        if (!value) {
          return;
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

          const htmlAttributeList = getCurrentAttributesList({
            index: startTagEnd,
            loc: {
              ...stmt.loc,
              start: stmt.loc.end,
            },
          });

          const attributeList = {};
          const isMustacheAttr = (v) => {
            if (typeof v !== 'string') {
              return false;
            }
            return !!v.match(/{{{/g);
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

          // In this context, an arbitraryId is one that we are certain will be rendered twice
          // (i.e. it is in an iterate block)
          const hasArbitraryId = htmlAttributeList.id && !htmlAttributeList.id.includes('{{');

          if (hasArbitraryId) {
            if (stmt.inIterateContext) {
              throwError(`You cannot provide a HtmlElement ID: ${htmlAttributeList.id}`, stmt);
            }
          }

          if (hasDataPaths) {
            const { parent } = stmt;
            const index = parent.body.indexOf(stmt);

            for (let i = index - 1; i >= 0; i--) {
              const stmt = parent.body[i];
              if (stmt.type === 'ContentStatement' && stmt.original.includes('<')) {
                createStartAttributeCtxStatement({ stmt });
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
      const { rawDataPrefix, resolveMustacheInRootHelperName } = TemplatePreprocessor;

      const { path, params, dataBinding, createHtmlWrapper } = stmt;
      let { processed, original } = path;
      let tokenizerOriginal;

      if (processed) {
        if (dataBinding) {

          assert(original == resolveMustacheInRootHelperName);

          // Remove "data." if applicable
          original = params[0].original.replace(/^data\./g, '');

          // Remove "r$_" if applicable
          original = original.replace(rawDataPrefix, '');

          tokenizerOriginal = `{{{${original}}}}`;

        } else {
          tokenizerOriginal = `{{${original}}}`;
        }
      } else {
        tokenizerOriginal = `{{${utils.generateRandomString()}}}`;
      }

      const isTextNode = getIndex(false, contents, contents.length - 1, '>', '<', 0) >= 0;

      if (createHtmlWrapper && isTextNode) {
        createTextNodeBindWrapper({ stmt });
      }

      statements.push(stmt);
      streamTokenizer.write(tokenizerOriginal);
    };

    const onBlockStatement = (stmt) => {
      const { visitNodes } = TemplatePreprocessor;

      if (stmt.createHtmlWrapper && canCreateBlockHtmlWrapper()) {

        createBlockHtmlWrapper({ stmt });
      } else {

        if (stmt.forceHtmlWrapper) {
          throwError(
            `A html wrapper is required for this block, but the wrapper could not be created`,
            stmt
          );
        }

        if (!stmt.skipBlock) {
          visitNodes({
            types: ['BlockStatement', 'MustacheStatement'],
            ast: {
              type: 'Program',
              body: [...stmt.program.body, ...stmt.inverse ? stmt.inverse.body : []],
            },
            consumer: ({ stmt }) => {
              stmt.createHtmlWrapper = false;

              if (stmt.type == 'BlockStatement') {
                stmt.skipBlock = true;
              } else {
                stmt.dataBinding = false;
              }
            }
          });
        }
      }
    }

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
        this.mutating = true;
        stmt.parent = undefined;
        return stmt;
      }

      stmt.parent = utils.peek(bindParents);
      allStatements.push(stmt);

      bindParents.push({
        original: stmt.path.original,
        body: stmt.program.body,
        loc: stmt.program.loc,
        index: bindParents.length,
      });

      this.acceptKey(stmt, 'program');

      bindParents.pop();

      if (stmt.inverse) {
        bindParents.push({
          body: stmt.inverse.body,
          loc: stmt.inverse.loc,
          index: bindParents.length,
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
        case 'BlockStatement':
          onBlockStatement(stmt);
          break;
      }
    }

    this.replaceNodes0({ replacements });

    CLEANUP_MODE = true;
    parser.accept(ast);

    visitNodes({
      types: ['ContentStatement'],
      ast,
      consumer: ({ stmt }) => {
        const { contentHelperName, createStringLiteral, createPathExpression, getDefaultLoc } = TemplatePreprocessor;
        const { original, loc } = stmt;

        utils.clear(stmt);

        stmt.type = 'MustacheStatement';
        stmt.path = createPathExpression({ original: contentHelperName });
        stmt.params = [
          createStringLiteral(original)
        ];
        stmt.loc = loc || getDefaultLoc();
        stmt.escaped = false;
      }
    });
  }

  canPrintHtmlWarnings() {
    const { printHtmlWarnings = true } = this.resolver.config;
    return printHtmlWarnings;
  }

  static toPathExpressionLiteral(value) {
    const { dataPathRoot, pathSeparator, literalPrefix } = TemplatePreprocessor;
    return `${dataPathRoot}${pathSeparator}${literalPrefix}${value}`;
  }

  static throwMethodInvocationCannotBeConditional(original, stmt) {
    const { throwError } = TemplatePreprocessor;
    throwError(
      `{{${original}} cannot have a conditional clause because it is a method invocation`, stmt
    );
  }

  static isConditionalParticipant(stmt) {
    const { PARTICIPANT_TYPE_CONDITIONAL } = TemplatePreprocessor;
    const { participantType } = stmt;

    return participantType && participantType.includes(PARTICIPANT_TYPE_CONDITIONAL);
  }

  static addConditionalParticipant(stmt) {
    const { PARTICIPANT_TYPE_CONDITIONAL, addParticipantType } = TemplatePreprocessor;
    addParticipantType(stmt, PARTICIPANT_TYPE_CONDITIONAL);
  }

  static addParticipantType(stmt, name) {
    if (!stmt.participantType) {
      stmt.participantType = [];
    }
    const { participantType } = stmt;
    assert(!participantType.includes(name))
    participantType.push(name);
  }

  static invokeDataPathTransform(original, stmt) {
    const { dataPathPrefixRegex, conditionalTransform } = TemplatePreprocessor;

    assert(original.match(dataPathPrefixRegex))

    original = conditionalTransform(original, stmt);

    return original;
  }

  static conditionalTransform(original, stmt) {

    const { PARTICIPANT_TYPE_CONDITIONAL } = TemplatePreprocessor;

    const { participantType } = stmt;

    if (participantType && participantType.includes(PARTICIPANT_TYPE_CONDITIONAL)) {
      assert(!original.endsWith('?'));

      return `${original}?`;
    }

    return original;
  }

  visitPathExpressions(ast) {
    const {
      lenientPathResolution, visitNodes, validatePathExpression, resetPathExpression,
      addConditionalParticipant, throwMethodInvocationCannotBeConditional
    } = TemplatePreprocessor;

    const lenientMarker = /(?<!^)\?$/g;

    visitNodes({
      types: ['PartialStatement', 'PathExpression'],
      ast,
      consumer: ({ stmt }) => {

        if (stmt.type == 'PartialStatement') {
          // Skip path expression processing below for partial names
          stmt.name.processed = true;
          return;
        }

        const { processed, original } = stmt;

        if (!processed) {

          const isSubExpression = this.methodNames.includes(original);
          const haslenientMarker = original.match(lenientMarker);

          if (isSubExpression && haslenientMarker) {
            throwMethodInvocationCannotBeConditional(original, stmt);
          }

          if (!isSubExpression && (lenientPathResolution || haslenientMarker)) {
            resetPathExpression({
              stmt,
              original: original.replace(lenientMarker, '')
            });

            addConditionalParticipant(stmt);
          }

          // Validate
          validatePathExpression(stmt);
        }
      },
    });
  }

  isProgramTrasformed(program) {
    return program.transformed;
  }

  transformProgram(program) {
    const transformers = Transformers.map(T => new T({
      preprocessor: this,
    }));

    this.visitPathExpressions(program);

    for (const t of transformers) {
      t.transform(program);
    }

    program.transformed = true;
  }

  process0({ contextList, bindParents, program }) {
    const {
      rootQualifier,
      allowRootAccessHashKey,
      allowRootAccessByDefault,
      storeContextBlockName,
      loadContextBlockName,
      syntheticAliasSeparator,
      dataPathRoot,
      pathSeparator,
      partialIdHashKey,
      partialNameHashKey,
      syntheticMethodPrefix,
      asyncHashKey,
      escapedHashKey,
      appendSuffix,
      hasObjectPrefix,
      getCallExpression,
      addRawDataPrefixToPath0,
      addRawDataPrefixToPath,
      resetPathExpression,
      createPathExpression,
      createSubExpressionFromPath,
      createMustacheStatement,
      getHashValue,
      getAvailableInlineBlocks,
      getOuterInlineBlock,
      visitNodes,
      getLine,
      getContextSwitchingHelpers,
      getPathInfo,
      getValue,
      getDefaultStripOptions,
      createStringLiteral,
      createLiteral,
      createContentStatement,
      getMethodFromFunctionDeclaration,
      getCustomContextInvokeFunction,
      stringifyHandlebarsNode,
      throwError,
    } = TemplatePreprocessor;

    const customBlockCtx = [{
      value: false,
    }];

    // eslint-disable-next-line no-underscore-dangle
    const _this = this;

    const replacements = [];

    const streamTokenizer = new StreamTokenizer();
    let tokenList = [];

    const { Visitor } = handlebars;
    function ASTParser() {
    }
    ASTParser.prototype = new Visitor();

    /**
     * Note: When calling this method, make sure that none of the
     * replacement nodes are being visited by handlebars because that
     * would cause interference with hbs visitor transformations, hence
     * produce incorrect results
     */
    const replaceNodes = ({ parent } = {}) => {
      this.replaceNodes0({ replacements, parent });
    }

    const isCustomContext = () => this.customBlockCtx || utils.peek(customBlockCtx).value;

    const getUniqueContextKeys = () => {
      const keys = [];

      contextList.forEach(ctx => {
        Object.entries(ctx)
          .forEach(([k, { unique }]) => {
            if (unique) keys.push(k);
          });
      });

      return keys;
    };

    const registerContext = (contextObject, stmt, addContextId = false) => {

      const uniqueKeys = getUniqueContextKeys()

      const ctxId = addContextId ? utils.generateRandomString() : null;

      Object.entries(contextObject)
        .forEach(([k, v]) => {
          v.index = contextList.length;
          v.loc = stmt.loc;

          if (v.scope && ctxId) {
            v.contextId = ctxId;
          }

          if (uniqueKeys.includes(k)) {
            throwError(`Context key "${k}" cannot be used in this scope`, stmt);
          }
        })

      contextList.push(contextObject);

      return ctxId;
    }

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

    const isEscaped = ({ stmt }) => {
      const escaped = (
        getHashValue({
          stmt, key: escapedHashKey, type: 'BooleanLiteral', cleanup: false,
        })
        || { original: !!this.resolver.config.escapeDynamicHtml }
      ).original;
      return escaped;
    };

    const getTransform = ({ stmt }) => {
      const { transformHashKey, throwError } = TemplatePreprocessor;
      const { original: transformMethod } =
        getHashValue({
          stmt, key: transformHashKey, type: 'StringLiteral', cleanup: false,
        })
        || { original: null };

      if (transformMethod && !this.methodNames.includes(transformMethod)) {
        throwError(`Unknown transform method "${transformMethod}"`, stmt);
      }

      return transformMethod;
    };

    const getHook = ({ stmt }) => {
      const { hookHashKey, hookOrderHashKey, throwError } = TemplatePreprocessor;

      const { original: hookMethod } =
        getHashValue({
          stmt, key: hookHashKey, type: 'StringLiteral', cleanup: false,
        })
        || { original: null };

      if (hookMethod && !this.methodNames.includes(hookMethod)) {
        throwError(`Unknown hook method "${hookMethod}"`, stmt);
      }

      // Also validate "hookOrder" hash value if specified
      getHashValue({
        stmt, key: hookOrderHashKey, type: 'NumberLiteral', cleanup: false,
      })

      return hookMethod;
    };

    const getClosestAsyncCustomContext = () => {
      // eslint-disable-next-line no-plusplus
      for (let j = customBlockCtx.length - 1; j >= 0; j--) {
        const ctx = customBlockCtx[j];
        if (ctx.async) {
          return ctx;
        }
      }
      return null;
    };

    const acceptPathExpressionInCustomCtx = ({ stmt, visitor }) => {
      const {
        isResolvableInScope, throwCannotAccessIterateContextInAsync, throwCannotAccessRestrictedPath,
        getSuffix, invokeDataPathTransform, toPathExpressionLiteral,
      } = TemplatePreprocessor;

      const prev = stmt.original;

      if (stmt.processed) {
        return stmt;
      }

      if (stmt.decoratorParameter) {
        return stmt;
      }

      if (this.methodNames.includes(prev)) {

        const customCtxFnCache = this.metadata.customCtxFnCache ||
          (this.metadata.customCtxFnCache = {});

        let syntheticMethodName = customCtxFnCache[prev]

        if (syntheticMethodName) {
          return {
            ...createPathExpression({ original: syntheticMethodName }),
            processed: true,
          }
        }

        const expr = createSubExpressionFromPath({
          stmt,
        });

        ASTParser.prototype.SubExpression.call(visitor, expr);
        syntheticMethodName = expr.path.original;

        customCtxFnCache[prev] = syntheticMethodName;

        return {
          ...createPathExpression({ original: syntheticMethodName }),
          processed: true,
        };
      }

      const pathInfo = getPathInfo({
        stmt,
        original: stmt.original,
        contextList,
      });

      let { index, path: original } = pathInfo;

      const globalVariable = this.resolveGlobalVariable({
        pathInfo, original: stmt.original, validType: stmt.validType, stmt
      });

      if (globalVariable) {

        original = invokeDataPathTransform(original, stmt);

        original = addRawDataPrefixToPath(globalVariable.original);

        resetPathExpression({
          stmt,
          original,
          properties: {
            processed: true,
          },
        });

        return stmt;
      }

      const inlineBlock = getOuterInlineBlock({ bindParents });
      const hasRootPrefix = hasObjectPrefix({ stmt, value: original, key: '@root' })

      if (hasRootPrefix) {
        if (!inlineBlock) {

          const { contextId } = utils.peek(customBlockCtx);
          const suffix = getSuffix(original);

          assert(contextId);

          resetPathExpression({
            stmt,
            original: `@${`${contextId}${suffix ? `.${suffix}` : ''}`}`,
            properties: {
              processed: true,
            },
          });
        } else {
          // @root paths are not resolved inside an inline block
        }
        return stmt;
      }

      const lookupScopes = isResolvableInScope(pathInfo);

      const asyncContext = stmt.async;

      if (lookupScopes) {
        assert(original.length);

        // eslint-disable-next-line no-plusplus
        for (const contextObject of [...contextList].reverse()) {
          const contextKeys = Object.keys(contextObject);

          const rootQualifierIndex = contextKeys.indexOf(rootQualifier);

          if (rootQualifierIndex >= 0) {
            contextKeys.splice(rootQualifierIndex, 1);
          }

          for (const k of contextKeys) {
            const v = contextObject[k];

            if (hasObjectPrefix({
              stmt,
              value: original,
              key: k,
              rangeAllowed: !!v.lookup,
            })
            ) {
              if (!contextObject[rootQualifier]) {
                // {original} resolved to a qualifier that exists in a custom context 

                if (v.asVariable) {

                  const suffix = getSuffix(original);

                  resetPathExpression({
                    stmt,
                    original: `@${v.contextId ? `${v.contextId}${suffix ? `.${suffix}` : ''}` : `${original}`}`,
                    properties: {
                      processed: true,
                    },
                  });

                } else {
                  // {original} is either of the following:
                  // 1. a scope or index qualifier for a deferred block, in which case it will
                  // be processed later.
                  // 2. an index qualifier for an #each block, in which case it will be resolved 
                  // at runtime from the "blockParams" object
                  // 3. an "iterate" data variable, in which case it will be resolved at runtime 
                  // from the "data" object
                }

                return stmt;
              }

              if (!allowRootAccess()) {
                throwCannotAccessRestrictedPath(v.value, stmt);
              }

              if (asyncContext && contextObject[rootQualifier].inIterateContext) {
                throwCannotAccessIterateContextInAsync(v.value, stmt.original, stmt);
              }

              if (v.variable) {
                const suffix = getSuffix(original);

                assert(v.contextId);

                resetPathExpression({
                  stmt,
                  original: `@${v.contextId}${suffix ? `.${suffix}` : ''}`,
                  properties: {
                    processed: true,
                  },
                });

              } else if (v.type.endsWith('Literal')) {
                assert(k === original && v.lookup === false);

                resetPathExpression({
                  stmt,
                  original: toPathExpressionLiteral(v.value),
                  properties: {
                    processed: true,
                  },
                });

              } else if (v.synthetic) {

                original = this.resolveSyntheticContext({
                  ctx: v,
                  suffix: getSuffix(
                    this.component.processLiteralSegment({ original })
                  ),
                  stmt
                }).original;

                resetPathExpression({
                  stmt,
                  original,
                  properties: {
                    processed: true,
                  },
                });

                // At runtime - in the custom context, the invocation of synthetic methods is passed on to handlebars,
                // hence we need to register in <allowedPaths>, see wrapDataWithProxy(...)

                _this.allowedPaths.push(original);

              } else {

                original = appendSuffix(
                  v.value,
                  getSuffix(
                    this.component.processLiteralSegment({ original })
                      .split('.').join(pathSeparator)
                  ),
                  pathSeparator,
                );

                this.lookupRootPath({ stmt, original });

                original = invokeDataPathTransform(original, stmt);

                original = addRawDataPrefixToPath(original);

                resetPathExpression({
                  stmt,
                  original,
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

        // Since we are in the custom context, and contextObject is on the
        // root context, we expect that index should be less than contextList.length - 1
        assert(index < contextList.length - 1);

        const rootValue = contextObject[rootQualifier].value;

        if (!allowRootAccess()) {
          throwCannotAccessRestrictedPath(rootValue, stmt)
        }

        if (asyncContext && contextObject[rootQualifier].inIterateContext) {
          throwCannotAccessIterateContextInAsync(rootValue, stmt.original, stmt)
        }

        if (contextObject[rootQualifier].synthetic) {

          original = this.resolveSyntheticContext({
            ctx: contextObject[rootQualifier],
            suffix: this.component.processLiteralSegment({ original }),
            stmt
          }).original;

          // At runtime - in the custom context, the invocation of synthetic methods is passed on to handlebars,
          // hence we need to register in <allowedPaths>, see wrapDataWithProxy(...)

          _this.allowedPaths.push(original);

        } else {

          original = appendSuffix(
            rootValue,
            this.component.processLiteralSegment({ original })
              .split('.').join(pathSeparator),
            pathSeparator
          );

          if (original === dataPathRoot) {
            original += pathSeparator;
          }

          this.lookupRootPath({ stmt, original });

          original = invokeDataPathTransform(original, stmt);

          original = addRawDataPrefixToPath(original);
        }

        resetPathExpression({
          stmt,
          original,
          properties: {
            processed: true,
          },
        });
      }

      return stmt;
    };

    const acceptPathExpressionInRootCtx = ({ stmt }) => {

      const {
        toPathExpressionLiteral, invokeDataPathTransform, hasDataPathFormat, getTargetType, isLookupAllowed, getSampleValueForLiteralType,
      } = TemplatePreprocessor;

      if (stmt.processed) {
        return stmt;
      }

      let { type, original } = stmt;

      let synthetic = false;
      let lookup;
      let targetType;

      if (this.methodNames.includes(original)) {
        original = this.createSubExpression({
          bindParents,
          contextList,
          method: original,
          // Note: We are not passing in stmt here becuase, it's not necessary, since we already
          // calling resetPathExpression(...) below
        });
        synthetic = true;

        const value = this.getSyntheticMethodValue({
          stmt,
          source: stmt.original,
          method: original,
        });

        targetType = getTargetType(value);
        lookup = isLookupAllowed(targetType);
      } else {
        const path = _this.resolvePath({
          bindParents,
          contextList,
          stmt,
          value: stmt,
          create: !stmt.immutable,
          validType: stmt.validType,
        });

        if (path) {
          type = path.type;
          original = path.original;
          synthetic = path.synthetic;
          targetType = path.targetType;

          if (isLookupAllowed(path.targetType)) {
            lookup = true;
          }

        } else {
          type = null;
        }
      }

      switch (true) {
        case type === 'PathExpression':
          return resetPathExpression({
            stmt,
            original: hasDataPathFormat(original) ? invokeDataPathTransform(original, stmt) : original,
            properties: {
              type,
              synthetic,
              lookup,
              processed: true,
              isResolvedPath: !!stmt.isResolvedPath,
              targetType,
            },
          });
        case type && type.endsWith('Literal'):
          return {
            ...createPathExpression({
              original: toPathExpressionLiteral(original),
            }),
            literalType: type,
            loc: stmt.loc,
            lookup: false,
            processed: true,
          };
        default:
          return stmt;
      }
    };

    const visitProcessedBlock = function ({ stmt }) {

      const hasContextList = !!stmt.contextObject;
      const hasCustomBlockCtx = !!stmt.customBlockCtx;

      if (hasContextList) {
        registerContext(stmt.contextObject, stmt);
      }

      if (hasCustomBlockCtx) {
        customBlockCtx.push(stmt.customBlockCtx);
      }

      bindParents.push({
        type: stmt.type,
        original: stmt.path.original,
        body: stmt.program.body,
        parent: utils.peek(bindParents),
        loc: stmt.program.loc,
        index: bindParents.length,
      });

      this.acceptKey(stmt, 'program');

      pruneScopeVariables();

      bindParents.pop();

      if (hasCustomBlockCtx) {
        customBlockCtx.pop();
      }

      if (hasContextList) {
        contextList.pop();
      }

      if (stmt.inverse) {
        bindParents.push({
          type: stmt.type,
          body: stmt.inverse.body,
          parent: utils.peek(bindParents),
          loc: stmt.inverse.loc,
          index: bindParents.length,
        });
        this.acceptKey(stmt, 'inverse');

        pruneScopeVariables();

        bindParents.pop();
      }

      return stmt;
    };

    const visitDeferredBlock = function ({ stmt }) {
      const { getHandleBarsBlockHelpers } = TemplatePreprocessor;

      const { original } = stmt.path;

      const custom = !getHandleBarsBlockHelpers().includes(original);
      const contextSwitching = custom || getContextSwitchingHelpers().includes(original);

      if (contextSwitching) {
        const { scopeQualifier, indexQualifier } = _this.getBlockQualifiers({ stmt });

        // Add a provisional context object
        const contextObject = {};
        contextObject[scopeQualifier] = { lookup: true, scope: true };

        if (indexQualifier) {
          contextObject[indexQualifier] = { lookup: false };
        }

        registerContext(contextObject, stmt);
      }

      if (custom) {
        customBlockCtx.push({
          value: true,
          allowRootAccess: allowRootAccess({ stmt }),
        });
      }

      bindParents.push({
        type: stmt.type,
        original: stmt.path.original,
        body: stmt.program.body,
        parent: utils.peek(bindParents),
        loc: stmt.program.loc,
        index: bindParents.length,
      });

      this.acceptKey(stmt, 'program');

      pruneScopeVariables();

      bindParents.pop();

      if (custom) {
        customBlockCtx.pop();
      }

      if (contextSwitching) {
        contextList.pop();
      }

      if (stmt.inverse) {
        bindParents.push({
          type: stmt.type,
          body: stmt.inverse.body,
          parent: utils.peek(bindParents),
          loc: stmt.inverse.loc,
          index: bindParents.length,
        });
        this.acceptKey(stmt, 'inverse');

        pruneScopeVariables();

        bindParents.pop();
      }

      return stmt;
    };

    const toCanonical = (original) => {

      assert(!isCustomContext());

      let isRoot = true;
      for (const contextObject of contextList) {
        if (contextObject[rootQualifier].ctxSwitching) {
          isRoot = false;
          break;
        }
      }
      return isRoot ? `${dataPathRoot}.${original}` : original;
    };

    const validateHash = ({ stmt, reservedKeys = [], ensureWordKeys }) => {
      const { wordPattern } = TemplatePreprocessor;
      (stmt.hash || { pairs: [] }).pairs
        .forEach((pair) => {
          if (reservedKeys.includes(pair.key)) {
            throwError(
              `Hashkey "${pair.key}" is reserved and cannot be used in this ${stmt.type}`, stmt
            );
          }
          if (ensureWordKeys && !pair.key.match(wordPattern)) {
            throwError(`Expected hash key "${key}" to be a word`, stmt);
          }
        });
    };

    const markPathExpressionsAsAsync = (ast) => {
      visitNodes({
        types: ['PathExpression'],
        ast,
        // eslint-disable-next-line no-shadow
        consumer: ({ stmt }) => {
          if (!this.methodNames.includes(stmt.original)) {
            stmt.async = true;
          }
        },
      });
    }

    const getHeaders = (stmt) => {
      const { params, hash } = stmt;

      return [
        ...params,
        ...hash ? hash.pairs.map(({ value }) => value) : []
      ]
        // Remove already processed params
        .filter(({ processed }) => !processed)
        // Remove Literals
        .filter(({ type }) => !type.endsWith('Literal'));
    }

    streamTokenizer
      .on('data', (tokens) => {
        tokenList = tokenList.concat(tokens);
      });

    ASTParser.prototype.ContentStatement = function (stmt) {
      streamTokenizer.write(stmt.original);
    }

    ASTParser.prototype.PathExpression = function (stmt) {
      this.mutating = true;

      const fn = isCustomContext() ? acceptPathExpressionInCustomCtx
        : acceptPathExpressionInRootCtx;

      return fn({
        stmt,
        visitor: this,
      });
    };

    ASTParser.prototype.SubExpression = function (stmt) {

      const { resolveMustacheInCustomHelperName, isRootCtxValue, getTargetType, isLookupAllowed } = TemplatePreprocessor;

      if (stmt.path.type.endsWith('Literal')) {
        // If path is a Literal, convert to PathExpression
        _this.resetPathExpression({ stmt: stmt.path, original: stmt.path.original });
      }

      this.mutating = true;

      if (isCustomContext()) {

        _this.validateMethod(stmt.path.original);

        const headers = getHeaders(stmt);

        this.acceptArray(headers);

        headers.forEach(({ type, original }) => {
          if (type === 'PathExpression' && isRootCtxValue(original)) {
            _this.allowedPaths.push(original);
          }
        });

        if (!stmt.fromMustache) {

          // Note: We use the 'synthetic' property in this context  to indicate that the SubExpression's 
          // path has been transformed
          if (!stmt.synthetic) {

            // eslint-disable-next-line no-shadow
            const ast = getCustomContextInvokeFunction({ stmt });

            _this.componentAst.body[0].body.body
              .push(
                getMethodFromFunctionDeclaration({
                  ast,
                  // Note: options retrieval statements were already added in getCustomContextInvokeFunction(...) above
                  addOptionsRetrievalStatements: false,
                })
              );

            const synthethicMethodName = ast.id.name;

            _this.helpers.push(synthethicMethodName);

            stmt.path = createPathExpression({ original: synthethicMethodName });

            stmt.synthetic = true;
          }
        } else {
          assert(stmt.path.original == resolveMustacheInCustomHelperName);
        }

      } else {

        _this.createSubExpression({
          bindParents,
          contextList,
          stmt,
          method: stmt.path.original,
          params: stmt.params || [],
          hash: stmt.hash,
        });

        if (stmt.type === 'PathExpression') {
          assert(stmt.processed);

          // For the root context, we want to invoke the function,
          // only when the SubExpression has been fully processed

          stmt.synthetic = true;

          const value = _this.getSyntheticMethodValue({
            stmt,
            source: stmt.canonicalSource,
            method: stmt.original,
            line: getLine(stmt),
          });

          stmt.targetType = getTargetType(value);
          stmt.lookup = isLookupAllowed(stmt.targetType);
        }
      }

      return stmt;
    };

    ASTParser.prototype.BlockStatement = function (stmt) {

      const {
        globalsBasePath, getPathFromSyntheticAlias, getChildPathFromSyntheticAlias, getTargetType, isLookupAllowed,
        throwError, addBlockParamHashKey, getIterateDataVariables, invokeDataPathTransform, isRootCtxValue,
        getReservedBlockHashKeys, getLine, getBlockSource,
      } = TemplatePreprocessor;

      const {
        blockName,
        validType,
        contextSwitching,
        scopeQualifier,
        indexQualifier,
        canIterate,
        conditional,
        custom,
      } = stmt.processed ? {} : _this.getBlockOptions(stmt);

      // Validate transform, if provided
      getTransform({ stmt });

      const hook = getHook({ stmt });
      const async = isAsync({ stmt });

      const htmlWrapperErrors = [];
      let nestedPrograms;

      if (hook) {
        htmlWrapperErrors.push('A hook cannot be specified for this block due to invalid html markup');
      }

      const addCustomBlockCtx = () => {

        if (stmt.contextObject) {
          customBlockCtx.push(stmt.customBlockCtx);
          registerContext(stmt.contextObject, stmt);

          return;
        }

        validateHash({ stmt, reservedKeys: getReservedBlockHashKeys() });

        _this.validateCustomBlock({ stmt });

        if (async) {

          if (!getClosestAsyncCustomContext()) {
            markPathExpressionsAsAsync(stmt.program);
          }

          htmlWrapperErrors.push('Block must be wrapped in an html wrapper inorder to be marked as "async". Does the block contain valid html markup?');
        }

        stmt.customBlockCtx = {
          value: true,
          allowRootAccess: allowRootAccess({ stmt }),
          async,
          method: stmt.path.original,
        };

        customBlockCtx.push(stmt.customBlockCtx);

        if (htmlWrapperErrors.length) {

          // This block needs to be wrapped in a html wrapper, hence we need to pre-emptively set <syntheticNodeId> to true, so that the
          // necessary js code can be generated with the assumption that a wrapper will be created later. If after block processing, we
          // we find that this block contains invalid html markup, the errors in <htmlWrapperErrors> will be emitted

          stmt.syntheticNodeId = true;
        }

        _this.updateCustomBlockPath({ stmt, isCustomContext: isCustomContext() });

        const contextObj = {};

        contextObj[scopeQualifier] = {
          lookup: true,
          asVariable: true,
          scope: true,
        };

        if (stmt.hash) {
          for (const pair of stmt.hash.pairs) {
            contextObj[pair.key] = {
              lookup: !pair.value.type.endsWith('Literal'),
              asVariable: true,
            };
          }
        }

        const contextId = registerContext(contextObj, stmt, true);

        addBlockParamHashKey(stmt, contextId);
        delete stmt.program.blockParams;

        stmt.customBlockCtx.contextId = contextId;

        stmt.contextObject = contextObj;
      };

      const processBlockInCustomCtx = () => {

        let hasContextList = false;
        let hasCustomBlockCtx = false;

        const headers = getHeaders(stmt);

        this.acceptArray(headers);

        headers.forEach(({ type, original }) => {
          if (type === 'PathExpression' && isRootCtxValue(original)) {
            _this.allowedPaths.push(original);
          }
        });

        switch (true) {
          case custom:
            addCustomBlockCtx();

            hasCustomBlockCtx = true;
            hasContextList = true;

            break;

          case contextSwitching:
            const contextObj = {};

            contextObj[scopeQualifier] = {
              lookup: true,
              scope: true,
              asVariable: true,
            };

            if (indexQualifier) {
              contextObj[indexQualifier] = {
                lookup: false,
                // At runtime, index qualifiers are resolved as blockParams, hence they 
                // must be unique in the scope
                unique: true,
              };
            }

            if (canIterate) {

              getIterateDataVariables().forEach(v => {
                contextObj[v] = {
                  lookup: false,
                };
              })

              // Note: <stmt.program.blockParams> must not be pruned, so that expressions inside
              // the program can resolve the index qualifier

            } else {
              delete stmt.program.blockParams;
            }

            const contextId = registerContext(contextObj, stmt, true);

            addBlockParamHashKey(stmt, contextId);

            hasContextList = true;

            break;
        }

        const parent = {
          type: stmt.type,
          original: stmt.path.original,
          body: stmt.program.body,
          parent: utils.peek(bindParents),
          loc: stmt.program.loc,
          index: bindParents.length,
        };

        bindParents.push(parent);

        this.acceptKey(stmt, 'program');

        nestedPrograms = parent.nestedPrograms;

        pruneScopeVariables();

        bindParents.pop();

        if (hasContextList) {
          contextList.pop();
        }

        if (hasCustomBlockCtx) {
          customBlockCtx.pop();
        }

        if (stmt.inverse) {
          bindParents.push({
            type: stmt.type,
            body: stmt.inverse.body,
            parent: utils.peek(bindParents),
            loc: stmt.inverse.loc,
            index: bindParents.length,
          });
          this.acceptKey(stmt, 'inverse');

          pruneScopeVariables();

          bindParents.pop();
        }
      }

      const processBlockInRootCtx = () => {
        if (stmt.partialSkip) {
          return;
        }

        if (stmt.processed) {
          visitProcessedBlock.bind(this)({ stmt });
          return;
        }

        const createSyntheticAlias = () => {
          return `${blockName}${syntheticAliasSeparator}${utils.generateRandomString()}`;
        }

        // eslint-disable-next-line no-shadow
        const resolvePathParam = ({ stmt }) => {

          let isSynthetic = stmt.type === 'SubExpression'
            || (stmt.type === 'PathExpression' && _this.methodNames.includes(stmt.original));

          let path, syntheticAlias, canonicalSource;

          if (isSynthetic) {

            canonicalSource = stmt.canonicalSource || stringifyHandlebarsNode(stmt);

            if (contextSwitching) {
              syntheticAlias = createSyntheticAlias();
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
                stmt,
              }),
            };

            if (path.original === false) {
              return false;
            }

            // Notice that if this is a contextSwitching statement,
            // setSyntheticContext(..) is called
            const value = _this.getSyntheticMethodValue({
              stmt,
              source: canonicalSource,
              method: path.original,
              validType,
              line: getLine(stmt),
              // Todo: remove
              // rewriteErrorMsg: !syntheticAlias,
            });

            path.targetType = getTargetType(value);
          } else {

            const _syntheticAlias = contextSwitching ?
              // We need to create a placeholder <syntheticAlias> which will be used by resolvePath(...)
              // if this resolves to a synthetic path
              createSyntheticAlias() :
              null;

            path = _this.resolvePath({
              bindParents,
              stmt,
              contextList,
              value: stmt,
              validType,
              syntheticAlias: _syntheticAlias,
            });

            if (path.terminate) {
              return false;
            }

            isSynthetic = path.synthetic;

            if (isSynthetic && contextSwitching) {
              syntheticAlias = _syntheticAlias;
              canonicalSource = path.canonicalSource;

              assert(canonicalSource);
            }
          }

          let { type, original, targetType } = path;

          if (contextSwitching) {

            const globalVariablePrefix = [dataPathRoot, globalsBasePath, ''].join(pathSeparator);

            if (original.startsWith(globalVariablePrefix)) {
              const first = original.replace(globalVariablePrefix, '').split(pathSeparator)[0];

              // Todo: Implement a polyfill for this, for example, we can update this param to point to a
              // dynamically generated synthetic function that returns, and then re-invoke resolvePathParam.
              // Since we have the types declared in getGlobalVariableTypes(), we can call getSampleValueForType(...)
              // to generate the sample for the test.js file

              // Only well-known schema properties/synthetic invocation may be the target of a context-switching block
              throwError(
                `"${stmt.original}" references a global variable "${first}", which is not allowed for a context-switching block`,
                stmt
              );
            }

            assert(isLookupAllowed(targetType));

            if (isSynthetic) {
              // Ensure that the methodName was generated from <syntheticAlias>. This is necessary because
              // the forEach(...) helper re-constructs the syntheticAlias from the <path>
              // see RootCtxRenderer.getSyntheticAliasFromPath(...)
              assert(original == `${syntheticMethodPrefix}${getPathFromSyntheticAlias(syntheticAlias)}`);
            }

            // This check is necessary because it's possible for a
            // block to have a path expression as it's target, and it
            // then resolves to a Literal.
            if (type !== 'PathExpression') {
              throwError(
                `A ${type} cannot be the target of the ${blockName} block`, stmt,
              );
            }
          }

          // Update stmt

          if (type === 'PathExpression') {

            let _original = original;

            if (!isSynthetic) {
              _original = invokeDataPathTransform(_original, stmt);
            }

            if (custom) {
              // When processing param(s) of a custom block, we want to return the underlying object, 
              // rather than our proxy
              _original = addRawDataPrefixToPath0(_original);
            } else {
              // For #with, #else, #if, #unless, we want to deliver the param value to the helper in 
              // the format {path, value}. 

              // For non-context switching blocks, i.e. conditional blocks, we are also appending ! so 
              // that the underlying value will be returned, not our proxy
              _original = `${_original}!${conditional ? '!' : ''}`;
            }

            _this.allowedPaths.push(_original);

            resetPathExpression({
              stmt,
              original: toCanonical(_original),
              properties: {
                processed: true,
              },
            });

          } else {
            assert(type.endsWith('Literal'));

            utils.clear(stmt);

            // Note: loc object not needed since this is not a top-level node
            stmt.type = type;
            stmt.value = original;
          }

          return {
            isSynthetic, syntheticAlias, type, original, targetType, canonicalSource,
          };
        };

        let hasInlineParam = false;

        let resolvedPath;

        for (const path of getHeaders(stmt)) {
          resolvedPath = resolvePathParam({ stmt: path });

          if (!resolvedPath) {
            // As you can imagine, there are scenarios when a block
            // may not itself declare any inline parameters as part of
            // it's own parameter list, but becuase it reference a block
            hasInlineParam = true;
          }
        }

        if (hasInlineParam) {
          return visitDeferredBlock.bind(this)({ stmt });
        }

        let {
          isSynthetic, syntheticAlias, type, original, targetType, canonicalSource,
        } = (
            resolvedPath
            // Note: resolvedPath will be undefined if this is a #if, #unless or
            // custom block and all param(s) are literal types
            || {}
          );

        const { logicGate, logicGatePruneKey } = stmt;

        if (logicGate && logicGate.participants.length) {
          const original = addLogicGate({
            ...stmt,
            logicGate,
            logicGatePruneKey,
          });

          // Remove the last entry which is synthetic-based
          _this.allowedPaths.pop();

          _this.allowedPaths.push(`${original}!!`);

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

          if (canIterate) {

            const path = original.replace(`${dataPathRoot}${pathSeparator}`, '');

            const parent = utils.peek(bindParents);

            const { customEachHelperName, getIterateDataVariables } = TemplatePreprocessor;

            const doBlockInitMethod = _this.createIterateInit({
              path: syntheticAlias || path,
            });

            const doBlockUpdateMethod = _this.createIterateUpdate({
              path: syntheticAlias || path,
            });

            const doBlockNextMethod = _this.createIterateNext({
              path: syntheticAlias || path,
            });

            const doBlockFinalizeMethod = _this.createIterateFinalize({
              path: syntheticAlias || path,
            });

            const headLoc = {
              ...stmt.loc,
              start: stmt.loc.start,
              end: stmt.loc.start,
            };

            const tailLoc = {
              ...stmt.loc,
              start: stmt.loc.end,
              end: stmt.loc.end,
            };

            // At the top of the #each block, invoke doBlockInit(..)
            replacements.push({
              parent: parent.body,
              replacementIndex: parent.body.indexOf(stmt),
              replacementNodes: [
                {
                  ...createMustacheStatement({
                    original: doBlockInitMethod,
                    loc: headLoc,
                  }),
                  synthetic: true,
                },
              ],
            });

            // At the top of the #each body, doBlockUpdate(..)
            stmt.program.body.unshift({
              ...createMustacheStatement({
                original: doBlockUpdateMethod,
                loc: headLoc,
              }),
              synthetic: true,
            });

            // At the bottom of the #each body, doBlockNext(..)
            stmt.program.body.push({
              ...createMustacheStatement({
                original: doBlockNextMethod,
                loc: tailLoc,
              }),
              synthetic: true,
            });

            // At the bottom of the #each block, invoke doBlockFinalize(..)
            replacements.push({
              parent: parent.body,
              replacementIndex: parent.body.indexOf(stmt) + 1,
              replacementNodes: [{
                ...createMustacheStatement({
                  original: doBlockFinalizeMethod,
                  loc: tailLoc,
                }),
                synthetic: true,
              }],
            });

            stmt.path = createPathExpression({
              original: customEachHelperName,
            });

            _this.serializeAst();

            // Trigger <doBlockInitMethod> and <doBlockUpdateMethod> to initialize blockData and set 
            // index to 0. Here are the reasons why triggering these methods is required:
            // 1. In a data context, the rootProxy need to resolve paths embedded in synthetic functions,
            // and these paths use blockData to resolve "_$"
            // 2. In a synthetic context, data variables are computed using blockData  
            // (see createIterateDataVariable(...)).

            _this.component[doBlockInitMethod]();
            _this.component[doBlockUpdateMethod]();

            // Register data variables in contextObject 

            const dataVariables = {}

            getIterateDataVariables().forEach(name => {
              dataVariables[name] = name;
            });

            // Todo: Update <dataVariables>, to add data variable aliases  e.g. ("i" = "@index"),
            // so that the developer can do @i as shortform to @index - but don't forget to register
            // any new dataVariables in getDataVariables() else getPathInfo(...) will not recognize it

            // Register index qualifier
            if (indexQualifier) {
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

          if (isSynthetic) {
            const methodName = getChildPathFromSyntheticAlias(syntheticAlias);

            original = _this.wrapExpressionAsMethod({
              name: methodName,
              returnExpression: getCallExpression({
                methodName: 'getSyntheticContext',
                args: [{
                  alias: syntheticAlias,
                  key: 'current',
                }]
                  .map(getValue, _this),
              }),
            });

            // We need to serialize, so that sub-paths can properly resolve

            _this.serializeAst();
          }

          original += (isSynthetic || !canIterate) ? original.endsWith('_$') ? '' : '_@' : '_$';

          // Add scope qualifier
          if (scopeQualifier) {
            contextObject[scopeQualifier] = {
              type,
              value: original,
              lookup: true,
              scope: true,
              synthetic: !!syntheticAlias,
              canonicalSource,
              targetType,
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
            synthetic: !!syntheticAlias,
            canonicalSource,
            targetType,
          };

          registerContext(contextObject, stmt);

          stmt.contextObject = contextObject;
        }

        if (custom) {
          addCustomBlockCtx();
        }

        const parent = {
          type: stmt.type,
          original: stmt.path.original,
          body: stmt.program.body,
          parent: utils.peek(bindParents),
          loc: stmt.program.loc,
          index: bindParents.length,
        };

        bindParents.push(parent);

        this.acceptKey(stmt, 'program');

        nestedPrograms = parent.nestedPrograms;

        pruneScopeVariables();

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
            loc: stmt.inverse.loc,
            index: bindParents.length,
          });
          this.acceptKey(stmt, 'inverse');

          pruneScopeVariables();

          bindParents.pop();
        }

        if (conditional) {
          const { conditionalHelperName } = TemplatePreprocessor;

          const invert = stmt.path.original === 'unless';

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

        // Block params are no longer useful at this point
        delete stmt.program.blockParams;

        stmt.processed = true;
      }

      const containsHtmlError = () => {

        // It is important to note that some errorneous markup that exists 
        // inside this block may not be detected until the full template string is validated
        // This is because of contextual reason. See below example
        // <ul>
        //   {{#each}}
        //     [markup_that_is_not_allowed_as_child_of_ul]
        //     <li><li>
        //   {{/each}}
        // </ul>

        const htmlErrors = [];

        _this.getW3cHtmlErrors(
          getBlockSource(_this.templateSrc, stmt),
          stmt.loc.source,
          htmlErrors,
        );

        if (nestedPrograms) {
          Object.entries(nestedPrograms).forEach(([locSource, templateSource]) => {
            _this.getW3cHtmlErrors(
              templateSource,
              locSource,
              htmlErrors,
            );
          });
        }

        if (htmlErrors.length) {

          htmlErrors.forEach(({ message }) => {

            const knownW3cErrors = _this.htmlConfig.knownW3cErrors || (_this.htmlConfig.knownW3cErrors = []);

            if (!knownW3cErrors.includes(message)) {

              // Add this error message to a list of well known messages, so that when the full
              // template String is being validated, these messages will be skipped.
              knownW3cErrors.push(message);

              if (_this.canPrintHtmlWarnings()) {
                _this.logger.warn(message);
              }
            }
          });

          _this.logger.warn(`[${getLine(stmt)}] Disabled data-binding for #${stmt.path.original} block`);

          if (htmlWrapperErrors.length) {
            // A wrapper is required for this block, throw error

            htmlWrapperErrors.forEach(err => {
              _this.logger.error(`[${getLine(stmt)}] ${err}`);
            });

            throwError(`Errors were found on #${blockName} block`, stmt);
          }

          return true;
        }

        return false;
      }

      if (isCustomContext()) {
        processBlockInCustomCtx();
      } else {
        processBlockInRootCtx();
      }

      if (!stmt.visited) {

        // If this block is inside an inline block, update <blockQualifiers>
        const inlineBlock = getOuterInlineBlock({ bindParents });

        if (inlineBlock) {
          const arr = inlineBlock.blockQualifiers || (inlineBlock.blockQualifiers = []);
          arr.push(scopeQualifier);

          if (indexQualifier) {
            arr.push(indexQualifier);
          }
        }

        if ((!isCustomContext() || htmlWrapperErrors.length) && !containsHtmlError()) {

          stmt.forceHtmlWrapper = !!htmlWrapperErrors.length;
          stmt.createHtmlWrapper = true;
        }

        stmt.visited = true;
      }

      this.mutating = true;

      return stmt;
    };

    const processComponentImport = ({ stmt }) => {

      const { createStringLiteral } = TemplatePreprocessor;
      const { componentRefType } = PathResolver;

      const defaultComponentName = BaseComponent.name;

      let alias = getHashValue({
        stmt, key: 'alias', type: 'StringLiteral', cleanup: false,
      });

      if (!alias) {
        this.throwError(`Component import - Provide an alias`, stmt);
      }

      alias = alias.original;

      if (!stmt.params.length) {
        stmt.params = [createStringLiteral(defaultComponentName)];
      }

      if (stmt.params.length !== 1 || !alias) {
        this.throwError(`Component import - Incorrect signature`, stmt);
      }

      // The alias should not be a component name
      if (this.getComponentClass(alias)) {
        this.throwError(`Component name "${alias}" cannot be used as an alias`, stmt);
      }










      const className = stmt.params[0].original;

      if (className != defaultComponentName) {

        // Attempt to load component class. The idea here is that we want a fail fast behaviour
        // eslint-disable-next-line no-unused-expressions
        this.getComponentClass(className);
      }

      const { type, original, synthetic, targetValue, terminate } = this.resolvePath({
        value: {
          type: 'PathExpression',
          original: alias,
        },
        contextList,
        bindParents,
        validType: componentRefType,
        nameQualifier: className,
      });

      if (terminate) {
        return stmt;
      }

      if (synthetic) {
        throwError(`The alias in a ComponentImport statement must resolve to a data path`, stmt);
      }

      if (original.startsWith(syntheticMethodPrefix)) {
        throwError(`ComponentImport statement cannot exist in a synthetic context`, stmt);
      }

      return false;
    };

    const getMetaPaths = () => {
      const { componentImportPath, variableHelperName, fnHelperName } = TemplatePreprocessor;
      return [componentImportPath, variableHelperName, fnHelperName];
    };

    const processMetaStatement = function ({ stmt }) {

      const {
        componentImportPath, variableHelperName, fnHelperName, throwError, createStringLiteral, toParts,
      } = TemplatePreprocessor;

      // eslint-disable-next-line default-case
      switch (stmt.path.original) {

        case componentImportPath:
          if (isCustomContext()) {
            throwError(`Component imports are not allowed within a custom context`, stmt);
          }
          return processComponentImport({ stmt });

        case fnHelperName:
          (() => {
            const globalHelpers = _this.metadata.globalHelpers || (_this.metadata.globalHelpers = []);
            const { type, original } = (stmt.params[0] || {});

            assert(
              !!stmt.params.length &&
              type == 'StringLiteral' &&
              _this.methodNames.includes(original),
              `Unknown methodName: "${original}", line ${getLine(stmt)}`
            );

            globalHelpers.push(original);
          })();

          stmt.path.processed = true;
          return stmt;

        case variableHelperName:

          (() => {
            const contextIdHashKeyPrefix = '--ctx_id-';

            const createContextId = (key) => {
              const contextId = utils.generateRandomString();

              const { pairs } = stmt.hash;

              const targetPair = pairs.filter(({ key: k }) => k == key)[0];

              pairs.push({
                type: 'HashPair',
                key: `${contextIdHashKeyPrefix}${key}`,
                value: {
                  ...createStringLiteral(contextId),
                  loc: targetPair.loc,
                },
                synthetic: true,
                loc: targetPair.loc,
              })

              targetPair.contextId = contextId;

              return contextId;
            }

            const _contextObject = {};
            const ctxIndex = contextList.length - 1;

            const hash = stmt.hash || (stmt.hash = { type: 'Hash', pairs: [] });

            const hashPairs = getHashPairs(hash)
              .filter(({ synthetic }) => !synthetic);

            addHashesToContext.bind(this)({ hashPairs, contextObject: _contextObject, ctxIndex });

            const contextObject = utils.peek(contextList);

            hashPairs
              .forEach((pair) => {
                let { key, value, contextId } = pair;

                if (key.startsWith(contextIdHashKeyPrefix)) {
                  throwError(
                    `Hashkey "${key}" is a reserved keyword and cannot be used as a variable name`,
                    pair
                  );
                }

                if (!contextId) {
                  contextId = createContextId(key);
                }

                const parent = utils.peek(bindParents);

                const prev = contextObject[key];

                const varInfo = { parentIndex: parent.index };

                if (isCustomContext()) {
                  contextObject[key] = { ..._contextObject[key], contextId, varInfo };
                } else {

                  if (value.processed) {

                    const ctx = _contextObject[key];

                    if (getOuterInlineBlock({ bindParents }) == null) {
                      if (ctx.type == 'PathExpression') {

                        value.original = toCanonical(`${ctx.value}!!`);
                        value.parts = toParts(value.original);

                      } else {
                        // This PathExpression resolved to a literal
                        assert(ctx.type.endsWith('Literal'));

                        utils.clear(value);

                        value.type = ctx.type;
                        value.value = ctx.value;
                        value.original = ctx.value;
                      }
                    }

                    contextObject[key] = { ..._contextObject[key], varInfo };

                  } else {

                    contextObject[key] = {
                      variable: true, lookup: true, contextId, varInfo
                    }
                  }
                }

                // Register variable on parent so that they will be pruned after block processing.
                (parent.scopeVariables || (parent.scopeVariables = []))
                  .push({ key, prev });
              });
          })();

          return stmt;
      }
    };

    const pruneScopeVariables = () => {

      const parent = utils.peek(bindParents);
      const contextObject = utils.peek(contextList);

      const { scopeVariables, index } = parent;

      if (scopeVariables) {
        [...scopeVariables].reverse()
          .forEach(({ key, prev }) => {
            delete contextObject[key];

            if (prev && (!prev.varInfo || prev.varInfo.parentIndex < index)) {
              contextObject[key] = prev;
            }
          });
      }
    }

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
          case global.clientUtils.isNumber(item):
            return {
              type: 'LogicGate',
              original: item,
            };
          case item.type == 'MustacheGroup':
            return {
              type: item.type, items: item.items.map(getValue),
            }
          default:
            assert(item.type == 'PathExpression' || item.type.endsWith('Literal'));
            return {
              type: item.type, original: item.original,
            }
        }
      };

      const participants = [];

      logicGate.participants
        .forEach((participant) => {
          const { original, processed } = participant;

          assert(processed)

          if (!hasDataPathFormat(original)) {
            // It is likely that this participant was a variable that referenced a subexpression
            return;
          }

          const _original = original.replace(/\?$/g, '');

          if (!participants.includes(_original)) {
            participants.push(_original);
          }
        });

      logicGate.participants = participants;

      logicGate.table = logicGate.table.map((item) => {
        item.condition = item.condition.map(getValue);

        item.left = getValue(item.left);
        item.right = getValue(item.right);

        return item;
      });

      logicGate.loc = { ...stmt.loc };

      const gateId = utils.generateRandomString();
      this.logicGates[gateId] = logicGate;

      return `${logicGatePathRoot}${pathSeparator}${gateId}`;
    };
    ASTParser.prototype.MustacheStatement = function (stmt) {
      if (stmt.path.processed) {
        return;
      }

      const { loadComponentHelperName, getReservedMustacheHashKeys } = TemplatePreprocessor;

      if (stmt.path.type != 'PathExpression') {
        throwError(
          `Only a PathExpression must be used as the path in a MustacheStatement`,
          stmt,
        );
      }

      validateHash({ stmt, reservedKeys: getReservedMustacheHashKeys() });

      const reservedMethodNames = [loadComponentHelperName];

      if (reservedMethodNames.includes(stmt.path.original) && !stmt.generated) {
        throwError(`Method name: ${stmt.path.original} is reserved`, stmt);
      }

      this.mutating = true;

      const isMetaPath = getMetaPaths().includes(stmt.path.original);
      const isSubExpression = _this.methodNames.includes(stmt.path.original);

      stmt.escaped = isEscaped({ stmt });

      // Validate hook, if provided
      getHook({ stmt })

      // Validate transform, if provided
      getTransform({ stmt });

      if ((!isSubExpression) && !isMetaPath && (stmt.params.length)) {
        throwError(`Unkown method name: ${stmt.path.original}`, stmt);
      }

      if (isCustomContext()) {

        if (isMetaPath) {
          return processMetaStatement.bind(this)({ stmt });
        }

        const pruneLogicGateMetaData = () => {
          delete stmt.logicGate;
          delete stmt.logicGatePruneKey;

          delete stmt.prune;
          delete stmt.methodNameSuffix;

          // Todo: We may need to undo excludeSubExpressionsFromPrune(...). Initially the aformentioned function
          // was called specifically for the root context, and it's bad practice to keep it on custom context out
          // of complacency, because the property <prune> could evolve to mean something different in a custom context
        }

        const wrapInResolveMustacheHelper = () => {
          const { resolveMustacheInCustomHelperName } = TemplatePreprocessor;

          return {
            ...createMustacheStatement({
              original: resolveMustacheInCustomHelperName,
              params: [
                isSubExpression ?
                  {
                    ...createSubExpressionFromPath({ stmt: stmt.path }),
                    params: stmt.params,
                    hash: stmt.hash,
                  } :
                  stmt.path,
              ],
              hash: stmt.hash,
              loc: stmt.loc,
            }),
            fromMustache: true,
            createHtmlWrapper: true,
          };
        }

        if (!stmt.visited) {

          if (isSubExpression) {
            pruneLogicGateMetaData();
          }

          stmt = wrapInResolveMustacheHelper();

          stmt.visited = true;
        }

        stmt.type = 'SubExpression';

        ASTParser.prototype.SubExpression.call(this, stmt);

        stmt.type = 'MustacheStatement';

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

      if (isMetaPath) {
        return processMetaStatement.bind(this)({ stmt });
      }

      const wrapInResolveMustacheHelper = (original, hash, loc) => {
        const { resolveMustacheInRootHelperName, literalPrefix } = TemplatePreprocessor;

        const isLiteral = original.includes(literalPrefix);

        if (!isLiteral) {
          original += '!!';
        }

        _this.allowedPaths.push(original);

        return {
          ...createMustacheStatement({
            original: resolveMustacheInRootHelperName,
            params: [
              {
                ...createPathExpression({
                  original: toCanonical(original),
                }),
                processed: true,
                loc,
              },
            ],
            hash,
            loc,
          }),
          createHtmlWrapper: true,
          dataBinding: !isLiteral,
        };
      }

      if (isSubExpression) {
        const { logicGate, logicGatePruneKey, hash, loc } = stmt;

        stmt.type = 'SubExpression';
        ASTParser.prototype.SubExpression.call(this, stmt);

        if (stmt.processed) {
          let { original } = stmt;

          if (logicGate && logicGate.participants.length) {
            original = addLogicGate({
              ...stmt,
              logicGate,
              logicGatePruneKey,
            });
          }

          // Before passing hash to wrapInResolveMustacheHelper(...), remove all hash pairs from 
          // stmt with processed=true
          if (hash) {
            hash.pairs = hash.pairs
              .filter(({ value }) => {
                assert(value.processed || value.type.endsWith('Literal'));
                return !value.processed;
              });
          }

          stmt = wrapInResolveMustacheHelper(original, hash, loc);

        } else {
          stmt.type = 'MustacheStatement';
        }
      } else {

        this.acceptKey(stmt, 'path');

        const { type, processed, original } = stmt.path;

        assert(type == 'PathExpression');

        if (processed) {
          stmt = wrapInResolveMustacheHelper(original, stmt.hash, stmt.loc);
        }
      }

      return stmt;
    };

    const getHashPairs = (hash) => hash ? hash.pairs.filter(({ generated }) => !generated) : [];

    // Note: These are generally expected to have boolean values
    const getPartialConfigHashKeys = () => {
      const { partialDeferHashKey } = TemplatePreprocessor;
      return [partialDeferHashKey];
    }

    const addHashesToContext = function ({ hashPairs, contextObject, ctxIndex }) {
      const { literalPathPrefixRegex, stringifyHandlebarsNode } = TemplatePreprocessor;

      const uniqueKeys = getUniqueContextKeys();

      const validateHashPair = ({ key, loc }) => {
        if (uniqueKeys.includes(key)) {
          throwError(`Hash key "${key}" cannot be used in this scope`, { loc });
        }
      }

      let b = true;

      if (isCustomContext()) {
        for (const pair of hashPairs) {
          validateHashPair(pair);

          if (!pair.value.type.endsWith('Literal')) {
            this.acceptRequired(pair, 'value');
          }

          const { type, canonicalSource } = pair.value;

          contextObject[pair.key] = {
            lookup: !type.endsWith('Literal'),
            asVariable: true,
            index: ctxIndex,
            canonicalSource: canonicalSource || stringifyHandlebarsNode(pair.value),
          };
        }
      } else {
        for (const pair of hashPairs) {
          validateHashPair(pair);

          const isLiteral = pair.value.type.endsWith('Literal');

          if (!isLiteral) {
            this.acceptRequired(pair, 'value');

            if (!pair.value.processed) {
              b = false;
            }
          }

          let {
            type, original, lookup, synthetic = false, canonicalSource,
            isResolvedPath, variable, contextId, literalType,
          } = pair.value;

          if (isLiteral) {
            lookup = false;

          } else if (original && original.match(literalPathPrefixRegex)) {
            assert(literalType);

            original = original.replace(literalPathPrefixRegex, '');
            type = literalType;

          } if (type === 'PathExpression' && isResolvedPath) {
            // By default PathExpressions will resolve to a Literal due to
            // the way that resolvePath(...) defaults <validType> to 'Literal'.
            // For paths that were directly resolved, set lookup to true
            // inorder to allow potential sub-path resolution

            lookup = true;
          }

          contextObject[pair.key] = {
            type, value: original, lookup, synthetic,
            index: ctxIndex, variable, contextId,
            canonicalSource: canonicalSource || stringifyHandlebarsNode(pair.value),
          };
        }
      }

      return b;
    }

    const getPartialHashPairs = function ({ stmt }) {
      return getHashPairs(stmt.hash)
        .filter(({ key }) => !getPartialConfigHashKeys().includes(key));
    }

    const getPartialContextList = function ({ stmt }) {

      const partialContextList = utils.deepClone(contextList);

      // Note: PartialStatements are not context switching nodes hence, we don't create any 
      // new context, but rather update the tail context

      const contextObject = utils.peek(partialContextList);

      const ctxIndex = partialContextList.length - 1;

      const hashPairs = getPartialHashPairs({ stmt });

      const fn = () => addHashesToContext.bind(this)({ hashPairs, contextObject, ctxIndex });

      if (isCustomContext()) {
        fn();

      } else {

        const contextObj = utils.peek(contextList);

        const b = fn();

        if (!contextObj[rootQualifier]) {
          // We are in a deffered block
          return false;
        }

        if (partialContextList.length > 1) {
          // Change what @root resolves to inside this partial
          partialContextList[0][rootQualifier]
            .declaredValue = contextObj[rootQualifier].value;
        }

        if (!b) {
          return false;
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

    const getPartial = ({ partialName, stmt }) => {

      const {
        partialBaseDirHashKey, partialBaseLocHashKey, runtimeDecoratorHashKey, eagerDecoratorHashKey, variableHelperName, visitNodes,
        createStringLiteral, getDecoratorParams, createLocSource, createAst0, getHashValue, registerProgram, throwError,
        getBlockSource,
      } = TemplatePreprocessor;

      if (stmt.name.type == 'SubExpression') {
        throwError(
          'Dynamic partials are not supported because their ast need to be transformed at compile-time',
          stmt
        );
      }

      let inline = false;
      // eslint-disable-next-line no-shadow
      let block;

      let templateSrc;

      const ensureBlockParamsAreAvailable = ({ requiredParams, optionalParams, blockName }) => {
        const { hash } = stmt;
        const hashKeys = hash.pairs.map(pair => pair.key);

        if (requiredParams) {
          // Ensure requiredParams are available on the hash array
          requiredParams.forEach((param) => {
            if (!hashKeys.includes(param)) {
              throwError(`The hash key: '${param}' is required to load inline block: ${blockName}`, stmt);
            }
          });
        }

        if (optionalParams) {
          // Default optionalParams that are not available on the hash array to null
          optionalParams.forEach((param) => {
            if (!hashKeys.includes(param)) {
              hash.pairs.push({
                key: param,
                value: {
                  type: 'UndefinedLiteral',
                }
              });
            }
          });
        }
      }

      const setPartialSourceInfo = (ast, dir, baseLoc) => {
        // Note: this assumes that no hash with the key <partialBaseDirHashKey> currently exists

        visitNodes({
          types: ['PartialStatement'],
          ast,
          // eslint-disable-next-line no-shadow
          consumer: ({ stmt }) => {
            const hash = stmt.hash || (stmt.hash = { type: 'Hash', pairs: [] });

            hash.pairs.unshift({
              type: 'HashPair',
              key: partialBaseDirHashKey,
              value: createStringLiteral(dir),
              generated: true,
            });

            hash.pairs.unshift({
              type: 'HashPair',
              key: partialBaseLocHashKey,
              value: createStringLiteral(baseLoc),
              generated: true,
            });
          },
        });
      }

      let found = true;

      (() => {

        // First, check inline blocks in the scope
        const inlineBlocks = getAvailableInlineBlocks({
          bindParents,
        });

        for (const blockName in inlineBlocks) {
          if (blockName != partialName) {
            continue;
          }

          block = inlineBlocks[blockName];

          const { requiredParams, optionalParams, templateSource, eager } = block;

          ensureBlockParamsAreAvailable({ requiredParams, optionalParams, blockName });

          templateSrc = templateSource;

          block.program = {
            ...utils.parseJson(block.program),
            // This program was already transformed at the same time the overall template program was transformed.
            transformed: true,
          };

          if (!block.program.programId) {
            registerProgram({
              locSource: _this.createOwnLocSource(blockName),
              templateSrc,
              program: block.program
            });
          }

          if (eager && [...requiredParams, ...optionalParams].length) {
            const decoratorParams = block.program.body[0];

            assert(decoratorParams.path.original == variableHelperName);

            decoratorParams.hash.pairs
              .filter(({ synthetic }) => !synthetic)
              .forEach(({ value }) => {
                assert(value.decoratorParameter);

                value.decoratorParameter = false;
              });
          }

          if (
            // This inline block is on the root context
            block.isOnRoot &&
            // and the current partial statement is not on the root context
            bindParents.length >= 2 &&
            // The inline block may have processed paths, in which
            // case the paths will start with "<dataPathRoot>.", this will need to be resolved by our object
            // proxy on the client, hence add '<dataPathRoot>' to allowedPaths, to allow hbs resolve it.
            block.program.containsRootDataPath &&
            !_this.allowedPaths.includes(dataPathRoot)
          ) {
            _this.allowedPaths.push(dataPathRoot);
          }

          // Note for scenarios where custom block(s) exists within the
          // inline block, it's possbible in some cases for requiredParams and
          // blockQualifiers to exist at the same time

          inline = true;

          break;
        }

        if (block) {
          return;
        }

        // Then, check root-level inline blocks in parent components. Note: in this case, <inline>
        // will remain false because is sourced external to this component's ast

        for (const parent of _this.metadata.parents) {

          const { inlineBlocks: parentInlineBlocks } = _this.getConfig(parent);

          if (!parentInlineBlocks || !parentInlineBlocks.includes(partialName)) {
            continue;
          }

          const classInfo = global.classesInfo[parent];
          const fileName = 'index.view';

          let { dir } = classInfo;

          if (!classInfo.templateAst) {

            classInfo.templateSrc = fs.readFileSync(
              pathLib.join(dir, fileName), 'utf8',
            );

            classInfo.templateAst = createAst0(classInfo.templateSrc);
          }

          const scopeDecoratorBlocks = [];

          for (const node0 of classInfo.templateAst.body) {
            if (node0.type != 'DecoratorBlock') {
              continue;
            }

            const decoratorName = node0.params[0].original;

            if (inlineBlocks[decoratorName]) {
              continue;
            }

            if (!node0.program.programId) {

              setPartialSourceInfo(node0.program, dir, parent);

              registerProgram({
                locSource: createLocSource({ base: parent, fileName, decoratorName }),
                templateSrc: getBlockSource(classInfo.templateSrc, node0),
                program: node0.program
              });
            }

            const node = utils.deepClone(node0);

            if (decoratorName == partialName) {

              const params = [...stmt.params];
              // Note: params[0] is the decoratorName
              params.shift()

              if (params.length) {
                const { requiredParams, optionalParams } = getDecoratorParams(params);
                ensureBlockParamsAreAvailable({ requiredParams, optionalParams, blockName: decoratorName });
              }

              templateSrc = node.program.templateSource;

              node.program.body.unshift(...scopeDecoratorBlocks);

              block = {
                program: node.program,
              };

              break;

            } else {

              node.loc.source = node0.program.loc.source;

              // This is used to indicate that this inline block is not intrinsic to this component, hence should not be
              // registered as part of this component's "own" inline blocks. See addInlineBlock(...)
              node.synthetic = true;

              getHashValue({ stmt: node, key: runtimeDecoratorHashKey, cleanup: true });

              const { original: eager } = getHashValue({ stmt: node, key: eagerDecoratorHashKey }) || {};

              if (eager) {
                // This decorator block needs to resolve it's paths against the root context - similar to how it would have
                // been resolved on the parent
                node.customContextList = [contextList[0]];
              }

              scopeDecoratorBlocks.push(node);
            }
          }

          assert(block && block.program);
          break;
        }

        if (block) {
          return;
        }


        // Finally, attempt to load the partial as a file

        const fileName = `${partialName}.view`;

        const getAvailablePaths = () => {

          const { original: baseDir } = getHashValue({
            stmt, key: partialBaseDirHashKey, type: 'StringLiteral',
          }) || { original: _this.srcDir };

          const { original: baseLoc } = getHashValue({
            stmt, key: partialBaseLocHashKey, type: 'StringLiteral',
          }) || { original: _this.className };


          const paths = [[baseDir, () => createLocSource({ base: baseLoc, fileName })]];

          if (baseDir != _this.srcDir) {
            paths.push([_this.srcDir, () => createLocSource({ base: _this.className, fileName })]);
          }

          // Add the global partials path
          paths.push([
            pathLib.join(process.env.PWD, 'src', 'partials'),
            () => createLocSource({ base: 'global-partials', fileName })
          ]);

          return paths;
        }

        let partialDir, partialPath, locSource;

        for (const [dir, locFn] of getAvailablePaths()) {
          const path0 = pathLib.join(dir, fileName);

          if (fs.existsSync(path0)) {
            partialDir = dir;
            partialPath = path0;
            locSource = locFn();
            break;
          }
        }

        if (!partialPath) {
          found = false;
          return;
        }

        const { partialContents, program } = PartialReader.read({
          path: partialPath,
          astProducer: createAst0,
        });

        if (partialDir != _this.srcDir) {
          setPartialSourceInfo(program, partialDir, locSource);
        }

        templateSrc = partialContents;

        registerProgram({
          source: locSource,
          templateSrc,
          program,
        })

        block = { program };
      })();

      return found ? {
        block,
        templateSrc,
        inline,
      } : null;
    };

    const processAst = ({ templateSrc, ast, ctxList }) => {
      const p = new TemplatePreprocessor({
        srcDir: this.srcDir,
        assetId: this.assetId,
        logger: this.logger,
        templateSrc,
        ast,
        contextList: ctxList,
        bindParents: [...bindParents],
        globals: this.globals,
        allowedPaths: this.allowedPaths,
        blocksData: this.blocksData,
        component: this.component,
        componentAst: this.componentAst,
        componentSrc: this.componentSrc,
        methodNames: this.methodNames,
        helpers: this.helpers,
        logicGates: this.logicGates,
        customBlockCtx: isCustomContext(),
        allowRootAccess: allowRootAccess(),

        resolver: this.resolver,
        parents: this.parents,
        className: this.className,
        metadata: this.metadata,
        htmlConfig: this.htmlConfig,
      });
      p.process();
      return p
    }

    const processPartial = function ({ stmt }) {

      const {
        partialDeferHashKey, runtimeDecoratorHashKey, getSuffix, throwError,
      } = TemplatePreprocessor;

      const { original: defer } = getHashValue({ stmt, key: partialDeferHashKey, type: 'BooleanLiteral' }) || {};
      const { original: runtime } = getHashValue({ stmt, key: runtimeDecoratorHashKey, type: 'BooleanLiteral' }) || {};

      const ctxList = getPartialContextList.bind(this)({ stmt });

      if (!ctxList) {
        return;
      }

      if (getOuterInlineBlock({ bindParents }) != null && defer) {
        return;
      }

      this.mutating = true;

      let optional = false;

      let partialName = stmt.name.original;

      if (partialName.startsWith('?')) {
        partialName = partialName.replace('?', '');
        optional = true;
      }

      if (runtime) {
        getHashValue({ stmt, key: runtimeDecoratorHashKey, type: 'BooleanLiteral', cleanup: true })

        if (stmt.hash && stmt.hash.pairs.length) {
          throwError(
            `Runtime partial "${partialName}" should not contain any hashes`,
            stmt
          )
        }

        if (!_this.metadata.runtimeDecorators[partialName]) {
          if (optional) {
            return false;
          } else {
            throwError(
              `Could not find any runtime decorator with the name "${partialName}"`,
              stmt
            )
          }
        }

        return stmt;
      }

      const registerProgramInParents = (programId, templateSource) => {
        const { getAstRegistry } = TemplatePreprocessor;

        const program = getAstRegistry()[programId];
        const { loc: { source } } = program;

        bindParents.forEach(parent => {
          const nestedPrograms = parent.nestedPrograms || (parent.nestedPrograms = {});
          nestedPrograms[source] = templateSource;
        })
      }

      const partialInfo = getPartial.bind(this)({ partialName, stmt });

      if (!partialInfo) {
        if (optional) {
          return false;
        } else {
          throw new PartialNotFoundError({ partialName });
        }
      }

      const { block, inline, templateSrc } = partialInfo;

      // eslint-disable-next-line no-shadow
      let ast = block.program;

      // Wrap ast inside PartialWrapper. For more info, see below: ASTParser.prototype.PartialWrapper
      ast = {
        ...ast,
        type: 'PartialWrapper',
      };

      const p = processAst({ ast, ctxList, templateSrc })

      registerProgramInParents(ast.programId, p.templateSrc);

      const parent = utils.peek(bindParents);

      if (isCustomContext()) {
        let contextId;

        if (inline && block.eager) {

          if (!block.isCustomCtx) {
            visitNodes({
              types: ['PathExpression'],
              ast,
              // eslint-disable-next-line no-shadow
              consumer: ({ stmt }) => {
                let { original, variable, processed } = stmt;

                const suffix = getSuffix(original);

                if (variable) {

                  assert(stmt.contextId);
                  original = `@${stmt.contextId}${suffix ? `.${suffix}` : ''}`;

                } else {
                  assert(processed);

                  // Replace "data." with "" if applicable
                  original = original.replace(/^data\./g, '');

                  // Return raw data on resolve, not proxy
                  original = addRawDataPrefixToPath(original);

                  _this.allowedPaths.push(original);
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
                  key: partialIdHashKey,
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
                key: partialNameHashKey,
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
            key: partialIdHashKey,
            value: createStringLiteral(contextId),
          });
        }

        return loadCtxBlock;
      }

      // Indicate that the ast statements should be not be processed after replacing the current partial statement because
      // because this has already been done by partialProcessor above

      visitNodes({
        types: ['MustacheStatement', 'BlockStatement'],
        ast,
        // eslint-disable-next-line no-shadow
        consumer: ({ stmt }) => {
          stmt.partialSkip = true;
          return false;
        },
      });

      replacements.push({
        parent: parent.body,
        replacementIndex: parent.body.indexOf(stmt),
        replacementNodes: ast.body,
        loc: stmt.loc,
      });

      return false;
    };

    ASTParser.prototype.PartialStatement = function (stmt) {

      const {
        componentRefType, loadComponentHelperName, wordPattern, getReservedPartialHashKeys, throwError, createBooleanLiteral,
      } = TemplatePreprocessor;

      validateHash({ stmt, reservedKeys: getReservedPartialHashKeys() });

      const hash = stmt.hash || (stmt.hash = { type: 'Hash', pairs: [] });

      if (stmt.params.length) {
        // Add params as hash

        for (let i = 0; i < stmt.params.length; i++) {
          const param = stmt.params[i];

          if (!param.original.match(wordPattern)) {
            throwError(`PartialStatement should not have non-word param "${param.original}"`, param);
          }

          hash.pairs.push({
            type: 'HashPair',
            key: param.original,
            value: getPartialConfigHashKeys().includes(param.original) ?
              createBooleanLiteral(true) :
              param,
          });
        }

        stmt.params = [];
      }

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

      assert(this.mutating == true);

      const partialName = stmt.name.original;

      const isComponentClass = partialName.match(wordPattern) &&
        _this.getComponentClass(partialName);

      return ASTParser.prototype.MustacheStatement.call(this, {
        type: 'MustacheStatement',
        params: [{
          ...isComponentClass ? createStringLiteral(partialName) : {
            ...createPathExpression({
              original: partialName,
            }),
            immutable: true,
            validType: componentRefType,
            loc: stmt.name.loc,
          },
        }],
        path: createPathExpression({
          original: loadComponentHelperName,
        }),
        generated: true,
        escaped: false,
        hash: { ...hash, pairs: getHashPairs(hash) },
        loc: stmt.loc,
      });
    };

    ASTParser.prototype.PartialBlockStatement = function (stmt) {
      const { throwError } = TemplatePreprocessor;
      throwError('PartialBlockStatements are not supported', stmt);
    };

    ASTParser.prototype.DecoratorBlock = function (stmt) {
      const {
        reservedDecoratorNames, runtimeDecoratorHashKey, eagerDecoratorHashKey, variableHelperName,
        getDecoratorParams, getHashValue, throwError, visitNodes, createMustacheStatement, createPathExpression,
      } = TemplatePreprocessor;

      const { customContextList, fromMarker, loc } = stmt;
      const __contextList = contextList;

      if (customContextList) {
        contextList = customContextList;
      }

      const params = [...stmt.params];

      const { original: decoratorName } = params.shift();

      const { original: runtime } = getHashValue({ stmt, key: runtimeDecoratorHashKey, type: 'BooleanLiteral', cleanup: true }) || {};
      const { original: eager } = runtime ? { original: true } : getHashValue({ stmt, key: eagerDecoratorHashKey, type: 'BooleanLiteral', cleanup: false }) || { original: true };

      if (reservedDecoratorNames.includes(decoratorName)) {
        throwError(`Decorator name: ${decoratorName} is reserved`, stmt);
      }

      if (stmt.hash && stmt.hash.pairs) {
        // Todo: Add support for hashes as a way to provide default value to a parameter
        // exclude hashes like "--config-*", .e.t.c here
      }

      const { requiredParams, optionalParams } = getDecoratorParams(params);

      const decoratorParams = [...requiredParams, ...optionalParams];

      const paramCount = decoratorParams.length;

      if (runtime && !fromMarker) {

        if (paramCount) {
          // Note: Runtime decorators are not consumed by Partial statements but rather may be triggered at 
          // runtime using the rootProxy as the context. Therefore, if params are allowed, then not all 
          // path expressions will be transformed as root paths inside this decorator's program, as they
          // will be seen as inline parameters, hence will not resolve at runtime
          throwError(
            `Runtime decorator block "${decoratorName}" should not have any inline parameters`,
            stmt
          )
        }

        if (bindParents.length > 1) {
          // Runtime decorator blocks are only available on the root context because these decorators are executed 
          // as a high-level handlebars functions and uses the rootProxy as the context, see RootCtxRenderer.renderDecorator(...)
          throwError(
            `Runtime decorator block "${decoratorName}" can only only exist on the root level`,
            stmt
          )
        }

        const configPrefix = 'config--';
        const config = {};

        if (stmt.hash) {

          stmt.hash.pairs
            .filter(({ key }) => key.startsWith(configPrefix))
            .forEach(({ key }) => {
              config[key.replace(configPrefix, '')] = getHashValue({
                stmt, key, type: ['NumberLiteral', 'StringLiteral', 'BooleanLiteral'], cleanup: true,
              }).original;
            });
        }

        _this.metadata.runtimeDecorators[decoratorName] = {
          config,
          program: stmt.program,
        };
      }

      if (eager) {

        if (!fromMarker && decoratorParams.length) {

          // We need to declare variable(s) for the <decoratorParams>, so that if they are referenced inside this
          // block's program, processing will be deferred.

          stmt.program.body.unshift(
            createMustacheStatement({
              original: variableHelperName, loc,
              hash: {
                type: 'Hash', loc,
                pairs: decoratorParams
                  .map(p => ({
                    type: 'HashPair', loc,
                    key: p,
                    value: {
                      ...createPathExpression({ original: p }),
                      decoratorParameter: true,
                      loc
                    }
                  }))
              },
              processed: false,
            })
          );
        }

        const parent = {
          type: stmt.type,
          body: stmt.program.body,
          decoratorName,
          parent: utils.peek(bindParents),
          paramCount, requiredParams, optionalParams,
          loc: stmt.program.loc,
          index: bindParents.length,
        };
        bindParents.push(parent);

        this.acceptKey(stmt, 'program');

        pruneScopeVariables();

        bindParents.pop();


        // We need to perform any node replacements that exists inside this inline block before this 
        // block is taken out of the AST

        visitNodes({
          types: ['Program'],
          ast: stmt.program,
          consumer: ({ stmt }) => {
            replaceNodes({ parent: stmt.body });
          },
          parentFirst: false,
        });
      }

      if (customContextList) {
        contextList = __contextList;
      }

      this.mutating = true;

      return _this.addInlineBlock({
        bindParents,
        decoratorName,
        stmt,
        requiredParams, optionalParams,
        isCustomCtx: isCustomContext(),
        runtime, eager,
      });
    };

    /**
     * This is a custom AST type that is wrapped around a partial's AST program, inorder to create a clearly 
     * defined boundary between decorators defined inside and outside the partial declaration
     */
    ASTParser.prototype.PartialWrapper = function (stmt) {
      // eslint-disable-next-line no-multi-assign
      this.current.type = stmt.type = 'Program';

      bindParents.push({
        type: 'PartialWrapper',
        body: stmt.body,
        parent: utils.peek(bindParents),
        loc: stmt.loc,
        index: bindParents.length,
      });

      Visitor.prototype.Program.call(this, stmt);

      pruneScopeVariables();

      bindParents.pop();

      this.mutating = true;
      // The use of this wrapper has been finalized, hence dispose it and replace it with it's program equivalent
      return stmt;
    };

    Visitor.prototype.PartialWrapper = function () { };

    const isDecoratorInUse = (decoratorName) => {

      const { visitNodes } = TemplatePreprocessor;
      const parent = utils.peek(bindParents);

      let b = false;

      visitNodes({
        types: ['PartialStatement'],
        ast: {
          type: 'Program',
          body: parent.body,
        },
        consumer: ({ stmt }) => {
          const partialName = stmt.name.original;
          if ([decoratorName, `?${decoratorName}`].includes(partialName)) {
            b = true;
          }
        },
      });

      return b;
    }

    ASTParser.prototype.CommentStatement = function (stmt) {
      const { decorator } = stmt;

      if (decorator) {
        // This comment statement was used as a marker for a decorator block. Process the decorator block if it is referenced by a partial in the current scope

        if (isDecoratorInUse(decorator.name)) {
          return ASTParser.prototype.DecoratorBlock.call(this, {
            ...decorator.stmt,
            fromMarker: true,
          });
        }
      }

      return stmt;
    }

    const parser = new ASTParser();
    parser.accept(program);

    if (!this.isPartial) {
      assert(bindParents.length === 1);
      assert(contextList.length === 1);
    }

    replaceNodes();
  }

  static getSourceIndex(src, node) {
    const { loc } = node;

    const fn = lineColumn(src);

    const startIndex = fn.toIndex({ line: loc.start.line, column: loc.start.column + 1 })
    const endIndex = fn.toIndex({ line: loc.end.line, column: loc.end.column })

    return { startIndex, endIndex };
  }

  static getBlockSource(src, node) {
    const { getSourceIndex, getBlockSource0 } = TemplatePreprocessor;

    return getBlockSource0(
      src, getSourceIndex(src, node)
    );
  }

  static getBlockSource0(src, index) {
    const { sanitizeValue } = TemplatePreprocessor;

    const { startIndex, endIndex } = index;

    // Note: We are sanitizing any markup outside the block represented by the loc object
    // because we don't want any warning raised for markup outside the block

    const value = sanitizeValue(
      src.substring(0, startIndex)
    ) +
      src.substring(startIndex, endIndex + 1) +
      sanitizeValue(
        src.substring(endIndex + 1, src.length)
      );

    assert(value.length == src.length);
    return value;
  }

  static getDecoratorParams(params) {
    const { isConditionalParticipant } = TemplatePreprocessor;

    const requiredParams = [];
    const optionalParams = [];

    params.forEach((stmt) => {
      (isConditionalParticipant(stmt) ? optionalParams : requiredParams)
        .push(stmt.original);
    });

    return { requiredParams, optionalParams };
  }

  addInlineBlock({
    bindParents, decoratorName, stmt, requiredParams, optionalParams, isCustomCtx, runtime, eager,
  }) {
    const {
      dataPathRoot, visitNodes, getBlockSource0, getSourceIndex, sanitizeValue,
    } = TemplatePreprocessor;

    // Add a reference to the parent
    const parent = utils.peek(bindParents);

    // A marker is used to maintain a transient reference to this block, inorder for it to be processed normally on subsequent
    // visitations, and at the same time - not be precompiled because we don't want it at runtime. It is also used for replacement
    // purpose, if we need to add a 'storeContext' block later on

    const marker = {
      type: 'CommentStatement',
      value: '',
      decorator: {
        name: decoratorName,
        stmt,
      },
      strip: { open: false, close: false },
      loc: stmt.loc,
    }

    visitNodes({
      types: ['PathExpression'],
      ast: stmt.program,
      consumer: ({ stmt: expr }) => {
        if (expr.original.startsWith(`${dataPathRoot}.`)) {
          stmt.program.containsRootDataPath = true;
        }
        if (!expr[utils.objectReferenceKey]) {
          // Generate referenceIds for this PathExpression inorder for object
          // reference to be maintained after cloning, during partial inlining (if applicable).
          // This is important for example, in the case of logic gate participants
          // that need to maintain the PathExpression object references, e.t.c
          expr[utils.objectReferenceKey] = utils.generateRandomString();
        }
      },
    });

    const isOnRoot = bindParents.length == 1;

    if (isOnRoot && !stmt.synthetic) {
      // Only root decorator blocks owned by this component can be imported by child components. The reason
      // is quite simple, when a child component imports a decorator block from a parent, it is placed on the
      // root program - hence we can't move non-root blocks from a parent into the root of a child, because it
      // will mess up the data model

      const inlineBlocks = this.metadata.inlineBlocks || (this.metadata.inlineBlocks = []);
      inlineBlocks.push(decoratorName);
    }

    const { startIndex, endIndex } = getSourceIndex(this.templateSrc, stmt);

    const decorators = parent.decorators || (parent.decorators = {});

    decorators[decoratorName] = {
      program: JSON.stringify(stmt.program),
      decoratorName,
      isOnRoot,
      requiredParams, optionalParams,
      marker,
      isCustomCtx,
      runtime, eager,
      templateSource: stmt.fromMarker ? stmt.templateSource : (stmt.templateSource = getBlockSource0(this.templateSrc, { startIndex, endIndex })),
    };

    if (!stmt.fromMarker) {
      const templateSrc =
        this.templateSrc.substring(0, startIndex)
        +
        sanitizeValue(
          this.templateSrc.substring(startIndex, endIndex + 1), ' '
        ) +
        this.templateSrc.substring(endIndex + 1, this.templateSrc.length);

      assert(templateSrc.length == this.templateSrc.length);

      this.templateSrc = templateSrc;
    }

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
          const ret = consumer.bind(this)({ stmt });

          if (ret != false) {
            Visitor.prototype[type].call(this, stmt);
          }
        } else {
          Visitor.prototype[type].call(this, stmt);
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
  static getDefaultStripOptions(loc) {
    const strip = { open: false, close: false };
    const { getDefaultLoc } = TemplatePreprocessor;

    return {
      openStrip: strip,
      closeStrip: strip,
      loc: loc || getDefaultLoc(),
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

  static createBooleanLiteral(original) {
    const { createLiteral } = TemplatePreprocessor;
    return createLiteral({ type: 'BooleanLiteral', original });
  }

  static createLiteral({ type, original }) {
    return { type, original, value: original };
  }

  static getLine(stmt) {
    const { loc: { source, start } = {} } = stmt;
    return `${source} ${start.line}:${start.column}`;
  }

  replaceNodes0({ replacements, parent }) {

    replacements.sort(
      ({ replacementIndex: a }, { replacementIndex: b }) => a - b
    );

    const deletedIndexes = [];

    // eslint-disable-next-line no-plusplus
    for (let index = 0; index < replacements.length; index++) {
      const block = replacements[index];

      if (parent && (block.parent != parent) && (block.context != parent)) {
        // Use the parent object (if available) as a filter
        continue;
      }

      for (const replNode of block.replacementNodes) {
        assert(block.replacementIndex >= 0);
        assert(block.replacementIndex <= block.parent.length);

        block.parent.splice(block.replacementIndex, 0, replNode);
        // eslint-disable-next-line no-plusplus
        block.replacementIndex++;
      }

      // eslint-disable-next-line no-plusplus
      for (let index2 = index + 1; index2 < replacements.length; index2++) {
        const b = replacements[index2];

        if (b.parent === block.parent) {
          b.replacementIndex += block.replacementNodes.length
            + (block.shiftOnly ? -1 : 0);
        }
      }

      if (block.callback) {
        block.callback();
      }

      deletedIndexes.push(index);
    }

    // Prune replacements
    for (let i = 0; i < deletedIndexes.length; i++) {
      const index = deletedIndexes[i];
      replacements.splice(index - i, 1);
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
    const { throwError } = TemplatePreprocessor;
    if (!this.methodNames.includes(methodName)) {
      throwError(`Unknown method: ${methodName}`);
    }
  }

  static hasDataPathFormat(path) {
    const { dataPathPrefixRegex, dataPathRoot } = TemplatePreprocessor;
    return path.match(dataPathPrefixRegex)
      // In the case of BlockStatement param(s) and MustacheStatement
      // paths, that are hbs-intrinsic elements, they are prefixed
      // with 'data.' after trimming
      || path.startsWith(`${dataPathRoot}.`);
  }

  static getHbsExpressionTypes() {
    return [
      'ContentStatement', 'SubExpression', 'PathExpression', 'StringLiteral', 'NumberLiteral',
      'BooleanLiteral', 'UndefinedLiteral', 'NullLiteral', 'Hash', 'HashPair',
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
      storeContextBlockName, loadContextBlockName, customEachHelperName, conditionalHelperName,
      startAttrCtxHelperName, endAttrCtxHelperName, startTNBCtxHelperName, setSyntheticNodeIdHelperName,
      resolveMustacheInRootHelperName, fnHelperName, resolveMustacheInCustomHelperName, contentHelperName,
      variableHelperName,
    } = TemplatePreprocessor;
    return [
      storeContextBlockName, loadContextBlockName, customEachHelperName, conditionalHelperName,
      startAttrCtxHelperName, endAttrCtxHelperName, startTNBCtxHelperName, setSyntheticNodeIdHelperName,
      resolveMustacheInRootHelperName, fnHelperName, resolveMustacheInCustomHelperName, contentHelperName,
      variableHelperName
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

  static getDataVariables() {
    const { getHandleBarsDataVariables } = TemplatePreprocessor;
    return [
      ...getHandleBarsDataVariables(),
      '@random',
    ];
  }

  static getIterateDataVariables() {
    const { getHandleBarsIterateDataVariables } = TemplatePreprocessor;
    return [
      '@random', ...getHandleBarsIterateDataVariables(),
    ];
  }

  static getHandleBarsDataVariables() {
    const { getHandleBarsIterateDataVariables } = TemplatePreprocessor;
    return [
      '@root', ...getHandleBarsIterateDataVariables(),
    ];
  }

  static getHandleBarsIterateDataVariables() {
    return ['@first', '@index', '@key', '@last'];
  }

  getHtmlErrors() {

    const { nestedPrograms } = this.bindParents[0];
    const htmlErrors = [];

    if (this.ast.body.length) {
      this.getW3cHtmlErrors(
        this.templateSrc,
        this.ast.loc.source,
        htmlErrors,
      );

      if (nestedPrograms) {
        Object.entries(nestedPrograms).forEach(([locSource, templateSource]) => {
          this.getW3cHtmlErrors(
            templateSource,
            locSource,
            htmlErrors,
          );
        });
      }
    }

    this.metadata.enableDataBinding = !htmlErrors.length;
    return htmlErrors;
  }

  static sanitizeValue(value, repl = () => utils.generateRandomString(1)) {
    return value.replace(/[^\s]/g, repl);
  }

  getSanitizedHtml({ src, sanitizer }) {

    let i = 0;

    const mustacheStart = [];

    loop:
    while (i < src.length) {

      switch (`${src[i - 1]}${src[i]}`) {

        case '{{':

          mustacheStart.push(i - 1);

          if (src[i + 1] == '!') {
            // Start of CommentStatement

            // This determines whether the comment is terminated by }} or --}}
            const compound = src[i + 2] == '-' && src[i + 3] == '-';

            // Set j to the earlies index that can end this comment, and start
            // looping from there
            let j = i + (compound ? 7 : 3);

            while (j < src.length) {

              if (
                src[j] == '}' &&
                src[j - 1] == '}' &&
                (compound ? src[j - 2] == '-' : true) &&
                (compound ? src[j - 3] == '-' : true)
              ) {

                // End of CommentStatement
                const mst = src.substring(utils.peek(mustacheStart), j + 1);

                const repl = sanitizer(mst);

                src = src.substring(0, utils.peek(mustacheStart)) +
                  repl +
                  src.substring(utils.peek(mustacheStart) + repl.length, src.length);

                // This is the earliest index that a subsequent mustache statement
                // can start
                i = j + 2;
                continue loop;

              }

              j++;
            }

            assert(false);
          }

          break;

        case '}}':

          if (mustacheStart.length) {

            const mst = src.substring(utils.peek(mustacheStart), i + 1);
            const repl = sanitizer(mst);

            src = src.substring(0, utils.peek(mustacheStart)) +
              repl +
              src.substring(utils.peek(mustacheStart) + repl.length, src.length);

            mustacheStart.pop();

            // This is the earliest index that a subsequent mustache statement
            // can start
            i += 2;
            continue loop;
          }
      }

      i++;
    }

    return src;
  }

  getW3cHtmlErrors(src, loc, messages, validator) {

    // const htmlTagRegex = /(\&|>|<)/g;
    const { validateW3cHtmlString, sanitizeValue } = TemplatePreprocessor;

    if (!validator) {
      validator = this.getW3cHtmlValidator();
    }

    const dictionary = {};
    const initialSrc = src;

    const sanitizer = (value) => {

      const repl = sanitizeValue(value);

      if (dictionary[repl]) {
        // Another similar key already exists, try again
        return sanitizer(value);
      }
      dictionary[repl] = value;
      return repl;
    }

    src = this.getSanitizedHtml({ src, sanitizer });

    assert(src.length == initialSrc.length);

    validateW3cHtmlString(src, validator, dictionary, messages, loc);

    return messages;
  }

  static transformMessageWithDictionary({ message, dictionary }) {
    const dictionaryKeys = Object.keys(dictionary);
    dictionaryKeys.forEach(key => {

      const k = key.replace(/^"/g, '\\"').replace(/"$/g, '\\"')

      // Replace sanitized values, with the original ones, if necessary
      if (message.includes(k)) {
        message = message.replace(k, dictionary[key]);
      }
    });

    return message;
  }

  static validateW3cHtmlString(src, validator, dictionary, messages, loc) {

    const { transformMessageWithDictionary } = TemplatePreprocessor;
    const report = validator.validateString(src);

    if (!report.valid) {
      report.results[0].messages.forEach(msg => {
        let { message, line, column, ruleId } = msg;
        messages.push({
          message: `[${loc} ${line}:${column}] ${ruleId}: ${transformMessageWithDictionary({ message, dictionary })}`
        });
      });
    }

    return messages;
  }

  getW3cCustomHtmlRules() {
    const { loadJson } = TemplatePreprocessor;
    const file = pathLib.join(this.srcDir, 'html-rules.json');

    let rules = {};

    if (fs.existsSync(file)) {
      rules = loadJson(file);
    }

    return rules;
  }

  getW3cHtmlValidator() {

    return new HtmlValidate({
      extends: [
        'html-validate:recommended'
      ],
      rules: {
        'no-inline-style': ["warn", {
          include: [],
        }],
        // <div class = "{{a}} b {{c}}"></div>
        'no-dup-class': 0,
        // <div {{a and c ? d : e}}></div>
        'no-dup-attr': 0,
        'attr-case': 0,
        // 'attr-quotes': 0,
        'no-trailing-whitespace': 0,
        'attribute-allowed-values': 0,
        ...this.getW3cCustomHtmlRules()
      }
    })
  }

  static getUserHash(hash) {
    const { getConfigurationHashKeys } = TemplatePreprocessor;
    return {
      ...hash,
      pairs: hash.pairs.filter(({ key }) => !getConfigurationHashKeys().includes(key))
    };
  }

  static getConfigurationHashKeys() {
    const {
      allowRootAccessHashKey, transformHashKey, asyncHashKey, escapedHashKey
    } = TemplatePreprocessor;
    return [
      allowRootAccessHashKey, transformHashKey, asyncHashKey, escapedHashKey
    ]
  }

  static getReservedMustacheHashKeys() {
    const { ctxHashKey } = TemplatePreprocessor;
    return [ctxHashKey];
  }

  static getReservedBlockHashKeys() {
    const {
      blockParamHashKey, stateHashKey, rootQualifier, getDataVariables
    } = TemplatePreprocessor;
    return [
      blockParamHashKey, stateHashKey, rootQualifier,
      ...getDataVariables(),
    ];
  }

  static getReservedPartialHashKeys() {
    const {
      partialIdHashKey, partialNameHashKey, blockParamHashKey, stateHashKey,
      hookHashKey, hookOrderHashKey, rootQualifier, getDataVariables,
    } = TemplatePreprocessor;
    return [
      partialIdHashKey, partialNameHashKey, blockParamHashKey, stateHashKey,
      hookHashKey, hookOrderHashKey, rootQualifier, ...getDataVariables(),
    ];
  }

  static getReservedBlockParamNames() {
    const { stateHashKey, rootQualifier } = TemplatePreprocessor;
    return [stateHashKey, rootQualifier];
  }

  static getAllHandlebarsTypes() {
    return [
      'StringLiteral', 'NumberLiteral', 'BooleanLiteral', 'NullLiteral', 'UndefinedLiteral',
      'PartialStatement', 'DecoratorBlock', 'Program', 'PathExpression', 'ContentStatement',
      'Hash', 'HashPair', 'SubExpression', 'MustacheStatement', 'BlockStatement', 'CommentStatement',
      'PartialBlockStatement', 'PartialWrapper', 'MustacheGroup', 'Decorator'
    ];
  }

  static stringifyHandlebarsNode(node) {
    const { throwError } = TemplatePreprocessor;

    let arr = [];

    const accept = (node) => {
      if (!node) return;

      const accepSubExpr = (stmt) => {
        accept(stmt.path);
        for (let i = 0; i < stmt.params.length; i++) {
          const param = stmt.params[i];
          arr.push(' ');
          accept(param)
        }
        if (stmt.hash && stmt.hash.pairs.length) {
          arr.push(' ');
          accept(stmt.hash)
        }
      }

      switch (true) {
        case node.type == 'PartialStatement':
          arr.push('{{>');
          arr.push(' ');
          accepSubExpr({
            ...node,
            path: node.name,
          })
          arr.push('}}');
          break;
        case node.type == 'DecoratorBlock':
          arr.push('{{#*inline');
          arr.push(' ');
          accepSubExpr({
            ...node,
            path: undefined,
          })
          arr.push('}}');
          accept(node.program);
          arr.push('{{/inline}}');
          break;
        case node.type == 'Program':
          node.body.forEach(accept);
          break;
        case node.type == 'PathExpression':
          // if (node.processed) {
          //   arr.push('<<');
          // }
          arr.push(node.original);
          // if (node.processed) {
          //   arr.push('>>');
          // }
          break;
        case node.type == 'StringLiteral':
          arr.push(`"${node.original || node.value}"`);
          break;
        case node.type.endsWith('Literal'):
        case node.type == 'ContentStatement':
          arr.push(`${node.original || node.value}`);
          break;
        case node.type == 'Hash':
          for (let i = 0; i < node.pairs.length; i++) {
            const pair = node.pairs[i];
            if (i !== 0) {
              arr.push(' ');
            }
            arr.push(`${pair.key}=`);
            accept(pair.value);
          }
          break;
        case node.type == 'SubExpression':
          arr.push('(');
          accepSubExpr(node)
          arr.push(')');
          break;
        case node.type == 'MustacheStatement':
          arr.push('{{');
          accepSubExpr(node)
          arr.push('}}');
          break;
        case node.type == 'BlockStatement':
          arr.push('{{#');
          accepSubExpr(node)
          arr.push('}}');
          accept(node.program);
          if (node.inverse) {
            arr.push('{{else}}');
            accept(node.inverse);
          }
          arr.push('{{/');
          accept(node.path);
          arr.push('}}');
          break;
        // NoOp types... Todo: Impl CommentStatement
        case node.type == 'CommentStatement':
        case node.type == 'PartialBlockStatement':
          break;
        // Custom AST types
        case node.type == 'PartialWrapper':
          node.body.forEach(accept);
          break;
        case node.type == 'TernaryExpression':
          accept(node.condition);
          arr.push(' ? ');
          accept(node.left);
          arr.push(' : ');
          accept(node.right);
          break;
        case node.type == 'MustacheGroup':
          arr.push('"');
          for (const item of node.items) {
            if (item.type == 'StringLiteral') {
              // Pretend this is a PathExpression (instead of a StringLiteral) to avoid extra quotes
              accept({
                type: 'PathExpression',
                original: item.original
              });
            } else {
              arr.push('${');
              accept(item);
              arr.push('}');
            }
          }
          arr.push('"');
          break;
        default:
          throwError(`${node.type} is not a known AST type`, node);
      }
    }

    accept(node);

    return arr.join('');
  }

  static clearRequireCache() {
    Object.keys(require.cache).forEach((key) => {
      delete require.cache[key];
    });
  }

  static makeRequire(filePath) {
    return createRequire(filePath);
  }

  static getJsDomVirtualConsole() {

    const { logger } = TemplatePreprocessor;
    const virtualConsole = new jsdom.VirtualConsole();

    virtualConsole.on("jsdomError", ({ message, detail }) => {
      logger.error(`${message}: ${detail}`);
    });

    return virtualConsole;
  }

  static createJsDom({
    html = '<!DOCTYPE html><div id="container"></div>', options = {}
  } = {}) {
    const { getJsDomVirtualConsole } = TemplatePreprocessor;

    return new jsdom.JSDOM(
      html,
      {
        resources: new NoOpResourceLoader(),
        url: 'http://localhost:8080/',
        // Todo: revisit this
        runScripts: 'dangerously',
        virtualConsole: getJsDomVirtualConsole(),
        ...options
      },
    );
  }

  static addGlobals() {

    const { createJsDom, getSrcConfig } = TemplatePreprocessor;

    global.AppContext = importFresh('../src/assets/js/app-context');
    global.RootProxy = importFresh('../src/assets/js/proxy');
    global.BaseRenderer = importFresh('../src/assets/js/base-renderer');
    global.RootCtxRenderer = importFresh('../src/assets/js/root-ctx-renderer');
    global.CustomCtxRenderer = importFresh('../src/assets/js/custom-ctx-renderer');
    global.WebRenderer = importFresh('../src/assets/js/web-renderer');
    global.BaseComponent = importFresh('../src/assets/js/base-component');
    global.clientUtils = clientUtils;
    global.customCtxHelpers = require('../src/assets/js/custom-ctx-helpers');
    global.assert = require('assert');

    global.hyntaxStreamTokenizerClass = StreamTokenizer;

    const { window } = createJsDom();

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

          if (typeof global[k] == 'function') {
            global[k] = global[k].bind(window);
          }

          polyfilledProps.push(k);
        }
      }
    }
    global.window = window;


    // Note: Some window members are proxied by JsDom, hence for such non-enumerable properties,
    // we need to explicitly do a get operation for them

    const { extendedWindowProperties = [] } = getSrcConfig() || {};

    extendedWindowProperties.forEach(prop => {
      global[prop] = window[prop];
    });

    self.appContext = null;

    global.showLoader = () => { };
    global.hideLoader = () => { };

    const release = () => {
      for (const k of polyfilledProps) {
        delete global[k];
      }
      delete global.window;
      delete global.document;

      delete global.templates;
      delete global.components;
      delete global.preprocessor;
      delete global.classesInfo;

      delete global.showLoader;
      delete global.hideLoader;
    };

    return { release }
  }

  createResolver({ path, target }) {
    const { literalType, throwError } = TemplatePreprocessor;
    const _this = this;

    const literal = target !== Object(target);

    return new Proxy(literal ? {} : target, {

      get(obj, prop) {
        if (prop === Symbol.toPrimitive) {
          return () => target;
        }

        if (Object.getPrototypeOf(obj)[prop]) {
          return obj[prop];
        }

        const isIndex = global.clientUtils.isNumber(prop);

        // resolver[0] is not valid
        assert(path !== '' || !isIndex);

        if (obj.constructor.name === 'Object' && !literal && isIndex) {
          throwError(`Object: "${path}" cannot be accessed like an array`);
        }

        if (obj instanceof Array && !isIndex && prop !== 'length') {
          throwError(`Array: "${path}" cannot be accessed like an object`);
        }

        const property = `${path}${isIndex ? `[${prop}]` : `${path.length ? '.' : ''}${prop}`}`;

        const value = _this.resolver.resolve({ path: `${property}%${literalType}` });

        const v = _this.createResolver({ path: property, target: value });

        return v;
      },
    });
  }

  static evalScript({ script, requireFn, reference }) {
    const require = (moduleName) => {
      if (!requireFn) {
        throw Error(`${reference ? `[${reference}]` : ''} Script cannot contain require statements`);
      }
      const o = requireFn(moduleName);
      return o;
    };
    return eval(script);
  }

  getComponentClass(className) {
    return className == this.className ?
      this.component.constructor :
      global.components[className];
  }

  /**
  * This returns the component instance of the template
  * that is currently being processed
  */
  getComponent({ ComponentClass }) {

    const { getOwnMethod } = TemplatePreprocessor;

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

    // Create component instance
    const component = new ComponentClass({
      input: this.createResolver({ path: '', target: {} }),
    });

    if (this.resolver.processing) {
      component.resolver = this.resolver;

      if (!this.metadata.initialized) {

        // Test class
        let initFn = getOwnMethod({
          component, name: 'initCompile', className: ComponentClass.name,
        });

        if (initFn) {
          initFn();
        }

        // Main class
        initFn = getOwnMethod({
          component, name: 'initCompile', className: this.className
        });

        if (initFn) {
          initFn();
        }

        this.metadata.initialized = true;
      }
    }

    return component;
  }
}

module.exports = TemplatePreprocessor;
