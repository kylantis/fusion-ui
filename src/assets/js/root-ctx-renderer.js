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

  static #defaultHookOrder = 1;

  static #token;

  #resolve;

  #mounted;

  #currentBindContext;

  #inlineComponentInstances;

  #syntheticCache;

  constructor({
    id, input, loadable, logger,
  } = {}) {
    super({
      id, input, loadable, logger,
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

    this.blockHooks = {};

    this.#inlineComponentInstances = {};
    this.#syntheticCache = {};
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

  async load({ container, token } = {}) {

    if (!this.loadable() || this.isMounted()) {
      throw Error(`${this.getId()} is not loadable`);
    }

    if (token !== RootCtxRenderer.#token && !this.isRoot()) {
      throw Error(`Invalid token: ${token}`);
    }

    if (this.isMounted()) {
      throw Error(`${this.getId()} is already loaded`);
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

    const { template } =
      global[`metadata_${this.getAssetId()}`];

    const hbsInput = {
      data: this.rootProxy,
    };

    this.hbsInput = hbsInput;

    await this.invokeLifeCycleMethod('beforeMount');

    // eslint-disable-next-line no-undef
    const html = Handlebars.template(template)(
      this.hbsInput,
      {
        helpers,
        partials: {},
        allowedProtoProperties: {
          ...allowedProtoProperties,
        },
        // allowProtoPropertiesByDefault: false,
        // allowProtoMethodsByDefault: false
        // strict: true,
      });

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

          // Prune syntheticCache
          for (const k in this.#syntheticCache) {
            const name0 = this.toSyntheticCachedName(k);
            assert(this[name0] instanceof Function);

            delete this[name0];
            delete this.#syntheticCache[k];
          }

          // Trigger block hooks
          const hookKeys = Object.keys(this.blockHooks)
            .sort((e1, e2) => {

              const o1 = this.blockHooks[e1].order;
              const o2 = this.blockHooks[e2].order;

              return o1 < o2 ? -1 : o2 < o1 ? 1 : 0;
            });

          const hooks = hookKeys
            .map(selector => {
              const { hookName, blockData } = this.blockHooks[selector];

              const hook = this[hookName].bind(this);
              assert(!!hook, `Block hook ${hookName} was not found`);

              return hook({
                node: document.querySelector(`#${this.getId()} ${selector}`),
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

          const html = parentNode.innerHTML;

          this.#mounted = true;

          return html;
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
          methods.push(component[name].bind(this));
        }
      });
    }

    return methods.reverse();
  }

  conditional({ options, ctx, params }) {

    const { conditionalBlockHookName } = RootProxy;
    const { wrapFnWithExceptionCatching } = RootCtxRenderer;

    const { fn, inverse, hash } = {
      ...options,
      fn: wrapFnWithExceptionCatching(options.fn),
      inverse: wrapFnWithExceptionCatching(options.inverse),
    };

    let [target, invert] = params;

    const { path, value, canonicalPath } = target;

    assert(!!canonicalPath);

    const nodeId = this.getSyntheticNodeId();

    const hookName = hash['transform'];
    const hookOrder = hash['transformOrder'];

    const isSynthetic = this.isSynthetic(path);
    const dataBinding = !isSynthetic && this.dataBindingEnabled() && nodeId != undefined;

    const conditional0 = (value) => {

      const b = this.analyzeConditionValue(value);
      let branch;

      if (invert ? !b : b) {

        if (hookName) {
          // Regardless of whether data binding is enabled for the
          // entire component or not, the contents of this blocks must
          // contain valid html markup if a hook is specified
          assert(!!nodeId);

          this.blockHooks[`#${nodeId}`] = {
            hookName,
            order: (hookOrder != undefined && global.clientUtils.isNumber(hookOrder)) ?
              hookOrder : RootCtxRenderer.#defaultHookOrder,
            blockData: global.clientUtils.deepClone(this.blockData)
          };
        }

        branch = 'fn';
        return fn(ctx);

      } else if (inverse) {

        branch = 'inverse';
        return inverse(ctx);
      }

      if (nodeId) {
        this.futures.push(async () => {
          document.querySelector(`#${this.getId()} #${nodeId}`)
            .setAttribute('branch', branch);
        });
      }
    }

    // Todo: If target is a logicGate, I can optimize space by having the blockData
    // of the logicGate and this conditional block reference the same blockData object
    // instead of having separate objects that are exactly the same

    if (dataBinding) {
      this.proxyInstance.getDataPathHooks()[path]
        .push({
          type: conditionalBlockHookName,
          nodeId, fn, inverse, hookMethod: hookName, invert,
          blockData: this.getBlockDataSnapshot(path),
          canonicalPath,
        });
    }

    return conditional0(value);
  }

  forEach({ options, ctx, params }) {

    const { eachBlockHookName } = RootProxy;
    const {
      htmlWrapperCssClassname, getSyntheticAliasFromPath, getChildPathFromPath,
      wrapFnWithExceptionCatching,
    } = RootCtxRenderer;

    const { fn, inverse, hash } = {
      ...options,
      fn: wrapFnWithExceptionCatching(options.fn),
      inverse: wrapFnWithExceptionCatching(options.inverse),
    };
    const [{ path, value, canonicalPath }] = params;

    assert(!!canonicalPath);

    const nodeId = this.getSyntheticNodeId();

    const hookName = hash['transform'];
    const hookOrder = hash['transformOrder'];

    const isSynthetic = this.isSynthetic(path);
    const dataBinding = !isSynthetic && this.dataBindingEnabled() && nodeId != undefined;

    const forEach0 = (value) => {

      if (this.analyzeConditionValue(value)) {

        // Add (length and type) to this.blockData

        const blockKey = isSynthetic ? getSyntheticAliasFromPath(path) : canonicalPath;

        this.blockData[blockKey].length = value.length;
        this.blockData[blockKey].type = isArray ? 'array' : 'map';

        // Note: <rawValue> and <keys> are only used to check for null members

        const rawValue = Array.isArray(value) ? value :
          // Get the raw value from our object proxy
          rawValue.toJSON();

        const keys = Object.keys(rawValue);

        let ret = "";

        for (let i = 0; i < value.length; i++) {

          if (isSynthetic) {

            // Update the current value of the synthetic context
            value[i];

            // Reset synthetic cache

            const childPath = getChildPathFromPath(path)
            assert(
              this.#syntheticCache[childPath] !== undefined || i == 0
            )

            delete this.#syntheticCache[childPath];
          }

          let markup = rawValue[keys[i]] === null ?
            // null collection members are always represented as an empty strings
            '' :
            fn(this.rootProxy);

          let elementNodeId;
          const key = this.getBlockData({ path: blockKey, dataVariable: '@key' });

          if (dataBinding) {
            elementNodeId = clientUtils.randomString();
            markup = `<div id="${elementNodeId}" class="${htmlWrapperCssClassname}" key="${key}">
                        ${markup}
                      </div>`;
          }

          if (isArray && !isSynthetic) {
            // arrayChildBlock hooks are only added to non-synthetic array paths
            this.backfillArrayChildBlocks(`${path}[${i}]`, elementNodeId);
          }

          if (hookName) {

            // Regardless of whether data binding is enabled for the
            // entire component or not, the contents of this blocks must
            // contain valid html markup if a hook is specified
            assert(!!nodeId);

            this.blockHooks[`#${nodeId} > div[key='${key}']`] = {
              hookName,
              order: (hookOrder != undefined && global.clientUtils.isNumber(hookOrder)) ?
                hookOrder : RootCtxRenderer.#defaultHookOrder,
              blockData: clientUtils.deepClone(this.blockData),
            };
          }

          ret += markup;
        }
        return ret;

      } else if (inverse) {
        return inverse(ctx);
      }
    }

    if (dataBinding) {

      this.proxyInstance.getDataPathHooks()[path]
        .push({
          type: eachBlockHookName, nodeId, fn, inverse, hookMethod: hookName,
          blockData: this.getBlockDataSnapshot(path),
          canonicalPath,
        });
    }

    return forEach0(value);
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

  /**
   * This backfills null nodeIds created by nested blocks via getBlockDataSnapshot(...)
   */
  backfillArrayChildBlocks(path, nodeId) {
    const { arrayChildBlockHookName } = RootProxy;

    const dataPathHooks = this.proxyInstance.getDataPathHooks();
    const arr = dataPathHooks[path];

    if (!arr) return;

    if (nodeId) {
      arr.forEach((hook) => {
        if (hook.type == arrayChildBlockHookName && !hook.nodeId) {
          hook.nodeId = nodeId;
        }
      });
    } else {
      dataPathHooks.set(
        path,
        arr.filter(
          ({ type, nodeId }) => type != arrayChildBlockHookName || nodeId
        )
      )
    }
  }

  /**
   * This used for: each, conditional and logicGate expressions
    */
  getBlockDataSnapshot(path) {

    const { arrayChildBlockHookName, syntheticBlockKeyPrefix } = RootProxy;

    // We first need to find the closest non-synthetic array-based blockData, and
    // register <path> as a arrayChildBlock. That way, when the current
    // array index moves, we can update the blockData captured for this path

    // In ES-2015+, insertion order is preserved, so we know the
    // last index is the most recent, and vice-versa
    const blockDataKeys = Object.keys(this.blockData);

    for (let i = blockDataKeys.length - 1; i >= 0; i--) {
      const k = blockDataKeys[i];
      const { type, index } = this.blockData[k];

      if (type == 'array' && !k.startsWith(syntheticBlockKeyPrefix)) {

        const p = this.getExecPath0({
          fqPath: `${k}[${index}]`,
          addBasePath: false,
        });

        const hookList = this.proxyInstance.getDataPathHooks()[p];

        // Add hook, only if it does not already exist
        if (
          !hookList.filter(({ type, path: p }) =>
            type == arrayChildBlockHookName && p == path)
            .length
        ) {
          hookList.push({
            type: arrayChildBlockHookName, path,
            // <nodeId> will be backfilled by backfillArrayChildBlocks(...) on iteration
            nodeId: null,
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
      'endAttributeBindContext', 'startTextNodeBindContext', 'setSyntheticNodeId', 'resolveMustache',
      'invokeTransform'
    ];
  }

  setSyntheticNodeId() {
    const id = global.clientUtils.randomString();
    this.syntheticNodeId.push(id);
    return id;
  }

  getSyntheticNodeId() {
    const v = this.syntheticNodeId.pop();
    assert(this.syntheticNodeId.length == 0);
    return v;
  }

  invokeTransform() {
    // eslint-disable-next-line prefer-rest-params
    const params = Array.from(arguments);
    const options = params.pop();

    const [transform, data] = params;
    return this[transform](data)
  }

  startAttributeBindContext() {

    if (!this.dataBindingEnabled()) {
      return '';
    }

    // NOTE: When implementing this:
    // During an active AttributeBindContext, if a
    // muustache statement resolves to either an empty
    // string or somethng that contains "="", then skip that
    // the reason we are skipping values with "=" is
    // because in that case, the key - value pair of the attribute
    // is encapsulated in the mustache statement - in which case
    // it's not possible to data-bind 

    // Note: Apart from =, this must only contain words


    return '';
  }

  endAttributeBindContext() {
    const id = global.clientUtils.randomString();
    return id;
  }

  startTextNodeBindContext() {

    const id = global.clientUtils.randomString();

    if (!this.dataBindingEnabled()) {
      return id;
    }

    const { textNodeHookName } = RootProxy;
    assert(this.#currentBindContext.length === 0);
    this.#currentBindContext.push({
      type: textNodeHookName,
      nodeId: id,
    });
    return id;
  }

  resolveMustache({ params }) {

    const [{ path, value, canonicalPath }, transform] = params;

    assert(!!canonicalPath);

    if (
      this.dataBindingEnabled() &&
      !this.isSynthetic(path) &&
      this.#currentBindContext.length
    ) {
      // Data-bind support exists for this mustache statement
      this.#bindMustache({ path, canonicalPath, transform });
    }

    return (value && transform) ? this[transform](value) : this.toHtml(value);
  }

  #bindMustache({ path, canonicalPath, transform }) {

    const { textNodeHookName } = RootProxy;
    const ctx = this.#currentBindContext.pop();

    assert(ctx.type == textNodeHookName);

    this.proxyInstance.getDataPathHooks()[path]
      .push({ ...ctx, canonicalPath, transform });
  }

  getPathValue({ path, includePath = false, lenientResolution }) {
    assert(!this.resolver);
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
    const { getDataVariableValue } = RootCtxRenderer;

    assert(getDataVariables().includes(dataVariable));

    // eslint-disable-next-line no-unused-vars
    const blockData = this.blockData[path];

    let value = this.syntheticContext[path] !== undefined
      ? this.syntheticContext[path].value
      : this.getPathValue({ path });

    assert(
      !this.resolver ||
      // At compile-time, getBlockData(...) is called for synthetic contexts only
      this.syntheticContext[path].value
    );

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
    const { getDataBasePath } = RootCtxRenderer;

    return this.getExecPath0({ fqPath: path, })
      .replace(`${getDataBasePath()}.`, '');
  }

  doBlockInit({ path }) {

    assert(!this.blockData[path]);

    this.blockData[path] = {
      index: -1,
    };
  }

  doBlockUpdate({ path }) {

    const blockData = this.blockData[path];
    // eslint-disable-next-line no-plusplus
    blockData.index++;
    blockData.random = global.clientUtils.randomString();
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
    assert(!this.resolver);
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
    throw Error(`[${getLine({ loc })}] ${msg}`);
  }

  setSyntheticContext({ alias, fn, loc, canonicalSource }) {

    const { getBlockNameFromSyntheticAlias, toObject } = RootCtxRenderer;
    const { getValueType } = CustomCtxRenderer;

    let value0;

    try {
      value0 = fn();
    } catch (e) {
      this.throwError(
        `Exception thrown while executing "${canonicalSource}": ${e.message}`,
        loc
      );
    }

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
              `Expected an array or map to be the target of the #each block, not a ${getValueType(value)}`,
              loc,
            );
          }
          break;
        case 'with':
          if (!value.constructor.name === 'Object') {
            this.throwError(
              `Expected an object to be the target of the #with block, not a ${getValueType(value)}`,
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

            // We need to return a map object, not an object because
            // the type will be validated by the preprocessor
            value = new Map();
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
    return str.replace(`this.`, '').replace(`()`, '')
  }

  toSyntheticCachedName(name) {
    return `${name}_cached`;
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

    const name0 = this.toSyntheticCachedName(name);

    if (this.#syntheticCache[name] === undefined) {

      this.#syntheticCache[name] = Function(
        `return ${this.createInvocationString0(name)}`
      ).bind(this)()

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
    return name.startsWith(RootProxy.syntheticMethodPrefix);
  }

  getSyntheticMethod({
    name,
  }) {
    // eslint-disable-next-line no-undef
    const f = this[`${RootProxy.syntheticMethodPrefix}${name}`];
    return f ? f.bind(this) : null;
  }

  static getDataBasePath() {
    return 'this.getInput()';
  }

  static getGlobalsBasePath() {
    return 'this.getRootGlobals()';
  }

  getGlobalsExecPath(fqPath) {
    const { globalsBasePath, pathSeparator } = RootProxy;
    const { getGlobalsBasePath } = RootCtxRenderer;

    const arr = fqPath.split(pathSeparator);

    assert(arr[0] == globalsBasePath);
    arr[0] = getGlobalsBasePath();

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
      pathSeparator, syntheticMethodPrefix, globalsBasePath, getDataVariables
    } = RootProxy;
    const {
      toObject, getDataBasePath, toBindPath, getDataVariableValue, getExecStringFromValue,
    } = RootCtxRenderer;

    if (fqPath === '') {
      return getDataBasePath();
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

    const basePath = addBasePath ? getDataBasePath() : '';

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
          path: `${
            !this.resolver && !this.isSyntheticInvocation(path) && !addBasePath ?
            `${getDataBasePath()}.` : ''
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

          const schema = this.proxyInstance.getCollectionDefinition(
            toBindPath(path)
          );

          const dataVariable = segments[i + 1] || '';

          if (
            allowSynthetic && i == segments.length - 2 &&
            !schema.$ref && getDataVariables().includes(dataVariable)
          ) {

            // If this is a scalar collection and the next segment is a dataVariable,
            // eagerly resolve to a synthetic function that resolves 

            assert(!suffix);

            const syntheticMethodName = `${syntheticMethodPrefix}${
              // Method name should be a word
              canonicalPath.replace(/[\[|\]]/g, '_')
              }_${dataVariable.replace(/^@/g, '')}`;

            if (!this[syntheticMethodName]) {

              const dataVariableValue = getDataVariableValue(
                dataVariable, index, Object.keys(value),
              );

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
            }

            // In startTextNodeBindContext(), we performed a push to this.#currentBindContext
            // Since this is transformed to a synthetic method and data-binding will never 
            // happen via this.#bindMustache, we need to pop
            this.#currentBindContext.pop();

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
      const value = eval(path);

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

  static toBindPath(path) {
    const { dataPathRoot, pathSeparator, globalsBasePath } = RootProxy;
    const { escapeRegExp } = global.clientUtils;
    const { getDataBasePath, getGlobalsBasePath } = RootCtxRenderer;

    let prefix = getDataBasePath();
    let repl = '';

    if (path.startsWith(getGlobalsBasePath())) {
      prefix = getGlobalsBasePath();
      repl = `${globalsBasePath}${pathSeparator}`;
    }

    path = path.replace(
      RegExp(`${escapeRegExp(prefix)}\\.?`),
      repl
    );

    // In getExecPath(...), <dataVariableSuffix> was transformed to use a
    // square bracket notation, i.e. ['@first'], instead of a dot notation. 
    // Convert back to dot notation, which is what is used in <dataPathHooks>

    const dataVariable = path.match(/(?<=\[')@\w+(?='\]$)/g);
    if (dataVariable) {
      path = path.replace(`['${dataVariable[0]}']`, `.${dataVariable[0]}`);
    }

    return `${dataPathRoot}${pathSeparator}${path}`;
  }

  undefinedValue() {
    return 'undefined';
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
  evalPathLeniently(execPath, undefinedVal) {
    const { lenientExceptionMsgPattern } = RootProxy;
    try {
      return Function(`return ${execPath}`).bind(this)();
    } catch (e) {
      if (e.name == 'TypeError' && e.message.match(lenientExceptionMsgPattern)) {
        return undefinedVal;
      } else {
        throw e;
      }
    }
  }

  evalPath(execPath, lenient) {

    if (lenient) {
      return this.evalPathLeniently(execPath, this.undefinedValue());
    }

    try {
      return eval(execPath);
    } catch (e) {
      this.logger.error(`Error occurred while evaluating: ${execPath}`);
      throw e;
    }
  }

  resolvePath0({
    path, valueOverride, create, includePath, canonicalPath, lenientResolution
  }) {

    const { getDataBasePath, getGlobalsBasePath, toBindPath } = RootCtxRenderer;

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
        path.startsWith(getDataBasePath()) ||
        path.startsWith(getGlobalsBasePath())
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
    return {
      ...this.proxyInstance.getGlobalVariables()
    };
  }

  buildInputData({ input, hash }) {
    const { getDefaultConfig } = BaseRenderer;

    const config = {};
    const handlers = {};

    // Add config

    Object.keys(getDefaultConfig())
      .filter(k => !!hash[k])
      .forEach(k => {
        config[k] = hash[k];
        delete hash[k];
      });

    // Add handlers

    const eventNamePattern = /^on\-/g;

    Object.keys(hash)
      .filter(k => k.match(eventNamePattern))
      .forEach(k => {
        const evtName = k.replace(eventNamePattern, '');
        handlers[evtName] = hash[k];
        delete hash[k];
      });


    // Add input data

    let addAll = false;
    if (!input) {
      input = {};
      // We will have to depend solely on the schema validation
      // that happens in RootProxy
      addAll = true;
    }

    for (const [key, value] of Object.entries(hash)) {
      if (value === undefined) {
        continue;
      }

      const k = `input.${key}`;

      const exists = () => {
        try {
          return (eval(k) !== undefined) || addAll;
        } catch (e) {
          return false;
        }
      }
      if (exists()) {
        eval(`${k} = value`);
      }
    }

    return {
      input, handlers, config
    }
  }

  addEventHandlers({ handlers, component }) {
    Object.keys(handlers).forEach(evtName => {
      const handler = this[handlers[evtName]];
      assert(
        handler instanceof Function,
        `Unknown event handler: ${handlers[evtName]}`
      );
      component.on(evtName, handler);
    });
  }

  // eslint-disable-next-line class-methods-use-this
  loadInlineComponent() {

    // eslint-disable-next-line prefer-rest-params
    const params = Array.from(arguments);
    const options = params.pop();

    const { hash } = options;
    let [componentSpec] = params;

    delete hash.ctx;

    const ref = hash.ref;
    delete hash.ref;

    switch (true) {
      case componentSpec && componentSpec.constructor.name === 'String':

        componentSpec = this.createComponent({
          hash,
          componentClass: components[componentSpec],
        });

        break;

      case componentSpec && componentSpec instanceof BaseComponent:

        const { handlers, config } = this.buildInputData({
          input: componentSpec.getInput(),
          hash,
        });

        // Note: there are some configs that need to be set on component instantiation,
        // and if such config are here, they will not not be useful
        componentSpec.config = config;

        this.addEventHandlers({ handlers, component: componentSpec });

        break;

      default:
        // We don't know what this is, return undefined so that BaseComponent.render(...) will
        // return an empty string
        return undefined;
    }

    if (ref) {
      this.#inlineComponentInstances[ref] = componentSpec;
    }

    return componentSpec;
  }

  createComponent({ hash, componentClass }) {

    const { input, handlers, config } = this.buildInputData({ hash });

    const component = new componentClass({
      input,
      parent: this,
      config,
    });

    this.addEventHandlers({ handlers, component });

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

  getBehaviours() {
    let behaviours = [];

    this.recursivelyInvokeMethod('behaviours').forEach(arr => {
      assert(arr.constructor.name == 'Array');
      behaviours = behaviours.concat(arr);
    });

    return behaviours;
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
