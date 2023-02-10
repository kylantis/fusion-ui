
/* eslint-disable class-methods-use-this */
class BaseRenderer {
  static #componentIds = [];
  static #components = [];

  #id;

  #input;

  #isRoot;

  #initialized;

  #config;

  #internalMeta;

  constructor({ id, input, logger, config={} } = {}) {
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
    this.logger = logger || self.appContext ? self.appContext.logger : console;
    this.#isRoot = !BaseRenderer.#componentIds.length;

    if (self.appContext) {
      BaseRenderer.#componentIds.push(this.#id);
      BaseRenderer.#components[this.#id] = this;
    }

    this.setInput(input);

    this.#config = Object.seal({
      ...BaseRenderer.getDefaultConfig(),
      ...config,
    });

    // Create root proxy
    // eslint-disable-next-line no-undef
    RootProxy.create(this);

    this.#internalMeta = {};

    this.#initialized = true;
  }

  getInternalMeta() {
    return this.#internalMeta;
  }

  static getDefaultConfig() {
    return {
      loadable: true,
      hookCleanupInterval: 300,
      allowHooksForNonExistentPaths: true,
    }
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
    if (this.#initialized) {
      throw Error(`[${this.#id}] The root object cannot be modified`);
    }
    this.#input = input;
  }

  isInitialized() {
    return this.#initialized;
  }

  load() {
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
    const o = {};
    o['@type'] = this.constructor.className || this.constructor.name;
    o['@data'] = this.getInput();
    return o;
  }

  #createId() {
    return `${this.getComponentName()}-${global.clientUtils.randomString()}`;
  }
}
module.exports = BaseRenderer;
