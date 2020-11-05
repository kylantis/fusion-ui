/* eslint-disable class-methods-use-this */
/* eslint-disable no-undef */

class AnotherComponent extends BaseComponent {
  createPerson() {
    this.getInput().x.y;
    this.getInput().a.b.c[0].d;
    this.getInput().e[0].f.g;

    return 'createPerson';
  }

  createText() {
    return 'createText';
  }

  loadingStrategy() {
    return BaseComponent.ASYNC_LOADING_STRATEGY;
  }

  // In server mode, for a component render in js, how do we
  // resolve this.getInput() which is obviously null at the time

  // Ensure unique class names per component

  // Figure out XHR requests / custom blocks

  myMethod(options) {
    const { hash: { ctx } } = options;
    return 'Yello!';
  }
}

module.exports = AnotherComponent;
