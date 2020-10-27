/* eslint-disable linebreak-style */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-case-declarations */

// eslint-disable-next-line no-undef
class BaseComponent extends WebRenderer {
  static CHAINED_LOADING_STRATEGY = 'chained';

  static ASYNC_LOADING_STRATEGY = 'async';

  static #token;

  constructor({
    id, input, loadable,
  } = {}) {
    super({ id, input, loadable });

    if (!BaseComponent.#token) {
      // eslint-disable-next-line no-undef
      BaseComponent.#token = BaseRenderer.generateRandomString();
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

  render({ data, target, strategy }) {
    if (global.isServer || !data) {
      return Promise.resolve();
    }

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
              // Todo: should we re-assign the promise here?
              data({ target });
              break;

              // eslint-disable-next-line no-undef
            default:
              promise = data.load({
                parent: target,
                token: BaseComponent.#token,
              });
              break;
          }
          return promise.then(() => {
            // Todo: any cleanup tasks?
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
}
module.exports = BaseComponent;
