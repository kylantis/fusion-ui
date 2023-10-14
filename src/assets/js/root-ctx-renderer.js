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

  static nodePruneTimeout = 5000;

  static #token;

  static #helpersNamespace = '__helpers';

  #currentBindContext;

  #attributeEmitContext;

  #inlineComponentInstances;

  #syntheticCache;

  #objectRegistry;

  #handlebars;

  #handlebarsOptions;

  #promise;

  #resolve;

  #futures;

  #rendered;

  #emitContext;

  #helperFunctionNames;

  constructor({
    id, input, logger, config,
  } = {}) {
    super({
      id, input, logger, config,
    });

    this.blockData = {};

    this.syntheticContext = {};

    this.#promise = new Promise((resolve) => {
      this.#resolve = resolve;
    });

    this.#futures = [];

    this.syntheticNodeId = [];
    this.#currentBindContext = [];

    this.hooks = {};

    this.#inlineComponentInstances = {};
    this.#syntheticCache = [];
    this.#objectRegistry = {};

    this.mustacheStatements = {};
  }

  getFutures() {
    return this.#futures;
  }

  getPromise() {
    return this.#promise;
  }

  isMounted() {
    return !!this.mounted;
  }

  static setToken(token) {
    if (RootCtxRenderer.#token) {
      throw Error(`Could not set token: ${token}`);
    }
    RootCtxRenderer.#token = token;
  }

  hasEmitContext() {
    return !!this.#emitContext;
  }

  getEmitContext() {
    if (!this.hasEmitContext()) {
      this.throwError(`No emit context exists`);
    }

    return this.#emitContext;
  }

  startTokenizationContext() {
    const streamTokenizer = new hyntax.StreamTokenizer();

    streamTokenizer
      .on('data', (tokens) => {
        this.#emitContext.tokenList = this.#emitContext.tokenList.concat(tokens);
      });

    const blockStack = [];

    this.#emitContext = {
      tokenList: [], nodeList: {},
      blockStack, transforms: {},
      write: (value) => {
        if (blockStack.length == 0) {
          streamTokenizer.write(value);
        }
      },
    };
  }

  getFunctionListFromString(str) {
    const { getCommaSeperatedValues } = clientUtils;
    return getCommaSeperatedValues(str).map(n => this[n].bind(this));
  }

  finalizeTokenizationContext({ transform } = {}) {

    const { ast } = hyntax.constructTree(this.#emitContext.tokenList);

    if (transform) {
      this.getFunctionListFromString(transform)
        .forEach(fn => fn(ast.content.children))
    }

    const ret = {
      htmlString: this.stringifyHtmlAst({ ast }),
    };

    this.#emitContext = null;

    return ret;
  }

  nodeIdTransformSelector(nodeId) {
    assert(nodeId);
    return `#${nodeId}`
  }

  nodeDirectChildrenTransformSelector(nodeId) {
    assert(nodeId);
    return `#${nodeId} > *`
  }

  registerTransform(selector, methodName) {
    this.getEmitContext().transforms[selector] = methodName;
  }

  getMetadata(assetId) {
    return global.templates[`metadata_${assetId}`];
  }

  getDecorator(decoratorName) {
    const { decorators } = this.getMetadata(this.getAssetId());

    const decorator = decorators[decoratorName];

    if (!decorator) {
      this.throwError(`Could not find runtime decorator "${decoratorName}"`);
    }

    return decorator;
  }

  renderDecorator({ program, config }, node) {

    const fn = () => this.#handlebars.template(program)(
      this.rootProxy, this.#handlebarsOptions,
    );

    if (this.#emitContext) {

      // A tokenization context exists - this method was called by handlebars.VM.invokePartial 
      // to resolve a partial
      return fn();

    } else {
      assert(node);

      // const { decoratorName } = config;

      this.startRenderingContext();
      this.startTokenizationContext();

      fn();

      const { htmlString } = this.finalizeTokenizationContext();

      node.innerHTML = htmlString;

      this.finalizeRenderingContext();
    }
  }

  isLoadable0() {
    return this.getConfig().loadable;
  }

  isLoadable() {
    return this.isLoadable0();
  }

  stringifyHtmlAst({ ast }) {
    const { htmlWrapperCssClassname, visitHtmlAst } = RootCtxRenderer;

    const arr = [];

    const tagVisitor = (node) => {

      const { content } = node;

      const attr = (k) => (content.attributes || []).filter(({ key: { content } }) => content == k)[0];

      const idAttr = attr('id');
      const classAttr = attr('class');

      const isBlockWrapper = content.name == 'div' && classAttr && (classAttr.value.content == htmlWrapperCssClassname);

      if (isBlockWrapper && idAttr) {
        const nodeId = idAttr.value.content;

        const nodeIdTransform = this.getEmitContext().transforms[this.nodeIdTransformSelector(nodeId)];
        const nodeDirectChildrenTransform = this.getEmitContext().transforms[this.nodeDirectChildrenTransformSelector(nodeId)];

        if (nodeIdTransform) {
          this.getFunctionListFromString(nodeIdTransform)
            .forEach(fn => fn(node))
        }

        if (nodeDirectChildrenTransform) {
          this.getFunctionListFromString(nodeDirectChildrenTransform)
            .forEach(fn => fn(node.content.children))
        }
      }
    }

    const emitter = (value) => {
      arr.push(value);
    };

    visitHtmlAst({
      ast, tagVisitor,
    });

    visitHtmlAst({
      ast, emitter, format: true
    });

    return arr.join('');
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

    acceptNode(ast);
  }

  isComponentRendered() {
    return this.#rendered;
  }

  async getRenderedHtml({ token }) {
    const { getMetaHelpers } = RootCtxRenderer;

    if (token !== RootCtxRenderer.#token && !this.isRoot()) {
      throw Error(`Invalid token: ${token}`);
    }

    if (this.#rendered) {
      throw Error(`${this.getId()} is already rendered`);
    }

    await this.invokeLifeCycleMethod('beforeRender');

    const componentHelpers = {};

    // Register dynamic helpers
    for (const helperName of this.getHelpers()) {
      componentHelpers[helperName] = this[helperName].bind(this);
    }

    const helpers = {
      ...componentHelpers,
      ...this.getHandlebarsHelpers(),
    }

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

    if (!this.#helperFunctionNames) {
      // Expose global helpers as global functions for our fn helper
      this.#helperFunctionNames = {};
      const noOpHelper = 'noOp';

      const helpersNamespace = RootCtxRenderer.#helpersNamespace;
      const __helpers = window[helpersNamespace] || (window[helpersNamespace] = {});

      for (const helperName of this.getGlobalHelpers()) {
        let helperFn = componentHelpers[helperName];

        if (!helperFn) {
          helperFn = this[helperName].bind(this);
        }

        const id = clientUtils.randomString();

        this.#helperFunctionNames[helperName] = id;
        __helpers[id] = helperFn;
      }

      if (!__helpers[noOpHelper]) {
        __helpers[noOpHelper] = () => { }
      }
    }

    // Control prototype access, to prevent attackers from executing
    // arbitray code on user machine, more info here:
    // https://handlebarsjs.com/api-reference/runtime-options.html#options-to-control-prototype-access
    const allowedPaths = this.getSyntheticMethod({ name: 'allowedPaths' })();
    const allowedProtoProperties = {};

    for (const path of allowedPaths) {
      allowedProtoProperties[path] = true;
    }

    // Create new handlebars environment
    this.#handlebars = Handlebars.create();

    // Add a custom partial resolver, inorder to expose runtime decorators as partials
    this.#handlebars.VM.invokePartial = (partial, context, options) => {
      return this.renderDecorator(
        this.getDecorator(options.name)
      );
    };

    this.#handlebarsOptions = {
      helpers,
      allowedProtoProperties: {
        // Todo: Stop passing in everthing, we only need the paths prefixed with "data__r$_"
        // To test any future fix, use checkbox component because it contains a custom context
        ...allowedProtoProperties,
      },
    };

    const { template } = this.getMetadata(this.getAssetId());

    this.startTokenizationContext();

    this.startSyntheticCacheContext();

    // eslint-disable-next-line no-undef
    this.#handlebars.template(template)(
      {
        data: this.rootProxy,
      },
      this.#handlebarsOptions,
    );

    this.pruneSyntheticCache();

    const { htmlString } = this.finalizeTokenizationContext();

    assert(this.syntheticNodeId.length == 0);

    this.#rendered = true;

    return htmlString;
  }

  async load({ container, token, html, style = {}, domRelayTimeout = 5 }) {

    const { htmlWrapperCssClassname } = RootCtxRenderer;

    if (this.isMounted()) {
      throw Error(`${this.getId()} is already mounted`);
    }

    if (token !== RootCtxRenderer.#token && !this.isRoot()) {
      throw Error(`Invalid token: ${token}`);
    }
    await this.invokeLifeCycleMethod('beforeLoad', domRelayTimeout);

    if (!this.isLoadable()) {
      return;
    }

    super.load();

    const parentNode = container ? document.getElementById(container) : document.body;

    // We require that the <parentNode> is a live element, present om the DOM
    assert(parentNode != null, `DOMElement #${container} does not exist`);

    this.node = document.createElement('div');

    this.node.id = this.getElementId();
    this.node.classList.add(htmlWrapperCssClassname);
    this.node.setAttribute('__component', this.getId())

    parentNode.appendChild(this.node);

    if (!html) {
      html = await this.getRenderedHtml({ token });
    }

    this.node.innerHTML = html;

    this.dispatchEvent('templateRender');

    Object.entries(style)
      .forEach(([k, v]) => {
        this.node.style[k] = v;
      })

    if (domRelayTimeout > 0) {
      await new Promise((resolve) => {
        setTimeout(resolve, domRelayTimeout)
      });
    }

    this.dispatchEvent('render');

    await this.triggerInitialHooks('onMount');

    await this.invokeLifeCycleMethod('onMount');

    this.#resolve();

    this.dispatchEvent('resolve');

    await this.awaitPendingTasks();


    assert(Object.keys(this.syntheticContext).length == 0);

    this.triggerNodeUpdateEvent(this.node);

    self.appContext.components[this.getId()] = this;


    await this.triggerInitialHooks('afterMount');

    await this.invokeLifeCycleMethod('afterMount');

    await this.awaitPendingTasks();

    this.dispatchEvent('load');

    this.mounted = true;
  }

  getNode0() {
    return this.node;
  }

  getElementId() {
    return this.getId();
  }

  startSyntheticCacheContext() {
    this.#syntheticCache.push({});
  }

  pruneSyntheticCache() {
    const cache = this.#syntheticCache.pop();

    for (const k in cache) {
      const name0 = this.toSyntheticCachedName(k);
      assert(this[name0] instanceof Function);

      delete this[name0];
      delete cache[k];
    }
  }

  async invokeLifeCycleMethod(name, ...args) {
    const methods = this.recursivelyGetMethods(name);
    for (const fn of methods) {
      await fn(...args)
    }
  }

  recursivelyInvokeMethod(names, classPredicate, ...args) {
    return this.recursivelyGetMethods(names, classPredicate).map(fn => fn(...args))
  }

  recursivelyGetMethods(names, classPredicate) {
    const methods = [];

    let component = this;

    while ((component = Reflect.getPrototypeOf(component))
      // eslint-disable-next-line no-undef
      && component.constructor.name !== BaseRenderer.name
    ) {

      if (classPredicate && !classPredicate(component.constructor)) {
        continue;
      }

      if (typeof names === 'string') {
        names = [names];
      }

      names.forEach(name => {
        assert(name !== 'constructor');

        if (Reflect.ownKeys(component).includes(name)) {
          methods.unshift(component[name].bind(this));
        }
      });
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
        data[hash[k]] = hash[k.replace(contextIdHashKeyPrefix, '')];
      });

    return '';
  }

  startRenderingContext() {

    this.#promise = new Promise((resolve) => {
      this.#resolve = resolve;
    });

    this.#futures = [];

    this.startSyntheticCacheContext();
  }

  /**
   * As a general contract, this method should be called after rendering has completed and
   * the resulting html has been added to the DOM
   */
  finalizeRenderingContext() {

    this.dispatchEvent('render');

    this.#resolve();

    this.pruneSyntheticCache();
  }

  /**
   * This method is used to register functions that need to be invoked after rendering has 
   * fully completed.
   * 
   * @param {Function} fn 
   */
  onContextFinalization(fn) {
    this.once(fn, 'render');
  }

  static getSupportedHookPhases() {
    return ['onMount', 'afterMount'];
  }

  getDefaultHookPhase() {
    return 'afterMount';
  }

  async triggerInitialHooks(phase) {

    await Promise.all(
      Object.keys(this.hooks)
        .sort((e1, e2) => {

          const o1 = this.hooks[e1].order;
          const o2 = this.hooks[e2].order;

          return o1 < o2 ? -1 : o2 < o1 ? 1 : 0;
        })
        .map(async (selector) => {
          const { fnList, blockData } = this.hooks[selector];

          await Promise.all(
            fnList
              .map(({ hookName, hookPhase }) => {
                if (hookPhase != phase) {
                  return false;
                }

                const hook = this[hookName].bind(this);
                const node = document.querySelector(`#${this.getId()} ${selector}`);

                assert(hook);

                if (!node) {
                  // Node could not be found - It's likely that a transform (outer/inner) removed it 
                  // from the html ast
                  return false;
                }

                return hook({
                  node,
                  blockData,
                  // This indicates that this hook is triggered just before this component
                  // is fully mounted, as opposed to on data update
                  initial: true,
                });
              })
              .filter(h => h)
          );
        })
    );
  }

  // This is a helper method for proxyInstance to use in hook invocation
  async triggerBlockHooks(hookNameString, hookPhaseString, phase, loc, opts) {
    assert(phase);

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
    assert(selector);

    this.hooks[selector] = {
      order: hookOrder != undefined ? hookOrder : this.getDefaultHookOrder(),
      blockData: blockData ? blockData : clientUtils.deepClone(this.blockData),
      fnList: [],
    }

    this.getBlockHookList(hookNameString, hookPhaseString, null, loc)
      .forEach(({ hookName, hookPhase }) => {
        this.hooks[selector].fnList.push({
          hookName, hookPhase,
        });
      });
  }

  conditional({ options, ctx, params }) {

    const { conditionalBlockHookType } = RootProxy;
    const { syntheticAliasSeparator, getSyntheticAliasFromPath0 } = RootCtxRenderer;

    const { fn, inverse, hash, loc } = {
      ...options,
      fn: this.addToObjectRegistry(options.fn),
      inverse: this.addToObjectRegistry(options.inverse),
    };

    const { hook, hookPhase, hookOrder, outerTransform, innerTransform, transient } = hash;

    const nodeId = this.getSyntheticNodeId();

    let [target, invert] = params;

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

    const conditional0 = (value) => {

      if (hook) {
        this.registerHook(`#${nodeId}`, hook, hookPhase, hookOrder, loc);
      }

      if (outerTransform) {

        this.registerTransform(
          this.nodeIdTransformSelector(nodeId), outerTransform
        );
      }

      if (innerTransform) {

        this.registerTransform(
          this.nodeDirectChildrenTransformSelector(nodeId), innerTransform
        );
      }

      const b = this.analyzeConditionValue(value);
      let branch;

      const markup = (() => {
        let func;

        if (invert ? !b : b) {

          branch = 'fn';
          func = this.lookupObject(fn);

        } else if (inverse) {

          branch = 'inverse';
          func = this.lookupObject(inverse);
        }

        this.getEmitContext().blockStack.push(loc);

        const markup = func(ctx);

        this.getEmitContext().blockStack.pop();

        this.getEmitContext().write(markup);

        return markup;
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

    // Todo: If target is a logicGate, I can optimize space by having the blockData
    // of the logicGate and this conditional block reference the same blockData object
    // instead of having separate objects that are exactly the same

    if (dataBinding) {
      this.proxyInstance.getDataPathHooks()[path]
        .push({
          type: conditionalBlockHookType, selector: `#${nodeId}`,
          fn, inverse, hookMethod: hook, hookPhase, invert, transient,
          blockData: this.getBlockDataSnapshot(path),
          canonicalPath, loc, innerTransform,
        });
    }

    const html = conditional0(value);

    if (this.#attributeEmitContext) {
      assert(!nodeId);
      this.#attributeEmitContext.write(html);
    }

    return html;
  }

  getCollIntrinsicHookTypes() {
    const { collChildSetHookType, collChildDetachHookType } = RootProxy;
    return [collChildSetHookType, collChildDetachHookType];
  }

  getArrayIntrinsicHookTypes() {
    const { arrayChildReorderHookType } = RootProxy;
    return [arrayChildReorderHookType];
  }

  getColElementWrapperHeader(id, key) {
    const { htmlWrapperCssClassname } = RootCtxRenderer;
    return `<div id="${id}" class="${htmlWrapperCssClassname}" key="${key}">`;
  }

  getColElementWrapperFooter() {
    return '</div>';
  }

  forEach({ options, ctx, params }) {

    const {
      eachBlockHookType, predicateHookType, toFqPath, isNullProperty, dataPathPrefix,
    } = RootProxy;
    const { getSyntheticAliasFromPath } = RootCtxRenderer;

    const { fn, inverse, hash, loc } = {
      ...options,
      fn: this.addToObjectRegistry(options.fn),
      inverse: this.addToObjectRegistry(options.inverse),
    };

    const { hook, hookPhase, hookOrder, innerTransform, outerTransform, predicate } = hash;

    const [{ path, value, canonicalPath }] = params;

    const nodeId = this.getSyntheticNodeId();

    const isSynthetic = this.isSyntheticMethodName(path);
    const dataBinding = !isSynthetic && this.dataBindingEnabled() && nodeId;

    const forEach0 = () => {

      if (outerTransform) {
        this.registerTransform(
          this.nodeIdTransformSelector(nodeId), outerTransform
        );
      }

      if (innerTransform) {
        this.registerTransform(
          this.nodeDirectChildrenTransformSelector(nodeId), innerTransform
        );
      }

      if (this.analyzeConditionValue(value)) {

        const isArray = Array.isArray(value);

        // Add (length and type) to this.blockData

        const blockKey = isSynthetic ? getSyntheticAliasFromPath(path) : canonicalPath;

        this.blockData[blockKey].length = value.length;
        this.blockData[blockKey].type = isArray ? 'array' : 'map';

        // Note: <rawValue> and <keys> are only used to check for null members

        const rawValue = value.toJSON();

        const keys = Object.keys(rawValue);

        let ret = "";

        for (let i = 0; i < value.length; i++) {

          if (isSynthetic) {
            // Update the current value of the synthetic context
            value[i];
          }

          const currentWrapperNodeId = nodeId ? clientUtils.randomString() : null;

          const p = toFqPath({ isArray, isMap: !isArray, parent: path, prop: keys[i] });

          const key = this.getBlockData({
            path: blockKey,
            dataVariable: '@key',
            blockDataProducer: () => ({
              ...this.blockData,
              [blockKey]: {
                ...this.blockData[blockKey],
                index: i,
              }
            })
          });

          const wrapperHeader = currentWrapperNodeId ? this.getColElementWrapperHeader(currentWrapperNodeId, key) : null;
          const wrapperFooter = currentWrapperNodeId ? this.getColElementWrapperFooter() : null;

          if (currentWrapperNodeId) {
            this.getEmitContext().write(wrapperHeader);
          }

          this.getEmitContext().blockStack.push(loc);

          const currentValue = rawValue[key];

          const isNull = currentValue === null || currentValue[isNullProperty] || (predicate ? !this[predicate].bind(this)(currentValue) : false);

          this.startSyntheticCacheContext();

          let markup = isNull ?
            // null collection members are always represented as an empty strings
            (() => {
              this.blockData[blockKey].index++;
              return '';
            })() :
            this.lookupObject(fn)(this.rootProxy);

          this.pruneSyntheticCache();

          this.getEmitContext().blockStack.pop();

          this.getEmitContext().write(markup);

          if (currentWrapperNodeId) {
            this.getEmitContext().write(wrapperFooter);
          }

          if (currentWrapperNodeId) {
            markup = `${wrapperHeader}${markup}${wrapperFooter}`;
          }

          if (isArray && !isSynthetic && currentWrapperNodeId) {

            if (nodeId) {
              this.backfillArrayChildBlocks(p, `#${currentWrapperNodeId}`);
            } else {
              this.pruneArrayChildBlocks(p, null);
            }
          }

          if (hook) {
            this.registerHook(`#${nodeId} > #${currentWrapperNodeId}[key='${key}']`, hook, hookPhase, hookOrder, loc);
          }

          if (dataBinding && predicate) {

            this.proxyInstance.getDataPathHooks()[p]
              .push({
                type: predicateHookType, selector: `#${currentWrapperNodeId}`,
                fn, predicate, hookMethod: hook, hookPhase, innerTransform, loc,
                blockData: this.getBlockDataSnapshot(p),
                canonicalPath: `${canonicalPath}_$`,
              });
          }

          ret += markup;
        }

        if (isSynthetic) {
          delete this.syntheticContext[blockKey];
        }

        return ret;

      } else if (inverse) {

        return this.lookupObject(inverse)(ctx);
      }
    }

    if (dataBinding) {

      this.proxyInstance.getDataPathHooks()[path]
        .push({
          type: eachBlockHookType, selector: `#${nodeId}`,
          fn, inverse, predicate, hookMethod: hook, hookPhase,
          blockData: this.getBlockDataSnapshot(path),
          canonicalPath, loc, innerTransform,
        });

      const collDef = this.proxyInstance.getCollectionDefinition(path.replace(dataPathPrefix, ''));

      if (collDef) {
        [
          ...this.getCollIntrinsicHookTypes(),
          ...(collDef.collectionType == 'array') ? this.getArrayIntrinsicHookTypes() : []
        ]
          .forEach(hookType => {

            this.proxyInstance.getDataPathHooks()[path]
              .push({
                type: hookType, selector: `#${nodeId}`,
                fn, predicate, hookMethod: hook, hookPhase,
                blockData: this.getBlockDataSnapshot(path),
                canonicalPath, loc, innerTransform,
              });
          })
      }
    }

    const html = forEach0();

    if (this.#attributeEmitContext) {
      assert(!nodeId);
      this.#attributeEmitContext.write(html);
    }

    return html;
  }

  lookupObject(id) {
    const { wrapFnWithExceptionCatching } = RootCtxRenderer;
    return wrapFnWithExceptionCatching(this.#objectRegistry[id]);
  }

  addToObjectRegistry(o) {
    assert(o);

    const id = clientUtils.randomString();
    this.#objectRegistry[id] = o;
    return id;
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

  /**
   * This backfills "selector: null" created by nested blocks via getBlockDataSnapshot(...)
   */
  backfillArrayChildBlocks(path, selector) {
    const { arrayChildBlockHookType } = RootProxy;

    const dataPathHooks = this.proxyInstance.getDataPathHooks();
    const arr = dataPathHooks[path];

    assert(selector);

    if (!arr) return;

    arr.forEach((hook) => {
      if (hook.type == arrayChildBlockHookType && !hook.selector) {
        this.proxyInstance.registerHookSelector(path, { selector });
        hook.selector = selector;
      }
    });
  }

  pruneArrayChildBlocks(path, selector) {
    const { arrayChildBlockHookType } = RootProxy;

    const dataPathHooks = this.proxyInstance.getDataPathHooks();
    const arr = dataPathHooks[path];

    if (!arr) return;

    dataPathHooks.set(
      path,
      arr.filter(
        ({ type, selector: s }) => type != arrayChildBlockHookType || s != selector
      )
    )
  }

  getClosestArrayBlock() {

    const { syntheticBlockKeyPrefix } = RootCtxRenderer;
    const { dataPathRoot, pathSeparator } = RootProxy;

    // We need to find the closest non-synthetic array-based blockData, and
    // register <path> as a arrayChildBlock. That way, when the current
    // array index moves, we can update the blockData captured for this path

    // In ES-2015+, insertion order is preserved, so we know the
    // last index is the most recent, and vice-versa

    const blockDataKeys = Object.keys(this.blockData)
      // If this is called by forEach(...), we need to skip the blockData entry created
      // in doBlockInit(...)
      .filter(k => this.blockData[k].index >= 0);

    for (let i = blockDataKeys.length - 1; i >= 0; i--) {
      const blockDataKey = blockDataKeys[i];
      const { type, index } = this.blockData[blockDataKey];

      if (type == 'array' && !blockDataKey.startsWith(syntheticBlockKeyPrefix)) {

        const p = this.getExecPath0({
          fqPath: `${blockDataKey}[${index}]`,
          addBasePath: false,
        });

        return {
          blockDataKey,
          path: `${dataPathRoot}${pathSeparator}${p}`,
        };
      }
    }

    return null;
  }

  getBlockDataSnapshot(targetPath, arrayBlock) {

    const { arrayChildBlockHookType } = RootProxy;

    if (arrayBlock === undefined) {
      arrayBlock = this.getClosestArrayBlock();
    }

    if (arrayBlock) {
      const { blockDataKey, path } = arrayBlock;

      const dataPathHooks = this.proxyInstance.getDataPathHooks();
      const hookList = dataPathHooks[path] || this.proxyInstance.createHooksArray(path);

      // Add hook, only if it does not already exist
      if (
        !hookList.filter(({ type, path: p }) =>
          type == arrayChildBlockHookType && p == targetPath)
          .length
      ) {
        hookList.push({
          type: arrayChildBlockHookType, path: targetPath,
          // <selector> will be backfilled by backfillArrayChildBlocks(...) on iteration
          selector: null,
          canonicalPath: `${blockDataKey}_$`,
          blockDataKey: blockDataKey,
        });
      };
    }

    // Then, clone and return blockData
    return clientUtils.deepClone(this.blockData);
  }

  fn(helperName) {
    return `${RootCtxRenderer.#helpersNamespace}.${(this.#helperFunctionNames || {})[helperName] || 'noOp'}`;
  }

  static getMetaHelpers() {
    return [
      'storeContext', 'loadContext', 'forEach', 'conditional', 'startAttributeBindContext',
      'endAttributeBindContext', 'startTextNodeBindContext', 'setSyntheticNodeId', 'resolveMustacheInRoot',
      'resolveMustacheInCustom', 'c', 'var', 'wrapInvocationWithProxy'
    ];
  }

  setSyntheticNodeId() {
    const id = global.clientUtils.randomString();
    this.syntheticNodeId.push(id);

    this.getEmitContext().write(id);

    return id;
  }

  getSyntheticNodeId() {
    return this.syntheticNodeId.pop();
  }

  peekSyntheticNodeId() {
    assert(this.syntheticNodeId.length == 1);
    return this.syntheticNodeId[0];
  }

  startAttributeBindContext() {

    if (!this.dataBindingEnabled()) {
      return '';
    }

    const streamTokenizer = new hyntax.StreamTokenizer();

    streamTokenizer
      .on('data', (tokens) => {
        this.#attributeEmitContext.tokenList = this.#attributeEmitContext.tokenList.concat(tokens);
      });

    this.#attributeEmitContext = {
      tokenList: [],
      literal: '',
      write: (value) => {
        this.#attributeEmitContext.literal += value;
        streamTokenizer.write(value);
      },
    };

    this.#attributeEmitContext.write('<');

    return '';
  }

  static getHtmlIntrinsicAttributes(elementName) {
    const { getHtmlIntrinsicAttributesMap } = RootCtxRenderer;
    const attributes = getHtmlIntrinsicAttributesMap();

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

  // Todo: Update this map, it may be incomplete
  static getHtmlIntrinsicAttributesMap() {
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

  static getElementName(tokenList) {
    return tokenList[0].content.replace('<', '');
  }

  getRenderedValue(value) {
    const rgx = /({{\w+}})/g;
    return value
      .split(rgx)
      .map(v => {
        if (v.match(rgx)) {
          const ref = v.replace(/({{)|(}})/g, '');
          v = this.mustacheStatements[ref].renderedValue;
        }
        return v;
      })
      .join('');
  }

  setRenderedValue(ref, value) {
    const mustacheInfo = this.mustacheStatements[ref];
    const { renderedValue: previousValue } = mustacheInfo;

    mustacheInfo.renderedValue = value;

    return previousValue;
  }

  getNodeIdFromTokenList({ tokenList, loc }) {
    for (let i = 0; i < tokenList.length; i++) {
      const { type, content } = tokenList[i];

      if (type == 'token:attribute-key' && content == 'id') {
        const valueToken = tokenList[i + 3];
        if (!valueToken || valueToken.type != 'token:attribute-value') {
          this.throwError(
            `Unknown value "${valueToken ? valueToken.content : "<empty>"}" was assigned to the "id" attribute`, { loc }
          );
        }

        const v = this.getRenderedValue(valueToken.content);

        if (v.match(/\s/)) {
          this.throwError(`ID attribute "${v}" must not contain whitespaces`, loc);
        }

        return v;
      }
    }
    return null;
  }

  endAttributeBindContext({ options }) {
    const {
      nodeAttributeHookType, nodeAttributeKeyHookType, nodeAttributeValueHookType
    } = RootProxy;

    if (!this.#attributeEmitContext) {
      return '';
    }

    const { loc } = options;

    const { randomString } = clientUtils;

    const { tokenList } = this.#attributeEmitContext;

    const definedNodeId = this.getNodeIdFromTokenList({ tokenList, loc });
    const nodeId = definedNodeId || randomString();

    const mustacheRgx = /{{\w+}}/g;
    const valueTokenIndexes = [];

    for (let tokenIndex = 0; tokenIndex < tokenList.length; tokenIndex++) {
      let { type, content } = tokenList[tokenIndex];

      (content.match(mustacheRgx) || [])
        .forEach(m => {

          const mustacheRef = m.replace(/({{)|(}})/g, '');

          const mustacheInfo = this.mustacheStatements[mustacheRef];

          if (!mustacheInfo) {
            return;
          }

          const { path, canonicalPath, transform, loc } = mustacheInfo;

          const isSynthetic = this.isSyntheticMethodName(path);

          // Todo: Support data-binding for synthetic invocations
          const dataBinding = !isSynthetic;

          let hookType;

          const hookInfo = { tokenList, tokenIndex };

          switch (true) {
            case type == 'token:attribute-key' && content == m:
              const nextToken = tokenList[tokenIndex + 1];
              if (nextToken && nextToken.type == 'token:attribute-assignment') {
                hookType = nodeAttributeKeyHookType;
              } else {
                hookType = nodeAttributeHookType;
              }
              break;

            case type == 'token:attribute-value':
              hookType = nodeAttributeValueHookType;
              valueTokenIndexes.push(tokenIndex);
              break;
          }

          if (dataBinding && hookType) {

            this.proxyInstance.getDataPathHooks()[path]
              .push({
                type: hookType, selector: `#${nodeId}`, canonicalPath, mustacheRef, hookInfo, transform, loc, opaque: true,
              })
          }
        });
    }

    this.onContextFinalization(() => {

      if (this.isHeadlessContext()) {
        return;
      }

      const node = document.querySelector(`#${this.getElementId()} #${nodeId}`);

      [...new Set(valueTokenIndexes)]
        .forEach(tokenIndex => {

          const { keyToken, hasWrapper } = this.getValueTokenInfo(tokenList, tokenIndex);
          const { content: attrKey } = keyToken;

          if (!hasWrapper || attrKey.match(mustacheRgx) || !this.isCompositeAttribute(node.tagName, attrKey)) {
            return;
          }

          const valueToken = tokenList[tokenIndex];

          const observer = new MutationObserver((mutations) => {

            mutations.forEach(function (mutation) {
              assert(mutation.type === 'attributes' && mutation.attributeName === attrKey)
            });

            const previousEntries = this.getRenderedValue(valueToken.content).trim().split(/\s+/g);
            const currentEntries = mutations[0].target.getAttribute(attrKey).trim().split(/\s+/g);

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
          });

          observer.observe(
            node,
            { attributes: true, attributeOldValue: true, attributeFilter: [attrKey] }
          );

          valueToken.observer = this.addToObjectRegistry(observer);
        })
    });

    this.#attributeEmitContext = null;

    const ret = definedNodeId ? '' : ` id='${nodeId}'`;

    this.getEmitContext().write(ret);

    return ret;
  }

  getValueTokenInfo(tokenList, valueTokenIndex) {

    let keyToken = tokenList[valueTokenIndex - 2];

    const valueToken = { ...tokenList[valueTokenIndex] };

    const hasWrapper = tokenList[valueTokenIndex - 1].type == 'token:attribute-value-wrapper-start';

    if (hasWrapper) {
      assert(tokenList[valueTokenIndex + 1].type == 'token:attribute-value-wrapper-end');

      keyToken = tokenList[valueTokenIndex - 3];
      valueToken.content = `\`${valueToken.content}\``;
    }

    assert(
      keyToken.type == 'token:attribute-key' && keyToken.content &&
      valueToken.type == 'token:attribute-value'
    );

    return { keyToken, valueToken, hasWrapper }
  }

  /**
   * A composite attribute is generally seen as a attribute that usually has a space-delimited
   * set of values, a notable example is the "class" attribute. For such attributes, we watch 
   * for changes made to it using the DOM API and we register it internally so that later when 
   * we need to orchestrate data binding for the attribute, the delta is also included in the 
   * attribute value. Components should feel free to override this method to return new composite
   * attributes
   */
  isCompositeAttribute(tagName, attrName) {
    return attrName == 'class';
  }

  startTextNodeBindContext() {
    const { textNodeHookType } = RootProxy;

    const id = global.clientUtils.randomString();

    if (this.dataBindingEnabled()) {
      assert(this.#currentBindContext.length === 0);

      this.#currentBindContext.push({
        type: textNodeHookType,
        selector: `#${id}`,
      });
    }

    this.getEmitContext().write(id);

    return id;
  }

  getCurrentBindContext() {
    return this.#currentBindContext.pop();
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

    const { textNodeHookType, inlineComponentHookType, dataPathRoot, pathSeparator } = RootProxy;
    const { getLine } = clientUtils;

    let { hash: { hook, transform }, loc } = options;

    const bindContext = this.getCurrentBindContext();

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

    const isTextNodeBindContext = bindContext && bindContext.type == textNodeHookType;

    if (!isTextNodeBindContext && value instanceof BaseComponent) {
      this.logger.warn(
        `[${getLine({ loc })}] Component "${value.getId()}" needs a bind context inorder to render properly`
      );
    }

    let renderedValueListener;

    switch (true) {

      case !!this.#attributeEmitContext:

        if (shouldDataBind) {
          const mustacheRef = clientUtils.randomString();

          this.mustacheStatements[mustacheRef] = {
            path, canonicalPath, transform, loc,
          }
          this.#attributeEmitContext.write(`{{${mustacheRef}}}`);

          renderedValueListener = (renderedValue) => {
            this.mustacheStatements[mustacheRef].renderedValue = renderedValue;
          }
        } else {
          renderedValueListener = (renderedValue) => {
            this.#attributeEmitContext.write(renderedValue);
          }
        }

        if (hook) {
          this.throwError(
            'Hooks cannot be used on a mustache expression that exists in an attribute context',
            loc,
          );
        }

        break;

      case isTextNodeBindContext:
        const { type, selector, inlineComponent } = bindContext;

        if (value instanceof Promise || value instanceof BaseComponent) {
          value = this.render({
            data: value,
            target: selector.replace('#', ''),
            transform,
            options,
          })

          transform = null;
        }

        const dataPathHooks = this.proxyInstance.getDataPathHooks();

        let blockData;

        if (shouldDataBind) {
          blockData = hook ? this.getBlockDataSnapshot(path) : null;

          dataPathHooks[path]
            .push({
              type, selector,
              hookMethod: hook, canonicalPath, transform, blockData, loc,
            });

        } else if (canDataBind && inlineComponent) {

          const path0 = `${dataPathRoot}${pathSeparator}${this.getExecPath({ fqPath: bindContext.canonicalPath, addBasePath: false }).path}`;

          blockData = this.getBlockDataSnapshot(path0);

          if (!dataPathHooks[path0]) {
            this.proxyInstance.createHooksArray(path0);
          }

          dataPathHooks[path0].push({
            type: inlineComponentHookType, selector,
            syntheticPath: path, ref: bindContext.ref,
            hookMethod: hook, canonicalPath: bindContext.canonicalPath, transform, blockData, loc,
          });
        }

        if (hook) {
          this.registerHook(selector, hook, 'afterMount', 0, loc, blockData);
        }

        break;
    }

    if (transform) {
      value = this[transform](value);
    }

    const renderedValue = this.toHtml(value);

    if (renderedValueListener) {
      renderedValueListener(renderedValue);
    }

    this.getEmitContext().write(renderedValue);

    return renderedValue;
  }

  getPathValue({ path, includePath = false, lenientResolution, indexResolver }) {
    // Todo: If path == '', set lenientResolution to false, because 
    // this.getInput() will always exist

    return this.resolvePath({
      fqPath: path,
      includePath,
      lenientResolution,
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

    // eslint-disable-next-line no-unused-vars
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
    const { mapKeyPrefixRegex, emptyString } = RootProxy;

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
          .replace(mapKeyPrefixRegex, emptyString);

      default:
        throw Error(`Unknown variable: ${dataVariable}`);
    }
  }

  toRealPath(path) {
    const { getDataBaseExecPath } = RootCtxRenderer;

    return this.getExecPath0({ fqPath: path, })
      .replace(`${getDataBaseExecPath()}.`, '');
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
    blockData.random = clientUtils.randomString();
  }

  // Todo: probe how this behaves post - initial rendering
  doBlockNext({ path }) {
    assert(!this.resolver);

    const { syntheticBlockKeyPrefix } = RootCtxRenderer;

    const isSynthetic = path.startsWith(syntheticBlockKeyPrefix);

    const isMap = isSynthetic ?
      this.syntheticContext[path].value.constructor.name == 'Object' :
      this.proxyInstance.getMapDefinition(
        this.toRealPath(path)
      );

    if (isMap) {

      // If this is a map, reset proxyInstance.lastLookup because

      // 1. We need .length (called by our forEach helper) to work 
      // properly on next iteration. Unlike the array proxy 
      // knows the length because it is an inherent property 
      // of the backing array, the object proxy relies on the
      // last lookup value to determine the value of the "length" 
      // property. This is the reason, we need to set the last lookup
      // at the end of each iteration

      // 2. Calling value[i] in forEach(...) helper can work 
      // properly, because in the proxy we depend on the last lookup
      // value to be able to set the "current" value of the 
      // synthetic context

      const value = isSynthetic ?
        this.syntheticContext[path].proxyValue :
        this.getPathValue({ path });

      this.proxyInstance.setLastLookup(value);
    }
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

    // Todo: Before throwing error, send error to server

    throw Error(`[${loc ? `${getLine({ loc })}` : this.getId()}] ${msg}`);
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

    // We need to store the object proxy created above as <proxyValue>
    // Note: This will be needed in doBlockNext(...) when we need to reset the last lookup value
    this.syntheticContext[alias].proxyValue = value;

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

  toSyntheticCachedName(name) {
    const { cachedNameSuffix } = RootCtxRenderer;
    return `${name}${cachedNameSuffix}`;
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
    assert(this.isSyntheticMethodName(name));

    const name0 = this.toSyntheticCachedName(name);
    const cache = this.#syntheticCache[this.#syntheticCache.length - 1];

    if (cache[name] === undefined) {

      cache[name] = Function(
        `return ${this.createInvocationString0(name)}`
      ).bind(this)();

      this[name0] = Function(
        `return this.getCachedSyntheticMethodValue("${name}")`
      ).bind(this);
    }

    return this.createInvocationString0(name0);
  }

  createInvocationString0(name) {
    return `this.${name}()`;
  }

  getCachedSyntheticMethodValue(name) {
    const cache = this.#syntheticCache[this.#syntheticCache.length - 1];
    return cache[name];
  }

  isSyntheticMethodInvocation(name) {
    const { syntheticMethodPrefix } = RootProxy;
    // eslint-disable-next-line no-undef
    return name.startsWith(`this.${syntheticMethodPrefix}`)
  }

  // eslint-disable-next-line class-methods-use-this
  isSyntheticMethodName(name) {
    // eslint-disable-next-line no-undef
    return name && name.startsWith(RootProxy.syntheticMethodPrefix);
  }

  getSyntheticMethod({
    name,
  }) {
    // eslint-disable-next-line no-undef
    const f = this[`${RootProxy.syntheticMethodPrefix}${name}`];
    return f ? f.bind(this) : null;
  }

  static getDataBaseExecPath() {
    return 'this.getInput()';
  }

  static getGlobalsBaseExecPath() {
    return `this.getRootGlobals()`;
  }

  getGlobalsExecPath(fqPath) {
    const { globalsBasePath, pathSeparator } = RootProxy;
    const { getGlobalsBaseExecPath } = RootCtxRenderer;

    const arr = fqPath.split(pathSeparator);

    assert(arr[0] == globalsBasePath);
    arr[0] = getGlobalsBaseExecPath();

    // eslint-disable-next-line no-eval
    return arr.join('.');
  }

  static getExecStringFromValue(value) {
    switch (true) {
      case value == null:
      case value === undefined:
      case value.constructor.name == 'Number':
      case value.constructor.name == 'Boolean':
        return value;
      case value.constructor.name == 'String':
        return `"${value}"`;
      case value instanceof BaseComponent:
        return clientUtils.stringifyComponentData(value.toJSON());
      case value === Object(value):
        return JSON.stringify(value);
      default:
        throw Error(`Unknown value: ${value}`);
    }
  }

  getExecPath({ fqPath, indexResolver, addBasePath, allowSynthetic }) {
    const result = {
      execPath: this.getExecPath0({
        fqPath,
        indexResolver,
        addBasePath,
        allowSynthetic
      }),
      path: null,
    };

    result.path =
      this.isSyntheticMethodInvocation(result.execPath)
        && !this.isSyntheticMethodName(fqPath)
        ?
        // We need a non-invocation path to use in <result.path>
        this.getExecPath0({
          fqPath,
          indexResolver,
          addBasePath,
          allowSynthetic: false,
        })
        : result.execPath;

    return result;
  }

  getExecPath0({ fqPath, indexResolver, addBasePath = true, allowSynthetic = true }) {

    const {
      pathSeparator, syntheticMethodPrefix, globalsBasePath, getDataVariables, isMapProperty
    } = RootProxy;
    const {
      toObject, getDataBaseExecPath, getExecStringFromValue, getSyntheticAliasFromChildPath
    } = RootCtxRenderer;
    const { arrayIndexSegment, mapKeySegment, getSegments0, randomString } = clientUtils;

    if (fqPath === '') {
      return getDataBaseExecPath();
    }

    assert(fqPath != globalsBasePath);

    if (fqPath.startsWith(`${globalsBasePath}${pathSeparator}`)) {
      return this.getGlobalsExecPath(fqPath);
    }

    if (!indexResolver) {
      // eslint-disable-next-line no-param-reassign
      indexResolver = path => this.blockData[path].index;
    }

    if (this.isSyntheticMethodName(fqPath) || this.resolver) {
      addBasePath = false;
    }

    const basePath = addBasePath ? getDataBaseExecPath() : '';

    const segments = fqPath.split(pathSeparator);
    const parts = [];

    if (basePath.length) {
      parts.push(basePath);
    }


    const joinParts = () => parts
      .map((part, index) => {

        switch (true) {
          case this.isSyntheticMethodName(part):
            assert(index == 0);
            // Note: If there are index segments, e.g. s$_abcd[0], we want to ensure that 
            // those are not affected
            const [first] = part.match(/s\$_\w+/g);

            return part.replace(
              first, this.createInvocationString(first)
            );

          default:
            return index == 0 ? part : `.${part}`;
        }
      })
      .join('');

    const resolveValue = (path) => {
      const value = this.#resolvePath0({
        path: `${!this.resolver && !this.isSyntheticMethodInvocation(path) && !addBasePath ?
          `${getDataBaseExecPath()}.` : ''
          }${path}`
      });
      return value;
    };

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < segments.length; i++) {
      let part = segments[i];

      // This is necessary if we have a part like: x_$[0]
      const partSegments = getSegments0(part, arrayIndexSegment);
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

        const path = this.getExecPath0({
          fqPath: canonicalPath,
          indexResolver,
          addBasePath,
        });

        // if path ends with w.x.$_abc, part should be x.$_abc, not $_abc,
        // because $_abc should be translated as the index placeholder: _$
        part = path.split(/\.(?!\$_)/g).pop();

        let value = resolveValue(path);

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
            throw Error(`Unknown path: ${path.replace(`${basePath}.`, '')}`);
        }

      } else if (part.endsWith('_@')) {
        [part] = part.split('_@');
      }


      if (suffix.length) {
        part += suffix;
      }


      if (allowSynthetic && part.startsWith('@')) {

        const dataVariable = part;

        assert(getDataVariables().includes(dataVariable));
        assert(i > 0 && i == segments.length - 1);

        const path = [...addBasePath ? parts.slice(1) : parts].join('.');

        const isArray = !!path.match(RegExp(`${arrayIndexSegment.source}$`));
        const isMap = !!path.match(
          this.resolver ? /\.\$_\w+$/ : RegExp(`${mapKeySegment.source}$`)
        );

        assert(isArray || isMap);

        const value = (() => {

          if (this.isSyntheticMethodName(fqPath)) {

            assert(parts.length == 1);

            const blockKey = getSyntheticAliasFromChildPath(parts[0]);

            return this.getBlockData({
              path: blockKey, dataVariable,
            })

          } else {

            if (this.resolver && isArray) {
              // Since we are resolving to a synthetic method name there is a possibility that the developer 
              // never accesses {{.}} inside the #each block, thereby causing the PathResolver to throw a 
              // "redundant path" error for <path>. Hence, we need to at least access index 0 at compile-time

              // Note: <path> will be evaluated by getInfoFromPath(...) below, so this may not be necessary
              // however leave this code here
              this.resolver.resolve({ path })
            }

            const { value } = this.proxyInstance.getInfoFromPath(
              `${path}.${dataVariable}`
            );

            return value;
          }
        })();

        (() => {
          switch (dataVariable) {
            case '@first':
            case '@last':
              assert(typeof value == 'boolean');
              break;
            case '@key':
            case '@random':
              assert(typeof value == 'string' && value.length);
              break;
            case '@index':
              assert(typeof value == 'number' && value >= 0);
              break;
          }
        })();

        const syntheticMethodName = `${syntheticMethodPrefix}${randomString()}`;

        this[syntheticMethodName] = Function(`return ${getExecStringFromValue(value)}`);

        // <syntheticMethodName> is a temporarily function used to get the value, prune later
        this.onContextFinalization(() => {
          delete this[syntheticMethodName];
        });

        return this.createInvocationString(syntheticMethodName);
      }

      parts.push(part);
    }

    return joinParts();
  }

  resolvePath({ fqPath, indexResolver, create, includePath, lenientResolution, stmt }) {

    const arr = fqPath.split('%');
    let { path, execPath } = this.getExecPath({
      fqPath: arr[0],
      indexResolver,
    });

    if (this.isSyntheticMethodInvocation(path)) {
      const value = this.evaluateGetterExpression(path);

      return includePath ? {
        path: this.getMethodNameFromInvocationString(path),
        value
      } : value;
    }

    // In some case cases, data paths can resolve to a synthetic method invocation, i.e. when resolving data variables,
    // hence we need to eagerly evaluate the <execPath> it inorder to derive a <valueOverride>
    const valueOverride = this.isSyntheticMethodInvocation(execPath) ? this.evalPath(execPath, lenientResolution) : undefined;

    return this.#resolvePath0({
      path, valueOverride, create, includePath, lenientResolution, stmt,
      canonicalPath: arr[0], type: arr[1],
    });
  }

  static wrapExecStringForLeniency(execString, noOpValue) {
    const { getExecStringFromValue } = RootCtxRenderer;

    return `this.evalPathLeniently(\`${execString}\`, ${getExecStringFromValue(noOpValue)})`;
  }

  static toBindPath(path) {
    const { dataPathRoot, pathSeparator, globalsBasePath } = RootProxy;
    const { escapeRegExp } = clientUtils;
    const { getDataBaseExecPath, getGlobalsBaseExecPath } = RootCtxRenderer;

    // Note: <lenientPrefix> is based on wrapExecStringForLeniency(...)
    const lenientPrefix = 'this.evalPathLeniently(`';

    if (path.startsWith(lenientPrefix)) {
      path = path.replace(lenientPrefix, '').replace(/`\)$/g, '')
    }

    let prefix = getDataBaseExecPath();
    let repl = '';

    if (path.startsWith(getGlobalsBaseExecPath())) {
      prefix = getGlobalsBaseExecPath();
      repl = `${globalsBasePath}${pathSeparator}`;
    }

    path = path.replace(
      RegExp(`${escapeRegExp(prefix)}\\.?`),
      repl
    );

    return `${dataPathRoot}${pathSeparator}${path}`;
  }

  evaluateGetterExpression(execString, scope) {
    return this.evaluateExpression(`return ${execString};`, scope);
  }

  /**
   * 
   * Note: This method name is a hardcoded string in RootProxy.toExecutablePath(...) and maybe in other places. 
   * If this method name is updated, look for references and update those as well
   * 
   * @param {string} execPath 
   * @param {any} undefinedVal 
   * @returns 
   */
  evalPathLeniently(execPath, undefinedVal, scope) {
    const { lenientExceptionMsgPattern } = RootProxy;
    try {
      return this.evaluateGetterExpression(execPath, scope);
    } catch (e) {
      if (e.name == 'TypeError' && e.message.match(lenientExceptionMsgPattern)) {
        return undefinedVal;
      } else {
        throw e;
      }
    }
  }

  evalPath(execPath, lenient, loc, scope = {}) {
    const { getGlobalsBaseExecPath } = RootCtxRenderer;

    if (lenient || execPath.startsWith(getGlobalsBaseExecPath())) {
      return this.evalPathLeniently(execPath, undefined, scope);
    }

    try {
      return this.evaluateGetterExpression(execPath, scope);
    } catch (e) {
      if (this.resolver) {
        throw e;
      } else {
        this.throwError(
          `Exception thrown while executing "${execPath}": ${e.message}`,
          loc,
        );
      }
    }
  }

  #resolvePath0({
    path, valueOverride, create, includePath, canonicalPath, type, lenientResolution, stmt,
  }) {

    const { getDataBaseExecPath, getGlobalsBaseExecPath, toBindPath } = RootCtxRenderer;

    const isSynthetic = this.isSyntheticMethodInvocation(path);

    const value = valueOverride !== undefined ?
      valueOverride :
      this.resolver && !isSynthetic ?
        this.resolver.resolve({ path: `${path}${type ? `%${type}` : ''}`, create, stmt })
        // eslint-disable-next-line no-eval
        : this.evalPath(path, lenientResolution);

    if (isSynthetic) {
      // This is a synthetic invocation, i.e. this.s$AbCdEf().a.b...
      assert(!includePath);

      return value;
    } else {

      assert(
        this.resolver ||
        path.startsWith(getDataBaseExecPath()) ||
        path.startsWith(getGlobalsBaseExecPath())
      );

      return includePath ? {
        path: toBindPath(path),
        value,
        canonicalPath,
      } : value;
    }
  }

  // eslint-disable-next-line class-methods-use-this
  getRootGlobals() {
    return this.getGlobalVariables();
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

    let input;

    for (const [key, value] of Object.entries(hash)) {
      if (value === undefined) {
        continue;
      }

      if (!input) {
        input = inputProducer();
      }

      const scope = { i: input, v: value };
      const getter = `i.${key}`;
      const setter = `${getter} = v`;

      /**
       * The idea here is that if the getter can execute successfully,
       * the setter can do so as well
       */
      const shouldSet = () => {
        try {
          this.evaluateExpression(getter, scope)
          return true;
        } catch (e) {
          return false;
        }
      }
      if (shouldSet()) {
        this.evaluateExpression(setter, scope)
      }
    }

    return {
      input, handlers, config,
    }
  }

  createComponent({ hash, componentClass }) {

    const { input = {}, handlers, config } = this.buildInputData({ hash });

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

  addEventHandlers({ handlersObject = {}, handlers = {}, component }) {

    Object.entries(handlersObject)
      .forEach(([k, v]) => {
        v.forEach(fn => {
          component.on(k, fn.bind(component));
        })
      });

    Object.entries(handlers)
      .forEach(([evtName, handler]) => {

        if (typeof handler != 'string') {
          // We don't understand what <handler> is
          return;
        }

        if (handler.startsWith(`${RootCtxRenderer.#helpersNamespace}.`)) {

          component.on(evtName, () => {
            this.evaluateExpression(handler);
          });

        } else {
          const fn = this[handler];

          if (!fn || !fn instanceof Function) {
            this.throwError(`Unknown event handler: ${handler}`);
          }

          component.on(evtName, fn.bind(this));
        }
      });
  }

  cloneComponent({ componentSpec, hash = {}, forceClone = true }) {
    const { cloneInputData } = BaseComponent;

    assert(componentSpec instanceof BaseComponent);

    const inputProducer = () => cloneInputData(componentSpec.getInput());

    const { handlers, config, input } = this.buildInputData({
      inputProducer, hash,
    });

    let component;

    if (input || config || handlers || componentSpec.getInternalMeta().loaded || forceClone) {

      component = new componentSpec.constructor({
        input: input || inputProducer(),
        config,
      });

      this.addEventHandlers({
        handlersObject: componentSpec.getHandlers(), component,
      });

    } else {

      // We don't have to clone the component
      component = componentSpec;
      component.getInternalMeta().loaded = true;
    }

    this.addEventHandlers({ handlers, component });

    return component;
  }

  // eslint-disable-next-line class-methods-use-this
  loadInlineComponent() {

    const { dataPathPrefix, textNodeHookType } = RootProxy;

    // eslint-disable-next-line prefer-rest-params
    const params = Array.from(arguments);
    const options = params.pop();

    const [componentSpec] = params;
    const { loc, hash } = options;

    const { ref, inlineComponent, path } = hash;

    delete hash.ctx;

    delete hash.ref;
    delete hash.inlineComponent;
    delete hash.path;

    delete hash.hook;

    const [bindContext] = this.#currentBindContext;

    if (inlineComponent && bindContext) {
      // Update the current bind context if necessary, for data-binding purpose
      assert(bindContext.type == textNodeHookType);

      bindContext.inlineComponent = true;
      bindContext.canonicalPath = path.replace(dataPathPrefix, '');
      bindContext.ref = ref;
    }

    return this.getPromise()
      .then(() => {

        let component;

        switch (true) {
          case componentSpec && componentSpec.constructor.name === 'String':

            const componentClass = components[componentSpec];

            if (componentClass && componentClass.prototype instanceof BaseComponent) {
              component = this.createComponent({
                hash,
                componentClass,
              });
            }

            break;

          case componentSpec && componentSpec instanceof BaseComponent:
            component = this.cloneComponent({ componentSpec, hash, forceClone: false });
            break;

          case componentSpec === null:
            // If null, set to undefined so that BaseComponent.render(...) will render an empty string
            return undefined;
        }

        if (!component) {
          this.throwError(`Unknown target specified in PartialStatement`, loc);
        }

        this.#registerInlineComponent(ref, component);

        return component;
      });
  }

  #registerInlineComponent(ref, component) {
    if (ref) {
      this.#inlineComponentInstances[ref] = component;

      this.dispatchEvent(`inlineComponentInit-${ref}`);

      component.on('destroy', () => {
        delete this.#inlineComponentInstances[ref];
      })
    }

    component.setInlineParent(this);
  }

  onceInlineComponentLoad(ref, fn) {
    this.once(() => {
      fn();
    }, `inlineComponentInit-${ref}`)
  }

  getInlineComponent(ref) {
    return this.#inlineComponentInstances[ref];
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

  /**
   * These are boolean operators that the component wants to exclusively 
   * implement, rather than combine with the parents to form a list of 
   * predicates
   */
  overridenBooleanOperators() {
    return [];
  }

  getBooleanOperators() {
    const overridenOperators = this.overridenBooleanOperators();
    const o = {};

    this.recursivelyInvokeMethod('booleanOperators').forEach(r => {
      Object.entries(r)
        .forEach(([key, value]) => {
          assert(value instanceof Function);

          if (!o[key]) {
            o[key] = [];
          }

          o[key].push(value);
        });
    });

    Object.entries(this.booleanOperators())
      .filter(([key]) => overridenOperators.includes(key))
      .forEach(([key, value]) => {
        o[key] = [value]
      });

    return o;
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
    return fn ? fn() : [];
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

  getInitializers() {
    const initializers = {};

    this.recursivelyInvokeMethod('initializers').forEach(r => {
      Object.entries(r)
        .forEach(([key, value]) => {
          assert(value instanceof Function);

          if (!initializers[key]) {
            initializers[key] = [];
          }

          initializers[key].push(value);
        });
    })

    return initializers;
  }

  getHooks() {
    const hooks = {};

    this.recursivelyInvokeMethod('hooks').forEach(r => {
      Object.entries(r)
        .forEach(([key, value]) => {
          assert(value instanceof Function);

          if (!hooks[key]) {
            hooks[key] = [];
          }

          hooks[key].push(value);
        });
    })

    return hooks;
  }

  getAssetId() {
    return this.getSyntheticMethod({ name: 'assetId' })();
  }

  getHelpers() {
    return this.getSyntheticMethod({ name: 'helpers' })();
  }

  getLogicGates() {
    return this.getSyntheticMethod({ name: 'logicGates' })();
  }

  dataBindingEnabled() {
    return this.getSyntheticMethod({ name: 'enableDataBinding' })();
  }

  getGlobalHelpers() {
    return this.getSyntheticMethod({ name: 'globalHelpers' })();
  }

  static {

    if (global.MutationObserver) {
      new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
            for (const removedNode of mutation.removedNodes) {
              if (!(removedNode instanceof Element)) {
                continue;
              }
              const componentId = removedNode.getAttribute('__component');

              if (componentId) {
                // Wait for some moments to see if node is re-connected to the DOM
                setTimeout(() => {
                  if (!document.querySelector(`[__component='${componentId}']`)) {
                    const component = BaseRenderer.getAllComponents()[componentId];

                    if (component) {
                      component.destroy();
                    }
                  }
                }, this.nodePruneTimeout)
              }
            }
          }
        }
      }).observe(document.body, { childList: true, subtree: true });
    }

  }
}
module.exports = RootCtxRenderer;
