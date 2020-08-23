/* eslint-disable prefer-destructuring */
/* eslint-disable prefer-const */

// eslint-disable-next-line no-undef
class CustomCtxRenderer extends RootCtxRenderer {
    static partialIdHash = '__id';

    static partialNameHash = '__name';

    static partialIsRootHash = '__isRoot';

    constructor({
      id, input,
    } = {}) {
      super({ id, input });

      this.canonicalHash = {};
      this.decorators = {};
    }

    storeContext({ options, ctx }) {
      const { emptyObject, emptyString } = RootProxy;
      const { partialIdHash, partialIsRootHash } = CustomCtxRenderer;

      const { hash, fn } = options;
      this.decorators[hash[partialIdHash]] = {
        fn,
        data: hash[partialIsRootHash] ? emptyObject : ctx,
      };

      return emptyString;
    }

    loadContext({ options, ctx }) {
      const { emptyObject, emptyString } = RootProxy;
      const {
        partialIdHash,
        partialNameHash,
      } = CustomCtxRenderer;

      let { hash, fn } = options;

      const partialName = hash[partialNameHash];
      let type = 'external';

      if (hash[partialIdHash]) {
        assert(fn(emptyObject) === emptyString);

        // The referenced partial is an inline partial
        const decorator = this.decorators[hash[partialIdHash]];

        fn = decorator.fn;
        // eslint-disable-next-line no-param-reassign
        ctx = decorator.data;

        type = 'inline';
      }

      console.log(`Loading ${type} partial {{> ${partialName} }}`);

      return this.renderBlock({
        data: ctx,
        options: {
          ...options,
          fn,
        },
      });
    }

    wrapDataWithProxy(data) {
      const { isProxyPath } = CustomCtxRenderer;
      switch (true) {
        case data !== Object(data):
          return data;

        case data instanceof Array:
          return data.map(this.wrapDataWithProxy);

        default:
          assert(data instanceof Object);

          return new Proxy(data, {
            get: (obj, prop) => {
              if (prop === Symbol.iterator) {
                // eslint-disable-next-line no-underscore-dangle
                const _this = this;
                // eslint-disable-next-line func-names
                return function* () {
                  const keys = Object.keys(obj);
                  // eslint-disable-next-line no-plusplus
                  for (let i = 0; i < keys.length; i++) {
                    yield _this.wrapDataWithProxy(obj[keys[i]]);
                  }
                };
              }

              const value = isProxyPath(prop) ? this.proxy[prop] : obj[prop];

              return this.wrapDataWithProxy(value);
            },
          });
      }
    }

    static isProxyPath(path) {
      const { dataPathPrefix, syntheticPathPrefix } = RootProxy;
      return dataPathPrefix.test(path) || syntheticPathPrefix.test(path);
    }

    renderBlock({ data, options }) {
      const { hash, fn } = options;

      const { blockParam } = hash;

      if (blockParam) {
        delete hash.blockParam;
        hash[blockParam] = data;
      }

      const hashKeys = Object.keys(hash);
      // eslint-disable-next-line no-plusplus
      for (let i = 0; i < hashKeys.length; i++) {
        const k = hashKeys[i];
        hash[k] = this.wrapDataWithProxy(hash[k]);
      }

      const prevCanonicalHash = this.canonicalHash;
      this.canonicalHash = {
        ...this.canonicalHash,
        ...hash,
      };

      const output = fn(
        this.wrapDataWithProxy(data),
        { data: this.canonicalHash },
      );

      this.canonicalHash = prevCanonicalHash;

      return output;
    }

    static isPrimitive(value) {
      return value == null || ['String', 'Number', 'Boolean']
        .includes(value.constructor.name);
    }

    // eslint-disable-next-line class-methods-use-this
    validateType({
      path, value, validTypes = [], strict = false,
    }) {
      const { isPrimitive } = CustomCtxRenderer;
      if (validTypes && validTypes.length) {
        // eslint-disable-next-line no-plusplus
        for (let i = 0; i < validTypes.length; i++) {
          const type = validTypes[i];
          // eslint-disable-next-line default-case
          switch (true) {
            case type === 'Array' && value != null && value.constructor.name === 'Array':
              if (value.length || !strict) {
                return value;
              }
              break;

            case type === 'Object' && value != null && value.constructor.name === 'Object':
              if ((!!Object.keys(value).length) || !strict) {
                return value;
              }
              break;

            case type === 'Literal' && isPrimitive(value):
              return value;
          }
        }

        throw new Error(`${path} must resolve to a non-empty value with one of the types: ${validTypes}`);
      }
      return value;
    }

    // Todo: remove if not used
    getRootData() {
      const root = this.hbsInput;
      const rootData = root.data;
      delete root.data;
      return {
        ...root,
        ...rootData,
      };
    }
}

module.exports = CustomCtxRenderer;
