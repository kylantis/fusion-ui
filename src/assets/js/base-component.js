/* eslint-disable linebreak-style */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-case-declarations */

// eslint-disable-next-line no-undef
class BaseComponent extends WebRenderer {
  static CHAINED_LOADING_STRATEGY = 'chained';

  static ASYNC_LOADING_STRATEGY = 'async';

  static #token;

  constructor({
    id, input, loadable, logger,
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
    const safe_tags = (str) => {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    return safe_tags(
      Object(value) !== value ? `${value}` : JSON.stringify(value, replacer, null)
    );
  }

  // eslint-disable-next-line class-methods-use-this
  loadingStrategy() {
    return BaseComponent.ASYNC_LOADING_STRATEGY;
  }

  load({ container } = {}) {
    return super.load({
      token: BaseComponent.#token,
      container,
    });
  }

  render({ data, target, strategy }) {
    if (!data) {
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
   * in it's object model. Note: this method is only invoked at compile-time.
   * Also, note that there is no way to define a map structure here. This can only
   * be done from the template
   */
  init() {
  }

  // eslint-disable-next-line class-methods-use-this
  getLoader() {
    // return `
    //     <div style='display: table; width: 100%; height: 100%;'>
    //       <div style='vertical-align: middle; display: table-cell;'>
    //         <img width='20px' src='/assets/images/loader.gif' style='display: block; margin-left: auto; margin-right: auto;'>
    //       </div>
    //     </div>
    // `;
    return '';
  }

  // eslint-disable-next-line class-methods-use-this
  getStencil() {
    return '';
  }

  validateInput() {
    return true;
  }

  getConfigurationProperties() {
    return []
  }

  behaviours() {
    return [];
  }

  events() {
    return [];
  }

  defaultHandlers() {
    return {};
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

  preRender() {
  }

  isMobile() {
    return navigator.userAgent.match(/Android/i)
      || navigator.userAgent.match(/webOS/i)
      || navigator.userAgent.match(/iPhone/i)
      || navigator.userAgent.match(/iPad/i)
      || navigator.userAgent.match(/iPod/i)
      || navigator.userAgent.match(/BlackBerry/i)
      || navigator.userAgent.match(/Windows Phone/i)
  }

}
module.exports = BaseComponent;
