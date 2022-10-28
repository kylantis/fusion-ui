/* eslint-disable linebreak-style */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-case-declarations */

// eslint-disable-next-line no-undef
class BaseComponent extends WebRenderer {

  static #token;

  #parent;

  constructor({
    id, input, loadable, logger, parent
  } = {}) {
    super({
      id, input, loadable, logger,
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

    const { mapKeyPrefixRegex } = RootProxy;
    const { getDataVariables } = RootCtxRenderer;

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

  load(opts = {}) {
    return super.load({
      token: BaseComponent.#token,
      ...opts,
    });
  }

  render({ data, target, options }) {
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
              });
              break;

            case data instanceof Function:
              promise = promise.then(() => {
                data({ target });
              });
              break;

            default:
              promise = promise.then(() => {
                node.innerHTML = String(data);
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

  log(msg, level = 'info') {
    // Todo: verify level
    this.logger[level](`[${this.getId()}] ${msg}`);
  }

  throw(msg) {
    throw Error(`[${this.getId()}] ${msg}`);
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

  validateInput() {
    return true;
  }

  behaviours() {
    return ['destroy'];
  }

  events() {
    return [];
  }

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

  on(event, handler) {
    this.ensureKnownEvent(event);
    assert(typeof handler == 'function');

    const handlers = this.handlers[event] || (this.handlers[event] = []);
    handlers.push(handler);
    return this;
  }

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
        const isArray = x.constructor.name == 'Array';
        const isObject = x.constructor.name == 'Object';
        assert(isArray || isObject, 'Left-hand side of INCLUDES must be an array or object');

        return (
          isArray ? x :
            x.keys instanceof Function ? x.keys() : Object.keys(x)
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

  hasSubComponent() {
    return this.getSyntheticMethod({ name: 'hasSubComponent' })();
  }

  beforeMount() {
  }

  onMount() {
  }

  destroy() {

    // Detach from DOM
    const node = document.getElementById(this.getId());
    node.parentElement.removeChild(node)

    // Todo: Prune resources
    delete this.getInput();
  }

  getGlobalVariables() {
    return {
      // ... User Global Variables
      ...self.appContext.userGlobals,
      // ... Component Global Variables
      ...{
        componentId: this.getId(),
      }
    }
  }

  getGlobalVariableTypes() {
    const { literalType } = RootProxy;
    return {
      // ... User Global Variables
      rtl: literalType,
      // ... Component Global Variables
      componentId: literalType,
    };
  }

  static getWrapperCssClass() {
    const { htmlWrapperCssClassname } = RootCtxRenderer;
    return htmlWrapperCssClassname;
  }

  static cloneComponent(component, inputVistor = (i) => i) {
    const input = inputVistor(
      eval(`module.exports=${global.clientUtils.stringifyComponentData(
        component.getInput(),
      )}`)
    )

    const o = new component.constructor({ input });

    Object.entries(component.handlers).forEach(([k, v]) => {
      o.handlers[k] = v;
    });

    return o;
  }

}
module.exports = BaseComponent;
