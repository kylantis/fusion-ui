
/* eslint-disable class-methods-use-this */
class BaseRenderer {

  static #componentIds = [];
  static #components = {};

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

    // eslint-disable-next-line no-undef
    assert(
      !BaseRenderer.#componentIds.includes(id),
      `Duplicate componentId: ${id}`,
    );

    this.#id = id;
    this.logger = logger || self.appContext ? self.appContext.logger : this.createDefaultLogger();
    this.#isRoot = !BaseRenderer.#componentIds.length;

    if (self.appContext) {
      BaseRenderer.#componentIds.push(this.#id);
      BaseRenderer.#components[this.#id] = this;
    }

    this.setInput(input);

    this.#config = {
      ...BaseRenderer.getDefaultConfig(),
      ...config,
    };

    this.#metadata = {};
  }

  init() {
    if (!this.proxyInstance) {
      // Create root proxy
      // eslint-disable-next-line no-undef
      RootProxy.create(this);
    }
  }

  createDefaultLogger() {
    const prefix = `[${this.getId()}]`;
    return {
      log: (...msg) => {
        console.log(prefix, ...msg);
      },
      info: (...msg) => {
        console.info(prefix, ...msg);
      },
      warn: (...msg) => {
        console.warn(prefix, ...msg);
      },
      error: (...msg) => {
        console.error(prefix, ...msg);
      },
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

  static getComponent(id) {
    return BaseRenderer.#components[id];
  }

  static getComponentIds() {
    return BaseRenderer.#componentIds;
  }

  static getAllComponents() {
    return BaseRenderer.#components;
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
    return `${this.getComponentName()}-${global.clientUtils.randomString()}`;
  }
}
module.exports = BaseRenderer;
