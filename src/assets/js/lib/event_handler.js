class EventHandler {
  #userArgs;
  #fn;

  constructor(_fn, thisObject, scope = {}) {
    assert(
      scope['thisObject'] === undefined,
      'scope should not contain reseverved key "thisObject"'
    );

    this.#userArgs = [_fn, thisObject, scope];
  }

  #buildFunction() {
    if (this.#fn) return;

    const [_fn, thisObject, scope = {}] = this.#userArgs;

    const args = { names: [], values: [] };

    Object.entries(scope).forEach(([k, v]) => {
      args.names.push(k);
      args.values.push(v);
    });

    const fn = Function(
      'thisObject', args.names.join(', '), `

      function outerFunction() {
        return (${_fn.toString()});
      }

      return outerFunction.bind(thisObject);
      `);

    this.#fn = fn(thisObject, ...args.values)();
    this.#userArgs = null;
  }

  getFunction() {
    if (!this.#fn){
      this.#buildFunction();
    }
    return this.#fn;
  }
}

module.exports = EventHandler;