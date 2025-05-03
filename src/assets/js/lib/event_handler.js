/*
 *  Fusion UI
 *  Copyright (C) 2025 Kylantis, Inc
 *  
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *  
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *  
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

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