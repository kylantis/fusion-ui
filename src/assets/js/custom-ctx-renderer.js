/* eslint-disable no-case-declarations */
/* eslint-disable prefer-destructuring */
/* eslint-disable prefer-const */

// eslint-disable-next-line no-undef
class CustomCtxRenderer extends RootCtxRenderer {

  static partialIdHash = '__id';

  static partialNameHash = '__name';

  #decorators = {};

  #stack = [];

  constructor({
    id, input, logger, config,
  } = {}) {
    super({
      id, input, logger, config,
    });
  }

  isCustomContext() {
    return !!this.#stack.length;
  }

  getHandlebarsHelpers() {
    const { conditional, with: with0, each } = customCtxHelpers;

    const conditionalFn = conditional.bind(this)();

    return {
      if: function (ctx, options) {
        return conditionalFn(ctx, false, options, this)
      },
      unless: function (ctx, options) {
        return conditionalFn(ctx, true, options, this)
      },
      with: with0.bind(this)(),
      each: each.bind(this)(),
    };
  }

  storeContext({ options, ctx }) {
    const { partialIdHash } = CustomCtxRenderer;

    const { hash, fn } = options;
    this.#decorators[hash[partialIdHash]] = {
      fn,
      data: ctx,
    };

    return '';
  }

  loadContext({ options, ctx }) {
    // eslint-disable-next-line no-undef
    const { emptyObject } = RootProxy;
    const {
      partialIdHash,
      // partialNameHash,
    } = CustomCtxRenderer;

    let { hash, fn } = options;

    //  const partialName = hash[partialNameHash];

    if (hash[partialIdHash]) {
      // eslint-disable-next-line no-undef
      assert(fn(emptyObject) === '');

      // The referenced partial is an inline partial
      const decorator = this.#decorators[hash[partialIdHash]];

      fn = decorator.fn;

      // eslint-disable-next-line no-param-reassign
      // ctx = decorator.data; Todo: VERIFY AND REMOVE THIS LINE
    }

    // this.logger.debug(null, `Loading partial {{> ${partialName} }}`);

    return this.renderBlock({
      ctx,
      options: {
        ...options,
        fn,
      },
    });
  }

  wrapInvocationWithProxy({ options, params }) {
    const helperName = params.shift();

    return this.wrapDataWithProxy(
      this[helperName].bind(this)(...params, options)
    );
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

      case data.constructor.name != 'Object':
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
                // We need to return undefined so that #each helper can invoke execIteration(...)
                // using the actual object keys as the 'field' variable instead of the iteration index.
                // In doing so, @key can work properly
                return undefined;

              case !!Object.getPrototypeOf(obj)[prop]:
                return obj[prop];

              case prop === 'toJSON':
                return () => data;

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

  captureState() {
    return {
      blockData: this.blockData ? this.cloneBlockData(this.blockData) : {},
    };
  }

  renderBlock({ options, ctx, scope, state, nodeId }) {

    const { fn, hash, loc } = options;

    const { scopeVar, hook, hookPhase, hookOrder, transform } = hash;

    if (scope) {
      assert(scopeVar);

      // The compiler added a special hashkey known as <scopeVar> that contains
      // the data variable qualifier used by subpaths, hence prune from <hash> and
      // inject as data variable
      delete hash.scopeVar;

      hash[scopeVar] = ctx;

      if (state) {
        hash.state = state;
      }

      if (hook) {
        this.registerHook(`#${nodeId}`, hook, hookPhase, hookOrder, loc, (state || options.data.state).blockData);
      }

      options.data = TemplateRuntime.createFrame(options.data);
    }

    if (transform) {
      this.registerTransform(nodeId, transform);
    }

    Object.keys(hash).forEach(k => {
      options.data[k] = this.wrapDataWithProxy(hash[k]);
    })

    this.startBlockContext({ loc });

    this.#stack.push({ loc });

    const renderedValue = fn(
      this.wrapDataWithProxy(ctx), { data: options.data },
    );

    this.#stack.pop();

    this.endBlockContext();

    this.getEmitContext().write(renderedValue);

    return renderedValue;
  }

  resolveMustacheInCustom({ options, params }) {

    let { hash: { hook, hookPhase, hookOrder, transform }, loc } = options;

    if (transform) {
      transform = this.wrapTransform(transform);
    }

    let [value] = params;

    const bindContext = this.popDataStack();

    if (bindContext) {
      const { selector } = bindContext;

      if (value instanceof Promise || value instanceof BaseComponent) {
        value = this.render({
          data: value,
          target: selector,
          transform,
          loc,
        })

        transform = null;
      }

      if (hook) {
        this.registerHook(selector, hook, hookPhase, hookOrder, loc, options.data.state.blockData);
      }

    } else if (value instanceof BaseComponent) {
      this.logger.warn(
        loc,
        `Component "${value.getId()}" needs a bind context inorder to render properly`
      );
    }

    if (transform) {
      value = this[transform](value);
    }

    const renderedValue = this.toHtml(value);

    this.getEmitContext().write(renderedValue);

    return renderedValue;
  }

  concatenate() {
    const params = Array.from(arguments);
    const options = params.pop();

    return params.join('');
  }

  logical() {
    const params = Array.from(arguments);

    const [left, right, operator] = params;

    return this.proxyInstance.evaluateBooleanExpression(
      left, right, operator,
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

    let val = this.proxyInstance.evaluateConditionExpression(condition, conditionInversions, null) ?
      left : right;

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

  validateType({ path, value, validType, nameQualifier, line, allowEmptyCollection = false }) {
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

    let err = `${path} must resolve to the type : ${validType}${nameQualifier ? ` (${nameQualifier}) ` : ''} instead of ${currentType}`;

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
        (value == null || (value instanceof BaseComponent && (!nameQualifier || value.constructor.className == nameQualifier))):
        return value;
    }

    throw Error(
      `${line ? `[${line}] ` : ''}${err}`
    );
  }
}

module.exports = CustomCtxRenderer;
