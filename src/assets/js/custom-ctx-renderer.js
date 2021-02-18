/* eslint-disable no-case-declarations */
/* eslint-disable prefer-destructuring */
/* eslint-disable prefer-const */

// eslint-disable-next-line no-undef
class CustomCtxRenderer extends RootCtxRenderer {
  static partialIdHash = '__id';

  static partialNameHash = '__name';

  constructor({
    id, input, loadable, parent, logger,
  } = {}) {
    super({
      id, input, loadable, parent, logger,
    });

    this.canonicalHash = {};
    this.customContext = [];

    this.decorators = {};
  }

  storeContext({ options, ctx }) {
    // eslint-disable-next-line no-undef
    const { emptyString } = RootProxy;
    const { partialIdHash } = CustomCtxRenderer;

    const { hash, fn } = options;
    this.decorators[hash[partialIdHash]] = {
      fn,
      data: ctx,
    };

    return emptyString;
  }

  loadContext({ options, ctx }) {
    // eslint-disable-next-line no-undef
    const { emptyObject, emptyString } = RootProxy;
    const {
      partialIdHash,
      // partialNameHash,
    } = CustomCtxRenderer;

    let { hash, fn } = options;

    // const partialName = hash[partialNameHash];

    if (hash[partialIdHash]) {
      // eslint-disable-next-line no-undef
      assert(fn(emptyObject) === emptyString);

      // The referenced partial is an inline partial
      const decorator = this.decorators[hash[partialIdHash]];

      fn = decorator.fn;
      // eslint-disable-next-line no-param-reassign
      ctx = decorator.data;
    }

    this.logger.debug(`Loading partial {{> ${partialName} }}`);

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
        return data.map(this.wrapDataWithProxy, this);

      default:
        // eslint-disable-next-line no-undef
        assert(data instanceof Object);

        // eslint-disable-next-line no-underscore-dangle
        const _this = this;
        return new Proxy(data, {

          get: (obj, prop) => {
            switch (true) {
              case prop === Symbol.iterator:
                // eslint-disable-next-line func-names
                return function* () {
                  const keys = Object.keys(obj);
                  // eslint-disable-next-line no-plusplus
                  for (let i = 0; i < keys.length; i++) {
                    yield _this.wrapDataWithProxy(obj[keys[i]]);
                  }
                };

              case prop === Symbol.toPrimitive:
                return () => _this.toHtml(obj);

              case !!Object.getPrototypeOf(obj)[prop]:
                return obj[prop];

              case prop === 'toHTML':
                // An alternative is to check if prop === Symbol.toPrimitive
                return () => _this.toHtml(obj);

              default:
                const value = isProxyPath(prop) ? this.rootProxy[prop] : obj[prop];
                return this.wrapDataWithProxy(value);
            }
          },
        });
    }
  }

  static isProxyPath(path) {
    // eslint-disable-next-line no-undef
    const { dataPathPrefix, syntheticMethodPrefix } = RootProxy;
    return dataPathPrefix.test(path) || path.startsWith(syntheticMethodPrefix);
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
    this.customContext.push({
      hash,
      data
    });

    const output = fn(
      this.wrapDataWithProxy(data),
      { data: this.canonicalHash },
    );

    this.customContext.pop();
    this.canonicalHash = prevCanonicalHash;

    return output;
  }

  inCustomContext() {
    return this.customContext.length > 0;
  }

  ternary() {
    const params = Array.from(arguments);

    const options = params.pop();

    const invert = JSON.parse(params.pop());
    const right = params.pop();
    const left = params.pop();
    const condition = [...params];

    const AND = 'AND';
    const OR = 'OR';

    const and = ' && ';
    const or = ' || ';

    let scope = '';

    const expr = condition
    .map((part) => {

      const variableName = global.clientUtils.randomString();

      switch (true) {
        case part == null:
        case part == undefined:
        case part.constructor.name == 'Number':
        case part.constructor.name == 'Boolean':
          scope += `const ${variableName} = ${part};\n`;
          return `!!${variableName}`;
        case part.constructor.name == 'String':
          switch (part) {
            case AND:
              return and;
            case OR:
              return or;
            default:
              scope += `const ${variableName} = "${part}";\n`;
              return `!!${variableName}`;
          }
        case part === Object(part):
          scope += `const ${variableName} = ${JSON.stringify(part)};\n`;
          return `!!${variableName}`;
      }
    })
    .map((part, index) => {
      if (invert[index]) {
        part = `!${part}`
      }
      return part;
    })
    .join('');

    const b = eval(`${scope}${expr}`);
    assert(typeof b == 'boolean');

    const val = b ? left : right;

    return val === Object(val) ? JSON.stringify(val) : val;
  }

  static isPrimitive(value) {
    return value == null || ['String', 'Number', 'Boolean']
      .includes(value.constructor.name);
  }

  static getAllValidationTypes() {
    return ['Array', 'Map', 'Object', 'Literal', 'Component'];
  }

  // eslint-disable-next-line class-methods-use-this
  validateType({
    path, value, 
    validTypes = CustomCtxRenderer.getAllValidationTypes(), 
    strict = false, line,
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

          case type === 'Map' && value != null && value.constructor.name === 'Map':
            if (value.size || !strict) {
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

          // eslint-disable-next-line no-undef
          case type === 'Component' && value instanceof BaseComponent:
            return value;
        }
      }

      throw new Error(`${path} must resolve to a non-empty value with one of the types: ${validTypes}${line ? ` on line ${line}` : ''}.`);
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
