/* eslint-disable no-console */
/* eslint-disable no-restricted-syntax */

// eslint-disable-next-line no-undef
class RootCtxRenderer extends BaseRenderer {
    static syntheticAliasSeparator = '$$';

    constructor({
      id, input,
    } = {}) {
      super({ id, input });

      // Initialze block data map
      this.blockData = {};

      this.syntheticContext = {};

      // Todo: make this configurable
      this.strict = false;
    }

    load() {
      super.load();

      const { getMetaHelpers } = RootCtxRenderer;

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
        componentHelpers[helperName] = () => {
          // eslint-disable-next-line prefer-rest-params
          const params = Array.from(arguments);
          const options = params.pop();

          _this[helperName]
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
        data: this.proxy,
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

      this.renderHtml({ html });
    }

    getAssetId() {
      return this.getSyntheticMethod({ name: 'assetId' })();
    }

    getHelpers() {
      return this.getSyntheticMethod({ name: 'helpers' })();
    }

    getPathValue({ path }) {
      // eslint-disable-next-line no-undef
      const { syntheticMethodPrefix } = RootProxy;
      let value;

      switch (true) {
        case this.isSynthetic(path)
                && path.split('__').length === 1:

          // eslint-disable-next-line no-case-declarations
          const p = path.replace(syntheticMethodPrefix, '');
          if (this[p]) {
            // eslint-disable-next-line no-param-reassign
            path = p;
          }

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
      const parts = [];
      const segments = original.split('.');

      // eslint-disable-next-line no-plusplus
      for (let i = 0; i < segments.length; i++) {
        let segment = segments[i];
        // eslint-disable-next-line no-restricted-globals
        if (!isNaN(segment)) {
          // this is an array index
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

      // eslint-disable-next-line default-case
      switch (true) {
        case type === 'Array' && value.length === 0:
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

    setSyntheticContext({
      alias,
      value,
    }) {
      this.syntheticContext[alias] = {
        value,
      };

      const construct = alias.split(RootCtxRenderer.syntheticAliasSeparator)[0];

      if (construct === 'each') {
        // eslint-disable-next-line default-case
        switch (true) {
          case value.constructor.name === 'Array':
            if (this.onClient) {
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
            if (this.onClient) {
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

    getExecPath({
      fqPath,
      indexResolver,
    }) {
      if (!indexResolver) {
        // eslint-disable-next-line no-param-reassign
        indexResolver = path => this.blockData[path].index;
      }

      const segments = fqPath.split('__');
      const parts = [];

      if ((!this.isSynthetic(fqPath)) && !this.resolver) {
        parts.push('this.getInput()');
      }

      const len = Number(parts.length);

      // eslint-disable-next-line no-plusplus
      for (let i = 0; i < segments.length; i++) {
        let part = segments[i];

        if (part.endsWith('_$')) {
          [part] = part.split('_$');

          // This should resolve to either an array or object
          const prefix = parts.slice(0, i + len);

          const path = prefix.concat([part]).join('.');

          const value = this.resolvePath0({ path });

          const index = indexResolver(
            fqPath.split('__', i).concat([
              part,
            ]).join('__'),
          );

          switch (true) {
            case value instanceof Array:
              part += `[${index}]`;
              break;
            case value instanceof Object:
              part += `['${Object.keys(value)[index]}']`;
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

        parts.push(part);
      }

      const result = parts.join('.');
      return result;
    }

    resolvePath({ fqPath, indexResolver }) {
      const path = this.getExecPath({ fqPath, indexResolver });
      try {
        return this.resolvePath0({ path });
      } catch (e) {
        if (this.strict) {
          throw e;
        } else {
          console.error(e);
          return '';
        }
      }
    }

    resolvePath0({ path }) {
      return this.resolver ? this.resolver.resolve(path)
      // eslint-disable-next-line no-eval
        : eval(path);
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
}
module.exports = RootCtxRenderer;
