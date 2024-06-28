
/* eslint-disable class-methods-use-this */
class BaseRenderer {

  static #root;

  #id;

  #input;

  #isRoot;

  #sealed;

  #config;

  #metadata;

  constructor({ id, input, logger, config = {} } = {}) {
    if (!id) {
      // eslint-disable-next-line no-param-reassign
      id = this.#createId();
    }

    // eslint-disable-next-line no-undef
    assert(id && id.constructor.name === 'String');
    // eslint-disable-next-line no-undef
    assert(input && input.constructor.name === 'Object');

    this.#id = id;
    
    this.logger = this.createDefaultLogger(
      logger || self.appContext ? self.appContext.getLogger() : console,
    );

    this.#isRoot = BaseRenderer.#root == undefined;
    BaseRenderer.#root = false;

    this.setInput(input);

    this.#config = {
      ...BaseRenderer.getDefaultConfig(),
      ...config,
    };

    this.#metadata = {};
  }

  inWorker() {
    return typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope;
  }

  destroy() {
    this.#input = null;
    this.#config = null;
    this.#metadata = null;
    this.proxyInstance = null;
  }

  async init() {
    if (!this.proxyInstance) {
      // Create root proxy
      // eslint-disable-next-line no-undef
      await RootProxy.create(this);
    }
  }

  createDefaultLogger(logger) {
    const { getLine } = clientUtils;
    const prefix = (loc) => `[${this.getId()}${loc ? ` ${getLine({ loc })}` : ''}]`;

    const NOOP = () => { };

    return logger ? {
      log: (loc, ...msg) => {
        logger.log(prefix(loc), ...msg);
      },
      info: (loc, ...msg) => {
        logger.info(prefix(loc), ...msg);
      },
      warn: (loc, ...msg) => {
        logger.warn(prefix(loc), ...msg);
      },
      error: (loc, ...msg) => {
        logger.error(prefix(loc), ...msg);
      },
    } : {
      log: NOOP, info: NOOP, warn: NOOP, error: NOOP,
    }
  }

  addMetadata(key, value) {
    Object.defineProperty(this.#metadata, key, { value, configurable: true, enumerable: false });
  }

  getMetaData() {
    return this.#metadata;
  }

  static getDefaultConfig() {
    return {
      loadable: true,
      hookCleanupInterval: 300,
      allowHooksForNonExistentPaths: true,
      serialization: {},
    }
  }

  addConfig(k, v) {
    this.#config[k] = v;
  }

  getConfig() {
    return this.#config;
  }

  isRoot() {
    return this.#isRoot;
  }

  getId() {
    return this.#id;
  }

  getInput() {
    return this.#input;
  }

  setInput(input) {
    if (this.#sealed) {
      throw Error(`[${this.#id}] The root object cannot be modified`);
    }
    this.#input = input;
  }

  isSealed() {
    return this.#sealed;
  }

  seal() {
    this.#sealed = true;
  }

  evaluateExpression(code, scope) {
    return AppContext.evaluate(code, scope, this);
  }

  /**
   * This is used to serialize this component instance. It is useful when we need
   * to clone components.
   * @see global.clientUtils.stringifyComponentData
   */
  toJSON() {
    const { serialization, loadable } = this.#config;

    return {
      ['@component']: true,
      ['@type']: this.constructor.className || this.constructor.name,
      ['@data']: this.#input,
      ['@loadable']: serialization.loadable !== undefined ? !!serialization.loadable : loadable,
    };
  }

  #createId() {
    if (!self.appContext) {
      return clientUtils.randomString();
    }

    const name = this.getComponentName();
    const { constructor } = this;

    if (constructor.instanceIndex === undefined) {
      constructor.instanceIndex = -1;
    }

    const idx = constructor.instanceIndex += 1;
    return `${name}_${idx}`;
  }
}
module.exports = BaseRenderer;
