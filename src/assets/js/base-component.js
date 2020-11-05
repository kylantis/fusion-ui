/* eslint-disable linebreak-style */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-case-declarations */

// eslint-disable-next-line no-undef
class BaseComponent extends WebRenderer {
  static CHAINED_LOADING_STRATEGY = 'chained';

  static ASYNC_LOADING_STRATEGY = 'async';

  static #token;

  constructor({
    id, input, loadable, parent,
  } = {}) {
    super({
      id, input, loadable, parent,
    });

    if (!BaseComponent.#token) {
      // eslint-disable-next-line no-undef
      BaseComponent.#token = global.clientUtils.randomString();
      // eslint-disable-next-line no-undef
      RootCtxRenderer.setToken(BaseComponent.#token);
    }
  }

  // eslint-disable-next-line class-methods-use-this
  toHtml(object) {
    return JSON.stringify(object);
  }

  // eslint-disable-next-line class-methods-use-this
  loadingStrategy() {
    return BaseComponent.CHAINED_LOADING_STRATEGY;
  }

  load({ parent }) {
    return super.load({
      token: BaseComponent.#token,
      parent,
    });
  }

  render({ data, target, strategy }) {
    if (global.isServer || !data) {
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
            case data.constructor.name === 'String':
              promise = promise.then(() => {
                node.innerHTML = data;
              });
              break;

            case data instanceof Function:
              promise = promise.then(() => {
                data({ target });
              });
              break;

              // eslint-disable-next-line no-undef
            default:
              // eslint-disable-next-line no-undef
              assert(data instanceof BaseComponent);
              promise = data.load({
                parent: target,
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
    return '';
  }
}
module.exports = BaseComponent;
