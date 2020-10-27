/* eslint-disable class-methods-use-this */
/* eslint-disable no-undef */

class AnotherComponent2 extends BaseComponent {
  createPerson() {
    this.getInput().u.y;
    this.getInput().a.b.c[0].d;
    this.getInput().e[0].f.g;

    return 'createPerson';
  }

  getUserProfile(ctx1, ctx2) {
    return {
      fname: 'Anthony',
      lname: 'Anyanwu',
    };
  }

  getUserProfileAsync(ctx1, ctx2) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          fname: 'Anthony',
          lname: 'Anyanwu',
        });
      }, 1500);
    });
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

module.exports = AnotherComponent2;
