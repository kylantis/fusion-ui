
/* eslint-disable class-methods-use-this */
class BaseRenderer {
  static #componentIds = [];

  #id;

  #input;

  isLoadable;

  #isRoot;

  #initialized;

  constructor({ id, input, loadable = true, logger, config={} } = {}) {
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
    this.isLoadable = loadable;
    this.#isRoot = !BaseRenderer.#componentIds.length;

    if (this.loadable()) {
      BaseRenderer.#componentIds.push(this.#id);
    }

    this.setInput(input);

    this.config = {
      ...BaseRenderer.getDefaultConfig(),
      ...config,
    };

    // Create root proxy
    // eslint-disable-next-line no-undef
    RootProxy.create(this);

    this.#initialized = true;
  }

  static getDefaultConfig() {
    return {
      hookCleanupInterval: 300,
      allowHooksForNonExistentPaths: true,
    }
  }

  static getComponentIds() {
    return BaseRenderer.#componentIds;
  }

  loadable() {
    const { isComponentLoadable } = global;

    if (isComponentLoadable === false) {

      // There are some scenarios where we load components without
      // actually calling the constructor manually, hence we are unable
      // to set loadable: false. For example: in getSerializedComponent(...),
      // sampleData is loaded using require, and this will cause any 
      // components inside it to be initialized as well.

      return false;
    }

    return this.isLoadable;
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
    return `${this.constructor.name}-${global.clientUtils.randomString()}`;
  }
}
module.exports = BaseRenderer;
