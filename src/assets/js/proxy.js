/* eslint-disable no-case-declarations */

// Make all members (that are applicable) private
class RootProxy {
  // eslint-disable-next-line no-useless-escape
  static syntheticMethodPrefix = 's$_';

  static logicGatePathRoot = 'logic_gate';

  static globalsBasePath = 'globals';

  static dataPathRoot = 'data';

  static pathSeparator = '__';

  static dataPathPrefix = RegExp(`^${RootProxy.dataPathRoot}${RootProxy.pathSeparator}`);

  static logicGatePathPrefix = RegExp(`^${RootProxy.logicGatePathRoot}${RootProxy.pathSeparator}`);

  static globalsPathPrefix = RegExp(`^${RootProxy.globalsBasePath}${RootProxy.pathSeparator}`);

  static rawDataPrefix = 'r$_';

  static literalPrefix = 'l$_';

  static emptyObject = {};

  static emptyString = '';

  static pathProperty = '@path';

  static firstProperty = '@first';

  static lastProperty = '@last';

  static keyProperty = '@key';

  static indexProperty = '@index';

  static randomProperty = '@random';

  static typeProperty = '@type';

  static literalType = 'Literal';

  static arrayType = 'Array';

  static objectType = 'Object';

  static mapType = 'Map';

  static componentRefType = 'componentRef';

  static mapKeyPrefix = '$_';

  static mapKeyPrefixRegex = /^\$_/g;

  static predicateHookType = 'predicate';

  static conditionalBlockHookType = 'conditionalBlock';

  static eachBlockHookType = 'arrayBlock';

  static textNodeHookType = 'textNode';

  static gateParticipantHookType = 'gateParticipant';

  static arrayChildBlockHookType = 'arrayChildBlock';

  static nodeAttributeHookType = 'nodeAttribute';

  static nodeAttributeKeyHookType = 'nodeAttributeKey';

  static nodeAttributeValueHookType = 'nodeAttributeValue';

  static collChildSetHookType = 'collChildSet';

  static arrayChildReorderHookType = 'arrayChildReorder';

  static collChildDetachHookType = 'collChildDetach';

  static isMapProperty = '$isMap';

  static isNullProperty = '$isNull';

  static mapSizeProperty = 'size';

  static mapKeysProperty = 'keys';

  static isHookProperty = '$isHook';

  static lenientExceptionMsgPattern = /^Cannot read properties of (undefined|null)/g;

  static enumsFile = 'dist/components/enums.json';

  static copyEnumsCommand = 'npx gulp copy-enums';

  #dataPathHooks;

  #logicGates;

  #pathValues;

  #disableHooks;

  #randomValues;

  #pathTree;

  #dataPathKeys;

  static #dataReferences = [];

  static #privilegedMode = false;

  static pathSchemaDefPrefix = '__pathSchema';

  constructor({ component }) {
    this.component = component;
    this.handler = this.createObjectProxy();

    this.#dataPathHooks = this.createDataPathHooksObject();
    this.#logicGates = {};

    this.#pathValues = this.#createPathValuesObject();
    this.#randomValues = this.#createRandomValuesObject();

    this.#pathTree = {};
    this.#dataPathKeys = [];
  }

  #createRandomValuesObject() {
    return new Proxy({}, {
      get: (object, key) => {
        if (object[key] === undefined) {
          object[key] = clientUtils.randomString();
        }

        const o = object[key];
        assert(typeof o == 'string');

        return o;
      },
    })
  }

  createDataPathHooksObject() {
    const { isHookProperty } = RootProxy;

    return new Proxy({}, {
      set: (object, key, value) => {
        assert(Array.isArray(value));

        if (!this.component.dataBindingEnabled()) {
          return true;
        }

        // Only set - if not set already
        return object[key] === undefined ? object[key] = value : true;
      },
      get: (object, key) => {
        switch (key) {
          case 'set':
            return (k, v) => {
              if (!v[isHookProperty]) {
                this.createHooksArray(k, v);
                return true;
              } else {
                return (object[k] = v);
              }
            }
          default:
            return object[key];
        }
      },
    })
  }

  #createPathValuesObject() {
    return new Proxy({}, {
      set: (object, key, value) => {
        const o = object[key];
        const isEmpty = o === undefined;

        if (isEmpty || o.newValue !== value) {
          object[key] = {
            oldValue: isEmpty ? o : o.newValue,
            newValue: value,
          }
        }

        return true;
      },
    })
  }

  onPathChange(path) {

    const { value, parentObject } = this.getInfoFromPath(path, null);

    this.#pathValues[path] = value;

    this.#pathValues[path].parentObject = parentObject;
  }

  getDataPathKeys() {
    return this.#dataPathKeys;
  }

  getPathTree() {
    return this.#pathTree;
  }

  getPathValues() {
    return this.#pathValues;
  }

  getPathInfo(path) {
    return this.#pathValues[path];
  }

  getValueFromPath(path, noOpValue) {
    return this.component.evalPathLeniently(`this.getInput()${path.length ? '.' : ''}${path}`, noOpValue);
  }

  static #isPriviledgedMode() {
    return RootProxy.#privilegedMode;
  }

  static #runPriviledged(fn) {
    RootProxy.#privilegedMode = true;
    fn();
    RootProxy.#privilegedMode = false;
  }

  static create(component) {

    const { getGlobalSchemasObject } = RootProxy;
    const proxy = new RootProxy({ component });

    proxy.component.proxyInstance = proxy;
    proxy.component.rootProxy = proxy.handler;

    if (self.appContext) {

      if (!proxy.getSchemaDefinitions()) {
        // register input schema
        proxy.withSchema(
          getGlobalSchemasObject()[component.getComponentName()]
        );
      }

      if (proxy.component.isLoadable0()) {
        proxy.#toCanonicalObject({ path: '', obj: component.getInput() });

        // Add our observer, to orchestrate data binding operations
        proxy.#addDataObserver();

        proxy.getDataPathKeys()
          .forEach(p => {
            proxy.onPathChange(p);
          })
      }
    }

    return proxy.handler;
  }

  static getGlobalSchemasObject() {
    return window.__schemas || (window.__schemas = {});
  }

  static getGlobalSChemaDefinitionsObject() {
    return window.__schemaDefinitions || (window.__schemaDefinitions = {});
  }

  #setSchemaDefinitions(s) {
    const { getGlobalSChemaDefinitionsObject } = RootProxy;

    const o = getGlobalSChemaDefinitionsObject();
    const componentName = this.component.getComponentName();

    o[componentName] = s;
  }

  getSchemaDefinitions() {
    const { getGlobalSChemaDefinitionsObject } = RootProxy;

    const o = getGlobalSChemaDefinitionsObject();
    const componentName = this.component.getComponentName();

    return o[componentName];
  }

  withSchema(schema) {

    const {
      pathProperty, firstProperty, lastProperty, keyProperty, indexProperty, randomProperty,
      emptyString, enumsFile, copyEnumsCommand,
    } = RootProxy;

    const syntheticProperties = [
      pathProperty, firstProperty, lastProperty, keyProperty, indexProperty, randomProperty,
    ];

    const { definitions } = schema;
    const defPrefx = '#/definitions/';

    for (let id in definitions) {
      if ({}.hasOwnProperty.call(definitions, id)) {

        let definition = definitions[id];

        if (definition.isComponent || definition.isEnumRef) {
          // These will be pruned later
          continue;
        }

        if (definition.$ref) {
          definition = definitions[definition.$ref.replace(defPrefx, emptyString)];
        }

        // Add definition id
        definition.$id = `${defPrefx}${id}`;

        const addDataVariables = (def) => {

          if (def.properties && def.properties[firstProperty]) {
            assert(def.shared);
            // Data variables has been already been registered
            return;
          }

          const dataVariables = {
            [firstProperty]: { type: 'boolean' },
            [lastProperty]: { type: 'boolean' },
            [keyProperty]: { type: ['string', 'integer'] },
            [indexProperty]: { type: 'integer' },
            [randomProperty]: { type: 'string' },
          }
          def.properties = {
            ...def.properties || {},
            ...dataVariables
          }
          def.required = [
            ...def.required || [],
            ...Object.keys(dataVariables)
          ]
        }

        Object.keys(definition.properties)
          .filter(k => !syntheticProperties.includes(k))
          .map(k => definition.properties[k])
          .map(def => {

            const visit = (def) => {

              assert(!def.type || typeof def.type == 'string')

              let childProperty;

              switch (true) {

                // Object
                case !!def.$ref:
                  const refName = def.$ref.replace(defPrefx, '');

                  switch (true) {

                    // Inline enum reference
                    case definitions[refName].isEnumRef:
                      const enumName = definitions[refName].originalName;
                      const enum0 = self.appContext.enums[enumName];

                      if (!enum0) {
                        this.component.throwError(
                          `Could not find eunm "${enumName}". Ensure that ${enumsFile} contains the latest changes, try running "${copyEnumsCommand}"`
                        );
                      }

                      def.enum = [
                        ...enum0,
                        null
                      ];

                      delete def.$ref;
                      break;

                    // Reference to an external component
                    case definitions[refName].isComponent:
                    // Reference to the current component
                    case refName == this.component.getComponentName():

                      def.type = ['object', 'null']
                      def.component = {
                        className: refName,
                      };

                      delete def.$ref;
                      break;
                  }

                  break;

                // Enum
                case !!def.enum:
                  def.enum = [...def.enum, null]
                  break;

                // Map
                case !!def.additionalProperties:
                  childProperty = 'additionalProperties';

                // Array
                case def.type == 'array':
                  if (!childProperty) {
                    childProperty = 'items';
                  }

                  // Process children first.
                  // One reason for this is: this will help us determine enums 
                  // because the $ref property will be replaced by the enum property

                  visit(def[childProperty]);

                  // This corresponds to the condition in toCanonical(...):
                  // obj[prop] === Object(obj[prop]) or obj[prop][i] === Object(obj[prop])[i]
                  if (
                    def[childProperty].$ref ||
                    def[childProperty].additionalProperties ||
                    def[childProperty].type == 'array'
                  ) {

                    if (def[childProperty].$ref) {
                      addDataVariables(definitions[
                        def[childProperty].$ref.replace(defPrefx, '')
                      ])
                    } else {
                      addDataVariables(def[childProperty])
                    }
                  }

                default:
                  // Allow null values
                  def.type = [def.type, 'null']
                  break;
              }
            }

            visit(def)

            return def;
          })


        if (id == this.component.getComponentName()) {
          // The root definition should contain an empty string in the path property
          definition.properties[pathProperty] = {
            enum: ['']
          }
        } else {

          definition.type = [definition.type, "null"]
          definition.properties[pathProperty] = { type: 'string' }
        }

        definition.required.push(pathProperty);

        // Register schema, per path
        Object.keys(definition.properties)
          .filter(k => !syntheticProperties.includes(k))
          .forEach(k => {

            const { toDefinitionName } = RootProxy;

            const addSchema = (v) => {

              const path = v[pathProperty];
              assert(path && path.length);

              delete v[pathProperty];

              path.forEach((p) => {
                const _p = toDefinitionName(p);

                if (!definitions[_p]) {

                  definitions[_p] = {
                    ...v,
                    $id: `${defPrefx}${_p}`
                  };

                  if (
                    v.$ref &&
                    definitions[v.$ref.replace(defPrefx, '')].shared
                  ) {
                    // If the object this definition references is shared, indicate
                    definitions[_p].referencesShared = true;
                  }

                } else {
                  assert(
                    definitions[_p].referencesShared || definitions[p].shared
                  );
                }
              });

              switch (true) {
                case !!v.additionalProperties && typeof v.additionalProperties == 'object':
                  addSchema(v.additionalProperties)
                  break;

                case !!v.items:
                  addSchema(v.items)
                  break;
              }
            }

            addSchema(definition.properties[k])
          });
      }

    }

    // Cleanup definitions
    for (const id of Object.keys(definitions)) {
      const definition = definitions[id];

      switch (true) {

        case definition.isEnumRef:
        case definition.isComponent:
          delete definitions[id]
          break;
      }
    }

    this.#setSchemaDefinitions(
      new Proxy(definitions, {
        // For paths that reference shared types, we want to automatically return
        // the referenced shared type
        get: (obj, prop) => {
          switch (true) {
            case prop === 'toJSON':
              return () => obj;

            default:
              let v = obj[prop];

              if (v.referencesShared) {
                v = obj[v.$ref.replace(defPrefx, '')];
              }
              return v;
          }
        },
      })
    );

    // Though, we do not use ajv for schema validation, our definitions are designed to be fully
    // compatible with the library. Below are the keywords required by our schemas

    // // Add custom validator for component instances
    // ajv.addKeyword({
    //   keyword: 'component',
    //   validate: ({ className }, data) => !data || data instanceof components[className],
    //   errors: true,
    // });

    // // Definitions for shared types have a property "shared: true", register this keyword
    // // so that ajv recognizes it in strict mode
    // ajv.addKeyword('shared');
  }

  getDataPathHooks() {
    return this.#dataPathHooks;
  }

  #addDataObserver() {

    const { dataPathRoot, pathSeparator, globalsBasePath } = RootProxy;

    if (RootProxy.#dataReferences.includes(this.component.getInput())) {

      // The reason we have to throw this error is because the input in question
      // has previously been transformed such that data variables are created as 
      // immutable, and this operation will attempt re-set those prop, hence resulting
      // in an error.
      // It is understandable that the developer may want to re-use input data
      // without giving much thought to it, so in the error message - add a useful hint

      this.component.throwError(
        'Input data already processed. You need to clone the data first before using it on a new component instance'
      );
    }

    this.component.setInput(
      this.getObserverProxy(this.component.getInput())
    );

    RootProxy.#dataReferences.push(this.component.getInput());

    // Add globals to dataPathHooks
    Object.keys(this.component.getGlobalVariables())
      .forEach(variable => {
        this.createHooksArray(
          [dataPathRoot, globalsBasePath, variable].join(pathSeparator)
        );
      });
  }

  createObjectProxy() {
    const { dataPathRoot, dataPathPrefix, logicGatePathPrefix, isRootPath } = RootProxy;
    // eslint-disable-next-line no-underscore-dangle
    const _this = this;
    return new Proxy({}, {
      get: (obj, prop) => {

        switch (true) {
          case prop === Symbol.iterator:
            return this.getProxyIterator();

          // eslint-disable-next-line no-prototype-builtins
          case !!Object.getPrototypeOf(obj)[prop]:
            return obj[prop];

          case prop === 'toHTML':
          case prop === Symbol.toPrimitive:
            return () => _this.component.toHtml(this.lastLookup);

          case prop === 'toJSON':
            return () => this.lastLookup;

          case prop == dataPathRoot:
            return _this.createObjectProxy()

          case isRootPath(prop):
            return prop.match(logicGatePathPrefix) ?
              this.resolveLogicPath({ prop: prop.replace(logicGatePathPrefix, '') }) :
              this.resolveDataPath({ prop: prop.replace(dataPathPrefix, '') });

          case prop === 'data':
            return this;

          case prop === 'getSyntheticNodeId':
            return this.component.getSyntheticNodeId();

          case prop === 'length':
            // The forEach helper has an object target
            assert(_this.lastLookup.constructor.name == 'Object');

            return Object.keys(_this.lastLookup).length;

          case global.clientUtils.isNumber(prop):

            // At least access the context, so that the proxy
            // created in setSyntheticContext(...) intercepts the value
            // and updates the synthetic context
            // eslint-disable-next-line no-unused-expressions
            _this.lastLookup[
              Object.keys(_this.lastLookup)[prop]
            ];

            return this.createObjectProxy();

          default:
            this.component.throwError(`Invalid path: ${prop}`);
        }
      },
      // Todo: remove these functions if not used
      ownKeys() {
        return Reflect.ownKeys(_this.lastLookup);
      },
      getOwnPropertyDescriptor() {
        return {
          enumerable: true,
          configurable: true,
        }
      }
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

          case global.clientUtils.isNumber(prop):

            // At least access the context, so that the proxy
            // created in setSyntheticContext(...) intercepts the value
            // and updates the synthetic context
            // eslint-disable-next-line no-unused-expressions
            obj[prop];

            return this.createObjectProxy();

          case prop === 'toJSON':
            return () => array;

          default:
            return obj[prop];
        }
      },
    });
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
      case value instanceof Map:
      case value instanceof Promise:
        return value;
      default:
        assert(['Array', 'Object'].includes(value.constructor.name));
        return new Proxy(value, {
          get(obj, prop) {

            switch (true) {
              case prop === 'toHTML' || prop === Symbol.toPrimitive:
                return () => _this.component.toHtml(obj);

              default:
                return obj[prop];
            }
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
        // interceptor method will be invoked. The main reason
        // we do this is because of synthetic contexts, as this
        // needed to set the "current" value. See setSyntheticContext(...)

        // eslint-disable-next-line no-unused-expressions
        _this.lastLookup[keys[i]];

        yield _this.handler;
      }
    };
  }

  setLastLookup(value) {
    this.lastLookup = value;
  }

  /**
   * This is used by CustomCtxRenderer#wrapDataWithProxy to determine if a path
   * should be resolved by the rootProxy
   * @param {String} path 
   * @returns 
   */
  static isRootPath(path) {
    // eslint-disable-next-line no-undef
    const {
      dataPathPrefix, syntheticMethodPrefix, logicGatePathPrefix, rawDataPrefix
    } = RootProxy;
    return !!(path.match(dataPathPrefix) ||
      path.startsWith(syntheticMethodPrefix) ||
      path.startsWith(`${rawDataPrefix}${syntheticMethodPrefix}`) ||
      path.match(logicGatePathPrefix));
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

  evaluateBooleanExpression(left, right, operator, scope = '') {
    const predicates = this.component.getBooleanOperators()[operator];

    if (!predicates) {
      this.component.throwError(`Unknown boolean operator: ${operator}`);
    }
    for (const fn of predicates) {
      const b = Function(
        `${scope} return arguments[0](${left}, ${right})`,
      )
        .bind(this.component)(fn);

      if (!b) { return false; }
    }

    return true;
  }

  executeWithBlockData(fn, blockData) {

    const blockDataSnapshot = this.component.blockData;

    if (blockData) {
      this.component.blockData = blockData;
    }

    const html = fn();

    if (blockData) {
      this.component.blockData = blockDataSnapshot;
    }

    return html;
  }

  getLogicGates() {
    return this.#logicGates;
  }

  getLogicGateValue({ gate, useBlockData = true }) {

    const { table } = this.component.getLogicGates()[gate.canonicalId];

    const MUST_GRP = 'MustacheGroup';
    const LOGIC_GATE = 'LogicGate';
    const BOOL_EXPR = 'BooleanExpression';
    const PATH_EXPR = 'PathExpression';
    const STR_LITERAL = 'StringLiteral';
    const BOOL_LITERAL = 'BooleanLiteral';
    const NUM_LITERAL = 'NumberLiteral';
    const NULL_LITERAL = 'NullLiteral';
    const UNDEFINED_LITERAL = 'UndefinedLiteral';

    const AND = 'AND';
    const OR = 'OR';

    const evaluateExpr = (expr) => {
      return this.component.evaluateExpression(expr);
    }

    const getConditionExpr = (parts, invert) => {

      let scope = ``;
      const and = ' && ';
      const or = ' || ';

      const getBoolExpr = (expr) => {

        const left = getExpr(expr.left);
        const right = getExpr(expr.right);

        return this.evaluateBooleanExpression(
          left, right, expr.operator, scope
        );
      }

      const getExpr = (part) => {
        let variableName = global.clientUtils.randomString();

        switch (part.type) {
          case PATH_EXPR:
          case BOOL_LITERAL:
          case NUM_LITERAL:
          case NULL_LITERAL:
          case UNDEFINED_LITERAL:
            scope += `const ${variableName} = ${part.original};\n`;
            return variableName;

          case BOOL_EXPR:
            return `(${getBoolExpr(part)})`;

          case STR_LITERAL:
            switch (part.original) {
              case AND:
                return and;
              case OR:
                return or;
              default:
                scope += `const ${variableName} = \`${part.original}\`;\n`;
                return variableName;
            }

          case MUST_GRP:
            scope += `const ${variableName} = ${getValue(part)};\n`;
            return variableName;

          case LOGIC_GATE:
            return `${JSON.stringify(analyzeGate(part))}`;
        }
      }

      const expr = `return ${parts
        .map(getExpr)
        .map(part => (part != and && part != or) ? `!!${part}` : part)
        .map((part, index) => `${invert[index] ? '!' : ''}${part}`)
        .join('')};`;

      return scope + expr;
    };

    const analyzeCondition = (parts, invert) => {
      const expr = getConditionExpr(parts, invert);
      const b = evaluateExpr(expr);
      assert(typeof b === 'boolean');
      return b;
    }

    const getValue = ({ type, original, items, evaluate = true }) => {
      let expr;
      switch (type) {
        case NUM_LITERAL:
        case BOOL_LITERAL:
        case PATH_EXPR:
        case NULL_LITERAL:
        case UNDEFINED_LITERAL:
          expr = original;
          break;
        case STR_LITERAL:
          expr = `\`${original.replace(/"/g, '\\"')}\``;
          break;
        case MUST_GRP:
          expr = items.map(item => getValue({
            type: item.type,
            original: item.original,
            evaluate: false
          })).join(' + ');
          break;
      }
      return evaluate ? evaluateExpr(`return ${expr}`) : expr;
    };

    const analyzeGate = (item) => {

      assert(item.type == LOGIC_GATE)

      const data = clientUtils.deepClone(table[item.original]);

      const { condition, left, right, invert } = data;

      data.condition = condition.map(c => this.toExecutablePath(c, true));

      data.left = this.toExecutablePath(left);
      data.right = this.toExecutablePath(right);

      item = analyzeCondition(data.condition, data.conditionInversions) ? data.left : data.right;

      let value = (() => {
        if (item.type == LOGIC_GATE) {
          return analyzeGate(item);
        } else {
          return getValue(item);
        }
      })()

      if (invert) {
        value = !value;
      }

      return value;
    }

    const blockData = useBlockData ? gate.blockData : null;

    const value = this.executeWithBlockData(
      () => {
        return analyzeGate({ type: LOGIC_GATE, original: 0 })
      },
      blockData
    );

    const { hook, currentValue, initial = true } = gate;

    if (hook && (initial || (currentValue !== value))) {
      this.component[hook].bind(this.component)(value);

      gate.currentValue = value;
      gate.initial = false;
    }

    return value;
  }

  /**
   * If this is a PathExpression, convert from a canonical path to
   * it's executable path
   */
  toExecutablePath(item, lenient, allowSynthetic = true) {
    const {
      dataPathPrefix, literalPrefix, syntheticMethodPrefix, parsePathExpressionLiteralValue,
    } = RootProxy;
    const { wrapExecStringForLeniency } = RootCtxRenderer;

    const MUST_GRP = 'MustacheGroup';
    const BOOL_EXPR = 'BooleanExpression';
    const PATH_EXPR = 'PathExpression';
    const STR_LITERAL = 'StringLiteral';
    const BOOL_LITERAL = 'BooleanLiteral';
    const NUM_LITERAL = 'NumberLiteral';
    const NULL_LITERAL = 'NullLiteral';
    const UNDEFINED_LITERAL = 'UndefinedLiteral';

    const lenientMarker = /\?$/g;

    const { type, original, operator, left, right, items } = item;

    const getExecPath = (fqPath) => {
      let execString = this.component.getExecPath0({
        fqPath,
        allowSynthetic,
      });

      if (lenient) {
        execString = wrapExecStringForLeniency(execString);
      }
      return execString;
    }

    switch (type) {
      case PATH_EXPR:

        assert(
          original.match(dataPathPrefix) ||
          original.startsWith(syntheticMethodPrefix)
        );

        let p = original.replace(dataPathPrefix, '');

        if (p.startsWith(literalPrefix)) {

          const val = this.component.evaluateExpression(
            `return ${parsePathExpressionLiteralValue(p)}`
          );

          const type = (() => {
            switch (typeof val) {
              case 'object':
                return NULL_LITERAL;
              case 'undefined':
                return UNDEFINED_LITERAL;
              case 'number':
                return NUM_LITERAL;
              case 'boolean':
                return BOOL_LITERAL;
              case 'string':
                return STR_LITERAL;
              default:
                throw Error(`Unknown value: ${val}`);
            }
          })();

          return {
            type,
            original: val,
          }
        } else {
          lenient = lenient || p.match(lenientMarker);
          if (lenient) {
            p = p.replace(lenientMarker, '');
          }
          return {
            type,
            canonicalPath: p,
            original: getExecPath(p),
          }
        }

      case BOOL_EXPR:
        return {
          type,
          operator,
          left: this.toExecutablePath(left, lenient),
          right: this.toExecutablePath(right, lenient),
        }

      case MUST_GRP:
        return {
          type,
          items: items.map(item => this.toExecutablePath(item, lenient)),
        }
    }

    return { ...item };
  }

  getParticipantsFromLogicGate(gate) {

    const { toBindPath } = RootCtxRenderer;

    const PATH_EXPR = 'PathExpression';

    return gate.participants
      .map((path) => {

        const { canonicalPath, original, type } = this.toExecutablePath(
          {
            type: PATH_EXPR,
            original: path,
          },
          false,
          false,
        );

        if (type.endsWith('Literal')) {
          return null;
        }

        // Since <allowSynthetic> is set to false above, we don't expect a synthetic method invocation
        assert(
          !this.component.isSyntheticMethodInvocation(original)
        );

        return {
          original: toBindPath(original),
          canonicalPath,
        }
      })
      .filter(e => !!e);
  }

  resolveLogicPath({ prop }) {

    const {
      logicGatePathRoot, pathSeparator, gateParticipantHookType,
    } = RootProxy;

    const includePath = prop.endsWith('!');

    if (includePath) {
      // eslint-disable-next-line no-param-reassign
      prop = prop.replace(/\!$/g, '');
    }

    const isRawReturn = prop.endsWith('!');

    if (isRawReturn) {
      // eslint-disable-next-line no-param-reassign
      prop = prop.replace(/\!$/g, '');
    }

    const gate = this.component.getLogicGates()[prop];

    const gateId = global.clientUtils.randomString();
    const path = `${logicGatePathRoot}${pathSeparator}${gateId}`;

    if (this.component.dataBindingEnabled()) {

      // Register hook for participants to <dataPathHooks>, if applicable

      this.getParticipantsFromLogicGate(gate)
        .filter(({ synthetic }) => !synthetic)
        .forEach(({ original, canonicalPath }) => {

          this.createHooksArray(original);

          this.getDataPathHooks()[original]
            .push({
              type: gateParticipantHookType,
              gateId,
              canonicalPath,
            });
        });

      this.createHooksArray(path);
    }

    const arrayBlock = this.component.getClosestArrayBlock();

    this.#logicGates[gateId] = {
      id: gateId,
      canonicalId: prop,
      blockData: this.component.getBlockDataSnapshot(path, arrayBlock),
      hook: gate.table[0].hook,
      arrayBlockPath: arrayBlock ? arrayBlock.path : null,
    };

    const v = this.getLogicGateValue({ gate: this.#logicGates[gateId], useBlockData: false });

    const rawValue = this.getRawValueWrapper(v);

    const value = this.getValue(v);

    if (includePath) {
      return {
        path,
        value: isRawReturn ? rawValue : value,
        canonicalPath: path,
      };
    } else {
      return isRawReturn ? rawValue : value;
    }
  }

  static parsePathExpressionLiteralValue(prop) {
    const { literalPrefix, emptyString } = RootProxy;
    const p = prop.replace(literalPrefix, emptyString);

    switch (true) {
      case p == 'null':
      case p == 'undefined':
      case p == 'true':
      case p == 'false':
      case clientUtils.isNumber(p):
        return p;
      default:
        return `"${p}"`;
    }
  }

  resolveDataPath({ prop, isRawReturn = false }) {

    const {
      literalPrefix, rawDataPrefix, globalsBasePath, pathSeparator, syntheticMethodPrefix, parsePathExpressionLiteralValue
    } = RootProxy;

    // eslint-disable-next-line no-undef
    assert(prop.constructor.name === 'String');

    if (prop.startsWith(literalPrefix)) {
      // eslint-disable-next-line no-eval
      return this.component.evaluateExpression(
        `return ${parsePathExpressionLiteralValue(prop)}`
      );
    }

    if (prop.startsWith(rawDataPrefix)) {
      // eslint-disable-next-line no-param-reassign
      prop = prop.replace(rawDataPrefix, '');
      isRawReturn = true;
    }

    const suffixMarker = /\!$/g;
    const lenientMarker = /\?$/g;

    // 1. Should include path?
    const includePath = prop.match(suffixMarker);

    if (includePath) {
      // eslint-disable-next-line no-param-reassign
      prop = prop.replace(suffixMarker, '');
    }

    // 2. Should return raw data?
    isRawReturn = isRawReturn || prop.match(suffixMarker);
    if (isRawReturn) {
      // eslint-disable-next-line no-param-reassign
      prop = prop.replace(suffixMarker, '');
    }
    assert(
      !prop.startsWith(`${globalsBasePath}${pathSeparator}`) || isRawReturn
    );

    // 3. Should enable lenient path resolution?
    const lenientResolution = prop.match(lenientMarker);
    if (lenientResolution) {
      // eslint-disable-next-line no-param-reassign
      prop = prop.replace(lenientMarker, '');
    }

    const isSynthetic = prop.startsWith(syntheticMethodPrefix);

    // eslint-disable-next-line no-case-declarations
    const v = this.component
      .getPathValue({ path: prop, includePath, lenientResolution });

    const rawValue = this.getRawValueWrapper(
      includePath ? v.value : v
    );

    if (!isSynthetic && rawValue === undefined) {

      if (includePath) {
        // This path is the target of either a mustache statement or a block statement

        this.createHooksArray(v.path);
      }
    }

    const value = this.getValue(includePath ? v.value : v);

    if (includePath) {
      v.value = isRawReturn ? rawValue : value;
      return v;
    } else {
      return isRawReturn ? rawValue : value;
    }
  }

  getHookFilter({ selector }) {
    // Note: HookType "gateParticipant" do not store a selector, and are usually 
    // pruned when the parent logic gate is being pruned
    return !selector ||
      document.querySelector(
        `#${this.component.getId()} ${selector}`
      )
  }

  /**
   * @param {Function} predicate Predicate function to determine which hooks are still valid
   */
  pruneHooks0(hookList, predicate) {

    const { logicGatePathPrefix } = RootProxy;

    Object.entries(hookList)
      .forEach(([k, v]) => {

        const isLogicGate = k.match(logicGatePathPrefix);

        // Logic gate paths are expected to have a single hook max due to
        // their dynamic nature, see resolveLogicPath(...)
        assert(!isLogicGate || v.length <= 1);

        const arr = v.filter(predicate);

        if (arr.length) {
          this.getDataPathHooks().set(k, arr);
        } else {
          delete this.getDataPathHooks()[k];

          if (isLogicGate) {
            const gateId = k.replace(logicGatePathPrefix, '');

            this.pruneLogicGate(gateId);
          }
        }
      })
  }

  pruneLogicGate(gateId) {
    const { arrayChildBlockHookType, logicGatePathRoot, pathSeparator } = RootProxy;
    const { arrayBlockPath } = this.#logicGates[gateId];

    // Remove arrayChildBlockHook if any exists
    if (arrayBlockPath) {
      const arr = this.getDataPathHooks()[arrayBlockPath];

      if (arr) {
        this.getDataPathHooks().set(
          arrayBlockPath,
          arr.filter(({ type, path }) => type != arrayChildBlockHookType || path != `${logicGatePathRoot}${pathSeparator}${gateId}`)
        );
      }
    }

    delete this.#logicGates[gateId];
  }

  // Todo: Investigate if we need to support disabling hooks for only one-more paths as opposed
  // to a component-wide approach
  suspendHooks() {
    this.#disableHooks = true;
  }

  resumeHooks() {
    this.#disableHooks = false;
  }

  removeHook(path, hook) {
    const arr = this.#dataPathHooks[path];

    if (arr && arr.includes(hook)) {
      const deletedArr = arr.splice(arr.indexOf(hook), 1);
      assert(deletedArr.length == 1 && deletedArr[0] == hook);
    }
  }

  async triggerHooks(triggerInfo) {

    if (this.#disableHooks || !this.component.isMounted()) {
      return;
    }

    const {
      logicGatePathRoot, pathSeparator, textNodeHookType, eachBlockHookType, gateParticipantHookType, logicGatePathPrefix,
      conditionalBlockHookType, dataPathPrefix, nodeAttributeHookType, nodeAttributeKeyHookType, nodeAttributeValueHookType,
      mapSizeProperty, isNullProperty, predicateHookType, mapKeyPrefixRegex, emptyString, isMapProperty, collChildSetHookType,
      toFqPath, collChildDetachHookType, arrayChildReorderHookType,
    } = RootProxy;

    const { fqPath, hookList, hookTypes, hookOptions, transitive = true } = triggerInfo;

    const fqPath0 = fqPath.replace(dataPathPrefix, '');

    this.onPathChange(fqPath0);

    const pathInfo = this.getPathInfo(fqPath0);

    const triggerComponentHooks = (phase) => {

      const { oldValue, newValue, parentObject } = pathInfo;

      const sPath = clientUtils.toCanonicalPath(fqPath0);

      const componentHooks = this.component.getHooks();

      const fnList = [...new Set([
        ...componentHooks[fqPath0] || [],
        ...componentHooks[`${phase}.${fqPath0}`] || [],
        ...componentHooks[sPath] || [],
        ...componentHooks[`${phase}.${sPath}`] || [],
      ])];

      let mount = true;

      const evt = {
        path: fqPath, oldValue, newValue, parentObject,
        preventDefault: () => {
          mount = false;
        }
      };

      fnList.forEach(fn => fn(evt));

      return mount;
    }

    const triggerHooks0 = async (path, value, hookTypes, changeListener, filteredSelectors, hookOptions) => {

      const path0 = path.replace(dataPathPrefix, '');

      const hooksFilter = (hook) => {
        const { selector } = hook;
        const b = !selector ||
          (!(filteredSelectors || []).includes(selector) && document.querySelector(`#${this.component.getId()} ${selector}`));

        if (!b) {
          const isLogicGate = path.match(logicGatePathPrefix);

          if (isLogicGate) {
            const gateId = path.replace(logicGatePathPrefix, '')

            delete this.getDataPathHooks()[path];

            this.pruneLogicGate(gateId);
          } else {
            this.removeHook(path, hook);
          }
        }

        return b;
      }

      const triggerNodeUpdateEvt0 = (selector) => {
        const { getWrapperCssClass } = BaseComponent;

        const node = document.querySelector(selector);
        this.component.triggerNodeUpdateEvent(node);
        node
          .querySelectorAll(`.${getWrapperCssClass()}`)
          .forEach(node => this.component.triggerNodeUpdateEvent(node));
      }

      const triggerNodeUpdateEvt = (selector) => {
        triggerNodeUpdateEvt0(
          `#${this.component.getId()} ${selector}`
        );
      }

      const renderBlock = (consumer, header, footer, markupPredicate, parentNode, transform) => {
        this.component.startTokenizationContext();

        const emitContext = this.component.getEmitContext();

        if (header) {
          emitContext.write(header);
        }

        markupPredicate();

        if (footer) {
          emitContext.write(footer);
        }

        const { htmlString } = this.component.finalizeTokenizationContext({ transform });

        let node;

        if (htmlString == '') {

          // createContextualFragment(...) does not handle empty strings well
          node = document.createTextNode(htmlString);

        } else {

          const range = document.createRange();
          range.selectNodeContents(parentNode);
          node = range.createContextualFragment(htmlString);

          if (!node || !node.childElementCount) {
            this.component.logger.error({
              parentNode,
              htmlString
            });
            throw Error('Unable to create contextual fragment');
          }
        }

        consumer(node);
      }

      const createCollChildNode = (consumer, key, id, markupPredicate, parentNode, transform) => {

        let currentWrapperNodeId = id || clientUtils.randomString();

        const header = this.component.getColElementWrapperHeader(currentWrapperNodeId, key);
        const footer = this.component.getColElementWrapperFooter();

        renderBlock(
          (node) => {
            currentWrapperNodeId = node.childNodes[0].id;
            consumer(node);
          },
          header, footer, markupPredicate, parentNode, transform,
        )

        return currentWrapperNodeId;
      }

      const parentPath0 = () => clientUtils.getParentFromPath(path0.split('.'))

      const collKey = () => {
        return clientUtils.getKeyFromIndexSegment(
          path0.replace(parentPath0(), '')
        )
          .replace(mapKeyPrefixRegex, emptyString);
      }

      await Promise.all((hookList[path] || [])
        .filter(hook => hooksFilter(hook))
        .map(hook => ({ ...hook, ...hookOptions ? hookOptions : {} }))
        .map(hook => {

          const selector = `#${this.component.getId()} ${hook.selector}`;

          const getRenderedValue = () => {
            let computedValue = value;

            if (path.startsWith(`${logicGatePathRoot}${pathSeparator}`)) {
              const gateId = path.replace(`${logicGatePathRoot}${pathSeparator}`, '')

              this.component.startSyntheticCacheContext();

              computedValue = this.getLogicGateValue({ gate: this.#logicGates[gateId] });

              this.component.pruneSyntheticCache();
            }

            const { transform } = hook;

            if (transform) {
              computedValue = this.component[transform](computedValue);
            }

            return this.component.toHtml(computedValue);
          }

          const getElementName = (node) => {
            return node.tagName.toLowerCase();
          }

          const getNodeAttribute = ({ node, attrKey }) => {
            const { getHtmlIntrinsicAttributes } = RootCtxRenderer;
            const elementName = getElementName(node);

            if (getHtmlIntrinsicAttributes(elementName)[attrKey]) {
              return node[attrKey];
            } else {
              return node.getAttribute(attrKey);
            }
          }

          const setNodeAttribute = ({ node, attrKey, attrValue }) => {
            const { getHtmlIntrinsicAttributes } = RootCtxRenderer;
            const elementName = node.tagName.toLowerCase();

            if (getHtmlIntrinsicAttributes(elementName)[attrKey]) {
              node[attrKey] = attrValue === undefined ? null : attrValue;
            } else {
              if (attrValue === undefined) {
                node.removeAttribute(attrKey);
              } else {
                try {
                  node.setAttribute(attrKey, attrValue);
                } catch (ex) {
                  assert(
                    ex.message == `Failed to execute 'setAttribute' on 'Element': '${attrValue}' is not a valid attribute name.`
                  );
                }
              }
            }
          }

          const evalAttrValue = (elementName, attrKey, attrValue, loc) => {

            const { unsafeEval } = AppContext;
            const { getHtmlIntrinsicAttributes } = RootCtxRenderer;
            const { getLine } = clientUtils;

            const UNKNOWN_VALUE = null;

            const isBoolAttr = (getHtmlIntrinsicAttributes(elementName)[attrKey] || {}).type == 'boolean';

            if (isBoolAttr) {
              return true;
            }

            if (attrValue) {
              try {
                attrValue = unsafeEval(attrValue);
              } catch (e) {
                this.component.logger.error(
                  `[${getLine({ loc })}] Error while attempting to evaluate attribute value (${attrValue}): ${e.message}`
                );
                attrValue = UNKNOWN_VALUE;
              }
            } else {
              attrValue = "";
            }

            return attrValue;
          }

          const getAttrSegments = (elementName, attrString, loc) => {
            let [key, value] = attrString.split('=');
            return { key, value: evalAttrValue(elementName, key, value, loc) }
          }

          if (hookTypes && !hookTypes.includes(hook.type)) {
            return;
          }

          switch (hook.type) {

            case nodeAttributeHookType:
              (() => {
                const { mustacheRef, loc } = hook;
                const node = document.querySelector(selector);
                const elementName = getElementName(node);

                const currentValue = getRenderedValue();
                const previousValue = this.component.setRenderedValue(mustacheRef, currentValue);

                if (previousValue) {
                  setNodeAttribute({
                    node,
                    attrKey: getAttrSegments(elementName, previousValue, loc).key,
                    attrValue: undefined
                  });
                }

                if (currentValue) {
                  const { key, value } = getAttrSegments(elementName, currentValue, loc);
                  setNodeAttribute({
                    node, attrKey: key, attrValue: value,
                  });
                }

                triggerNodeUpdateEvt0(selector);
              })();
              break;

            case nodeAttributeKeyHookType:
              (() => {
                const { mustacheRef, hookInfo: { tokenList, tokenIndex } } = hook;
                const node = document.querySelector(selector);

                const currentValue = getRenderedValue();
                const previousValue = this.component.setRenderedValue(mustacheRef, currentValue);

                if (getNodeAttribute(previousValue) != null) {
                  setNodeAttribute({
                    node, attrKey: previousValue, attrValue: undefined,
                  });
                }

                const attrKey = currentValue;

                if (attrKey) {
                  let valueToken = tokenList[tokenIndex + 2];

                  if (valueToken.type == 'token:attribute-value-wrapper-start') {
                    assert(tokenList[tokenIndex + 4].type == 'token:attribute-value-wrapper-end');

                    valueToken = { ...tokenList[tokenIndex + 3] };
                    valueToken.content = `"${valueToken.content}"`;
                  }

                  const attrValue = evalAttrValue(
                    getElementName(node),
                    attrKey,
                    this.component.getRenderedValue(valueToken.content)
                  );

                  setNodeAttribute({ node, attrKey, attrValue });
                }

                triggerNodeUpdateEvt0(selector);
              })();
              break;

            case nodeAttributeValueHookType:
              (() => {
                const { mustacheRef, hookInfo: { tokenList, tokenIndex } } = hook;
                const node = document.querySelector(selector);

                this.component.setRenderedValue(mustacheRef, getRenderedValue());

                const { keyToken, valueToken } = this.component.getValueTokenInfo(tokenList, tokenIndex);

                const observer = valueToken.observer ? this.component.lookupObject(valueToken.observer) : null;

                const attrKey = this.component.getRenderedValue(keyToken.content);

                const attrValue = evalAttrValue(
                  getElementName(node),
                  attrKey,
                  this.component.getRenderedValue(valueToken.content)
                );

                if (observer) {
                  observer.disconnect();
                }

                setNodeAttribute({ node, attrKey, attrValue });

                if (observer) {
                  observer.observe(
                    node,
                    { attributes: true, attributeOldValue: true, attributeFilter: [attrKey] }
                  );
                }

                triggerNodeUpdateEvt0(selector);
              })();
              break;

            case textNodeHookType:
              (() => {
                const node = document.querySelector(selector);
                node.innerHTML = getRenderedValue();

                const { hookMethod, blockData } = hook;

                if (hookMethod) {
                  this.component[hookMethod]({ node, blockData, initial: false });
                }

                triggerNodeUpdateEvt0(selector);
              })();
              break;

            case gateParticipantHookType:
              if (this.getLogicGates()[hook.gateId]) {
                triggerHooks0(
                  `${logicGatePathRoot}${pathSeparator}${hook.gateId}`,
                );
              } else {
                this.removeHook(path, hook);
              }
              break;

            case conditionalBlockHookType:
              return (async () => {
                let computedValue = value;

                if (path.startsWith(`${logicGatePathRoot}${pathSeparator}`)) {
                  const gateId = path.replace(`${logicGatePathRoot}${pathSeparator}`, '')
                  computedValue = this.getLogicGateValue({ gate: this.#logicGates[gateId] });
                }

                const fn = this.component.lookupObject(hook.fn);
                const inverse = hook.inverse ? this.component.lookupObject(hook.inverse) : null;

                const { invert, hookMethod, hookPhase, blockData, innerTransform, transient, loc } = hook;

                const b = this.component.analyzeConditionValue(computedValue);

                const parentNode = document.querySelector(selector);

                let branch = parentNode.getAttribute('branch');
                assert(branch);

                if (transient) {
                  branch = (branch == 'fn') ? 'inverse' : 'fn'
                }

                let htmlFn = null

                if (invert ? !b : b) {
                  if (branch != 'fn') {
                    branch = 'fn';
                    htmlFn = () => fn(this.handler);
                  }
                } else if (inverse) {
                  if (branch != 'inverse') {
                    branch = 'inverse';
                    htmlFn = () => inverse(this.handler);
                  }
                }

                if (!htmlFn) {
                  // There is no update to render
                  return;
                }

                const markupPredicate = () => this.executeWithBlockData(
                  htmlFn,
                  blockData,
                )

                this.component.startRenderingContext();

                renderBlock(
                  (node) => {
                    parentNode.innerHTML = '';
                    parentNode.appendChild(node)
                  },
                  null, null, markupPredicate, parentNode, innerTransform,
                )

                parentNode.setAttribute('branch', branch)

                triggerNodeUpdateEvt0(selector);

                const hookOptions = {
                  node: parentNode, blockData: clientUtils.deepClone(blockData), initial: false,
                };

                if (hookMethod) {
                  await this.component.triggerBlockHooks(hookMethod, hookPhase, 'onMount', loc, hookOptions);
                }

                this.component.finalizeRenderingContext();

                if (hookMethod) {
                  await this.component.awaitPendingTasks();
                  await this.component.triggerBlockHooks(hookMethod, hookPhase, 'afterMount', loc, hookOptions);
                }

              })();

            case eachBlockHookType:

              return (async () => {

                const fn = this.component.lookupObject(hook.fn);
                const inverse = hook.inverse ? this.component.lookupObject(hook.inverse) : null;

                const { hookMethod, hookPhase, canonicalPath, blockData, innerTransform, predicate, loc } = hook;

                const computedValue = value;

                const isArray = Array.isArray(computedValue);

                assert(isArray || computedValue[isMapProperty]);

                const len = computedValue ? isArray ? computedValue.length : computedValue[mapSizeProperty] : -1;

                const blockData0 = {
                  ...blockData,
                  [canonicalPath]: {
                    type: isArray ? 'array' : 'map', length: len,
                  }
                };

                const parentNode = document.querySelector(selector);

                const markerNode = (() => {

                  const keyChildNodes = parentNode.querySelectorAll(':scope > [key]');
                  const inverseChildNodes = parentNode.querySelectorAll(':scope > [inverse]');

                  const removeNodes0 = (arr) => {
                    arr.forEach((node, i) => {
                      if (i == 0) {
                        return;
                      }
                      node.remove();
                    });
                  }

                  if (keyChildNodes.length) {
                    assert(!inverseChildNodes.length);
                    removeNodes0(keyChildNodes);
                    return keyChildNodes[0];
                  } else {
                    removeNodes0(inverseChildNodes);
                    return inverseChildNodes[0];
                  }
                })();

                if (len >= 0) {

                  const hookList = [];

                  let keyMarkerNode;

                  const keys = Object.keys(computedValue);

                  this.component.startRenderingContext();

                  for (let i = 0; i < len; i++) {

                    blockData0[canonicalPath].index = i;

                    const currentWrapperNodeId = clientUtils.randomString();

                    const p = toFqPath({ isArray, isMap: !isArray, parent: path, prop: keys[i] });

                    if (predicate) {

                      this.executeWithBlockData(
                        () => {
                          this.getDataPathHooks()[p]
                            .push({
                              type: predicateHookType, selector: `#${currentWrapperNodeId}`,
                              fn, predicate, hookMethod, hookPhase, innerTransform, loc,
                              blockData: this.component.getBlockDataSnapshot(p),
                              canonicalPath: `${canonicalPath}_$`,
                            });
                        },
                        blockData0,
                      )
                    }

                    const key = this.component.getBlockData({ path: canonicalPath, dataVariable: '@key', blockDataProducer: () => blockData0 });

                    const childNodeSelector = `${selector} > [key='${key}']`;

                    const currentValue = computedValue[key];
                    const isNull = currentValue === null || currentValue[isNullProperty] || (predicate ? !this.component[predicate].bind(this.component)(currentValue) : false);

                    const markupPredicate =
                      () => isNull ?
                        // null collection members are always represented as an empty strings
                        '' :
                        this.executeWithBlockData(
                          () => {

                            // We need to decrement <index> by 1 because: inside <fn>, index will
                            // be incremented by 1 through a call to doBlockUpdate(...)
                            blockData0[canonicalPath].index--;

                            return fn(this.handler)
                          },
                          blockData0
                        )

                    const consumer = (node) => {
                      const n = node.childNodes[0];

                      if (i == 0) {
                        if (markerNode) {
                          markerNode.insertAdjacentElement("afterend", n);
                        } else {
                          parentNode.innerHTML = '';
                          parentNode.appendChild(n);
                        }
                      } else {
                        keyMarkerNode.insertAdjacentElement("afterend", n);
                      }

                      keyMarkerNode = n;
                    }

                    createCollChildNode(
                      consumer, key, currentWrapperNodeId, markupPredicate, parentNode, innerTransform
                    );

                    assert(blockData0[canonicalPath].index === i);

                    if (!isNull && isArray) {
                      this.component.backfillArrayChildBlocks(p, `#${currentWrapperNodeId}`);
                    }

                    triggerNodeUpdateEvt0(childNodeSelector);

                    if (hookMethod) {
                      hookList.push({
                        node: document.querySelector(childNodeSelector),
                        blockData: clientUtils.deepClone(blockData0)
                      });
                    }
                  }

                  if (hookMethod) {
                    await Promise.all(hookList.map(async ({ node, blockData }) => {
                      await this.component.triggerBlockHooks(hookMethod, hookPhase, 'onMount', loc, { node, blockData, initial: false });
                    }))
                  }

                  this.component.finalizeRenderingContext();

                  if (hookMethod) {
                    await this.component.awaitPendingTasks();

                    await Promise.all(hookList.map(async ({ node, blockData }) => {
                      await this.component.triggerBlockHooks(hookMethod, hookPhase, 'afterMount', loc, { node, blockData, initial: false });
                    }))
                  }

                } else if (inverse) {

                  const toElementList = (node) => {

                    const textNodeToElement = (n) => {
                      const span = document.createElement('span');
                      span.style.display = 'contents';
                      span.innerHTML = n.textContent;
                      return span;
                    }

                    const isTextNode = node instanceof Text;
                    const isFragment = node instanceof DocumentFragment;

                    assert(isTextNode || isFragment);

                    switch (true) {
                      case isTextNode:
                        return [
                          textNodeToElement(node)
                        ];
                      case isFragment:
                        return [...node.childNodes]
                          .map(n => {
                            if (n instanceof Text) {
                              n = textNodeToElement(n);
                            }
                            assert(n instanceof Element);
                            return n;
                          })
                    }
                  }

                  const markupPredicate = () => this.executeWithBlockData(
                    () => inverse(this.handler),
                    blockData0,
                  )

                  const consumer = (node) => {

                    const elemList = toElementList(node);

                    elemList.forEach(n => {
                      n.setAttribute('inverse', true);
                    });

                    if (markerNode) {
                      elemList
                        .reverse()
                        .forEach(n => {
                          markerNode.insertAdjacentElement("afterend", n);
                        });

                    } else {
                      parentNode.innerHTML = '';

                      elemList
                        .forEach(n => {
                          parentNode.appendChild(n);
                        });
                    }
                  }

                  renderBlock(
                    consumer, null, null, markupPredicate, parentNode, innerTransform,
                  )
                }

                if (markerNode) {
                  markerNode.remove();
                }

              })();

            // Below are special purpose hook types

            case predicateHookType:

              return (async () => {
                const computedValue = value;
                const { parentObject } = this.getPathInfo(path0);

                const fn = this.component.lookupObject(hook.fn);
                const canonicalPath = hook.canonicalPath.replace(/_\$$/g, '');

                const { blockData, predicate, hookMethod, hookPhase, innerTransform, loc } = hook;

                const childNode = document.querySelector(selector);
                const isArray = Array.isArray(parentObject);

                assert(isArray || parentObject[isMapProperty]);

                const b = this.component[predicate].bind(this.component)(computedValue);

                const isEmpty = !childNode.innerHTML || childNode.getAttribute(this.component.getEmptyNodeAttributeKey());

                if (b) {
                  if (!isEmpty) {
                    return;
                  }
                } else if (isEmpty) {
                  return;
                }

                if (changeListener) {
                  // Indicate that <selector> was updated as a result of this predicate hook
                  changeListener(hook.selector);
                }

                const key = collKey();

                assert(key == childNode.getAttribute('key'));

                const index = Object.keys(parentObject).indexOf(key);

                assert(index >= 0);

                const blockData0 = {
                  ...blockData,
                  [canonicalPath]: {
                    ...blockData[canonicalPath],
                    index,
                  }
                };

                const markupPredicate =
                  () => !b ?
                    '' :
                    this.executeWithBlockData(
                      () => {

                        // We need to decrement <index> by 1 because: inside <fn>, index will
                        // be incremented by 1 through a call to doBlockUpdate(...)
                        blockData0[canonicalPath].index--;

                        return fn(this.handler);
                      },
                      blockData0,
                    )

                this.component.startRenderingContext();

                createCollChildNode(
                  (node) => {
                    const n = node.childNodes[0];

                    childNode.insertAdjacentElement("afterend", n);
                    childNode.remove();

                    if (n.id != childNode.id) {
                      assert(innerTransform);

                      // The target nodeId have changed, hence we need to register a new predicate hook
                      // because the current one is now invalidated

                      this.executeWithBlockData(
                        () => {
                          this.getDataPathHooks()[path]
                            .push({
                              type: predicateHookType, selector: `#${n.id}`,
                              fn: hook.fn, predicate, hookMethod, hookPhase, innerTransform, loc,
                              blockData: this.component.getBlockDataSnapshot(path),
                              canonicalPath: hook.canonicalPath,
                            });
                        },
                        blockData0,
                      )
                    }
                  },
                  key, childNode.id, markupPredicate, childNode.parentElement, innerTransform
                );

                assert(blockData0[canonicalPath].index === index);

                if (b && isArray) {
                  this.component.backfillArrayChildBlocks(`${parentPath0()}[${index}]`, `#${childNode.id}`);
                }

                triggerNodeUpdateEvt0(selector);

                const hookOptions = {
                  node: childNode, blockData: clientUtils.deepClone(blockData0), initial: false,
                };

                if (hookMethod) {
                  await this.component.triggerBlockHooks(hookMethod, hookPhase, 'onMount', loc, hookOptions);
                }

                this.component.finalizeRenderingContext();

                if (hookMethod) {
                  await this.component.awaitPendingTasks();
                  await this.component.triggerBlockHooks(hookMethod, hookPhase, 'afterMount', loc, hookOptions);
                }

              })();

            case collChildDetachHookType:

              (() => {

                const { childKey } = hook;

                const childNodeSelector = `${selector} > [key='${childKey}']`;
                const childNode = document.querySelector(childNodeSelector)

                childNode.remove();

                this.component.triggerNodeDetachEvent(childNode);
              })();

              break;

            case arrayChildReorderHookType:

              (() => {

                const { offsetIndexes, newIndexes = [], shuffle } = hook;

                const parentNode = document.querySelector(selector);

                const offsetNodes = Object.keys(offsetIndexes)
                  .map(k => parentNode.querySelector(`:scope > [key='${k}']`));

                Object.values(offsetIndexes)
                  .forEach((v, i) => {
                    offsetNodes[i].setAttribute('key', `${v}`);
                  });

                newIndexes.forEach(i => {
                  triggerHooks0(
                    path, value, [collChildSetHookType], null, null, { childKey: `${i}` }
                  );
                });

                if (shuffle) {
                  assert(!newIndexes.length && offsetNodes.length == parentNode.childNodes.length);

                  const childNodes = Array.from(parentNode.childNodes);

                  childNodes.sort((a, b) => {
                    return parseInt(a.getAttribute('key')) - parseInt(b.getAttribute('key'));
                  });

                  childNodes.forEach((node) => {
                    parentNode.appendChild(node);
                  });
                }

              })();

              break;

            case collChildSetHookType:

              return (async () => {

                const fn = this.component.lookupObject(hook.fn);

                const { hookMethod, hookPhase, canonicalPath, blockData, innerTransform, predicate, childKey, loc } = hook;

                const { collectionType: type } = this.getCollectionDefinition(path0);

                assert(clientUtils.isNumber(childKey) || type == 'map');

                const parentNode = document.querySelector(selector);

                const childNodeSelector = `${selector} > [key='${childKey}']`;
                const childNode = document.querySelector(childNodeSelector)

                const { index, length } = clientUtils.getCollectionIndexAndLength(value, childKey);
                const childValue = value[childKey];

                assert(index >= 0 && index < length && childValue !== undefined);

                blockData[canonicalPath].length = length;

                const getFirstChildConsumer = () => {
                  return (node) => {
                    if (parentNode.childNodes.length) {
                      parentNode.childNodes[0].insertAdjacentElement("beforebegin", node.childNodes[0])
                    } else {
                      parentNode.appendChild(node);
                    }
                  };
                }

                const getSiblingAppendConsumer = (tailKey) => {
                  const tailSibling = parentNode.querySelector(`:scope > [key='${tailKey}']`);
                  return (node) => {
                    tailSibling.insertAdjacentElement("afterend", node.childNodes[0])
                  };
                }

                const getNodeConsumer = (index) => {
                  return index == 0 ?
                    getFirstChildConsumer() :
                    getSiblingAppendConsumer(
                      clientUtils.getCollectionKeys(value)[index - 1]
                    );
                }

                const doesChildExist = (key) => {
                  return !!parentNode.querySelector(`:scope > [key='${key}']`)
                }

                const backfillSparseElements = () => {
                  if (type == 'array' && index > 0) {

                    const len = parentNode.querySelectorAll(':scope > [key]').length;

                    for (let i = len; i < index; i++) {

                      assert(!doesChildExist(i));

                      createCollChildNode(
                        getNodeConsumer(i), `${i}`, null, () => '', parentNode, innerTransform
                      );

                      assert(doesChildExist(i));
                    }
                  }
                }

                const createAndAppendNode = (markupPredicate) => {

                  assert(!doesChildExist(childKey));

                  const elemId = createCollChildNode(
                    getNodeConsumer(index), childKey, null, markupPredicate, parentNode, innerTransform
                  );

                  assert(doesChildExist(childKey));

                  triggerNodeUpdateEvt(`#${elemId}`);

                  return elemId;
                }

                backfillSparseElements();

                const isNull = childValue === null || childValue[isNullProperty] || (predicate ? !this.component[predicate].bind(this.component)(childValue) : false);

                const blockData0 = {
                  ...blockData,
                  [canonicalPath]: {
                    ...blockData[canonicalPath],
                    type, index,
                  }
                };

                const markupPredicate =
                  () => isNull ?
                    // null collection members are always represented as an empty strings
                    '' :
                    this.executeWithBlockData(
                      () => {

                        // We need to decrement <index> by 1 because: inside <fn>, index will
                        // be incremented by 1 through a call to doBlockUpdate(...)
                        blockData0[canonicalPath].index--;

                        return fn(this.handler);
                      },
                      blockData0,
                    );

                let elementNodeId;

                this.component.startRenderingContext();

                const addPredicate = !!predicate;

                if (childNode) {

                  createCollChildNode(
                    (node) => {
                      const n = node.childNodes[0];

                      childNode.insertAdjacentElement("afterend", n);
                      childNode.remove();

                      if (n.id == childNode.id) {
                        addPredicate = false;
                      }

                      elementNodeId = n.id;
                    },
                    childKey, childNode.id, markupPredicate, parentNode, innerTransform
                  );

                  triggerNodeUpdateEvt(`#${elementNodeId}`);
                } else {
                  elementNodeId = createAndAppendNode(markupPredicate);
                }

                if (addPredicate) {
                  this.executeWithBlockData(
                    () => {
                      this.getDataPathHooks()[path]
                        .push({
                          type: predicateHookType, selector: `#${elementNodeId}`,
                          fn: hook.fn, predicate, hookMethod, hookPhase, innerTransform, loc,
                          blockData: this.component.getBlockDataSnapshot(path),
                          canonicalPath: `${canonicalPath}_$`,
                        });
                    },
                    blockData0,
                  )
                }

                assert(blockData0[canonicalPath].index === index);

                if (!isNull && type == 'array') {
                  this.component.backfillArrayChildBlocks(`${path0}[${index}]`, `#${elementNodeId}`);
                }

                triggerNodeUpdateEvt0(childNodeSelector);

                const hookOptions = {
                  node: document.querySelector(childNodeSelector), blockData: clientUtils.deepClone(blockData0), initial: false,
                };

                if (hookMethod) {
                  await this.component.triggerBlockHooks(hookMethod, hookPhase, 'onMount', loc, hookOptions);
                }

                this.component.finalizeRenderingContext();

                if (hookMethod) {
                  await this.component.awaitPendingTasks();
                  await this.component.triggerBlockHooks(hookMethod, hookPhase, 'afterMount', loc, hookOptions);
                }

              })();
          }
        })
        .filter(h => h));

    }

    const mount = triggerComponentHooks('beforeMount');

    if (mount) {

      const mainHookTypes = hookTypes ? hookTypes : [
        nodeAttributeHookType, nodeAttributeKeyHookType, nodeAttributeValueHookType,
        textNodeHookType, gateParticipantHookType, conditionalBlockHookType, eachBlockHookType
      ];

      const filteredSelectors = [];

      if (transitive) {
        const transitiveHookTypes = [
          predicateHookType,
        ]

        clientUtils.getParentPaths(fqPath)
          .forEach((p) => {
            const { value } = this.getInfoFromPath(
              p.replace(dataPathPrefix, emptyString)
            );

            triggerHooks0(p, value, transitiveHookTypes, (selector) => {
              filteredSelectors.push(selector);
            });
          })
      }

      triggerHooks0(fqPath, pathInfo.newValue, mainHookTypes, null, filteredSelectors, hookOptions)
        .then(() => {
          triggerComponentHooks('afterMount');
        });
    }
  }

  /**
   * The general contract when calling this method is that the HTML node
   * representing the path: <parent[key]> will be detached from the DOM shortly
   * 
   * This function prunes hooks from the dynamic index <i> of the array <parent>
   */
  pruneCollChild({ parent, key, pruneLogicGates }) {
    const {
      dataPathRoot, pathSeparator, arrayChildBlockHookType, logicGatePathRoot, toFqPath,
    } = RootProxy;

    const isArray = clientUtils.isNumber(key);

    const fqParent = `${dataPathRoot}${pathSeparator}${parent}`;

    const fqPath = toFqPath({ isArray, isMap: !isArray, parent: fqParent, prop: key });

    const { hookList } = this.getHookList(fqPath, 'gte', false, false, this.#dataPathHooks);

    if (pruneLogicGates) {
      Object.entries(hookList)
        .forEach(([k, v]) => {
          v.forEach(({ type, path }) => {
            if (type == arrayChildBlockHookType && path.startsWith(logicGatePathRoot)) {
              const v = this.#dataPathHooks[path];
              assert(v);
              hookList[path] = v;
            }
          })
        });
    }

    this.pruneHooks0(
      hookList,
      ({ canonicalPath }) =>
        // Prune all logic gates added above
        !canonicalPath.startsWith(logicGatePathRoot) &&
        !clientUtils.isCanonicalArrayIndex(canonicalPath, parent)
    )
  }

  updateCollChild({ parent, key, info, dataPathHooks }) {
    const {
      dataPathRoot, pathSeparator, arrayChildBlockHookType, logicGatePathPrefix, dataPathPrefix, pathProperty, toFqPath, setObjectPath,
    } = RootProxy;

    const isArray = clientUtils.isNumber(key);

    const fqParent = `${dataPathRoot}${pathSeparator}${parent}`;

    const fqPath = toFqPath({ isArray, isMap: !isArray, parent: fqParent, prop: key });
    const newFqPath = (isArray && (info.index != undefined)) ? toFqPath({ isArray, parent: fqParent, prop: `${info.index}` }) : null;

    const { hookList } = this.getHookList(fqPath, 'gte', false, false, dataPathHooks);

    Object.entries(hookList)
      .forEach(([k, v]) => {

        const arr = v
          .filter((e) => this.getHookFilter(e))
          .filter(({ canonicalPath }) => clientUtils.isCanonicalArrayIndex(canonicalPath, parent));


        // Update @path, if applicable

        if (newFqPath) {

          const p = k.replace(dataPathPrefix, '');

          const { value: obj } = this.getInfoFromPath(p);

          if (obj && ['Object', 'Array'].includes(obj.constructor.name)) {

            assert(obj[pathProperty] == p);

            setObjectPath({
              obj,
              path: k.replace(fqPath, newFqPath).replace(dataPathPrefix, ''),
            });
          }
        }

        // Update associated blockData

        arr
          .forEach((hook) => {
            const { type, path, blockDataKey } = hook;

            if (type == arrayChildBlockHookType) {
              // Update associated blockData

              const blockDataList = (() => {
                if (path.match(logicGatePathPrefix)) {

                  const gateId = path.replace(logicGatePathPrefix, '');
                  const gateInfo = this.#logicGates[gateId];

                  const { blockData, arrayBlockPath } = gateInfo;

                  assert(arrayBlockPath == k);

                  if (newFqPath) {
                    gateInfo.arrayBlockPath = gateInfo.arrayBlockPath.replace(
                      fqPath, newFqPath,
                    );
                  }

                  return [blockData]
                } else {
                  assert(path.startsWith(fqPath));

                  if (newFqPath) {
                    hook.path = path.replace(fqPath, newFqPath);
                  }

                  return dataPathHooks[path]
                    .filter(({ blockData }) => blockData && Object.keys(blockData).includes(blockDataKey))
                    .map(({ blockData }) => blockData);
                }
              })()

              blockDataList.forEach((blockData) => {
                const o = blockData[blockDataKey];
                assert(o);

                if (info.index != undefined) {
                  o.index = info.index;
                }

                if (info.length != undefined) {
                  o.length = info.length;
                }
              });
            }
          });

        // Update key in <dataPathHooks>, if applicable

        if (newFqPath) {
          const p = k.replace(fqPath, newFqPath);

          if (this.#dataPathHooks[p]) {
            arr.forEach(e => {
              this.#dataPathHooks[p].push(e);
            });
          } else {
            this.createHooksArray(p, [...arr]);
          }
        }
      });
  }

  addToChangeSet(changeSet, p, filter = 'gte', opts) {
    const { dataPathRoot, pathSeparator } = RootProxy;
    changeSet.push({
      path: `${dataPathRoot}${pathSeparator}${p}`, filter, opts,
    });
  }

  simpleSetMutationHandler(changeSet, obj, prop, newValue) {

    const {
      dataPathRoot, pathSeparator, pathProperty, typeProperty, mapType, isMapProperty, mapKeyPrefix,
      isNullProperty, lastProperty, collChildSetHookType, collChildDetachHookType, arrayChildReorderHookType,
      getMapWrapper, toFqPath, getDataVariables, addDataVariablesToObject,
    } = RootProxy;

    const parent = obj[pathProperty];

    if (obj[isNullProperty]) {
      return this.tryOrLogError(
        () => { throw TypeError(`[${parent}] Cannot set properties of null (setting '${prop}')`) }
      )
    }

    const isArray = Array.isArray(obj);
    const isMap = !isArray && obj[isMapProperty];

    const isCollection = isArray || isMap;

    switch (true) {
      case isArray:

        switch (true) {
          case prop == 'length':
            assert(typeof newValue == 'number');
            if (newValue < obj.length) {
              for (let i = obj.length - 1; i >= newValue; i--) {
                this.simpleSetMutationHandler(changeSet, obj, i, undefined);
              }
            } else if (newValue > obj.length) {
              this.simpleSetMutationHandler(changeSet, obj, newValue - 1, null);
            }
            return true;

          case prop == -1:
            // Using -1 as array index should refer to the last index
            prop = obj.length - 1;
            break;

          case !global.clientUtils.isNumber(prop) && ![...getDataVariables(), pathProperty].includes(prop):
            return this.tryOrLogError(
              () => { throw Error(`Invalid index: ${prop} for array: ${obj[pathProperty]}`) }
            )
        }

        prop = Number(prop);
        break;

      case isMap:
        if (!prop || !prop.length || !['String', 'Number', 'Boolean'].includes(prop.constructor.name)) {
          this.component.logger.error(`Invalid key: ${prop} for map: ${obj[pathProperty]}`);
          return false;
        }
        if (!prop.startsWith(mapKeyPrefix)) {
          prop = `${mapKeyPrefix}${prop}`
        }

      default:
        if (!prop || !prop.length || prop.constructor.name !== 'String') {
          this.component.logger.error(`Invalid key: ${prop} for object: ${obj[pathProperty]}`);
          return false;
        }

        if (prop.startsWith('@')) {

          // Meta properties can only be modified in privilegedMode
          if (this.component.isInitialized() && !RootProxy.#isPriviledgedMode()) {
            this.component.logger.error(`Permission denied to modify ${prop}`);
            return false;
          }
          return obj[prop] = newValue;
        }

        break;
    }

    let oldValue = obj[prop];

    if (oldValue === undefined) {
      assert(
        isCollection,
        // In toCanonicalObject(...), we always default missing object properties to null,
        // so if oldValue === undefined it means that <prop> is invalid
        `${parent ? `[${parent}] ` : ''}Property "${prop}" does not exist`
      );
    }

    if (oldValue && oldValue[isNullProperty]) {
      oldValue = null;
    }

    if (oldValue === newValue) {
      // oldValue === newValue, returning
      return true;
    }

    const fqPath0 = toFqPath({ isArray, isMap, parent, prop });

    const fqPath = `${dataPathRoot}${pathSeparator}${fqPath0}`;


    if (!isCollection && !this.#dataPathHooks[fqPath]) {

      // Notice that we are doing this check, after we check if oldValue is a component, not before. This is because
      // if we do it before, this error will be thrown if <fqPath> resolved to a component (for components, we do not
      // add an entry to dataPathHooks), which will not provide a descriptive error

      this.component.logger.error(`Unknown path: ${fqPath}`);
      return false;
    }

    if (isCollection) {

      if (newValue === undefined) {
        this.addToChangeSet(
          changeSet,
          parent, 'eq',
          {
            hookTypes: [collChildDetachHookType],
            hookOptions: { childKey: `${prop}` }
          });

        if (isArray) {
          const offsetIndexes = {};

          for (let i = prop + 1; i < obj.length; i++) {
            offsetIndexes[i] = i - 1;
          }

          this.addToChangeSet(
            changeSet,
            parent, 'eq',
            {
              hookTypes: [arrayChildReorderHookType],
              hookOptions: { offsetIndexes }
            });
        }

      } else {
        this.addToChangeSet(
          changeSet,
          parent, 'eq',
          {
            hookTypes: [collChildSetHookType],
            hookOptions: { childKey: `${prop}` }
          });
      }
    }

    this.addToChangeSet(changeSet, fqPath0);

    const collDef = isCollection ? this.getCollectionDefinition(parent) : false;

    const collInfo = (() => {

      if (!collDef) return false;

      const o = {
        ...clientUtils.getCollectionIndexAndLength(obj, prop),
        type: collDef.collectionType,
        prop,
        keys: Object.keys(obj),
      };

      const { index, length, type } = o;

      if (index < 0) {

        // For deletes, for example: delete map["unknown_key"] or delete array[<negative_number>] respectively... 
        // both oldValue and newValue will be undefined, hence we will exit early, and not get to this point

        // For set, only accept a negative value if <obj> is a map
        assert(type != 'array', `You need to provide a non-negative array index`)
      }

      // If an existing element is removed
      o.elementRemoved = newValue === undefined;

      // If an element that is the last element is being removed
      o.removedLastElement = o.elementRemoved && index == length - 1;

      // If an element that is not the last element is being removed
      o.removedNonLastElement = o.elementRemoved && index < length - 1;

      // If an element is being added to this array in a position that will cause sparse elements 
      // to be created automatically
      o.addedElementWithSparseIndexes = oldValue === undefined && index > length && type == 'array';

      // If an element is being added that was not here before
      o.newElementAdded = type == 'map' ? index == -1 : index >= length;

      o.sparseIndexes = [];

      if (o.addedElementWithSparseIndexes) {
        for (let i = length; i < index; i++) {
          o.sparseIndexes.push(i);
        }
      }

      o.offset = o.elementRemoved ? -1 : 1 + o.sparseIndexes.length;

      const {
        removedNonLastElement, removedLastElement, addedElementWithSparseIndexes, newElementAdded, elementRemoved, sparseIndexes,
      } = o;

      if (newElementAdded || elementRemoved) {
        this.addToChangeSet(changeSet, toFqPath({ parent, prop: 'length' }));
      }

      if (newElementAdded && length > 0) {
        this.addToChangeSet(
          changeSet,
          toFqPath({
            parent: toFqPath({ parent, prop: length - 1 }),
            prop: lastProperty,
          }),
        );
      }

      if (removedLastElement && index > 0) {
        this.addToChangeSet(
          changeSet,
          toFqPath({
            parent: toFqPath({ parent, prop: index - 1 }),
            prop: lastProperty,
          }),
        );
      }

      if (removedNonLastElement) {
        // Add all indexes after the <index> to <changeSet>
        // Note: a changeSet has already been added above for <index> via fqPath0, 
        // hence start at <index + 1>

        for (let i = index + 1; i < length; i++) {
          this.addToChangeSet(
            changeSet,
            toFqPath({ parent, prop: i }),
          );
        }
      }

      for (let i of sparseIndexes) {
        // Add sparse index to <changeSet>
        this.addToChangeSet(
          changeSet,
          toFqPath({ parent, prop: i }),
        );
      }

      return o;
    })();


    const {
      newElementAdded, elementRemoved, removedNonLastElement, keys, index, length, offset, sparseIndexes, type,
    } = collInfo || {};


    if (collInfo) {

      // HOOK RE-BALANCING

      const newLength = length + offset;

      switch (true) {
        case newElementAdded:

          for (let i = 0; i < length; i++) {
            this.updateCollChild({
              parent, key: keys[i], info: { length: newLength }, dataPathHooks: this.getDataPathHooks(),
            });
          }
          break;

        case elementRemoved:

          for (let i = 0; i < index; i++) {
            this.updateCollChild({
              parent, key: keys[i], info: { length: newLength }, dataPathHooks: this.getDataPathHooks(),
            });
          }

          for (let i = index; i < length - 1; i++) {
            assert(removedNonLastElement);

            this.pruneCollChild({ parent, key: keys[i], pruneLogicGates: i == index });

            this.updateCollChild({
              parent, key: keys[i + 1], info: { index: i, length: newLength }, dataPathHooks: this.getDataPathHooks(),
            });
          }

          this.pruneCollChild({ parent, key: keys[length - 1] });
          break;
      }

    }



    // DO SET


    if (type == 'array') {
      for (let i of sparseIndexes) {
        // Add null to sparse indexes
        this.addNullCollectionMember(
          obj, i,
          collDef.$ref ? {
            first: i == 0,
            last: false,
            key: `${i}`,
            index: i,
          } : null
        );
      }
    }

    if (newValue != undefined) {

      if (typeof newValue == 'object') {

        if (collDef) {
          addDataVariablesToObject(
            newValue,
            this.getDataVariablesForSimpleSetOperation(collInfo),
          )
        }

        const b = this.tryOrLogError(
          () => this.#toCanonicalObject({
            path: fqPath0,
            obj: newValue
          })
        );

        if (!b) {
          return false;
        }

        if (newValue[typeProperty] == mapType) {
          newValue = getMapWrapper(newValue);
        }

        newValue = this.getObserverProxy(newValue);

      } else {

        const b = this.tryOrLogError(
          () => this.validateSchema(fqPath, newValue)
        );

        if (!b) {
          return false;
        }

        if (collDef) {
          this.addHookForScalarCollectionMember(fqPath0);
        } else {
          this.createHooksArray(fqPath);
        }
      }

      obj[prop] = newValue;

    } else {

      if (collDef) {

        switch (true) {

          case newValue === undefined:

            if (isArray) {
              obj.splice(prop, 1);
            } else {
              delete obj[prop];
            }

            if (collDef.$ref) {
              // We need to run in a privileged context because we are attempting to modify data variables
              // on objects that are already wrapped by the observer proxy
              RootProxy.#runPriviledged(() => {

                const keys = Object.keys(obj);

                for (let i = collInfo.index; i < (collInfo.length - 1); i++) {
                  const k = keys[i];
                  addDataVariablesToObject(
                    obj[k],
                    {
                      first: i == 0,
                      last: i == keys.length - 1,
                      key: k,
                      index: i,
                    }
                  )
                }
              });
            }
            break;

          case newValue === null:
            this.addNullCollectionMember(
              obj, prop,
              collDef.$ref ? this.getDataVariablesForSimpleSetOperation(collInfo) : null,
            );
            break;
        }

      } else {

        if (newValue === undefined) {
          // Object properties cannot have "undefined", change to null
          newValue = null;
        }

        this.createHooksArray(fqPath);

        obj[prop] = newValue;
      }
    }

    return true;
  }

  arraySpliceMutationHandler(changeSet, obj, index, delCount, ...replElements) {

    const {
      dataPathRoot, pathSeparator, pathProperty, typeProperty, isNullProperty, lastProperty, collChildDetachHookType, arrayChildReorderHookType,
      toFqPath,
    } = RootProxy;

    const { isNumber, peek } = clientUtils;

    const parent = obj[pathProperty];

    if (obj[isNullProperty]) {
      return this.tryOrLogError(
        () => { throw TypeError(`[${parent}] Cannot read properties of null (reading 'splice')`) }
      )
    }

    assert(Array.isArray(obj));

    if (typeof index == 'string' && isNumber(index)) {
      index = Number(index);
    }

    const knownIndex = typeof index == 'number' && obj[index] !== undefined;

    if (!knownIndex) {
      index = obj.length;
    }

    if (typeof delCount == 'string' && isNumber(delCount)) {
      delCount = Number(delCount);
    }

    if (knownIndex && (delCount == undefined)) {
      delCount = obj.length - index;
    }


    const delIndexes = [];

    if (typeof delCount == 'number' && delCount > 0) {
      for (let i = 0, ind = index; i < delCount && ind < obj.length; i++, ind++) {
        delIndexes.push(ind);
      }
    }


    const offset = replElements.length - delIndexes.length;
    const offsetIndexes = {};

    if (knownIndex) {

      // <tailIndex> is the first index that is offset
      const tailIndex = delIndexes.length ? peek(delIndexes) + 1 : index;

      if (offset != 0) {
        for (
          let i = tailIndex;
          i < obj.length;
          i++
        ) {
          offsetIndexes[i] = i + offset;
        }
      }
    }


    const newIndexes = [];

    for (let i = 0; i < replElements.length; i++) {
      newIndexes.push(index + i);
    }




    const length = obj.length;



    // REGISTER CHANGE SETS

    const changedPaths = [];

    if (offset != 0) {
      changedPaths.push(toFqPath({ parent, prop: 'length' }));
    }

    if (index == length) {
      changedPaths.push(
        toFqPath({
          parent: toFqPath({ parent, prop: length - 1 }),
          prop: lastProperty,
        })
      );
    }

    delIndexes.forEach(i => {

      this.addToChangeSet(
        changeSet,
        parent, 'eq',
        {
          hookTypes: [collChildDetachHookType],
          hookOptions: { childKey: `${i}` }
        });

      changedPaths.push(toFqPath({ parent, prop: i }));
    });

    this.addToChangeSet(
      changeSet,
      parent, 'eq',
      {
        hookTypes: [arrayChildReorderHookType],
        hookOptions: { offsetIndexes, newIndexes }
      });

    newIndexes.forEach(i => {
      changedPaths.push(toFqPath({ parent, prop: i }));
    });

    Object.entries(offsetIndexes)
      .forEach(([k, v]) => {
        changedPaths.push(toFqPath({ parent, prop: Number(k) }));
        changedPaths.push(toFqPath({ parent, prop: v }));
      });

    [...new Set(changedPaths)].forEach(p => {
      this.addToChangeSet(changeSet, p)
    })




    // HOOK RE-BALANCING

    const newLength = length + offset;

    for (let i = 0; i < length; i++) {

      switch (true) {
        case i < index:
          this.updateCollChild({
            parent, key: i, info: { length: newLength }, dataPathHooks: this.getDataPathHooks(),
          });
          break;

        case delIndexes.includes(i):
          this.pruneCollChild({ parent, key: i, pruneLogicGates: true });
          break;

        case offsetIndexes[i] !== undefined && offset < 0:

          if (!delIndexes.includes(offsetIndexes[i])) {
            this.pruneCollChild({ parent, key: offsetIndexes[i] });
          }

          this.updateCollChild({
            parent, key: i, info: { index: offsetIndexes[i], length: newLength }, dataPathHooks: this.getDataPathHooks(),
          });

          if (i >= newLength) {
            this.pruneCollChild({ parent, key: i });
          }

          break;
      }
    }

    if (offset > 0) {
      for (let i = length - 1; i >= 0; i--) {
        if (offsetIndexes[i] !== undefined) {

          this.updateCollChild({
            parent, key: i, info: { index: offsetIndexes[i], length: newLength }, dataPathHooks: this.getDataPathHooks(),
          });

          this.pruneCollChild({ parent, key: i });
        }
      }
    }



    // DO SET


    let hasError = false;

    replElements = replElements.map((newValue, i) => {

      if (hasError) {
        return;
      }

      const {
        mapType, addDataVariablesToObject, getMapWrapper,
      } = RootProxy;

      const setValue0 = (val) => {
        replElements[i] = newValue = val;
      }

      const idx = index + i;

      const fqPath0 = toFqPath({ parent, prop: idx });
      const fqPath = `${dataPathRoot}${pathSeparator}${fqPath0}`;

      if (newValue === undefined || (newValue && newValue[isNullProperty])) {
        setValue0(null)
      }

      const dataVariables = {
        first: idx == 0,
        last: (i == replElements.length - 1) && !Object.keys(offsetIndexes).length,
        key: `${idx}`,
        index: idx,
      };

      if (newValue != null) {

        if (newValue.constructor.name == 'Object') {

          const b = this.tryOrLogError(
            () => this.#toCanonicalObject({
              path: fqPath0,
              obj: newValue
            })
          );

          if (!b) {
            hasError = true;
            return;
          }

          addDataVariablesToObject(
            newValue, dataVariables,
          )

          if (newValue[typeProperty] == mapType) {
            newValue = getMapWrapper(newValue);
          }

          newValue = this.getObserverProxy(newValue);

        } else {

          const b = this.tryOrLogError(
            () => this.validateSchema(fqPath, newValue)
          );

          if (!b) {
            hasError = true;
            return;
          }

          this.addHookForScalarCollectionMember(fqPath0);
        }

      } else {

        this.addNullCollectionMember(
          obj, idx, dataVariables, (val) => newValue = val
        );
      }

      return newValue;
    });

    if (hasError) {
      return false;
    }

    const deletedElements = delIndexes.map(i => obj[i]);

    obj.splice(index, delIndexes.length, ...replElements);

    return deletedElements;
  }

  arrayReorderMutationHandler(changeSet, obj, offsetIndexes, fnName) {

    const {
      dataPathRoot, pathSeparator, pathProperty, isNullProperty, arrayChildReorderHookType, toFqPath,
    } = RootProxy;

    const parent = obj[pathProperty];

    if (obj[isNullProperty]) {
      return this.tryOrLogError(
        () => { throw TypeError(`[${parent}] Cannot read properties of null (reading '${fnName}')`) }
      )
    }

    assert(Array.isArray(obj));



    // REGISTER CHANGE SETS

    this.addToChangeSet(
      changeSet,
      parent, 'eq',
      {
        hookTypes: [arrayChildReorderHookType],
        hookOptions: { offsetIndexes, shuffle: true }
      });

    for (let i = 0; i < obj.length; i++) {
      this.addToChangeSet(changeSet, toFqPath({ parent, prop: i }));
    }


    // HOOK RE-BALANCING

    const dataPathHooks = {};

    for (let i = 0; i < obj.length; i++) {
      const fqPath = `${dataPathRoot}${pathSeparator}${toFqPath({ parent, prop: i })}`;

      const { hookList } = this.getHookList(fqPath, 'gte', false, false, this.getDataPathHooks());
      Object.assign(dataPathHooks, hookList);

      this.pruneCollChild({ parent, key: i });
    }

    Object.entries(offsetIndexes)
      .forEach(([k, v]) => {

        this.updateCollChild({
          parent, key: Number(k), info: { index: v }, dataPathHooks,
        });
      });
  }

  /**
   * The browser will discard our observer proxy if it ever throws a single error hence we must not throw any errors.
    So we need to route functions that can throw user-generated error through this function
   */
  tryOrLogError(fn) {
    try {
      fn();
      return true;
    } catch (e) {
      this.component.logger.error(`Uncaught ${e.constructor.name}: ${e.message}`);
      return false;
    }
  }

  addNullCollectionMember(obj, prop, dataVariables, consumer) {

    const {
      pathProperty, createNullObject, toFqPath, addDataVariablesToObject
    } = RootProxy;

    const parent = obj[pathProperty];

    const collDef = this.getCollectionDefinition(parent);
    assert(collDef);

    const p = toFqPath({ parent, prop });

    if (collDef.$ref) {
      const o = createNullObject();

      assert(dataVariables);
      addDataVariablesToObject(o, dataVariables);

      this.#toCanonicalObject({
        path: p,
        obj: o
      });

      const r = this.getObserverProxy(o);

      if (consumer) {
        consumer(r);
      } else {
        obj[prop] = r;
      }

    } else {

      if (consumer) {
        consumer(null);
      } else {
        obj[prop] = null;
      }

      this.addHookForScalarCollectionMember(p)
    }
  }

  getDataVariablesForSimpleSetOperation(collInfo) {
    const { mapKeyPrefixRegex, emptyString } = RootProxy;
    const { index, length, type, prop } = collInfo;

    const first = index == 0 || (index < 0 && length == 0)
    const last = index == length - 1 || type == 'map' ? index < 0 : index >= length;
    const key = type == 'array' ? `${prop}` : prop.replace(mapKeyPrefixRegex, emptyString);
    const i = type == 'array' ? index : length;

    return {
      first, last, key, index: i,
    }
  }

  static addDataVariablesToObject(o, { first, last, key, index }) {
    const { addDataVariables } = RootProxy;
    addDataVariables(
      o, first, last, key, index, clientUtils.randomString()
    );
  }

  getObserverProxy(object) {

    if (!this.component.dataBindingEnabled()) {
      return object;
    }

    return new Proxy(object, {

      deleteProperty: (obj, prop) => {
        if (prop.startsWith('@')) {

          // Meta properties can only be modified in privilegedMode
          if (this.component.isInitialized() && !RootProxy.#isPriviledgedMode()) {
            this.component.throwError(`Permission denied to modify ${prop}`);
          }
          delete obj[prop];
          return true;
        }
        return this.mutate((changeSet) => this.simpleSetMutationHandler(changeSet, obj, prop, undefined));
      },

      get: (obj, prop) => {

        if (Array.isArray(obj)) {
          switch (prop) {

            case 'splice':
              return (index, delCount, ...replElements) => {
                this.ensureCanMutate(obj);

                return this.mutate(
                  (changeSet) => this.arraySpliceMutationHandler(changeSet, obj, index, delCount, ...replElements)
                )
              };

            case 'unshift':
              return (...elements) => {
                this.ensureCanMutate(obj);

                this.mutate(
                  (changeSet) => this.arraySpliceMutationHandler(changeSet, obj, 0, 0, ...elements)
                )

                return obj.length;
              };

            case 'shift':
              return () => {
                this.ensureCanMutate(obj);

                const deletedElements = this.mutate(
                  (changeSet) => this.arraySpliceMutationHandler(changeSet, obj, 0, 1)
                )

                return deletedElements[0];
              };

            case 'reverse':
              return () => {
                this.ensureCanMutate(obj);

                const offsetIndexes = {};

                for (let i = 0; i < obj.length; i++) {
                  offsetIndexes[i] = obj.length - 1 - i;
                }

                obj.reverse();

                this.mutate(
                  (changeSet) => this.arrayReorderMutationHandler(changeSet, obj, offsetIndexes, 'reverse')
                )

                return obj;
              };

            case 'sort':
              return (sortFn) => {
                this.ensureCanMutate(obj);

                const arr = [...obj];

                obj.sort(sortFn);

                const offsetIndexes = {};

                for (let i = 0; i < arr.length; i++) {
                  offsetIndexes[i] = obj.indexOf(arr[i]);
                }

                this.mutate(
                  (changeSet) => this.arrayReorderMutationHandler(changeSet, obj, offsetIndexes, 'sort')
                )

                return obj;
              };

            default:
              return obj[prop];
          }
        }

        return obj[prop];
      },

      set: (obj, prop, newValue) => {
        this.ensureCanMutate(obj);

        return this.mutate((changeSet) => {
          this.simpleSetMutationHandler(changeSet, obj, prop, newValue)
          return true;
        });
      },
    });
  }

  ensureCanMutate(obj) {
    const { pathProperty } = RootProxy;

    if (!this.canMutate()) {
      this.component.throwError(`Unable to perform mutation on "${obj[pathProperty]}"`);
    }
  }

  getInfoFromPath(path, noOpValue) {
    const { isMapProperty, typeProperty, mapType, getDataVariables } = RootProxy;
    const { getDataVariableValue } = RootCtxRenderer;

    assert(path.length);

    const value = (p) =>
      this.component.resolver ? this.component.resolver.resolve({ path: p }) :
        this.getValueFromPath(p, noOpValue);

    const pathArray = path.split(/\./g);
    const dataVariable = pathArray[pathArray.length - 1];

    if (dataVariable.startsWith('@')) {
      assert(getDataVariables().includes(dataVariable));

      const arr = [...pathArray];
      arr.pop();

      const emptyRet = {
        parentObject: null,
        value: noOpValue,
      };

      const coll = value(
        clientUtils.getParentFromPath(arr)
      );

      if (!coll) {
        return emptyRet;
      } else {

        const isMap = coll[isMapProperty] || coll[typeProperty] == mapType || coll instanceof Map;
        const isArray = Array.isArray(coll);

        assert(isArray || isMap);

        const parent = arr.join('.');

        const collKeys = coll instanceof Map ? Array.from(coll.keys()) : Object.keys(coll);

        const key = (this.component.resolver && isMap) ?
          arr[arr.length - 1] :
          clientUtils.getKeyFromIndexSegment(
            clientUtils.tailSegment(parent)
          );

        const index = collKeys.indexOf(key);

        if (index < 0) {
          return emptyRet;
        }

        const parentObject = value(parent);

        const v = (() => {

          if (dataVariable == '@random') {
            return this.component.resolver ? value(path) : !this.isScalarValue(parentObject) ? parentObject[dataVariable] : this.#randomValues[parent];
          } else {
            return getDataVariableValue(
              dataVariable, index, collKeys,
            );
          }
        })();

        return { parentObject, value: v };
      }
    }

    return {
      parentObject: value(
        clientUtils.getParentFromPath(pathArray)
      ) || null,
      value: value(path),
    };
  }

  isScalarValue(o) {
    return o !== Object(o) || o instanceof BaseComponent;
  }

  canMutate() {
    return !this.processingDataUpdate;
  }

  getHookList(path, filter, addLogicGates, transitive, dataPathHooks) {
    const {
      gateParticipantHookType, logicGatePathRoot, pathSeparator, dataPathRoot, dataPathPrefix,
    } = RootProxy;

    const pathList = [];

    const hooksPaths = [];
    const hookList = {};

    const addPath = (path, addToPathList = true, visitParents = true) => {

      if (!hooksPaths.includes(path)) {
        hooksPaths.push(path);
      }

      if (addToPathList) {
        pathList.push(path);
      }

      if (addLogicGates) {
        // Add associated logic gates
        (dataPathHooks[path] || [])
          .filter(({ type }) => type == gateParticipantHookType)
          .forEach(({ gateId }) => {
            hooksPaths.push(`${logicGatePathRoot}${pathSeparator}${gateId}`)
          });
      }

      if (transitive && visitParents) {
        // We are visiting the parent paths so that we can populate <hookList> with hooks that will be
        // needed by triggerHooks(...) if <transitive> is true

        clientUtils.getParentPaths(path)
          .forEach(parent => {
            addPath(parent, false, false);
          });
      }
    }

    switch (filter) {
      case 'eq':
        addPath(path);
        break;
      case 'gte':
        addPath(path);
      case 'gt':
        this.#pathTree[path.replace(dataPathPrefix, '')]
          .forEach(p => {
            addPath(`${dataPathRoot}${pathSeparator}${p}`);
          });
        break;
    }

    hooksPaths.forEach(p => {
      hookList[p] = [...dataPathHooks[p] || []];
    });

    return { pathList, hookList };
  }

  mutate(fn) {

    const { getCanonicalSegments: segs } = clientUtils;

    assert(this.canMutate());

    this.processingDataUpdate = true;
    const changeSet = [];

    const ret = fn(changeSet);

    this.processingDataUpdate = false;

    const hookInfo = changeSet
      .map(({ path, filter, addLogicGates = true, transitive = true }) => this.getHookList(path, filter, addLogicGates, transitive, this.getDataPathHooks()));

    changeSet
      .forEach(({ opts }, i) => {
        const { pathList, hookList } = hookInfo[i];

        pathList
          .sort((x, y) => segs(x).length - segs(y).length)
          .forEach(path => {
            this.triggerHooks({
              fqPath: path,
              hookList,
              ...opts,
            })
          });
      });

    return ret;
  }

  static toDefinitionName(path) {
    const { dataPathRoot, pathSeparator, pathSchemaDefPrefix } = RootProxy;
    return `${pathSchemaDefPrefix}.${path.replace(`${dataPathRoot}${pathSeparator}`, '')}`;
  }

  getObjectDefiniton(path) {

    const { toDefinitionName } = RootProxy;

    const defPrefx = '#/definitions/';
    const schemaDefinitions = this.getSchemaDefinitions();

    const k = path.length ?
      toDefinitionName(clientUtils.toCanonicalPath(path)) :
      this.component.getComponentName();

    let def = schemaDefinitions[k];

    if (def.$ref) {
      def = schemaDefinitions[def.$ref.replace(defPrefx, '')];
    }

    if (def.$ref) {
      def = schemaDefinitions[def.$ref.replace(defPrefx, '')];
    }

    return (def.type == 'object' || def.type.includes('object')) &&
      !def.additionalProperties ? def : null;
  }

  getMapDefinition(path) {
    if (!path.length) return false;

    const { getSchemaKey } = RootProxy;

    const { additionalProperties } = this.getSchemaDefinitions()[
      getSchemaKey(path)
    ];

    return additionalProperties ? {
      collectionType: 'map',
      ...additionalProperties,
    } : false;
  }

  isScalarArray(path) {
    const def = this.getArrayDefinition(path);

    return def && (
      ['string', 'number', 'boolean'].includes(def.type[0] || def.component
      ));
  }

  getArrayDefinition(path) {
    if (!path.length) return false;
    const { getSchemaKey } = RootProxy;

    const { items } = this.getSchemaDefinitions()[
      getSchemaKey(path)
    ];

    return items ? {
      collectionType: 'array',
      ...items,
    } : false
  }

  static getSchemaKey(path) {
    const { toDefinitionName } = RootProxy;

    const canonicalPath = global.clientUtils.toCanonicalPath(path);
    return toDefinitionName(canonicalPath);
  }

  getCollectionDefinition(path) {
    return this.getMapDefinition(path) || this.getArrayDefinition(path);
  }

  static getDataVariables() {
    const {
      firstProperty, lastProperty, keyProperty, indexProperty, randomProperty,
    } = RootProxy;
    return [firstProperty, lastProperty, keyProperty, indexProperty, randomProperty];
  }

  static addDataVariables(obj, first, last, key, index, random) {
    const {
      firstProperty, lastProperty, keyProperty, indexProperty, randomProperty,
    } = RootProxy;

    Object.defineProperty(obj, firstProperty, { value: first, enumerable: false, configurable: true, });
    Object.defineProperty(obj, lastProperty, { value: last, enumerable: false, configurable: true, });
    Object.defineProperty(obj, keyProperty, { value: key, enumerable: false, configurable: true, });
    Object.defineProperty(obj, indexProperty, { value: index, enumerable: false, configurable: true, });
    Object.defineProperty(obj, randomProperty, { value: random, enumerable: false, configurable: true, });

    return [
      firstProperty, lastProperty, keyProperty, indexProperty, randomProperty,
    ];
  }

  /**
   * This constructs a key that can be used to make a call to {dataPathHooks}
   * @returns String
   */
  static toFqPath({ isArray, isMap, parent, prop }) {

    switch (true) {
      case Number.isInteger(prop):
        isArray = true;
        break;

      case prop.startsWith('@'):
        isArray = isMap = false;
        break;
    }

    return `${parent}${isArray ? `[${prop}]` : isMap ? `["${prop}"]` : `${parent.length ? '.' : ''}${prop}`}`;
  }

  registerHookSelector(path, { selector, opaque }) {
    // Note: an opaque hook means that the path where it's registered does not exclusively own the selector. An
    // example of opaque hooks are the attribute related hooks, because there may be multiple attribute-based
    // hooks for the same selector

    const { nodeList } = this.component.getEmitContext();

    if (selector && !opaque) {
      assert(!nodeList[selector] || nodeList[selector] == path);

      nodeList[selector] = path;
    }
  }

  addToPathTree(path) {
    const { globalsPathPrefix } = RootProxy;

    if (!path || path.match(globalsPathPrefix) || this.#dataPathKeys.includes(path)) {
      return;
    }

    const subPaths = [];

    this.#dataPathKeys.forEach(k => {

      if (k.startsWith(path)) {
        subPaths.push(k);
      }

      if (path.startsWith(k)) {
        this.#pathTree[k].push(path);
      }
    });

    this.#pathTree[path] = [...new Set(subPaths)];
    this.#dataPathKeys.push(path);
  }

  createHooksArray(path, initial = []) {
    const { isHookProperty, dataPathPrefix } = RootProxy;

    const arr = new Proxy(initial, {
      get: (object, key) => {
        switch (true) {
          case key == isHookProperty:
            return true;
          default:
            return object[key];
        }
      },
      set: (object, key, value) => {

        if (clientUtils.isNumber(key)) {
          assert((typeof value == 'object'));

          if (this.component.hasEmitContext()) {

            this.registerHookSelector(path, value);
            value.__time = new Date();

          } else {
            assert(value.__time);
          }
        }

        object[key] = value;

        return true;
      }
    });

    if (path.match(dataPathPrefix)) {
      this.addToPathTree(
        path.replace(dataPathPrefix, '')
      );
    }

    this.#dataPathHooks[path] = arr;
  }

  static createNullObject() {
    const { isNullProperty } = RootProxy;

    const o = {};
    Object.defineProperty(o, isNullProperty, { value: true, configurable: false, writable: false, enumerable: false });

    return o;
  }

  addHookForScalarCollectionMember(prop) {
    const { dataPathRoot, pathSeparator, getDataVariables, toFqPath } = RootProxy;

    const k = `${dataPathRoot}${pathSeparator}${prop}`;

    // Add hook keys for data variables
    getDataVariables().forEach((o) => {
      this.createHooksArray(toFqPath({ parent: k, prop: o }));
    })

    this.createHooksArray(k);
  }

  validateSchema(path, value) {

    if (value === null) {
      return;
    }

    const { toDefinitionName } = RootProxy;

    const schemaDefinitions = this.getSchemaDefinitions();
    const k = toDefinitionName(clientUtils.toCanonicalPath(path))

    const {
      $ref, type, additionalProperties, items, component, enum: enum0
    } = schemaDefinitions[k];

    const ensureType = (constructorName) => {
      if (value.constructor.name != constructorName) {
        this.component.throwError(
          `ValidationError - Expected "${path}" to be of type "${constructorName}" instead of "${value.constructor.name}"`
        );
      }
    }

    const ensureObject = () => {
      ensureType('Object');
    }

    const ensureComponent = (className) => {
      const componentClass = components[className];

      assert(componentClass || className == 'BaseComponent');

      if (!(value instanceof (componentClass || BaseComponent))) {
        this.component.throwError(
          `ValidationError - Expected ${path} to be an instance of "${className}" component`
        );
      }
    }

    const ensureArray = () => {
      ensureType('Array');
    }

    const ensureMap = () => {
      ensureType('Object');
    }

    const ensureString = () => {
      ensureType('String');
    }

    const ensureNumber = () => {
      ensureType('Number');
    }

    const ensureBoolean = () => {
      ensureType('Boolean');
    }

    const ensureEnum = (allowed) => {
      ensureType('String');

      if (!allowed.includes(value)) {
        this.component.throwError(
          `ValidationError - Expected ${path} to have one of it's enum values instead of "${value}"`
        );
      }
    }

    switch (true) {
      case !!additionalProperties:
        ensureMap();
        break;
      case !!items:
        ensureArray()
        break;
      case !!component:
        ensureComponent(component.className);
        break;
      case !!enum0:
        ensureEnum(enum0);
        break;
      case !!$ref || type[0] == 'object':
        ensureObject();
        break;
      case type[0] == 'string':
        ensureString();
        break;
      case type[0] == 'number':
        ensureNumber();
        break;
      case type[0] == 'boolean':
        ensureBoolean();
        break;
      default:
        throw Error(`Unknown schema type "${type[0]}"`);
    }
  }

  invokeInitializers(path, obj) {
    const initializers = this.component.getInitializers();

    const sPath = clientUtils.toCanonicalPath(path);

    const fnList = [...new Set([
      ...initializers[path] || [],
      ...initializers[sPath] || [],
    ])];

    fnList.forEach(fn => fn(obj));
  }

  static setObjectPath({ obj, path }) {
    const { pathProperty } = RootProxy;
    Object.defineProperty(obj, pathProperty, { value: path, configurable: true, enumerable: false });
  }

  #toCanonicalObject({ path, obj, root = true }) {

    const {
      dataPathRoot, pathSeparator, dataPathPrefix, typeProperty, mapType, mapKeyPrefix, mapKeyPrefixRegex, getMapWrapper,
      addDataVariables, getReservedObjectKeys, toFqPath, getReservedMapKeys, createNullObject, getDataVariables, setObjectPath,
    } = RootProxy;

    if (root) {
      this.invokeInitializers(path, obj);
    }

    const reservedObjectKeys = getReservedObjectKeys();

    const isArray = Array.isArray(obj);

    if (!isArray) {
      Object.keys(obj).forEach(k => {
        if (reservedObjectKeys.includes(k)) {
          this.component.throwError(`[${path}] An object cannot contain the key: ${k}`);
        }
      })
    }

    assert(!path.match(dataPathPrefix));

    setObjectPath({ obj, path });

    this.createHooksArray(`${dataPathRoot}${pathSeparator}${path}`);

    switch (true) {

      case !!this.getMapDefinition(path):
        const reservedMapKeys = getReservedMapKeys();

        // If this is a map path, add set @type to Map, and trasform the keys
        // to start with the map key prefix: $_

        for (const k of Object.keys(obj).filter(k => !k.startsWith('@'))) {

          if (reservedMapKeys.includes(k)) {
            this.component.throwError(`[${path}] A map cannot contain the reserved key: ${k}`);
          }

          obj[`${mapKeyPrefix}${k}`] = obj[k];
          delete obj[k];
        }

        // Note: this meta property is only used temporarily and it will be pruned
        // later by getMapWrapper(...)
        Object.defineProperty(obj, typeProperty, { value: mapType, enumerable: false, configurable: true });

        break;

      case obj.constructor.name == 'Object':
        const def = this.getObjectDefiniton(path);

        const keys = Object.keys(obj);

        // Ensure that all keys are valid properties defined in the schema
        keys.forEach(k => {
          if (!def.required.includes(k)) {
            this.component.throwError(`Unknown property (parent=${path ? path : 'root'}): ${k}`);
          }
        });

        // Add missing properties
        def.required
          .filter(p => !p.startsWith('@') && !keys.includes(p))
          .forEach(p => {
            obj[p] = (() => {
              // Assign a default value based on the data type
              const { type } = def.properties[p];

              const defaultValue = this.component.getDefaultValues()[
                clientUtils.toCanonicalPath(toFqPath({ parent: path, prop: p }))
              ];

              if (defaultValue !== undefined) {
                return typeof defaultValue == 'function' ? defaultValue() : defaultValue;
              }

              if (!type || ['array', 'string', 'object'].includes(type[0])) {
                return null;
              }

              switch (type[0]) {
                case 'number':
                  return 0;
                case 'boolean':
                  return false;
                default:
                  this.component.throwError(`[${path}] Unknown type: ${type[0]} for propery "${p}"`);
              }
            })();
          });
        break;
    }

    const isMap = !isArray && obj[typeProperty] === mapType;

    const isCollection = isArray || isMap;

    const keys = Object.keys(obj);;

    if (isCollection) {
      this.createHooksArray(`${dataPathRoot}${pathSeparator}${path}.length`);
    }

    const iterateKeys = (() => {
      const r = [...keys];
      getDataVariables().forEach(v => {
        if (obj[v] !== undefined) {
          r.push(v);
        }
      });
      return r;
    })();

    for (let i = 0; i < iterateKeys.length; i++) {
      const prop = iterateKeys[i];

      assert(obj[prop] !== undefined);

      const p = toFqPath({ isArray, isMap, parent: path, prop });

      if (obj[prop] != null && typeof obj[prop] == 'object') {
        this.invokeInitializers(p, obj[prop]);
      }

      if (!prop.startsWith('@')) {
        this.validateSchema(p, obj[prop]);
      }

      if (isCollection) {

        if (obj[prop] === null && isCollection.$ref) {
          obj[prop] = createNullObject();
        }

        switch (true) {
          case prop.startsWith('@'):
            break;

          case this.isScalarValue(obj[prop]):
            this.addHookForScalarCollectionMember(p)
            break;

          default:
            assert(obj[prop] === Object(obj[prop]));

            // Inject data variables, if this is a collection of objects
            addDataVariables(
              obj[prop],
              i == 0,
              i == keys.length - 1,
              prop.replace(mapKeyPrefixRegex, ''),
              i,
              global.clientUtils.randomString()
            )
              .forEach(k => {
                this.createHooksArray(`${dataPathRoot}${pathSeparator}${toFqPath({ parent: p, prop: k })}`);
              })

            break;
        }
      }

      const isEmpty = obj[prop] === null;

      // eslint-disable-next-line default-case
      switch (true) {
        case !isEmpty && ['Object', 'Array'].includes(obj[prop].constructor.name):
          this.#toCanonicalObject({ path: p, obj: obj[prop], root: false });

          if (obj[prop][typeProperty] == mapType) {
            obj[prop] = getMapWrapper(obj[prop]);
          }

          obj[prop] = this.getObserverProxy(obj[prop]);

          break;

        default:

          // Note: If isCollection, entry would have been created
          this.createHooksArray(`${dataPathRoot}${pathSeparator}${p}`);
          break;
      }
    }

    return obj;
  }

  static getReservedObjectKeys() {
    const { isMapProperty, isNullProperty } = RootProxy;
    return [isMapProperty, isNullProperty];
  }

  static getReservedMapKeys() {
    const { mapSizeProperty, mapKeysProperty } = RootProxy;
    return [mapSizeProperty, mapKeysProperty];
  }

  static getMapWrapper(obj) {
    const {
      typeProperty, mapType, mapKeyPrefix, isMapProperty, mapSizeProperty, mapKeysProperty
    } = RootProxy;

    assert(obj[typeProperty] == mapType)

    // At this point, obj is already wrapped with our observer proxy, so
    // we need to run in a privileged context, before we delete this meta property
    RootProxy.#runPriviledged(() => {
      delete obj[typeProperty];
    })

    return new Proxy(obj, {
      get(obj, prop) {

        switch (true) {

          case !!Object.getPrototypeOf(obj)[prop]:
            return obj[prop];

          case prop === Symbol.toPrimitive:
            return () => obj.toString();

          case prop == isMapProperty:
            return true;

          case prop == mapSizeProperty:
            return Object.keys(obj).length;

          case prop == mapKeysProperty:
            return () => Reflect.ownKeys(obj)
              .filter(k => typeof k != 'symbol' && k.startsWith(mapKeyPrefix))
              .map(k => k.replace(mapKeyPrefix, ''));

          case typeof prop == 'symbol':
            return obj[prop];

          default:
            assert(typeof prop == 'string');

            // Props can start with "@" if <obj> is also a collection
            // child, and the user wants to access data variable(s)
            return obj[
              `${prop.startsWith('@') || prop.startsWith(mapKeyPrefix)
                ? '' : mapKeyPrefix}${prop}`
            ]
        }
      },
      set(obj, prop, newValue) {

        assert(!Object.getPrototypeOf(obj)[prop]);

        // Props can start with "@" if <obj> is also a collection
        // child, and the user wants to update data variable(s)
        obj[
          `${prop.startsWith('@') || prop.startsWith(mapKeyPrefix)
            ? '' : mapKeyPrefix}${prop}`
        ] = newValue;

        // Note: according to the JS spec, (see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy/set),
        // proxy.set() should return a boolean value, hence instead of returning <newValue> which
        // is the default behaviour, we will always return true

        return true;
      }
    })
  }

}

module.exports = RootProxy;
