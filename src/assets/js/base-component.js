/* eslint-disable linebreak-style */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-case-declarations */

// eslint-disable-next-line no-undef
class BaseComponent extends WebRenderer {
  static CHAINED_LOADING_STRATEGY = 'chained';

  static ASYNC_LOADING_STRATEGY = 'async';

  static #token;

  constructor({
    id, input, loadable, parent, logger,
  } = {}) {
    super({
      id, input, loadable, parent, logger,
    });

    if (!BaseComponent.#token) {
      // eslint-disable-next-line no-undef
      BaseComponent.#token = global.clientUtils.randomString();
      // eslint-disable-next-line no-undef
      RootCtxRenderer.setToken(BaseComponent.#token);
    }

    this.handlers = {};
  }

  // eslint-disable-next-line class-methods-use-this
  toHtml(value) {
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

    return Object(value) !== value ? value : JSON.stringify(value, replacer, null);
  }

  // eslint-disable-next-line class-methods-use-this
  loadingStrategy() {
    return BaseComponent.CHAINED_LOADING_STRATEGY;
  }

  load({ container }) {
    return super.load({
      token: BaseComponent.#token,
      container,
    });
  }

  render({ data, target, strategy }) {
    if (
      // global.isServer || 
      !data) {
      return Promise.resolve();
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
          if (!data) {
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
                node.innerHTML = this.toHtml(data);
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
        throw new Error(`Unknown strategy: ${loadingStrategy}`);
    }

    return future;
  }

  log(msg, level = 'info') {
    // Todo: verify level
    this.logger[level](`[${this.getId()}] ${msg}`);
  }

  /**
   * The main goal for this is to allow the component dynamically register fields 
   * in it's object model. Note: this method is only invoked at compile-time
   */
  init() {
  }

  // eslint-disable-next-line class-methods-use-this
  getLoader() {
    return `<div class="sk-chase">
                  <div class="sk-chase-dot"></div>
                  <div class="sk-chase-dot"></div>
                  <div class="sk-chase-dot"></div>
                  <div class="sk-chase-dot"></div>
                  <div class="sk-chase-dot"></div>
                  <div class="sk-chase-dot"></div>
                </div>`;
  }

  // eslint-disable-next-line class-methods-use-this
  getStencil() {
    return 'STENCIL';
  }

  behaviours() {
    return [];
  }

  events() {
    return [];
  }

  ensureKnownEvent(event) {
    assert(
      this.events().includes(event),
      `Unknown event '${event}' for component: ${this.constructor.name}`
    );
  }

  on(event, handler) {
    this.ensureKnownEvent(event);
    const handlers = this.handlers[event] || (this.handlers[event] = []);
    handlers.push(handler);
    return this;
  }

  dispatch(event, data) {
    this.ensureKnownEvent(event);
    const handlers = this.handlers[event];
    if (handlers && handlers.length) {
      handlers.forEach(handler => handler(data));
    }
    return this;
  }

  hasSubComponent() {
    return this.getSyntheticMethod({ name: 'hasSubComponent' })();
  }

  preRender() {
  }

  postRender({ container, html }) {
    // By default, write to innerHTML of container

    const elem = document.getElementById(container);
    assert(elem != null, `DOMElement #${container} does not exist`);
    elem.innerHTML = html;
  }

}
module.exports = BaseComponent;
