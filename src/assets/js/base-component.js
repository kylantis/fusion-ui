/* eslint-disable linebreak-style */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-case-declarations */

// eslint-disable-next-line no-undef
class BaseComponent extends WebRenderer {

  static #token;

  #parent;
  
  // #API
  static CONSTANTS = {
    pathSeparator: RootProxy.pathSeparator,
    pathProperty: RootProxy.pathProperty,
    firstProperty: RootProxy.firstProperty,
    lastProperty: RootProxy.lastProperty,
    keyProperty: RootProxy.keyProperty,
    indexProperty: RootProxy.indexProperty,
    randomProperty: RootProxy.randomProperty,
  };

  constructor({
    id, input, logger, parent
  } = {}) {
    super({
      id, input, logger,
    });

    if (!BaseComponent.#token) {
      // eslint-disable-next-line no-undef
      BaseComponent.#token = global.clientUtils.randomString();
      // eslint-disable-next-line no-undef
      RootCtxRenderer.setToken(BaseComponent.#token);
    }

    this.#parent = parent;
    this.handlers = {};
  }

  // eslint-disable-next-line class-methods-use-this
  toHtml(value) {

    if (value instanceof Promise) {
      return '';
    }

    const { mapKeyPrefixRegex, getDataVariables } = RootProxy;

    const replacer = (name, val) => {
      if (val && val.constructor.name === 'Object') {
        const keys = Object.keys(val);

        // Remove data variables from <keys>
        if (keys.includes(getDataVariables()[0])) {
          for (const variable of getDataVariables()) {
            assert(keys.includes(variable));
            keys.splice(keys.indexOf(variable), 1);
          }
        }

        const o = {};

        keys.forEach(k => {
          o[k
            // Remove $_ prefixes for map keys, if applicable
            .replace(mapKeyPrefixRegex, '')
          ] = val[k];
        });

        return o;
      }
      return val;
    }

    return this.analyzeConditionValue(value) ? Object(value) !== value ? `${value}` : JSON.stringify(value, replacer, null) : '';
  }
  // #API
  load(opts = {}) {
    return super.load({
      token: BaseComponent.#token,
      ...opts,
    });
  }

  // #API
  awaitPendingTasks() {
    return Promise.all(this.futures);
  }

  render({ data, target, transform, options }) {
    if (data === undefined) {
      return Promise.resolve();
    }

    if (!target) {
      // The MustacheExpression was not wrapped in a html wrapper
      // likely because the mustache expression was within a html
      // attribute context
      const { loc } = options;
      assert(!!loc);

      switch (true) {
        case data instanceof BaseComponent:
          throw Error(`Component: ${data.getId()} cannot be rendered in this template location: ${clientUtils.getLine({ loc })}`);

        case data instanceof Function:
          data = data();

        default:
          return data;
      }
    }

    // eslint-disable-next-line no-plusplus
    this.renderOffset++;

    const future = this.promise
      // eslint-disable-next-line no-shadow
      .then(() => Promise.resolve(data)
        // eslint-disable-next-line no-shadow
        .then((data) => {
          if (data === undefined) {
            // eslint-disable-next-line no-param-reassign
            data = '';
          }

          let promise = Promise.resolve();
          const node = document.getElementById(target);

          // Clear loader
          node.innerHTML = '';

          switch (true) {

            case data instanceof BaseComponent:
              promise = data.load({
                container: target,
                transform,
              });
              break;

            case data instanceof Function:
              promise = promise.then(() => {
                data({ target, transform });
              });
              break;

            default:
              promise = promise.then(() => {
                node.innerHTML = this.toHtml(
                  transform ? this[transform](data) : data,
                );
              });
              break;
          }
          return promise.then(() => {
            // eslint-disable-next-line no-plusplus
            this.renderOffset--;
          });
        }));

    this.futures.push(future);

    return future;
  }
  // #API
  log(msg, level = 'info') {
    // Todo: verify level
    this.logger[level](`[${this.getId()}] ${msg}`);
  }

  /**
   * The main goal for this is to allow the component dynamically register fields 
   * in it's object model. Note: this method is only invoked at compile-time.
   * Also, note that there is no way to define map and component types here. This can only
   * be done from the template
   * 
   * Todo: Can we add support for non-scalar attributes here by using a setter
   * sometimes instead of a getter in the object proxy 
   */
  initCompile() {
  }
  // #API
  validateInput() {
    return true;
  }
  // #API
  behaviours() {
    return ['destroy'];
  }
  // #API
  events() {
    return [];
  }
  // #API
  hooks() {
    return {};
  }

  defaultHandlers() {
    return {};
  }

  /**
   * This indicates that this component requires a container
   * @returns true | false
   */
  requiresContainer() {
    return true;
  }

  ensureKnownEvent(event) {
    assert(
      this.events().includes(event),
      `Unknown event '${event}' for component: ${this.constructor.name}`
    );
  }
  // #API
  on(event, handler) {
    this.ensureKnownEvent(event);
    assert(typeof handler == 'function');

    const handlers = this.handlers[event] || (this.handlers[event] = []);
    handlers.push(handler);
    return this;
  }
  // #API
  dispatchEvent(event, ...args) {
    this.ensureKnownEvent(event);

    let defaultHandler = this.defaultHandlers()[event]

    if (defaultHandler) {

      if (typeof defaultHandler == 'string') {
        defaultHandler = this[defaultHandler].bind(this);
      }

      assert(typeof defaultHandler == 'function');
    }

    let handlers = this.handlers[event] || (defaultHandler ? [defaultHandler] : null);

    if (handlers && handlers.length) {
      handlers.forEach(handler => handler(...args));
    }

    return this;
  }
  // #API
  booleanOperators() {
    return {
      LT: (x, y) => x < y,
      LTE: (x, y) => x <= y,
      GT: (x, y) => x > y,
      GTE: (x, y) => x >= y,
      EQ: (x, y) => x == y,
      NEQ: (x, y) => x != y,
      INCLUDES: (x, y) => {
        if (!x) { return false; }

        const isString = typeof x == 'string';
        const isArray = x.constructor.name == 'Array';
        const isObject = x.constructor.name == 'Object';

        assert(isString || isArray || isObject, `Left-hand side of INCLUDES must be a string, array or object, got value ${x}`);

        return (
          isObject ? x.keys instanceof Function ? x.keys() : Object.keys(x)
            : x
        )
          .includes(y);
      },
      INSTANCEOF: (x, y) => {
        if (!x) { return false; }
        const componentClass = components[y];
        assert(x instanceof BaseComponent, 'Left-hand side of INSTANCEOF must be a component');
        assert(!!componentClass, 'Right-hand side of INSTANCEOF must be a valid component name');

        return x instanceof componentClass;
      },
      STARTSWITH: (x, y) => {
        if (typeof x != 'string') {
          return false;
        }
        return x.startsWith(y);
      }
    }
  }

  beforeMount() {
  }

  onMount() {
  }
  // #API
  destroy() {

    // Detach from DOM
    const node = document.getElementById(this.getId());
    node.parentElement.removeChild(node)

    // Todo: Prune resources
    delete this.getInput();
  }
  // #API
  getGlobalVariables() {
    return {
      // ... User Global Variables
      ...self.appContext ? self.appContext.userGlobals : {},
      // ... Component Global Variables
      componentId: this.getId(),
      random: this.randomString0 || (this.randomString0 = clientUtils.randomString())
    }
  }

  getGlobalVariableTypes() {
    const { literalType } = RootProxy;
    return {
      // ... User Global Variables
      rtl: literalType,
      // ... Component Global Variables
      componentId: literalType,
      random: literalType,
    };
  }

  // #API
  static getWrapperCssClass() {
    const { htmlWrapperCssClassname } = RootCtxRenderer;
    return htmlWrapperCssClassname;
  }

  static cloneInputData(data) {
    const { unsafeEval } = AppContext;
    return unsafeEval(
      `module.exports=${clientUtils.stringifyComponentData(
        data,
      )}`
    )
  }

  static cloneComponent(component, inputVistor = (i) => i) {
    const { cloneInputData } = BaseComponent;

    const input = inputVistor(
      cloneInputData(
        component.getInput(),
      )
    )

    const o = new component.constructor({
      input,
      config: { ...component.getConfig() }
    });

    Object.entries(component.handlers).forEach(([k, v]) => {
      o.handlers[k] = v;
    });

    return o;
  }

  //  Utility methods

  // #API
  getKeyFromIndexSegment(s) {
    return clientUtils.getKeyFromIndexSegment(s);
  }

  // #API
  getParentFromPath(pathArray) {
    return clientUtils.getParentFromPath(pathArray);
  }
  // #API
  getMapKeyPrefix() {
    return RootProxy.mapKeyPrefix;
  }
  // #API
  getSharedEnum(enumName) {
    return self.appContext ? self.appContext.enums[enumName] : null
  }
  // #API
  isHeadlessContext() {
    return global.isServer;
  }
  // #API
  randomString() {
    const { randomString } = BaseComponent;
    return randomString();
  }

  static randomString() {
    return clientUtils.randomString();
  }
}
module.exports = BaseComponent;
