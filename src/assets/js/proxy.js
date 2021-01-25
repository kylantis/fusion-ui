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

    const { syntheticMethodPrefix } = RootProxy;

    const LOGIC_GATE = 'LogicGate';
    const PATH_EXPR = 'PathExpression';
    const STR_LITERAL = 'StringLiteral';
    const BOOL_LITERAL = 'BooleanLiteral';
    const NUM_LITERAL = 'NumberLiteral';
    const AND = 'AND';
    const OR = 'OR';

    const gate = this.#logicGates[gateId];

    const evaluateExpr = (expr) => {
      return Function(expr).bind(this.component)();
    }

    const getConditionExpr = parts => {
      let scope = ``;
      const and = ' && ';
      const or = ' || ';

      const expr = `return ${parts
          .map(part => {

            let variableName = global.clientUtils.randomString();

            switch (part.type) {

              case PATH_EXPR:
              case BOOL_LITERAL:
              case NUM_LITERAL:
                scope += `const ${variableName} = ${part.original};\n`;
                return variableName;

              case STR_LITERAL:
                switch (part.original) {
                  case AND:
                    return and;
                  case OR:
                    return or;
                  default:
                    scope += `const ${variableName} = "${part.original}";\n`;
                    return variableName;
                }

              case LOGIC_GATE:
                return `${JSON.stringify(analyzeGate(part))}`;
            }
          })
          .map(part => (part != and && part != or) ? `!!${part}` : part)
          .join('')};`;

      return scope + expr;
    };

    const analyzeCondition = parts => {
      const expr = getConditionExpr(parts);
      const b = evaluateExpr(expr);
      assert(typeof b === 'boolean');
      return b;
    }

    const getValue = ({ type, original }) => {
      let expr;
      switch (type) {
        case NUM_LITERAL:
        case BOOL_LITERAL:
        case PATH_EXPR:
          expr = original;
          break;
        case STR_LITERAL:
          expr = `"${original}"`;
      }
      return evaluateExpr(`return ${expr}`);
    };

    const analyzeGate = (item) => {

      while (item.type == LOGIC_GATE) {
        const data = gate.table[item.original];
        item = analyzeCondition(data.condition) ? data.left : data.right;
      }

      return getValue(item);
    }

    return analyzeGate({
      type: LOGIC_GATE,
      original: 0,
    });
  }

  resolveLogicPath({ prop }) {

    const { dataPathRoot, logicGatePathRoot, pathSeparator } = RootProxy;

    const PATH_EXPR = 'PathExpression';

    const gate = this.component.getLogicGates()[prop];

    /**
     * If this is a PathExpression, convert from a canonical path to
     * it's executable path
     */
    const toExecutablePath = (item) => {
      const { type, original } = item;
      if (type == PATH_EXPR) {
        item.original = this.component.getExecPath({
          fqPath: original.replace(`${dataPathRoot}${pathSeparator}`, ''),
        });
      }
      return item;
    }

    gate.participants = gate.participants.map((p) => {
      const { original } = toExecutablePath({
        type: PATH_EXPR,
        original: p,
      });
      return original;
    });

    for (let i = 0; i < gate.table.length; i++) {

      const item = gate.table[i];

      const { condition, left, right } = item;

      item.condition = condition.map(toExecutablePath);

      item.left = toExecutablePath(left);
      item.right = toExecutablePath(right);
    }

    const gateId = global.clientUtils.randomString();

    gate.participants
      .map(p => {
        p = p.replace(
          `${this.component.getDataBasePath()}.`,
          `${dataPathRoot}${pathSeparator}`
        );

        const dataVariable = p.match(/(?<=\[')@\w+(?='\]$)/g);
        if (dataVariable) {
          p = p.replace(`['${dataVariable[0]}']`, `.${dataVariable[0]}`);
        }
        return p;
      })
      .forEach(p => {
        this.#dataPathHooks[p].push({
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

    proxy.addDataObserver();

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

        // TODO: 
        // * Implement hook for arrays. @random

        // * Implement hook for maps

        // * Implement hook for conditionals

        // Reload children, if applicable
        if (oldValue === Object(oldValue) &&
          oldValue !== newValue
        ) {
          Object.keys(this.#dataPathHooks)
            .filter(p => p !== fqPath && p.startsWith(`${fqPath}`))
            .forEach(p => reloadPath(p.replace(`${dataPathRoot}${pathSeparator}`, '')));
        }

        // Reload parent, if applicable
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

    const canonical = path.replace(/\[[0-9]+\]/g, '_$');
    const isMap = this.component.getMapPaths().includes(canonical);

    const keys = Object.keys(obj);

    for (let i = 0; i < keys.length; i++) {
      const prop = keys[i];

      if (prop === '@path') {
        continue;
      }

      if (isMap && obj[prop] == Object(obj[prop])) {
        // Inject data variables
        obj[prop]['@first'] = i == 0;
        obj[prop]['@last'] = i == keys.length - 1;
        obj[prop]['@key'] = prop;
        obj[prop]['@index'] = i;
        obj[prop]['@random'] = global.clientUtils.randomString();
      }

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

              const o = obj[prop][i];

              // Inject data variables
              o['@first'] = i == 0;
              o['@last'] = i == obj[prop].length - 1;
              o['@key'] = o['@index'] = i;
              o['@random'] = global.clientUtils.randomString();

              this.toCanonicalObject({ path: `${p}[${i}]`, obj: o });

              obj[prop][i] = this.getObserverProxy(o);

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

module.exports = RootProxy;
