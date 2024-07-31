/* eslint-disable no-case-declarations */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */
/* eslint-disable func-names */
/* eslint-disable no-console */
/* eslint-disable no-restricted-syntax */

// eslint-disable-next-line no-undef
class RootCtxRenderer extends BaseRenderer {

  static syntheticAliasSeparator = '$$';

  static syntheticBlockKeyPrefix = `each${this.syntheticAliasSeparator}`;

  static syntheticChildPathSuffix = '_child';

  static htmlWrapperCssClassname = 'mst-w';

  static #defaultHookOrder = 100;

  static cachedNameSuffix = '_cached';

  static #token;

  static attrBindContextEvent = 'attributeBindContext';

  static nodeIdSelector = /#([a-zA-Z][a-zA-Z0-9_-]*)/;

  static attributeValueWrapper = `"`;

  static #instancesMap = new Map();

  #dataStack;

  #attributeEmitContext;

  #syntheticCache;

  #helperFunctionNames = {};

  #inlineComponentInstances;

  #rendered;

  #mounted;

  #emitContext;

  #renderContext;

  #hooks;

  #addAttributeValueObserver;

  #methodInvokeCache;

  constructor({
    id, input, logger, config,
  } = {}) {
    super({
      id, input, logger, config,
    });

    this.#inlineComponentInstances = {};

    this.#hooks = {};

    this.#emitContext = [];
    this.#renderContext = [];

    // Todo: Move these to the emit context
    this.#dataStack = [];

    // Todo: Make blockData private, very important
    this.blockData = {};

    // Todo: Make syntheticContext private as well
    this.syntheticContext = {};

    this.#syntheticCache = [];
    this.#methodInvokeCache = {};
  }

  destroy() {
    super.destroy();

    const b = RootCtxRenderer.#instancesMap.delete(this.getId());

    assert(b);

    Object.values(this.#inlineComponentInstances)
      .forEach(i => {
        i.destroy();
      })

    this.#inlineComponentInstances = null;

    setTimeout(() => {
      delete this.node;
    }, 5000);

    this.#pruneRuntimeGlobalHelpers();
  }

  static onComponentNodeRemoved(id) {
    const instance = this.#instancesMap.get(id);

    if (instance) {
      instance.destroy();
    }
  }

  isMounted() {
    return !!this.#mounted;
  }

  static setToken(token) {
    if (RootCtxRenderer.#token) {
      throw Error(`Could not set token: ${token}`);
    }
    RootCtxRenderer.#token = token;
  }

  hasRenderContext() {
    return !!this.#renderContext.length;
  }

  getRenderContext() {
    if (!this.hasRenderContext()) {
      this.throwError(`No render context exists`);
    }
    return this.#renderContext.at(-1);
  }

  hasEmitContext() {
    return !!this.#emitContext.length;
  }

  getEmitContext() {
    if (!this.hasEmitContext()) {
      this.throwError(`No emit context exists`);
    }
    return this.#emitContext.at(-1);
  }

  getAttributeEmitContext() {
    return this.#attributeEmitContext;
  }

  pushToEmitContext(ctx) {
    this.#emitContext.push(ctx);
  }

  popEmitContext() {
    this.#emitContext.pop();
  }

  startTokenizationContext({ blockStack = [] } = {}) {

    const hasBlockTransform = this.hasBlockTransform();
    const streamTokenizer = hasBlockTransform ? new hyntax.StreamTokenizer() : null;

    if (streamTokenizer) {
      streamTokenizer
        .on('data', (tokens) => {
          const ctx = this.getEmitContext();
          ctx.tokenList = ctx.tokenList.concat(tokens);
        });
    }

    const ctx = {
      tokenList: [], blockStack, variables: {},
      transforms: {}, stringBuffer: [], tokenize: !!streamTokenizer,
      nodeIdStore: {}, logicGates: {}, mustacheStatements: {}, hooks: [],
      write: (value, force) => {
        if (!blockStack.length || force) {
          if (streamTokenizer) {
            streamTokenizer.write(value);
          }
          ctx.stringBuffer.push(value);
        }
      }
    };

    this.pushToEmitContext(ctx);
  }

  getFunctionListFromString(str) {
    const { getCommaSeperatedValues } = clientUtils;
    return getCommaSeperatedValues(str).map(n => this[n].bind(this));
  }

  finalizeTokenizationContext({ transform, asString = true } = {}) {
    const { visitHtmlAst } = RootCtxRenderer;

    const ctx = this.getEmitContext();

    const { mustacheStatements, hooks, tokenList, tokenize, stringBuffer } = ctx;

    let ast;
    let ret;

    if (tokenize) {
      const { ast: _ast } = hyntax.constructTree(tokenList);
      this.#applyTransformsToAst({ ast: _ast, transform });

      ast = _ast;
    }

    if (asString) {
      if (ast) {
        const arr = [];
        visitHtmlAst({
          ast, emitter: (s) => {
            arr.push(s);
          }, format: false,
        });
        ret = arr.join('');
      } else {
        ret = stringBuffer.join('');
      }
    } else {
      ret = ast ? this.createDomNodeFromAst({ ast, format: false }) : this.#parseHTMLString(stringBuffer.join(''));
    }

    this.popEmitContext();

    if (this.dataBindingEnabled()) {

      this.onContextFinalization(() => {
        const { MustacheStatementList, HookList } = RootProxy;

        const { primaryKey } = MustacheStatementList;

        MustacheStatementList.put(
          this.proxyInstance, Object.entries(mustacheStatements)
            .map(([k, v]) => ({
              [primaryKey]: k, ...v,
            }))
        );

        hooks.forEach(([path, hook]) => {

          // Remove internal data from blockStack
          hook.blockStack = hook.blockStack.map(block => {
            const ret = { ...block };
            delete ret.variables;
            return ret;
          });

          HookList.add(this.proxyInstance, path, hook);
        });
      });
    }

    return ret;
  }

  #parseHTMLString(htmlString) {
    const parser = new window.DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    return doc.body.firstChild;
  }

  registerNodeId(nodeIndex, nodeId) {
    const { nodeIdStore } = this.getEmitContext();

    if (nodeIndex != null) {
      nodeIdStore[nodeIndex] = nodeId;
    }
  }

  getBlockContextObject({ blockId, blockData, loc }) {
    return {
      blockId, blockData, variables: {},
      locString: clientUtils.getLine({ loc }, false, true)
    };
  }

  startBlockContext({ blockId = this.randomString('blockId', 3), blockData, loc }) {

    const { blockStack } = this.getEmitContext();

    blockStack.push(
      this.getBlockContextObject({ blockId, blockData, loc })
    );

    return blockId;
  }

  endBlockContext() {
    const { blockStack } = this.getEmitContext();
    blockStack.pop();
  }

  addVariableToScope(key, value) {
    const { blockStack, variables } = this.getEmitContext();

    if (blockStack.length) {
      blockStack[blockStack.length - 1].variables[key] = value;
    } else {
      variables[key] = value;
    }
  }

  getVariableInScope(name) {
    const { blockStack, variables } = this.getEmitContext();

    if (blockStack) {
      for (let i = blockStack.length - 1; i >= 0; i--) {
        const { variables } = blockStack[i];

        if (variables[name] !== undefined) {
          return variables[name];
        }
      }
    }

    return variables[name];
  }

  nodeIdTransformSelector(nodeId) {
    assert(nodeId);
    return `#${nodeId}`
  }

  registerTransform(selector, methodName) {
    this.getEmitContext().transforms[selector] = methodName;
  }

  #getRuntimeHelpers() {
    const { getMetaHelpers } = RootCtxRenderer;

    const helpers = this.getHandlebarsHelpers()

    // Register meta helper(s)
    for (const helperName of getMetaHelpers()) {
      // eslint-disable-next-line no-underscore-dangle
      const _this = this;
      helpers[helperName] = function () {
        // eslint-disable-next-line prefer-rest-params
        const params = Array.from(arguments);
        const options = params.pop();

        return _this[helperName]
          .bind(_this)({ options, ctx: this, params });
      };
    }

    return helpers;
  }

  #invokeHelper(helperName, ...args) {
    try {
      return this[helperName].bind(this)(...args);
    } catch (e) {
      console.error(e);
    }
  }

  getHelpersNamespace() {
    return '__helpers';
  }

  #createRuntimeGlobalHelpers() {
    // Expose global helpers as global functions for our fn helper

    const noOpHelper = 'noOp';

    const helpersNamespace = this.getHelpersNamespace();
    const __helpers = global[helpersNamespace] || (global[helpersNamespace] = {});

    for (const helperName of this.getGlobalHelpers()) {

      const id = this.randomString('globalHelpers');
      this.#helperFunctionNames[helperName] = id;

      __helpers[id] = (...args) => {
        this.#invokeHelper(helperName, ...args)
      };
    }

    if (!__helpers[noOpHelper]) {
      __helpers[noOpHelper] = () => { }
    }
  }

  #pruneRuntimeGlobalHelpers() {
    const helpersNamespace = this.getHelpersNamespace();
    const __helpers = global[helpersNamespace] || (global[helpersNamespace] = {});

    Object.values(this.#helperFunctionNames).forEach(id => {
      delete __helpers[id];
    });

    this.#helperFunctionNames = null;
  }

  #getDecoratorFromMetadata(decoratorName, metadata) {
    const { decorators } = metadata;
    const decorator = decorators[decoratorName];

    if (!decorator) {
      this.throwError(`Could not find runtime decorator "${decoratorName}"`);
    }

    return decorator;
  }

  getTemplateSpecForBlock({ metadata, locString, inverse }) {
    const { blockPrograms, programTree } = metadata;

    let { innerPrg } = blockPrograms[locString];

    if (inverse) {

      if (Array.isArray(innerPrg) && innerPrg[1]) {
        innerPrg = innerPrg[1];
      } else {
        return null;
      }

    } else if (Array.isArray(innerPrg)) {
      [innerPrg] = innerPrg;
    }

    const templateSpec = {
      main: this.#getProgram(metadata, innerPrg)[1],
      useData: true,
    };

    programTree[innerPrg].forEach(p => {
      const [id, program] = this.#getProgram(metadata, p);
      templateSpec[id] = program;
    });

    return templateSpec;
  }

  getTemplateFunction({ metadata, templateSpec, locString }) {
    return () => {

      const helpers = this.#getRuntimeHelpers();

      this.#createRuntimeGlobalHelpers();

      return global.TemplateRuntime.template(this, metadata, templateSpec, helpers)
        (this.rootProxy);
    };
  }

  /**
   * Render a runtime decorator block
   * 
   * @param {string} decoratorName 
   * @param {Function | Node} target If target is a function, the general contract is that the htmlString
   * passed to it would have been added to the DOM after the function returns
   * @param blockData
   * @returns Promise<Promise[]> a list of promises; and after they all resolve, this decorator is guaranteed
   *          to have fully mounted on the DOM
   */

  async renderDecorator(decoratorName, target, blockData) {
    const futures = this.renderDecorator0(
      decoratorName, target, blockData, await this.getMetadata(), { data: {} },
    );

    this.dispatchEvent('domLoaded');
    this.pruneLifecycleEventHandlers();

    return futures;
  }

  renderDecorator0(decoratorName, target, blockData, metadata, runtimeOptions) {

    const { templateSpec, locString } = this.#getDecoratorFromMetadata(decoratorName, metadata);

    this.startRenderingContext({ decoratorName, runtimeOptions });
    this.startTokenizationContext();

    /////=====================================/////

    const fn = this.getTemplateFunction({ metadata, templateSpec, locString });

    if (blockData) {
      this.executeWithBlockData(fn, blockData);
    } else {
      fn();
    }

    /////=====================================/////

    const htmlString = this.finalizeTokenizationContext();

    if (target) {
      if (typeof target == 'function') {
        target(htmlString);
      } else {
        assert(target instanceof Node);
        target.innerHTML = htmlString;
      }
    }

    const { futures, extendedFutures } = this.finalizeRenderingContext();
    return [...futures, ...extendedFutures];
  }

  #getProgram(metadata, id) {
    if (id.includes('/')) {
      const [decoratorName, _id] = id.split('/');
      return [
        _id, this.#getDecoratorFromMetadata(decoratorName, metadata).templateSpec[_id]
      ];
    }
    return [id, metadata.templateSpec[id]];
  }

  isLoadable0() {
    return this.getConfig().loadable;
  }

  isLoadable() {
    return this.isLoadable0();
  }

  #applyTransformsToAst({ ast, transform }) {
    const { visitHtmlAst } = RootCtxRenderer;

    const { transforms } = this.getEmitContext();

    if (transform) {
      const { content: { children } } = ast;

      if (children) {
        (
          (typeof transform == 'function') ? [transform] :
            this.getFunctionListFromString(transform)
        )
          .forEach(fn => fn(children))
      }
    }

    if (Object.keys(transforms).length) {
      const tagVisitor = (node) => {
        const { content } = node;

        const attr = (k) => (content.attributes || []).filter(({ key: { content } }) => content == k)[0];
        const idAttr = attr('id');

        if (idAttr) {
          const nodeId = idAttr.value.content;
          const nodeIdTransform = transforms[this.nodeIdTransformSelector(nodeId)];

          if (nodeIdTransform) {
            this.getFunctionListFromString(nodeIdTransform)
              .forEach(fn => fn(node))
          }
        }
      }

      visitHtmlAst({ ast, tagVisitor });
    }
  }

  static visitHtmlAst({ ast, emitter, tagVisitor, format }) {

    const formatText = (value) => {
      return format ? value.trim().replace(/\s+/g, ' ') : value;
    }

    const emitFn = (value) => {
      if (emitter) {
        emitter(value);
      }
    }

    const acceptChildren = (children) => {
      [...children]
        .forEach(acceptNode);
    }

    const acceptContent = (content) => {

      const { attributes, children, openStart, openEnd, close, value, start, end, name } = content;

      if (name) {
        // If a "transform" updated the tag name, we want to integrate those changes

        if (openStart) {
          openStart.content = `<${name}`;
        }
        if (close) {
          close.content = `</${name}>`;
        }
      }

      const emitContent = ({ content } = {}) => {
        if (content) {
          emitFn(content);
        }
      }

      emitContent(start)
      emitContent(openStart)
      if (attributes) {
        attributes.forEach(acceptAttribute);
      }
      emitContent(openEnd)

      if (value) {
        value.content = formatText(value.content);
      }

      emitContent(value)

      if (children) {
        acceptChildren(children);
      }
      emitContent(close)
      emitContent(end)
    }

    const acceptAttribute = (attribute) => {
      const { key, startWrapper, value, endWrapper } = attribute;
      emitFn(' ');
      if (key) {
        emitFn(key.content);

        if (startWrapper || value) {
          emitFn('=');
        }
      }
      if (startWrapper) {
        emitFn(startWrapper.content);
      }
      if (value) {
        emitFn(
          formatText(value.content)
        );
      }
      if (endWrapper) {
        emitFn(endWrapper.content);
      }
    }

    const acceptTag = (node) => {
      if (tagVisitor) {
        tagVisitor(node);
      }

      acceptContent(node.content);
    }

    const acceptNode = (node) => {
      switch (node.nodeType) {
        case 'document':
        case 'doctype':
        case 'text':
        case 'script':
        case 'style':
          acceptContent(node.content);
          break;
        case 'tag':
          acceptTag(node);
          break;
        default:
          throw Error(`Unknown node type "${node.nodeType}"`);
      }
    }

    if (ast.content.children) {
      acceptChildren(ast.content.children);
    }
  }

  createDomNodeFromAst({ ast, format }) {

    const formatText = (value) => {
      return format ? value.trim().replace(/\s+/g, ' ') : value;
    }

    const acceptChildren = (node, children) => {
      [...children]
        .forEach((n) => acceptNode(node, n));
    }

    const acceptAttribute = (node, attribute) => {
      const { key, startWrapper, value = { content: '' }, endWrapper } = attribute;
      assert(key);

      this.setNodeAttribute(node, key.content, formatText(value.content));
    }

    const acceptNode = (parentNode, node) => {
      let ret;

      switch (node.nodeType) {
        case 'doctype':
        case 'document':
          break;

        case 'text':
          (() => {
            const { value } = node.content;

            parentNode.appendChild(
              document.createTextNode(
                formatText(value.content)
              )
            );
          })();
          break;
        case 'script':
        case 'style':
        case 'tag':
          (() => {
            const { attributes, children, openStart } = node.content;

            const tagName = openStart.content.replace('<', '');
            const _node = document.createElement(tagName);

            if (attributes) {
              attributes.forEach(n => {
                acceptAttribute(_node, n);
              });
            }

            if (children) {
              acceptChildren(_node, children);
            }

            parentNode.appendChild(_node);
          })();
          break;

        default:
          throw Error(`Unknown node type "${node.nodeType}"`);
      }

      return ret;
    }

    if (ast.content.children) {
      const documentFragment = document.createDocumentFragment();

      acceptChildren(documentFragment, ast.content.children);
      return documentFragment;

    } else {
      return document.createTextNode('');
    }
  }

  setNodeAttribute(node, attrName, attrValue) {
    const elementName = node.tagName.toLowerCase();

    const htmlIntrinsicAttrs = this.getHtmlIntrinsicAttributes(elementName);

    const { type } = (htmlIntrinsicAttrs[attrName] || {});

    if (type == 'boolean') {
      node[attrName] = attrValue === undefined ? null : !!attrValue;
    } else {
      if (attrValue === undefined) {
        node.removeAttribute(attrName);
      } else {
        if (type) {
          node[attrName] = attrValue;
        } else {
          node.setAttribute(attrName, attrValue);
        }
      }
    }
  }


  isComponentRendered() {
    return this.#rendered;
  }

  async getMetadata() {
    const classMmetadata = self.appContext.getComponentClassMetadataMap()[this.getComponentName()];

    if (!classMmetadata.metadata) {
      assert(!this.isHeadlessContext());

      classMmetadata.metadata = await self.appContext.fetch(
        `/components/${this.getAssetId()}/metadata.min.js`
      );

      setTimeout(() => {
        classMmetadata.metadata = null;
      }, 30000);
    }

    return classMmetadata.metadata;
  }

  async getRenderedHtml({ token }) {

    if (token !== RootCtxRenderer.#token && !this.isRoot()) {
      throw Error(`Invalid token: ${token}`);
    }

    if (this.#rendered) {
      throw Error(`${this.getId()} is already rendered`);
    }

    await super.init();

    await this.invokeLifeCycleMethod('beforeRender');

    this.dispatchEvent('beforeRender');

    this.startRenderingContext();
    this.startTokenizationContext();


    /////=====================================/////

    const metadata = await this.getMetadata();
    const { templateSpec } = metadata;

    const helpers = this.#getRuntimeHelpers();

    this.#createRuntimeGlobalHelpers();

    global.TemplateRuntime.template(this, metadata, templateSpec, helpers)
      (this.rootProxy);

    /////=====================================/////


    const htmlString = this.finalizeTokenizationContext();

    const renderContext = this.#finalizeRenderingContext();

    this.blockData = null;

    this.#rendered = true;

    return { htmlString, renderContext };
  }

  getDefaultDomRelayTimeout() {
    return 0;
  }

  async load({ container, token, html, renderContext, domRelayTimeout = this.getDefaultDomRelayTimeout() }) {

    const { htmlWrapperCssClassname } = RootCtxRenderer;

    if (this.isMounted()) {
      this.throwError(`Component is already mounted`);
    }

    if (token !== RootCtxRenderer.#token && !this.isRoot()) {
      this.throwError(`Invalid token: ${token}`);
    }

    await super.init();

    if (!this.isLoadable()) {
      this.throwError(`Component is not loadable`);
    }

    const parentNode = container ? document.querySelector(container) : document.body;

    // We require that the <parentNode> is a live element, present om the DOM
    assert(parentNode != null, `DOMElement ${container} does not exist`);

    this.node = document.createElement('div');

    this.node.id = this.getId();
    this.node.classList.add(htmlWrapperCssClassname);
    this.node.setAttribute('__component', this.getId())

    parentNode.appendChild(this.node);

    // const startTime = performance.now();

    if (!renderContext) {
      const ret = await this.getRenderedHtml({ token });

      html = ret.htmlString;
      renderContext = ret.renderContext;
    }

    // const endTime = performance.now()

    // if (!this.isHeadlessContext() && this.isRootComponent()) {
    //   this.logger.info(null, `Template rendered after ${endTime - startTime} ms`);
    // }

    this.node.innerHTML = html;

    const { futures, resolve } = renderContext;

    resolve();


    this.dispatchEvent('beforeMount');

    futures.push(
      this.invokeLifeCycleMethod('beforeMount')
    )

    if (domRelayTimeout > 0) {
      await new Promise((resolve) => {
        setTimeout(resolve, domRelayTimeout)
      });
    }

    this.dispatchEvent('render', renderContext);


    futures.push(
      this.triggerInitialHooks('onMount')
    )

    futures.push(
      this.invokeLifeCycleMethod('onMount')
    )

    this.dispatchEvent('onMount');
    // await Promise.all(futures);
    // futures.splice(0);


    assert(Object.keys(this.syntheticContext).length == 0);

    this.dispatchEvent('load', renderContext);
    await Promise.all(futures);
    futures.splice(0);

    this.#mounted = true;

    const rootComponent = this.#getRootComponent();

    const wait = () => {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve();
        }, 300);
      });
    }

    if (this == rootComponent) {
      // Since "omega" classes are loaded on 'loadClasses' by appContext, delay by 
      // a bit inorder to reduce time-to-LCP

      await wait();

      this.dispatchEvent('loadClasses', renderContext);

      await Promise.all(futures);
      futures.splice(0);

      this.dispatchEvent('afterClassesLoaded', renderContext);
    }

    const afterDomLoaded = () => {
      Promise.all(renderContext.extendedFutures)
        .then(() => {

          this.dispatchEvent('afterMount');

          if (this.#addAttributeValueObserver) {
            this.#attachAttributeValueObserver();
          }

          this.dispatchEvent('domLoaded');

          this.pruneLifecycleEventHandlers();
        });
    }

    if (this != rootComponent) {

      if (!rootComponent.isMounted()) {
        rootComponent.on('afterClassesLoaded', () => {
          afterDomLoaded();
        });

      } else {
        await wait();

        afterDomLoaded();
      }

    } else {
      afterDomLoaded();
    }

    futures.push(
      this.triggerInitialHooks('afterMount')
    );

    futures.push(
      this.invokeLifeCycleMethod('afterMount')
    );

    this.#hooks = null;

    await Promise.all(futures);
    futures.splice(0);

    RootCtxRenderer.#instancesMap.set(this.getId(), this);
  }

  awaitExtendedFutures() {
    return new Promise((resolve) => {
      this.on('render', async ({ extendedFutures }) => {

        await Promise.all([extendedFutures]);
        resolve();
      })
    });
  }

  #getRootComponent() {
    const { appContext } = self;
    return appContext.rootComponent || appContext.getRootComponent();
  }

  isRootComponent() {
    return this == this.#getRootComponent();
  }

  refreshNode() {
    assert(this.isElementIdTransient());

    const n = document.querySelector(`[__component='${this.getId()}']`);
    assert(n);

    this.node = n;
  }

  isConnected() {
    return this.node && this.node.isConnected;
  }

  /**
   * Lifecycle events are well known events that are dispatched during the rendering process of a component
   * 
   * @param {string} evtName 
   * @returns {boolean}
   */
  isLifecycleEvent(evtName) {
    const evtNames = [
      'beforeRender', 'beforeMount', 'onMount', 'load',
      'loadClasses', 'afterClassesLoaded', 'afterMount', 'render',
      'attributeBindContext', 'domLoaded',
    ];

    return evtNames.includes(evtName) || evtName.startsWith('inlineComponentInit-');
  }

  getNode0() {
    return this.node;
  }

  isElementIdTransient() {
    return false;
  }

  getElementId() {
    if (this.node) {
      return this.node.id;
    } else {
      this.throwError('Component not mounted');
    }
  }

  startSyntheticCacheContext() {
    this.#syntheticCache.push({});
  }

  pruneSyntheticCache() {
    this.#syntheticCache.pop();
  }

  invokeLifeCycleMethod(name, ...args) {
    const methods = this.recursivelyGetMethods(name);
    const promises = [];

    for (const fn of methods) {
      promises.push(
        fn(...args)
      )
    }

    return Promise.all(promises);
  }

  recursivelyInvokeMethod(name, classPredicate, ...args) {
    let ret = this.#methodInvokeCache[name];

    if (ret === undefined) {
      ret = this.recursivelyGetMethods(name, classPredicate).map(fn => fn(...args));
      this.#methodInvokeCache[name] = ret;
    }

    return ret;
  }

  recursivelyGetMethods(name, classPredicate) {
    const methods = [];

    let component = this;

    while ((component = Reflect.getPrototypeOf(component))
      // eslint-disable-next-line no-undef
      && component.constructor.name !== BaseRenderer.name
    ) {

      if (classPredicate && !classPredicate(component.constructor)) {
        continue;
      }

      assert(name !== 'constructor');

      if (Reflect.ownKeys(component).includes(name)) {
        methods.unshift(component[name].bind(this));
      }
    }

    return methods;
  }

  getDefaultHookOrder() {
    const { defaultHookOrder } = this.getConfig();
    return defaultHookOrder || RootCtxRenderer.#defaultHookOrder;
  }

  var({ options }) {
    const contextIdHashKeyPrefix = '--ctx_id-';

    const { data, hash } = options;

    Object.keys(hash)
      .filter(k => k.startsWith(contextIdHashKeyPrefix))
      .forEach(k => {
        const key = k.replace(contextIdHashKeyPrefix, '');
        const val = hash[key];

        data[hash[k]] = val;

        this.addVariableToScope(key, val);
      });

    return '';
  }

  startRenderingContext({ decoratorName, runtimeOptions } = {}) {
    let resolve;

    const promise = new Promise((_resolve) => {
      resolve = _resolve;
    });

    const futures = [];
    const extendedFutures = [];

    this.#renderContext.push({
      promise, futures, extendedFutures, resolve, decoratorName, runtimeOptions,
    });

    this.startSyntheticCacheContext();
  }

  #finalizeRenderingContext() {
    this.pruneSyntheticCache();

    return this.#renderContext.pop();
  }

  /**
   * As a general contract, this method should be called after rendering has completed and
   * the resulting html has been added to the DOM
   */
  finalizeRenderingContext() {
    const renderContext = this.#finalizeRenderingContext();

    renderContext.resolve();

    this.dispatchEvent('render', renderContext);

    return renderContext;
  }

  /**
   * This method is used to register functions that need to be invoked after rendering has 
   * fully completed.
   * 
   * @param {Function} fn 
   */
  onContextFinalization(fn) {
    this.once('domLoaded', () => {
      if (global.requestIdleCallback) {
        requestIdleCallback(fn);
      } else {
        fn();
      }
    });
  }

  wrapTransform(transform) {
    const { syntheticMethodPrefix } = RootProxy;
    const fnList = this.getFunctionListFromString(transform);

    if (fnList.length == 1) {
      return transform;
    }

    const syntheticMethodName = `${syntheticMethodPrefix}${this.randomString('syntheticMethod')}`;

    this[syntheticMethodName] = (value) => {
      for (const fn of fnList) {
        value = fn(value);
      }
      return value;
    }

    return syntheticMethodName;
  }

  static getSupportedHookPhases() {
    return ['onMount', 'afterMount'];
  }

  getDefaultHookPhase() {
    return 'onMount';
  }

  async triggerInitialHooks(phase) {

    await Promise.all(
      Object.keys(this.#hooks)
        .sort((e1, e2) => {

          const o1 = this.#hooks[e1].order;
          const o2 = this.#hooks[e2].order;

          return o1 < o2 ? -1 : o2 < o1 ? 1 : 0;
        })
        .map(async (selector) => {

          const node = document.querySelector(`#${this.getElementId()} ${selector}`);

          if (!node) {
            // <node> could not be found - likely because a block transform removed it from the html ast
            return;
          }

          if (!node.innerHTML) {
            // If <node> originated from a conditional block - it means the conditional expression
            // evaluated to false, else if it originated from an each block - it means the member
            // that owns this node is null. 
            // Another possible scenario is that the empty markup originated from the template
            return;
          }

          const { fnList, blockData } = this.#hooks[selector];

          await Promise.all(
            fnList
              .filter(({ hookPhase }) => hookPhase == phase)
              .map(({ hookName }) => {
                const hook = this[hookName].bind(this);

                return hook({
                  node,
                  blockData,
                  // This indicates that this hook is triggered just before this component
                  // is fully mounted, as opposed to on data update
                  initial: true,
                });
              })
          );
        })
    );
  }

  async triggerBlockHooks(hookNameString, hookPhaseString, phase, loc, opts) {
    assert(phase);

    const { node } = opts;

    if (!node.innerHTML) {
      return;
    }

    const arr = this.getBlockHookList(hookNameString, hookPhaseString, phase, loc);

    await Promise.all(
      arr.map(({ hookName }) => this[hookName].bind(this)({ ...opts }))
    );
  }

  getBlockHookList(hookNameString, hookPhaseString, phase, loc) {
    const { getSupportedHookPhases } = RootCtxRenderer;
    const { getCommaSeperatedValues } = clientUtils;

    const hookNameList = getCommaSeperatedValues(hookNameString);
    const hookPhaseList = getCommaSeperatedValues(
      hookPhaseString || this.getDefaultHookPhase(), hookNameList.length, this.getDefaultHookPhase()
    );

    const result = [];

    hookNameList.forEach((hookName, i) => {
      const hookPhase = hookPhaseList[i];

      if (!getSupportedHookPhases().includes(hookPhase)) {
        this.throwError(`Unknown hook phase "${hookPhase}"`, loc);
      }

      if (typeof this[hookName] != 'function') {
        this.throwError(`Unknown hook "${hookName}"`, loc);
      }

      if (phase == null || phase == hookPhase) {
        result.push({ hookName, hookPhase });
      }
    });

    return result;
  }

  registerHook(selector, hookNameString, hookPhaseString, hookOrder, loc, blockData) {
    const { nodeIdSelector } = RootCtxRenderer;
    assert(selector && selector.match(nodeIdSelector));

    const fnList = [];

    this.getBlockHookList(hookNameString, hookPhaseString, null, loc)
      .forEach(({ hookName, hookPhase }) => {
        fnList.push({
          hookName, hookPhase,
        });
      });

    if (!this.#rendered) {
      this.#hooks[selector] = {
        order: hookOrder != undefined ? hookOrder : this.getDefaultHookOrder(),
        blockData, fnList
      }
    }
  }

  executeWithBlockData(fn, blockData) {
    const blockDataSnapshot = this.blockData;

    if (blockData) {
      this.blockData = blockData;
    }

    const ret = fn();

    if (blockData) {
      this.blockData = blockDataSnapshot;
    }
    return ret;
  }

  cloneBlockData(blockData) {
    const ret = {};
    Object.entries(blockData).forEach(([k, v]) => {
      ret[k] = { ...v };
    })
    return ret;
  }

  #getBlockDataInfo() {
    const { blockStack } = this.getEmitContext();

    let blockData;

    for (let i = blockStack.length - 1; i >= 0; i--) {
      const block = blockStack[i];

      if (block.blockData) {
        blockData = block.blockData;
        break;
      }
    }

    if (!blockData) {
      return { arrayBlockPath: null, blockData: {} };
    }

    return {
      arrayBlockPath: this.getArrayBlockPath(blockData, true),
      blockData,
    };
  }

  getArrayBlockPath(blockData, useCache) {
    const { syntheticBlockKeyPrefix } = RootCtxRenderer;

    const ret = [];

    Object.entries(blockData)
      .forEach(([k, { type, index }]) => {

        if (type == 'array' && !k.startsWith(syntheticBlockKeyPrefix)) {

          const path = this.getExecPath({
            fqPath: `${k}[${index}]`,
            indexResolver: path => blockData[path].index,
            useCache,
          });

          ret.push(path);
        }
      });

    return ret;
  }

  conditional({ options, ctx, params }) {

    const { conditionalBlockHookType, logicGatePathPrefix } = RootProxy;
    const { syntheticAliasSeparator, getSyntheticAliasFromPath0 } = RootCtxRenderer;

    const { hash, loc, fn, inverse } = options;

    const { hook, hookPhase, hookOrder, transform, transient, nodeIndex } = hash;

    let [target, invert] = params;

    const nodeId = nodeIndex ? this.getNodeIdFromIndex(nodeIndex, loc) : null;

    if (Object(target) !== target) {
      // <target> resolved to a literal
      target = { value: target };
    }

    const { path, value, canonicalPath } = target;

    const isSynthetic = this.isSyntheticMethodName(path);

    const dataBinding =
      // Todo: Support data-binding for synthetic invocations
      !isSynthetic &&
      this.dataBindingEnabled() && nodeId &&
      // Disable for literals and components
      !!path && !(value instanceof BaseComponent);

    const { arrayBlockPath, blockData } = this.#getBlockDataInfo();

    const conditional0 = (value) => {

      if (hook) {
        this.registerHook(
          `#${nodeId}`, hook, hookPhase, hookOrder, loc, blockData,
        );
      }

      if (transform) {
        this.registerTransform(
          this.nodeIdTransformSelector(nodeId), transform
        );
      }

      const b = this.analyzeConditionValue(value);
      let branch;

      const markup = (() => {
        let func;

        if (invert ? !b : b) {

          branch = 'fn';
          func = fn;

        } else {

          branch = 'inverse';
          func = inverse || (() => '');
        }

        return func(ctx);
      })();

      if (isSynthetic) {

        const blockKey = getSyntheticAliasFromPath0(`with${syntheticAliasSeparator}`, path);

        // Note: This will only have an effect if this block was originally a context switching
        // block, i.e. a #with block
        delete this.syntheticContext[blockKey];
      }

      if (nodeId) {
        this.onContextFinalization(() => {
          document.querySelector(`#${this.getElementId()} #${nodeId}`)
            .setAttribute('branch', branch);
        });
      }

      return markup;
    }

    const blockStack = [...this.getEmitContext().blockStack];
    const blockId = this.startBlockContext({ loc });

    // Todo: If target is a logicGate, I can optimize space by having the blockData
    // of the logicGate and this conditional block reference the same blockData object
    // instead of having separate objects that are exactly the same

    if (dataBinding) {

      const hookObj = {
        type: conditionalBlockHookType, selector: `#${nodeId}`, blockStack, blockId, hook,
        hookPhase, invert, transient, arrayBlockPath, blockData, canonicalPath, loc, transform,
      };

      if (path.match(logicGatePathPrefix)) {
        this.#addGateInfoToHook(
          path.replace(logicGatePathPrefix, ''), hookObj,
        );
      }

      this.#createHook(path, hookObj);
    }

    const html = conditional0(value);

    this.endBlockContext();

    this.getEmitContext().write(html);

    if (this.#attributeEmitContext) {
      assert(!nodeId);
      this.#attributeEmitContext.write(html);
    }

    return html;
  }

  #addGateInfoToHook(gateId, gateHook) {
    const { logicGates } = this.getEmitContext();
    const { gate, participants, canonicalParticipants } = logicGates[gateId];

    gateHook.gate = gate;

    assert(participants.length == canonicalParticipants.length);

    gateHook.participants = participants;
    gateHook.canonicalParticipants = canonicalParticipants;

    delete logicGates[gateId];
  }

  getCollIntrinsicHookTypes() {
    const { collChildSetHookType, collChildDetachHookType } = RootProxy;
    return [collChildSetHookType, collChildDetachHookType];
  }

  getArrayIntrinsicHookTypes() {
    const { arraySpliceHookType } = RootProxy;
    return [arraySpliceHookType];
  }

  execBlockIteration(fn, opaqueWrapper, key, nodeId, loc) {
    const { htmlWrapperCssClassname, attrBindContextEvent } = RootCtxRenderer;

    const emitContext = this.getEmitContext();

    const header = () => `<div class='${htmlWrapperCssClassname}' ${nodeId ? `id='${nodeId}'` : ''} key='${key}'>`;
    const footer = () => `</div>`;

    if (opaqueWrapper) {
      this.once(
        attrBindContextEvent, (attributesMap) => {
          attributesMap['key'] = key;

          if (nodeId) {
            attributesMap['id'] = nodeId;
          }
        }
      );
    } else {
      emitContext.write(header());
    }

    const markup = fn();

    if (!opaqueWrapper) {
      emitContext.write(footer());

    } else {
      assert(markup != '');
    }

    return opaqueWrapper ? markup : `${header()}${markup}${footer()}`;
  }

  getMarkerStartNodeId(markerId) {
    return `marker-${markerId}-start`;
  }

  getMarkerEndNodeId(markerId) {
    return `marker-${markerId}-end`;
  }

  forEach({ options, ctx, params }) {

    const {
      eachBlockHookType, predicateHookType, toFqPath, dataPathPrefix,
    } = RootProxy;
    const { htmlWrapperCssClassname, getSyntheticAliasFromPath } = RootCtxRenderer;

    const { hash, loc, fn, inverse } = options;

    const { hook, hookPhase, hookOrder, transform, predicate, nodeIndex, opaqueWrapper, markerTagName } = hash;

    const [{ path, value, canonicalPath }] = params;

    const nodeId = nodeIndex ? this.getNodeIdFromIndex(nodeIndex, loc) : null;
    const markerId = opaqueWrapper ? this.randomString('markerId') : null;

    const markerStart = markerId ? `#${nodeId} #${this.getMarkerStartNodeId(markerId)}` : null;
    const markerEnd = markerId ? `#${nodeId} #${this.getMarkerEndNodeId(markerId)}` : null;

    const selector = markerStart ? markerStart : `#${nodeId}`;

    const isSynthetic = this.isSyntheticMethodName(path);
    const dataBinding = !isSynthetic && this.dataBindingEnabled() && nodeId;

    const _blockId = this.randomString('blockId');

    const forEach0 = () => {

      let ret = "";

      if (markerId) {
        const markup = `<${markerTagName} class="${htmlWrapperCssClassname}" id="${this.getMarkerStartNodeId(markerId)}"></${markerTagName}>`
        this.getEmitContext().write(markup);

        ret += markup;
      }

      if (this.analyzeConditionValue(value)) {
        const blockKey = isSynthetic ? getSyntheticAliasFromPath(path) : canonicalPath;

        this.doBlockInit({ path: blockKey });

        const isArray = Array.isArray(value);

        // Add (length and type) to this.blockData

        this.blockData[blockKey].type = isArray ? 'array' : 'map';
        this.blockData[blockKey].length = value.length;

        // Note: <rawValue> and <keys> are only used to check for null members

        const rawValue = value.toJSON();

        const keys = Object.keys(rawValue);

        const blockStack = [...this.getEmitContext().blockStack];

        for (let i = 0; i < keys.length; i++) {

          this.doBlockUpdate({ path: blockKey });

          if (isSynthetic) {
            // Update the current value of the synthetic context
            value[i];
          }

          const p = toFqPath({ isArray, isMap: !isArray, parent: path, prop: keys[i] });

          const key = this.getBlockData({
            path: blockKey, dataVariable: '@key'
          });

          const currentValue = rawValue[key];
          const isNull = currentValue === null || (predicate ? !this[predicate].bind(this)(currentValue) : false);

          const func = () => {
            this.startSyntheticCacheContext();

            const markup = isNull ?
              // null collection members are always represented as an empty strings
              '' :
              fn(this.rootProxy);

            this.pruneSyntheticCache();

            this.getEmitContext().write(markup);

            return markup;
          }

          const memberNodeId = nodeId ? clientUtils.randomString('nodeId') : null;

          this.startBlockContext({
            blockId: _blockId, blockData: this.cloneBlockData(this.blockData), loc
          });

          const markup = nodeId ? this.execBlockIteration(func, opaqueWrapper, key, memberNodeId, loc) : func();

          const { arrayBlockPath, blockData } = this.#getBlockDataInfo();

          this.endBlockContext();

          if (hook) {
            this.registerHook(
              `#${memberNodeId}`, hook, hookPhase, hookOrder, loc, blockData,
            );
          }

          if (transform) {
            this.registerTransform(
              this.nodeIdTransformSelector(memberNodeId), transform
            );
          }

          if (dataBinding) {
            if (predicate) {

              this.#createHook(
                p,
                {
                  type: predicateHookType, selector: `#${memberNodeId}`,
                  blockStack, blockId: _blockId, predicate, hook, hookPhase, transform, opaqueWrapper,
                  arrayBlockPath, blockData, canonicalPath: `${canonicalPath}_$`, loc,
                }
              );
            }
          }

          ret += markup;
        }

        if (isSynthetic) {
          delete this.syntheticContext[blockKey];
        }

        this.doBlockFinalize({ path: blockKey });

      } else if (inverse) {

        const markup = inverse(ctx);
        this.getEmitContext().write(markup);

        ret += markup;
      }

      if (markerId) {
        const markup = `<${markerTagName} class="${htmlWrapperCssClassname}" id="${this.getMarkerEndNodeId(markerId)}"></${markerTagName}>`
        this.getEmitContext().write(markup);

        ret += markup;
      }

      return ret;
    }

    const blockStack = [...this.getEmitContext().blockStack];

    const blockId = this.startBlockContext({ loc });

    const _blockStack = [...this.getEmitContext().blockStack];

    if (dataBinding) {
      const { arrayBlockPath, blockData } = this.#getBlockDataInfo();

      this.#createHook(
        path,
        {
          type: eachBlockHookType, selector, blockStack, blockId, memberBlockId: _blockId, markerEnd, predicate,
          hook, hookPhase, arrayBlockPath, blockData, canonicalPath, transform, opaqueWrapper, loc,
        }
      );

      const collDef = this.proxyInstance.getCollectionDefinition(path.replace(dataPathPrefix, ''));

      if (collDef) {
        [
          ...this.getCollIntrinsicHookTypes(),
          ...(collDef.collectionType == 'array') ? this.getArrayIntrinsicHookTypes() : []
        ]
          .forEach(hookType => {

            this.#createHook(
              path,
              {
                type: hookType, selector, blockStack: _blockStack, blockId: _blockId, markerEnd, predicate,
                hook, hookPhase, arrayBlockPath, blockData, canonicalPath, transform, opaqueWrapper, loc,
              }
            );
          })
      }
    }

    const html = forEach0();

    this.endBlockContext();

    this.getEmitContext().write(html);

    if (this.#attributeEmitContext) {
      assert(!nodeId);
      this.#attributeEmitContext.write(html);
    }

    return html;
  }

  static wrapFnWithExceptionCatching(fn) {
    if (self.appContext.testMode) {
      return fn;
    }

    // Todo: Return a decent and actionable error message for the developer
    const toErrorMsg = (e) => {
      return e.stack;
    }
    return (...args) => {
      try {
        return fn(...args);
      } catch (e) {
        return `<code>${toErrorMsg(e)}</code>`;
      }
    }
  }

  static getSyntheticAliasFromPath(path) {
    const { syntheticBlockKeyPrefix, getSyntheticAliasFromPath0 } = RootCtxRenderer;

    return getSyntheticAliasFromPath0(syntheticBlockKeyPrefix, path);
  }

  static getSyntheticAliasFromPath0(prefix, path) {
    const { syntheticMethodPrefix } = RootProxy;

    return `${prefix}${path.replace(syntheticMethodPrefix, '')}`;
  }

  static getBlockNameFromSyntheticAlias(syntheticAlias) {
    const { syntheticAliasSeparator } = RootCtxRenderer;
    return syntheticAlias.split(syntheticAliasSeparator)[0];
  }

  static getChildPathFromPath(path) {
    const { syntheticChildPathSuffix } = RootCtxRenderer;
    return `${path}_${syntheticChildPathSuffix}`;
  }

  static getSyntheticAliasFromChildPath(path) {
    const { syntheticChildPathSuffix, getSyntheticAliasFromPath } = RootCtxRenderer;
    const rgx = RegExp(
      `${clientUtils.escapeRegExp(syntheticChildPathSuffix)}$`
    )
    assert(path.match(rgx));
    return getSyntheticAliasFromPath(path.replace(rgx, ''));
  }

  fn(helperName) {
    return `${this.getHelpersNamespace()}.${(this.#helperFunctionNames || {})[helperName] || 'noOp'}`;
  }

  static getMetaHelpers() {
    return [
      'storeContext', 'loadContext', 'forEach', 'conditional', 'startAttributeBindContext',
      'endAttributeBindContext', 'textBindContext', 'blockWrapperId', 'resolveMustacheInRoot',
      'resolveMustacheInCustom', 'c', 'var', 'wrapInvocationWithProxy',
    ];
  }

  getNodeIdFromIndex(nodeIndex, loc) {
    const nodeId = this.getEmitContext().nodeIdStore[nodeIndex];

    if (!nodeId) {
      this.throwError(
        `Could not find any nodeId with index "${nodeIndex}" in the current tokenization context`, loc
      );
    }

    return nodeId;
  }

  blockWrapperId({ params }) {

    const [nodeIndex] = params;
    assert(typeof nodeIndex == 'number');

    const id = clientUtils.randomString('nodeId');

    this.getEmitContext().write(id);

    this.registerNodeId(nodeIndex, id);

    return id;
  }

  getBlockWrapperId() {
    const { nodeIdStore } = this.getEmitContext();
    const nodeIndex = Object.keys(nodeIdStore).pop();

    return this.getNodeIdFromIndex(nodeIndex);
  }

  startAttributeBindContext({ options }) {
    const { attributeValueWrapper: quote } = RootCtxRenderer;

    const streamTokenizer = new hyntax.StreamTokenizer();
    const { loc } = options;

    const ATTR_ASSIGNMENT = 'token:attribute-assignment';
    const ATTR_VALUE_WRAPPER_START = 'token:attribute-value-wrapper-start';
    const ATTR_VALUE = 'token:attribute-value';
    const ATTR_VALUE_WRAPPER_END = 'token:attribute-value-wrapper-end';

    const addAttrValueWrapper = (tokens) => {

      for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].type == ATTR_VALUE && i > 0 && tokens[i - 1].type == ATTR_ASSIGNMENT) {
          const repl = [
            { type: ATTR_VALUE_WRAPPER_START, content: quote },
            tokens[i],
            { type: ATTR_VALUE_WRAPPER_END, content: quote },
          ];

          tokens.splice(i, 1, ...repl);
          i += repl.length - 1;
        }
      }
    }

    streamTokenizer
      .on('data', (tokens) => {

        // Add attribute value wrapper if applicable
        addAttrValueWrapper(tokens);

        this.#attributeEmitContext.tokenList = this.#attributeEmitContext.tokenList.concat(tokens);
      });

    this.#attributeEmitContext = {
      tokenList: [],
      write: (value) => {
        streamTokenizer.write(value);
      },
      // Todo: Remove <startLoc> if not used
      startLoc: loc,
    };

    this.#attributeEmitContext.write('<');

    return '';
  }

  isBooleanHtmlAttribute(elementName, attrName) {
    return (this.getHtmlIntrinsicAttributes(elementName)[attrName] || {})
      .type == 'boolean';
  }

  getHtmlIntrinsicAttributes(elementName) {
    const attributes = this.getHtmlIntrinsicAttributesMap();

    let o = {};
    ['*', elementName]
      .forEach(e => {
        o = {
          ...o,
          ...(attributes[e] || {}),
        }
      })

    return o;
  }

  getHtmlIntrinsicAttributesMap() {
    return {
      ['*']: {
        autofocus: { type: 'boolean' },
        inert: { type: 'boolean' },
        itemscope: { type: 'boolean' },
        readonly: { type: 'boolean' }
      },
      iframe: {
        allowfullscreen: { type: 'boolean' }
      },
      script: {
        async: { type: 'boolean' },
        defer: { type: 'boolean' },
        nomodule: { type: 'boolean' }
      },
      media: {
        autoplay: { type: 'boolean' },
        controls: { type: 'boolean' },
        loop: { type: 'boolean' },
        muted: { type: 'boolean' }
      },
      input: {
        checked: { type: 'boolean' },
        disabled: { type: 'boolean' },
        formnovalidate: { type: 'boolean' },
        multiple: { type: 'boolean' },
        required: { type: 'boolean' },
        readOnly: { type: 'boolean' },
        value: { type: 'string' }
      },
      track: {
        ['default']: { type: 'boolean' }
      },
      button: {
        disabled: { type: 'boolean' }
      },
      select: {
        disabled: { type: 'boolean' }
      },
      textarea: {
        disabled: { type: 'boolean' },
        required: { type: 'boolean' }
      },
      img: {
        ismap: { type: 'boolean' }
      },
      form: {
        novalidate: { type: 'boolean' }
      },
      dialog: {
        open: { type: 'boolean' }
      },
      video: {
        playsinline: { type: 'boolean' }
      },
      ol: {
        reversed: { type: 'boolean' }
      },
      option: {
        selected: { type: 'boolean' }
      }
    }
  }

  async getRenderedValue(tokenContent, groupId, overrides) {
    const { MustacheStatementList } = RootProxy;

    assert(this.dataBindingEnabled());

    const wholeMustacheRgx = /^{{\w+}}$/g;
    const rgx = /({{)|(}})/g;

    if (tokenContent.match(wholeMustacheRgx)) {
      assert(!overrides);

      const ref = tokenContent.replace(rgx, '');

      const [{ renderedValue }] = await MustacheStatementList.query(
        this.proxyInstance, null, ref,
      );

      return renderedValue;
    }

    assert(groupId && overrides);

    const mustacheStatements = await MustacheStatementList.query(
      this.proxyInstance, groupId, null,
    );

    mustacheStatements.forEach(({ id, renderedValue }) => {
      if (overrides[id] != undefined) {
        renderedValue = overrides[id];
      }
      tokenContent = tokenContent.replace(`{{${id}}}`, renderedValue);
    });

    assert(!tokenContent.match(rgx));

    return tokenContent;
  }

  async setRenderedValue(attrTokenType, ref, value, blockData, attrValueGroups = {}) {
    const { MustacheStatementList } = RootProxy;

    assert(this.dataBindingEnabled());

    const ATTR_KEY = 'attr-key';
    const ATTR = 'attr';

    const [row] = await MustacheStatementList.query(
      this.proxyInstance, null, ref,
    );

    const { renderedValue: previousValue, transform } = row;

    if (transform) {
      value = this.executeWithBlockData(
        () => this[transform].bind(this)(value),
        blockData,
      );
    }

    value = this.#validateAttributeToken(attrTokenType, value);

    c:
    if (value != null) {

      if (
        [ATTR_KEY, ATTR].includes(attrTokenType) && attrValueGroups[value.split('=')[0]]
      ) {
        value = null;
        break c;
      }

      row.renderedValue = value;

      MustacheStatementList.put(
        this.proxyInstance, [row],
      )
    }

    return { previousValue, currentValue: value };
  }

  #getRenderedValue(value) {
    const { mustacheStatements } = this.getEmitContext();
    const rgx = /({{\w+}})/g;

    if (!value.match(rgx)) return value;

    return value
      .split(rgx)
      .map(v => {
        if (v.match(rgx)) {
          const ref = v.replace(/({{)|(}})/g, '');
          v = mustacheStatements[ref].renderedValue;
        }
        return v;
      })
      .join('');
  }

  getNodeIdFromTokenList({ tokenList, loc }) {
    const ATTR_KEY = 'token:attribute-key';
    const ATTR_VALUE = 'token:attribute-value';

    for (let i = 0; i < tokenList.length; i++) {
      const { type, content } = tokenList[i];

      if (type == ATTR_KEY && content == 'id') {
        const { type, content } = tokenList[i + 3];
        assert(type == ATTR_VALUE);

        return this.#getRenderedValue(content);
      }
    }
    return null;
  }

  #getHookTypeFromAttributeTokenType(tokenType) {
    const {
      nodeAttributeHookType, nodeAttributeKeyHookType, nodeAttributeValueHookType,
    } = RootProxy;

    const ATTR_KEY = 'attr-key';
    const ATTR_STRING_VALUE = 'attr-string-value';
    const ATTR = 'attr';

    switch (tokenType) {
      case ATTR_KEY:
        return nodeAttributeKeyHookType;
      case ATTR_STRING_VALUE:
        return nodeAttributeValueHookType;
      case ATTR:
        return nodeAttributeHookType;
      default:
        throw Error(`Unknown tokenType "${tokenType}"`);
    }
  }

  #validateAttributeToken(tokenType, value) {
    const { attributeValueWrapper: quote } = RootCtxRenderer;

    const ATTR_KEY = 'attr-key';
    const ATTR_VALUE = 'attr-value';
    const ATTR_STRING_VALUE = 'attr-string-value';
    const ATTR = 'attr';

    switch (tokenType) {
      case ATTR_KEY:
        return `${value}`.match(/^[a-zA-Z_][a-zA-Z0-9_-]*$/) ? `${value}` : null;
      case ATTR_VALUE:
        return `${quote}${this.#validateAttributeToken(ATTR_STRING_VALUE, value)}${quote}`;
      case ATTR_STRING_VALUE:
        return value.replace(/"/g, '&quot;').replace(/'/g, '&apos;');
      case ATTR:
        return (() => {
          const withEnclosingQuoteRgx = /^(["'])(.*?)\1$/;

          if (typeof value != 'string') return null;

          if (!value) return value;

          let [key, val] = value.split('=').map(v => v.trim());

          if ((key = this.#validateAttributeToken(ATTR_KEY, key)) == null) return null;
          if (!val) return key;

          if (val.match(withEnclosingQuoteRgx)) {
            val = val.replace(/(^["'])|(["']$)/g, '');
          }
          return `${key}=${this.#validateAttributeToken(ATTR_VALUE, val)}`;
        })();
      default:
        throw Error(`Unknown tokenType "${tokenType}"`);
    }
  }

  #invalidAttributeToken(tokenType, value, loc) {
    this.logger.warn(
      loc,
      `Atribute token is invalid; type=${tokenType}, value=${value}`
    );
    return `invalid-${tokenType}`;
  }

  getHtmlCompositeAttributes() {
    return ['class'];
  }

  getElementNameFromToken({ type, content }) {
    const OPEN_TAG_START = 'token:open-tag-start';

    assert(type.startsWith(OPEN_TAG_START));
    return content.replace('<', '');
  };

  #getTokenFromList(tokenList, index, type) {
    const token = tokenList[index];
    assert(token.type == type);
    return token.content;
  }

  getAttrKeyFromTokenList(tokenList, index) {
    const ATTR_KEY = 'token:attribute-key';
    return this.#getTokenFromList(tokenList, index, ATTR_KEY);
  }

  getAttrValueFromTokenList(tokenList, index) {
    const ATTR_VALUE = 'token:attribute-value';
    return this.#getTokenFromList(tokenList, index, ATTR_VALUE);
  }

  endAttributeBindContext({ options, params }) {
    const { attrBindContextEvent } = RootCtxRenderer;
    const { nodeAttributeKeyHookType, logicGatePathPrefix } = RootProxy;

    const ATTR_KEY = 'token:attribute-key';
    const ATTR_VALUE = 'token:attribute-value';

    assert(this.#attributeEmitContext);

    const attributesMap = {};

    this.dispatchEvent(attrBindContextEvent, attributesMap);

    const { loc } = options;

    const { mustacheStatements } = this.getEmitContext();
    const { tokenList } = this.#attributeEmitContext;

    const nodeId = this.getNodeIdFromTokenList({ tokenList, loc }) ||
      attributesMap['id'] || (attributesMap['id'] = clientUtils.randomString('nodeId'));


    if (this.dataBindingEnabled()) {

      const wholeMustacheRgx = /^{{\w+}}$/g;
      const mustacheRgx = /{{\w+}}/g;

      let attrValueGroups;
      const hooksToSave = [];

      for (let tokenIndex = 0; tokenIndex < tokenList.length; tokenIndex++) {
        const { type, content } = tokenList[tokenIndex];

        if (![ATTR_KEY, ATTR_VALUE].includes(type)) continue;

        const matches = content.match(mustacheRgx);

        let attrValueGroupId;

        groupId:
        if (type == ATTR_VALUE && matches) {
          const elementName = this.getElementNameFromToken(tokenList[0]);
          const attrKey = this.getAttrKeyFromTokenList(tokenList, tokenIndex - 3);

          const mKey = attrKey.match(mustacheRgx);
          const isBoolAttr = mKey ? false : this.isBooleanHtmlAttribute(elementName, attrKey);

          if (isBoolAttr && content.match(wholeMustacheRgx)) break groupId;

          attrValueGroupId = this.randomString('attr-value-group-Id');

          if (mKey) {

            const keyHook = hooksToSave.at(-1);
            assert(keyHook.type == nodeAttributeKeyHookType);

            keyHook.attrValueGroupId = attrValueGroupId;

          } else if (this.getHtmlCompositeAttributes().includes(attrKey)) {
            (attrValueGroups || (attrValueGroups = {}))[attrKey] = attrValueGroupId;
          }
        }

        const blockStack = [...this.getEmitContext().blockStack];

        const { arrayBlockPath, blockData } = this.#getBlockDataInfo();

        (matches || [])
          .forEach(m => {

            const mustacheRef = m.replace(/({{)|(}})/g, '');
            const mustacheInfo = mustacheStatements[mustacheRef];

            if (!mustacheInfo) return;

            const { path, canonicalPath, transform, attrTokenType, loc } = mustacheInfo;

            if (attrValueGroupId) {
              mustacheInfo.groupId = attrValueGroupId;
            }

            const isSynthetic = this.isSyntheticMethodName(path);

            // Todo: Support data-binding for synthetic invocations
            const dataBinding = !isSynthetic;

            if (dataBinding) {

              const hookObj = {
                type: this.#getHookTypeFromAttributeTokenType(attrTokenType),
                attrTokenType, selector: `#${nodeId}`, canonicalPath, mustacheRef,
                tokenList, tokenIndex, transform, loc,
                blockStack, arrayBlockPath, blockData,
              };

              if (attrValueGroupId) {
                hookObj.attrValueGroupId = attrValueGroupId;
              }

              if (path.match(logicGatePathPrefix)) {
                this.#addGateInfoToHook(
                  path.replace(logicGatePathPrefix, ''), hookObj,
                );
              }

              hooksToSave.push([path, hookObj]);
            }
          });
      }

      hooksToSave.forEach(([k, v]) => {
        this.#createHook(k, v);
      })

      if (attrValueGroups && !this.isHeadlessContext()) {
        this.#addAttributeValueObserver = true;

        this.onContextFinalization(() => {
          const node = document.querySelector(`#${this.getElementId()} #${nodeId}`);
          node.dataset.attrValueGroups = attrValueGroups;
        });
      }
    }

    const [nodeIndex] = params;

    this.registerNodeId(nodeIndex, nodeId);

    this.#attributeEmitContext = null;

    const ret = Object.entries(attributesMap).map(([k, v]) => ` ${k}='${v}'`).join('');

    this.getEmitContext().write(ret);

    return ret;
  }

  static async #processAttributeValueMutation(component, mutation) {
    const { HookList, nodeAttributeValueHookType } = RootProxy;

    assert(mutation.type === 'attributes');

    const { attributeName, target } = mutation;
    const { dataset: { attrValueGroups }, skipObserve } = target;

    if (!attrValueGroups) {
      return;
    }

    if (skipObserve && skipObserve == attributeName) {
      delete target.skipObserve;
      return;
    }

    const groupId = attrValueGroups[attributeName];

    if (!groupId) return;

    const hooks = await HookList.equalsQuery(
      component.proxyInstance, 'attrValueGroupId', groupId,
    );

    const [{ tokenList, tokenIndex }] = hooks.filter(({ type }) => type == nodeAttributeValueHookType);
    const valueToken = tokenList[tokenIndex];

    const previousEntries = (await component.getRenderedValue(valueToken.content, groupId))
      .trim().split(/\s+/g);
    const currentEntries = target.getAttribute(attributeName).trim().split(/\s+/g);

    // Added entries
    currentEntries
      .filter(function (e) {
        return previousEntries.indexOf(e) === -1;
      })
      .forEach((e) => {
        valueToken.content += ` ${e}`;
      });

    // Removed entries
    previousEntries
      .filter(function (e) {
        return currentEntries.indexOf(e) === -1;
      })
      .forEach((e) => {
        valueToken.content = valueToken.content.replace(
          RegExp(`(?<=^|\\s+)${e}(?=\\s+|$)`, 'g'), ''
        );
      });

    hooks.forEach(hook => {
      hook.tokenList = tokenList;
    });

    HookList.put(
      component.proxyInstance, hooks,
    );
  }

  #attachAttributeValueObserver() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        RootCtxRenderer.#processAttributeValueMutation(this, mutation)
      });
    });

    observer.observe(
      this.node,
      {
        attributes: true,
        attributeFilter: this.getHtmlCompositeAttributes(),
        attributeOldValue: true, subtree: true,
      }
    );
  }

  textBindContext() {
    const id = clientUtils.randomString('nodeId');

    this.#dataStack.push({ selector: `#${id}` });

    this.getEmitContext().write(id);

    this.registerNodeId(null, id);

    return id;
  }

  popDataStack() {
    return this.#dataStack.pop();
  }

  peekDataStack() {
    return this.#dataStack[this.#dataStack.length - 1];
  }

  c({ params }) {
    const [value] = params;

    if (this.#attributeEmitContext) {
      this.#attributeEmitContext.write(value);
    }

    this.getEmitContext().write(value);

    return value;
  }

  resolveMustacheInRoot({ options, params }) {

    const { textNodeHookType, inlineComponentHookType, dataPathRoot, pathSeparator, logicGatePathPrefix, } = RootProxy;

    const { hash, loc } = options;
    let { hook, hookPhase, hookOrder, transform } = hash;

    if (transform) {
      transform = this.wrapTransform(transform);
    }

    const bindContext = this.popDataStack();

    let [target] = params;

    if (Object(target) !== target) {

      // <target> resolved to a literal
      target = { value: target };
    }

    let { path, value, canonicalPath } = target;

    const isSynthetic = this.isSyntheticMethodName(path);

    const canDataBind = this.dataBindingEnabled() &&
      // Disable for literals
      !!path;

    // Todo: Support data-binding for synthetic invocations
    const shouldDataBind = !isSynthetic && canDataBind;

    if (!bindContext && value instanceof BaseComponent) {
      this.logger.warn(
        loc,
        `Component "${value.getId()}" needs a bind context inorder to render properly`
      );
    }

    let renderedValueTransformer;

    switch (true) {

      case !!this.#attributeEmitContext:
        (() => {
          const { attrTokenType } = hash;

          const ATTR_STRING_VALUE = 'attr-string-value';
          const ATTR_VALUE = 'attr-value';

          const validate = (_value) => {
            let valid = true;
            let value = this.#validateAttributeToken(attrTokenType, _value);

            if (value == null) {
              valid = false;
              value = this.#invalidAttributeToken(attrTokenType, _value, loc);
            }

            return { valid, value };
          }

          if (shouldDataBind) {
            renderedValueTransformer = (val) => {
              const { attributeValueWrapper: quote } = RootCtxRenderer;

              const { valid, value } = validate(val);

              if (valid) {
                const { mustacheStatements } = this.getEmitContext();
                let mustacheRef = this.randomString('mustacheRef');

                const mustacheInfo = {
                  path, canonicalPath, transform, loc, attrTokenType, renderedValue: value,
                };

                mustacheStatements[mustacheRef] = mustacheInfo;

                let ret = `{{${mustacheRef}}}`;

                if (attrTokenType == ATTR_VALUE) {
                  ret = `${quote}${ret}${quote}`;
                  mustacheInfo.renderedValue = value.replace(/(^["'])|(["']$)/g, '');

                  mustacheInfo.attrTokenType = ATTR_STRING_VALUE;
                }

                this.#attributeEmitContext.write(ret);

              } else {
                this.#attributeEmitContext.write(value);
              }

              return value;
            }

          } else {
            renderedValueTransformer = (val) => {
              const { value } = validate(val);

              this.#attributeEmitContext.write(value);
              return value;
            }
          }
        })();
        break;

      case !!bindContext:

        const { selector, inlineComponent } = bindContext;

        if (value instanceof Promise || value instanceof BaseComponent) {
          value = this.render({
            data: value,
            target: selector,
            transform,
            loc,
          })

          transform = null;
        }

        const blockStack = [...this.getEmitContext().blockStack];

        const { arrayBlockPath, blockData } = this.#getBlockDataInfo();

        if (shouldDataBind) {

          const hookObj = {
            type: textNodeHookType, selector, blockStack,
            hook, hookPhase, canonicalPath, transform,
            loc, arrayBlockPath, blockData,
          };

          if (path.match(logicGatePathPrefix)) {
            this.#addGateInfoToHook(
              path.replace(logicGatePathPrefix, ''), hookObj,
            );
          }

          this.#createHook(path, hookObj);

        } else if (canDataBind && inlineComponent) {

          const p = `${dataPathRoot}${pathSeparator}${this.getExecPath({ fqPath: bindContext.canonicalPath })}`;

          this.#createHook(
            p,
            {
              type: inlineComponentHookType, selector, blockStack,
              syntheticPath: path, ref: bindContext.ref,
              hook, hookPhase, canonicalPath: bindContext.canonicalPath, transform,
              arrayBlockPath, blockData, loc,
            }
          );
        }

        if (hook) {
          this.registerHook(
            selector, hook, hookPhase, hookOrder, loc, blockData,
          );
        }

        break;
    }

    if (transform) {
      value = this[transform](value);
    }

    let renderedValue = this.toHtml(value);

    if (renderedValueTransformer) {
      renderedValue = renderedValueTransformer(renderedValue);
    }

    this.getEmitContext().write(renderedValue);

    return renderedValue;
  }

  #createHook(path, hook) {
    const { hooks } = this.getEmitContext();
    hooks.push([path, hook]);
  }

  getPathValue({ path, includePath = false, indexResolver }) {
    return this.resolvePath({
      fqPath: path,
      includePath,
      indexResolver,
    });
  }

  // eslint-disable-next-line class-methods-use-this
  processLiteralSegment({ original }) {
    if (!original.length) {
      return original;
    }
    const parts = [];
    const segments = original.split('.');

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < segments.length; i++) {
      let segment = segments[i];
      // eslint-disable-next-line no-restricted-globals
      if (!isNaN(segment)) {
        // this is an array index
        if (!parts[parts.length - 1]) {
          throw Error(`Unknown index: ${segment} for path: ${original}`);
        }
        parts[parts.length - 1] += `[${segment}]`;
        segment = null;
      }
      if (segment) {
        parts.push(segment);
      }
    }
    return parts.join('.');
  }

  analyzeConditionValue(value) {
    if (!value) {
      return false;
    }
    const type = value.constructor.name;

    // eslint-disable-next-line default-case
    switch (true) {
      case type === 'Array' && value.length === 0:
      case type === 'Map' && value.size === 0:
      case type === 'Object' && Object.keys(value).length === 0:
        return false;
    }

    return true;
  }

  getBlockData({ path, dataVariable, blockDataProducer }) {

    const { getDataVariables } = RootProxy;
    const { getDataVariableValue, toObject } = RootCtxRenderer;

    assert(getDataVariables().includes(dataVariable));

    const blockData = blockDataProducer ? blockDataProducer() : this.blockData;

    let value = this.syntheticContext[path] !== undefined
      ? this.syntheticContext[path].value
      : this.getPathValue({
        path, indexResolver: path => blockData[path].index,
      });

    if (value instanceof Map) {
      assert(this.resolver);
      value = toObject({ map: value });
    }

    switch (dataVariable) {
      case '@random':
        return blockData[path].random;
      default:
        return getDataVariableValue(
          dataVariable, blockData[path].index, Object.keys(value)
        );
    }
  }

  static getDataVariableValue(dataVariable, index, keys) {
    const { mapKeyPrefixRegex } = RootProxy;

    switch (dataVariable) {
      case '@first':
        return index === 0;

      case '@last':
        return index === keys.length - 1;

      case '@index':
        return index;

      case '@key':
        return keys[index]
          // Remove $_ prefixes for map keys, if applicable
          .replace(mapKeyPrefixRegex, '');

      default:
        throw Error(`Unknown variable: ${dataVariable}`);
    }
  }

  doBlockInit({ path }) {
    this.blockData[path] = {
      index: -1,
    };
  }

  doBlockUpdate({ path }) {

    const blockData = this.blockData[path];
    // eslint-disable-next-line no-plusplus
    blockData.index++;
    blockData.random = this.randomString('random');
  }

  doBlockFinalize({ path }) {
    delete this.blockData[path];
  }

  isSyntheticAlias(path) {
    const { syntheticAliasSeparator } = RootCtxRenderer;
    return path.includes(syntheticAliasSeparator);
  }

  getSyntheticContext({
    alias,
    key,
  }) {
    return this.syntheticContext[alias][key];
  }

  static toObject({ map }) {
    assert(map.constructor.name === 'Map');
    const { toObject } = RootCtxRenderer;

    const out = {};
    map.forEach((value, key) => {
      if (value instanceof Map) {
        out[key] = toObject({ map: value });
      } else {
        out[key] = value;
      }
    });
    return out;
  }

  throwError(msg, loc) {
    const { getLine } = clientUtils;

    const _msg = `[${loc ? `${getLine({ loc })}` : this.getId()}] ${msg}`;
    alert(msg)

    throw Error(_msg);
  }

  setSyntheticContext({ alias, fn, loc, canonicalSource }) {

    const { getBlockNameFromSyntheticAlias, toObject } = RootCtxRenderer;
    const { getValueType } = CustomCtxRenderer;

    const value0 = fn();

    let value = value0;

    if (!this.analyzeConditionValue(value)) {
      // Pass <value> on to the forEach(...) helper, it is guarenteed that iteration will
      // not happen
      return value;
    }

    const blockName = getBlockNameFromSyntheticAlias(alias);

    const validateValue = () => {
      switch (blockName) {
        case 'each':
          if (!Array.isArray(value) && !value.constructor.name === 'Map') {
            this.throwError(
              `Expected an array or map to be the target of the #each block, not a ${getValueType(value)}, expression=${canonicalSource}`,
              loc,
            );
          }
          break;
        case 'with':
          if (!value.constructor.name === 'Object') {
            this.throwError(
              `Expected an object to be the target of the #with block, not a ${getValueType(value)}, expression=${canonicalSource}`,
              loc,
            );
          }
          break;
      }
    }

    validateValue();

    if (value.constructor.name === 'Map') {
      assert(blockName === 'each' && this.resolver);

      // eslint-disable-next-line no-param-reassign
      value = toObject({ map: value });
    }

    this.syntheticContext[alias] = {
      value,
    };

    if (blockName === 'each') {
      // eslint-disable-next-line default-case
      switch (true) {
        case value.constructor.name === 'Array':
          if (!this.resolver) {
            // Proxy the array, and dynamically update syntheticContext.current
            // for each iteration

            // eslint-disable-next-line no-param-reassign
            value = new Proxy(value, {
              get: (obj, prop) => {
                const v = obj[prop];

                switch (true) {
                  case prop === 'toJSON':
                    return () => obj;

                  case global.clientUtils.isNumber(prop):
                    this.syntheticContext[alias].current = v;
                    break;

                }
                return v;
              },
            });
          } else {
            // Note: this is used by TemplateProcessor during sub-path traversal, as the 
            // proxy above this is designed for use during runtime
            [this.syntheticContext[alias].current] = value;
          }
          break;

        case value.constructor.name === 'Object':
          if (!this.resolver) {
            // eslint-disable-next-line no-param-reassign
            value = new Proxy(value, {
              get: (obj, prop) => {
                const v = obj[prop];

                switch (true) {
                  case prop === 'toJSON':
                    return () => obj;

                  case !Object.getPrototypeOf(obj)[prop]:
                    this.syntheticContext[alias].current = v;
                    break;
                }

                return v;
              },
            });
          } else {
            const keys = Object.keys(value);
            this.syntheticContext[alias].current = keys.length ? value[keys[0]] : undefined;
          }
          break;
      }
    } else {
      // eslint-disable-next-line no-undef
      assert(blockName === 'with');

      this.syntheticContext[alias].current = value;
    }

    // Notice that <value> has been transformed above. On compile-time, we need to return
    // the exact value return by <fn> which is <value0> because the return type will also
    // need to be validated
    return this.resolver ? value0 : value;
  }

  getMethodNameFromInvocationString(str) {
    const { cachedNameSuffix } = RootCtxRenderer;
    return str.replace(`this.`, '').replace(`()`, '')
      .replace(cachedNameSuffix, '');
  }

  /**
   * This returns an invocation string that can be executed to return data from
   * the provided synthetic method name.
   * Note: This method provides caching support
   * 
   * @param {sring} name Method name 
   * @returns 
   */
  createInvocationString(name) {
    return `this.${name}()`;
  }

  // eslint-disable-next-line class-methods-use-this
  isSyntheticMethodName(name) {
    // eslint-disable-next-line no-undef
    return name && name.startsWith(RootProxy.syntheticMethodPrefix);
  }

  getSyntheticMethod({ name }) {
    // eslint-disable-next-line no-undef
    const f = this[`${RootProxy.syntheticMethodPrefix}${name}`];
    return f ? f.bind(this) : null;
  }

  static getSyntheticMethod({ name }) {
    // eslint-disable-next-line no-undef
    const f = this[`${RootProxy.syntheticMethodPrefix}${name}`];
    return f ? f.bind(this) : null;
  }

  getExecPath({ fqPath, indexResolver, useCache = true }) {

    const { pathSeparator, isMapProperty, globalsBasePath } = RootProxy;
    const { toObject } = RootCtxRenderer;
    const { getSegments } = clientUtils;

    if (!fqPath) return fqPath;

    if (this.resolver) {
      useCache = false;
    }

    let cacheKey;

    if (useCache) {
      cacheKey = `execPath_cache_${fqPath}`;
      const value = this.getVariableInScope(cacheKey);
      if (value) return value;
    }

    if (!indexResolver) {
      // eslint-disable-next-line no-param-reassign
      indexResolver = path => this.blockData[path].index;
    }

    const segments = fqPath.split(pathSeparator);
    const parts = [];

    const addToCache = (resolvedPath) => {
      if (useCache) {
        this.addVariableToScope(cacheKey, resolvedPath);
      }
    }

    const hasIndex = !this.isSyntheticMethodName(fqPath) && segments[0] != globalsBasePath;

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < segments.length; i++) {
      let part = segments[i];

      if (!hasIndex) {
        parts.push(part);
        continue;
      }

      // This is necessary if we have a part like: x_$[0]
      const partSegments = getSegments({ original: part });
      [part] = partSegments;

      const suffix = partSegments.slice(1).join('');

      if (part.endsWith('_$')) {

        const [parent] = part.split(/_\$$/);

        // For multidimensional collections, it's common to have a path like
        // ..._$_$ or..._$[0], hence we need to get exec path as shown here
        // and then use that to assign <part> and <path>

        // This should resolve to either an array or object

        const canonicalPath = fqPath.split(pathSeparator, i)
          .concat([parent])
          .join(pathSeparator)

        const path = this.getExecPath({ fqPath: canonicalPath, indexResolver, useCache });

        // if path ends with w.x.$_abc, part should be x.$_abc, not $_abc,
        // because $_abc should be translated as the index placeholder: _$
        part = path.split(/\.(?!\$_)/g).pop();

        let value = this.evalPath({ path });

        assert(
          value instanceof Array || (this.resolver ? value instanceof Map : value[isMapProperty]),
          `${path} should resolve to either a Map or an Array`
        );

        if (this.resolver && value instanceof Map) {
          value = toObject({ map: value });
        }

        // On runtime, an iteration in forEach(...) resulting in the resolution of this path. 
        // On compile-time, validateType(...) ensured that the collection was non-empty
        assert(Object.keys(value).length > 0);

        const index = indexResolver(canonicalPath);

        const isArray = value instanceof Array;
        const isMap = value instanceof Object;

        switch (true) {

          case isArray:
            part += `[${index}]`;
            break;

          case isMap:
            const k = Object.keys(value)[index];
            part += this.resolver ? `.${k}` : `["${k}"]`;
            break;

          default:
            throw Error(`Unknown path "${path}"`);
        }
      }

      if (suffix.length) {
        part += suffix;
      }

      parts.push(part);
    }

    const ret = parts
      .map((part, index) => index == 0 ? part : `.${part}`)
      .join('');

    addToCache(ret);

    return ret;
  }

  resolvePath({ fqPath, indexResolver, includePath, create, stmt }) {
    const { dataPathRoot, pathSeparator } = RootProxy;

    const arr = fqPath.split('%');

    const path = this.getExecPath({ fqPath: arr[0], indexResolver });

    const isSynthetic = this.isSyntheticMethodName(path);

    const value = this.evalPath({
      path: path + ((arr.length > 1 && !isSynthetic) ? `%${arr[1]}` : ''),
      isSynthetic, create, stmt,
    });

    return includePath ?
      {
        canonicalPath: arr[0],
        path: !isSynthetic ? `${dataPathRoot}${pathSeparator}${path}` : path,
        value,
      } :
      value;
  }

  evalPath({ path, isSynthetic, create, stmt }) {
    const { globalsBasePath } = RootProxy;

    switch (true) {
      case isSynthetic || this.isSyntheticMethodName(path):
        const cache = this.#syntheticCache.at(-1);
        let ret = cache[path];

        if (!ret) {
          ret = this[path].bind(this)();
          cache[path] = ret;
        }

        return ret;

      case path.startsWith(`${globalsBasePath}.`):
        return this.getGlobalVariables()[
          path.replace(`${globalsBasePath}.`, '')
        ];

      case !!this.resolver:
        return this.resolver.resolve({ path, create, stmt });

      default:
        return path ? this.getInputMap().get(path) : this.getInput();
    }
  }

  unsafeEvaluate(code, lenient, loc, scope = {}) {
    const { lenientExceptionMsgPattern } = RootProxy;

    try {
      return self.appContext.unsafeEvaluate(code, scope);
    } catch (e) {
      if (lenient && e.name == 'TypeError' && e.message.match(lenientExceptionMsgPattern)) {
        return undefined;
      } else {
        this.throwError(
          `Exception thrown while executing "${code}": ${e.message}`,
          loc,
        );
      }
    }
  }

  buildInputData({ inputProducer = () => ({}), hash = {} }) {
    const { getDefaultConfig } = BaseRenderer;

    let config, handlers;

    // Add config

    Object.keys(getDefaultConfig())
      .filter(k => hash[k] !== undefined)
      .forEach(k => {
        if (!config) { config = {} };

        config[k] = hash[k];
        delete hash[k];
      });

    // Add handlers

    const eventNamePattern = /^on\-/g;

    Object.keys(hash)
      .filter(k => k.match(eventNamePattern))
      .forEach(k => {
        if (!handlers) { handlers = {} };

        const evtName = k.replace(eventNamePattern, '');

        if (hash[k]) {
          handlers[evtName] = hash[k];
        }

        delete hash[k];
      });

    const input = inputProducer();

    for (const [key, value] of Object.entries(hash)) {
      if (value === undefined) {
        continue;
      }

      input[key] = value;
    }

    return {
      input, handlers, config,
    }
  }

  createComponent({ hash, componentClass }) {

    const { input, handlers, config } = this.buildInputData({
      inputProducer: () => ({}), hash
    });

    const component = new componentClass({
      input,
      parent: this,
      config,
    });

    if (handlers) {
      this.addEventHandlers({ handlers, component });
    }

    return component;
  }

  addEventHandlers({ fromComponent, handlers = {}, component }) {

    if (fromComponent) {

      component.setHandlerFunctions(
        fromComponent.getHandlerFunctions()
      )

      component.setHandlers(
        fromComponent.getHandlers()
      );
    }

    const helpersNamespace = this.getHelpersNamespace();

    Object.entries(handlers)
      .forEach(([evtName, handler]) => {

        if (typeof handler != 'string') {
          // We don't understand what <handler> is
          return;
        }

        if (handler.startsWith(`${helpersNamespace}.`)) {
          component.on(evtName, handler);
        } else {

          if (typeof this[handler] != 'function') {
            throw Error(`Unknown event handler "${handler}" added for event "${evtName}"`);
          }

          component.on(evtName, new EventHandler(
            () => {
              this[handler].bind(this)();
            },
            this,
            { handler }
          ));
        }
      });
  }

  cloneInlineComponents() {
    return false;
  }

  getComponentInstanceFromSpec({ canonicalPath, componentSpec, hash = {}, loc }) {
    const { cloneInputData } = BaseComponent;
    const { pathSeparator } = RootProxy;

    assert(canonicalPath && componentSpec instanceof BaseComponent);

    let clone = this.cloneInlineComponents();

    if (Array.isArray(clone)) {
      clone = clone.includes(canonicalPath.split(pathSeparator).join('.'));
    }

    if (!clone && componentSpec.getMetaInfo().loaded) {

      if (!this.isHeadlessContext()) {
        this.throwError(
          'A single component instance cannot be rendered multiple times. To resolve, override cloneInlineComponents() and return true',
          loc
        );
      } else {
        // At compile-time, this should be fine
      }

    }

    const inputProducer = () => clone ?
      cloneInputData(componentSpec.getInput()) :
      componentSpec.getInput();

    const { handlers, config, input } = this.buildInputData({
      inputProducer, hash,
    });

    let component;

    if (clone) {

      component = new componentSpec.constructor({ input, config });

      this.addEventHandlers({
        fromComponent: componentSpec, component,
      });

    } else {

      component = componentSpec;

      if (config) {
        Object.entries(config)
          .forEach(([k, v]) => {
            component.addConfig(k, v);
          });
      }

      componentSpec.addMetaInfo('loaded', true);
    }

    this.addEventHandlers({ handlers, component });

    return component;
  }

  // eslint-disable-next-line class-methods-use-this
  loadInlineComponent() {

    // eslint-disable-next-line prefer-rest-params
    const params = Array.from(arguments);
    const options = params.pop();

    const [componentSpec] = params;
    const { loc, hash } = options;

    const { ref, inlineComponent, canonicalPath } = hash;

    delete hash.ctx;

    delete hash.ref;
    delete hash.inlineComponent;
    delete hash.canonicalPath;

    delete hash.hook;

    const bindContext = this.peekDataStack();

    if (inlineComponent && bindContext) {
      // Update the current bind context if necessary, for data-binding purpose

      bindContext.inlineComponent = true;
      bindContext.canonicalPath = canonicalPath;
      bindContext.ref = ref;
    }

    let component;

    switch (true) {
      case typeof componentSpec == 'string':

        const componentClass = global.components[componentSpec];

        if (componentClass && componentClass.prototype instanceof BaseComponent) {
          component = this.createComponent({
            hash,
            componentClass,
          });
        }

        break;

      case componentSpec && componentSpec instanceof BaseComponent:
        component = this.getComponentInstanceFromSpec({
          canonicalPath, componentSpec, hash, loc
        });
        break;
    }

    if (component) {
      this.#registerInlineComponent(ref, component);
    }

    return component || '';
  }

  #registerInlineComponent(ref, component) {
    if (ref) {
      this.#inlineComponentInstances[ref] = component;

      this.on('onMount', () => {
        this.dispatchEvent(`inlineComponentInit-${ref}`);
      });

      component.on('destroy', new EventHandler(
        () => {
          delete this.getInlineComponentInstances()[ref];
        },
        this,
        { ref }
      ))
    }

    component.setInlineParent(this);
  }

  onceInlineComponentLoad(ref, fn) {
    this.once(`inlineComponentInit-${ref}`, fn);
  }

  getInlineComponent(ref) {
    return this.#inlineComponentInstances[ref];
  }

  getInlineComponentInstances() {
    return this.#inlineComponentInstances;
  }

  getComponentName() {
    try {
      return this.getSyntheticMethod({ name: 'getComponentName' })();
    } catch (e) {
      // We are in compile-time
      assert(!!global.preprocessor);
      return global.preprocessor.className;
    }
  }

  getBooleanOperators() {
    const ret = {};

    [...this.recursivelyInvokeMethod('booleanOperators')]
      .reverse()
      .forEach(r => {
        Object.entries(r)
          .forEach(([key, value]) => {
            assert(value instanceof Function);

            if (!ret[key]) {
              ret[key] = [];
            }

            ret[key].push(value);
          });
      });

    return ret;
  }

  getOwnMethod(name) {
    let o = Reflect.getPrototypeOf(this);
    if (this.constructor.name != this.getComponentName()) {
      // This instance was created from the test class
      o = Reflect.getPrototypeOf(o);
    }

    return Reflect.ownKeys(o).includes(name) ?
      o[name].bind(this) : null;
  }

  getOwnBehaviours() {
    const fn = this.getOwnMethod('behaviours');
    return fn ? fn() : [];
  }

  getBehaviours() {
    let behaviours = [];

    this.recursivelyInvokeMethod('behaviours').forEach(arr => {
      assert(arr.constructor.name == 'Array');
      behaviours = behaviours.concat(arr);
    });

    return behaviours;
  }

  events() {
    return ['render', 'load'];
  }

  getOwnEvents() {
    const fn = this.getOwnMethod('events');
    return (fn && Array.isArray(fn())) ? fn() : [];
  }

  getBaseEvents() {
    let events = [];

    this.recursivelyInvokeMethod('events', (c) => !(c.prototype instanceof BaseComponent))
      .forEach(arr => {
        assert(arr.constructor.name == 'Array');
        events = events.concat(arr);
      });

    return events;
  }

  getTransformers() {
    const transformers = {};

    this.recursivelyInvokeMethod('transformers').forEach(r => {
      Object.entries(r)
        .forEach(([key, value]) => {
          assert(value instanceof Function);

          if (!transformers[key]) {
            transformers[key] = [];
          }

          transformers[key].push(value);
        });
    });

    Object.values(transformers).forEach(arr => arr.reverse());

    return transformers;
  }

  getInitializers() {
    const initializers = {};

    this.recursivelyInvokeMethod('initializers').forEach(r => {
      Object.entries(r)
        .forEach(([key, value]) => {

          if (!initializers[key]) {
            initializers[key] = [];
          }

          initializers[key].push(value);
        });
    });

    return initializers;
  }

  static #escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  }

  getAssetId() {
    return this.getSyntheticMethod({ name: 'assetId' })();
  }

  getLogicGates() {
    return this.getSyntheticMethod({ name: 'logicGates' })();
  }

  dataBindingEnabled() {
    return !this.isHeadlessContext() && this.getSyntheticMethod({ name: 'dataBindingEnabled' })();
  }

  hasBlockTransform() {
    return !this.isHeadlessContext() && this.getSyntheticMethod({ name: 'hasBlockTransform' })();
  }

  getGlobalHelpers() {
    return this.getSyntheticMethod({ name: 'globalHelpers' })();
  }

  getPathBlockAssociations() {
    return this.getSyntheticMethod({ name: 'pathBlockAssociations' })();
  }

  getRenderedCollections() {
    return this.getSyntheticMethod({ name: 'renderedCollections' })();
  }

  getNonNullPaths() {
    return this.getSyntheticMethod({ name: 'nonNullPaths' })();
  }

  hasStaticPath() {
    return this.getSyntheticMethod({ name: 'hasStaticPath' })();
  }
}
module.exports = RootCtxRenderer;
