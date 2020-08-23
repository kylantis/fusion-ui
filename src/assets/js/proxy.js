
class RootProxy {
    // eslint-disable-next-line no-useless-escape
    static syntheticMethodPrefix = 's$_';

    static dataPathRoot = 'data';

    static pathSeparator = '__';

    static dataPathPrefix = new RegExp(`^${RootProxy.dataPathRoot}${RootProxy.pathSeparator}`);

    static rawDataPrefix = 'r$_';

    static emptyObject = {};

    static emptyString = '';

    constructor({ component }) {
      this.component = component;
      this.handler = this.createObjectProxy();
    }

    getValue(value) {
      this.lastLookup = value;

      switch (true) {
        case value instanceof Array:
          return this.createArrayProxy(value);

        case value instanceof Object:
          return this.handler;

        default:
          return value;
      }
    }

    resolve0({ prop }) {
      // eslint-disable-next-line no-undef
      assert(prop.constructor.name === 'String');

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

      return isRawReturn ? v : this.getValue(v);
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

      return new Proxy({}, {
        get: (obj, prop) => {
          if (prop === Symbol.iterator) {
            return this.getProxyIterator();
          }

          switch (true) {
            // eslint-disable-next-line no-prototype-builtins
            case !!Object.getPrototypeOf(obj)[prop]:
              return obj[prop];

            case prop.startsWith('@root'):
              // eslint-disable-next-line no-case-declarations
              const arr = prop.split('.');
              arr[0] = 'this.component.getRootGlobals()';
              // eslint-disable-next-line no-eval
              return eval(arr.join('.'));

            default:
              // eslint-disable-next-line no-undef
              assert(prop.match(dataPathPrefix) || prop.startsWith(syntheticMethodPrefix));
              return this.resolve0({ prop: prop.replace(dataPathPrefix, '') });
          }
        },
      });
    }

    createArrayProxy(array) {
      return new Proxy(array, {
        get: (obj, prop) => {
          if (!Number.isNaN(parseInt(prop, 10))) {
            let value = obj[prop];

            if (value.constructor.name !== 'Array') {
              // If the element in this index is not an array,
              // return an empty object, which will then be
              // wrapped by the object proxy

              // If hbs knows that the element is a primitive, it
              // will refuse to resolve mustache statements inside
              // the each block that neither reference {{this}}
              // nor a block param in the upper context. Both of
              // which are not attainable in our scenario

              value = {};
            }

            return this.getValue(value);
          }
          return obj[prop];
        },
      });
    }

    static create({ component }) {
      const proxy = new RootProxy({ component });
      proxy.component.proxy = proxy.handler;
      return proxy.handler;
    }
}

module.exports = RootProxy;
