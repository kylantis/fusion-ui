/* eslint-disable linebreak-style */

// eslint-disable-next-line no-undef
class BaseComponent extends WebRenderer {
  constructor({
    id, input, parent,
  } = {}) {
    super({ id, input, parent });
  }

  // eslint-disable-next-line class-methods-use-this
  toHtml(object) {
    return JSON.stringify(object);
  }
}
module.exports = BaseComponent;
