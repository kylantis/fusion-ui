
class BaseRenderer {

  static #root;

  #id;
  #input;
  #config;
  #metaInfo;

  constructor({ id, input, logger, config = {} } = {}) {
    if (!id) {
      // eslint-disable-next-line no-param-reassign
      id = this.#createId();
    }

    if (typeof id != 'string') {
      throw Error(`Unknown component id "${id}"`);
    }

    if (!(input && input.constructor.name === 'Object')) {
      throw Error(`Unknown component input`, input);
    }

    this.#id = id;

    this.logger = this.createDefaultLogger(
      logger || self.appContext ? self.appContext.getLogger() : console,
    );

    BaseRenderer.#root = false;

    this.#input = input;

    this.#config = {
      ...BaseRenderer.getDefaultConfig(),
      ...config,
    };

    this.#metaInfo = {};
  }

  destroy() {
    this.#input = null;
    this.#config = null;
    this.#metaInfo = null;
    this.proxyInstance = null;
  }

  async init() {
    if (!this.proxyInstance) {
      // Create root proxy
      // eslint-disable-next-line no-undef
      await RootProxy.create(this);
      this.#input = null;
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

  addMetaInfo(key, value) {
    Object.defineProperty(this.#metaInfo, key, { value, configurable: true, enumerable: false });
  }

  getMetaInfo() {
    return this.#metaInfo;
  }

  static getDefaultConfig() {
    return {
      loadable: true,
      hookCleanupInterval: 300,
      allowHooksForNonExistentPaths: true,
      serialization: {},
      useWeakRef: true,
    }
  }

  addConfig(k, v) {
    this.#config[k] = v;
  }

  getConfig() {
    return this.#config;
  }

  getId() {
    return this.#id;
  }

  getInput() {
    return this.#input || this.proxyInstance.getInput();
  }

  useWeakRef() {
    const { useWeakRef } = this.#config;
    return !!useWeakRef;
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
      ['@data']: this.getInput(),
      ['@loadable']: serialization.loadable !== undefined ? !!serialization.loadable : loadable,
    };
  }

  #createId() {
    if (!self.appContext) {
      return clientUtils.randomString();
    }

    const name = this.getComponentName();
    const classMetadata = self.appContext.getComponentClassMetadataMap()[name];

    if (classMetadata.instanceIndex === undefined) {
      classMetadata.instanceIndex = -1;
    }

    const idx = classMetadata.instanceIndex += 1;
    return `${name}_${idx}`;
  }

  getInstanceIndex() {
    const name = this.getComponentName();
    const classMetadata = self.appContext.getComponentClassMetadataMap()[name];

    return classMetadata.instanceIndex;
  }
}
module.exports = BaseRenderer;
