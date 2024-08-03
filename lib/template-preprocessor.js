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
const jsdom = require('jsdom');
const UglifyJS = require('uglify-js');
const importFresh = require('import-fresh');
const NoOpResourceLoader = require('jsdom/lib/jsdom/browser/resources/no-op-resource-loader');
const { StreamTokenizer, constructTree } = require('hyntax');
const { HtmlValidate } = require('html-validate');
const lineColumn = require("line-column");
const brotli = require('brotli-wasm');

const utils = require('./utils');
const PartialReader = require('./template-reader');
const ClientHtmlGenerator = require('./client-html-generator');
const PathResolver = require('./path-resolver');
const { processFile } = require('./template-processor');
const clientUtils = require('../src/assets/js/client-utils');
const Transformers = require('./transformers');
const SchemaGenerator = require('./schema-generator');
const CircularDependencyError = require('./circular-dependency-error');
const TemplateError = require('./template-error');
const InlineVariableTransformer = require('./transformers/_inline_variables');

class TemplatePreprocessor {

  static allowRootAccessByDefault = true;

  static rawDataPrefix = 'r$_';

  static syntheticMethodPrefix = 's$_';

  static literalPrefix = 'l$_';

  static rootQualifier = '@_root';

  static dataPathRoot = 'data';

  static logicGatePathRoot = 'lg';

  static pathSeparator = '__';

  static dataPathPrefixRegex = RegExp(`^${this.dataPathRoot}${this.pathSeparator}`);

  static logicGatePathPrefixRegex = RegExp(`^${this.logicGatePathRoot}${this.pathSeparator}`);

  static literalPathPrefixRegex = RegExp(`^${this.dataPathRoot}${this.pathSeparator}${utils.escapeRegExp(this.literalPrefix)}`);

  static reservedDecoratorNames = ['@partial-block'];

  static syntheticAliasSeparator = '$$';

  static startAttrCtxHelperName = 'startAttributeBindContext';

  static endAttrCtxHelperName = 'endAttributeBindContext';

  static blockWrapperIdHelperName = 'blockWrapperId';

  static getBlockWrapperIdMethodName = 'getBlockWrapperId';

  static textBindContextHelperName = 'textBindContext';

  static customEachHelperName = 'forEach';

  static conditionalHelperName = 'conditional';

  static storeContextBlockName = 'storeContext';

  static loadContextBlockName = 'loadContext';

  static defaultBlockName = 'block';

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

  static componentImportHelperName = 'component';

  static wordPattern = /^\w+$/g;

  static scopeVariableHashKey = 'scopeVar';
  static indexVariableHashKey = 'indexVar';

  static stateHashKey = 'state';

  static partialIdHashKey = '__id';

  static partialNameHashKey = '__name';

  static partialDeferHashKey = 'defer';

  static partialRuntimeHashKey = 'runtime';

  static generatedPartialHashKeyPrefix = '$$$_';

  static runtimeDecoratorHashKey = 'runtime';

  static eagerDecoratorHashKey = 'eager';

  static decoratorConfigPrefix = 'config--';

  static ctxHashKey = 'ctx';

  static allowRootAccessHashKey = 'allowRootAccess';

  static transformHashKey = 'transform';

  static opaqueWrapperHashKey = 'opaqueWrapper';

  static predicateHashKey = 'predicate';

  static hookHashKey = 'hook';

  static hookOrderHashKey = 'hookOrder';

  static hookPhaseHashKey = 'hookPhase';

  static asyncHashKey = 'async';

  static escapedHashKey = 'escaped';

  static transientHashKey = 'transient';

  static inlineComponentHashKey = 'inlineComponent';

  static canonicalPathHashKey = 'canonicalPath';

  static nodeIndexHashKey = 'nodeIndex';

  static markerTagNameHashKey = 'markerTagName';

  static attributeTokenTypeHashKey = 'attrTokenType';

  static customBlockGateSuffix = '_customBlock';

  // If this is false, we will compile components every time it
  // is referenced via global.components, irrespective of 
  // whether it has already been processed and available in 
  // the dist folder. If this is false, it is guaranteed that 
  // circular dependencies will be detected ahead of time.

  static enableComponentClassCaching = true;

  static addDefaultParamToCustomBlock = false;

  static wrapInvocationWithProxyMethodName = 'wrapInvocationWithProxy';

  static renderMethodName = 'render';

  static toHtmlMethodName = 'toHtml';

  static getLoaderMethodName = 'getLoader';

  static validateTypeMethodName = 'validateType';

  static captureStateMethodName = 'captureState';

  static renderBlockMethodName = 'renderBlock';

  static loadInlineComponentHelperName = 'loadInlineComponent';

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
    const { createAst0, registerProgram, addSourceToLoc } = TemplatePreprocessor;

    const program = createAst0(templateSrc);

    const programId = registerProgram({ locSource, templateSrc, program });

    if (program.loc) {
      addSourceToLoc(program.loc, programId, locSource);
    } else {
      assert(!templateSrc);
    }

    return program;
  }

  static registerProgram({ locSource, templateSrc, program }) {
    const { setLocSource, registerProgramInfo } = TemplatePreprocessor;

    assert(!program.programId);

    const programId = registerProgramInfo({ locSource, templateSrc });
    program.programId = programId;

    setLocSource(program, programId);

    return programId;
  }

  static registerProgramInfo({ programId = utils.generateRandomString(), locSource, templateSrc }) {
    const { getProgramInfoRegistry } = TemplatePreprocessor;

    const programInfoRegistry = getProgramInfoRegistry();

    programInfoRegistry[programId] = {
      templateSource: templateSrc, locSource,
    };

    return programId;
  }

  static setLocSource(program, programId) {
    const {
      visitNodes, getAllHandlebarsTypes, getProgramInfoRegistry, cloneProgram, addSourceToLoc,
    } = TemplatePreprocessor;

    const programInfoRegistry = getProgramInfoRegistry();

    const { locSource } = programInfoRegistry[programId];

    visitNodes({
      types: getAllHandlebarsTypes(),
      parentFirst: true,
      ast: { type: 'Program', body: program.body },
      consumer: ({ stmt }) => {
        const { type, loc } = stmt;

        if (type == 'ExternalProgram') {
          cloneProgram(stmt);
          return false;
        }

        if (loc) {
          addSourceToLoc(loc, programId, locSource);
        }
      },
    });
  }

  static addSourceToLoc(loc, programId, locSource) {
    loc.programId = programId;
    loc.source = locSource;
  }

  static cloneProgram(program) {
    const { getProgramInfoRegistry, registerProgram } = TemplatePreprocessor;

    const { programId } = program;
    assert(programId);

    const { templateSource: templateSrc, locSource } = getProgramInfoRegistry()[programId];
    delete program.programId;

    registerProgram({ locSource, templateSrc, program });
  }

  static getProgramInfoRegistry() {
    return global.programInfoRegistry;
  }

  static createLocSource({ remote, base, fileName, decoratorName }) {
    let s = `${remote ? 'remote:' : ''}${base}/${fileName}`;
    if (decoratorName) {
      s += `/decorator:${decoratorName}`;
    }
    return s;
  }

  static getProgramLocRange(program) {
    const { body } = program;

    const defaultLc = { line: 0, column: 0 };

    if (!body.length) return { start: { ...defaultLc }, end: { ...defaultLc } };

    const { start } = body[0].loc;
    const { end } = body.at(-1).loc;

    return { start, end };
  }

  static getDefaultHelpers() {
    const {
      loadInlineComponentHelperName, noOpHelperName, ternaryHelperName, logicalHelperName, concatenateHelperName,
      fnHelperName,
    } = TemplatePreprocessor;

    return [
      loadInlineComponentHelperName, noOpHelperName, ternaryHelperName, logicalHelperName, concatenateHelperName,
      fnHelperName,
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

  // Todo: Remove if not used
  static getStaticMethodNames(ComponentClass) {
    return Object.getOwnPropertyNames(ComponentClass)
      .filter(n => typeof ComponentClass[n] == 'function' && ComponentClass[n].prototype === undefined);
  }

  static getMethodNames(component) {
    const { syntheticMethodPrefix, getDefaultHelpers, getMetaHelpers } = TemplatePreprocessor;

    const defaultHelpers = getDefaultHelpers();
    const metaHelpers = getMetaHelpers();

    let methods = new Set();
    let isParentComponent;

    while ((component = Reflect.getPrototypeOf(component))
      // eslint-disable-next-line no-undef
      && component.constructor.name !== WebRenderer.name
    ) {

      if (!isParentComponent) {
        isParentComponent = component.constructor.extends == component.constructor.name;
      }

      const keys = Reflect.ownKeys(component).filter(k => k !== 'constructor');

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

    this.writeBootConfigFileToFileSystem();
    this.writeComponentJsToFileSystem();
    this.writeHtmlFileToFileSystem();
    this.writeSamplesFileToFileSystem();
    this.writeConfigFileToFileSystem();
    this.writeSchemaFileToFileSystem();
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

  #updateComponentHtmlFileWithComponentList(assetId, componentListString) {
    const { getComponentsDistPath } = TemplatePreprocessor;

    const filePath = pathLib.join(
      getComponentsDistPath(), assetId, 'client.html',
    );

    const contents = fs.readFileSync(filePath, 'utf8');

    const listStartMarker = '<componentList>';
    const listEndMarker = '</componentList>';

    const start = contents.indexOf(listStartMarker) + listStartMarker.length;
    const end = contents.indexOf(listEndMarker);

    fs.writeFileSync(
      filePath,
      utils.replaceSubstring(contents, start, end, componentListString),
    );
  }

  updateComponentList() {
    const { getComponentListPath, fetchDistComponentList, getComponentsDistPath } = TemplatePreprocessor;

    const list = fetchDistComponentList(false);
    const assetId = list[this.className];

    this.metadata.distComponentList[this.className] = this.assetId;

    if (assetId) {
      assert(assetId == this.assetId);

      this.#updateComponentHtmlFileWithComponentList(
        this.assetId, JSON.stringify(list)
      );
      return;
    }

    list[this.className] = this.assetId;

    const componentListString = JSON.stringify(list);

    Object.values(list).forEach(assetId => {
      this.#updateComponentHtmlFileWithComponentList(assetId, componentListString);
    });

    fs.writeFileSync(
      getComponentListPath(), componentListString,
    );
  }

  writeComponentJsToFileSystem() {

    const distPath = this.getDistPath();

    const fileName = 'index.js';
    const testFileName = 'index.test.js';

    let testComponentSrc = fs.readFileSync(pathLib.join(this.srcDir, testFileName), 'utf8');

    let { data: componentSrc, ComponentClass } = this.parseComponentClass({ dir: this.srcDir });

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
    const { getComponentsDistPath, getComponentListRelativePath, getSchemaFilePath, loadJson } = TemplatePreprocessor;

    global.components = {};
    const componentClassMetadataMap = self.appContext.getComponentClassMetadataMap();

    Object.entries(this.metadata.distComponentList)
      .forEach(([className, assetId]) => {

        const dir = pathLib.join(getComponentsDistPath(), assetId);

        let testComponentClass;

        try {
          testComponentClass = this.parseComponentClass({
            dir,
            useTestClass: true,
          }).ComponentClass;
        } catch (e) {
          this.throwError(`Error occured while loading component: ${className}. To proceed, remove the entry "${className}" from ${getComponentListRelativePath()}`);
        }

        // When serializing, BaseRenderer.toJSON(...) should use the actual className, not the test class
        testComponentClass.className = className;

        global.components[className] = testComponentClass;

        const metadataFile = pathLib.join(dir, 'metadata.min.js');

        if (!fs.existsSync(metadataFile)) {
          throw Error(`Could not find metadata file: ${metadataFile}`);
        }

        componentClassMetadataMap[className] = {
          schema: loadJson(getSchemaFilePath(assetId)),
          metadata: eval(
            fs.readFileSync(metadataFile, 'utf8')
          )
        };
      });
  }

  static getAppContextObject() {
    const { loadJson } = TemplatePreprocessor;
    const enumsFile = pathLib.join(process.env.PWD, 'src', 'components', 'enums.json');

    const componentClassMetadata = {};

    return {
      enums: fs.existsSync(enumsFile) ? loadJson(enumsFile) : {},
      testMode: true,
      getLogger: () => console,
      getUserGlobals: () => { },
      getComponentClassMetadataMap() {
        return componentClassMetadata;
      }
    };
  }

  getTransientComponentsGlobal() {
    const {
      enableComponentClassCaching, getComponentsDistPath, getSkipFile, throwError
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

            componentClass = this.parseComponentClass({
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
    const filePath = `${this.getDistPath()}/client.html`;
    const contents = ClientHtmlGenerator.get({
      className: this.className,
      assetId: this.assetId,
      parents: this.metadata.parents,
      bootConfig: this.bootConfig,
      dynamicBootConfig: this.metadata.dynamicBootConfig,
    });

    fs.writeFileSync(filePath, contents);
  }

  writeSamplesFileToFileSystem() {
    const filePath = `${this.getDistPath()}/samples.js`;
    const contents = new TextEncoder().encode(
      `module.exports=${this.samplesString}`
    );

    fs.writeFileSync(filePath, contents);

    utils.getCompressedFiles(filePath, contents)
      .forEach(([p, c]) => {
        fs.writeFileSync(p, c)
      });
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

    let collections = this.resolver.getCollections();

    if (parent) {
      const { collections: parentCollections } = this.getNonNullConfig(parent);
      collections = {
        ...collections,
        ...parentCollections,
      }
    }

    const filePath = pathLib.join(getComponentsDistPath(), this.assetId, 'config.json');
    const contents = new TextEncoder().encode(
      JSON.stringify({
        scalars, collections,
        recursive: !!this.metadata.recursive,
        parents: this.metadata.parents,
        isAbstract: this.metadata.isAbstract,
        inlineBlocks: this.metadata.inlineBlocks,
        srcDir: this.srcDir,
      }, null, 2)
    );

    fs.writeFileSync(filePath, contents);

    utils.getCompressedFiles(filePath, contents)
      .forEach(([p, c]) => {
        fs.writeFileSync(p, c)
      });
  }

  writeSchemaFileToFileSystem() {
    const { getSchemaFilePath } = TemplatePreprocessor;

    const filePath = getSchemaFilePath(this.assetId);
    const contents = new TextEncoder().encode(
      JSON.stringify(this.clientSchema, null, 2)
    );

    fs.writeFileSync(filePath, contents);

    utils.getCompressedFiles(filePath, contents)
      .forEach(([p, c]) => {
        fs.writeFileSync(p, c)
      });
  }

  static getSchemaFilePath(assetId) {
    const { getComponentsDistPath } = TemplatePreprocessor;
    return pathLib.join(getComponentsDistPath(), assetId, 'schema.json');
  }

  writeBootConfigFileToFileSystem() {
    const { getBootConfigFilePath } = TemplatePreprocessor;

    [...this.metadata.parents]
      .reverse()
      .forEach(parent => {
        this.#addToRenderTree(parent);
      });

    this.bootConfig = {
      renderTree: this.#getRenderTree(),
      cssDependencies: this.#getAllCssDependencies(),
      jsDependencies: this.#getAllJsDependencies(),
      hspuMetadata: this.#getFinalHspuMetadata(),
      isAbstract: this.metadata.isAbstract,
    }

    const filePath = getBootConfigFilePath(this.assetId);
    const contents = new TextEncoder().encode(
      JSON.stringify(this.bootConfig, null, 2)
    );

    fs.writeFileSync(filePath, contents);

    utils.getCompressedFiles(filePath, contents)
      .forEach(([p, c]) => {
        fs.writeFileSync(p, c)
      });
  }

  static getBootConfigFilePath(assetId) {
    const { getComponentsDistPath } = TemplatePreprocessor;
    return pathLib.join(getComponentsDistPath(), assetId, 'boot-config.json');
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

  /**
   * Note: The <loadable> param is only used for serialization purposes
   */
  getSerializedComponent(path, className, declaredClassName, loadable) {
    const { getAnyScalarComponent } = TemplatePreprocessor;

    if (className === this.className) {

      // We need to indicate that this component is a rescursive one, i.e. it references
      // itself in it's data model.
      this.metadata.recursive = true;

      // Return null, else we will end up with a circular dependency error
      return null;
    }

    const forBaseComponent = [className, declaredClassName].includes(BaseComponent.name);
    const subClasses = (declaredClassName && !forBaseComponent) ? this.#getClassesInHierarchy(declaredClassName) : null;

    const resolverInfo = { forBaseComponent, subClasses };

    if (className === BaseComponent.name) {
      // Load an arbitrary scalar component, if available
      const anyScalar = getAnyScalarComponent();

      if (anyScalar == null) {
        return null;
      }

      className = anyScalar;

    } else if (global.classesInfo[className].isAbstract) {

      const loadableImplClasses = this.#getLoadableImplClasses(className);

      if (!loadableImplClasses.length) {
        return null;
      }

      className = loadableImplClasses[utils.getRandomInt(0, loadableImplClasses.length - 1)];
    }

    const instance = this.#getComponentInstanceFromClassName(className, loadable);

    if (this.resolver.processing) {

      instance.addMetaInfo('resolverInfo', resolverInfo);

    } else if (this.resolver.getCurrentSampleIndex() == 0) {
      assert(path);

      const { forBaseComponent, subClasses } = resolverInfo;

      if (!forBaseComponent && !this.#getTransientComponentRefs().includes(path)) {
        const factor = this.#getHookFactor();

        if (subClasses) {
          subClasses.forEach(className => {
            this.#addRefCount(className, factor);
          })
        } else {
          this.#addRefCount(className, factor);
        }
      }
    }

    return instance;
  }

  #addRefCount(componentName, factor) {
    const componentRefCount = this.#getComponentRefCount();

    const refCountInfo = componentRefCount[componentName] ||
      (componentRefCount[componentName] = { count: 0 });

    refCountInfo.count += factor;
  }

  #getHookFactor(factor = 1) {
    const { hookAccessRate } = this.resolver.config;

    switch (hookAccessRate) {
      case 2: factor *= 0.25; break; // reduce by 4 times
      case 1: factor *= 0.0625; break; // reduce by 8? = 0.125, 16? = 0.0625
    }

    return factor;
  }

  #getComponentInstanceFromClassName(className, loadable) {
    const { getComponentsDistPath } = TemplatePreprocessor;

    const getInstance = () => {
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

      // eslint-disable-next-line new-cap
      return new testComponentClass({
        input: sample,
        config: {
          loadable: false, serialization: { loadable, }
        },
      });
    }

    if (this.resolver.processing) {
      const componentInstances = this.componentInstances || (this.componentInstances = {});

      if (!componentInstances[className]) {
        componentInstances[className] = getInstance();
      }
      return componentInstances[className];
    } else {
      return getInstance();
    }
  }

  #getClassesInHierarchy(className) {
    const { classesInfo } = global;

    if (!classesInfo[className].isAbstract) return null;

    return [
      className,
      ...this.#getChildClasses(className, true)
    ];
  }

  #getLoadableImplClasses(className) {
    return this.#getChildClasses(className, false)
      .filter(n => !this.getNonNullConfig(n).recursive);
  }

  #getChildClasses(className, includeAbstract) {
    const { classesInfo } = global;

    assert(classesInfo[className].isAbstract);

    const arr = [];

    classesInfo[className].children.forEach(n => {
      if (classesInfo[n].isAbstract) {
        if (includeAbstract) {
          arr.push(n);
        }
        arr.push(...this.#getChildClasses(n, includeAbstract));
      } else {
        arr.push(n);
      }
    });

    return arr;
  }

  static getNonEmptyLiteralTypes() {
    return ['NumberLiteral', 'StringLiteral', 'BooleanLiteral'];
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

  process({ validateHtml = true } = {}) {
    const {
      reservedComponentClassNames, getMethodNames, parseScript, getComponentParents, isAbstractComponent,
    } = TemplatePreprocessor;

    if (!this.ast) {

      this.metadata.cssDependencies = { own: [], all: [] };
      this.metadata.jsDependencies = { own: [], all: [] };

      this.generateClassesInfo();

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

      if (!this.isPartial) {
        this.invokeComponentLifecycleMethod('beforeCompile');
      }

      this.methodNames = this.validateMethodNames(
        getMethodNames(this.component),
      );

      this.ast = this.createProgram({
        locSource: this.createOwnLocSource(),
        templateSrc: this.templateSrc,
      });

      this.readHeadAttributes();

      this.bindParents = [{ type: 'root', body: this.ast.body, index: 0, properties: {} }];
    }

    if (!this.isProgramTransformed(this.ast)) {
      this.transformProgram(this.ast);
    }

    this.process0({
      contextList: this.contextList || this.getDefaultContextList(),
      bindParents: this.bindParents,
      program: this.ast,
      validateHtml,
    });

    if (!this.isPartial) {
      this.invokeComponentLifecycleMethod('afterCompile');
    }
  }

  createOwnLocSource(decoratorName) {
    const { createLocSource } = TemplatePreprocessor;
    return createLocSource({
      base: this.className, fileName: 'index.view', decoratorName,
    });
  }

  generateClassesInfo() {
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

      let ast;

      try {
        ast = parseScript(componentSrc);
      } catch (e) {
        this.logger.error(`Error detected while processing file: ${filePath}`);
        throwError(e);
      }

      const cd = getMainClassDeclaration(ast);

      const className = cd.id.name;
      const assetId = dirName.replace(/-/g, '_');

      if (classesInfo[className]) {
        throwError(`[${dirName}/${className}] Component class name is already defined in ${classesInfo[className].dir}`);
      }

      Object.values(classesInfo).forEach(o => {
        if (o.assetId == assetId) {
          throwError(`[${dirName}/${className}] AssetId "${assetId}" is already associated with ${o.dir}`);
        }
      })

      classesInfo[className] = {
        dir,
        assetId,
        classDeclaration: cd,
        isAbstract: getIsAbstractFromClassDeclaration(cd),
        parents: [], children: []
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

    const { ComponentClass } = this.parseComponentClass({
      dir: this.srcDir,
      disableRequire: true,
    });

    const {
      ComponentClass: testComponentClass, data: testComponentClassSrc
    } = this.parseComponentClass({
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

    this.emitAssetId();

    this.emitGlobalHelpers();

    this.emitPathBlockAssociations();

    this.emitLogicGates();

    this.emitDependencies();

    this.createSchema();

    this.generateSchemaAndSamples();

    this.emitMetadata();

    // refresh component instance
    this.serializeAst();

    this.writeAssetsToFileSystem();

    this.updateComponentList();
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
    const { getComponentsDistPath, getSchemaFilePath, loadJson } = TemplatePreprocessor;

    const samples = this.resolver.getSamples();

    const schema = utils.deepClone({
      ...this.schema,
      pathRefs: undefined,
    });


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
      const assetId = this.getAssetIdFromClassName(parent);

      const dir = pathLib.join(getComponentsDistPath(), assetId);

      const { recursive } = this.getConfig(parent);
      const parentSchema = loadJson(getSchemaFilePath(assetId));

      const recursiveRootSuffix = `_Root`;

      // Ensure unique keys in component data
      parentSchema.definitions[parent].required
        .forEach(k => {
          if (schema.definitions[this.className].required.includes(k)) {
            throw Error(`Duplicate field '${k}' found when comparing schema from parent`);
          }
        })

      if (recursive) {
        parentSchema.definitions[`${parent}${recursiveRootSuffix}`] = parentSchema.definitions[parent];
        parentSchema.definitions[parent] = {
          type: 'object',
          additionalProperties: false,
          required: [],
          title: parent,
          properties: {},
          isComponentRef: true
        }
      }

      Object.entries(parentSchema.definitions)
        .forEach(([k, v]) => {

          if ((k === parent && !v.isComponentRef) || k == `${parent}${recursiveRootSuffix}`) {
            const rootDef = schema.definitions[this.className];

            Object.entries(v.properties).forEach(([k, v]) => {
              rootDef.required.push(k);
              rootDef.properties[k] = v;
            });

          } else {

            if (v.isComponentRef) {
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

  parseComponentClass({
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
  }

  addDependencyAsset({ stmt, type }) {
    const { getHashValue } = TemplatePreprocessor;

    const urlValue = getHashValue({ stmt, key: 'url' });
    const namespaceValue = getHashValue({ stmt, key: 'namespace' });
    const screenTargetValue = getHashValue({ stmt, key: 'screenTarget' });

    const validate = (attrName, hashValue, required) => {
      if (!hashValue) {
        if (required) {
          this.throwError(`${type} imports must contain a "${attrName}" hash value`, stmt)
        }
        return;
      }

      const validTypes = ['PathExpression', 'StringLiteral'];

      if (!validTypes.includes(hashValue.type)) {
        this.throwError(`"${attrName}" can only have any of the following types [${validTypes}]`, hashValue)
      }
    }

    validate('url', urlValue, true)
    validate('namespace', namespaceValue)
    validate('screenTarget', screenTargetValue)

    let { original: url } = urlValue;
    let { original: namespace } = namespaceValue || {};
    let { original: screenTarget } = screenTargetValue || {};

    const dep = { url };

    if (screenTarget) {
      dep.screenTargets = screenTarget.split('|');
    }

    if (type == 'js' && namespace) {
      dep.namespace = namespace;
    }

    switch (type) {
      case 'css':
        this.metadata.cssDependencies.own.push(dep);
        break;
      case 'js':
        this.metadata.jsDependencies.own.push(dep);
        break;
    }
  }

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
          url: `/components/${this.assetId}/${minifiedFileName}.map`,
        },
        compress: true,
        mangle: true,
      });
    if (error) {
      throw Error(error);
    }


    const mapFilePath = pathLib.join(distPath, `${minifiedFileName}.map`);
    const mapFileContents = new TextEncoder().encode(map);

    fs.writeFileSync(mapFilePath, mapFileContents);

    utils.getCompressedFiles(mapFilePath, mapFileContents)
      .forEach(([p, c]) => {
        fs.writeFileSync(p, c)
      });


    const indexFilePath = pathLib.join(distPath, minifiedFileName);
    const indexFileContents = new TextEncoder().encode(
      `${code}\n//# sourceURL=/components/${this.assetId}/${minifiedFileName}`
    );

    fs.writeFileSync(indexFilePath, indexFileContents);

    utils.getCompressedFiles(indexFilePath, indexFileContents)
      .forEach(([p, c]) => {
        fs.writeFileSync(p, c)
      });
  }

  addJsDependency({ stmt }) {
    this.addDependencyAsset({ stmt, type: 'js' });
  }

  addCssDependency({ stmt }) {
    this.addDependencyAsset({ stmt, type: 'css' });
  }

  serializeAst() {
    const { incremetallyWriteComponentJs, getTransientFields, toAstString } = TemplatePreprocessor;

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

    const { ComponentClass } = this.parseComponentClass({
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

  emitGlobalHelpers() {
    const { getValue } = TemplatePreprocessor;
    const { globalHelpers = [] } = this.metadata;

    this.wrapExpressionAsMethod({
      name: 'globalHelpers',
      returnExpression: getValue([...new Set(globalHelpers)]),
      canMergeWithParent: false,
    });
  }

  emitPathBlockAssociations() {
    const { getValue } = TemplatePreprocessor;
    const { pathBlockAssociations = {} } = this.metadata;

    this.wrapExpressionAsMethod({
      name: 'pathBlockAssociations',
      returnExpression: getValue(pathBlockAssociations),
      canMergeWithParent: false,
    });
  }

  emitLogicGates() {
    const { getValue } = TemplatePreprocessor;
    this.wrapExpressionAsMethod({
      name: 'logicGates',
      returnExpression: getValue(this.logicGates),
      canMergeWithParent: false,
    });
  }

  emitDependencies() {
    const { cssDependencies: cssDeps } = this.metadata;
    const { jsDependencies: jsDeps } = this.metadata;

    this.emitMethodReturningArray({ name: 'ownCssDependencies', value: cssDeps.own, canMergeWithParent: true });
    this.emitMethodReturningArray({ name: 'ownJsDependencies', value: jsDeps.own, canMergeWithParent: true });

    this.emitMethodReturningArray({ name: 'allCssDependencies', value: cssDeps.all, canMergeWithParent: true });
    this.emitMethodReturningArray({ name: 'allJsDependencies', value: jsDeps.all, canMergeWithParent: true });
  }

  dataBindingEnabled() {
    const { dataBindingEnabled = true } = this.resolver.config;
    return !!dataBindingEnabled;
  }

  emitMetadata() {
    const { getScalarValue, getArrayValue } = TemplatePreprocessor;

    this.wrapExpressionAsMethod({
      name: 'dataBindingEnabled',
      returnExpression: getScalarValue(this.dataBindingEnabled()),
      canMergeWithParent: false,
    });

    this.wrapExpressionAsMethod({
      name: 'getComponentName',
      returnExpression: getScalarValue(this.className),
    });

    this.wrapExpressionAsMethod({
      name: 'hasBlockTransform',
      returnExpression: getScalarValue(!!this.metadata.hasBlockTransform),
      canMergeWithParent: { boolenOperator: 'or' }
    });

    this.wrapExpressionAsMethod({
      name: 'renderedCollections',
      returnExpression: getArrayValue(this.metadata.renderedCollections || []),
      canMergeWithParent: true,
    });

    this.wrapExpressionAsMethod({
      name: 'nonNullPaths',
      returnExpression: getArrayValue(this.metadata.nonNullPaths || []),
    });

    this.wrapExpressionAsMethod({
      name: 'hasStaticPath',
      returnExpression: getScalarValue(!!this.metadata.hasStaticPath),
    });
  }

  emitMethodReturningArray({ name, value, canMergeWithParent, isStatic = false }) {
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
      isStatic,
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
        `Property "${value}" is not allowed because "${key}" seems to resolve a literal`, stmt
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

  validateType({ path, value, validType, nameQualifier, line, allowEmptyCollection }) {
    return this.component.validateType({
      path, value, validType, nameQualifier, line, allowEmptyCollection
    });
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

      this.validateType({
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
      dataPathRoot, pathSeparator, globalsBasePath, getTargetType, throwError,
    } = TemplatePreprocessor;

    const type = this.component.getGlobalVariableTypes()[path];

    if (!type) {
      return null;
    }

    const targetValue = this.getSampleValueForType(type);

    if (!targetValue) {
      throwError(`Unknown type "${type}" specified for global variable "${path}"`);
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
        return this.getSerializedComponent(null, BaseComponent.name, null, false);
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
      objectType, componentRefType, appendSuffix, hasObjectPrefix, defaultIndexResolver, getTargetType, getLine, getSuffix,
      isResolvableInScope, throwCannotAccessIterateContextInAsync, getSampleValueForLiteralType, getOuterInlineBlock,
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
                ctx: v, suffix: getSuffix(original), syntheticAlias, stmt,
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

        this.validateType({
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

          const fqPath0 = original.replace(dataPathPrefixRegex, '');
          const fqPath = `${fqPath0}${typeSuffix}`;

          value = this.component
            .resolvePath({
              fqPath,
              create,
              indexResolver: defaultIndexResolver,
              stmt,
            });

          if (value == null && validType == componentRefType) {
            const { typeProperty, nameProperty } = PathResolver;

            const p = this.#getExecPath(fqPath0);

            const pathInfo = this.resolver.getPathInfo(p);

            if (!pathInfo) {
              this.throwError(`Expected "${stmt.original}" to resolve to a component but got null instead`, stmt);
            }

            // As per the logic in getSerializedComponent(...), our resolver will return null when we are resolving a component
            // that matches the current component being compiled, hence if that's the case here, we want to specify <targetType>

            const { [typeProperty]: type, [nameProperty]: name } = pathInfo;

            if (name == this.className) {
              targetType = this.className;
            }
          }
        }

        if (validateType) {

          this.validateType({
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

    targetType = targetType || getTargetType(value);
    targetValue = value;

    return {
      type, original, targetType, targetValue, synthetic, canonicalSource,
    };
  }

  #getExecPath(fqPath) {
    const { defaultIndexResolver } = TemplatePreprocessor;

    return this.component.getExecPath({
      fqPath,
      indexResolver: defaultIndexResolver,
    });
  }

  #toRuntimeCanonicalPath(original) {
    const { dataPathPrefixRegex } = TemplatePreprocessor;

    const execPath = this.#getExecPath(
      original.replace(dataPathPrefixRegex, '')
    );

    return clientUtils.toCanonicalPath0(execPath);
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

    const path = this.component.getExecPath({
      fqPath: original
        .replace(`${dataPathRoot}${pathSeparator}`, ''),
      indexResolver: defaultIndexResolver,
    });

    const value = this.resolver.resolve({ path, create: !stmt.immutable });

    this.validateType({
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
    const { getVariableEnvelope, getScalarValue } = TemplatePreprocessor;

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

  static mergeExpressionWithParentInvocation(expr, methodName, opts) {
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
        const { boolenOperator } = opts;

        return {
          type: 'LogicalExpression',
          operator: (boolenOperator == 'or') ? '||' : '&&',
          left: arr[0].argument,
          right: expr,
        }

      default:
        throwError(`Unknown expression "${expr.type}"`);
        break;
    }
  }

  // Todo: Remove if not used
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
    name, addSyntheticPrefix = true, statements = [], returnExpression, canMergeWithParent = false, isStatic = false,
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
      const [parent] = this.metadata.parents;

      if (canMergeWithParent && parent) {
        assert(addSyntheticPrefix && name);

        const opts = (typeof canMergeWithParent == 'object') ? { ...canMergeWithParent } : {}

        returnExpression = mergeExpressionWithParentInvocation(
          returnExpression,
          `${syntheticMethodPrefix}${name}`, opts,
        )
      }

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
          isStatic,
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

      const ctx = utils.peek(contextList)[rootQualifier];
      assert(ctx);

      hash[ctxHashKey] = getProxyStatement({
        path: ctx.value,
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

  #getAllCssDependencies() {
    return [...this.metadata.cssDependencies.all, ...this.metadata.cssDependencies.own];
  }

  #getAllJsDependencies() {
    return [...this.metadata.jsDependencies.all, ...this.metadata.jsDependencies.own];
  }

  #addToRenderTree(className) {
    const { loadJson, getBootConfigFilePath } = TemplatePreprocessor;

    if (className == this.className) return;

    const renderTree = this.#getRenderTree();
    const { assetId } = global.classesInfo[className];

    if (renderTree[assetId]) return;

    global.components[className];

    const bootConfig = loadJson(getBootConfigFilePath(assetId));

    Object.values(bootConfig.renderTree)
      .forEach(className => {
        this.#addToRenderTree(className);
      });


    const _cssDeps = this.#getAllCssDependencies().map(({ url }) => url);
    const _jsDeps = this.#getAllJsDependencies().map(({ url }) => url);

    bootConfig.cssDependencies
      .filter(({ url }) => !_cssDeps.includes(url))
      .forEach(dep => {
        this.metadata.cssDependencies.all.push(dep);
      });

    bootConfig.jsDependencies
      .filter(({ url }) => !_jsDeps.includes(url))
      .forEach(dep => {
        this.metadata.jsDependencies.all.push(dep);
      });

    renderTree[assetId] = className;
  }

  #getRenderTree() {
    return this.metadata.renderTree || (this.metadata.renderTree = {});
  }

  addParameterizedExpression({
    pruneKey, bindParents, contextList, context, stmt, invokeMethodName, methodName,
    params = [], hash = { pairs: [] }, syntheticAlias, astHook, loc,
  }) {

    const {
      syntheticMethodPrefix, literalPrefix, loadInlineComponentHelperName, getVariableEnvelope, getScalarConstantAssignmentStatement,
      getCallExpression, createMemberExpression, resetPathExpression, getProxyStatement, createInvocationWithOptions,
      getFunctionDeclarationFromArrowFunction, getMethodFromFunctionDeclaration, isRootCtxValue, getValue, onSubExpressionProcessed,
      hasDataPathFormat, createArrowFunctionExpression, getLiteralValueFromPathExpression, getScalarValue,
    } = TemplatePreprocessor;

    if (!pruneKey) {
      assert(context == null);
      pruneKey = `_${utils.generateRandomString()}`;
    }

    const isInlineComponent = (invokeMethodName || methodName) == loadInlineComponentHelperName;

    // Add hash to paramList
    const paramList = [
      // Note: It's important to maintain this paramList order, because we need to process
      // params first, hash next. This enables us to conform to the convention: that "onResolve" callback
      // can be added to a param which may trigger an update in the hash, which in turn will then
      // reflect in the outputted ast
      {
        type: 'Hash',
        original: hash,
      },
      ...params,
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

    let hasUnprocessedParams = false;

    // eslint-disable-next-line no-plusplus
    for (let i = paramList.length - 1; i >= 0; i--) {
      const param = paramList[i];

      const variableName = utils.generateRandomString();

      let statement;

      switch (true) {
        case param.type.endsWith('Literal'):
          statement = getScalarConstantAssignmentStatement(variableName, param.original);

          if (isInlineComponent) {
            const { original: targetComponent } = param;

            param.targetComponent = targetComponent;

            this.#addToRenderTree(targetComponent);
          }
          break;

        case param.type === 'Hash':
          statement = this
            .getHelperOptions({
              pruneKey,
              bindParents,
              contextList,
              variableName,
              hash: param.original,
              loc,
            });

          if (!statement) {
            hasUnprocessedParams = true;
          }
          break;

        case param.type === 'PathExpression':

          if (param.processed) {
            assert(isRootCtxValue(param.original));

            statement = getVariableEnvelope(variableName);

            statement.declarations[0].init = param.literalType ?
              getScalarValue(
                getLiteralValueFromPathExpression(param)
              ) :
              getProxyStatement({
                path: param.original,
              });

            break;
          }

          // eslint-disable-next-line no-underscore-dangle
          let _path;
          let literalType;

          if (this.methodNames.includes(param.original)) {
            _path = syntheticMethodPrefix + param.original;

            // The declared path expression is a method in
            // in the component class, hence invoke function

            statement = getVariableEnvelope(variableName);

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
              literalType = path.type;

              statement = getScalarConstantAssignmentStatement(
                variableName, path.original,
              );
            } else {
              assert(path.type === 'PathExpression');

              if (hasDataPathFormat(path.original)) {
                path.original = this.invokeDataPathTransform(path.original, param);
              }

              _path = path.original;

              statement = getVariableEnvelope(variableName);
              statement.declarations[0].init = getProxyStatement({
                path: _path,
              });
            }
          }

          // update param
          resetPathExpression({
            stmt: param,
            original: _path,
            properties: { literalType, processed: true },
          });

          break;

        case param.type === 'SubExpression':

          // eslint-disable-next-line no-shadow
          const invokeMethodName = param.path.original;
          this.validateMethod(invokeMethodName);

          statement = getVariableEnvelope(variableName);
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
            loc,
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

      if (param.type == 'Hash') {
        body.splice(body.length - 1, 0, statement);
      } else {
        body.unshift(statement);
      }
    }

    if (hasUnprocessedParams) {
      return false;
    }

    // add function invocation params in return statement
    body[body.length - 1].argument.arguments = [];

    for (let i = 0; i < body.length - 1; i++) {
      body[body.length - 1].argument.arguments.push(
        body[i].declarations[0].id
      );
    }

    if (context) {
      context.callee = ast;
    } else {

      // This high-level SubExpression has now been fully processed
      // During the course of processing, we may have added provisional functions to the ast for nested 
      // sub expressions... those are not longer needed and should be removed from the ast...
      // Note: In some cases (e.g. see excludeSubExpressionsFromPrune(...)), we may not want to prune some 
      // provisional functions that have been added to the ast, in which case those ast entries will be 
      // marked "prune: false"

      this.pruneComponentAst({ pruneKey });

      if (syntheticAlias) {

        assert(stmt);

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
            loc: { ...loc },
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


      // Update stmt, if applicable
      if (stmt) {
        onSubExpressionProcessed(stmt);

        // Finally, update from SUB_EXPR to P_EXPR
        resetPathExpression({
          stmt,
          original: synthethicMethodName,
          properties: { processed: true },
        });

        if (isInlineComponent) {
          const [{ targetComponent }] = params;

          if (targetComponent) {
            stmt.targetComponent = targetComponent;
          }
        }
      }

      return synthethicMethodName;
    }
  }

  #addResolvedComponentToRenderTree({ alias, loc, targetValue, targetType }) {

    if (targetValue) {
      const { forBaseComponent, subClasses } = targetValue.getMetaInfo()['resolverInfo'];

      if (subClasses) {

        subClasses.forEach(className => {
          this.#addToRenderTree(className);
        });

      } else {

        if (forBaseComponent) {
          this.metadata.dynamicBootConfig = true;
        } else {
          this.#addToRenderTree(targetType);
        }
      }
    } else {

      if (targetType != this.className) {
        this.throwError(`Expected "${alias}" to resolve to a component but got null instead`, { loc });
      }
    }
  }

  getHelperOptions({ pruneKey, bindParents, contextList, variableName, hash, loc }) {
    const {
      syntheticMethodPrefix, literalPrefix, rootQualifier, getScalarValue, getVariableEnvelope, resetPathExpression,
      getProxyStatement, createInvocationWithOptions, getFunctionDeclarationFromArrowFunction, hasDataPathFormat,
      getMethodFromFunctionDeclaration, isRootCtxValue, getValue, getDefaultHelperHash, onSubExpressionProcessed,
      getLiteralValueFromPathExpression,
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

          if (value.processed) {
            assert(isRootCtxValue(value.original));

            hashObject.properties.push(
              getProperty({
                key,
                value: value.literalType ?
                  getScalarValue(
                    getLiteralValueFromPathExpression(value)
                  ) :
                  getProxyStatement({
                    path: value.original,
                  }),
                stmt: value,
              }),
            );
            break;
          }

          // eslint-disable-next-line no-underscore-dangle
          let _path;
          let literalType;

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
              literalType = path.type;

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
                path.original = this.invokeDataPathTransform(path.original, value);
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
            properties: { literalType, processed: true },
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

    if (
      hasUnprocessedParams ||
      // getDefaultHelperHash(...) needs a context root
      !utils.peek(contextList)[rootQualifier]
    ) {
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
    const { literalPathPrefixRegex, throwError } = TemplatePreprocessor;
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
        return JSON.parse(val);
      case 'NumberLiteral':
        assert(Number.isInteger(val));
        return Number(val);
      case 'StringLiteral':
        return val;
      default:
        throwError(`Unknown type "${stmt.literalType}"`, stmt);
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
      const methodName = body[i].key.name;

      if (methodName.endsWith(pruneKey) && body[i].prune) {
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

  static getPreservedPathExpressionAttibutes() {
    return ['loc', 'participantType', 'canonicalSource'];
  }

  static toParts(original) {
    const { literalPathPrefixRegex } = TemplatePreprocessor;
    return original.match(literalPathPrefixRegex) ? [original] : original.split('.');
  }

  static resetPathExpression({ stmt, original, properties = {} }) {
    const { getPreservedPathExpressionAttibutes, toParts } = TemplatePreprocessor;

    getPreservedPathExpressionAttibutes()
      .forEach(k => {
        if (properties[k] === undefined && stmt[k] !== undefined) {
          properties[k] = stmt[k];
        }
      });

    const { loc } = stmt;

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

    if (!properties.loc) {
      stmt.loc = loc;
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
    ast: expression, addSyntheticPrefix = true, hasWrapper, addOptionsRetrievalStatements = true, isStatic = false,
  }) {
    const {
      syntheticMethodPrefix, renderMethodName, getBlockWrapperIdMethodName, getCallExpression, getValue,
      getIdentifier, getVariableEnvelope, getOptionsRetrievalStatements, createPromise, createArrowFunctionExpression,
    } = TemplatePreprocessor;

    // Update method name, to indicate that it's synthetic
    expression.id.name = `${addSyntheticPrefix ? syntheticMethodPrefix : ''}${expression.id.name}`;

    if (hasWrapper) {
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
                methodName: getBlockWrapperIdMethodName,
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
      static: isStatic,
    };

    const program = Object.assign({}, expression);

    program.type = 'FunctionExpression';
    program.id = null;

    envelope.value = program;

    return envelope;
  }

  addGlobalHelper(helperName, bindParents) {
    const globalHelpers = this.metadata.globalHelpers || (this.metadata.globalHelpers = []);
    globalHelpers.push(helperName);
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

      // eslint-disable-next-line no-eval
      eval(`blockData.${cacheKey} = '${synthethicMethodName}'`);
    }

    return synthethicMethodName;
  }

  createDataVariableGetter({ path, dataVariable }) {
    return this.createBlockOperation({
      cacheKey: `dataVariableMethods['${dataVariable}']`,
      path,
      methodName: 'getBlockData',
      args: { dataVariable },
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
              value: this.createDataVariableGetter({
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
    bindParents, contextList, method, params = [], hash, syntheticAlias, stmt, loc,
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

    if (stmt) {
      loc = stmt.loc;
    }

    const synthethicMethodName = this.addParameterizedExpression({
      bindParents,
      contextList,
      invokeMethodName: method,
      methodName,
      stmt,
      loc,
      params,
      hash,
      syntheticAlias,
    });

    if (!synthethicMethodName) {
      return false;
    }

    return synthethicMethodName;
  }

  static createSubExpressionFromPath({ stmt }) {
    const { createPathExpression } = TemplatePreprocessor;
    const { original, loc } = stmt;

    return {
      type: 'SubExpression',
      path: createPathExpression({ original }),
      params: [],
      loc,
      fromPath: true,
    };
  }

  static createPathExpression({ original, loc }) {
    const { toParts } = TemplatePreprocessor;
    return {
      type: 'PathExpression',
      data: false,
      depth: 0,
      parts: toParts(original),
      original,
      loc,
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

    return this.createRootProxyIndirection0({
      stmt, canonicalSource, path, suffix, syntheticAlias
    });
  }

  createRootProxyIndirection0({ stmt, canonicalSource, path, suffix, syntheticAlias }) {
    const {
      getCallExpression, getMethodFromFunctionDeclaration, getScalarValue, getValue,
      getPathFromSyntheticAlias, isConditionalParticipant, createArrowFunctionExpression,
      getProxyStatement, throwMethodInvocationCannotBeConditional, appendSuffix,
      getIdentifier,
    } = TemplatePreprocessor;

    const lenient = stmt && isConditionalParticipant(stmt);

    if (!suffix && lenient) {
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
        methodName: 'unsafeEvaluate',
        args: [
          {
            type: 'Identifier',
            name: valueVariableName,
          },
          lenient,
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

  static addScopeVariableHashKey(stmt, value) {
    const { scopeVariableHashKey, createStringLiteral } = TemplatePreprocessor;
    const hash = stmt.hash || (stmt.hash = { type: 'Hash', pairs: [] });

    assert(value);

    hash.pairs.push({
      type: 'HashPair',
      key: scopeVariableHashKey,
      value: createStringLiteral(value)
    });
  }

  static addIndexVariableHashKey(stmt, value) {
    const { indexVariableHashKey, createStringLiteral } = TemplatePreprocessor;
    const hash = stmt.hash || (stmt.hash = { type: 'Hash', pairs: [] });

    assert(value);

    hash.pairs.push({
      type: 'HashPair',
      key: indexVariableHashKey,
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
    const { customBlockGateSuffix, createPathExpression } = TemplatePreprocessor;

    const original = this.createCustomBlockPath({
      methodName: stmt.path.original,
      stmt,
      isCustomContext,
    });

    stmt.path = createPathExpression({
      original: `${original}${!isCustomContext ? customBlockGateSuffix : ''}`,
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
            const { type: _type } = pair.value;

            const suffix = `but saw "${_type}"`;

            if (typeof type == 'string' && pair.value.type !== type) {
              throwError(`Expected hash value for key "${key}" to be of type "${type}" ${suffix}`, stmt);
            }
            if (type instanceof Array && !type.includes(pair.value.type)) {
              throwError(`Expected hash value for key "${key}" to be any of the types: ${type} ${suffix}`, stmt);
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

    const { hasWrapper } = stmt;

    const ast = (
      hasWrapper
        ? this.getCustomBlockFuntionInHtmlWrapper : this.getCustomBlockFuntion
    )({ methodName, stmt, isCustomContext });

    this.componentAst.body[0].body.body
      .push(getMethodFromFunctionDeclaration({ ast }));

    return ast.id.name;
  }

  getCustomBlockFuntionInHtmlWrapper({ methodName, stmt, isCustomContext }) {
    const {
      validateTypeMethodName, renderBlockMethodName, renderMethodName, getLoaderMethodName,
      getBlockWrapperIdMethodName, captureStateMethodName, getIdentifier, createPromise,
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
              methodName: getBlockWrapperIdMethodName,
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
      getIdentifier, createMemberExpression, getCallExpression, getValue, getOptionsRetrievalStatements,
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
      arrayType, objectType, mapType, addDefaultParamToCustomBlock, defaultBlockName, createBooleanLiteral,
      ensureNoLiteralParam0, createPathExpression, throwError, resetPathExpression
    } = TemplatePreprocessor;

    const blockName = stmt.path.original;
    const {
      scopeQualifier, indexQualifier,
    } = this.getBlockQualifiers({ stmt });

    let validType;
    let contextSwitching = false;
    let iterateBlock = false;
    let conditional = false;
    let custom = false;
    let requiresScopeQualifier = true;
    let allowLiteralParams = false;

    switch (stmt.path.original) {
      case defaultBlockName:
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
        iterateBlock = true;

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
        // Implode into a single SubExpression

        const path = stmt.params.shift();

        if (path.type != 'PathExpression') {
          throwError(`Expected a PathExpression as the first param of this block`, stmt);
        }

        stmt.params = [{
          type: 'SubExpression',
          path,
          params: stmt.params,
          loc: {
            ...path.loc,
            end: utils.peek(stmt.params).loc.end,
          }
        }]
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
      iterateBlock,
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
    const { getLine, throwError0 } = TemplatePreprocessor;
    if (typeof err == 'string') {
      throw throwError0(`${stmt ? `[${getLine(stmt)}] ` : ''}${err}`);
    } else {
      throw err;
    }
  }

  static throwError0(err) {
    throw new TemplateError(err);
  }

  throwError(msg, stmt) {
    const { throwError } = TemplatePreprocessor;
    throwError(msg, stmt);
  }

  getSyntheticMethodValue({ stmt, source, method, validType, line }) {
    const { literalType, throwError, getLine } = TemplatePreprocessor;

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

    return (validType && validType != literalType) ? this.validateType({
      path: source,
      value,
      validType,
      line,
    }) : value;
  }

  static isRootCtxValue(value) {
    const { dataPathRoot, syntheticMethodPrefix, dataPathPrefixRegex } = TemplatePreprocessor;
    return value == dataPathRoot || value.match(dataPathPrefixRegex) || value.startsWith(syntheticMethodPrefix);
  }

  static addRawDataPrefixToPath0(original) {
    const { pathSeparator, dataPathRoot, rawDataPrefix, syntheticMethodPrefix } = TemplatePreprocessor;

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
    const { addRawDataPrefixToPath0, isRootCtxValue, addRawDataPrefixToPath, resetPathExpression } = TemplatePreprocessor;

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

    const { original } = stmt;

    assert(isRootCtxValue(original))

    resetPathExpression({
      stmt,
      original: addRawDataPrefixToPath0(original),
    });

    return stmt;
  }

  static isLookupAllowed(targetType) {
    const { arrayType, objectType, mapType } = TemplatePreprocessor;
    return [arrayType, objectType, mapType].includes(targetType);
  }

  #getIterateBlockFactor(outerIterateBlocks) {
    const { dataPathPrefixRegex, pathSeparator } = TemplatePreprocessor;
    const defaultIterateBlockFactor = 5;

    let i = 1;

    outerIterateBlocks.forEach(path => {
      let j = defaultIterateBlockFactor;

      if (path.match(dataPathPrefixRegex)) {
        const p = path.replace(dataPathPrefixRegex, '').split(pathSeparator).join('.');

        let { collections } = this.resolver.config;
        const [parent] = this.metadata.parents;

        if (parent) {
          collections = {
            ...collections,
            ...this.getNonNullConfig(parent).collections,
          }
        }

        const { minLength } = collections[p];

        if (minLength) {
          j = minLength;
        }
      }

      i *= j;
    });

    return i;
  }

  addDataBindTransformations(ast, decoratorConfig, terminal) {

    const {
      customEachHelperName, textBindContextHelperName, startAttrCtxHelperName, endAttrCtxHelperName, htmlWrapperCssClassname,
      createContentStatement, createMustacheStatement, throwError, createNumberLiteral, getLine, throwError0,
      createStringLiteral, getVisitor,
    } = TemplatePreprocessor;

    // Default hytax tokens
    const OPEN_TAG_START_SCRIPT = 'token:open-tag-start-script';
    const OPEN_TAG_START_STYLE = 'token:open-tag-start-style';
    const OPEN_TAG_START = 'token:open-tag-start';

    const OPEN_TAG_END_SCRIPT = 'token:open-tag-end-script';
    const OPEN_TAG_END_STYLE = 'token:open-tag-end-style';
    const OPEN_TAG_END = 'token:open-tag-end';

    const TOKEN_CLOSE_TAG_SCRIPT = 'token:close-tag-script';
    const TOKEN_CLOSE_TAG_STYLE = 'token:close-tag-style';
    const CLOSE_TAG = 'token:close-tag';

    const ATTR_VALUE_WRAPPER_START = 'token:attribute-value-wrapper-start';
    const ATTR_VALUE_WRAPPER_END = 'token:attribute-value-wrapper-end';
    const ATTR_KEY = 'token:attribute-key';
    const ATTR_ASSIGNMENT = 'token:attribute-assignment';
    const ATTR_VALUE = 'token:attribute-value';
    const TEXT = 'token:text';

    // Custom tokens
    const BLOCK_PROGRAM_START = 'token:block-program-start';
    const BLOCK_PROGRAM_END = 'token:block-program-end';
    const BLOCK_INVERSE_START = 'token:block-inverse-start';
    const BLOCK_INVERSE_END = 'token:block-inverse-end';
    const ATTR_VALUE_SEGMENT = 'token:attribute-value-segment';

    const DIR_LTR = 'ltr';
    const DIR_RTL = 'rtl';

    const streamTokenizer = new StreamTokenizer();

    const bindParents = [{ body: ast.body, tokenList: [] }];

    const statements = [];

    let currentNodeIndex = 0;

    const _this = this;

    const nextNodeIndex = () => currentNodeIndex++;

    const getTokenList = () => bindParents[0].tokenList;

    const getTokenListInScope = () => utils.peek(bindParents).tokenList;

    const addToTokenList = (tokens) => {
      tokens.forEach(token => {
        bindParents.forEach(({ tokenList }) => {
          tokenList.push(token);
        });
      });
    }

    const getOuterIterateBlocks = () => bindParents.filter(({ original }) => isIterateBlock(original));

    const addEstimatedSizeToObject = (obj, i) => {
      if (obj.estimatedHookSize === undefined) {
        obj.estimatedHookSize = 0;
      }
      obj.estimatedHookSize += i;
    }

    const getNonRootBindParents = () => bindParents.filter(({ body }) => body != ast.body);

    const addToHookSize = (factor, stmt) => {
      const bindParents = getNonRootBindParents();

      if (decoratorConfig) {
        factor *= this.#getIterateBlockFactor(decoratorConfig.outerIterateBlocks);
      }

      let i;

      if (bindParents.length) {
        const outerIterateBlocks = getOuterIterateBlocks();

        i = factor * this.#getIterateBlockFactor(
          outerIterateBlocks.map(({ resolvedParam }) => resolvedParam)
        );

        addEstimatedSizeToObject(bindParents[0].blockMetadata, i);

      } else {
        i = factor;

        if (stmt) {
          addEstimatedSizeToObject(stmt, i);
        }
      }

      return i;
    }

    const createBlockHtmlWrapper = ({ stmt }) => {
      const { htmlWrapperCssClassname, blockWrapperIdHelperName } = TemplatePreprocessor;

      const tagName = 'div';

      const { parent, loc } = stmt;

      const index = parent.body.indexOf(stmt);
      assert(index >= 0);

      const nodeIndex = nextNodeIndex();

      replacements.push({
        parent: parent.body,
        replacementIndex: index,
        replacementNodes: [
          createContentStatement({
            original: `<${tagName} id='`, loc,
          }),
          createMustacheStatement({
            original: blockWrapperIdHelperName,
            params: [createNumberLiteral(nodeIndex)],
            loc,
          }),
          createContentStatement({
            original: `' class='${htmlWrapperCssClassname}'>\n`, loc,
          }),
        ],
      });

      replacements.push({
        parent: parent.body,
        replacementIndex: index + 1,
        replacementNodes: [
          createContentStatement({
            original: `\n</${tagName}>`, loc,
          }),
        ],
      });

      return nodeIndex;
    };

    const createTextNodeBindWrapper = ({ stmt }) => {
      const { parent, loc } = stmt;

      const tagName = 'span';

      const index = parent.body.indexOf(stmt);
      assert(index >= 0);

      replacements.push({
        parent: parent.body,
        replacementIndex: index,
        replacementNodes: [
          createContentStatement({
            original: `<${tagName} class='${htmlWrapperCssClassname}' id='`, loc
          }),
          createMustacheStatement({ original: textBindContextHelperName, loc, }),
          createContentStatement({
            original: '\'>', loc,
          }),
        ],
      });

      replacements.push({
        parent: parent.body,
        replacementIndex: index + 1,
        replacementNodes: [
          createContentStatement({
            original: `</${tagName}>`, loc,
          }),
        ],
      });
    };

    const createEndAttributeCtxStatement = ({ stmt, nodeIndex }) => {
      const { type, parent, original, loc } = stmt;

      assert(type == 'ContentStatement');
      assert(['/>', '>'].includes(original));

      const index = parent.body.indexOf(stmt);
      assert(index >= 0);

      replacements.push({
        parent: parent.body,
        replacementIndex: index,
        replacementNodes: [
          createMustacheStatement({
            original: endAttrCtxHelperName,
            params: [createNumberLiteral(nodeIndex)],
            loc,
          }),
        ],
      });
    };

    const createStartAttributeCtxStatement = ({ stmt }) => {
      const { type, parent, loc, original } = stmt;

      assert(type == 'ContentStatement');
      assert(original == '<');

      const index = parent.body.indexOf(stmt);
      assert(index >= 0);

      replacements.push({
        parent: parent.body,
        replacementIndex: index + 1,
        replacementNodes: [
          createMustacheStatement({ original: startAttrCtxHelperName, loc, }),
        ],
      });
    };

    // Todo: Remove if not used
    const mergeAttributeValueSegments = (tokens) => {
      const arr = [];
      let buf = '';

      for (const token of tokens) {
        const { type, content } = token;

        switch (true) {
          case type == ATTR_VALUE_SEGMENT:
            buf += content;
            break;

          case type == ATTR_VALUE_WRAPPER_END:
            if (buf.length) {
              arr.push({ type: ATTR_VALUE, content: buf });
              buf = '';
            }

          default:
            arr.push(token);
            break;
        }
      }

      return arr;
    }

    const getAttributeTokens = ({ tokenList, index }) => {
      const allowedTokens = [
        OPEN_TAG_START_SCRIPT, OPEN_TAG_START_STYLE, OPEN_TAG_START,
        ATTR_KEY, ATTR_ASSIGNMENT, ATTR_VALUE, ATTR_VALUE_SEGMENT,
        ATTR_VALUE_WRAPPER_START, ATTR_VALUE_WRAPPER_END,
      ];
      const openTagEnd = tokenList[index];

      assert(['>', '/>'].includes(openTagEnd.content));

      const arr = [openTagEnd];

      let i = index - 1;

      while (i >= 0) {

        const token = tokenList[i];
        assert(allowedTokens.includes(token.type));

        arr.unshift(token);

        if (token.type.startsWith(OPEN_TAG_START)) {
          break;
        }
        // eslint-disable-next-line no-plusplus
        i--;
      }

      return arr;
    }

    const getHtmlSelfClosingElements = () => {
      return [
        "br", "img", "input", "hr", "meta", "link", "area",
        "base", "col", "colgroup", "frame", "param", "source"
      ];
    }

    const createAttributeContext = (start, end) => {
      const nodeIndex = nextNodeIndex();

      const { stmt: [startStmt] } = start.token;
      const { stmt: endStmt } = end.token;

      [start.token, end.token].forEach(token => {

        assert(token.nodeIndex == undefined);
        token.nodeIndex = nodeIndex;
      });

      createStartAttributeCtxStatement({ stmt: startStmt });

      createEndAttributeCtxStatement({ stmt: endStmt, nodeIndex });

      return nodeIndex;
    }

    const openTagName = (content) => content.replace('<', '');

    const closeTagName = (content) => content.replace('</', '').replace('>', '');

    const popTagFromTagList = (tags, tagName) => {
      for (let i = tags.length - 1; i >= 0; i--) {
        const tag = tags[i];

        if (tag.tagName == tagName) {
          const rem = tags[i];
          tags.splice(i, 1);
          return rem;
        }
      }
    }

    const useExistingParentAsBlockWrapper = ({ stmt, tokenList }) => {

      const tags = [];

      let openTagStart;
      let openTagEnd;

      let found = false;

      loop:
      for (let i = tokenList.length - 1; i >= 0; i--) {
        const token = tokenList[i];
        const { type, content } = token;

        switch (type) {

          case OPEN_TAG_START:
            const tagName = openTagName(content);

            if (popTagFromTagList(tags, tagName)) {
              continue loop;
            }

            // If no tag found, then this is the parent, given that it's not selfClosing

            if (!openTagEnd.selfClosing && !getHtmlSelfClosingElements().includes(tagName)) {
              found = true;
              openTagStart = { ...token };
              break loop;
            }

            break;

          case OPEN_TAG_END:
            openTagEnd = { ...token, selfClosing: content == '/>' };
            break;

          case CLOSE_TAG:
            tags.push({ tagName: closeTagName(content) })
            break;
        }
      }

      if (!found) {
        throwError(`This block needs to have an enclosing html element, because 'opaqueWrapper' is set to true`, stmt);
      }

      const { stmt: [start] } = openTagStart;
      const { stmt: end } = openTagEnd;


      // Use a better error message

      const throwErr = (reason) => throwError(
        `The enclosing html element at ${getLine({ loc: toTokenLoc(openTagStart) })} cannot be used as the wrapper for this block. ${reason}`,
        stmt,
      );

      if (!utils.areArrayElementsSameReference([stmt.parent, start.parent, end.parent])) {
        throwErr('Blocks must have the same parent block as their target wrapper', stmt);
      }

      const tagToken = openTagEnd;

      if (!stmt.isIterateBlock && tagToken.isWrapper) {
        throwErr('It already serves as the wrapper for another block');
      }

      tagToken.isWrapper = true;

      return {
        nodeIndex: tagToken.nodeIndex ? tagToken.nodeIndex : createAttributeContext({ token: openTagStart }, { token: openTagEnd }),
      }
    }

    const validateOpaqueIterateBlock = (tokenList, errors) => {

      const reservedAttributes = ['id', 'key'];

      let seenTag;

      const tags = [];

      for (let i = 0; i < tokenList.length; i++) {

        const token = tokenList[i];
        const { type } = token;
        const content = toTokenContent(token);

        const defaultErrMsg = (c) => `Expected Iterate block to have a single top-level html tag as it's content, but found "${c || content}"`;
        const getErr = (msg) => { `${msg} [${getLine({ loc: toTokenLoc(token) }, true)}]` };

        switch (true) {
          case type == TEXT:
            if (!tags.length && content.trim()) {
              const idx = utils.findFirstNonBlankIndex(content);
              errors.push(
                getErr(defaultErrMsg(content.substring(idx)))
              );
              return false;
            }
            break;

          case type.startsWith(OPEN_TAG_START):
            const tag = { tagName: openTagName(token.content), attributeKeys: [] }

            if (!tags.length) {
              if (seenTag) {
                errors.push(
                  getErr(defaultErrMsg())
                );
                return false;
              } else {
                seenTag = tag.tagName;
              }
            }

            tag.selfClosing = getHtmlSelfClosingElements().includes(tag.tagName);
            tags.push(tag);

            break;

          case type == ATTR_KEY:
            if (tags.length == 1 && reservedAttributes.includes(content)) {
              errors.push(
                getErr(`Unexpected HTML attribute key "${content}" - it is a reserved attribute in this context`)
              );
              return false;
            }
            break;

          case type.startsWith(OPEN_TAG_END):

            const idx = tags.length - 1;
            const { selfClosing } = tags[idx];

            if (content == '/>' || selfClosing) {
              tags.splice(idx, 1);
            }
            break;

          case type.startsWith(CLOSE_TAG):
            const tagName = closeTagName(content);
            popTagFromTagList(tags, tagName);
            break;
        }
      }

      return seenTag;
    }

    const getOpenTagEnd = (tokenList) => {
      for (let i = 0; i < tokenList.length; i++) {
        const token = tokenList[i];
        if (token.type.startsWith(OPEN_TAG_END)) {
          return i;
        }
      }
      return -1;
    }

    const getOpenTagStart = (tokenList, openTagEnd) => {
      for (let i = openTagEnd - 1; i >= 0; i--) {
        const token = tokenList[i];
        if (token.type.startsWith(OPEN_TAG_START)) {
          return i;
        }
      }
      return -1;
    }

    const isHbsToken = ({ content }) => content.startsWith('{{') && content.endsWith('}}');

    /**
     * Note: This function splits tokens that were buffered by hyntax
     * 
     * TODO: using the above logic, cater for scenarios where text tokens at the end of the 
     * file may not be processed
     */
    const splitTokens = (tokens) => {
      if (!tokens.length) return;

      const _tokens = [...tokens];

      for (let j = 0; j < _tokens.length; j++) {
        const token = _tokens[j];
        const { type, content } = token;

        if (![TEXT, ATTR_VALUE].includes(type) || !content.includes('{{')) continue;

        const segments = [];
        let buf = '';

        const addSegment = () => {
          if (buf.length) {
            segments.push(buf);
            buf = '';
          }
        }

        let i = 0;

        while (i < content.length) {

          let char = content[i];

          let previousChar = i > 0 ? content[i - 1] : null;
          let nextChar = i < content.length - 1 ? content[i + 1] : null;

          switch (true) {
            case char == '{' && nextChar == '{':
              addSegment();
              buf += char;
              break;

            case char == '}' && previousChar == '}':
              buf += char;
              addSegment();
              break;

            default:
              buf += char;
              break;
          }

          i++
        }

        addSegment();

        const ret = (type == TEXT) ? { type } : (() => {
          assert(j == 0);
          const prevToken = getTokenList().at(-1);

          return {
            type: ATTR_VALUE_SEGMENT,
            hasWrapper: prevToken.type == ATTR_VALUE_WRAPPER_START,
            groupSize: segments.length,
          }
        })();

        tokens.splice(
          tokens.indexOf(token), 1, ...segments.map(content => ({
            ...ret, content,
          }))
        );
      }

      const isContentStmt = (stmt) => stmt && stmt.type == 'ContentStatement';

      const getTailContentStmt = (stmt, offset) => {
        const { tokenizationMeta } = stmt;

        if (offset && !tokenizationMeta) return null;

        const i = tokenizationMeta.stack.length - 1 - offset;
        return tokenizationMeta ? tokenizationMeta.stack[i].stmt : stmt;
      }

      const stmtStack = [];

      (() => {
        let i = statements.length - 1;

        while (i >= 0 && !statements[i].hasToken) {
          stmtStack.unshift(statements[i]);
          i--;
        }

        if (i >= 0 && !isHbsToken(tokens[0]) && !isContentStmt(stmtStack[0])) {

          const prevStmt = statements[i];
          assert(isContentStmt(prevStmt));

          stmtStack.unshift(prevStmt);
        }

        if (isHbsToken(utils.peek(tokens)) && isContentStmt(utils.peek(stmtStack))) {
          stmtStack.pop();
        }

        if (isHbsToken(tokens[0]) && isContentStmt(stmtStack[0])) {
          const stmt = stmtStack[0];

          // attribute context whitespace
          assert(!stmt.original.trim());

          stmtStack.shift().hasToken = true;
        }

        let tail;
        if (tokens[0].content == '>' && (tail = getTailContentStmt(stmtStack[0], 1)) && !tail.original.trim()) {

          // attribute context whitespace
          tail.hasToken = true;
        }

      })();

      const validateToken = (token) => {
        const { type, content } = token;

        const throwInvalidAttr = () => {
          const attrKey = stmtStack.map(
            (stmt, i) => {
              let { original, canonicalSource, tokenizationMeta } = stmt;

              const whitespaceRegex = /\s/g;

              if (i == 0 && isContentStmt(stmt)) {

                if (tokenizationMeta) {
                  original = tokenizationMeta.original;
                }

                const idx = utils.lastIndexOf(original, whitespaceRegex)
                original = original.substring(idx);
              }

              if (i == stmtStack.length - 1 && isContentStmt(stmt)) {
                const idx = original.search(whitespaceRegex);

                original = original.substring(0, idx);
              }

              return canonicalSource || original.trim();
            }
          ).join('');

          throwError(
            `Attribute: ${attrKey} is invalid`,
            { loc: mergeLocs(stmtStack) },
          );
        }

        const validateMustacheExpression = () => {

          // This ensure that if <content> contains a mustache expression, 
          // then the expression owns the token content
          if (content.includes('{{') && !isHbsToken(token)) {
            throwInvalidAttr();
          }
        }

        switch (true) {
          case type == ATTR_KEY:
            validateMustacheExpression();
            break;

          case type == ATTR_VALUE_SEGMENT:
            if (!token.hasWrapper && token.groupSize > 1) {
              // i.e. x=abc{{l}} y={{q}}{{y}} 
              throwInvalidAttr();
            }
            break;
        }
      }

      const contextId = utils.generateRandomString();

      for (let i = tokens.length - 1; i >= 0; i--) {
        const token = tokens[i];

        validateToken(token);

        if (token.type == ATTR_VALUE && !token.content) {
          // If <token> is an empty attribute value, we can't pass that to getContentStmtFromToken(...)
          // because it won't work, so use <stmt> from the <nextToken>

          const nextToken = tokens[i + 1];

          assert(nextToken.type == ATTR_VALUE_WRAPPER_END);

          token.tokenizationStmt = nextToken.stmt;
          token.stmt = nextToken.stmt;

          continue;
        }

        let stmt = ((i == tokens.length - 1) || isHbsToken(token) || isHbsToken(tokens[i + 1])) ?
          stmtStack.pop() : tokens[i + 1].tokenizationStmt;

        if (stmt.type == 'ContentStatement') {
          assert(!isHbsToken(token));

          token.tokenizationStmt = stmt;
          stmt = getContentStmtFromToken(stmt, token, contextId);
        }

        if (Array.isArray(stmt)) {
          stmt.forEach(s => s.hasToken = true);
        } else {
          stmt.hasToken = true;
        }

        token.stmt = stmt;
      }

      assert(!stmtStack.length);
    }

    const getAttrValueToken = (tokenList, keyIndex) => {

      switch (true) {
        case tokenList[keyIndex + 1].type != ATTR_ASSIGNMENT:
          return null;
        case tokenList[keyIndex + 2].type == ATTR_VALUE_WRAPPER_START:
          return tokenList[keyIndex + 3];
        default:
          return tokenList[keyIndex + 2];
      }
    }

    streamTokenizer
      .on('data', (tokens) => {

        splitTokens(tokens);

        const tokenList = getTokenList();
        const len = tokenList.length

        addToTokenList(tokens);

        let openTagEnd = getOpenTagEnd(tokens);

        if (openTagEnd >= 0) {
          const { stmt } = tokens[openTagEnd];

          openTagEnd += len;

          const attributeTokens = getAttributeTokens({ tokenList, index: openTagEnd });

          let withDataPath;
          let hasIdAttribute;

          for (let i = 0; i < attributeTokens.length; i++) {
            const token = attributeTokens[i];
            const { type, content } = token;

            if (![ATTR_KEY, ATTR_VALUE_SEGMENT].includes(type)) continue;

            if (content.match(/{{bind/g)) {
              withDataPath = true;
            }

            if (type == ATTR_KEY && content == 'id') {
              const valueToken = getAttrValueToken(attributeTokens, i);

              if (!valueToken) throwError(`An "id" attribute is specified, must have a value as stipulated in the html spec`, stmt);

              if (valueToken.type == ATTR_VALUE && stmt.inIterateContext) {
                const { content: id } = valueToken;
                throwError(
                  `You cannot provide attribute (id="${id}") on this html element because it resides inside a loop`, stmt,
                );
              }
              hasIdAttribute = true;
            }

            if (withDataPath && hasIdAttribute) {
              break;
            }
          }

          if (withDataPath) {
            const openTagStart = getOpenTagStart(tokenList, openTagEnd);
            createAttributeContext({ token: tokenList[openTagStart] }, { token: tokenList[openTagEnd] });
          }

          // We need to tag all mustache expressions that exists in the attribute context with their
          // respective token types, so that they can be properly validated at runtime

          attributeTokens.forEach((token, i) => {
            const { type, content, stmt } = token;

            const { attributeTokenTypeHashKey } = TemplatePreprocessor;

            if (![ATTR_KEY, ATTR_VALUE_SEGMENT].includes(type) || !content.includes('{{')) return;

            assert(isHbsToken({ content }));

            let tokenType;

            switch (type) {

              case ATTR_KEY:
                tokenType = (attributeTokens[i + 1].type == ATTR_ASSIGNMENT) ?
                  'attr-key' : 'attr';
                break;

              case ATTR_VALUE_SEGMENT:
                tokenType = token.hasWrapper ? 'attr-string-value' : 'attr-value';
                break;
            }

            const hash = stmt.hash || (stmt.hash = { type: 'Hash', pairs: [] });

            hash.pairs.push({
              type: 'HashPair',
              key: attributeTokenTypeHashKey,
              value: createStringLiteral(tokenType),
            });
          });
        }
      });

    const getContentStmtFromToken = (stmt, token, contextId) => {
      const { tokenizationMeta } = stmt;

      if (!tokenizationMeta) {
        return stmt;
      }

      if (tokenizationMeta.contextId != contextId) {

        tokenizationMeta.contextId = contextId;
        tokenizationMeta.contextStack = [...tokenizationMeta.stack];
      }

      const { contextStack } = tokenizationMeta;

      const original = contextStack.map(({ stmt }) => stmt.original).join('');

      const idx = original.lastIndexOf(token.content);
      assert(idx >= 0);

      const matches = [];

      let start;
      let end;

      contextStack.forEach(({ endIndex }, i) => {
        if (end) {
          return;
        }

        if (start == undefined && endIndex >= idx + 1) {
          start = i;
        }

        if (start != undefined) {
          matches.push(i);

          const next = contextStack[i + 1];

          if (!next || next.startIndex > idx + token.content.length - 1) {
            end = i;
          }
        }
      });

      // Todo: Remove code

      // const tailIndex = contextStack.length - 1;

      // assert(matches.length && (end == tailIndex || end == tailIndex - 1));

      // if (end == tailIndex - 1) {
      //   contextStack.pop();
      // }

      const result = matches.map(i => contextStack[i].stmt);

      return (result.length > 1) ? result : result[0];
    }

    let contents = [];

    const onContentStatement = (stmt, visitor) => {

      const { getTemplateSource } = TemplatePreprocessor;
      const { splitWithDelimiters, containsAnySubstring, peek } = utils;
      const { original, loc, parent, split } = stmt;

      if (!split && containsAnySubstring(original, ['<', '>'])) {

        const parts = splitWithDelimiters(original, ['<', '/>', '>']);

        const templateSource = getTemplateSource(loc);
        const fn = lineColumn(templateSource);

        let index = fn.toIndex({ line: loc.start.line, column: loc.start.column + 1 });

        assert(index >= 0);

        const repl = parts.map((part) => {

          const fromIndex = (i, j) => {
            const { line, col } = fn.fromIndex(i);
            return { line, column: col + j, };
          }

          const start = fromIndex(index, -1);

          index += part.length;

          const end = fromIndex(index - 1, 0);

          return {
            ...createContentStatement({
              original: part,
              loc: { ...loc, start, end },
            }),
            parent,
            split: true,
          };
        });

        visitor.mutating = true;

        return {
          type: 'NodeReplacement', repl,
        };
      }


      contents = [...contents, ...original.split('')];

      const prevStmt = peek(statements);

      if (prevStmt && prevStmt.type == 'ContentStatement') {

        const addToStack = (context, stmt) => {
          const { stack } = context;
          const { original, loc } = stmt;

          context.loc.end = {
            source: loc.source,
            ...loc.end,
          }

          stack.push({
            stmt,
            startIndex: context.original.length,
            endIndex: context.original.length + original.length,
          });

          context.original += original;
        }

        if (!prevStmt.tokenizationMeta) {

          prevStmt.tokenizationMeta = {
            original: '', stack: [], loc: prevStmt.loc,
          }

          addToStack(prevStmt.tokenizationMeta, prevStmt);
        }

        const { tokenizationMeta } = prevStmt;

        addToStack(tokenizationMeta, stmt);

      } else {
        statements.push(stmt);
      }

      streamTokenizer.write(original);
    };

    const getOpenTagEndIndex = (clockwise, array, index, defaultValue = -1) => {

      const char = '>';
      const terminateChar = '<';

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

    const getTagNameFromIndex = (openTagEnd) => {
      assert(openTagEnd > 0);

      let openTagStart;

      (() => {
        // this is realistically the earliest index we can find <openTagStart>
        let i = openTagEnd - 2;

        while (openTagStart == undefined) {
          if (contents[i] == '<') {
            openTagStart = i;
            break;
          }

          i--;
        }
      })();

      assert(openTagStart != undefined);

      let tagName = '';

      (() => {
        let i = openTagStart + 1;
        const rgx = /\>|\s+/g;

        while (!contents[i].match(rgx)) {
          tagName += contents[i];
          i++;
        }
      })();

      return tagName;
    }

    const RANDOM_STR = utils.generateRandomString();

    const onMustacheStatement = (stmt) => {
      const {
        path: { processed }, dataBinding, createHtmlWrapper, forceHtmlWrapper, metaStatement, canonicalSource, loc,
      } = stmt;

      if (metaStatement) {
        return;
      }

      assert(canonicalSource);

      const openTagEnd = getOpenTagEndIndex(false, contents, contents.length - 1, 0);

      if (createHtmlWrapper && openTagEnd >= 0) {

        // Note: Any mustache statement directly within <excludedTags> will be 
        // processed like a content statement
        const excludedTags = ['style', 'script'];

        if (openTagEnd > 0) {
          const tagName = getTagNameFromIndex(openTagEnd);

          if (excludedTags.includes(tagName)) {

            onContentStatement(
              createContentStatement({ original: RANDOM_STR, loc })
            );
            return;
          }
        }

        createTextNodeBindWrapper({ stmt });

      } else if (forceHtmlWrapper) {
        throwError(
          `A html wrapper is required for this expression, but the wrapper could not be created`,
          stmt
        );
      }

      const b = processed && dataBinding;

      statements.push(stmt);
      streamTokenizer.write(
        `{{${b ? 'bind' : ''}${RANDOM_STR}}}`
      );

      if (b) {
        addHookSizeForMustacheStmt(stmt);
      }
    };

    const addHookSizeForMustacheStmt = (stmt) => {
      const { targetComponent } = stmt;

      const factor = addToHookSize(this.#getHookFactor(), stmt);

      if (targetComponent) {
        this.#addRefCount(targetComponent, factor);
      }
    }

    const toTokenContent = (token) => {
      const { stmt: { type, canonicalSource }, content } = token;
      return (type == 'MustacheStatement') ? canonicalSource : content;
    }

    const toTokenLoc = ({ stmt }) => {
      return Array.isArray(stmt) ? mergeLocs(stmt) : stmt.loc;
    }

    const mergeLocs = (arr) => {
      const { loc } = utils.peek(arr);
      return {
        ...arr[0].loc,
        end: {
          source: loc.source,
          ...loc.end,
        }
      };
    }

    const isIterateBlock = (original) => {
      return original === customEachHelperName;
    }

    const ATTR_MARKUP_CONTEXT = 'attr';
    const FREEFORM_MARKUP_CONTEXT = 'freeform';
    const STYLE_MARKUP_CONTEXT = 'style';

    const getMarkupContext = () => {
      const tokenList = getTokenList();

      for (let i = tokenList.length - 1; i >= 0; i--) {
        const { type } = tokenList[i];

        switch (true) {
          case type.startsWith(OPEN_TAG_START):
            return ATTR_MARKUP_CONTEXT;
          case type == OPEN_TAG_END:
            return FREEFORM_MARKUP_CONTEXT;
          case type == OPEN_TAG_END_STYLE:
            return STYLE_MARKUP_CONTEXT;
        }
      }
      return FREEFORM_MARKUP_CONTEXT;
    }

    const isAttributeValueContext = () => {
      const tokenList = getTokenList();
      return utils.peek(tokenList).type == ATTR_VALUE_WRAPPER_START;
    }

    const onBlockStatement = (stmt) => {
      const { nodeIndexHashKey, markerTagNameHashKey, createStringLiteral } = TemplatePreprocessor;
      const { isIterateBlock, createHtmlWrapper, opaqueWrapper, preTokenList } = stmt;

      if (!createHtmlWrapper) return;

      const hash = stmt.hash || (stmt.hash = { type: 'Hash', pairs: [] });
      const { nodeIndex } = opaqueWrapper ? useExistingParentAsBlockWrapper({ stmt, tokenList: preTokenList }) : { nodeIndex: createBlockHtmlWrapper({ stmt }), nodeLoc: getLine(stmt) };

      hash.pairs.push({
        type: 'HashPair',
        key: nodeIndexHashKey,
        value: createNumberLiteral(nodeIndex),
      });

      if (opaqueWrapper && isIterateBlock) {
        const { tokenList } = stmt.program;

        const errors = [];
        const tagName = validateOpaqueIterateBlock(tokenList, errors);

        if (!tagName) {
          throwError0(errors[0]);
        }

        hash.pairs.push({
          type: 'HashPair',
          key: markerTagNameHashKey,
          value: createStringLiteral(tagName),
        });

        // Add attributeContext to inner tag, if applicable

        const openTagEnd = getOpenTagEnd(tokenList);

        if (tokenList[openTagEnd].nodeIndex == undefined) {

          const openTagStart = getOpenTagStart(tokenList, openTagEnd);

          createAttributeContext(
            { token: tokenList[openTagStart], dir: DIR_LTR }, { token: tokenList[openTagEnd] }
          );
        }
      }
    }

    const Visitor = getVisitor();

    const replacements = [];

    let CLEANUP_MODE = false;

    function ASTParser() {
    }
    ASTParser.prototype = new Visitor();

    const isInIterateBlock = () => {
      for (let i = bindParents.length - 1; i > 0; i--) {
        const parent = bindParents[i];
        const { original } = parent;
        if (isIterateBlock(original)) {
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

      return onContentStatement(stmt, this);
    };

    ASTParser.prototype.MustacheStatement = function (stmt) {
      if (CLEANUP_MODE) {
        this.mutating = true;
        stmt.parent = undefined;
        return stmt;
      }
      stmt.parent = utils.peek(bindParents);
      stmt.inIterateContext = isInIterateBlock();

      onMustacheStatement(stmt);
    };

    ASTParser.prototype.ComponentReference = function (stmt) {

      const factor = addToHookSize(_this.#getHookFactor());
      _this.#addRefCount(stmt.className, factor);

      this.mutating = true;
      return false;
    };

    ASTParser.prototype.BlockStatement = function (stmt) {
      if (CLEANUP_MODE) {
        this.mutating = true;
        stmt.parent = undefined;
        return stmt;
      }

      const { conditionalHelperName, customEachHelperName } = TemplatePreprocessor;

      const markupContext = getMarkupContext();

      if (markupContext == ATTR_MARKUP_CONTEXT && !isAttributeValueContext()) {
        throwError(`Blocks are not allowed in this location`, stmt);
      }

      if (markupContext != FREEFORM_MARKUP_CONTEXT) {

        if (stmt.forceHtmlWrapper) {
          throwError(
            `A html wrapper is required for this block, but a wrapper cannot be created in this location`,
            stmt
          );
        }

        onContentStatement(
          createContentStatement({ original: RANDOM_STR, loc: stmt.loc })
        );
        return;
      }

      stmt.isIterateBlock = isIterateBlock(stmt.path.original);
      stmt.parent = utils.peek(bindParents);

      stmt.hasToken = true;
      stmt.preTokenList = [...getTokenListInScope()];

      const programStartToken = {
        type: BLOCK_PROGRAM_START, stmt,
      };

      addToTokenList([programStartToken]);

      const { resolvedParam } = stmt.params[0] || {};

      const blockMetadata = {};

      const bindParent = {
        original: stmt.path.original,
        resolvedParam,
        body: stmt.program.body,
        loc: stmt.program.loc,
        index: bindParents.length,
        tokenList: [],
        blockMetadata,
      };

      bindParents.push(bindParent);

      this.acceptKey(stmt, 'program');

      stmt.program.tokenList = getTokenListInScope();

      bindParents.pop();

      programStartToken.tokenLength = stmt.program.tokenList.length;

      addToTokenList([{
        type: BLOCK_PROGRAM_END, stmt,
      }]);


      if (stmt.inverse) {

        const programInverseToken = {
          type: BLOCK_INVERSE_START, stmt,
        };

        addToTokenList([programInverseToken]);

        const bindParent = {
          body: stmt.inverse.body,
          loc: stmt.inverse.loc,
          index: bindParents.length,
          tokenList: [],
          blockMetadata,
        };

        bindParents.push(bindParent);

        this.acceptKey(stmt, 'inverse');

        stmt.inverse.tokenList = getTokenListInScope();

        bindParents.pop();

        programInverseToken.tokenLength = stmt.inverse.tokenList.length;

        addToTokenList([{
          type: BLOCK_INVERSE_END, stmt,
        }]);
      }

      if ([conditionalHelperName, customEachHelperName].includes(stmt.path.original)) {
        const bindParents = getNonRootBindParents();

        const factor = _this.#getHookFactor(
          (stmt.path.original == customEachHelperName) ? 5 : 1
        );

        if (bindParents.length) {
          addToHookSize(factor);
        } else {
          addEstimatedSizeToObject(
            stmt, (blockMetadata.estimatedHookSize || 0) + factor,
          );
        }
      }

      onBlockStatement(stmt);
    };

    const parser = new ASTParser();

    parser.accept(ast);

    this.replaceNodes0({ replacements });

    this.#addSizeToHspuMetadata(ast);

    CLEANUP_MODE = true;
    parser.accept(ast);
  }

  #addSizeToHspuMetadata(ast) {
    const { visitNodes } = TemplatePreprocessor;

    const hspuMetadata = this.#getHspuMetadata();

    if (!hspuMetadata.size) {
      hspuMetadata.size = 0;
    }

    visitNodes({
      types: ['MustacheStatement', 'BlockStatement'],
      ast,
      parentFirst: true,
      consumer: ({ stmt }) => {
        const { estimatedHookSize } = stmt;

        if (estimatedHookSize) {
          hspuMetadata.size += estimatedHookSize;
        }

        return false;
      },
    });
  }

  #getFinalHspuMetadata() {
    const hspuMetadata = this.#getHspuMetadata();

    const size = Math.ceil(hspuMetadata.size);
    const componentRefCount = {};

    Object.entries(this.#getComponentRefCount()).forEach(([k, { count }]) => {
      componentRefCount[k] = Math.ceil(count);
    });

    return { size, componentRefCount }
  }

  #getHspuMetadata() {
    return this.metadata.hspuMetadata || (this.metadata.hspuMetadata = {});
  }

  #getComponentRefCount() {
    const hspuMetadata = this.#getHspuMetadata();
    return hspuMetadata.componentRefCount || (hspuMetadata.componentRefCount = {});
  }

  #getTransientComponentRefs() {
    const hspuMetadata = this.#getHspuMetadata();
    return hspuMetadata.transientComponentRefs || (hspuMetadata.transientComponentRefs = []);
  }

  pruneStatements(ast) {
    const { getVisitor } = TemplatePreprocessor;

    const Visitor = getVisitor();

    function ASTParser() {
    }
    ASTParser.prototype = new Visitor();

    ASTParser.prototype.MustacheStatement = function (stmt) {
      if (stmt.pruneNode) {
        this.mutating = true;
        return false;
      }
    }

    ASTParser.prototype.ExternalProgram = function (stmt) {
      this.mutating = true;
      return {
        type: 'NodeReplacement',
        repl: stmt.body,
      };
    };

    const parser = new ASTParser();
    parser.accept(ast);
  }

  createContentHelperIndirection(ast) {
    const {
      contentHelperName, createStringLiteral, createPathExpression, getDefaultLoc, visitNodes,
    } = TemplatePreprocessor;

    visitNodes({
      types: ['ContentStatement'],
      ast,
      consumer: ({ stmt }) => {
        const { original, loc } = stmt;

        assert(original.length);

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

  ensureHtmlWrappersAreNotRequired(ast) {
    const { visitNodes, throwError } = TemplatePreprocessor;

    visitNodes({
      types: ['MustacheStatement', 'BlockStatement'],
      ast,
      consumer: ({ stmt }) => {
        const { forceHtmlWrapper } = stmt;

        if (forceHtmlWrapper) {
          throwError(
            `A html wrapper is required for this expression, but the wrapper could not be created. To fix, enable data binding in component config`,
            stmt
          );
        }
      }
    });
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

  invokeDataPathTransform(original, stmt) {
    const { dataPathPrefixRegex, conditionalTransform } = TemplatePreprocessor;

    assert(original.match(dataPathPrefixRegex));

    if (original.includes('[')) {
      this.metadata.hasStaticPath = true;
    }

    original = conditionalTransform(original, stmt);

    // If a callback was provided in <stmt>, invoke it 
    if (stmt.onResolve) {
      stmt.onResolve.bind(this)(stmt, original);
    }

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

  isProgramTransformed(program) {
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

  getMethodNameHashValue({ stmt, key, cleanup = false, allowMultiple }) {
    const { throwError, getHashValue } = TemplatePreprocessor;

    const { original: methodName } =
      getHashValue({ stmt, key, type: 'StringLiteral', cleanup })
      || { original: null };

    const validate = (n) => {
      if (!this.methodNames.includes(n)) {
        throwError(`Unknown method "${n}"`, stmt);
      }
    }

    if (methodName) {
      if (allowMultiple) {
        methodName.trim().split(/,\s*/g).forEach(n => validate(n));
      } else {
        validate(methodName.trim());
      }
    }

    return methodName;
  }

  static getTemplateSource(loc) {
    const { getProgramInfoRegistry } = TemplatePreprocessor;

    const programInfoRegistry = getProgramInfoRegistry();

    const { programId } = loc;
    const { templateSource } = programInfoRegistry[programId];

    return templateSource;
  }

  static getCanonicalSource(stmt) {
    const { getSourceIndex, getTemplateSource } = TemplatePreprocessor;

    const templateSource = getTemplateSource(stmt.loc);
    const { startIndex, endIndex } = getSourceIndex(templateSource, stmt);

    return templateSource.substring(startIndex, endIndex + 1);
  }

  process0({ contextList, bindParents, program, validateHtml }) {
    const {
      rootQualifier,
      storeContextBlockName,
      loadContextBlockName,
      syntheticAliasSeparator,
      dataPathRoot,
      pathSeparator,
      partialIdHashKey,
      partialNameHashKey,
      syntheticMethodPrefix,
      asyncHashKey,
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
      getOuterInlineBlock,
      visitNodes,
      getLine,
      getContextSwitchingHelpers,
      getPathInfo,
      getValue,
      getDefaultStripOptions,
      createStringLiteral,
      createLiteral,
      getMethodFromFunctionDeclaration,
      getCustomContextInvokeFunction,
      throwError,
      getHashPairs,
      getVisitor,
    } = TemplatePreprocessor;

    const customBlockCtx = [{
      value: false,
    }];

    // eslint-disable-next-line no-underscore-dangle
    const _this = this;

    const replacements = [];

    const streamTokenizer = new StreamTokenizer();
    let tokenList = [];

    const Visitor = getVisitor();

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
      const contextIds = [];

      Object.entries(contextObject)
        .forEach(([k, v]) => {
          v.index = contextList.length;
          v.loc = stmt.loc;

          if (addContextId && (v.scope || v.index)) {
            v.contextId = utils.generateRandomString();
            contextIds.push(v.contextId);
          }

          if (uniqueKeys.includes(k)) {
            throwError(`Context key "${k}" cannot be used in this scope`, stmt);
          }
        })

      contextList.push(contextObject);
      return contextIds;
    }

    const allowRootAccess = ({ stmt } = {}) => {
      const { allowRootAccessHashKey, allowRootAccessByDefault } = TemplatePreprocessor;
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
      const { escapedHashKey } = TemplatePreprocessor;
      const { original: escaped } = getHashValue({
        stmt, key: escapedHashKey, type: 'BooleanLiteral', cleanup: false,
      })
        || { original: !!this.resolver.config.escapeDynamicHtml };
      return escaped;
    };

    const isTransient = ({ stmt }) => {
      const { transientHashKey } = TemplatePreprocessor;
      const { original: transient } = getHashValue({
        stmt, key: transientHashKey, type: 'BooleanLiteral', cleanup: false,
      }) || {};
      return transient;
    };

    const getPredicate = ({ stmt }) => {
      const { predicateHashKey } = TemplatePreprocessor;
      return this.getMethodNameHashValue({ stmt, key: predicateHashKey });
    };

    const isOpaqueWrapper = ({ stmt }) => {
      const { opaqueWrapperHashKey } = TemplatePreprocessor;

      const value = stmt.opaqueWrapper ||
        (getHashValue({
          stmt, key: opaqueWrapperHashKey, type: 'BooleanLiteral', cleanup: false,
        }) || { original: false }).original;

      stmt.opaqueWrapper = value;
      return value;
    };

    const getTransform = ({ stmt }) => {
      const { transformHashKey } = TemplatePreprocessor;
      return this.getMethodNameHashValue({ stmt, key: transformHashKey, allowMultiple: true });
    };

    const getHook = ({ stmt }) => {
      const { hookHashKey, hookPhaseHashKey } = TemplatePreprocessor;

      const { original: hookPhase } = getHashValue({
        stmt, key: hookPhaseHashKey, type: 'StringLiteral', cleanup: false,
      }) || {};

      if (hookPhase) {

        const knownPhases = RootCtxRenderer.getSupportedHookPhases();

        hookPhase.trim().split(/\s*,\s*/g).forEach(s => {
          if (!knownPhases.includes(s)) {
            throwError(`Unknown hook phase "${s}"`, stmt);
          }
        })
      }

      return this.getMethodNameHashValue({ stmt, key: hookHashKey, allowMultiple: true });
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
        getSuffix, toPathExpressionLiteral,
      } = TemplatePreprocessor;

      const prev = stmt.original;

      if (stmt.processed) {
        return stmt;
      }

      if (stmt.decoratorParameter) {
        return stmt;
      }

      if (this.methodNames.includes(prev)) {
        const expr = createSubExpressionFromPath({
          stmt,
        });

        ASTParser.prototype.SubExpression.call(visitor, expr);

        return expr;
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

        original = this.invokeDataPathTransform(globalVariable.original, stmt);

        original = addRawDataPrefixToPath(original);

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
        if (!inlineBlock || inlineBlock.runtime) {

          // Note: @root paths are eagerly resolved inside a runtime decorator block because
          // since these blocks are also executed as high-level handlebars, we need to eagerly 
          // resolve @root

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
          // @root paths will be resolved later when this inline block is visitd during 
          // partial inlining
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
                  stmt,
                }).original;

                resetPathExpression({
                  stmt,
                  original,
                  properties: {
                    processed: true,
                  },
                });

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

                original = this.invokeDataPathTransform(original, stmt);

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
            stmt,
          }).original;

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

          original = this.invokeDataPathTransform(original, stmt);

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

      const { toPathExpressionLiteral, hasDataPathFormat, getTargetType, isLookupAllowed } = TemplatePreprocessor;

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
          loc: stmt.loc,
          // Note: We are not passing in stmt here becuase, it's not necessary, since we already
          // calling resetPathExpression(...) below
        });
        synthetic = true;

        const value = this.getSyntheticMethodValue({
          stmt,
          source: stmt.original,
          method: original,
          line: getLine(stmt),
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
            original: hasDataPathFormat(original) ? this.invokeDataPathTransform(original, stmt) : original,
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
          contextObject[indexQualifier] = { lookup: false, index: true };
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
        .forEach(({ key, synthetic }) => {
          if (reservedKeys.includes(key) && !synthetic) {
            throwError(
              `Hashkey "${key}" is reserved and cannot be used in this ${stmt.type}`, stmt
            );
          }
          if (ensureWordKeys && !key.match(wordPattern)) {
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

    const visitHeaders = function (stmt) {
      const { isRootCtxValue, visitNodes } = TemplatePreprocessor;

      this.acceptArray(stmt.params);
      this.acceptKey(stmt, 'hash');
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

    const getSubExpressionMetaPaths = () => {
      const { fnHelperName } = TemplatePreprocessor;
      return [fnHelperName];
    };

    const processSubExpressionMetaStatement = function ({ stmt }) {

      const { fnHelperName, throwError } = TemplatePreprocessor;

      // eslint-disable-next-line default-case
      switch (stmt.path.original) {
        case fnHelperName:

          const { type, original } = (stmt.params[0] || {});

          const isValidMethod = type == 'StringLiteral' && _this.methodNames.includes(original);

          if (!isValidMethod) {
            throwError(`Unknown methodName: "${original}"`, stmt);
          }

          _this.addGlobalHelper(original, bindParents);
          break;
      }
    };

    ASTParser.prototype.SubExpression = function (stmt) {

      const { resolveMustacheInCustomHelperName, getTargetType, isLookupAllowed } = TemplatePreprocessor;

      if (stmt.path.type.endsWith('Literal')) {
        // If path is a Literal, convert to PathExpression
        _this.resetPathExpression({ stmt: stmt.path, original: stmt.path.original });
      }

      this.mutating = true;

      if (getSubExpressionMetaPaths().includes(stmt.path.original)) {
        processSubExpressionMetaStatement.bind(this)({ stmt });
      }

      if (isCustomContext()) {

        _this.validateMethod(stmt.path.original);

        visitHeaders.bind(this)(stmt);

        if (!stmt.fromMustache) {

          // Note: We use the 'synthetic' property in this context  to indicate that the SubExpression's 
          // path has been transformed
          if (!stmt.synthetic) {

            const customCtxFnCache = _this.metadata.customCtxFnCache ||
              (_this.metadata.customCtxFnCache = {});

            let synthethicMethodName = customCtxFnCache[stmt.path.original];

            if (!synthethicMethodName) {
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

              synthethicMethodName = customCtxFnCache[stmt.path.original] = ast.id.name;
            }

            stmt.path = createPathExpression({ original: synthethicMethodName, loc: stmt.path.loc });

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
        globalsBasePath, wrapInvocationWithProxyMethodName, dataPathPrefixRegex, pathSeparator, getPathFromSyntheticAlias, getChildPathFromSyntheticAlias,
        getTargetType, isLookupAllowed, throwError, addScopeVariableHashKey, addIndexVariableHashKey, getIterateDataVariables, getReservedBlockHashKeys, getLine,
        createPathExpression, createStringLiteral,
      } = TemplatePreprocessor;

      const {
        blockName, validType, contextSwitching, scopeQualifier, indexQualifier, iterateBlock, conditional, custom,
      } = stmt.processed ? {} : _this.getBlockOptions(stmt);

      const transform = getTransform({ stmt });

      const predicate = getPredicate({ stmt });
      const opaqueWrapper = isOpaqueWrapper({ stmt });

      if (!stmt.visited) {

        if (isTransient({ stmt }) !== undefined && !conditional) {
          throwError(`The "transient" option cannot be specified in #${blockName} block`, stmt);
        }

        if (iterateBlock) {

          stmt.path.onResolve = function (stmt, original) {

            const { dataPathPrefixRegex, pathSeparator } = this.constructor;
            const renderedCollections = this.metadata.renderedCollections || (this.metadata.renderedCollections = []);

            if (original.match(dataPathPrefixRegex)) {

              const path = original
                .replace(dataPathPrefixRegex, '').split(pathSeparator).join('.');

              renderedCollections.push(path);
            }
          }
        } else if (predicate) {
          throwError(`A "predicate" cannot be specified on #${blockName} block`, stmt);
        }

        if (opaqueWrapper) {
          if (custom) {
            // Custom blocks use getBlockWrapperId() to get the enclosing html wrapper, hence we need the wrapper 
            // to directly wrap this block
            throwError(`The "opaqueWrapper" option cannot be specified on a custom block`, stmt);
          };

          if (predicate) {
            // At runtime, an error will be thrown if a block with opaqueWrapper has a null member, which is 
            // incompatible with the concept of predicates (which is, that a non-null member can be interpreted as null)
            throwError(
              `The "opaqueWrapper" option cannot be specified on a block that has a "predicate" defined, because they are incompatible with one another`,
              stmt
            );
          };
        }
      };

      const hook = getHook({ stmt });
      const async = isAsync({ stmt });

      const htmlWrapperErrors = [];

      if (hook) {
        htmlWrapperErrors.push('A "hook" cannot be specified for this block due to invalid html markup');
      }

      if (transform) {
        _this.metadata.hasBlockTransform = true;

        htmlWrapperErrors.push('A "transform" cannot be specified for this block due to invalid html markup');
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

        if (htmlWrapperErrors.length) {

          // This block needs to be wrapped in a html wrapper, hence we need to pre-emptively set <hasWrapper> to true, so that the
          // necessary js code can be generated with the assumption that a wrapper will be created later. If after block processing, we
          // we find that this block contains invalid html markup, the errors in <htmlWrapperErrors> will be emitted

          stmt.hasWrapper = true;
        }

        _this.updateCustomBlockPath({ stmt, isCustomContext: isCustomContext() });

        customBlockCtx.push(stmt.customBlockCtx);

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

        const [scopeVariable] = registerContext(contextObj, stmt, true);

        addScopeVariableHashKey(stmt, scopeVariable);

        delete stmt.program.blockParams;

        stmt.customBlockCtx.contextId = scopeVariable;

        stmt.contextObject = contextObj;
      };

      const parentProperties = {};

      const processBlockInCustomCtx = () => {

        let hasContextList = false;
        let hasCustomBlockCtx = false;

        visitHeaders.bind(this)(stmt);

        if (!stmt.visited && contextSwitching && stmt.params[0].type == 'SubExpression') {
          // We need to create an indirection, so that the returned data will be wrapped with CustomCtxRenderer.wrapDataWithProxy(...)
          const { path } = stmt.params[0];

          stmt.params[0].path = {
            ...createPathExpression({ original: wrapInvocationWithProxyMethodName }),
            loc: path.loc,
          };
          stmt.params[0].params.unshift({
            ...createStringLiteral(path.original),
            loc: path.loc,
          });
        }

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
                index: true,
                asVariable: true,
              };
            }

            if (iterateBlock) {

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

            const [scopeVariable, indexVariable] = registerContext(contextObj, stmt, true);

            addScopeVariableHashKey(stmt, scopeVariable);

            if (indexQualifier) {
              addIndexVariableHashKey(stmt, indexVariable);
            }

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
          properties: parentProperties,
        };

        bindParents.push(parent);

        this.acceptKey(stmt, 'program');

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
            properties: parentProperties,
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

            assert(stmt.canonicalSource || stmt.type === 'PathExpression');

            canonicalSource = stmt.canonicalSource || stmt.original;

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
              // the context-switching helpers re-constructs the syntheticAlias from the <path>
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
              _original = _this.invokeDataPathTransform(_original, stmt);

              if (iterateBlock && opaqueWrapper) {
                const nonNullPaths = _this.metadata.nonNullPaths || (_this.metadata.nonNullPaths = []);

                nonNullPaths.push(
                  _this.#toRuntimeCanonicalPath(`${_original}_$`)
                );
              }
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

            resetPathExpression({
              stmt,
              original: toCanonical(_original),
              properties: {
                processed: true,
                resolvedParam: original,
              },
            });

          } else {
            assert(type.endsWith('Literal'));

            utils.clear(stmt);

            // Note: loc object not needed since this is not a top-level node
            stmt.type = type;
            stmt.value = original;
          }

          const resolvedParamInfo = {
            isSynthetic, syntheticAlias, type, original, targetType, canonicalSource,
          };

          stmt.resolvedParamInfo = resolvedParamInfo;

          return resolvedParamInfo;
        };

        let hasInlineParam = false;

        for (const path of getHeaders(stmt)) {
          if (!resolvePathParam({ stmt: path })) {
            hasInlineParam = true;
          }
        }

        if (hasInlineParam) {
          return visitDeferredBlock.bind(this)({ stmt });
        }

        const { resolvedParamInfo } = stmt.params.length ? stmt.params[0] : {};

        let {
          isSynthetic, syntheticAlias, type, original, targetType, canonicalSource,
        } = resolvedParamInfo || {};


        const addPathBlockAssociation = (original) => {

          if (isSynthetic || custom || isCustomContext()) return;
          if (getOuterInlineBlock({ bindParents }) != null) return;

          const pathBlockAssociations = _this.metadata.pathBlockAssociations || (_this.metadata.pathBlockAssociations = {});

          const path = original.replace(dataPathPrefixRegex, '').split(pathSeparator).join('.');
          const arr = pathBlockAssociations[path] || (pathBlockAssociations[path] = []);

          const blockLoc = getLine(stmt, false, true);
          arr.push(blockLoc);
        }

        const { logicGate, logicGatePruneKey } = stmt;

        if (logicGate && logicGate.participants.length) {

          const logicGateInfo = addLogicGate({
            ...stmt,
            logicGate,
            logicGatePruneKey,
          });

          if (logicGateInfo) {
            const { path, logicGate: { participants } } = logicGateInfo;

            isSynthetic = false;

            participants.forEach(({ original }) => {
              addPathBlockAssociation(original);
            });

            resetPathExpression({
              stmt: stmt.params[0],
              original: `${toCanonical(path)}!!`,
              properties: {
                processed: true,
              },
            });
          }

        } else if (resolvedParamInfo) {
          addPathBlockAssociation(original);
        }

        if (contextSwitching) {
          const contextObject = {};

          if (iterateBlock) {
            const { customEachHelperName, getIterateDataVariables } = TemplatePreprocessor;

            const path = original.replace(dataPathPrefixRegex, '');
            const blockKey = syntheticAlias || path;

            stmt.path = {
              ...createPathExpression({
                original: customEachHelperName,
              }),
              processed: true,
            };

            _this.serializeAst();

            // Trigger doBlockInit() and doBlockUpdate() to initialize blockData and set 
            // index to 0. Here are the reasons why triggering these methods is required:
            // 1. In a data context, the rootProxy need to resolve paths embedded in synthetic functions,
            // and these paths use blockData to resolve "_$"
            // 2. In a synthetic context, data variables are computed using blockData 

            _this.component.doBlockInit({ path: blockKey });
            _this.component.doBlockUpdate({ path: blockKey });

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
              path: blockKey,
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

          original += (!isSynthetic && iterateBlock) ? '_$' : '';

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
              iterateBlock,
            inIterateContext: iterateBlock || !!utils.peek(contextList)[rootQualifier].inIterateContext,
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
          resolvedParam: resolvedParamInfo ? resolvedParamInfo.original : null,
          body: stmt.program.body,
          parent: utils.peek(bindParents),
          loc: stmt.program.loc,
          index: bindParents.length,
          properties: parentProperties,
        };

        bindParents.push(parent);

        this.acceptKey(stmt, 'program');

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
            properties: parentProperties,
          });
          this.acceptKey(stmt, 'inverse');

          pruneScopeVariables();

          bindParents.pop();
        }

        if (conditional) {
          const { conditionalHelperName } = TemplatePreprocessor;

          const invert = stmt.path.original === 'unless';

          stmt.path = {
            ...createPathExpression({
              original: conditionalHelperName,
            }),
            processed: true,
          };

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

      this.mutating = true;

      if (isCustomContext()) {
        processBlockInCustomCtx();
      } else {
        processBlockInRootCtx();
      }

      stmt.forceHtmlWrapper = !!htmlWrapperErrors.length;
      stmt.createHtmlWrapper = !isCustomContext() || htmlWrapperErrors.length;

      stmt.visited = true;

      return stmt;
    };

    const processComponentImport = ({ stmt }) => {

      const { createStringLiteral } = TemplatePreprocessor;
      const { componentRefType } = PathResolver;

      const defaultComponentName = BaseComponent.name;

      if (!stmt.params.length) {
        stmt.params = [createStringLiteral(defaultComponentName)];
      }

      const className = stmt.params[0].original;

      if (className != defaultComponentName) {

        // Attempt to load component class. The idea here is that we want a fail fast behaviour
        // eslint-disable-next-line no-unused-expressions
        this.getComponentClass(className);
      }

      const transient = getHashValue({
        stmt, key: 'transient', type: 'BooleanLiteral', cleanup: false,
      });

      let alias = getHashValue({
        stmt, key: 'alias', type: 'StringLiteral', cleanup: false,
      });

      if (!alias) {

        if (className != defaultComponentName) {
          return {
            type: 'NodeReplacement',
            repl: [{
              type: 'ComponentReference',
              className,
              loc: stmt.loc,
            }]
          }
        }

        this.throwError(`Component import - Provide an alias`, stmt);
      }

      alias = alias.original;

      if (stmt.params.length !== 1 || !alias) {
        this.throwError(`Component import - Incorrect signature`, stmt);
      }

      // The alias should not be a component name
      if (this.getComponentClass(alias)) {
        this.throwError(`Component name "${alias}" cannot be used as an alias`, stmt);
      }


      const { type, original, synthetic, targetValue, targetType, terminate } = this.resolvePath({
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

      this.#addResolvedComponentToRenderTree({
        alias, loc: stmt.loc, targetValue, targetType,
      });

      if (transient) {
        // If a component import is transient, it implies that it will likely not be rendered directly,
        // hence should be excluded from component reference list

        this.#getTransientComponentRefs().push(
          this.#toRuntimeCanonicalPath(original)
        );
      }

      [stmt.path, stmt.params[0]].forEach(stmt => {
        stmt.processed = true;
      });

      stmt.pruneNode = true;

      return stmt;
    };

    const getMustacheMetaPaths = () => {
      const { componentImportHelperName, variableHelperName } = TemplatePreprocessor;
      return [componentImportHelperName, variableHelperName];
    };

    const processMustacheMetaStatement = function ({ stmt }) {

      const {
        componentImportHelperName, variableHelperName, throwError, createStringLiteral, toParts,
      } = TemplatePreprocessor;

      // eslint-disable-next-line default-case
      switch (stmt.path.original) {

        case componentImportHelperName:
          if (isCustomContext()) {
            throwError(`Component imports are not allowed within a custom context`, stmt);
          }
          return processComponentImport({ stmt });

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

                if (_this.methodNames.includes(key)) {
                  throwError(
                    `Hashkey "${key}" is a method name in your component class  and cannot be used as a variable name`,
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

                  } else if (value.type.endsWith('Literal')) {

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

            stmt.metaStatement = true;
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
      const { logicGatePathRoot, pathSeparator, literalPathPrefixRegex, hasDataPathFormat } = TemplatePreprocessor;

      const { logicGate, logicGatePruneKey } = stmt;
      const { logicGatePruneKeys } = this.metadata;

      assert(!!logicGate);

      const participants = {};

      logicGate.participants
        .forEach((participant) => {
          const { original, processed, loc } = participant;

          assert(processed)

          if (!hasDataPathFormat(original)) {
            // It is likely that this participant was a variable that referenced a subexpression
            return;
          }

          if (original.match(literalPathPrefixRegex)) {
            // A literal is not seen as a logic gate participant, we only recognize PathExpressions
            return;
          }

          const _original = original.replace(/\?$/g, '');

          if (!participants[_original]) {
            participants[_original] = loc;
          }
        });

      if (!Object.keys(participants).length) {

        // It is possible that this <logicGatePruneKey> is used elsewhere (i.e. this would be the case if the current
        // ast was loaded from a decorator block), hence we need to ensure that at a later time, the ast is not 
        // pruned using the current <logicGatePruneKey>
        const index = logicGatePruneKeys.indexOf(logicGatePruneKey);

        if (index >= 0) {
          logicGatePruneKeys.splice(index, 1);
        }

        return null;
      }

      if (logicGatePruneKeys.includes(logicGatePruneKey)) {
        // Prune the synthetic method generated for this logic gate
        this.pruneComponentAst({ pruneKey: logicGatePruneKey });
      }

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

      logicGate.participants = Object.entries(participants)
        .map(([original, loc]) => ({ original, loc: { ...loc } }));

      logicGate.table = logicGate.table.map((item) => {
        item.condition = item.condition.map(getValue);

        item.left = getValue(item.left);
        item.right = getValue(item.right);

        return item;
      });

      logicGate.loc = { ...stmt.loc };

      const gateId = utils.generateRandomString();
      this.logicGates[gateId] = logicGate;

      return {
        path: `${logicGatePathRoot}${pathSeparator}${gateId}`,
        logicGate,
      };
    };

    ASTParser.prototype.MustacheStatement = function (stmt) {
      const { loadInlineComponentHelperName, getReservedMustacheHashKeys } = TemplatePreprocessor;

      if (stmt.path.processed) {
        return;
      }

      if (stmt.path.type != 'PathExpression') {
        throwError(
          `Only a PathExpression must be used as the path in a MustacheStatement`,
          stmt,
        );
      }

      validateHash({ stmt, reservedKeys: getReservedMustacheHashKeys() });

      const reservedMethodNames = [loadInlineComponentHelperName];

      if (reservedMethodNames.includes(stmt.path.original) && !stmt.generated) {
        throwError(`Method name: ${stmt.path.original} is reserved`, stmt);
      }

      this.mutating = true;

      const isMetaPath = getMustacheMetaPaths().includes(stmt.path.original);
      const isSubExpression = _this.methodNames.includes(stmt.path.original);

      const originalMethodName = isSubExpression ? stmt.path.original : null;
      const originalParams = isSubExpression ? [...stmt.params] : null;

      stmt.escaped = isEscaped({ stmt });

      const hook = getHook({ stmt });

      // Validate transform, if provided
      getTransform({ stmt });

      if ((!isSubExpression) && !isMetaPath && (stmt.params.length)) {
        throwError(`Unkown method name: ${stmt.path.original}`, stmt);
      }

      const isInlineComponent = originalMethodName == loadInlineComponentHelperName;

      const forceHtmlWrapper = isInlineComponent || hook;

      if (isCustomContext()) {

        if (isMetaPath) {
          return processMustacheMetaStatement.bind(this)({ stmt });
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

                  // Note: For Mustache statements, handlerbars will first attempt to look up this helper in
                  // the current context (calls are router through CustomCtxRenderer.wrapDataWithProxy(...)), 
                  // before then looking it up the helpers object.
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
            createHtmlWrapper: forceHtmlWrapper,
            forceHtmlWrapper,
            canonicalSource: stmt.canonicalSource,
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

      if (stmt.partialSkip) {
        return stmt;
      }

      if (isMetaPath) {
        return processMustacheMetaStatement.bind(this)({ stmt });
      }

      const wrapInResolveMustacheHelper = (original, hash, loc) => {
        const { resolveMustacheInRootHelperName, literalPrefix } = TemplatePreprocessor;

        const isLiteral = original.includes(literalPrefix);

        if (!isLiteral) {
          original += '!!';
        }

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
          forceHtmlWrapper,
          dataBinding: !isLiteral,
          canonicalSource: stmt.canonicalSource,
        };
      }

      if (isSubExpression) {
        const { logicGate, logicGatePruneKey, hash, loc } = stmt;

        stmt.type = 'SubExpression';
        ASTParser.prototype.SubExpression.call(this, stmt);

        if (stmt.processed) {
          let { original, targetComponent } = stmt;

          if (logicGate && logicGate.participants.length) {

            const logicGateInfo = addLogicGate({
              ...stmt,
              logicGate,
              logicGatePruneKey,
            })

            if (logicGateInfo) {
              const { path } = logicGateInfo;
              original = path;
            }
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

          if (isInlineComponent) {
            stmt.targetComponent = targetComponent;
          }

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

    // Note: These are generally expected to have boolean values
    const getPartialConfigHashKeys = () => {
      const { partialDeferHashKey } = TemplatePreprocessor;
      return [partialDeferHashKey];
    }

    const addHashesToContext = function ({ hashPairs, contextObject, ctxIndex }) {
      const {
        stringifyHandlebarsNode, getLiteralValueFromPathExpression,
      } = TemplatePreprocessor;

      const uniqueKeys = getUniqueContextKeys();

      const validateHashPair = ({ key, loc, value }) => {
        if (uniqueKeys.includes(key)) {
          throwError(`Hash key "${key}" cannot be used in this scope`, { loc });
        }

        if (!value.canonicalSource) {
          value.canonicalSource = stringifyHandlebarsNode(value);
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
            canonicalSource,
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

          } else if (literalType) {

            original = getLiteralValueFromPathExpression(pair.value);
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
            canonicalSource,
          };
        }
      }

      return b;
    }

    const addPartialHashesToContext = function (hashPairs, contextList) {
      const contextObject = utils.peek(contextList);
      const ctxIndex = contextList.length - 1;

      return addHashesToContext.bind(this)({ hashPairs, contextObject, ctxIndex })
    }

    const getPartialHashPairs = function ({ stmt }) {
      return getHashPairs(stmt.hash)
        .filter(({ key }) => !getPartialConfigHashKeys().includes(key));
    }

    const getPartialContextList = function ({ stmt }) {

      const partialContextList = utils.deepClone(contextList);

      // Note: PartialStatements are not context switching nodes hence, we don't create any 
      // new context, but rather update the tail context

      const hashPairs = getPartialHashPairs({ stmt });

      const fn = () => addPartialHashesToContext.bind(this)(hashPairs, partialContextList);

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

    const getPartial = ({ ctxList, partialName, stmt }) => {

      const {
        runtimeDecoratorHashKey, eagerDecoratorHashKey, variableHelperName,
        visitNodes, getDecoratorParams, createLocSource, createAst0, getHashValue,
        registerProgram, throwError, generateTemplateSource, setLocSource,
        registerProgramInfo, cloneProgram, getDecoratorBlocksInScope, addSourceToLoc,
      } = TemplatePreprocessor;

      if (stmt.name.type == 'SubExpression') {
        throwError(
          'Dynamic partials are not supported because their ast need to be transformed at compile-time',
          stmt
        );
      }

      let ret;

      const ensureDecoratorParamsAreAvailable = ({ requiredParams, optionalParams, defaultParams, blockName }) => {
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
          // Set a default for optionalParams that are not available on the hash array
          optionalParams.forEach((param) => {
            if (!hashKeys.includes(param)) {
              const pair = {
                key: param,
                value: defaultParams[param] || {
                  type: 'UndefinedLiteral',
                }
              };
              hash.pairs.push(pair);

              assert(pair.value.type.endsWith('Literal'));

              // Note: we don't need to bind "this" since <pair> is a Literal
              addPartialHashesToContext([pair], ctxList);
            }
          });
        }
      }

      const setPartialOrigin = (ast, origin) => {
        visitNodes({
          types: ['PartialStatement'],
          ast,
          // eslint-disable-next-line no-shadow
          consumer: ({ stmt }) => {
            stmt.origin = origin;
          },
        });
      }

      // First, check inline blocks in the scope
      const decoratorBlocks = getDecoratorBlocksInScope({
        bindParents,
      });

      for (const blockName in decoratorBlocks) {
        if (blockName != partialName) {
          continue;
        }

        const decorator = decoratorBlocks[blockName];

        const { requiredParams, optionalParams, defaultParams, templateSource, eager, isOnRoot, loc } = decorator;

        ensureDecoratorParamsAreAvailable({ requiredParams, optionalParams, defaultParams, blockName });

        const program = {
          ...utils.parseJson(decorator.program),
          // This program was already transformed at the same time the overall template program was transformed.
          transformed: true,
        };

        if (eager && [...requiredParams, ...optionalParams].length) {
          const decoratorParams = program.body[0];

          assert(decoratorParams.path.original == variableHelperName);

          decoratorParams.hash.pairs
            .filter(({ synthetic }) => !synthetic)
            .forEach(({ value }) => {
              assert(value.decoratorParameter);

              value.decoratorParameter = false;
            });
        }

        cloneProgram(program);

        ret = {
          decorator,
          program,
          templateSrc: templateSource,
          locSource: loc.source,
        };

        break;
      }

      if (ret) {
        return ret;
      }

      // Then, check root-level inline blocks in parent components. Note: in this case, <inline>
      // will remain false because it is sourced external to this component's ast

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

        const DECORATOR = 'DecoratorBlock';
        const M_STMT = 'MustacheStatement';

        // This contains decorator blocks and variables that need to be loaded before the
        // target decorator block is then loaded
        const scopeNodes = [];

        const { templateSrc, templateAst } = classInfo;
        const locSource = createLocSource({ base: parent, fileName });

        let programId;

        const getProgramId = () => {
          return programId || (programId = registerProgramInfo({
            templateSrc,
            locSource
          }));
        }

        for (const node0 of templateAst.body) {

          const b = (node0.type == DECORATOR) || (node0.type == M_STMT && node0.path.original == variableHelperName)

          if (!b) {
            continue;
          }

          if (node0.type == DECORATOR) {

            const decoratorName = node0.params[0].original;

            if (decoratorBlocks[decoratorName]) {
              continue;
            }

            const node = utils.deepClone(node0);

            setPartialOrigin(node.program, { dir, className: parent });


            const { value: _templateSrc } = generateTemplateSource(templateSrc, node.program);
            const _locSource = createLocSource({ base: parent, fileName, decoratorName });

            registerProgram({
              locSource: _locSource,
              templateSrc: _templateSrc,
              program: node.program
            });

            node.program.type = 'ExternalProgram';
            node.program.loc.source = _locSource;

            if (decoratorName == partialName) {

              const params = [...node.params];

              // Note: params[0] is the decoratorName
              params.shift()

              const { requiredParams, optionalParams, defaultParams } = getDecoratorParams(params, node.hash);

              ensureDecoratorParamsAreAvailable({ requiredParams, optionalParams, defaultParams, blockName: decoratorName });

              ret = {
                program: {
                  body: [
                    ...scopeNodes,
                    node.program,
                  ],
                  programId: getProgramId(),
                },
                templateSrc,
                locSource,
              }

              break;

            } else {

              addSourceToLoc(node.loc, getProgramId(), locSource);
              setLocSource(
                {
                  type: 'Program',
                  body: [{
                    type: 'SubExpression', path: { type: 'PathExpression' },
                    hash: node.hash, params: node.params
                  }]
                },
                getProgramId()
              );

              getHashValue({ stmt: node, key: runtimeDecoratorHashKey, cleanup: true });

              const { original: eager } = getHashValue({ stmt: node, key: eagerDecoratorHashKey }) || {};

              if (eager) {
                // This decorator block needs to resolve it's paths against the root context - similar to how it would have
                // been resolved on the parent
                node.customContextList = [contextList[0]];
              }

              scopeNodes.push(node);
            }

          } else {
            const node = utils.deepClone(node0);

            setLocSource(
              {
                type: 'Program',
                body: [node]
              },
              getProgramId()
            );

            scopeNodes.push(node);
          }
        }

        assert(ret);
        break;
      }

      if (ret) {
        return ret;
      }


      // Finally, attempt to load the partial as a file

      const fileName = `${partialName}.view`;

      const getKnownPartialOrigins = () => {
        const { origin } = stmt;

        // spec: [{ dir, className}];
        const ret = [];

        const addOrigin = (_origin) => {
          if (!origin || origin.dir != _origin.dir) {
            ret.push(_origin);
          }
        };

        if (origin) {
          ret.push(origin);
        }

        addOrigin({
          dir: _this.srcDir,
          className: _this.className,
        });

        addOrigin({
          dir: pathLib.join(process.env.PWD, 'src', 'partials'),
        });

        return ret;
      }

      const getPartialOrigin = () => {
        for (let origin of getKnownPartialOrigins()) {
          const path = pathLib.join(origin.dir, fileName);

          if (fs.existsSync(path)) {
            return origin;
          }
        }
      }

      const origin = getPartialOrigin();

      if (origin) {

        const { partialContents, program } = PartialReader.read({
          path: pathLib.join(origin.dir, fileName),
          astProducer: createAst0,
        });

        setPartialOrigin(program, origin);

        const templateSrc = partialContents;

        const locSource = createLocSource({
          base: origin.className || 'global-partials', fileName,
        });

        registerProgram({
          locSource,
          templateSrc,
          program,
        })

        return { program, templateSrc, locSource };
      }

      // Todo: Explor other partial sources - if needed

    };

    const processAst = ({ templateSrc, ast, ctxList, validateHtml }) => {
      new TemplatePreprocessor({
        srcDir: this.srcDir,
        assetId: this.assetId,
        logger: this.logger,
        templateSrc,
        ast,
        contextList: ctxList,
        bindParents: [...bindParents],
        globals: this.globals,
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
      })
        .process({ validateHtml });
    }

    const processPartial = function ({ stmt }) {
      const {
        partialDeferHashKey, partialRuntimeHashKey, getSuffix, throwError, getProgramLocRange,
      } = TemplatePreprocessor;

      const { original: defer } = getHashValue({ stmt, key: partialDeferHashKey, type: 'BooleanLiteral' }) || {};
      const { original: runtime } = getHashValue({ stmt, key: partialRuntimeHashKey, type: 'BooleanLiteral' }) || {};

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
        getHashValue({ stmt, key: partialRuntimeHashKey, type: 'BooleanLiteral', cleanup: true })

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

      const partialInfo = getPartial.bind(this)({ ctxList, partialName, stmt });

      if (!partialInfo) {
        if (optional) {
          return false;
        } else {
          throw new PartialNotFoundError({ partialName });
        }
      }

      const { decorator, program, templateSrc, locSource } = partialInfo;

      // eslint-disable-next-line no-shadow
      const ast = {
        type: 'ExternalProgram',
        body: program.body,
        programId: program.programId,
        loc: {
          ...getProgramLocRange(program),
          source: locSource,
        }
      };

      processAst({ ast, ctxList, templateSrc, validateHtml: !decorator })

      const parent = utils.peek(bindParents);

      if (isCustomContext()) {
        let contextId;

        if (decorator && decorator.eager) {

          if (!decorator.isCustomCtx) {
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
                body: [ast],
              },
              ...getDefaultStripOptions(),
            };

            replacements.push({
              parent: decorator.parent.body,
              replacementIndex: decorator.parent.body.indexOf(
                decorator.marker,
              ),
              replacementNodes: [storeContextBlock],
              removeAtIndex: true
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
            body: contextId ? [] : [ast],
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
        replacementNodes: [ast],
        loc: stmt.loc,
      });

      return false;
    };

    ASTParser.prototype.PartialStatement = function (stmt) {

      const {
        componentRefType, loadInlineComponentHelperName, wordPattern,
        getReservedPartialHashKeys, throwError, createBooleanLiteral, createStringLiteral, stringifyHandlebarsNode,
      } = TemplatePreprocessor;

      const { name: { original: partialName } } = stmt;

      validateHash({ stmt, reservedKeys: getReservedPartialHashKeys() });

      if (!stmt.canonicalSource) {
        stmt.canonicalSource = stringifyHandlebarsNode(stmt, { useSource: true });
      }

      const hash = stmt.hash || (stmt.hash = { type: 'Hash', pairs: [] });

      if (stmt.params.length) {
        // Add params as hash

        const allowedParamTypes = ['StringLiteral', 'PathExpression'];

        for (let i = 0; i < stmt.params.length; i++) {
          const param = stmt.params[i];

          if (!allowedParamTypes.includes(param.type) || !param.original.match(wordPattern)) {
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

      const isComponentClass = partialName.match(wordPattern) &&
        _this.getComponentClass(partialName);


      if (isComponentClass) {
        const { isAbstract } = global.classesInfo[partialName];

        if (isAbstract) {
          _this.throwError(
            `You cannot directly inline an abstract component, consider adding it to the data model`,
            stmt
          );
        }
      }

      const _hash = {
        ...hash,
        // Note: getHashPairs(...) filters out "generated" hash entries. We need to
        // do so because of the call to processPartial(...) above
        pairs: getHashPairs(hash),
        [utils.objectReferenceKey]: utils.generateRandomString(),
      };

      return ASTParser.prototype.MustacheStatement.call(this, {
        type: 'MustacheStatement',
        params: [{
          ...isComponentClass ? createStringLiteral(partialName) : {
            ...createPathExpression({
              original: partialName,
            }),
            // Note: this <hash> property is used to maintain reference to the hash on the mustache statement
            // so that we can access it from our "onResolve" function
            hash: _hash,
            onResolve: function (stmt, original) {

              const { hash: { pairs } } = stmt;

              const {
                inlineComponentHashKey, dataPathPrefixRegex, canonicalPathHashKey, createBooleanLiteral,
                createStringLiteral,
              } = this.constructor;

              pairs.push({
                type: 'HashPair',
                key: inlineComponentHashKey,
                value: createBooleanLiteral(true),
                synthetic: true,
              });

              pairs.push({
                type: 'HashPair',
                key: canonicalPathHashKey,
                value: createStringLiteral(
                  original.replace(dataPathPrefixRegex, '')
                ),
                synthetic: true,
              });
            },
            immutable: true,
            validType: componentRefType,
            loc: stmt.name.loc,
          },
        }],
        path: {
          ...createPathExpression({
            original: loadInlineComponentHelperName,
          }),
          loc: stmt.loc,
        },
        generated: true,
        escaped: false,
        hash: _hash,
        loc: stmt.loc,
        canonicalSource: stmt.canonicalSource,
      });
    };

    ASTParser.prototype.PartialBlockStatement = function (stmt) {
      const { throwError } = TemplatePreprocessor;
      throwError('PartialBlockStatements are not supported', stmt);
    };

    ASTParser.prototype.DecoratorBlock = function (stmt) {
      const {
        reservedDecoratorNames, runtimeDecoratorHashKey, eagerDecoratorHashKey, variableHelperName, decoratorConfigPrefix,
        customEachHelperName, getDecoratorParams, getHashValue, visitNodes, createMustacheStatement, createPathExpression,
        getNonEmptyLiteralTypes, getLine, generateTemplateSource,
      } = TemplatePreprocessor;

      const { customContextList, fromMarker } = stmt;
      const __contextList = contextList;

      if (customContextList) {
        contextList = customContextList;
      }

      const params = [...stmt.params];

      const { original: decoratorName } = params.shift();

      const { original: runtime } = getHashValue({ stmt, key: runtimeDecoratorHashKey, type: 'BooleanLiteral', cleanup: true }) || {};
      const { original: eager } = runtime ? { original: true } : getHashValue({ stmt, key: eagerDecoratorHashKey, type: 'BooleanLiteral', cleanup: false }) || { original: true };

      if (reservedDecoratorNames.includes(decoratorName)) {
        _this.throwError(`Decorator name: ${decoratorName} is reserved`, stmt);
      }

      const { requiredParams, optionalParams, defaultParams } = getDecoratorParams(params, stmt.hash);

      const decoratorParams = [...requiredParams, ...optionalParams];

      const paramCount = decoratorParams.length;

      const isOnRoot = bindParents.length == 1;

      if (runtime && !fromMarker) {
        // Runtime decorator blocks are only available on the root context because these decorators are 
        // executed using the rootProxy as the context, see RootCtxRenderer.renderDecorator(...)

        if (isCustomContext()) {
          _this.throwError(
            `Runtime decorator block "${decoratorName}" can only be declared on the root level`,
            stmt
          )
        }

        if (!eager) {
          // Runtime decorators needs to be eagerly visited so that the data model can be generated
          _this.throwError(
            `Runtime decorator block "${decoratorName}" should not have "eager" set to false`,
            stmt
          )
        }

        if (paramCount) {

          // If params are allowed, then not all  path expressions will be transformed as root paths inside this decorator's 
          // program, as they will be seen as inline parameters, hence  will not resolve at runtime

          _this.throwError(
            `Runtime decorator block "${decoratorName}" should not have any inline parameters`,
            stmt
          )
        }

        const config = {};

        if (stmt.hash) {

          stmt.hash.pairs
            .filter(({ key }) => key.startsWith(decoratorConfigPrefix))
            .forEach(({ key }) => {
              config[key.replace(decoratorConfigPrefix, '')] = getHashValue({
                stmt, key, type: getNonEmptyLiteralTypes(), cleanup: true,
              }).original;
            });
        }

        config.decoratorName = decoratorName;

        config.outerIterateBlocks = bindParents
          .filter(({ original }) => original == customEachHelperName)
          .map(({ resolvedParam }) => resolvedParam);


        _this.metadata.runtimeDecorators[decoratorName] = {
          config,
          program: stmt.program,
        };
      }

      if (!fromMarker) {
        const { value: templateSource } = generateTemplateSource(_this.templateSrc, stmt.program);

        _this.validateHtml({ templateSource, program: stmt.program });

        stmt.templateSource = templateSource;
      }

      if (eager) {

        if (!fromMarker && decoratorParams.length) {

          // We need to declare variable(s) for the <decoratorParams>, so that if they are referenced inside this
          // block's program, processing will be deferred.

          const { cloneHashKey } = InlineVariableTransformer;

          const loc = { ...stmt.program.loc, end: { ...stmt.program.loc.start } };

          stmt.program.body.unshift(
            createMustacheStatement({
              original: variableHelperName, loc,
              hash: {
                type: 'Hash', loc,
                pairs: decoratorParams
                  .map(k => {

                    if (k == cloneHashKey) {
                      _this.throwError(
                        `"${k}" cannot be used as a decorator parameter, try using another name`,
                        stmt
                      );
                    }

                    return {
                      type: 'HashPair', loc,
                      key: k,
                      value: {
                        ...createPathExpression({ original: k }),
                        decoratorParameter: true,
                        loc
                      }
                    };
                  })
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
          paramCount, requiredParams, optionalParams, defaultParams, runtime,
          loc: stmt.program.loc,
          index: bindParents.length,
        };
        bindParents.push(parent);

        this.acceptKey(stmt, 'program');

        pruneScopeVariables();

        bindParents.pop();


        if (runtime && !isOnRoot) {

          visitNodes({
            types: ['PathExpression'],
            ast: stmt.program,
            consumer: ({ stmt: path }) => {
              if (!path.processed) {
                _this.throwError(
                  `Runtime decorator "${decoratorName}" contains unresolved path expression @ ${getLine(path)}`, stmt,
                );
              }
            },
          });
        }

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
        requiredParams, optionalParams, defaultParams,
        isCustomCtx: isCustomContext(),
        runtime, eager, isOnRoot,
      });
    };

    ASTParser.prototype.ExternalProgram = function (stmt) {

      bindParents.push({
        type: stmt.type,
        body: stmt.body,
        parent: utils.peek(bindParents),
        loc: stmt.loc,
        index: bindParents.length,
      });

      stmt.type = 'Program';
      this.accept(stmt);
      stmt.type = 'ExternalProgram';

      pruneScopeVariables();

      bindParents.pop();
    };

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

    if (validateHtml) {
      this.validateHtml({ program: this.ast });
    }

    replaceNodes();
  }

  static getHashPairs(hash) {
    return hash ? hash.pairs.filter(({ generated }) => !generated) : [];
  }

  validateHtml({ templateSource: src, program }) {
    const { getProgramInfoRegistry, getSourceIndex, visitNodes, sanitizeValue } = TemplatePreprocessor;

    if (!src) {
      const { programId } = program;
      src = getProgramInfoRegistry()[programId].templateSource;
    }

    visitNodes({
      types: ['CommentStatement', 'DecoratorBlock'],
      ast: program,
      consumer: ({ stmt }) => {
        const { decorator, type } = stmt;

        if (type == 'DecoratorBlock' || decorator) {
          const { startIndex, endIndex } = getSourceIndex(src, stmt);

          src = src.substring(0, startIndex) +
            sanitizeValue(
              src.substring(startIndex, endIndex + 1), ' '
            ) +
            src.substring(endIndex + 1, src.length);

          return false;
        }
      },
      parentFirst: true,
    });

    const htmlErrors = [];

    this.getW3cHtmlErrors(
      src,
      program.loc,
      htmlErrors,
    );

    if (htmlErrors.length) {
      htmlErrors.forEach(err => {
        this.logger.error(err);
      });

      throw Error(`Please fix the above HTML errors to proceed`);
    }
  }

  static getSourceIndex(src, node) {
    const loc = node.loc.end.column == 0 ? utils.deepClone(node.loc) : node.loc;

    const fn = lineColumn(src);

    const startIndex = fn.toIndex({ line: loc.start.line, column: loc.start.column + 1 })

    if (loc.end.column == 0) {
      // loc columns in handlebars are 0-based, instead of 1-based which is required here
      loc.end.column += 1;
    }

    let endIndex = fn.toIndex({ line: loc.end.line, column: loc.end.column })

    if (loc.end.column == 1) {
      endIndex -= 1;
    }

    return { startIndex, endIndex };
  }

  static generateTemplateSource(src, node) {
    const { getSourceIndex, sanitizeValue } = TemplatePreprocessor;

    const { startIndex, endIndex } = getSourceIndex(src, node);

    // Note: We are sanitizing any markup outside the block represented by the loc object
    // because we don't want any warning raised for markup outside the program
    const value = sanitizeValue(
      src.substring(0, startIndex), ' '
    ) +
      src.substring(startIndex, endIndex + 1);

    return { value, range: { startIndex, endIndex } };
  }

  static getDecoratorParams(params, hash) {
    const { decoratorConfigPrefix, isConditionalParticipant, throwError } = TemplatePreprocessor;

    const requiredParams = [];
    const optionalParams = [];

    const defaultParams = {};

    params.forEach((stmt) => {
      (isConditionalParticipant(stmt) ? optionalParams : requiredParams)
        .push(stmt.original);
    });

    if (hash) {
      hash.pairs
        .filter(({ key }) => !key.startsWith(decoratorConfigPrefix))
        .forEach(({ key, value, loc }) => {

          if ([...requiredParams, ...optionalParams].includes(key)) {
            throwError(`Param "${key}" already specified`, { loc });
          }
          if (!value.type.endsWith('Literal')) {
            throwError(`The default value for param "${key}" must be a Literal`, { loc });
          }

          optionalParams.push(key);
          defaultParams[key] = value;
        })
    }

    return { requiredParams, optionalParams, defaultParams };
  }

  addInlineBlock({
    bindParents, decoratorName, stmt, requiredParams, optionalParams,
    defaultParams, isCustomCtx, runtime, eager, isOnRoot,
  }) {
    const { dataPathRoot, visitNodes, registerProgram } = TemplatePreprocessor;

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

        if (!expr[utils.objectReferenceKey]) {
          // Generate referenceIds for this PathExpression inorder for object
          // reference to be maintained after cloning, during partial inlining (if applicable).
          // This is important for example, in the case of logic gate participants
          // that need to maintain the PathExpression object references, e.t.c
          expr[utils.objectReferenceKey] = utils.generateRandomString();
        }
      },
    });

    if (!stmt.program.programId) {
      // This decorator block belongs to this component and was not 
      // imported from a parent component

      registerProgram({
        locSource: this.createOwnLocSource(decoratorName),
        templateSrc: stmt.templateSource,
        program: stmt.program
      });

      if (isOnRoot) {
        const inlineBlocks = this.metadata.inlineBlocks || (this.metadata.inlineBlocks = []);
        inlineBlocks.push(decoratorName);
      }
    }

    const decorators = parent.decorators || (parent.decorators = {});

    decorators[decoratorName] = {
      program: utils.stringifyJson(stmt.program),
      decoratorName,
      isOnRoot,
      requiredParams, optionalParams, defaultParams,
      marker,
      isCustomCtx,
      runtime, eager,
      templateSource: stmt.templateSource,
      loc: stmt.loc,
    };

    return marker;
  }

  static getDecoratorBlocksInScope({ bindParents }) {
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
        case 'ExternalProgram':
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


  static visitNodes({ Visitor, types, ast, consumer, parentFirst = true }) {
    const { getVisitor } = TemplatePreprocessor;

    if (!Visitor) {
      Visitor = getVisitor();
    }

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

  static getVisitor() {
    const { Visitor } = handlebars;

    Visitor.prototype.ExternalProgram = function (stmt) {
      stmt.type = 'Program';
      this.accept(stmt);
      stmt.type = 'ExternalProgram';
    }

    Visitor.prototype.ComponentReference = function () {
    }

    Visitor.prototype.NodeReplacement = function () {
    }

    Visitor.prototype.Program = function (program) {
      const array = program.body;

      for (let i = 0, l = array.length; i < l; i++) {
        this.acceptKey(array, i);

        switch (true) {

          case !array[i]:
            array.splice(i, 1);
            i--;
            l--;
            break;

          case array[i].type == 'NodeReplacement':
            const { repl } = array[i];
            array.splice(
              i, 1, ...repl,
            );
            i--;
            l += repl.length - 1;
            break;
        }
      }
    }

    return Visitor;
  }

  static getDefaultStripOptions(loc) {
    const strip = { open: false, close: false };

    return {
      openStrip: strip,
      closeStrip: strip,
      loc,
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

  static createNumberLiteral(original) {
    const { createLiteral } = TemplatePreprocessor;
    return createLiteral({ type: 'NumberLiteral', original });
  }

  static createLiteral({ type, original }) {
    return { type, original, value: original };
  }

  static getLine(stmt, range = true, useProgramId = false) {
    const { loc: { programId, source, start, end } = {} } = stmt;

    // Note: we need to do "+ 1" to column because hbs is 0-based but most IDEs are 1-based
    return `${useProgramId ? programId : source} ${start.line}:${start.column + 1}${range ? ` - ${(end.source && end.source != source) ? `${end.source} ` : ''}${end.line}:${end.column + 1}` : ''}`;
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

      let { replacementIndex } = block;

      assert(replacementIndex >= 0);
      assert(replacementIndex <= block.parent.length);

      for (let i = 0; i < block.replacementNodes.length; i++) {

        block.parent.splice(
          replacementIndex,
          (i == 0 && block.removeAtIndex) ? 1 : 0,
          block.replacementNodes[i]
        );

        // eslint-disable-next-line no-plusplus
        replacementIndex++;
      }

      // eslint-disable-next-line no-plusplus
      for (let index2 = index + 1; index2 < replacements.length; index2++) {
        const b = replacements[index2];

        if (b.parent === block.parent && b.replacementIndex >= block.replacementIndex) {
          b.replacementIndex += block.replacementNodes.length + (block.removeAtIndex ? -1 : 0);
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

  static createContentStatement({ original, loc }) {
    return {
      type: 'ContentStatement',
      original,
      value: original, loc,
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
      startAttrCtxHelperName, endAttrCtxHelperName, textBindContextHelperName, blockWrapperIdHelperName,
      resolveMustacheInRootHelperName, resolveMustacheInCustomHelperName, contentHelperName,
      variableHelperName, wrapInvocationWithProxyMethodName,
    } = TemplatePreprocessor;
    return [
      storeContextBlockName, loadContextBlockName, customEachHelperName, conditionalHelperName,
      startAttrCtxHelperName, endAttrCtxHelperName, textBindContextHelperName, blockWrapperIdHelperName,
      resolveMustacheInRootHelperName, resolveMustacheInCustomHelperName, contentHelperName,
      variableHelperName, wrapInvocationWithProxyMethodName,
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
        messages.push(
          `[${loc.source} ${line}:${column}] ${ruleId}: ${transformMessageWithDictionary({ message, dictionary })}`
        );
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
    const { ctxHashKey, inlineComponentHashKey, canonicalPathHashKey } = TemplatePreprocessor;
    return [ctxHashKey, inlineComponentHashKey, canonicalPathHashKey];
  }

  static getReservedBlockHashKeys() {
    const {
      scopeVariableHashKey, indexVariableHashKey, stateHashKey, rootQualifier, getDataVariables
    } = TemplatePreprocessor;
    return [
      scopeVariableHashKey, indexVariableHashKey, stateHashKey, rootQualifier,
      ...getDataVariables(),
    ];
  }

  static getReservedPartialHashKeys() {
    const {
      partialIdHashKey, partialNameHashKey, scopeVariableHashKey, indexVariableHashKey, stateHashKey,
      hookHashKey, hookPhaseHashKey, hookOrderHashKey, rootQualifier, getDataVariables,
    } = TemplatePreprocessor;
    return [
      partialIdHashKey, partialNameHashKey, scopeVariableHashKey, indexVariableHashKey, stateHashKey,
      hookHashKey, hookPhaseHashKey, hookOrderHashKey, rootQualifier, ...getDataVariables(),
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
      'PartialBlockStatement', 'ExternalProgram', 'MustacheGroup', 'Decorator'
    ];
  }

  static stringifyHandlebarsNode(node, opts = {}) {
    const { throwError } = TemplatePreprocessor;

    const { headerOnly, useSource } = opts;

    const arr = [];

    const accept = (node) => {
      if (!node) return;

      const accepSubExpr = (stmt) => {
        if (stmt.path) {
          accept(stmt.path);
        }

        for (let i = 0; i < stmt.params.length; i++) {
          const param = stmt.params[i];

          if (stmt.path || i > 0) {
            arr.push(' ');
          }

          accept(param)
        }
        if (stmt.hash && stmt.hash.pairs.length) {
          arr.push(' ');
          accept(stmt.hash)
        }
      }

      const accepBlock = (stmt) => {
        arr.push('{{#');
        accepSubExpr(stmt)

        if (stmt.program.blockParams) {
          arr.push(' as |');
          arr.push(stmt.program.blockParams.join(' '))
          arr.push('|');
        }

        arr.push('}}');

        if (!headerOnly) {
          accept(stmt.program);
          if (stmt.inverse) {
            arr.push('{{else}}');
            accept(stmt.inverse);
          }
          arr.push('{{/');
          accept(stmt.path);
          arr.push('}}');
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
          arr.push(node.original);
          break;
        case node.type == 'StringLiteral':
          arr.push(node.raw || `"${node.original || node.value}"`);
          break;
        case node.type == 'BooleanExpression':
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
          accepBlock(node);
          break;
        // NoOp types... Todo: Impl CommentStatement
        case node.type == 'CommentStatement':
        case node.type == 'PartialBlockStatement':
          break;
        // Custom AST types
        case node.type == 'ExternalProgram':
          node.body.forEach(accept);
          break;

        case node.type == 'TernaryExpression':
          node.condition.forEach((e, i) => {
            if (i > 0) {
              arr.push(' ');
            }
            accept(e);
          });

          if (node.left) {
            arr.push(' ? ');
            accept(node.left);
          }

          if (node.right) {
            arr.push(' : ');
            accept(node.right);
          }

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

        case useSource && (node.source || node.canonicalSource):
          arr.push(node.source || node.canonicalSource);
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
    html = '<!DOCTYPE html>', options = {}
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

    global.K_Trie = importFresh('../src/assets/js/lib/trie');
    global.EventHandler = importFresh('../src/assets/js/lib/event_handler');
    global.K_Database = importFresh('../src/assets/js/lib/database');
    global.TemplateRuntime = importFresh('../src/assets/js/template-runtime');
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

    global.hyntax = { StreamTokenizer, constructTree };

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

    global.programInfoRegistry = {};

    // Note: Some window members are proxied by JsDom, hence for such non-enumerable properties,
    // we need to explicitly do a get operation for them

    const { extendedWindowProperties = [] } = getSrcConfig() || {};

    extendedWindowProperties.forEach(prop => {
      global[prop] = window[prop];
    });

    self.appContext = null;


    const release = () => {
      for (const k of polyfilledProps) {
        delete global[k];
      }
      delete global.window;
      delete global.document;

      delete global.programInfoRegistry;

      delete global.templates;
      delete global.components;
      delete global.preprocessor;
      delete global.classesInfo;
    };

    return { release }
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

  invokeComponentLifecycleMethod(name) {
    const { getOwnMethod } = TemplatePreprocessor;

    const fn = getOwnMethod({
      component: this.component, name, className: this.className
    });

    if (fn) {
      fn();
    }
  }

  /**
  * This returns the component instance of the template
  * that is currently being processed
  */
  getComponent({ ComponentClass }) {

    // Todo: During initial loading process, we need to perform
    // some code checks to prevent dangerous code, i.e. access to
    // node apis, since it's for the client side. Note that only
    // index.test.js can contain "require" becuase it needs

    // Todo: methods in the test.js class that override from index.js
    // should have no arguments and is expected to return test data,
    // that has the same type as the actual method.
    // This arg-check needs to be performed and we also need to ensure
    // that all helpers used in the template are defined in the index.js file

    // Todo: components must not have a constructor defined

    // Todo: verify that behaviours() is an array of no-arg methods in index.js

    // Create component instance
    const component = new ComponentClass({
      input: this.resolver.createDynamicResolver({ path: '', target: {} }),
      config: {
        loadable: false,
      }
    });

    component.init();

    if (this.resolver.processing) {
      component.resolver = this.resolver;
      component.startSyntheticCacheContext();
    }

    return component;
  }
}

module.exports = TemplatePreprocessor;
