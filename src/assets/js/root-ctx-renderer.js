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

  #resolve;

  static #token;

  #mounted;

  #currentBindContext;

  #inlineComponentInstances;

  constructor({
    id, input, loadable, logger,
  } = {}) {
    super({
      id, input, loadable, logger,
    });

    // Initialze block data map
    this.blockData = {};

    this.syntheticContext = {};

    // Todo: make this configurable
    this.strict = false;

    this.promise = new Promise((resolve) => {
      this.#resolve = resolve;
    });

    this.futures = [];
    this.#mounted = false;

    this.renderOffset = 0;
    this.arrayBlocks = {};

    this.syntheticNodeId = [];
    this.#currentBindContext = [];

    this.blockHooks = {};
    this.eachContext = [];

    this.#inlineComponentInstances = {};
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

    // Todo: Remove unused hbs helper(s)
    // eslint-disable-next-line no-undef
    delete Handlebars.helpers.lookup;

    const componentHelpers = {};

    // Register dynamic helpers
    for (const helperName of this.getHelpers()) {
      componentHelpers[helperName] = this[helperName].bind(this);
    }

    const helpers = {
      ...componentHelpers,
      // Todo: clean up handlebars helpers before adding
      // eslint-disable-next-line no-undef
      ...Handlebars.helpers,
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
    const dataPaths = this.getSyntheticMethod({ name: 'dataPaths' })();
    const allowedProtoProperties = {};

    for (const path of dataPaths) {
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

          const hookKeys = Object.keys(this.blockHooks)
            .sort((e1, e2) => {

              const o1 = this.blockHooks[e1].order;
              const o2 = this.blockHooks[e2].order;

              return o1 < o2 ? -1 : o2 < o1 ? 1 : 0;
            });

          // Trigger block hooks
          const hooks = hookKeys
            .map(selector => {
              const { hookName, blockData } = this.blockHooks[selector];

              const hook = this[hookName].bind(this);
              assert(!!hook, `Block hook ${hookName} was not found`);

              return hook({
                node: document.querySelector(`#${this.getId()} ${selector}`),
                blockData,
                // This indicatea that this hook is triggered just before this component
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
            }, 50);
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

    const { fn, inverse, hash } = options;
    let [target, invert] = params;

    const nodeId = this.getSyntheticNodeId();

    const hookName = hash['transform'];
    const hookOrder = hash['transformOrder'];

    const conditional0 = (value) => {

      const b = this.analyzeConditionValue({
        value
      });
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
        return fn(ctx);
      } else if (inverse) {
        return inverse(ctx);
      }
    }

    if (target !== Object(target)) {
      // <target> is a literal
      return conditional0(target);
    }

    const { path, value } = target;

    if (
      !this.isSynthetic(path) &&
      this.enableDataBinding() && nodeId != undefined
    ) {
      this.proxyInstance.getDataPathHooks()[path][conditionalBlockHookName] = {
        nodeId, fn, inverse, hookMethod: hookName,
        blockData: global.clientUtils.deepClone(this.blockData),
      };
    }

    return conditional0(value);
  }

  forEach({ options, ctx, params }) {

    const {
      arrayBlockHookName, syntheticMethodPrefix
    } = RootProxy;
    const {
      htmlWrapperCssClassname, syntheticBlockKeyPrefix
    } = RootCtxRenderer;

    const { fn, inverse, hash } = options;
    const [{ path, value, canonicalPath }] = params;

    const nodeId = this.getSyntheticNodeId();

    const hookName = hash['transform'];
    const hookOrder = hash['transformOrder'];

    const forEach0 = (value) => {

      if (value && value.length) {

        const isSynthetic = this.isSynthetic(path);

        // Add the length to this.blockData

        const blockKey = isSynthetic ?
          `${syntheticBlockKeyPrefix}${path.replace(syntheticMethodPrefix, '')}` :
          canonicalPath;

        this.blockData[blockKey].length = value.length;

        let ret = "";

        for (let i = 0; i < value.length; i++) {

          if (isSynthetic) {
            // Update the current value of the synthetic context
            value[i];
          }

          // We need to wrap in a container, so that our :nth-child
          // directive below would work
          ret += `<div class="${htmlWrapperCssClassname}">
                    ${fn(this.rootProxy)}
                  </div>`;

          if (hookName) {

            // Regardless of whether data binding is enabled for the
            // entire component or not, the contents of this blocks must
            // contain valid html markup if a hook is specified
            assert(!!nodeId);

            this.blockHooks[`#${nodeId} > :nth-child(${i + 1})`] = {
              hookName,
              order: (hookOrder != undefined && global.clientUtils.isNumber(hookOrder)) ?
                hookOrder : RootCtxRenderer.#defaultHookOrder,
              blockData: global.clientUtils.deepClone(this.blockData)
            };
          }
        }
        return ret;

      } else {
        return inverse(ctx);
      }
    }

    if (
      !this.isSynthetic(path) &&
      this.enableDataBinding() && nodeId != undefined
    ) {
      this.proxyInstance.getDataPathHooks()[path][arrayBlockHookName] = {
        nodeId, fn, inverse, hookMethod: hookName,
      };
      this.eachContext.push(path);
    }

    return forEach0(value);
  }

  static getMetaHelpers() {
    return [
      'storeContext', 'loadContext', 'forEach', 'conditional',
      'startAttributeBindContext', 'endAttributeBindContext',
      'startTextNodeBindContext', 'setSyntheticNodeId', 'resolveMustache',
      'invokeTransform'
    ];
  }

  static getDataVariables() {
    return ['@first', '@last', '@index', '@key', '@random'];
  }

  setSyntheticNodeId() {
    const id = global.clientUtils.randomString();
    this.syntheticNodeId.push(id);
    return id;
  }

  getSyntheticNodeId() {
    return this.syntheticNodeId.pop();
  }

  invokeTransform() {
    // eslint-disable-next-line prefer-rest-params
    const params = Array.from(arguments);
    const options = params.pop();

    const [transform, data] = params;
    return this[transform](data)
  }

  startAttributeBindContext() {

    if (!this.enableDataBinding()) {
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

    if (!this.enableDataBinding()) {
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

    const { syntheticMethodPrefix } = RootProxy;
    const [{ path, value }, transform] = params;

    if (
      this.enableDataBinding() &&
      !path.startsWith(syntheticMethodPrefix) &&
      this.#currentBindContext.length
    ) {
      // Data-bind support exists for this mustache statement
      this.#bindMustache({ path, value, transform });
    }

    return (value && transform) ? this[transform](value) : this.toHtml(value);
  }

  #bindMustache({ path, value, transform }) {

    const { dataPathRoot, pathSeparator, textNodeHookName } = RootProxy;
    const flickeringMode = false;
    const ctx = this.#currentBindContext.pop();

    assert(ctx.type == textNodeHookName);

    this.proxyInstance.getDataPathHooks()[path]
      .push({ ...ctx, transform });

    // Todo: Remove this code
    if (flickeringMode) {
      if (value !== Object(value) && path.startsWith(`${dataPathRoot}${pathSeparator}`)) {
        window.setInterval(() => {
          if (!this.isMounted()) {
            return;
          } s
          const _this = this;
          const p = [
            '_this.getInput()',
            path.replace(`${dataPathRoot}${pathSeparator}`, '')
          ].join('.')

          eval(`${p} = '${clientUtils.randomString()}'`);
        }, 1);
      }
    }
  }

  getPathValue({ path, includePath = false }) {
    return this.resolvePath({
      fqPath: path,
      includePath,
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

  analyzeConditionValue({ value }) {
    if (!value) {
      return false;
    }
    const type = value.constructor.name;

    // Note: type === 'Map' && value.size === 0 may not be needed
    // below because a call to getPathValue() will
    // cause maps to always be serialized to Json Object

    // eslint-disable-next-line default-case
    switch (true) {
      case type === 'Array' && value.length === 0:
      case type === 'Map' && value.size === 0:
      case type === 'Object' && Object.keys(value).length === 0:
        // Todo: The Object.keys(...) condition above is not needed
        // becuase it's not possible to have an empty object due to the
        // way we generate strongly typed classes from hbs templates
        // At the barest minimum, we may have an object with a single key
        // that has a null value
        return false;
    }

    return true;
  }

  getBlockData({ path, dataVariable }) {

    const { toObject } = RootCtxRenderer;

    // eslint-disable-next-line no-unused-vars
    const blockData = this.blockData[path];

    let value = this.syntheticContext[path] !== undefined
      ? this.syntheticContext[path].value
      : this.getPathValue({ path });

    if (this.resolver) {
      assert(value instanceof Map || value instanceof Array);

      if (value instanceof Map) {
        assert(this.resolver);
        value = toObject({ map: value });
      }
    }

    const length = value instanceof Array
      ? value.length : Object.keys(value).length;

    switch (dataVariable) {
      case '@first':
        return blockData.index === 0;

      case '@last':
        return blockData.index === length - 1;

      case '@index':
        return blockData.index;

      case '@key':
        return Object.keys(value)[blockData.index]
          // Remove $_ prefixes for map keys, if applicable
          .replace(/^\$_/g, '');

      case '@random':
        return blockData.random;

      default:
        throw Error(`Unknown data variable: ${dataVariable}`);
    }
  }

  doBlockInit({ path, blockId }) {
    const blockData = this.blockData[path] || (this.blockData[path] = {});

    if (blockId) {
      // eslint-disable-next-line no-unused-expressions
      blockData.blockIds
        ? blockData.blockIds.push(blockId) : (blockData.blockIds = [blockId]);
    }

    blockData.index = -1;
  }

  doBlockUpdate({ path }) {

    const { arrayBlockHookName } = RootProxy;
    const blockData = this.blockData[path];
    // eslint-disable-next-line no-plusplus
    blockData.index++;
    blockData.random = global.clientUtils.randomString();

    if (this.eachContext.length) {

      this.proxyInstance.getDataPathHooks()
      [this.eachContext.pop()]
      [arrayBlockHookName].blockData =
        global.clientUtils.deepClone(this.blockData);

      assert(!this.eachContext.length);
    }
  }

  toRealPath(path) {
    const { getDataBasePath } = RootCtxRenderer;

    return this.getExecPath({ fqPath: path, })
      .replace(`${getDataBasePath()}.`, '');
  }

  doBlockNext({ path }) {

    const { syntheticBlockKeyPrefix } = RootCtxRenderer;

    const isSynthetic = path.startsWith(syntheticBlockKeyPrefix);

    const isMap = isSynthetic ?
      this.syntheticContext[path].value.constructor.name == 'Object' :
      this.proxyInstance.isMapPath(
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

  setSyntheticContext({
    alias,
    value,
  }) {

    const { syntheticMethodPrefix } = RootProxy;
    const { syntheticAliasSeparator, toObject } = RootCtxRenderer;

    const [construct, syntheticName] = alias.split(syntheticAliasSeparator);

    if (value.constructor.name === 'Map') {
      assert(construct === 'each');
      // eslint-disable-next-line no-param-reassign
      value = toObject({ map: value });
    }

    this.syntheticContext[alias] = {
      value,
    };

    if (construct === 'each') {
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
            // Note: this is used by TenplateProcessor during sub-path
            // traversal, as the proxy above this is designed for use
            // during runtime
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

        default:
          throw Error(
            `Unknown data type: ${JSON.stringify(value)} returned by method: ${syntheticMethodPrefix}${syntheticName}`
          );
      }
    } else {
      // eslint-disable-next-line no-undef
      assert(construct === 'with');

      // Note that since this synthetic invocation is
      // for an #if block (or rather #with turned #if block)

      this.syntheticContext[alias].current = value;
    }

    // We also need to store the object proxy as well. This will be needed
    // in doBlockNext(...) when we need to reset the last lookup value
    this.syntheticContext[alias].proxyValue = value;

    return value;
  }

  // eslint-disable-next-line class-methods-use-this
  createSyntheticInvocation(name) {
    // Todo: create a caching mechanism
    // then after fetching the data, dynamically create
    // a function that returns that data, then return
    // the function name instead.

    return `this.${name}()`;
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

  getExecPath({
    fqPath,
    indexResolver,
    addBasePath = true
  }) {

    const { pathSeparator, syntheticMethodPrefix, globalsBasePath } = RootProxy;
    const { toObject, getDataVariables, getDataBasePath } = RootCtxRenderer;

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

        const path = this.getExecPath({
          fqPath: parts.slice(0, i + len)
            .concat([parent])
            .join(pathSeparator)
            .replace(`${addBasePath ? `${basePath}${pathSeparator}` : ''}`, ''),
          indexResolver,
          addBasePath,
        })

        // if path ends with w.x.$_abc, part should be x.$_abc, not $_abc,
        // because $_abc should be translated as the index placeholder: _$
        part = path.split(/\.(?!\$_)/g).pop();

        let value = this.resolvePath0({ path });

        if (this.resolver) {
          assert(
            value instanceof Map || value instanceof Array,
            `${path} should resolve to either a Map or an Array`
          );

          if (value instanceof Map) {
            value = toObject({ map: value });
          }
        }

        const canonicalPath = fqPath.split('__', i).concat([
          parent,
        ]).join('__')

        const index = indexResolver(canonicalPath);

        const isArray = value instanceof Array;
        const isMap = value instanceof Object;

        if (isArray || isMap) {

          const firstChild = isArray ? value[0] : value[Object.keys(value)[0]];

          const dataVariable = segments[i + 1] || '';

          if (
            i == segments.length - 2 &&
            (firstChild !== Object(firstChild) || firstChild instanceof BaseComponent) &&
            getDataVariables().includes(dataVariable)
          ) {

            assert(!suffix);

            // Since this array/map contain literals as it's children and has one
            // segment ahead, we expect the next segment to be a dataVariable
            // Resolve this getExecPath(...) call to a synthetic method that in
            // turn invokes getBlockData(...)

            const syntheticMethodName = `${syntheticMethodPrefix}${
              // Method name should be a word
              canonicalPath.replace(/[\[|\]]/g, '_')
              }_${dataVariable.replace(/^@/g, '')}`;

            if (!this[syntheticMethodName]) {
              this[syntheticMethodName] = Function(`
                return this.getBlockData({
                    path: "${canonicalPath}",
                    dataVariable: "${dataVariable}"
                })
              `);

              // Since we are resolving to a synthetic method name (because this is a
              // literal collection), there is a rare possibility that the developer
              // never accesses {{.}} inside the #each block, thereby causing the PathResolver
              // to throw a "redundant path" error for <canonicalPath>. Hence, we need to 
              // at least access index 0 at compile-time

              if (this.resolver && isArray) {
                this.resolver.resolve({ path: `${path}[0]` })
              }
            }

            // In startTextNodeBindContext(), we performed a push to this.#currentBindContext
            // Since this is transformed to a synthetic method and data-binding will never 
            // happen via this.#bindMustache, we need to pop
            this.#currentBindContext.pop();

            return `this.${syntheticMethodName}()`;
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
          // Use getSyntheticMethod to take advantage
          // of invocation caching
          part = this.createSyntheticInvocation(part);
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

      parts[0] = this.createSyntheticInvocation(
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

  resolvePath({ fqPath, indexResolver, create, includePath }) {
    const { syntheticMethodPrefix } = RootProxy;

    const arr = fqPath.split('%');
    let path = this.getExecPath({
      fqPath: arr[0],
      indexResolver,
    });

    const isSynthetic = path.startsWith(`this.${syntheticMethodPrefix}`);

    // In some case cases, data paths can resolve to a synthetic
    // method, for example when resolving data variables for literal
    // arrays/maps
    if (isSynthetic) {
      const value = eval(path);

      return includePath ? {
        path: path.replace(`this.`, '').replace(`()`, ''),
        value
      } : value;
    }

    if (arr[1]) {
      path += `%${arr[1]}`;
    }
    try {
      const value = this.resolvePath0({
        path, create, includePath, canonicalPath: arr[0],
      });
      return value;
    } catch (e) {
      if (this.strict) {
        throw e;
      } else {
        this.logger.error(e);
        return '';
      }
    }
  }

  toBindPath({ path }) {
    const { dataPathRoot, pathSeparator, globalsBasePath } = RootProxy;
    const { escapeRegExp } = global.clientUtils;
    const { getDataBasePath, getGlobalsBasePath } = RootCtxRenderer;

    let prefix = getDataBasePath();
    let repl = '';

    if (path.startsWith(getGlobalsBasePath())) {
      prefix = getGlobalsBasePath();
      repl = `${globalsBasePath}${pathSeparator}`;
    }

    return `${dataPathRoot}${pathSeparator}${path.replace(
      RegExp(`${escapeRegExp(prefix)}\\.?`),
      repl
    )}`
  }

  resolvePath0({ path, create, includePath, canonicalPath }) {

    const { syntheticMethodPrefix } = RootProxy;
    const { getDataBasePath, getGlobalsBasePath } = RootCtxRenderer;

    const isSynthetic = path.startsWith(`this.${syntheticMethodPrefix}`);

    const value = this.resolver && !isSynthetic ? this.resolver.resolve({ path, create })
      // eslint-disable-next-line no-eval
      : eval(path);

    if (isSynthetic) {

      // This is likely a synthetic invocation, i.e.
      // this.s$AbCdEf().a.b...

      assert(!includePath);

      return value;

    } else {

      assert(
        this.resolver ||
        path.startsWith(getDataBasePath()) ||
        path.startsWith(getGlobalsBasePath())
      );

      let bindPath = this.toBindPath({ path });

      const dataVariableSuffixRegex = /\[\'@\w+\'\]$/g;
      const dataVariableSuffix = bindPath.match(dataVariableSuffixRegex);

      if (dataVariableSuffix) {

        // In getExecPath(...), <dataVariableSuffix> was transformed to use a
        // square bracket notation, instead of a dot notation. Convert back
        // to dot notation, which is what is used in <dataPathHooks>

        bindPath = bindPath.replace(
          dataVariableSuffixRegex,
          `.${dataVariableSuffix[0].replace('[\'', '').replace('\']', '')
          }`
        );
      }

      // This is a data path
      return includePath ? {
        path: bindPath,
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

    const config = {};
    const handlers = {};

    // Add config

    this.getConfigurationProperties()
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
    });

    component.config = config;
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
      return global.preprocessor.className;
    }
  }

  /**
   * These are boolean operators that the component wants to exclusively implement, rather
   * than combine with the parents as list of predicates
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

  enableDataBinding() {
    return this.getSyntheticMethod({ name: 'enableDataBinding' })();
  }

  getGlobalHelpers() {
    return this.getSyntheticMethod({ name: 'globalHelpers' })();
  }
}
module.exports = RootCtxRenderer;
