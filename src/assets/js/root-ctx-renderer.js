/* eslint-disable no-case-declarations */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */
/* eslint-disable func-names */
/* eslint-disable no-console */
/* eslint-disable no-restricted-syntax */

// eslint-disable-next-line no-undef
class RootCtxRenderer extends BaseRenderer {
  static syntheticAliasSeparator = '$$';

  static htmlWrapperCssClassname = 'mst-w';

  #resolve;

  static #token;

  #mounted;

  #currentBindContext;

  constructor({
    id, input, loadable, parent, logger,
  } = {}) {
    super({
      id, input, loadable, parent, logger,
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

    // Todo: support conditional, #if, #each
    this.blockHooks = {};
  }

  isMounted() {
    return this.#mounted;
  }

  static setToken(token) {
    if (RootCtxRenderer.#token) {
      throw new Error(`Could not set token: ${token}`);
    }
    RootCtxRenderer.#token = token;
  }

  load({ container, token }) {
    if (!this.loadable()) {
      throw new Error(`${this.getId()} is not loadable`);
    }

    if (token !== RootCtxRenderer.#token && !this.isRoot()) {
      throw new Error(`Invalid token: ${token}`);
    }

    console.info(`Loading component - ${this.getId()}`);

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
    // Register meta helper(s)
    for (const helperName of getMetaHelpers()) {
      // eslint-disable-next-line no-underscore-dangle
      const _this = this;
      componentHelpers[helperName] = function () {
        // eslint-disable-next-line prefer-rest-params
        const params = Array.from(arguments);
        const options = params.pop();

        return _this[helperName]
          .bind(_this)({ options, ctx: this, params });
      };
    }

    const helpers = {
      // eslint-disable-next-line no-undef
      ...Handlebars.helpers,
      ...componentHelpers,
    };

    // Control prototype access, to prevent attackers from executing
    // arbitray code on user machine, more info here:
    // https://handlebarsjs.com/api-reference/runtime-options.html#options-to-control-prototype-access
    const dataPaths = this.getSyntheticMethod({ name: 'dataPaths' })();
    const allowedProtoProperties = {};
    for (const path of dataPaths) {
      allowedProtoProperties[path] = true;
    }

    const { schema, template } =
      global[`metadata_${this.getAssetId()}`];

    if (!global.isServer) {
      this.proxyInstance.setSchema({ schema });
    }

    this.template = template;

    const hbsInput = {
      ...this.getRootGlobals(),
      data: this.rootProxy,
    };

    this.hbsInput = hbsInput;

    this.preRender();

    // eslint-disable-next-line no-undef
    const html = Handlebars.template(this.template)
      (hbsInput, {
        helpers,
        partials: {},
        allowedProtoProperties: {
          ...allowedProtoProperties,
        },
        // strict: true,
      });

    this.postRender({
      html: `<div id='${this.getId()}' class='${htmlWrapperCssClassname}'>${html}</div>`, 
      container 
    });

    // trigger block hooks
    Object.keys(this.blockHooks).forEach(selector => {
      const hookName = this.blockHooks[selector];

      const hook = this[hookName].bind(this);
      assert(!!hook, `Block hook ${hookName} was not found`);

      hook(document.querySelector(`#${this.getId()} ${selector}`));
    });

    this.#mounted = true;

    this.#resolve();

    return this.promise
      .then(() => Promise.all(this.futures))
      .then(() => new Promise((resolve) => {
        // Even after all promises are resolved, we need to wait
        // for this component to be fully mounted. This is
        // especially application if there async custom blocks or
        // sub-components inside this component
        const intervalId = setInterval(() => {
          if (this.renderOffset === 0) {

            if (global.isServer) {
              global.html = document.getElementById(container).outerHTML;
            }

            clearInterval(intervalId);
            resolve();
          }
        }, 100);
      }));
  }

  conditional({ options, ctx, params }) {

    const { dataPathRoot, pathSeparator } = RootProxy;
    const { fn } = options;
    const nodeId = this.getSyntheticNodeId();

    if (!global.isServer) {
      const path = this.getExecPath({
        fqPath: params[0],
        addBasePath: false,
      });

      this.proxyInstance.getDataPathHooks()

      [`${dataPathRoot}${pathSeparator}${path}`]
      ['conditionalBlock'] = {
        nodeId, fn,
        parentBlockData: this.getParentBlockData({ path: params[0] }),

      };
    }

    const value = this.getPathValue({ path: params[0] });
    const conditional = this.analyzeConditionValue({ value });

    if (conditional) {
      return fn(ctx);
    }
  }

  getParentBlockData({ path }) {
    const blockData = {};
    Object.keys(this.blockData)
      .filter(k => path.startsWith(k) && k !== path)
      .forEach(k => blockData[k] = this.blockData[k]);

    return blockData;
  }

  forEach({ options, ctx, params }) {
    const { fn, hash } = options;
    const nodeId = this.getSyntheticNodeId();

    if (!global.isServer) {
      const { dataPathRoot, pathSeparator } = RootProxy;

      const path = this.getExecPath({
        fqPath: params[0],
        addBasePath: false,
      });

      this.proxyInstance.getDataPathHooks()
      [`${dataPathRoot}${pathSeparator}${path}`]
      ['arrayBlock'] = {
        nodeId, fn,
        parentBlockData: this.getParentBlockData({ path: params[0] }),
      };
    }

    const value = this.getPathValue({ path: params[0] });

    var ret = "";
    const hookMethod = hash['hook'];

    for (var i = 0, j = value.length; i < j; i++) {
      ret = ret + `${fn(this.rootProxy)}`;
      if (hookMethod) {
        this.blockHooks[`#${nodeId} > :nth-child(${i + 1})`] = hookMethod;
      }
    }

    return ret;
  }

  static getMetaHelpers() {
    return [
      'storeContext', 'loadContext', 'forEach', 'conditional',
      'startAttributeBindContext', 'endAttributeBindContext',
      'startTextNodeBindContext', 'setSyntheticNodeId', 'resolveMustache'
    ];
  }

  resolveMustache({ options }) {
    const { hash } = options;

    const { path, value } = hash[Object.keys(hash)[0]];

    if (path && this.#currentBindContext.length) {
      // Data-bind support exists for this mustache statement
      this.#bindMustache({ path, value });
    }

    return Object(value) !== value ? value : JSON.stringify(value);
  }

  #bindMustache({ path, value }) {

    const { dataPathRoot, pathSeparator } = RootProxy;
    const flickeringMode = false;
    const ctx = this.#currentBindContext.pop();

    assert(ctx.type == 'textNode');

    this.proxyInstance.getDataPathHooks()[path]
      .push(ctx);

    if (flickeringMode) {
      if (value !== Object(value) && path.startsWith(`${dataPathRoot}${pathSeparator}`)) {
        window.setInterval(() => {
          if (!this.#mounted) {
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

  setSyntheticNodeId() {
    const id = global.clientUtils.randomString();
    this.syntheticNodeId.push(id);
    return id;
  }

  getSyntheticNodeId() {
    assert(this.syntheticNodeId.length === 1);
    return this.syntheticNodeId.pop();
  }

  startAttributeBindContext() {
    return '';
  }

  endAttributeBindContext() {
    const id = global.clientUtils.randomString();
    return `k-ab-${id}`;
  }

  startTextNodeBindContext() {
    assert(this.#currentBindContext.length === 0);
    const id = global.clientUtils.randomString();
    this.#currentBindContext.push({
      type: 'textNode',
      nodeId: id,
    });
    return `${id}`;
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

  getMapPaths() {
    const f = this.getSyntheticMethod({ name: 'mapPaths' });
    return f ? f() : [];
  }

  getPathValue({ path, fromMustache = false }) {
    let value;

    switch (true) {
      case this.isSynthetic(path)
        && path.split('__').length === 1:

        // eslint-disable-next-line no-param-reassign
        path = path
          .replace('_@', '');

        // eslint-disable-next-line no-eval
        value = eval(this.createSyntheticInvocation(path));
        break;

      default:
        value = this.resolvePath({
          fqPath: path,
          fromMustache,
        });
        break;
    }

    return value;
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
          throw new Error(`Unknown index: ${segment} for path: ${original}`);
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

  analyzeCondition({ path }) {
    return this.analyzeConditionValue({
      value: this.getPathValue({ path })
    });
  }

  static getDataVariables() {
    return ['@first', '@last', '@index', '@key', '@random'];
  }

  getBlockData({ path, dataVariable }) {
    // eslint-disable-next-line no-unused-vars
    const blockData = this.blockData[path];

    const value = this.syntheticContext[path] !== undefined
      ? this.syntheticContext[path].value
      : this.getPathValue({ path });

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
        return Object.keys(value)[blockData.index];

      case '@random':
        return blockData.random;

      default:
        throw new Error(`Unknown data variable: ${dataVariable}`);
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
    const blockData = this.blockData[path];
    // eslint-disable-next-line no-plusplus
    blockData.index++;
    blockData.random = global.clientUtils.randomString();
  }

  getSyntheticContext({
    alias,
    key,
  }) {
    return this.syntheticContext[alias][key];
  }

  static toObject({ map }) {
    const { toObject } = RootCtxRenderer;
    const out = Object.create(null);
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
    const { toObject } = RootCtxRenderer;
    const construct = alias.split(RootCtxRenderer.syntheticAliasSeparator)[0];

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
                if (!Number.isNaN(parseInt(prop, 10))) {
                  this.syntheticContext[alias].current = v;
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
                if (!Object.getPrototypeOf(obj)[prop]) {
                  this.syntheticContext[alias].current = v;
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
      assert(construct === 'with');

      // Note that since this synthetic invocation is
      // for an #if block (or rather #with turned #if block),
      // the invocation happened from our object proxy,
      // hence no need to

      this.syntheticContext[alias].current = value;
    }

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
    autoPrefix = true,
  }) {
    const f = this[`${autoPrefix
      // eslint-disable-next-line no-undef
      ? RootProxy.syntheticMethodPrefix : ''}${name}`];
    return f ? f.bind(this) : null;
  }

  static getSegments({ original }) {
    const hasIndex = /\[[0-9]+\]/g;

    const indexes = (original.match(hasIndex) || []);

    const segments = [
      original.replace(indexes.join(''), ''),
      ...indexes,
    ];
    return segments;
  }

  getDataBasePath() {
    return 'this.getInput()';
  }

  getExecPath({
    fqPath,
    indexResolver,
    addBasePath = true
  }) {

    const qq = fqPath.length;

    if (fqPath === '') {
      return this.getDataBasePath();
    }

    const { getSegments, toObject, getDataVariables } = RootCtxRenderer;
    const { pathSeparator, syntheticMethodPrefix } = RootProxy;

    if (!indexResolver) {
      // eslint-disable-next-line no-param-reassign
      indexResolver = path => this.blockData[path].index;
    }

    if (this.isSynthetic(fqPath)) {
      addBasePath = false;
    }

    const basePath = addBasePath ? this.getDataBasePath() : '';

    const segments = fqPath.split(pathSeparator);
    const parts = [];

    if (!this.resolver && basePath.length) {
      parts.push(basePath);
    }

    const len = Number(parts.length);

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < segments.length; i++) {
      let part = segments[i];

      const partSegments = getSegments({ original: part });
      [part] = partSegments;
      partSegments.splice(0, 1);
      const suffix = partSegments.join('');

      if (part.endsWith('_$')) {

        [part] = part.split(/_\$$/);
        const canonicalPart = part;

        // This should resolve to either an array or object
        const prefix = parts.slice(0, i + len);

        let path = prefix.concat([part]).join('.');

        let value;

        if (part.endsWith('_$')) {

          // For multidimensional arrays, it's common to have a path like
          // ..._$_$
          path = this.getExecPath({
            fqPath: path
              .replace(`${basePath}.`, ''),
            indexResolver,
          });

          value = this.resolvePath0({
            path: `${addBasePath ? '' : 'this.getInput().'}${path}`,
          });

          const arr = path.split('.');
          part = arr[arr.length - 1];

        } else {

          value = this.resolvePath0({
            path: `${addBasePath ? '' : 'this.getInput().'}${path}`,
          });
        }

        const index = indexResolver(
          fqPath.split('__', i).concat([
            canonicalPart,
          ]).join('__'),
        );

        const isArray = value instanceof Array;
        const isMap = value instanceof Object;

        if (isArray || isMap) {
          const firstChild = isArray ? value[0] : value[Object.keys(value)[0]];

          const dataVariable = segments[i + 1] || '';

          if (
            i == segments.length - 2 &&
            firstChild !== Object(firstChild) &&
            getDataVariables().includes(dataVariable)
          ) {

            // Since this array/map contain literals as it's children and has one
            // segment ahead, we expect the next segment to be a dataVariable
            // Resolve this getExecPath(...) call to a synthetic method that in
            // turn invokes getBlockData(...)

            const path =
              [...parts, part]
                .join(pathSeparator)
                .replace(
                  new RegExp(`^${global.clientUtils.escapeRegExp(basePath)
                    }${pathSeparator}`), ''
                )
                .replace(/\[[0-9]+\]/g, '_$')

            const syntheticMethodName = `${syntheticMethodPrefix}${path}_${dataVariable.replace(/^@/g, '')}`;

            if (!this[syntheticMethodName]) {
              this[syntheticMethodName] = Function(`
                return this.getBlockData({
                    path: "${path}",
                    dataVariable: "${dataVariable}"
                })
              `);
            }

            return syntheticMethodName;
          }
        }

        switch (true) {

          case isArray:
            part += `[${index}]`;
            break;

          case isMap:
            if (this.resolver) {
              // This may not be the case for synthetic scenario
              assert(value.constructor.name === 'Map');
              value = toObject({ map: value });
            }
            part += `.${Object.keys(value)[index]}`;
            break;
          default:
            throw new Error(`Unknown path: ${path}`);
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
      parts[0] = this.createSyntheticInvocation(fqPath);
    }

    return parts
      .map((part, index) => {
        // If the last segment is a data variable, use a square bracket
        // notation instead of a dot notation to access the property
        return index == 0 ? part : part.startsWith('@') ? `['${part}']` : `.${part}`;
      })
      .join('');
  }

  resolvePath({ fqPath, indexResolver, create, fromMustache }) {
    const { syntheticMethodPrefix } = RootProxy;

    const arr = fqPath.split('%');
    let path = this.getExecPath({
      fqPath: arr[0],
      indexResolver,
    });

    // In some case cases, data paths can resolve to a synthetic
    // method, for example when resolving data variables for literal
    // arrays/maps
    if (path.startsWith(syntheticMethodPrefix)) {
      const value = this[path]();
      return fromMustache ? {
        value
      } : value;
    }

    if (arr[1]) {
      path += `%${arr[1]}`;
    }
    try {
      const value = this.resolvePath0({ path, create, fromMustache });
      return value;
    } catch (e) {
      if (this.strict) {
        throw e;
      } else {
        console.error(e);
        return '';
      }
    }
  }

  resolvePath0({ path, create, fromMustache }) {
    const { dataPathRoot, pathSeparator, syntheticMethodPrefix } = RootProxy;

    const value = this.resolver && !path.startsWith('this.')
      ? this.resolver.resolve({ path, create })
      // eslint-disable-next-line no-eval
      : eval(path);

    if (path.startsWith(`this.${syntheticMethodPrefix}`)) {

      // This is likely a synthetic invocation, i.e.
      // this.s$AbCdEf().a.b...

      // We only perform indirections to resolveMustache(...) for
      // data paths
      assert(!fromMustache);

      return value;

    } else {

      assert(this.resolver || path.startsWith(this.getDataBasePath()));

      // This is a data path
      return fromMustache ? {
        path: `${dataPathRoot}${pathSeparator}${path.replace(`${this.getDataBasePath()}.`, '')}`,
        value
      } : value;
    }
  }

  // eslint-disable-next-line class-methods-use-this
  getRootGlobals() {
    // eslint-disable-next-line no-undef
    const { emptyString } = RootProxy;
    return {
      emptyString,
      // Todo: remove
      anyString: global.clientUtils.randomString(),
    };
  }

  loadComponentByName({ name, hash }) {

    const events = new global.components[name]({ input: {} }).events();
    const handlers = {};

    const input = {};
    Object.keys(hash)
      .filter(k => {
        const evtName = k.replace(/on\-?/g, '')
        const isEvent = events.includes(evtName);
        if (isEvent) {
          handlers[evtName] = hash[k];
        }
        return !isEvent;
      }).forEach(k => {
        input[k] = hash[k];
      });

    const component = new global.components[name]({
      input,
      parent: this,
    });

    Object.keys(handlers).forEach(evt => {
      const handler = this[handlers[evt]];
      assert(handler instanceof Function);
      component.on(evt, handler);
    });

    return component;
  }

  // eslint-disable-next-line class-methods-use-this
  loadInlineComponent() {
    // eslint-disable-next-line prefer-rest-params
    const params = Array.from(arguments);
    const options = params.pop();

    const { hash } = options;
    const [componentSpec] = params;

    switch (true) {
      case componentSpec && componentSpec.constructor.name === 'String':
        return this.loadComponentByName({ name: componentSpec, hash });

      case componentSpec && componentSpec instanceof BaseComponent:
        return componentSpec.clone({ parent: this });

      default:
        throw new Error(`Unknown sub-component in ${this.getId()}`);
    }
  }

  clone({ parent }) {
    const clonedInput = global.clientUtils.clone(this.getInput());
    return new this.constructor({
      // eslint-disable-next-line no-eval
      input: eval(`module.exports=${clonedInput}`),
      parent,
    });
  }
}
module.exports = RootCtxRenderer;
