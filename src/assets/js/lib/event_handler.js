
class EventHandler {
  #userArgs;
  #evtName;
  #fn;

  constructor(_fn, thisObject, scope = {}) {
    assert(
      scope['thisObject'] === undefined,
      'scope should not contain reseverved key "thisObject"'
    );

    this.#userArgs = [_fn, thisObject, scope];
  }

  setEventName(evtName) {
    this.#evtName = evtName;
  }

  #buildFunction() {
    if (this.#fn) return;

    const [_fn, thisObject, scope = {}] = this.#userArgs;

    const args = { names: [], values: [] };

    Object.entries(scope).forEach(([k, v]) => {
      args.names.push(k);
      args.values.push(v);
    });

    const fnString = _fn.toString();

    if (fnString == 'function () { [native code] }') {
      // e.g. The user passes in a native promise resolve function directly
      // as the handler

      throw Error(
        `Could not serialize a event handler function for event "${this.#evtName}"`
      );
    }

    const fn = Function(
      'thisObject', args.names.join(', '), `

      function outerFunction() {
        return (${fnString});
      }

      return outerFunction.bind(thisObject);
      `);

    this.#fn = fn(thisObject, ...args.values)();
    this.#userArgs = null;
  }

  getFunction() {
    if (!this.#fn) {
      this.#buildFunction();
    }
    return this.#fn;
  }
}

module.exports = EventHandler;