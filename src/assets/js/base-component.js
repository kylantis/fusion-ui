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

  render({ data, target }) {
    if (global.isServer || !data) {
      return Promise.resolve();
    }

    const {
      CHAINED_LOADING_STRATEGY,
      ASYNC_LOADING_STRATEGY,
    } = BaseComponent;

    const strategy = this.loadingStrategy();
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

          switch (true) {
            case data.constructor.name === 'String':
              promise = promise.then(() => {
                node.insertAdjacentText('afterend', data);
              });
              break;

              // eslint-disable-next-line no-undef
            default:
              // eslint-disable-next-line no-shadow
              const parent = document.createElement('div');
              parent.id = data.getNodeId();
              node.insertAdjacentElement('afterend', parent);
              promise = data.load({
                parent: parent.id,
                token: BaseComponent.#token,
              });
              break;
          }
          return promise.then(() => {
            node.remove();
          });
        }));

    switch (strategy) {
      case CHAINED_LOADING_STRATEGY:
        this.promise = future;
        break;
      case ASYNC_LOADING_STRATEGY:
        this.futures.push(future);
        break;

      default:
        throw new Error(`Unknown strategy: ${strategy}`);
    }

    return future;
  }

  getNodeId() {
    return `${this.getId()}-container`;
  }
}
module.exports = BaseComponent;
