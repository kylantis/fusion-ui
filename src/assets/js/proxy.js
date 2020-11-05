/* eslint-disable no-case-declarations */

class RootProxy {
    // eslint-disable-next-line no-useless-escape
    static syntheticMethodPrefix = 's$_';

    static dataPathRoot = 'data';

    static pathSeparator = '__';

    static dataPathPrefix = new RegExp(`^${RootProxy.dataPathRoot}${RootProxy.pathSeparator}`);

    static rawDataPrefix = 'r$_';

    static literalPrefix = 'l$_';

    static emptyObject = {};

    static emptyString = '';

    constructor({ component }) {
      this.component = component;
      this.handler = this.createObjectProxy();
    }

    getValue(value) {
      this.lastLookup = value;

      switch (true) {
        case value && value.constructor.name === 'Array':
          return this.createArrayProxy(value);

        case value && value.constructor.name === 'Object':
          return this.handler;

        default:
          return value;
      }
    }

    resolve0({ prop }) {
      const {
        literalPrefix, emptyString,
      } = RootProxy;

      // eslint-disable-next-line no-undef
      assert(prop.constructor.name === 'String');

      if (prop.startsWith(literalPrefix)) {
        return prop.replace(literalPrefix, emptyString);
      }

      // eslint-disable-next-line no-case-declarations
      const { rawDataPrefix } = RootProxy;

      // eslint-disable-next-line no-case-declarations
      const isRawReturn = prop.startsWith(rawDataPrefix);
      if (isRawReturn) {
        // eslint-disable-next-line no-param-reassign
        prop = prop.replace(rawDataPrefix, '');
      }

      // eslint-disable-next-line no-case-declarations
      const v = this.component
        .getPathValue({ path: prop });

      const ret = isRawReturn ? this.getRawValueWrapper(v) : this.getValue(v);

      return ret;
    }

    /**
     * This wraps a raw value.
     */
    getRawValueWrapper(value) {
      // eslint-disable-next-line no-underscore-dangle
      const _this = this;
      switch (true) {
        case value !== Object(value):
          return value;
        // eslint-disable-next-line no-undef
        case value instanceof BaseComponent:
          return value;
        default:
          return new Proxy(value, {
            get(obj, prop) {
              if (prop === 'toHTML') {
                // An alternative is to check if prop === Symbol.toPrimitive
                return () => _this.component.toHtml(obj);
              }
              return obj[prop];
            },
          });
      }
    }

    getProxyIterator() {
      // eslint-disable-next-line no-underscore-dangle
      const _this = this;
      // eslint-disable-next-line func-names
      return function* () {
        const keys = Object.keys(_this.lastLookup);
        // eslint-disable-next-line no-plusplus
        for (let i = 0; i < keys.length; i++) {
          // At least, attempt to do a read on the underlying json
          // object, so that if it is a proxy itself, the "get"
          // interceptor method will be invoked
          // eslint-disable-next-line no-unused-expressions
          _this.lastLookup[keys[i]];

          yield _this.handler;
        }
      };
    }

    createObjectProxy() {
      const {
        dataPathPrefix, syntheticMethodPrefix,
      } = RootProxy;
      // eslint-disable-next-line no-underscore-dangle
      const _this = this;
      return new Proxy({}, {
        get: (obj, prop) => {
          if (prop === Symbol.iterator) {
            return this.getProxyIterator();
          }

          switch (true) {
            // eslint-disable-next-line no-prototype-builtins
            case !!Object.getPrototypeOf(obj)[prop]:
              return obj[prop];

            case prop === 'toHTML':
              // An alternative is to check if prop === Symbol.toPrimitive
              return () => _this.component.toHtml(this.lastLookup);

            case prop.startsWith('@root'):
              // eslint-disable-next-line no-case-declarations
              const arr = prop.split('.');
              arr[0] = '_this.component.getRootGlobals()';
              // eslint-disable-next-line no-eval
              return eval(arr.join('.'));

            default:
              if (!(prop.match(dataPathPrefix) || prop.startsWith(syntheticMethodPrefix))) {
                throw new Error(`Invalid path: ${prop}`);
              }
              return this.resolve0({ prop: prop.replace(dataPathPrefix, '') });
          }
        },
      });
    }

    createArrayProxy(array) {
      // eslint-disable-next-line no-underscore-dangle
      const _this = this;
      return new Proxy(array, {
        get: (obj, prop) => {
          switch (true) {
            case prop === 'toHTML':
              // An alternative is to check if prop === Symbol.toPrimitive
              return () => _this.component.toHtml(obj);

            case prop === Symbol.toPrimitive:
              return () => _this.component.toHtml(obj);

            case !Number.isNaN(parseInt(prop, 10)):
              // At least access the context, so that our array proxy
              // created in setSyntheticContext(...) intercepts the value
              // and updates the synthetic context
              // eslint-disable-next-line no-unused-expressions
              obj[prop];
              return this.createObjectProxy();

            default:
              return obj[prop];
          }
        },
      });
    }

    static create({ component }) {
      const proxy = new RootProxy({ component });
      proxy.component.rootProxy = proxy.handler;
      return proxy.handler;
    }
}

module.exports = RootProxy;
