/* eslint-disable linebreak-style */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-case-declarations */

// eslint-disable-next-line no-undef
class BaseComponent extends WebRenderer {
  static CHAINED_LOADING_STRATEGY = 'chained';

  static ASYNC_LOADING_STRATEGY = 'async';

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
            .replace(/^\$_/g, '')
          ] = val[k];
        });

        return o;
      }
      return val;
    }

    return Object(value) !== value ? `${value}` : JSON.stringify(value, replacer, null);
  }

  // eslint-disable-next-line class-methods-use-this
  loadingStrategy() {
    return BaseComponent.ASYNC_LOADING_STRATEGY;
  }

  load(opts = {}) {
    return super.load({
      token: BaseComponent.#token,
      ...opts,
    });
  }

  render({ data, target, strategy, options }) {
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
          throw Error(`Component: ${data.getId()} cannot be rendered in this template location: ${global.clientUtils.getLine({ loc })}`);

        case data instanceof Function:
          data = data();

        default:
          return data;
      }
    }

    // eslint-disable-next-line no-plusplus
    this.renderOffset++;

    const {
      CHAINED_LOADING_STRATEGY,
      ASYNC_LOADING_STRATEGY,
    } = BaseComponent;

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

    const loadingStrategy = strategy || this.loadingStrategy();

    switch (loadingStrategy) {
      case CHAINED_LOADING_STRATEGY:
        this.promise = future;
        break;
      case ASYNC_LOADING_STRATEGY:
        this.futures.push(future);
        break;

      default:
        throw Error(`Unknown strategy: ${loadingStrategy}`);
    }

    return future;
  }

  log(msg, level = 'info') {
    // Todo: verify level
    this.logger[level](`[${this.getId()}] ${msg}`);
  }

  /**
   * The main goal for this is to allow the component dynamically register fields 
   * in it's object model. Note: this method is only invoked at compile-time.
   * Also, note that there is no way to define a map/component structure here. This can only
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

  getConfigurationProperties() {
    return []
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

  getBehaviours() {
    let behaviours = [];

    this.recursivelyInvokeMethod('behaviours').forEach(arr => {
      assert(arr.constructor.name == 'Array');
      behaviours = behaviours.concat(arr);
    });

    return behaviours;
  }

  getEvents() {
    let events = [];

    this.recursivelyInvokeMethod('events').forEach(arr => {
      assert(arr.constructor.name == 'Array');
      events = events.concat(arr);
    });

    return events;
  }

  getHooks() {
    const hooks = {};

    this.recursivelyInvokeMethod('hooks').forEach(r => {
      Object.entries(r)
        .forEach(([key, value]) => {
          assert(value instanceof Function);

          if (!hooks[key]) {
            hooks[key] = [];
          }

          hooks[key].push(value);
        });
    })

    return hooks;
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

  dispatch(event, data) {
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
      handlers.forEach(handler => handler(data));
    }

    return this;
  }

  hasSubComponent() {
    return this.getSyntheticMethod({ name: 'hasSubComponent' })();
  }

  beforeMount() {
  }

  onMount() {
  }

  static getWrapperCssClass() {
    const { htmlWrapperCssClassname } = RootCtxRenderer;
    return htmlWrapperCssClassname;
  }

  destroy() {

    // Detach from DOM
    const node = document.getElementById(this.getId());
    node.parentElement.removeChild(node)

    // Todo: Prune resources
    delete this.getInput();
  }

  static cloneComponent(component, inputVistor = (i) => i) {
    const input = inputVistor(
      eval(`module.exports=${global.clientUtils.stringifyComponentData(
        component.getInput(),
      )}`)
    )

    const o = new components.Menu({ input });

    Object.entries(component.handlers).forEach(([k, v]) => {
      o.handlers[k] = v;
    });

    return o;
  }

}
module.exports = BaseComponent;
