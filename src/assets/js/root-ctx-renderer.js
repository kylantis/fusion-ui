/* eslint-disable no-case-declarations */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */
/* eslint-disable func-names */
/* eslint-disable no-console */
/* eslint-disable no-restricted-syntax */

// eslint-disable-next-line no-undef
class RootCtxRenderer extends BaseRenderer {
  static syntheticAliasSeparator = '$$';

  #resolve;

  static #token;

  #mounted;

  constructor({
    id, input, loadable, parent,
  } = {}) {
    super({
      id, input, loadable, parent,
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

  load({ parent, token }) {
    if (!this.loadable()) {
      throw new Error(`${this.getId()} is not loadable`);
    }

    if (token !== RootCtxRenderer.#token && !this.isRoot()) {
      throw new Error(`Invalid token: ${token}`);
    }

    console.info(`Loading component - ${this.getId()}`);

    const { getMetaHelpers } = RootCtxRenderer;
    super.load();

    // Remove unused hbs helper(s)
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
          .bind(_this)({ options, ctx: this });
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

    const template = global[`template_${this.getAssetId()}`];

    const hbsInput = {
      ...this.getRootGlobals(),
      data: this.rootProxy,
    };

    this.hbsInput = hbsInput;

    // eslint-disable-next-line no-undef
    const html = Handlebars.template(template)(hbsInput, {
      helpers,
      partials: {},
      allowedProtoProperties: {
        ...allowedProtoProperties,
      },
      // strict: true,
    });

    const parentNode = document.getElementById(parent);
    parentNode.innerHTML = html;

    this.#mounted = true;

    this.#resolve();

    return this.promise
      .then(() => Promise.all(this.futures))
      .then(() => new Promise((resolve) => {
        const intervalId = setInterval(() => {
          if (this.renderOffset === 0) {
            clearInterval(intervalId);
            resolve();
          }
        }, 100);
      }));
  }

  getAssetId() {
    return this.getSyntheticMethod({ name: 'assetId' })();
  }

  getHelpers() {
    return this.getSyntheticMethod({ name: 'helpers' })();
  }

  getPathValue({ path }) {
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

  analyzeCondition({ path }) {
    const value = this.getPathValue({ path });

    const b = !!value;

    if (!b) {
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
    return this[`${autoPrefix
    // eslint-disable-next-line no-undef
      ? RootProxy.syntheticMethodPrefix : ''}${name}`].bind(this);
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

  getExecPath({
    fqPath,
    indexResolver,
  }) {
    const { getSegments, toObject } = RootCtxRenderer;
    if (!indexResolver) {
      // eslint-disable-next-line no-param-reassign
      indexResolver = path => this.blockData[path].index;
    }

    const basePath = 'this.getInput()';

    if (fqPath === '') {
      return basePath;
    }

    const segments = fqPath.split('__');
    const parts = [];

    if ((!this.isSynthetic(fqPath)) && !this.resolver) {
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
            path,
          });

          const arr = path.split('.');
          part = arr[arr.length - 1];
        } else {
          value = this.resolvePath0({
            path,
          });
        }

        const index = indexResolver(
          fqPath.split('__', i).concat([
            canonicalPart,
          ]).join('__'),
        );


        switch (true) {
          case value instanceof Array:
            part += `[${index}]`;
            break;
          case value instanceof Object:
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

    const result = parts.join('.');
    return result;
  }

  resolvePath({ fqPath, indexResolver, create }) {
    const arr = fqPath.split('%');
    let path = this.getExecPath({
      fqPath: arr[0],
      indexResolver,
    });
    if (arr[1]) {
      path += `%${arr[1]}`;
    }
    try {
      const value = this.resolvePath0({ path, create });
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

  resolvePath0({ path, create }) {
    const value = this.resolver && !path.startsWith('this.')
      ? this.resolver.resolve({ path, create })
    // eslint-disable-next-line no-eval
      : eval(path);
    return value;
  }

  static getMetaHelpers() {
    return ['storeContext', 'loadContext'];
  }

  // eslint-disable-next-line class-methods-use-this
  getRootGlobals() {
    // eslint-disable-next-line no-undef
    const { emptyString } = RootProxy;
    return {
      emptyString,
    };
  }

  // eslint-disable-next-line class-methods-use-this
  loadInlineComponent() {
    // eslint-disable-next-line prefer-rest-params
    const params = Array.from(arguments);
    const options = params.pop();

    const { hash } = options;
    const [componentSpec] = params;

    switch (true) {
      case componentSpec.constructor.name === 'String':
        return new global.components[componentSpec]({
          input: hash,
          parent: this,
        });

      default:
        assert(componentSpec instanceof BaseComponent);
        return componentSpec.clone({ parent: this });
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
