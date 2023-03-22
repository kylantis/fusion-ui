/* eslint-disable no-case-declarations */

// Make all members (that are applicable) private
class RootProxy {
  // eslint-disable-next-line no-useless-escape
  static syntheticMethodPrefix = 's$_';

  static logicGatePathRoot = 'logic_gate';

  static dataPathRoot = 'data';

  static pathSeparator = '__';

  static dataPathPrefix = RegExp(`^${RootProxy.dataPathRoot}${RootProxy.pathSeparator}`);

  static logicGatePathPrefix = RegExp(`^${RootProxy.logicGatePathRoot}${RootProxy.pathSeparator}`);

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

  static globalsBasePath = 'globals';

  static isMapProperty = '$isMap';

  static isNullProperty = '$isNull';

  static mapSizeProperty = 'size';

  static mapKeysProperty = 'keys';

  static lenientExceptionMsgPattern = /^Cannot read properties of (undefined|null)/g;

  static enumsFile = 'dist/components/enums.json';

  #dataPathHooks;

  #logicGates;

  #htmlCache;

  #disableHooks;

  static #dataReferences = [];

  static #privilegedMode = false;

  static pathSchemaDefPrefix = '__pathSchema';

  constructor({ component }) {
    this.component = component;
    this.handler = this.createObjectProxy();

    this.#dataPathHooks = this.createDataPathHooksObject();
    this.#logicGates = {};
    this.#htmlCache = {};
  }

  createDataPathHooksObject() {

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

        if (key == 'set') {
          return (k, v) => {
            return (object[k] = v);
          }
        }
        return object[key];
      },
    })
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
      emptyString, enumsFile,
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
                          `Could not find eunm "${enumName}". Ensure that ${enumsFile} contains the latest changes`
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
        this.#dataPathHooks[[dataPathRoot, globalsBasePath, variable].join(pathSeparator)] = [];
      });

    if (false && !global.isServer) {
      const { hookCleanupInterval } = this.component.getConfig();

      // Setup task to cleanup dead hooks
      setInterval(
        () => {
          if (this.processingDataUpdate) {
            return;
          }

          this.pruneHooks();
        },
        hookCleanupInterval
      );
    }
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

  executeWithBlockData(fn, blockData, cacheKey) {

    let html = this.#htmlCache[cacheKey];

    if (html != undefined) {
      delete this.#htmlCache[cacheKey];
      return html;
    }

    const blockDataSnapshot = this.component.blockData;

    if (blockData) {
      this.component.blockData = blockData;
    }

    html = fn();

    if (blockData) {
      this.component.blockData = blockDataSnapshot;
    }

    return html;
  }

  getLogicGateAssociatedHooks(id, pathPrefix) {
    const result = [];
    Object
      .entries(this.#dataPathHooks)
      .filter(([k]) => k.match(pathPrefix))
      .forEach(([k, v]) => {
        v.forEach(({ type, gateId }) => {
          if (gateId == id) {
            result.push({ path: k, hookType: type });
          }
        })
      });
    return result;
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
      const { invert } = item;

      while (item.type == LOGIC_GATE) {
        const data = clientUtils.deepClone(table[item.original]);

        const { condition, left, right } = data;

        data.condition = condition.map(c => this.toExecutablePath(c, true));

        data.left = this.toExecutablePath(left);
        data.right = this.toExecutablePath(right);

        item = analyzeCondition(data.condition, data.conditionInversions) ? data.left : data.right;
      }

      let value = getValue(item);

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

    return value;
  }

  /**
   * If this is a PathExpression, convert from a canonical path to
   * it's executable path
   */
  toExecutablePath(item, lenient, allowSynthetic = true) {
    const {
      dataPathRoot, literalPrefix, pathSeparator, syntheticMethodPrefix, parsePathExpressionLiteralValue,
    } = RootProxy;
    const { wrapExecStringForLeniency } = RootCtxRenderer;

    const MUST_GRP = 'MustacheGroup';
    const PATH_EXPR = 'PathExpression';
    const BOOL_EXPR = 'BooleanExpression';

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
          original.startsWith(`${dataPathRoot}${pathSeparator}`) ||
          original.startsWith(syntheticMethodPrefix)
        );

        let p = original.replace(`${dataPathRoot}${pathSeparator}`, '');

        if (p.startsWith(literalPrefix)) {
          return {
            type: 'StringLiteral',
            original: parsePathExpressionLiteralValue(p),
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

        // Since <allowSynthetic> is set to false, we don't expect a synthetic path
        assert(
          !this.component.isSyntheticInvocation(original)
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
          let arr = this.#dataPathHooks[original];

          if (!arr) {
            // Todo: remove this block if createDataPathHooksObject(...) is updated to automatically
            // create an empty hooks array if path not added... because in that case <arr> will be always true
            arr = this.#dataPathHooks[original] = [];
          }

          arr.push({
            type: gateParticipantHookType,
            gateId,
            canonicalPath,
          });
        });

      this.#dataPathHooks[path] = [];
    }

    this.#logicGates[gateId] = {
      id: gateId,
      canonicalId: prop,
      blockData: this.component.getBlockDataSnapshot(path),
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
      literalPrefix, rawDataPrefix, globalsBasePath, pathSeparator, parsePathExpressionLiteralValue
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


    // eslint-disable-next-line no-case-declarations
    const v = this.component
      .getPathValue({ path: prop, includePath, lenientResolution });

    const rawValue = this.getRawValueWrapper(
      includePath ? v.value : v
    );

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

  pruneHooks() {
    this.pruneHooks0(
      Object.entries(this.#dataPathHooks),
      this.getHookFilter,
    )
  }

  /**
   * @param {Function} predicate Predicate function to determine which hooks are still valid
   */
  pruneHooks0(hookList, predicate) {

    const { logicGatePathPrefix, dataPathPrefix } = RootProxy;

    hookList.forEach(([k, v]) => {

      const isLogicGate = k.match(logicGatePathPrefix);

      // Logic gate paths are expected to have a single hook max due to
      // their dynamic nature, see resolveLogicPath(...)
      assert(!isLogicGate || v.length <= 1);

      const arr = v.filter(predicate);

      if (arr.length) {
        this.#dataPathHooks.set(k, arr);
      } else {
        delete this.#dataPathHooks[k];

        if (isLogicGate) {
          // We also need to detach associated hooks

          const gateId = k.replace(logicGatePathPrefix, '');

          this.getLogicGateAssociatedHooks(gateId, dataPathPrefix)
            .forEach(({ path, hookType }) => {
              const arr = this.#dataPathHooks[path];
              if (arr) {
                this.#dataPathHooks.set(
                  path,
                  arr.filter((o) => o.type != hookType || o.gateId != gateId)
                );
              }
            });

          delete this.#logicGates[gateId]
        }
      }
    })
  }

  // Todo: Investigate if we need to support disabling hooks for only one-more paths as opposed
  // to a component-wide approach
  suspendHooks() {
    this.#disableHooks = true;
  }

  resumeHooks() {
    this.#disableHooks = false;
  }

  triggerHooks(triggerInfo) {

    if (this.#disableHooks) {
      return;
    }

    const {
      logicGatePathRoot, pathSeparator, textNodeHookType, eachBlockHookType, gateParticipantHookType, pathProperty,
      conditionalBlockHookType, dataPathPrefix, nodeAttributeHookType, nodeAttributeKeyHookType, nodeAttributeValueHookType,
      mapSizeProperty, isNullProperty, predicateHookType, mapKeyPrefixRegex, emptyString, isMapProperty, toFqPath,
    } = RootProxy;

    const { fqPath, parentObject, oldValue, newValue, dataPathHooks, primary, animate } = triggerInfo;

    const fqPath0 = fqPath.replace(dataPathPrefix, '');
    const sPath = clientUtils.toCanonicalPath(fqPath0);

    if (!this.component.isMounted()) {
      return true;
    }

    const triggerComponentHooks = (phase) => {
      if (!parentObject || !Object.keys(triggerInfo).includes('oldValue')) return;

      const componentHooks = this.component.getHooks();

      const hookList = [
        ...componentHooks[fqPath0] || [],
        ...componentHooks[`${phase}.${fqPath0}`] || [],
        ...componentHooks[sPath] || [],
        ...componentHooks[`${phase}.${sPath}`] || [],
      ];

      const evt = { path: fqPath, oldValue, newValue, parentObject };

      for (const fn of hookList) {
        fn(evt);
      }
    }

    const triggerHooks0 = (path, withParent, parentObject, newValue, hookTypes, changeListener, filteredSelectors=[]) => {

      const hooksFilter = ({ selector }) => {
        return !selector ||
          (!filteredSelectors.includes(selector) && document.querySelector(`#${this.component.getId()} ${selector}`))
      }

      const hooks = dataPathHooks[path];

      if (!hooks) {
        this.component.throwError(`Unknown path: "${path}"`);
      }

      const parent = parentObject ? parentObject[pathProperty] : null;

      // Note: Appending-to/Removing-from a parent takes the highest priority as applicable sub-path hooks
      // will be invalidated after this, because their selector(s) will no longer be on the DOM

      const parentHooks = withParent ? dataPathHooks[parent] : null;

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

        emitContext.write(markupPredicate());

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

        const currentWrapperNodeId = id || clientUtils.randomString();

        const header = this.component.getColElementWrapperHeader(currentWrapperNodeId, key);
        const footer = this.component.getColElementWrapperFooter();

        renderBlock(
          consumer, header, footer, markupPredicate, parentNode, transform,
        )

        return currentWrapperNodeId;
      }

      const collKey = () => {
        return clientUtils.getKeyFromIndexSegment(
          path.replace(
            clientUtils.getParentFromPath(path.split('.')),
            ''
          )
        )
          .replace(mapKeyPrefixRegex, emptyString);
      }

      (parentHooks || [])
        .forEach(hook => {

          if (!hooksFilter(hook)) {
            return;
          }

          const selector = `#${this.component.getId()} ${hook.selector}`;

          switch (hook.type) {
            case eachBlockHookType:

              if (animate) {
                // Todo: Add transition classes, see: https://cssanimation.rocks/list-items/
              }

              (() => {

                const fn = this.component.lookupFnStore(hook.fn);

                const { hookMethod, canonicalPath, blockData, innerTransform, predicate } = hook;

                const collDef = this.getCollectionDefinition(parent);

                assert(collDef);

                const { collectionType: type } = collDef;

                const key = collKey();

                const childNodeSelector = `${selector} > [key='${key}']`;
                const childNode = document.querySelector(childNodeSelector)

                const { index, length } = clientUtils.getCollectionIndexAndLength(parentObject, key);

                blockData[canonicalPath].length = length;

                if (newValue === undefined) {
                  assert((index >= 0 && index <= length) || type == 'map');
                  assert(childNode);

                  childNode.remove();

                  if (type == 'array' && index < length) {
                    // Update the 'key' attribute to reflect their new positions in the array

                    for (let i = index; i < length; i++) {
                      const node = document.querySelector(`${selector} > [key='${i + 1}']`);
                      node.setAttribute('key', `${i}`);
                    }
                  }

                  this.component.triggerNodeDetachEvent(childNode);
                  return;
                }

                assert(index >= 0 && index < length);

                const createAndAppendNode0 = (consumer, key, id, markupPredicate) =>
                  createCollChildNode(
                    consumer, key, id, markupPredicate, document.querySelector(selector), innerTransform
                  );

                const getParentAppendConsumer = (parent) => {
                  return (node) => parent.appendChild(node);
                }

                const getSiblingAppendConsumer = (parent, tailKey) => {
                  const tailSibling = parent.querySelector(`:scope > [key='${tailKey}']`);
                  return (node) => tailSibling.insertAdjacentElement("afterend", node);
                }

                const getNodeConsumer = (index) => {
                  const parent = document.querySelector(selector);

                  return index == 0 ?
                    getParentAppendConsumer(parent) :
                    getSiblingAppendConsumer(
                      parent,
                      clientUtils.getCollectionKeys(parentObject)[index - 1]
                    );
                }

                const doesChildExist = (key) => {
                  return !!parent.querySelector(`:scope > [key='${key}']`)
                }

                const backfillSparseElements = () => {
                  if (type == 'array' && index > 0) {

                    const parent = document.querySelector(selector);

                    const len = parent.querySelectorAll(':scope > [key]').length;

                    for (let i = len; i < index; i++) {

                      assert(!doesChildExist(i));

                      createAndAppendNode0(
                        getNodeConsumer(i), `${i}`, null, () => ''
                      );

                      assert(doesChildExist(i));
                    }
                  }
                }

                const createAndAppendNode = (markupPredicate) => {

                  assert(!doesChildExist(key));

                  const elemId = createAndAppendNode0(
                    getNodeConsumer(index),
                    key, null, markupPredicate
                  );

                  assert(doesChildExist(key));

                  triggerNodeUpdateEvt(`#${elemId}`);

                  return elemId;
                }

                backfillSparseElements();

                const isNull = newValue === null || newValue[isNullProperty] || (predicate ? !this.component[predicate].bind(this.component)() : false);

                const blockData0 = {
                  ...blockData,
                  [canonicalPath]: {
                    ...blockData[canonicalPath],
                    index,
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

                      // Note: <path> is not used currently, but will likely be used when data-binding support is added
                      // for array manipulation methods like splice, shift, unshift, e.t.c
                      path,
                    );

                let elementNodeId;

                if (childNode) {

                  createAndAppendNode0(
                    (node) => {
                      childNode.insertAdjacentElement("afterend", node.childNodes[0]);
                      childNode.remove();
                    },
                    key,
                    childNode.id,
                    markupPredicate
                  );

                  triggerNodeUpdateEvt(`#${childNode.id}`);

                  elementNodeId = childNode.id;
                } else {
                  elementNodeId = createAndAppendNode(markupPredicate);
                }

                if (!isNull && Array.isArray(parentObject)) {
                  this.component.backfillArrayChildBlocks(`${parent}[${index}]`, `#${elementNodeId}`);
                }

                assert(blockData0[canonicalPath].index === index);

                if (hookMethod) {
                  const hook = this.component[hookMethod].bind(this.component);

                  hook({
                    node: document.querySelector(childNodeSelector),
                    blockData: clientUtils.deepClone(blockData0),
                    initial: false,
                  })
                }

              })();
              break;
          }
        });

      [...hooks]
        .forEach(hook => {

          if (!hooksFilter(hook)) {
            return;
          }

          const selector = `#${this.component.getId()} ${hook.selector}`;

          const getRenderedValue = () => {
            let computedValue = newValue;

            if (path.startsWith(`${logicGatePathRoot}${pathSeparator}`)) {
              const gateId = path.replace(`${logicGatePathRoot}${pathSeparator}`, '')
              computedValue = this.getLogicGateValue({ gate: this.#logicGates[gateId] });
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

                let keyToken = tokenList[tokenIndex - 2];

                const valueToken = { ...tokenList[tokenIndex] };

                if (tokenList[tokenIndex - 1].type == 'token:attribute-value-wrapper-start') {
                  assert(tokenList[tokenIndex + 1].type == 'token:attribute-value-wrapper-end');

                  keyToken = tokenList[tokenIndex - 3];
                  valueToken.content = `\`${valueToken.content}\``;
                }

                assert(
                  keyToken.type == 'token:attribute-key' && keyToken.content &&
                  valueToken.type == 'token:attribute-value'
                );

                const attrKey = this.component.getRenderedValue(keyToken.content);

                const attrValue = evalAttrValue(
                  getElementName(node),
                  attrKey,
                  this.component.getRenderedValue(valueToken.content)
                );

                setNodeAttribute({ node, attrKey, attrValue });

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
              triggerHooks0(
                `${logicGatePathRoot}${pathSeparator}${hook.gateId}`,
              );
              break;

            case conditionalBlockHookType:
              (() => {
                let computedValue = newValue;

                if (path.startsWith(`${logicGatePathRoot}${pathSeparator}`)) {
                  const gateId = path.replace(`${logicGatePathRoot}${pathSeparator}`, '')
                  computedValue = this.getLogicGateValue({ gate: this.#logicGates[gateId] });
                }

                const fn = this.component.lookupFnStore(hook.fn);
                const inverse = hook.inverse ? this.component.lookupFnStore(hook.inverse) : null;

                const { invert, hookMethod, blockData, innerTransform } = hook;

                const b = this.component.analyzeConditionValue(computedValue);

                const parentNode = document.querySelector(selector);

                let branch = parentNode.getAttribute('branch');

                assert(branch);

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

                renderBlock(
                  (node) => {
                    parentNode.innerHTML = '';
                    parentNode.appendChild(node)
                  },
                  null, null, markupPredicate, parentNode, innerTransform,
                )

                parentNode.setAttribute('branch', branch)

                if (hookMethod) {
                  const hook = this.component[hookMethod].bind(this.component);

                  hook({
                    node: parentNode, blockData: clientUtils.deepClone(blockData), initial: false,
                  })
                }

                triggerNodeUpdateEvt0(selector);

              })();
              break;

            case eachBlockHookType:

              (() => {

                const fn = this.component.lookupFnStore(hook.fn);
                const inverse = hook.inverse ? this.component.lookupFnStore(hook.inverse) : null;

                const { hookMethod, canonicalPath, blockData, innerTransform, predicate } = hook;

                const computedValue = newValue;

                const isArray = Array.isArray(computedValue);
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
                              fn, predicate, hookMethod, innerTransform,
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
                    const isNull = currentValue === null || currentValue[isNullProperty] || (predicate ? !this.component[predicate].bind(this.component)() : false);

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

                    triggerNodeUpdateEvt0(childNodeSelector);

                    if (!isNull && isArray) {
                      this.component.backfillArrayChildBlocks(p, `#${currentWrapperNodeId}`);
                    }

                    assert(blockData0[canonicalPath].index === i);

                    hookList.push({
                      selector: childNodeSelector,
                      blockData: clientUtils.deepClone(blockData0)
                    });
                  }

                  if (hookMethod) {
                    const hook = this.component[hookMethod].bind(this.component);

                    hookList.forEach(({ selector, blockData }) => {
                      hook({
                        node: document.querySelector(selector),
                        blockData,
                        initial: false,
                      })
                    });
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

              break;

            case predicateHookType:

              (() => {
                const computedValue = newValue;

                const fn = this.component.lookupFnStore(hook.fn);
                const canonicalPath = hook.canonicalPath.replace(/_\$$/g, '');

                const { blockData, predicate, hookMethod, innerTransform } = hook;

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

                createCollChildNode(
                  (node) => {
                    childNode.insertAdjacentElement("afterend", node.childNodes[0]);
                    childNode.remove();
                  },
                  key,
                  childNode.id,
                  markupPredicate,
                  childNode.parentElement,
                  innerTransform
                );

                triggerNodeUpdateEvt0(selector);

                if (b && isArray) {
                  this.component.backfillArrayChildBlocks(`${parent}[${index}]`, `#${childNode.id}`);
                }

                assert(blockData0[canonicalPath].index === index);

                if (hookMethod) {
                  const hook = this.component[hookMethod].bind(this.component);

                  hook({
                    node: childNode,
                    blockData: clientUtils.deepClone(blockData0),
                    initial: false,
                  })
                }

              })();
              break;
          }
        });

    }

    const primaryHookTypes = [
      nodeAttributeHookType, nodeAttributeKeyHookType, nodeAttributeValueHookType,
      textNodeHookType, gateParticipantHookType, conditionalBlockHookType, eachBlockHookType
    ];

    const transitiveHookTypes = [
      predicateHookType,
    ]

    triggerComponentHooks('beforeMount');

    const filteredSelectors = [];

    if (primary) {
      clientUtils.forEachPath(fqPath, (p) => {
        if (p == fqPath) {
          return;
        }

        const { parentObject, value } = this.getInfoFromPath(
          p.replace(dataPathPrefix, emptyString)
        );

        triggerHooks0(p, false, parentObject, value, transitiveHookTypes, (selector) => {
          filteredSelectors.push(selector);
        });
      });
    }

    triggerHooks0(fqPath, primary, parentObject, newValue, primaryHookTypes, null, filteredSelectors);

    triggerComponentHooks('onMount');
  }

  /**
   * The general contract when calling this method is that the HTML node
   * representing the path: <parent[key]> will be detached from the DOM shortly
   * 
   * This function prunes hooks from the dynamic index <i> of the array <parent>
   */
  pruneCollHooks({ parent, key }) {
    const {
      dataPathRoot, pathSeparator, arrayChildBlockHookType, logicGatePathRoot, toFqPath,
    } = RootProxy;

    const isArray = clientUtils.isNumber(key);

    const fqParent = `${dataPathRoot}${pathSeparator}${parent}`;

    const fqPath = toFqPath({ isArray, isMap: !isArray, parent: fqParent, prop: key });

    const hookList = Object.entries(this.#dataPathHooks)
      .filter(([k]) => k.startsWith(fqPath))

    // Also, add nested logicGates to <hookList>. The main reason we want to do
    // this is to clean up paticipants correlated to <fqPath>. Note: Doing this
    // will also reduce the number of invalid hooks that need to be pruned later. 

    hookList
      .forEach(([k, v]) => {
        v.forEach(({ type, path }) => {
          if (type == arrayChildBlockHookType && path.startsWith(logicGatePathRoot)) {
            const v = this.#dataPathHooks[path];
            assert(v);
            hookList.push([path, v])
          }
        })
      });

    this.pruneHooks0(
      hookList,
      ({ canonicalPath }) =>
        // Note: this may also remove logic gate participants, but we should be fine because
        // the correlated logic gate will just skip, if it does not find any given "gateParticipant"
        // hook
        clientUtils.isCanonicalArrayIndex(canonicalPath, parent) &&
        // Prune all logic gates added above
        canonicalPath.startsWith(logicGatePathRoot)
    )
  }

  updateBlockData({ parent, key, info }) {
    const {
      dataPathRoot, pathSeparator, arrayChildBlockHookType, logicGatePathPrefix, toFqPath,
    } = RootProxy;

    const isArray = clientUtils.isNumber(key);

    const fqParent = `${dataPathRoot}${pathSeparator}${parent}`;

    const fqPath = toFqPath({ isArray, isMap: !isArray, parent: fqParent, prop: key });

    Object.entries(this.#dataPathHooks)
      .filter(([k]) => k.startsWith(fqPath))
      .forEach(([k, v]) => {

        const arr = v
          .filter(this.getHookFilter)
          .filter(({ canonicalPath }) => clientUtils.isCanonicalArrayIndex(canonicalPath, parent));

        arr
          .filter(({ type }) => type == arrayChildBlockHookType)
          .forEach(({ path, blockDataKey }) => {

            const blockDataList = (() => {
              if (path.match(logicGatePathPrefix)) {
                return [
                  this.#logicGates[path.replace(logicGatePathPrefix, '')].blockData
                ]
              } else {
                this.#dataPathHooks[path]
                  .filter(({ blockData }) => blockData && Object.keys(blockData).includes(blockDataKey))
                  .map(({ blockData }) => blockData);
              }
            })()

            assert(blockDataList.length);

            blockDataList.forEach((blockData) => {
              const o = blockData[blockDataKey];
              assert(o);

              if (info.index) {
                o.index = info.index;
              }

              if (info.length) {
                o.length = info.length;
              }
            });
          });

        if (isArray && info.index) {
          const p = k.replace(fqPath, toFqPath({ isArray: true, parent: fqParent, prop: info.index }));

          if (this.#dataPathHooks[p]) {
            arr.forEach(e => {
              this.#dataPathHooks[p].push(e);
            });
          } else {
            this.#dataPathHooks[p] = [
              ...arr,
            ]
          }
        }
      });
  }

  simpleSetMutationHandler(obj, prop, newValue, changeSet) {

    const {
      dataPathRoot, pathSeparator, pathProperty, typeProperty, mapType, isMapProperty, mapKeyPrefix,
      isNullProperty, getMapWrapper, toFqPath, getDataVariables, addDataVariablesToObject,
    } = RootProxy;

    const parent = obj[pathProperty];


    if (obj[isNullProperty]) {
      throw TypeError(`[${parent}] Cannot read properties of null (reading '${prop}')`);
    }

    const isArray = obj.constructor.name === 'Array';
    const isMap = !isArray && obj[isMapProperty];

    switch (true) {
      case isArray:
        // Todo: Support using -1 as array index to refer to the last index
        if (!global.clientUtils.isNumber(prop) &&
          ![...getDataVariables(), pathProperty].includes(prop)
        ) {
          this.component.logger.error(`Invalid index: ${prop} for array: ${obj[pathProperty]}`);
          return false;
        }
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
        isArray || isMap,

        // In toCanonicalObject(...), we always default missing object properties to null,
        // so oldValue === undefined it means that <prop> is invalid
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


    if (oldValue instanceof BaseComponent) {


      // Note: this is false, components can be updated... we just have to 
      // destroy the existing one and re-render the new one









      // When a data change happens on hashList of a rendered component, re-render it
      // See Global Navigation for more context

      // To implement this, I may need to wrap "loadInlineComponent" in a custom block
      // so that then the data paths are being resolved, we will register  them as componentRender
      // participant - The devil is in the details





      this.component.logger.error(`Path: ${fqPath} cannot be mutated`);
      return false;
    }

    if (!this.#dataPathHooks[fqPath]) {

      // Notice that we are doing this check, after we check if
      // oldValue is a component, not before. This is because if
      // we do it before, this error will be thrown if <fqPath>
      // resolved to a component (for components, we do not
      // add an entry to dataPathHooks), which will not provide
      // a descriptive error

      this.component.logger.error(`Unknown path: ${fqPath}`);
      return false;
    }

    const addToChangeSet = (path, primary) => {
      let o = {
        primary,
        oldValue: this.getValueFromPath(path),
      };
      if (primary) {
        o = {
          ...o,
          newValue,
          parentObject: this.getValueFromPath(parent),
          animate: true,
        }

        assert(o.parentObject);
      }
      changeSet[path] = o;
    };

    addToChangeSet(fqPath0, true);

    const collDef = this.getCollectionDefinition(parent);

    // This is used to store changeset information
    // Note: It is collected before the collection is modified
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

      // If an element that is not the last element is being removed
      o.removedNonLastElement = newValue === undefined && index < length - 1;

      // If an element is being added to this array in a position that will cause sparse elements 
      // to be created automatically
      o.addedElementWithSparseIndexes = oldValue === undefined && index > length && type == 'array';

      // If an element is being added that was not here before
      o.newElementAdded = type == 'map' ? index == -1 : index >= length;

      // If an existing element is removed
      o.elementRemoved = newValue === undefined;


      const {
        removedNonLastElement, addedElementWithSparseIndexes, newElementAdded, elementRemoved
      } = o;

      if (newElementAdded || elementRemoved) {
        addToChangeSet(toFqPath({ parent, prop: 'length' }));
      }

      if (removedNonLastElement) {
        // Add all indexes after the <index> to <changeSet>

        // <i < length - 1> because after modification, array length will be less by 1
        for (let i = index + 1; i < length - 1; i++) {
          addToChangeSet(
            toFqPath({ parent, prop: i })
          );
        }
      }

      if (addedElementWithSparseIndexes) {
        // Visit sparse elements

        for (let i = length; i < index; i++) {
          // Add null to sparse index
          this.addNullCollectionMember(
            obj, i,
            collDef.$ref ? {
              first: i == 0,
              last: false,
              key: `${i}`,
              index: i,
            } : null
          );
          // Add sparse index to <changeSet>
          addToChangeSet(
            toFqPath({ parent, prop: i })
          );
        }
      }

      return o;
    })();

    const setValue0 = () => {
      obj[prop] = newValue;
    }

    // To ensure that our proxy is not discarded, we must not throw error, so we need
    // to route functions that can throw user-generated error through this function
    const tryOrLogError = (fn) => {
      try {
        fn();
        return true;
      } catch (e) {
        this.component.logger.error(e.message);
        return false;
      }
    }

    if (newValue != undefined) {

      if (typeof newValue == 'object') {

        const b = tryOrLogError(
          () => this.#toCanonicalObject({
            path: fqPath,
            obj: newValue
          })
        );

        if (!b) {
          return false;
        }

        if (collDef) {
          addDataVariablesToObject(
            newValue,
            this.getDataVariablesForSimpleSetOperation(collInfo),
          )
        }

        if (newValue[typeProperty] == mapType) {
          newValue = getMapWrapper(newValue);
        }

        newValue = this.getObserverProxy(newValue);

      } else {

        const b = tryOrLogError(
          () => this.validateSchema(fqPath, newValue)
        );

        if (!b) {
          return false;
        }
      }

      setValue0();

    } else {

      if (collDef) {

        switch (true) {

          case newValue === undefined:

            if (Array.isArray(obj)) {
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

          default:
            this.addHookForScalarCollectionMember(
              toFqPath({ isArray, isMap, parent, prop })
            )
            break;
        }

        // Update hooks info
        const { newElementAdded, elementRemoved, keys, index, length } = collInfo;

        const newLength = clientUtils.getCollectionLength(obj);

        switch (true) {
          case newElementAdded:

            for (let i = 0; i < length; i++) {
              this.updateBlockData({
                parent, key: keys[i], info: { length: newLength }
              });
            }
            break;

          case elementRemoved:

            for (let i = 0; i < index; i++) {
              this.updateBlockData({
                parent, key: keys[i], info: { length: newLength }
              });
            }

            for (let i = index; i < length - 1; i++) {
              this.pruneCollHooks({ parent, key: keys[i] });

              this.updateBlockData({
                parent, key: keys[i + 1], info: { index: i, length: newLength }
              });
            }

            this.pruneCollHooks({ parent, key: keys[length - 1] });
            break;
        }

      } else {

        if (newValue === undefined) {
          // Object properties cannot have "undefined", change to null
          newValue = null;
        }

        setValue0();
      }
    }

    return true;
  }

  addNullCollectionMember(obj, prop, dataVariables) {

    const {
      pathProperty, isMapProperty, createNullObject, toFqPath, addDataVariablesToObject
    } = RootProxy;

    const parent = obj[pathProperty];
    const collDef = this.getCollectionDefinition(parent);

    assert(collDef);

    const isArray = Array.isArray(obj);
    const isMap = obj[isMapProperty];

    const p = toFqPath({ isArray, isMap, parent, prop });

    if (collDef.$ref) {
      const o = obj[prop] = createNullObject();

      assert(dataVariables);
      addDataVariablesToObject(o, dataVariables);

      this.#toCanonicalObject({
        path: p,
        obj: o
      });

      obj[prop] = this.getObserverProxy(o);
    } else {
      obj[prop] = null;
      this.addHookForScalarCollectionMember(p)
    }
  }

  getDataVariablesForSimpleSetOperation(collInfo) {
    const { mapKeyPrefixRegex, emptyString } = RootProxy;
    const { index, length, type, prop } = collInfo;

    const first = index == 0 || (index < 0 && length == 0)
    const last = index == len - 1 || type == 'map' ? index < 0 : index >= len;
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
        return this.mutate((changeSet) => this.simpleSetMutationHandler(obj, prop, undefined, changeSet));
      },

      // get: (obj, prop) => {
      //    Todo: Add array methods
      // },

      set: (obj, prop, newValue) => {
        if (!this.canMutate()) {
          return false;
        }
        return this.mutate((changeSet) => this.simpleSetMutationHandler(obj, prop, newValue, changeSet));
      },
    });
  }

  getValueFromPath(path, noOpValue) {
    return this.component.evalPathLeniently(`this.getInput()${path.length ? '.' : ''}${path}`, noOpValue);
  }

  getInfoFromPath(path) {
    const { isMapProperty } = RootProxy;
    const { getDataVariableValue } = RootCtxRenderer;

    assert(path.length);

    const noOpValue = '';
    const value = (p) => this.getValueFromPath(p, noOpValue);

    const pathArray = path.split(/\./g);
    const dataVariable = pathArray[pathArray.length - 1];

    if (dataVariable.startsWith('@')) {
      // For "scalar dataVariable" paths, doing an eval will not work, hence execute a workaround

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
        assert(Array.isArray(coll) || coll[isMapProperty]);

        const parent = arr.join('.');

        const collKeys = Object.keys(coll);
        const key = clientUtils.getKeyFromIndexSegment(
          clientUtils.tailSegment(parent)
        );
        const index = collKeys.indexOf(key);

        if (index < 0) {
          return emptyRet;
        }

        // Todo: Fix to support @random, adding a mock here for now

        if (dataVariable == '@random') {
          return clientUtils.randomString();
        }

        return {
          parentObject: value(parent),
          value: getDataVariableValue(
            dataVariable, index, collKeys,
          ),
        };
      }
    }

    return {
      parentObject: value(
        clientUtils.getParentFromPath(pathArray)
      ) || null,
      value: value(path),
    };
  }

  canMutate() {
    return !this.processingDataUpdate;
  }

  mutate(fn) {

    const { dataPathRoot, pathSeparator } = RootProxy;
    assert(this.canMutate());

    this.processingDataUpdate = true;
    const changeSet = {};

    const b = fn(changeSet);

    this.processingDataUpdate = false;

    if (b) {

      const dataPathHooks = clientUtils.deepClone(this.#dataPathHooks);

      const primarySet = {};
      const secondarySet = {};

      Object.entries(changeSet).forEach(([path, changeInfo]) => {
        (changeInfo.primary ? primarySet : secondarySet)[path] = changeInfo;
      });

      Object.entries(primarySet)
        .forEach(([path, { oldValue, newValue, parentObject, animate }]) => {
          this.triggerHooks({
            fqPath: `${dataPathRoot}${pathSeparator}${path}`,
            parentObject,
            oldValue,
            newValue,
            dataPathHooks,
            primary: true,
            animate,
          });
        });

      if (secondarySet.length) {

        const { getCanonicalSegments: segs } = clientUtils;

        Object.keys(dataPathHooks)
          .filter(k => k.startsWith(`${dataPathRoot}${pathSeparator}`))
          .sort((x, y) => segs(x).length - segs(y).length)
          .forEach(path => {

            const changeInfo = Object.entries(secondarySet)
              .map(([k, v]) => ({ ...v, path: `${dataPathRoot}${pathSeparator}${k}` }))
              .filter(({ path: p }) => path.startsWith(p))[0];

            if (changeInfo) {
              const { parentObject, value } = this.getInfoFromPath(path);

              const o = {
                fqPath: path,
                parentObject,
                newValue: value,
                dataPathHooks,
                animate: false,
              }

              if (path == changeInfo.path) {
                o.oldValue = changeInfo.oldValue;
              }

              this.triggerHooks(o);
            }
          });
      }
    }
    return b;
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

    const { toDefinitionName } = RootProxy;

    const canonicalPath = global.clientUtils.toCanonicalPath(path);
    const { additionalProperties } = this.getSchemaDefinitions()[
      toDefinitionName(canonicalPath)
    ];

    return additionalProperties ? {
      collectionType: 'map',
      ...additionalProperties,
    } : false;
  }

  getArrayDefinition(path) {
    if (!path.length) return false;

    const { toDefinitionName } = RootProxy;

    const canonicalPath = global.clientUtils.toCanonicalPath(path);
    const { items } = this.getSchemaDefinitions()[
      toDefinitionName(canonicalPath)
    ];

    return items ? {
      collectionType: 'array',
      ...items,
    } : false
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
    if (prop.startsWith('@')) {
      isArray = isMap = false;
    }
    return `${parent}${isArray ? `[${prop}]` : isMap ? `["${prop}"]` : `${parent.length ? '.' : ''}${prop}`}`;
  }

  createHooksArray(path) {
    const arr = new Proxy([], {
      set: (object, key, value) => {

        // Note: an opaque hook means that the path where it's registered does not exclusively own the selector. An
        // example of opaque hooks are the attribute related hooks, because there may be multiple attribute-based
        // hooks for the same selector

        const { selector, opaque } = value;
        const { nodeList } = this.component.getEmitContext();

        if (clientUtils.isNumber(key) && selector && !opaque) {
          assert(!nodeList[selector] || nodeList[selector] == path);

          nodeList[selector] = path;
        }

        return object[key] = value;
      }
    });

    this.#dataPathHooks[path] = arr;
    return arr;
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
      this.createHooksArray(`${toFqPath({ parent: k, prop: o })}`);
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

  #toCanonicalObject({ path, obj }) {

    const {
      dataPathRoot, pathSeparator, pathProperty, typeProperty, mapType, mapKeyPrefix, mapKeyPrefixRegex, getMapWrapper,
      addDataVariables, getReservedObjectKeys, toFqPath, getReservedMapKeys, createNullObject,
    } = RootProxy;

    const reservedObjectKeys = getReservedObjectKeys();

    const isArray = Array.isArray(obj);

    if (!isArray) {
      Object.keys(obj).forEach(k => {
        if (reservedObjectKeys.includes(k)) {
          this.component.throwError(`[${path}] An object cannot contain the key: ${k}`);
        }
      })
    }

    Object.defineProperty(obj, pathProperty, { value: path, configurable: false, writable: false, enumerable: false });

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

    for (let i = 0; i < keys.length; i++) {
      const prop = keys[i];

      assert(obj[prop] !== undefined);

      const p = toFqPath({ isArray, isMap, parent: path, prop });

      this.validateSchema(p, obj[prop]);

      if (isCollection) {

        if (obj[prop] === null && isCollection.$ref) {
          obj[prop] = createNullObject();
        }

        switch (true) {
          case obj[prop] !== Object(obj[prop]):
          case obj[prop] instanceof BaseComponent:
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
          this.#toCanonicalObject({ path: p, obj: obj[prop] });

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
              .map(k => {
                if (typeof k != 'symbol') {
                  k = k.replace(mapKeyPrefix, '')
                }
                return k;
              });

          case typeof prop == 'symbol':
            return obj[prop];

          default:
            assert( typeof prop == 'string');
            
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
