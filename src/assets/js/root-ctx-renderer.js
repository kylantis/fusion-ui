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

  #resolve;

  #mounted;

  #currentBindContext;

  #attributeContext;

  #inlineComponentInstances;

  #syntheticCache;

  #fnStore;

  #handlebars;

  #handlebarsOptions;

  constructor({
    id, input, logger,
  } = {}) {
    super({
      id, input, logger,
    });

    this.blockData = {};

    this.syntheticContext = {};

    this.promise = new Promise((resolve) => {
      this.#resolve = resolve;
    });

    this.futures = [];
    this.#mounted = false;

    this.renderOffset = 0;

    this.syntheticNodeId = [];
    this.#currentBindContext = [];

    this.hooks = {};

    this.#inlineComponentInstances = {};
    this.#syntheticCache = {};
    this.#fnStore = {};

    this.mustacheStatements = {};
  }

  isMounted() {
    return this.#mounted;
  }

  static setToken(token) {
    if (RootCtxRenderer.#token) {
      throw Error(`Could not set token: ${token}`);
    }
    RootCtxRenderer.#token = token;
  }

  getMetadata(assetId) {
    return global.templates[`metadata_${assetId}`];
  }

  renderDecorator(decorator) {
    return this.#handlebars.template(decorator)(
      this.rootProxy, this.#handlebarsOptions,
    );
  }

  isLoadable() {
    return true;
  }

  async load({ container, token, transform }) {

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

    const { htmlWrapperCssClassname, getMetaHelpers } = RootCtxRenderer;
    super.load();

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

    const __helpers = global.__helpers || (global.__helpers = {});

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

    this.#handlebarsOptions = {
      helpers,
      partials: {},
      allowedProtoProperties: {

        // Todo: Stop passing in everthing, we only need the paths prefixed with "data__r$_"
        // To test any future fix, use checkbox component because it contains a custom context

        ...allowedProtoProperties,
      },
    };

    await this.invokeLifeCycleMethod('beforeMount');

    const { template } = this.getMetadata(this.getAssetId());

    this.#handlebars = Handlebars.create();

    // eslint-disable-next-line no-undef
    let html = this.#handlebars.template(template)(
      {
        data: this.rootProxy,
      },
      this.#handlebarsOptions,
    );

    if (transform) {
      html = transform(html);
    }

    assert(this.syntheticNodeId.length == 0);

    const parentNode = container ? document.getElementById(container) : document.body;

    // We require that the <parentNode> is a live element, present om the DOM
    assert(parentNode != null, `DOMElement #${container} does not exist`);

    this.node = document.createElement('div');

    this.node.id = this.getElementId();
    this.node.classList.add(htmlWrapperCssClassname);
    this.node.innerHTML = html;

    parentNode.appendChild(this.node);

    this.#resolve();

    return this.promise

      // Even after all promises are resolved, we need to wait
      // for this component to be fully mounted. This is
      // especially important if there async custom blocks or
      // sub-components inside this component
      .then(() => Promise.all(this.futures))

      .then(() => {

        const finalize = async () => {

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

              assert(hook && node);

              return hook({
                selector,
                node,
                blockData,
                // This indicates that this hook is triggered just before this component
                // is fully mounted, as opposed to on data update
                initial: true,
              });
            });

          await Promise.all(hooks);

          await this.invokeLifeCycleMethod('onMount');


          // As a general contract, we expect developers to update the futures object 
          // with any extra promises, including the loading of sub components. hence
          // we need to await futures again, in case it was updated by any of the hooks
          await Promise.all(this.futures);

          self.appContext.components[this.getId()] = this;

          this.#mounted = true;

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
    return this.config.defaultHookOrder || RootCtxRenderer.#defaultHookOrder;
  }

  conditional({ options, ctx, params }) {

    const { conditionalBlockHookType } = RootProxy;

    const { fn, inverse, hash } = {
      ...options,
      fn: this.wrapFn(options.fn),
      inverse: this.wrapFn(options.inverse),
    };

    const { hook, hookOrder, transform } = hash;

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
      Object(value) === value && !value instanceof BaseComponent;

    const conditional0 = (value) => {

      const b = this.analyzeConditionValue(value);
      let branch;

      let markup = (() => {
        if (invert ? !b : b) {

          if (hook) {
            this.hooks[`#${nodeId}`] = {
              hookName: hook,
              order: hookOrder != undefined ? hookOrder : this.getDefaultHookOrder(),
              blockData: clientUtils.deepClone(this.blockData)
            };
          }

          branch = 'fn';
          return this.lookupFnStore(fn)(ctx);

        } else if (inverse) {

          branch = 'inverse';
          return this.lookupFnStore(inverse)(ctx);
        }
      })();

      if (transform) {
        markup = this[transform](markup);
      }

      if (nodeId) {
        this.futures.push(async () => {
          document.querySelector(`#${this.getId()} #${nodeId}`)
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
          fn, inverse, hookMethod: hook, invert,
          blockData: this.getBlockDataSnapshot(path),
          canonicalPath,
        });
    }

    return conditional0(value);
  }

  forEach({ options, ctx, params }) {

    const { eachBlockHookType } = RootProxy;
    const { htmlWrapperCssClassname, getSyntheticAliasFromPath } = RootCtxRenderer;

    const { fn, inverse, hash } = {
      ...options,
      fn: this.wrapFn(options.fn),
      inverse: this.wrapFn(options.inverse),
    };

    const { hook, hookOrder, transform } = hash;

    const [{ path, value, canonicalPath }] = params;

    const nodeId = this.getSyntheticNodeId();

    const isSynthetic = this.isSynthetic(path);
    const dataBinding = !isSynthetic && this.dataBindingEnabled() && nodeId;

    const forEach0 = (value) => {

      if (this.analyzeConditionValue(value)) {

        const isArray = Array.isArray(value);

        // Add (length and type) to this.blockData

        const blockKey = isSynthetic ? getSyntheticAliasFromPath(path) : canonicalPath;

        this.blockData[blockKey].length = value.length;
        this.blockData[blockKey].type = isArray ? 'array' : 'map';

        // Note: <rawValue> and <keys> are only used to check for null members

        const rawValue = isArray ? value :
          // Get the raw value from our object proxy
          value.toJSON();

        const keys = Object.keys(rawValue);

        let ret = "";

        for (let i = 0; i < value.length; i++) {

          if (isSynthetic) {
            // Update the current value of the synthetic context
            value[i];
          }

          let markup = rawValue[keys[i]] === null ?
            // null collection members are always represented as an empty strings
            '' :
            this.lookupFnStore(fn)(this.rootProxy);

          if (transform) {
            markup = this[transform](markup);
          }

          const elementNodeId = clientUtils.randomString();;
          const key = this.getBlockData({ path: blockKey, dataVariable: '@key' });

          markup = `<div id="${elementNodeId}" class="${htmlWrapperCssClassname}" key="${key}">
                        ${markup}
                      </div>`;

          if (isArray && !isSynthetic) {
            // arrayChildBlock hooks are only added to non-synthetic array paths
            this.backfillArrayChildBlocks(`${path}[${i}]`, `#${elementNodeId}`);
          }

          this.pruneSyntheticCache();

          if (hook) {
            this.hooks[`#${nodeId} > div[key='${key}']`] = {
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
          canonicalPath,
        });
    }

    return forEach0(value);
  }

  lookupFnStore(id) {

    const { wrapFnWithExceptionCatching } = RootCtxRenderer;
    return wrapFnWithExceptionCatching(this.#fnStore[id]);
  }

  wrapFn(fn) {
    if (!fn) {
      return null;
    }
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

    if (!arr) return;

    if (selector) {
      arr.forEach((hook) => {
        if (hook.type == arrayChildBlockHookType && !hook.selector) {
          hook.selector = selector;
        }
      });
    } else {
      dataPathHooks.set(
        path,
        arr.filter(
          ({ type, selector }) => type != arrayChildBlockHookType || selector
        )
      )
    }
  }

  /**
   * This used for: each, conditional and logicGate expressions
    */
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

    for (let i = blockDataKeys.length - 1; i >= 0; i--) {
      const k = blockDataKeys[i];
      const { type, index } = this.blockData[k];

      if (type == 'array' && !k.startsWith(syntheticBlockKeyPrefix)) {

        const p = this.getExecPath0({
          fqPath: `${k}[${index}]`,
          addBasePath: false,
        });

        const hookList = this.proxyInstance.getDataPathHooks()[
          `${dataPathRoot}${pathSeparator}${p}`
        ];

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
      'resolveMustacheInCustom', 'contentHelper'
    ];
  }

  setSyntheticNodeId() {
    const id = global.clientUtils.randomString();
    this.syntheticNodeId.push(id);
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

    const streamTokenizer = new hyntaxStreamTokenizerClass();

    streamTokenizer
      .on('data', (tokens) => {
        this.#attributeContext.tokenList = this.#attributeContext.tokenList.concat(tokens);
      });

    this.#attributeContext = {
      tokenList: [],
      literal: '',
      write: (value) => {
        this.#attributeContext.literal += value;
        streamTokenizer.write(value);
      },
    };

    this.#attributeContext.write('<');

    return '';
  }

  static getHtmlIntrinsicAttributes() {
    return {
      'value': ['input'],
      'readOnly': ['input'],
    }
  }

  static getHtmlBooleanAttributes() {
    return {
      allowfullscreen: ['iframe'], async: ['script'], autofocus: ['*'], autoplay: ['media'],
      checked: ['input'], controls: ['media'], default: ['track'], defer: ['script'],
      disabled: ['button', 'input', 'select', 'textarea'], formnovalidate: ['input'],
      inert: ['*'], ismap: ['img'], itemscope: ['*'], loop: ['media'], multiple: ['input'],
      muted: ['media'], nomodule: ['script'], novalidate: ['form'], open: ['dialog'],
      playsinline: ['video'], readonly: '*', required: ['textarea', 'input'], reversed: ['ol'],
      selected: ['option'],
    };
  }

  getRenderedAttributeSegment({ value, overrides }) {
    const rgx = /({{\w+}})/g;
    return value
      .split(rgx)
      .map(v => {
        if (v.match(rgx)) {
          const ref = m.replace(/({{)|(}})/g, '');
          if (overrides[ref] !== undefined) {
            v = String(overrides[ref]);
          } else {
            v = this.mustacheStatements[ref].renderedValue;
          }
        }
        return v;
      })
      .join('');
  }

  isBooleanAttribute(tokenList, keyIndex) {
    const { getHtmlBooleanAttributes } = RootCtxRenderer;

    const tagName = tokenList[0].content.replace('<', '');
    const keyToken = tokenList[keyIndex];

    assert(keyToken.type == 'token:attribute-key');

    const attrKey = this.getRenderedAttributeSegment({ value: keyToken.content });

    return (getHtmlBooleanAttributes()[attrKey] || []).includes(tagName);
  }

  endAttributeBindContext() {

    const {
      nodeAttributeHookType, nodeAttributeKeyHookType, nodeAttributePartialValueHookType, nodeAttributeValueHookType
    } = RootProxy;

    const { randomString, isStringCoercible } = clientUtils;

    const nodeId = randomString();

    if (this.#attributeContext) {

      const { tokenList } = this.#attributeContext;

      for (let tokenIndex = 0; tokenIndex < tokenList.length; tokenIndex++) {
        let { type, content } = tokenList[tokenIndex];

        (content.match(/{{\w+}}/g) || [])
          .forEach(m => {

            const mustacheRef = m.replace(/({{)|(}})/g, '');
            const { path, renderedValue, canonicalPath, transform, loc } = this.mustacheStatements[mustacheRef];
          
            const isSynthetic = this.isSynthetic(path);

            // Todo: Support data-binding for synthetic invocations
            const dataBinding = !isSynthetic;

            let hookType;

            // Todo: Instead of directly adding 
            const hookInfo = { tokenList, tokenIndex };

            switch (true) {
              case type == 'token:attribute-key' && content == m:
                if (tokenList[tokenIndex + 1].type == 'token:attribute-assignment') {
                  hookType = nodeAttributeKeyHookType;
                } else {
                  hookType = nodeAttributeHookType;
                }
                break;

              case type == 'token:attribute-value':
                if (content == m) {
                  hookType = nodeAttributeValueHookType;

                  if (tokenList[tokenIndex - 1].type == 'token:attribute-value-wrapper-start') {
                    assert(tokenList[tokenIndex + 1].type == 'token:attribute-value-wrapper-end');

                    hookInfo.attributeType = 'string';
                  } else {
                    assert(tokenList[tokenIndex - 1].type == 'token:attribute-assignment');

                    const keyIndex = tokenIndex - 2;

                    if (this.isBooleanAttribute(tokenList, keyIndex)) {
                      // This is a well-known boolean attribute
                      hookInfo.attributeType = 'boolean';
                    } else {
                      hookInfo.attributeType = 'boolean|number';
                    }

                    if (
                      typeof renderedValue == 'string' &&
                      !isStringCoercible(renderedValue, hookInfo.attributeType)
                    ) {
                      this.throwError(
                        `Attribute value resolved to a string instead of a ${hookInfo.attributeType}`,
                        loc,
                      );
                    }
                  }
                } else {

                  for (let i = tokenIndex; i >= 0; i--) {
                    const { type } = tokenList[i];
                    if (type == 'token:attribute-assignment') {
                      this.throwError(
                        `Attribute value should be wrapped in quotes, i.e. attributeName="value"`, loc
                      );
                    }
                    if (type == 'token:attribute-value-wrapper-start') {
                      break;
                    }
                  }

                  hookType = nodeAttributePartialValueHookType;
                }
                break;
            }

            if (dataBinding && hookType) {
              this.proxyInstance.getDataPathHooks()[path]
                .push({
                  type: hookType, nodeId, canonicalPath, mustacheRef, hookInfo, transform,
                })
            }
          });
      }

      this.#attributeContext = null;
    }

    return nodeId;
  }

  // Todo: "TextNode" is not a good name because it's misleading - not a text node!
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

    return id;
  }

  getCurrentBindContext() {
    return this.#currentBindContext.pop();
  }

  contentHelper({ params }) {
    const [value] = params;

    if (this.#attributeContext) {
      this.#attributeContext.write(value);
    }

    return value;
  }

  resolveMustacheInRoot({ options, params }) {

    const { textNodeHookType } = RootProxy;
    const { getLine } = clientUtils;

    let { hash: { hook, hookOrder, transform }, loc } = options;

    const bindContext = this.getCurrentBindContext();

    let [target] = params;

    if (Object(target) !== target) {
      assert(!bindContext);

      // <target> resolved to a literal
      target = { value: target };
    }

    let { path, value, canonicalPath } = target;

    const isSynthetic = this.isSynthetic(path);

    // Todo: Support data-binding for synthetic invocations
    const dataBinding = !isSynthetic && this.dataBindingEnabled() && bindContext;

    const isTextNodeBindContext = bindContext && bindContext.type == textNodeHookType;

    if (!isTextNodeBindContext && value instanceof BaseComponent) {
      this.logger.warn(
        `[${getLine(loc)}] Component "${value.getId()}" needs a bind context inorder to render properly`
      );
    }

    let renderedValueListener;

    switch (true) {

      case !!this.#attributeContext:
        const mustacheRef = clientUtils.randomString();

        this.mustacheStatements[mustacheRef] = {
          path, canonicalPath, transform, loc,
        }
        this.#attributeContext.write(`{{${mustacheRef}}}`);

        renderedValueListener = (renderedValue) => {
          this.mustacheStatements[mustacheRef].renderedValue = renderedValue;
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

    return renderedValue;
  }

  getPathValue({ path, includePath = false, lenientResolution }) {
    // Todo: If path == '', set lenientResolution to false, because 
    // this.getInput() will always exist

    return this.resolvePath({
      fqPath: path,
      includePath,
      lenientResolution,
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

  getBlockData({ path, dataVariable }) {

    const { getDataVariables } = RootProxy;
    const { getDataVariableValue, toObject } = RootCtxRenderer;

    assert(getDataVariables().includes(dataVariable));

    // eslint-disable-next-line no-unused-vars
    const blockData = this.blockData[path];

    let value = this.syntheticContext[path] !== undefined
      ? this.syntheticContext[path].value
      : this.getPathValue({ path });

    if (value instanceof Map) {
      assert(this.resolver);
      value = toObject({ map: value });
    }

    switch (dataVariable) {
      case '@random':
        return blockData.random;
      default:
        return getDataVariableValue(
          dataVariable, blockData.index, Object.keys(value)
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

        // On runtime, an iteration in forEach(...) resulting in the resolution 
        // of this path. On compile-time, CustomCtxRenderer.validateType(...)
        // ensured that the collection was non-empty
        assert(Object.keys(value).length > 0);

        const index = indexResolver(canonicalPath);

        const isArray = value instanceof Array;
        const isMap = value instanceof Object;

        if (isArray || isMap) {

          const firstChild = isArray ? value[0] : value[Object.keys(value)[0]];
          const isScalarCollection = firstChild !== Object(firstChild) || firstChild instanceof BaseComponent;

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
              dataVariable
            });

            this[syntheticMethodName] = Function(`return ${getExecStringFromValue(dataVariableValue)}`);

            // Since we are resolving to a synthetic method name (because this is a literal collection),
            // there is a possibility that the developer never accesses {{.}} inside the #each block, 
            // thereby causing the PathResolver to throw a "redundant path" error for <canonicalPath>. 
            // Hence, we need to at least access index 0 at compile-time

            if (this.resolver && isArray) {
              this.resolver.resolve({ path: `${path}[0]` })
            }

            // <syntheticMethodName> is only used on initial rendering, hence cleanup after 
            // component is rendered
            this.futures.push(
              this.promise.then(() => {
                delete this[syntheticMethodName];
              })
            );

            // In startTextNodeBindContext(), we may have performed a push to this.#currentBindContext
            // Since this is transformed to a synthetic method and data-binding will never 
            // happen via this.resolveMustacheInRoot(...), we need to pop

            if (this.#currentBindContext.length == 1) {
              this.#currentBindContext.pop();
            }

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

  resolvePath({ fqPath, indexResolver, create, includePath, lenientResolution }) {

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
      lenientResolution,
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
    path, valueOverride, create, includePath, canonicalPath, lenientResolution
  }) {

    const { getDataBaseExecPath, getGlobalsBaseExecPath, toBindPath } = RootCtxRenderer;

    const isSynthetic = this.isSyntheticInvocation(path);

    const value = valueOverride !== undefined ?
      valueOverride :
      this.resolver && !isSynthetic ? this.resolver.resolve({ path, create })
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
      .filter(k => !!hash[k])
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

    const ref = hash.ref;
    delete hash.ref;

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

        // Note: we need to clone inorder to un-proxify componentSpec.getInput()
        const inputProducer = () => cloneInputData(componentSpec.getInput());

        const { handlers, config, input } = this.buildInputData({
          inputProducer, hash,
        });

        if (input || config) {
          component = new componentSpec.constructor({
            input: input || inputProducer(),
            config,
            parent: this,
          });
        } else {
          // We don't have to clone the component, because there is no override
          component = componentSpec;
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
    }

    return component;
  }

  getInlineComponents() {
    return this.#inlineComponentInstances;
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
