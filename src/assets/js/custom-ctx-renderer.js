/* eslint-disable no-case-declarations */
/* eslint-disable prefer-destructuring */
/* eslint-disable prefer-const */

// eslint-disable-next-line no-undef
class CustomCtxRenderer extends RootCtxRenderer {
  static partialIdHash = '__id';

  static partialNameHash = '__name';

  constructor({
    id, input, loadable, logger,
  } = {}) {
    super({
      id, input, loadable, logger,
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

   //  const partialName = hash[partialNameHash];

    if (hash[partialIdHash]) {
      // eslint-disable-next-line no-undef
      assert(fn(emptyObject) === emptyString);

      // The referenced partial is an inline partial
      const decorator = this.decorators[hash[partialIdHash]];

      fn = decorator.fn;
      // eslint-disable-next-line no-param-reassign
      // ctx = decorator.data; VERIFY AND REMOVE THIS LINE
    }

    // this.logger.debug(`Loading partial {{> ${partialName} }}`);

    return this.renderBlock({
      data: ctx,
      options: {
        ...options,
        fn,
      },
    });
  }

  wrapDataWithProxy(data) {
    const { isRootPath, syntheticMethodPrefix } = RootProxy;
    switch (true) {
      case data !== Object(data):
        return data;

      case data instanceof Array:
        return data.map(this.wrapDataWithProxy, this);

      case data instanceof BaseComponent:
        return data;

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

              case !!Object.getPrototypeOf(obj)[prop]:
                return obj[prop];

              case prop === 'toHTML':
              case prop === Symbol.toPrimitive:
                return () => _this.toHtml(obj);
              case prop.startsWith(syntheticMethodPrefix):
                // We need handlebars to invoke the helper itself, so that the params
                // (including the options object) are passed in during invocation 
                return undefined;
              default:
                const value = isRootPath(prop) ? this.rootProxy[prop] : obj[prop];
                return this.wrapDataWithProxy(value);
            }
          },
        });
    }
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

  concatenate() {
    const params = Array.from(arguments);
    const options = params.pop();

    return params.join('');
  }

  logical() {
    const { evaluateBooleanExpression } = RootProxy;
    const params = Array.from(arguments);

    const [left, right, operator] = params;

    const expr = (value) => {
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
      }
    }
    
    return evaluateBooleanExpression(this, expr(left), expr(right), operator);
  }

  noOpHelper() {
    // eslint-disable-next-line prefer-rest-params
    const params = Array.from(arguments);
    const options = params.pop();

    const { hash } = options;

    return hash;
  }

  ternary() {
    const params = Array.from(arguments);

    const options = params.pop();

    const invert = params.pop();
    const conditionInversions = JSON.parse(params.pop());
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
          case part === undefined:
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
        if (conditionInversions[index]) {
          part = `!${part}`
        }
        return part;
      })
      .join('');

    const b = eval(`${scope}${expr}`);
    assert(typeof b == 'boolean');

    let val = b ? left : right;

    if (invert) {
      val = !val;
    }

    const result = val === Object(val) ? JSON.stringify(val) : val;

    return result;
  }

  static isPrimitive(value) {
    return value == null || ['String', 'Number', 'Boolean']
      .includes(value.constructor.name);
  }

  static getAllValidationTypes() {
    return ['Array', 'Map', 'Object', 'Literal', 'componentRef'];
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
          case type === 'componentRef' && (value == null || value instanceof BaseComponent):
            return value;
        }
      }

      throw Error(`${path} must resolve to a non-empty value with one of the types: ${validTypes}${line ? ` on line ${line}` : ''}.`);
    }
    return value;
  }
}

module.exports = CustomCtxRenderer;
