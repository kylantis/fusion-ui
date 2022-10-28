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

    this.decorators = {};
  }

  getHandlebarsHelpers() {
    const { conditional, with: with0, each } = customCtxHelpers;

    const conditionalFn = conditional.bind(this)();

    return {
      if: function (ctx, options) {
        conditionalFn(ctx, false, options, this)
      },
      unless: function (ctx, options) {
        conditionalFn(ctx, true, options, this)
      },
      with: with0.bind(this)(),
      each: each.bind(this)(),
    };
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
      // ctx = decorator.data; Todo: VERIFY AND REMOVE THIS LINE
    }

    // this.logger.debug(`Loading partial {{> ${partialName} }}`);

    return this.renderBlock({
      ctx,
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

  renderBlock({ options, ctx, scope }) {
    const { fn, hash } = options;

    const { blockParam } = hash;

    if (scope) {
      assert(blockParam);

      // The compiler added a special hashkey known as <blockParam> that contains
      // the data variable qualifier used by subpaths, hence prune from <hash> and
      // inject as data variable
      delete hash.blockParam;

      hash[blockParam] = ctx;

      options.data = clientUtils.createFrame(options.data);
    }

    Object.keys(hash).forEach(k => {
      options.data[k] = this.wrapDataWithProxy(hash[k]);
    })

    const output = fn(
      this.wrapDataWithProxy(ctx),
      { data: options.data },
    );

    return output;
  }

  concatenate() {
    const params = Array.from(arguments);
    const options = params.pop();

    return params.join('');
  }

  logical() {
    const { getExecStringFromValue: execString } = RootCtxRenderer;
    const { evaluateBooleanExpression } = RootProxy;
    const params = Array.from(arguments);

    const [left, right, operator] = params;

    return evaluateBooleanExpression(
      this, execString(left), execString(right), operator,
    );
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

    return this.proxyInstance.getRawValueWrapper(val);
  }

  static isPrimitive(value) {
    return value == null || ['String', 'Number', 'Boolean']
      .includes(value.constructor.name);
  }

  static getValueType(value) {
    return value === null ? 'null' : value === Object(value) ? value.constructor.name : typeof value;
  }

  // eslint-disable-next-line class-methods-use-this
  validateType({ path, value, validType, nameQualifier, line, allowEmptyCollection=false }) {
    const { isPrimitive, getValueType } = CustomCtxRenderer;
    const { literalType, arrayType, objectType, mapType, componentRefType } = RootProxy;

    const arr = path.split('%');

    if (arr.length == 2) {
      path = arr[0];
      const metaArray = arr[1].split('/');

      validType = metaArray[0];
      // eslint-disable-next-line prefer-destructuring
      nameQualifier = metaArray[1];
    }

    if (!validType) {
      return value;
    }

    const emptyCollectionErrorMsg = () => `${path} must resolve to a non-empty [${validType}]${nameQualifier ? ` (${nameQualifier}) ` : ''}`;

    const currentType = getValueType(value);

    let err = `${path} must resolve to the type : [${validType}]${nameQualifier ? ` (${nameQualifier}) ` : ''} instead of ${currentType}`;

    // eslint-disable-next-line default-case
    switch (true) {
      case validType === arrayType && value != null && value.constructor.name === 'Array':
        if (value.length || allowEmptyCollection) {
          return value;
        }
        err = emptyCollectionErrorMsg();
        break;

      case validType === mapType && value != null && value.constructor.name === 'Map':
        if (value.size || allowEmptyCollection) {
          return value;
        }
        err = emptyCollectionErrorMsg();
        break;

      case validType === objectType && value != null && value.constructor.name === 'Object':
        return value;

      case validType === literalType && isPrimitive(value):
        return value;

      // eslint-disable-next-line no-undef
      case validType === componentRefType &&
        (value == null || (value instanceof BaseComponent && (!nameQualifier || value.constructor.name == nameQualifier))):
        return value;
    }

    throw Error(
      `${line ? `[${line}] ` : ''}${err}`
    );
  }
}

module.exports = CustomCtxRenderer;
