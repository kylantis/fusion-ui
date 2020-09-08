
/* eslint-disable class-methods-use-this */
class BaseRenderer {
  constructor({
    id, input,
  } = {}) {
    this.id = id;
    this.logger = console;

    BaseRenderer.addPolyfills();

    // eslint-disable-next-line default-case
    switch (input.constructor.name) {
      case 'Object':
        this.getDataStore()
          .set(this.id, {
            input,
          });
        break;
      default:
        // eslint-disable-next-line no-undef
        assert(input.constructor.name === 'PathResolver');
        // Note: This is usually the case during compile-time
        this.resolver = input;
        break;
    }

    // Create root proxy
    // eslint-disable-next-line no-undef
    RootProxy.create({ component: this });
  }

  getId() {
    return this.id;
  }

  getDataStore() {
    if (!window.dataStore) {
      window.dataStore = new Map();
    }
    return window.dataStore;
  }

  getInput() {
    return this.getDataStore()
      .get(this.id).input;
  }

  load() {
  }

  static addPolyfills() {
    window.assert = (condition, message) => {
      if (!condition) {
        throw new Error(`Assertion Error${message ? `: ${message}` : ''}`)
      }
    };
  }
}
module.exports = BaseRenderer;
