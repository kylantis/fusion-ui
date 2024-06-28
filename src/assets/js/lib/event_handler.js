class EventHandler {
    #fn;

    constructor(_fn, thisObject, scope = {}) {
      assert(
        scope['thisObject'] === undefined,
        'scope should not contain reseverved key "thisObject"'
      );

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
    }

    getFunction() {
      return this.#fn;
    }
  }

  module.exports = EventHandler;