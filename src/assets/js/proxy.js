/* eslint-disable no-case-declarations */

class RootProxy {
  // eslint-disable-next-line no-useless-escape
  static syntheticMethodPrefix = 's$_';

  static logicGatePathRoot = 'logic_gate';

  static dataPathRoot = 'data';

  static pathSeparator = '__';

  static dataPathPrefix = new RegExp(`^${RootProxy.dataPathRoot}${RootProxy.pathSeparator}`);

  static logicGatePathPrefix = new RegExp(`^${RootProxy.logicGatePathRoot}${RootProxy.pathSeparator}`);

  static rawDataPrefix = 'r$_';

  static literalPrefix = 'l$_';

  static emptyObject = {};

  static emptyString = '';

  #dataPathHooks;

  #logicGates;

  constructor({ component }) {
    this.component = component;
    this.handler = this.createObjectProxy();
    this.#dataPathHooks = this.createImmutableObject();
    this.#logicGates = {};
  }

  createImmutableObject() {
    return new Proxy({}, {
      set: function (object, key, value) {
        return object[key] === undefined ? object[key] = value : true;
      },
    })
  }

  getValue(value) {
    this.lastLookup = value;

    switch (true) {
      case value && value.constructor.name === 'Array':
        return this.createArrayProxy(value);

      case value && value.constructor.name === 'Object':
        return this.handler;

      default:
        return value;
    }
  }

  getLogicGateValue({ gateId }) {

    const component = this.component;
    const getValue = path => {
      return eval(
        ['component.getInput()', path].join('.')
      )
    };

    const gate = this.#logicGates[gateId];

    let next = 0;

    while (!Number.isNaN(parseInt(next, 10))) {
      const data = gate.table[next];
      const condition = getValue(data.condition);
      next = condition ? data.left : data.right;
    }

    return getValue(next.key);
  }

  resolveLogicPath({ prop }) {

    const { dataPathRoot, logicGatePathRoot, pathSeparator } = RootProxy;

    const gate = this.component.getLogicGates()[prop];

    const toCanonicalPath = p => this.component.getExecPath({
      fqPath: p.replace(`${dataPathRoot}${pathSeparator}`, ''),
      addBasePath: false
    })

    gate.participants = gate.participants.map(toCanonicalPath);

    for (let i = 0; i < gate.table.length; i++) {
      const data = gate.table[i];
      data.condition = toCanonicalPath(data.condition);

      if (Number.isNaN(parseInt(data.left, 10))) {
        data.left.key = toCanonicalPath(data.left.key);
        // provisional
        gate.participants.push(data.left.key);
      }

      if (Number.isNaN(parseInt(data.right, 10))) {
        data.right.key = toCanonicalPath(data.right.key);
        // provisional
        gate.participants.push(data.right.key);
      }
    }
    const gateId = global.clientUtils.randomString();

    gate.participants.forEach(p => {
      this.#dataPathHooks[`${dataPathRoot}${pathSeparator}${p}`].push({
        type: 'gateParticipant',
        gateId,
      });
    });

    this.#logicGates[gateId] = gate;
    const path = `${logicGatePathRoot}${pathSeparator}${gateId}`;

    this.#dataPathHooks[path] = [];

    const value = this.getLogicGateValue({ gateId });

    return {
      path,
      value,
    };
  }

  resolveDataPath({ prop, isRawReturn = false }) {
    const {
      literalPrefix, emptyString, rawDataPrefix
    } = RootProxy;

    // eslint-disable-next-line no-undef
    assert(prop.constructor.name === 'String');

    if (prop.startsWith(literalPrefix)) {
      return prop.replace(literalPrefix, emptyString);
    }

    if (prop.startsWith(rawDataPrefix)) {
      // eslint-disable-next-line no-param-reassign
      prop = prop.replace(rawDataPrefix, '');
      isRawReturn = true;
    }

    const fromMustache = prop.endsWith('!');

    if (fromMustache) {
      // eslint-disable-next-line no-param-reassign
      prop = prop.replace(/\!$/g, '');
      isRawReturn = true;
    }

    // eslint-disable-next-line no-case-declarations
    const v = this.component
      .getPathValue({ path: prop, fromMustache });

    const ret = isRawReturn ? this.getRawValueWrapper(v) : this.getValue(v);

    return ret;
  }

  /**
   * This wraps a raw value.
   */
  getRawValueWrapper(value) {
    // eslint-disable-next-line no-underscore-dangle
    const _this = this;
    switch (true) {
      case value !== Object(value):
        return value;
      // eslint-disable-next-line no-undef
      case value instanceof BaseComponent:
        return value;
      default:
        return new Proxy(value, {
          get(obj, prop) {
            if (prop === 'toHTML' || prop === Symbol.toPrimitive) {
              return () => _this.component.toHtml(obj);
            }
            return obj[prop];
          },
        });
    }
  }

  getProxyIterator() {
    // eslint-disable-next-line no-underscore-dangle
    const _this = this;
    // eslint-disable-next-line func-names
    return function* () {
      const keys = Object.keys(_this.lastLookup);
      // eslint-disable-next-line no-plusplus
      for (let i = 0; i < keys.length; i++) {
        // At least, attempt to do a read on the underlying json
        // object, so that if it is a proxy itself, the "get"
        // interceptor method will be invoked
        // eslint-disable-next-line no-unused-expressions
        _this.lastLookup[keys[i]];

        yield _this.handler;
      }
    };
  }

  createObjectProxy() {
    const {
      dataPathPrefix, logicGatePathPrefix, syntheticMethodPrefix,
    } = RootProxy;
    // eslint-disable-next-line no-underscore-dangle
    const _this = this;
    return new Proxy({}, {
      get: (obj, prop) => {
        if (prop === Symbol.iterator) {
          return this.getProxyIterator();
        }

        switch (true) {
          // eslint-disable-next-line no-prototype-builtins
          case !!Object.getPrototypeOf(obj)[prop]:
            return obj[prop];

          case prop === 'toHTML':
          case prop === Symbol.toPrimitive:
            return () => _this.component.toHtml(this.lastLookup);

          case prop.startsWith('@root'):
            // eslint-disable-next-line no-case-declarations
            const arr = prop.split('.');
            arr[0] = '_this.component.getRootGlobals()';
            // eslint-disable-next-line no-eval
            return eval(arr.join('.'));

          case !!(prop.match(dataPathPrefix) || prop.startsWith(syntheticMethodPrefix)):
            return this.resolveDataPath({ prop: prop.replace(dataPathPrefix, '') });

          case !!prop.match(logicGatePathPrefix):
            return this.resolveLogicPath({ prop: prop.replace(logicGatePathPrefix, '') });

          case prop === 'getSyntheticNodeId':
            return this.component.getSyntheticNodeId();

          default:
            throw new Error(`Invalid path: ${prop}`);

        }
      },
    });
  }

  createArrayProxy(array) {
    // eslint-disable-next-line no-underscore-dangle
    const _this = this;
    return new Proxy(array, {
      get: (obj, prop) => {
        switch (true) {
          case prop === 'toHTML':
          case prop === Symbol.toPrimitive:
            return () => _this.component.toHtml(obj);

          case !Number.isNaN(parseInt(prop, 10)):
            // At least access the context, so that our array proxy
            // created in setSyntheticContext(...) intercepts the value
            // and updates the synthetic context
            // eslint-disable-next-line no-unused-expressions
            obj[prop];
            return this.createObjectProxy();

          default:
            return obj[prop];
        }
      },
    });
  }

  static create({ component }) {

    const proxy = new RootProxy({ component });
    proxy.component.proxyInstance = proxy;
    proxy.component.rootProxy = proxy.handler;

    if (!global.isServer) {
      proxy.addDataObserver();
    }

    return proxy.handler;
  }

  setSchema({ schema }) {

    const ajvSchemas = [];

    for (const id in schema.definitions) {
      if ({}.hasOwnProperty.call(schema.definitions, id)) {
        ajvSchemas.push({
          $id: `#/definitions/${id}`,
          ...schema.definitions[id]
        });
      }
    }

    this.schema = schema;
    this.ajv = new Ajv({ schemas: ajvSchemas });
  }

  addDataObserver() {

    // Recursively add @path to each object and array, 
    // and also update this.#dataPaths accordingly
    this.toCanonicalObject({ path: '', obj: this.component.getInput() });

    // console.info(JSON.stringify(this.component.getInput()));

    // note: toCanonicalObject needs to be called everytime an array append happens


    // integrate JOI for array appends as well


    // when whole object are removed, via (array or object) operations, also, we need
    // do a bulk remove on this.#dataPaths as well

  }

  getDataPathHooks() {
    return this.#dataPathHooks;
  }

  getObserverProxy(object) {
    const { dataPathRoot, logicGatePathRoot, pathSeparator } = RootProxy;

    return new Proxy(object, {
      set: (obj, prop, newValue) => {

        const isArray = obj.constructor.name === 'Array';

        if (isArray && Number.isNaN(parseInt(prop, 10))) {
          throw new Error(`Invalid index: ${prop} for array: ${obj['@path']}`);
        }

        const oldValue = obj[prop];

        const triggerHooks = path => {
          const hooks = this.#dataPathHooks[path];

          hooks.forEach(hook => {

            let nodeValue = newValue

            if (path.startsWith(`${logicGatePathRoot}${pathSeparator}`)) {
              const gateId = path.replace(`${logicGatePathRoot}${pathSeparator}`, '')
              nodeValue = this.getLogicGateValue({ gateId });
            }

            switch (hook.type) {

              case 'textNode':
                document.getElementById(hook.nodeId).innerHTML = typeof nodeValue == 'string' ? nodeValue : JSON.stringify(nodeValue);
                break;

              case 'gateParticipant':
                triggerHooks(`${logicGatePathRoot}${pathSeparator}${hook.gateId}`);
                break;
            }
          });
        }

        const reloadPath = path => {
          // Because of babel optimizations, I need to call this outside
          // the eval string to avoid an "undefined" error at runtime
          const component = this.component;
          const p = ['component.getInput()', path].join('.')
          return eval(`${p} = ${p}`)
        };

        const parent = obj['@path'];

        const fqPath = `${dataPathRoot}${pathSeparator}${isArray ?
          `${parent}[${prop}]` :
          `${parent.length ? `${parent}.` : ''}${prop}`
          }`;

        // console.info(fqPath);

        triggerHooks(fqPath);

        if (oldValue === Object(oldValue) &&
          oldValue !== newValue
        ) {

          const sPath = fqPath
            .replace(`${dataPathRoot}${pathSeparator}`, '')
            .replace(/\[[0-9]+\]/g, '_$');

          const $id = this.schema.paths[sPath];
          const validate = this.ajv.getSchema($id)

          if (!validate(newValue)) {
            throw new Error(`${fqPath} could not be mutated due to schema mismatch`, result.error);
          }

          this.toCanonicalObject({
            path: fqPath,
            obj: newValue
          });
        }

        obj[prop] = newValue;

        if (oldValue === Object(oldValue) &&
          oldValue !== newValue
        ) {
          Object.keys(this.#dataPathHooks)
            .filter(p => p !== fqPath && p.startsWith(`${fqPath}`))
            .forEach(p => reloadPath(p.replace(`${dataPathRoot}${pathSeparator}`, '')));
        }

        if (parent.length) {
          reloadPath(parent);
        }

        return true;
      }
    });
  }

  toCanonicalObject({ path, obj }) {

    const { dataPathRoot, pathSeparator } = RootProxy;
    const isArray = Array.isArray(obj);

    Object.defineProperty(obj, '@path', { value: path, configurable: false, writable: false });
    this.#dataPathHooks[`${dataPathRoot}${pathSeparator}${path}`] = [];

    for (const prop in obj) {
      if ({}.hasOwnProperty.call(obj, prop) && prop !== '@path') {

        const p = `${path}${isArray ? `[${prop}]` : `${path.length ? '.' : ''}${prop}`}`;

        if (obj[prop] == null || obj[prop] === undefined) {
          throw new Error(`No value provided at path: ${p}`);
        }

        // eslint-disable-next-line default-case
        switch (true) {
          case obj[prop].constructor.name === 'Object':
            this.toCanonicalObject({ path: p, obj: obj[prop] });
            obj[prop] = this.getObserverProxy(obj[prop]);
            break;

          case obj[prop].constructor.name === 'Array':
            // eslint-disable-next-line no-plusplus
            for (let i = 0; i < obj[prop].length; i++) {
              if (obj[prop][i] === Object(obj[prop][i])) {
                this.toCanonicalObject({ path: `${p}[${i}]`, obj: obj[prop][i] });
                obj[prop][i] = this.getObserverProxy(obj[prop][i]);
              } else {
                this.#dataPathHooks[`${dataPathRoot}${pathSeparator}${p}[${i}]`] = [];
              }
            }

            Object.defineProperty(obj[prop], '@path', { value: p, configurable: false, writable: false });
            this.#dataPathHooks[`${dataPathRoot}${pathSeparator}${p}`] = [];

            obj[prop] = this.getObserverProxy(obj[prop]);
            break;

          default:
            this.#dataPathHooks[`${dataPathRoot}${pathSeparator}${p}`] = [];
            break;
        }
      }
    }
  }
}

module.exports = RootProxy;
