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

  static htmlWrapperCssClassname = 'mst-w';

  static #defaultHookOrder = 100;

  static cachedNameSuffix = '_cached';

  static #token;

  #currentBindContext;

  #attributeEmitContext;

  #inlineComponentInstances;

  #syntheticCache;

  #fnStore;

  #handlebars;

  #handlebarsOptions;

  #promise;

  #resolve;

  #rendered;

  #emitContext;

  constructor({
    id, input, logger,
  } = {}) {
    super({
      id, input, logger,
    });

    this.blockData = {};

    this.syntheticContext = {};

    this.#promise = new Promise((resolve) => {
      this.#resolve = resolve;
    });

    this.futures = [];

    this.renderOffset = 0;

    this.syntheticNodeId = [];
    this.#currentBindContext = [];

    this.hooks = {};

    this.#inlineComponentInstances = {};
    this.#syntheticCache = {};
    this.#fnStore = {};

    this.mustacheStatements = {};
  }

  getPromise() {
    return this.#promise;
  }

  isMounted() {
    return !!document.querySelector(`#${this.getElementId()}`);
  }

  static setToken(token) {
    if (RootCtxRenderer.#token) {
      throw Error(`Could not set token: ${token}`);
    }
    RootCtxRenderer.#token = token;
  }

  getEmitContext() {
    if (!this.#emitContext) {
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

  getTransformFunctionList(transformName) {
    return transformName.split(/,\s*/g).map(n => this[n].bind(this));
  }

  finalizeTokenizationContext({ transform, initial } = {}) {

    const { ast } = hyntax.constructTree(this.#emitContext.tokenList);

    if (transform) {
      this.getTransformFunctionList(transform)
        .forEach(fn => fn({ node: ast, initial }))
    }

    const ret = {
      htmlString: this.stringifyHtmlAst({ ast, initial }),
    };

    this.#emitContext = null;

    return ret;
  }

  registerTransform(nodeId, methodName) {
    this.getEmitContext().transforms[nodeId] = methodName;
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

  renderDecorator({ program }) {

    const fn = () => this.#handlebars.template(program)(
      this.rootProxy, this.#handlebarsOptions,
    );

    if (this.#emitContext) {
      // A tokenization context exists - so this was likely called by handlebars.VM.invokePartial 
      // to resolve a partial
      return fn();
    } else {
      this.startTokenizationContext();
      fn();
      const { htmlString } = this.finalizeTokenizationContext({ initial: true });
      return htmlString;
    }
  }

  isLoadable0() {
    return this.getConfig().loadable;
  }

  isLoadable() {
    return this.isLoadable0();
  }

  stringifyHtmlAst({ ast, initial }) {
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

        const transform = this.getEmitContext().transforms[nodeId];

        if (transform) {
          this.getTransformFunctionList(transform)
            .forEach(fn => fn({ node, initial }))
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

  async getRenderedHtml({ token }) {
    const { getMetaHelpers } = RootCtxRenderer;

    if (token !== RootCtxRenderer.#token && !this.isRoot()) {
      throw Error(`Invalid token: ${token}`);
    }

    if (this.#rendered) {
      throw Error(`${this.getId()} is already rendered`);
    }

    await this.invokeLifeCycleMethod('beforeMount');

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

    // Expose global helpers as global functions, using obfuscated names
    const functionNames = {};
    const noOpHelper = 'noOp';

    const __helpers = window.__helpers || (window.__helpers = {});

    for (const helperName of this.getGlobalHelpers()) {
      let helperFn = componentHelpers[helperName];

      if (!helperFn) {
        helperFn = this[helperName].bind(this);
      }

      const id = clientUtils.randomString();

      functionNames[helperName] = id;
      __helpers[id] = helperFn;
    }

    if (!__helpers[noOpHelper]) {
      __helpers[noOpHelper] = () => { }
    }

    // Add fn helper
    helpers.fn = (helperName) => {
      return `__helpers.${functionNames[helperName] || noOpHelper}`;
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

    // eslint-disable-next-line no-undef
    this.#handlebars.template(template)(
      {
        data: this.rootProxy,
      },
      this.#handlebarsOptions,
    );

    const { htmlString } = this.finalizeTokenizationContext({ initial: true });

    assert(this.syntheticNodeId.length == 0);

    this.#rendered = true;

    return htmlString;
  }

  async load({ container, token, html }) {

    const { htmlWrapperCssClassname } = RootCtxRenderer;

    if (this.isMounted()) {
      throw Error(`${this.getId()} is already mounted`);
    }

    if (token !== RootCtxRenderer.#token && !this.isRoot()) {
      throw Error(`Invalid token: ${token}`);
    }

    await this.invokeLifeCycleMethod('beforeLoad');

    if (!this.isLoadable()) {
      return { id: this.getId(), html: '' };
    }

    super.load();

    if (!html) {
      html = await this.getRenderedHtml({ token });
    }

    const parentNode = container ? document.getElementById(container) : document.body;

    // We require that the <parentNode> is a live element, present om the DOM
    assert(parentNode != null, `DOMElement #${container} does not exist`);

    this.node = document.createElement('div');

    this.node.id = this.getElementId();
    this.node.classList.add(htmlWrapperCssClassname);
    this.node.innerHTML = html;

    parentNode.appendChild(this.node);


    if (!this.isHeadlessContext()) {
      // Todo: Investigate why this MutationObserver's callback is not called when <parentNode> is mutated
      // ?? Verify if the above issue still happens

      new MutationObserver((mutations) => {
        // Inline components can have their node removed from the DOM at any time - whether programatically by the dev
        // or as a result of data bind mutations. If this 
        const isDetached = mutations.some((mutation) => {
          return [...mutation.removedNodes || []].indexOf(this.node) !== -1;
        });
        if (isDetached) {
          // Wait for a few seonds to see if the elements is re-connected to the DOM
          setTimeout(() => {
            if (!this.node.parentNode) {
              this.destroy();
            }
          }, 5000)
        }
      }).observe(this.node.parentNode, { childList: true, });
    }

    this.#resolve();

    return this.#promise

      // Even after all promises are resolved, we need to wait for this component to be fully mounted. This is
      // especially important if there async custom blocks or sub-components inside this component or arbitrary
      // functions that need to be called during finalize phase

      .then(() => Promise.all(this.futures.map(f => typeof f == 'function' ? f() : f)))

      .then(() => {

        const finalize = async () => {

          if (this.getComponentName() == 'ActivityTimeline') {
          }

          this.pruneSyntheticCache();

          // Trigger hooks
          const hookKeys = Object.keys(this.hooks)
            .sort((e1, e2) => {

              const o1 = this.hooks[e1].order;
              const o2 = this.hooks[e2].order;

              return o1 < o2 ? -1 : o2 < o1 ? 1 : 0;
            });

          const hooks = hookKeys
            .map(selector => {
              const { hookName, blockData } = this.hooks[selector];

              const hook = this[hookName].bind(this);
              const node = document.querySelector(`#${this.getId()} ${selector}`);

              assert(hook);

              if (!node) {
                // Node could not be found - It's likely that a transform (outer/inner) removed it 
                // from the html ast
                return false;
              }

              return hook({
                selector,
                node,
                blockData,
                // This indicates that this hook is triggered just before this component
                // is fully mounted, as opposed to on data update
                initial: true,
              });
            })
            .filter(h => h);

          await Promise.all(hooks);

          await this.invokeLifeCycleMethod('onMount');


          // As a general contract, we expect developers to update the futures object 
          // with any extra promises, including the loading of sub components. hence
          // we need to await futures again, in case it was updated by any of the hooks
          await Promise.all(this.futures);

          this.triggerNodeUpdateEvent(this.node);

          self.appContext.components[this.getId()] = this;

          return { id: this.getId(), html: this.node.outerHTML };
        }

        if (this.renderOffset === 0) {
          return finalize()
        } else {

          return new Promise((resolve) => {
            const intervalId = setInterval(() => {
              if (this.renderOffset === 0) {
                clearInterval(intervalId);

                resolve(finalize());
              }
            }, 10);
          })
        }

      });
  }

  getElementId() {
    return this.getId();
  }

  pruneSyntheticCache() {
    for (const k in this.#syntheticCache) {
      const name0 = this.toSyntheticCachedName(k);
      assert(this[name0] instanceof Function);

      delete this[name0];
      delete this.#syntheticCache[k];
    }
  }

  async invokeLifeCycleMethod(name, ...args) {
    const methods = this.recursivelyGetMethods(name);
    for (const fn of methods) {
      await fn(...args)
    }
  }

  recursivelyInvokeMethod(names, ...args) {
    return this.recursivelyGetMethods(names).map(fn => fn(...args))
  }

  recursivelyGetMethods(names) {
    const methods = [];

    let component = this;

    while ((component = Reflect.getPrototypeOf(component))
      // eslint-disable-next-line no-undef
      && component.constructor.name !== BaseRenderer.name
    ) {

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

    Object.entries(hash).forEach(([k, v]) => {
      const contextId = hash[`${contextIdHashKeyPrefix}${k}`];
      data[contextId] = v;
    });

    return '';
  }

  conditional({ options, ctx, params }) {

    const { conditionalBlockHookType } = RootProxy;

    const { fn, inverse, hash, loc } = {
      ...options,
      fn: this.wrapFn(options.fn),
      inverse: this.wrapFn(options.inverse),
    };

    const { hook, hookOrder, outerTransform, innerTransform } = hash;

    const nodeId = this.getSyntheticNodeId();

    let [target, invert] = params;

    if (Object(target) !== target) {
      // <target> resolved to a literal
      target = { value: target };
    }

    const { path, value, canonicalPath } = target;

    const isSynthetic = this.isSynthetic(path);

    const dataBinding =
      // Todo: Support data-binding for synthetic invocations
      !isSynthetic &&
      this.dataBindingEnabled() && nodeId &&
      // Disable for literals and components
      !!path && !(value instanceof BaseComponent);

    const conditional0 = (value) => {

      if (hook) {
        assert(nodeId);

        this.hooks[`#${nodeId}`] = {
          hookName: hook,
          order: hookOrder != undefined ? hookOrder : this.getDefaultHookOrder(),
          blockData: clientUtils.deepClone(this.blockData)
        };
      }

      if (outerTransform) {
        assert(nodeId);

        this.registerTransform(nodeId, outerTransform);
      }

      const b = this.analyzeConditionValue(value);
      let branch;

      const markup = (() => {
        let func;

        if (invert ? !b : b) {

          branch = 'fn';
          func = this.lookupFnStore(fn);

        } else if (inverse) {

          branch = 'inverse';
          func = this.lookupFnStore(inverse);
        }

        this.getEmitContext().blockStack.push(path);

        const markup = func(ctx);

        this.getEmitContext().blockStack.pop();

        this.getEmitContext().write(markup);

        return markup;
      })();


      if (nodeId) {
        this.onNodeUpdateEvent(() => {

          document.querySelector(`#${this.getElementId()} #${nodeId}`)
            .setAttribute('branch', branch);

        }, [this.isMounted() ? `#${nodeId}` : `#${this.getElementId()}`]);
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
          fn, inverse, hookMethod: hook, invert,
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

  getColElementWrapperHeader(id, key) {
    const { htmlWrapperCssClassname } = RootCtxRenderer;
    return `<div id="${id}" class="${htmlWrapperCssClassname}" key="${key}">`;
  }

  getColElementWrapperFooter() {
    return '</div>';
  }

  forEach({ options, ctx, params }) {

    const { eachBlockHookType, predicateHookType, toFqPath, isNullProperty } = RootProxy;
    const { getSyntheticAliasFromPath } = RootCtxRenderer;

    const { fn, inverse, hash, loc } = {
      ...options,
      fn: this.wrapFn(options.fn),
      inverse: this.wrapFn(options.inverse),
    };

    const { hook, hookOrder, innerTransform, outerTransform, predicate } = hash;

    const [{ path, value, canonicalPath }] = params;

    const nodeId = this.getSyntheticNodeId();

    const isSynthetic = this.isSynthetic(path);
    const dataBinding = !isSynthetic && this.dataBindingEnabled() && nodeId;

    const forEach0 = (value) => {

      if (outerTransform) {
        assert(nodeId);

        this.registerTransform(nodeId, outerTransform);
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

          if (dataBinding && predicate) {

            this.proxyInstance.getDataPathHooks()[p]
              .push({
                type: predicateHookType, selector: `#${currentWrapperNodeId}`,
                fn, predicate, hookMethod: hook, innerTransform,
                blockData: this.getBlockDataSnapshot(p),
                canonicalPath: `${canonicalPath}_$`,
              });
          }

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

          this.getEmitContext().blockStack.push(path);

          const currentValue = rawValue[key];

          const isNull = currentValue === null || currentValue[isNullProperty] || (predicate ? !this[predicate].bind(this)(currentValue) : false);

          let markup = isNull ?
            // null collection members are always represented as an empty strings
            (() => {
              this.blockData[blockKey].index++;
              return '';
            })() :
            this.lookupFnStore(fn)(this.rootProxy);


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

          this.pruneSyntheticCache();

          if (hook) {
            assert(nodeId);

            this.hooks[`#${nodeId} > #${currentWrapperNodeId}[key='${key}']`] = {
              hookName: hook,
              order: hookOrder != undefined ? hookOrder : this.getDefaultHookOrder(),
              blockData: clientUtils.deepClone(this.blockData),
            };
          }

          ret += markup;
        }

        return ret;

      } else if (inverse) {

        return this.lookupFnStore(inverse)(ctx);
      }
    }

    if (dataBinding) {

      this.proxyInstance.getDataPathHooks()[path]
        .push({
          type: eachBlockHookType, selector: `#${nodeId}`,
          fn, inverse, hookMethod: hook,
          blockData: this.getBlockDataSnapshot(path),
          canonicalPath, loc, innerTransform,
        });
    }

    const html = forEach0(value);

    if (this.#attributeEmitContext) {
      assert(!nodeId);
      this.#attributeEmitContext.write(html);
    }

    return html;
  }

  lookupFnStore(id) {

    const { wrapFnWithExceptionCatching } = RootCtxRenderer;
    return wrapFnWithExceptionCatching(this.#fnStore[id]);
  }

  wrapFn(fn) {
    assert(fn);

    const id = clientUtils.randomString();
    this.#fnStore[id] = fn;
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
    const { syntheticMethodPrefix } = RootProxy;
    const { syntheticBlockKeyPrefix } = RootCtxRenderer;

    return `${syntheticBlockKeyPrefix}${path.replace(syntheticMethodPrefix, '')}`;
  }

  static getBlockNameFromSyntheticAlias(syntheticAlias) {
    const { syntheticAliasSeparator } = RootCtxRenderer;
    return syntheticAlias.split(syntheticAliasSeparator)[0];
  }

  static getChildPathFromPath(path) {
    return `${path}_child`;
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

  getBlockDataSnapshot(path) {

    const {
      dataPathRoot, pathSeparator, arrayChildBlockHookType, syntheticBlockKeyPrefix
    } = RootProxy;

    // We first need to find the closest non-synthetic array-based blockData, and
    // register <path> as a arrayChildBlock. That way, when the current
    // array index moves, we can update the blockData captured for this path

    // In ES-2015+, insertion order is preserved, so we know the
    // last index is the most recent, and vice-versa

    const blockDataKeys = Object.keys(this.blockData)
      // If this is called by forEach(...), we need to skip the blockData entry created
      // in doBlockInit(...)
      .filter(k => this.blockData[k].index >= 0);

    const dataPathHooks = this.proxyInstance.getDataPathHooks();

    for (let i = blockDataKeys.length - 1; i >= 0; i--) {
      const k = blockDataKeys[i];
      const { type, index } = this.blockData[k];

      if (type == 'array' && !k.startsWith(syntheticBlockKeyPrefix)) {

        const p0 = this.getExecPath0({
          fqPath: `${k}[${index}]`,
          addBasePath: false,
        });

        const p = `${dataPathRoot}${pathSeparator}${p0}`;

        const hookList = dataPathHooks[p] || this.proxyInstance.createHooksArray(p);

        // Add hook, only if it does not already exist
        if (
          !hookList.filter(({ type, path: p }) =>
            type == arrayChildBlockHookType && p == path)
            .length
        ) {
          hookList.push({
            type: arrayChildBlockHookType, path,
            // <selector> will be backfilled by backfillArrayChildBlocks(...) on iteration
            selector: null,
            canonicalPath: `${k}_$`,
            blockDataKey: k,
          });
        }
        break;
      }
    }

    // Then, clone and return blockData
    return clientUtils.deepClone(this.blockData);
  }

  static getMetaHelpers() {
    return [
      'storeContext', 'loadContext', 'forEach', 'conditional', 'startAttributeBindContext',
      'endAttributeBindContext', 'startTextNodeBindContext', 'setSyntheticNodeId', 'resolveMustacheInRoot',
      'resolveMustacheInCustom', 'c', 'var'
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
            `Unknown value "${valueToken ? valueToken.content : "<empty>"}" was assigned to the "id" attribute`, loc
          );
        }

        return this.getRenderedValue(valueToken.content);
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

    for (let tokenIndex = 0; tokenIndex < tokenList.length; tokenIndex++) {
      let { type, content } = tokenList[tokenIndex];

      (content.match(/{{\w+}}/g) || [])
        .forEach(m => {

          const mustacheRef = m.replace(/({{)|(}})/g, '');

          const mustacheInfo = this.mustacheStatements[mustacheRef];

          if (!mustacheInfo) {
            return;
          }

          const { path, canonicalPath, transform, loc } = mustacheInfo;

          const isSynthetic = this.isSynthetic(path);

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

    this.#attributeEmitContext = null;

    const ret = definedNodeId ? '' : ` id='${nodeId}'`;

    this.getEmitContext().write(ret);

    return ret;
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

    const { textNodeHookType } = RootProxy;
    const { getLine } = clientUtils;

    let { hash: { hook, hookOrder, transform }, loc } = options;

    const bindContext = this.getCurrentBindContext();

    let [target] = params;

    if (Object(target) !== target) {

      // <target> resolved to a literal
      target = { value: target };
    }

    let { path, value, canonicalPath } = target;

    const isSynthetic = this.isSynthetic(path);

    // Todo: Support data-binding for synthetic invocations
    const dataBinding = !isSynthetic && this.dataBindingEnabled() &&
      // Disable for literals
      !!path;

    const isTextNodeBindContext = bindContext && bindContext.type == textNodeHookType;

    if (!isTextNodeBindContext && value instanceof BaseComponent) {
      this.logger.warn(
        `[${getLine({ loc })}] Component "${value.getId()}" needs a bind context inorder to render properly`
      );
    }

    let renderedValueListener;

    switch (true) {

      case !!this.#attributeEmitContext:

        if (dataBinding) {
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
        const { selector } = bindContext;

        if (value instanceof Promise || value instanceof BaseComponent) {
          value = this.render({
            data: value,
            target: selector.replace('#', ''),
            transform,
          })

          transform = null;
        }

        const blockData = hook ? this.getBlockDataSnapshot(path) : null;

        if (dataBinding) {
          this.proxyInstance.getDataPathHooks()[path]
            .push({
              ...bindContext,
              hookMethod: hook, canonicalPath, transform, blockData,
            })
        }

        if (hook) {
          this.hooks[selector] = {
            hookName: hook,
            order: hookOrder != undefined ? hookOrder : this.getDefaultHookOrder(),
            blockData,
          };
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
      case value == this.undefinedValue(): // For lenient path resolution
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
    throw Error(`[${loc ? `${getLine({ loc })}` : this.getId()}] ${msg}`);
  }

  setSyntheticContext({ alias, fn, loc, canonicalSource }) {

    const { getBlockNameFromSyntheticAlias, toObject } = RootCtxRenderer;
    const { getValueType } = CustomCtxRenderer;

    const value0 = fn();

    let value = value0;

    if (!this.analyzeConditionValue(value)) {

      return (this.resolver && value == this.undefinedValue()) ?
        // When this method is called on compile-time prior to a call to validateType(...), 
        // returning undefinedValue() (which by the way can be any string) may deceive our 
        // compiler into thinking the developer is returning a string on purpose. 
        // So, in this context, undefined is the correct value to return.
        undefined :
        // Pass <value> on to the forEach(...) helper, it is guarenteed that iteration will
        // not happen
        value;
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

      // Note that since this synthetic invocation is
      // for an #if block (or rather #with turned #if block)

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

  inSyntheticBlock() {

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
    assert(this.isSynthetic(name));

    let name0 = name;

    if (this.inSyntheticBlock()) {
      name0 = this.toSyntheticCachedName(name);

      if (this.#syntheticCache[name] === undefined) {

        this.#syntheticCache[name] = Function(
          `return ${this.createInvocationString0(name)}`
        ).bind(this)()

        this[name0] = Function(
          `return this.getCachedSyntheticMethodValue("${name}")`
        ).bind(this);
      }
    }

    return this.createInvocationString0(name0);
  }

  createInvocationString0(name) {
    return `this.${name}()`;
  }

  getCachedSyntheticMethodValue(name) {
    return this.#syntheticCache[name]
  }

  isSyntheticInvocation(name) {
    const { syntheticMethodPrefix } = RootProxy;
    // eslint-disable-next-line no-undef
    return name.startsWith(`this.${syntheticMethodPrefix}`)
  }

  // eslint-disable-next-line class-methods-use-this
  isSynthetic(name) {
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
    return 'this.getRootGlobals()';
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
    const { pathSeparator, getDataVariables } = RootProxy;

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
      this.isSyntheticInvocation(result.execPath)
        && getDataVariables().includes(fqPath.split(pathSeparator).pop())
        ?
        // We need a non-synthetic path to use in <result.path>
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
      pathSeparator, syntheticMethodPrefix, globalsBasePath, getDataVariables,
    } = RootProxy;
    const {
      toObject, getDataBaseExecPath, getExecStringFromValue,
    } = RootCtxRenderer;

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

    if (this.isSynthetic(fqPath) || this.resolver) {
      addBasePath = false;
    }

    const basePath = addBasePath ? getDataBaseExecPath() : '';

    const segments = fqPath.split(pathSeparator);
    const parts = [];

    if (basePath.length) {
      parts.push(basePath);
    }

    const len = Number(parts.length);

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < segments.length; i++) {
      let part = segments[i];

      // This is necessary if we have a part like: x_$[0]

      const partSegments = global.clientUtils.getSegments({ original: part });
      [part] = partSegments;
      partSegments.splice(0, 1);
      let suffix = '';

      if (partSegments.length) {
        assert(partSegments.length == 1);

        suffix = partSegments[0];
      }

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
        })

        // if path ends with w.x.$_abc, part should be x.$_abc, not $_abc,
        // because $_abc should be translated as the index placeholder: _$
        part = path.split(/\.(?!\$_)/g).pop();

        let value = this.resolvePath0({
          path: `${!this.resolver && !this.isSyntheticInvocation(path) && !addBasePath ?
            `${getDataBaseExecPath()}.` : ''
            }${path}`
        });

        if (this.resolver) {
          assert(
            value instanceof Map || value instanceof Array,
            `${path} should resolve to either a Map or an Array`
          );

          if (value instanceof Map) {
            value = toObject({ map: value });
          }
        }

        // On runtime, an iteration in forEach(...) resulting in the resolution of this path. 
        // On compile-time, validateType(...) ensured that the collection was non-empty
        assert(Object.keys(value).length > 0);

        const index = indexResolver(canonicalPath);

        const isArray = value instanceof Array;
        const isMap = value instanceof Object;

        if (isArray || isMap) {

          const isScalarCollection = (() => {

            if (this.resolver) {
              const firstChild = isArray ? value[0] : value[Object.keys(value)[0]];
              return firstChild !== Object(firstChild) || firstChild instanceof BaseComponent;
            } else {

              const p = this.getExecPath0({
                fqPath: canonicalPath,
                indexResolver,
                addBasePath: false,
              })

              const collDef = this.proxyInstance.getCollectionDefinition(p);
              assert(collDef);

              return collDef.type && ['string', 'number', 'boolean']
                .includes(collDef.type[0]);
            }
          })()

          const dataVariable = segments[i + 1] || '';

          if (
            allowSynthetic && i == segments.length - 2 &&
            isScalarCollection &&
            getDataVariables().includes(dataVariable)
          ) {

            // If this is a scalar collection and the next segment is a dataVariable,
            // eagerly resolve to a synthetic function that resolves 

            assert(!suffix);

            const syntheticMethodName = `${syntheticMethodPrefix}${clientUtils.randomString()}`;

            const dataVariableValue = this.getBlockData({
              path: canonicalPath,
              dataVariable,
            });

            this[syntheticMethodName] = Function(`return ${getExecStringFromValue(dataVariableValue)}`);

            // Since we are resolving to a synthetic method name (because this is a literal collection),
            // there is a possibility that the developer never accesses {{.}} inside the #each block, 
            // thereby causing the PathResolver to throw a "redundant path" error for <canonicalPath>. 
            // Hence, we need to at least access index 0 at compile-time

            if (this.resolver && isArray) {
              this.resolver.resolve({ path: `${path}[0]` })
            }

            // <syntheticMethodName> is a temporarily function used to get the value, prune later
            // Todo: Instead of using setTimeout(...), find a better alternative
            setTimeout(() => {
              delete this[syntheticMethodName];
            }, 5000)

            return this.createInvocationString(syntheticMethodName);
          }
        }

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

        if (this.isSynthetic(part)) {
          // eslint-disable-next-line no-undef
          assert(i === 0);
          part = this.createInvocationString(part);
        }
      }

      if (suffix.length) {
        part += suffix;
      }

      parts.push(part);
    }

    if (this.isSynthetic(parts[0])) {
      assert(parts.length == 1);

      const rawMethodName = fqPath.replace(syntheticMethodPrefix, '');

      parts[0] = this.createInvocationString(
        this[rawMethodName] ? rawMethodName : fqPath
      );
    }

    return parts
      .map((part, index) => {
        // If the last segment is a data variable, use a square bracket
        // notation instead of a dot notation to access the property
        return index == 0 ? part : part.startsWith('@') ? `['${part}']` : `.${part}`;
      })
      .join('');
  }

  resolvePath({ fqPath, indexResolver, create, includePath, lenientResolution, stmt }) {

    const arr = fqPath.split('%');
    let { path, execPath } = this.getExecPath({
      fqPath: arr[0],
      indexResolver,
    });

    const isSynthetic = this.isSyntheticInvocation(path);

    // In some case cases, data paths can resolve to a synthetic
    // method, for example when resolving data variables for literal
    // arrays/maps
    if (isSynthetic) {
      const value = this.evaluateGetterExpression(path);

      return includePath ? {
        path: this.getMethodNameFromInvocationString(path),
        value
      } : value;
    }

    let valueOverride;

    if (this.isSyntheticInvocation(execPath)) {
      valueOverride = this.evalPath(execPath, lenientResolution);
    } else if (arr[1]) {
      // Append type segment to be used by our resolver
      path += `%${arr[1]}`;
    }

    return this.resolvePath0({
      path, valueOverride, create, includePath, canonicalPath: arr[0],
      lenientResolution, stmt,
    });
  }

  static toBindPath0(path) {
    const { dataPathRoot, pathSeparator } = RootProxy;

    // In getExecPath(...), <dataVariableSuffix> was transformed to use a
    // square bracket notation, i.e. ['@first'], instead of a dot notation. 
    // Convert back to dot notation, which is what is used in <dataPathHooks>

    const dataVariable = path.match(/(?<=\[')@\w+(?='\]$)/g);
    if (dataVariable) {
      path = path.replace(`['${dataVariable[0]}']`, `.${dataVariable[0]}`);
    }

    return `${dataPathRoot}${pathSeparator}${path}`;
  }

  static wrapExecStringForLeniency(execString) {
    return `this.evalPathLeniently(\`${execString}\`)`;
  }

  static toBindPath(path) {
    const { pathSeparator, globalsBasePath } = RootProxy;
    const { escapeRegExp } = global.clientUtils;
    const { getDataBaseExecPath, getGlobalsBaseExecPath, toBindPath0 } = RootCtxRenderer;

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

    return toBindPath0(path);
  }

  undefinedValue() {
    return 'undefined';
  }

  evaluateGetterExpression(execString, scope) {
    return this.evaluateExpression(`return ${execString}`, scope);
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
      return this.evalPathLeniently(execPath, this.undefinedValue(), scope);
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

  resolvePath0({
    path, valueOverride, create, includePath, canonicalPath, lenientResolution, stmt,
  }) {

    const { getDataBaseExecPath, getGlobalsBaseExecPath, toBindPath } = RootCtxRenderer;

    const isSynthetic = this.isSyntheticInvocation(path);

    const value = valueOverride !== undefined ?
      valueOverride :
      this.resolver && !isSynthetic ? this.resolver.resolve({ path, create, stmt })
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

  buildInputData({ inputProducer = () => ({}), hash }) {
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
        handlers[evtName] = hash[k];
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

  addEventHandlers({ handlers, component }) {
    Object.entries(handlers).forEach(([evtName, methodName]) => {
      const fn = this[methodName];

      if (!fn || !fn instanceof Function) {
        this.throwError(`Unknown event handler: ${methodName}`);
      }

      component.on(evtName, fn.bind(this));
    });
  }

  // eslint-disable-next-line class-methods-use-this
  loadInlineComponent() {
    const { cloneInputData } = BaseComponent;

    // eslint-disable-next-line prefer-rest-params
    const params = Array.from(arguments);
    const options = params.pop();

    const { hash, loc } = options;
    let [componentSpec] = params;

    delete hash.ctx;

    const { ref } = hash;

    delete hash.ref;

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

            const inputProducer = () => cloneInputData(componentSpec.getInput());

            const { handlers, config, input } = this.buildInputData({
              inputProducer, hash,
            });

            if (input || config || handlers || componentSpec.getInternalMeta().loaded) {
              component = new componentSpec.constructor({
                input: input || inputProducer(),
                config,
              });
            } else {
              // We don't have to clone the component
              component = componentSpec;
              component.getInternalMeta().loaded = true;
            }

            if (handlers) {
              this.addEventHandlers({ handlers, component });
            }

            break;

          case componentSpec == null:
            // We need to return undefined so that BaseComponent.render(...) will render an empty string
            return undefined;
        }

        if (!component) {
          this.throwError(`Unknown target specified in PartialStatement`, loc);
        }

        if (ref) {
          this.#inlineComponentInstances[ref] = component;

          component.on('destroy', () => {
            delete this.#inlineComponentInstances[ref];
          })
        }

        component.setInlineParent(this);

        return component;
      });
  }

  getInlineComponent(ref) {
    const c = this.#inlineComponentInstances[ref];
    return (c && c.isMounted()) ? c : null;
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

  getOwnEvents() {
    const fn = this.getOwnMethod('events');
    return fn ? fn() : [];
  }

  getEvents() {
    let events = [];

    this.recursivelyInvokeMethod('events').forEach(arr => {
      assert(arr.constructor.name == 'Array');
      events = events.concat(arr);
    });

    return events;
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
}
module.exports = RootCtxRenderer;
