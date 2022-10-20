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

  static mapType = 'Map';

  static mapKeyPrefix = '$_';

  static mapKeyPrefixRegex = /^\$_/g;

  // Todo: Rename from HookName to HookType

  static conditionalBlockHookName = 'conditionalBlock';

  static eachBlockHookName = 'arrayBlock';

  static textNodeHookName = 'textNode';

  static gateParticipantHookName = 'gateParticipant';

  static arrayChildBlockHookName = 'arrayChildBlock';

  static validateInputSchema = false;

  static globalsBasePath = 'globals';

  static isMapProperty = '$isMap';

  static isNullProperty = '$isNull';

  static mapSizeProperty = 'size';

  static mapKeysProperty = 'keys';

  static lenientExceptionMsgPattern = /^Cannot read properties of (undefined|null)/g;

  #dataPathHooks;

  #logicGates;

  static #dataReferences = [];

  static #privilegedMode = false;

  constructor({ component }) {
    this.component = component;
    this.handler = this.createObjectProxy();
    this.#dataPathHooks = this.createDataPathHooksObject();
    this.#logicGates = {};
  }

  createDataPathHooksObject() {

    const { allowHooksForNonExistentPaths } = this.component.config;

    return new Proxy({}, {
      set: function (object, key, value) {
        assert(Array.isArray(value));

        // Only set - if not set already
        return object[key] === undefined ? object[key] = value : true;
      },
      get: (object, key) => {

        if (key == 'set') {
          return (k, v) => {
            return (object[k] = v);
          }
        }

        let value = object[key];

        if (!value && allowHooksForNonExistentPaths) {
          // If an attempt is made to get an entry that does not exist, create that entry. 
          // This is because at initial rendering time, hooks may be added for
          // data paths that do not yet exist, but will be used at a later time...

          value = object[key] = this.createHooksArray();
        }

        return value;
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

    const { validateInputSchema } = RootProxy;
    const proxy = new RootProxy({ component });

    proxy.component.proxyInstance = proxy;
    proxy.component.rootProxy = proxy.handler;

    // At compile-time, it would be too early for <resolver> to be set, so let's use 
    // <loadable> instead, since we know it will be false at compile-time and true at
    // runtime
    if (proxy.component.loadable()) {

      if (!component.constructor.schemaDefinitions) {
        // register input schema
        proxy.withSchema(proxy.component.constructor.schema);
      }

      if (validateInputSchema && component.validateInput()) {
        // perform input validation
        proxy.validateInput();
      }

      if (component.dataBindingEnabled()) {
        // Add our observer, to orchestrate data binding operations
        proxy.addDataObserver();
      }

    }

    return proxy.handler;
  }

  withSchema(schema) {

    const {
      pathProperty, firstProperty, lastProperty,
      keyProperty, indexProperty, randomProperty, emptyString
    } = RootProxy;

    const syntheticProperties = [
      pathProperty, firstProperty, lastProperty,
      keyProperty, indexProperty, randomProperty,
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
                      const enum0 = self.appContext.enums[
                        definitions[refName].originalName
                      ];

                      if (!enum0) {
                        throw Error(
                          `Ensure that dist/components/enums.json contains the latest changes`
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

            const addSchema = (v) => {

              const path = v[pathProperty];
              assert(path && path.length);

              delete v[pathProperty];

              path.forEach((p, index) => {
                if (!definitions[p]) {

                  definitions[p] = {
                    ...v,
                    $id: `${defPrefx}${p}`
                  };

                  if (
                    v.$ref &&
                    definitions[v.$ref.replace(defPrefx, '')].shared
                  ) {
                    // If the object this definition references is shared, indicate
                    definitions[p].referencesShared = true;
                  }

                } else {
                  assert(definitions[p].shared || definitions[p].referencesShared);
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

    this.component.constructor.schemaDefinitions = new Proxy(definitions, {
      // For paths that reference shared types, we want to automatically return
      // the referenced shared type
      get: (obj, prop) => {
        let v = obj[prop];
        if (v.referencesShared) {
          v = obj[v.$ref.replace(defPrefx, '')];
        }
        return v;
      },
    });

    const ajv = new ajv7.default({
      schemas: Object.values(definitions),
      allErrors: true,
      allowUnionTypes: true,
      inlineRefs: false,
    });

    // Add custom validator for component instances
    ajv.addKeyword({
      keyword: 'component',
      validate: ({ className }, data) => !data || data instanceof components[className],
      errors: true,
    });

    this.component.constructor.ajv = ajv;
  }

  validateInput() {
    // Perform schema validation on input data
    const validate = this.component.constructor.ajv.getSchema(`#/definitions/${this.component.getComponentName()
      }`)

    const input = this.component.getInput();

    if (!validate(input)) {

      throw Error(`Component: ${this.component.getId()
        } could not be loaded due to schema mismatch of input data - ${this.component.constructor.ajv.errorsText(validate.errors)
        }`);
    }
  }

  getDataPathHooks() {
    return this.#dataPathHooks;
  }

  getGlobalVariables() {
    return {
      // User Global Variables
      ...self.appContext.userGlobals,

      // Component Global Variables
      ...{
        componentId: this.component.getId()
      }
    }
  }

  // Note: We cannot have a global variable called 'data', as this will be immediately
  // overriden by the 'data' object we pass to handlebars
  static getGlobalVariableNames() {
    return [
      // User Global Variables
      'rtl',

      // Component Global Variables
      'componentId'
    ];
  }

  addDataObserver() {

    const {
      dataPathRoot, pathSeparator, globalsBasePath,
    } = RootProxy;

    if (RootProxy.#dataReferences.includes(this.component.getInput())) {
      // The reason we have to throw this error is because the input in question
      // has previously been transformed such that data variables are created as 
      // immutable, and this operation will attempt re-set those prop, hence resulting
      // in an error.
      // It is understandable that the developer may want to re-use input data
      // without giving much thought to it, so in the error message - add a useful hint
      throw Error(
        'Input data already processed. You need to clone the data first before using it on a new component instance'
      );
    }

    this.toCanonicalObject({ path: '', obj: this.component.getInput() });

    this.component.setInput(
      this.getObserverProxy(this.component.getInput())
    );

    RootProxy.#dataReferences.push(this.component.getInput());

    // Add globals to dataPathHooks 
    // Even though this is registered here, global variables are generally never 
    // expected to change
    Object.keys(this.getGlobalVariables())
      .forEach(variable => {
        this.#dataPathHooks[[dataPathRoot, globalsBasePath, variable].join(pathSeparator)] = [];
      });

    // Setup task to cleanup dead hooks
    setInterval(
      () => {
        if (this.processingDataUpdate) {
          return;
        }

        this.pruneHooks()

      },
      this.component.config.hookCleanupInterval
    );
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
            throw Error(`Invalid path: ${prop}`);
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
          case global.clientUtils.isNumber(prop):

            // At least access the context, so that the proxy
            // created in setSyntheticContext(...) intercepts the value
            // and updates the synthetic context
            // eslint-disable-next-line no-unused-expressions
            obj[prop];

            return this.createObjectProxy();

          case prop === 'toHTML':
          case prop === Symbol.toPrimitive:
            return () => _this.component.toHtml(obj);

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

  static evaluateBooleanExpression(component, left, right, operator, scope = '') {
    const predicates = component.getBooleanOperators()[operator];

    if (!predicates) {
      throw Error(`Unknown boolean operator: ${operator}`);
    }
    for (const fn of predicates) {
      const b = Function(
        `${scope} return arguments[0](${left}, ${right})`,
      )
        .bind(component)(fn);

      if (!b) { return false; }
    }

    return true;
  }

  executeWithBlockData(fn, blockData) {

    const blockDataSnapshot = this.component.blockData;

    if (blockData) {
      this.component.blockData = blockData;
    }

    const r = fn();

    if (blockData) {
      this.component.blockData = blockDataSnapshot;
    }

    return r;
  }

  getLogicGateAssociatedHooks(id, pathPrefix) {
    const result = [];
    Object
      .entries(this.#dataPathHooks)
      .filter(([k]) => k.startsWith(pathPrefix))
      .forEach(([k, v]) => {
        v.forEach(({ type, gateId }) => {
          if (gateId == id) {
            result.push({ path: k, hookType: type });
          }
        })
      });
    return result;
  }

  getLogicGateValue({ gate, useBlockData = true }) {

    const { evaluateBooleanExpression } = RootProxy;

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
      return Function(expr).bind(this.component)();
    }

    const getConditionExpr = (parts, invert) => {

      let scope = ``;
      const and = ' && ';
      const or = ' || ';

      const getBoolExpr = (expr) => {

        const left = getExpr(expr.left);
        const right = getExpr(expr.right);

        return evaluateBooleanExpression(
          this.component, left, right, expr.operator, scope
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
        const data = gate.table[item.original];
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

        for (let i = 0; i < gate.table.length; i++) {

          const item = gate.table[i];

          const { condition, left, right } = item;

          item.condition = condition.map(item => this.toExecutablePath(item, true));

          item.left = this.toExecutablePath(left);
          item.right = this.toExecutablePath(right);
        }

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
      dataPathRoot, literalPrefix, pathSeparator, parsePathExpressionLiteralValue,
    } = RootProxy;

    const MUST_GRP = 'MustacheGroup';
    const PATH_EXPR = 'PathExpression';
    const BOOL_EXPR = 'BooleanExpression';

    const lenientMarker = /\?$/g;

    const { type, original, left, right } = item;

    const getExecPath = (fqPath) => {
      let execString = this.component.getExecPath0({
        fqPath,
        allowSynthetic,
      });
      if (lenient) {
        execString = `this.evalPathLeniently("${execString}")`;
      }
      return execString;
    }

    switch (type) {
      case PATH_EXPR:
        let p = original.replace(`${dataPathRoot}${pathSeparator}`, '');

        if (p.startsWith(literalPrefix)) {
          item.type = 'StringLiteral';
          item.original = parsePathExpressionLiteralValue(p);
        } else {
          lenient = lenient || p.match(lenientMarker);
          if (lenient) {
            p = p.replace(lenientMarker, '');
          }
          item.canonicalPath = p;
          item.original = getExecPath(p);
        }
        break;

      case BOOL_EXPR:
        item.left = this.toExecutablePath(left, lenient);
        item.right = this.toExecutablePath(right, lenient);
        break;

      case MUST_GRP:
        item.items = item.items.map(item => this.toExecutablePath(item, lenient));
        break;
    }
    return item;
  }

  getParticipantsFromLogicGate(gate) {

    const { dataPathRoot, pathSeparator } = RootProxy;
    const { toBindPath } = RootCtxRenderer;

    const PATH_EXPR = 'PathExpression';

    return gate.participants
      .map((path) => {

        const { original, type } = this.toExecutablePath(
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

        const isSynthetic = this.component.isSynthetic(
          original.replace('this.', '')
        )

        // Since <allowSynthetic> is set to false, we don't expect a synthetic path
        assert(!isSynthetic);

        return {
          original: toBindPath(original),
          canonicalPath: path.replace(`${dataPathRoot}${pathSeparator}`, ''),
        }
      })
      .filter(e => !!e);
  }

  resolveLogicPath({ prop }) {

    const {
      logicGatePathRoot, pathSeparator, gateParticipantHookName,
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
          this.#dataPathHooks[original].push({
            type: gateParticipantHookName,
            gateId,
            canonicalPath,
          });
        });

      gate.id = gateId;
      gate.canonicalId = prop;
      gate.blockData = this.component.getBlockDataSnapshot(path);

      this.#logicGates[gateId] = gate;
      this.#dataPathHooks[path] = [];
    }

    // This is no longer needed, because participants have been registered above
    delete gate.participants;

    const v = this.getLogicGateValue({ gate, useBlockData: false });

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
      literalPrefix, rawDataPrefix, parsePathExpressionLiteralValue
    } = RootProxy;

    // eslint-disable-next-line no-undef
    assert(prop.constructor.name === 'String');

    if (prop.startsWith(literalPrefix)) {
      // eslint-disable-next-line no-eval
      return eval(
        parsePathExpressionLiteralValue(prop)
      );
    }

    if (prop.startsWith(rawDataPrefix)) {
      // eslint-disable-next-line no-param-reassign
      prop = prop.replace(rawDataPrefix, '');
      isRawReturn = true;
    }

    const suffixMarker = /\!$/g;
    const lenientMarker = /\?$/g;

    // 1. Should enable lenient path resolution?
    const lenientResolution = prop.match(lenientMarker);
    if (lenientResolution) {
      // eslint-disable-next-line no-param-reassign
      prop = prop.replace(lenientMarker, '');
    }

    // 2. Should include path?
    const includePath = prop.match(suffixMarker);

    if (includePath) {
      // eslint-disable-next-line no-param-reassign
      prop = prop.replace(suffixMarker, '');
    }

    // 3. Should return raw data?
    isRawReturn = isRawReturn || prop.match(suffixMarker);

    if (isRawReturn) {
      // eslint-disable-next-line no-param-reassign
      prop = prop.replace(suffixMarker, '');
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

  pruneHooks() {
    this.pruneHooks0(
      Object.entries(this.#dataPathHooks),
      ({ nodeId }) =>
        // HookType "gateParticipant" do not store a nodeId, and are usually 
        // pruned when the parent logic gate is being pruned
        !nodeId ||
        document.querySelector(
          `#${this.component.getId()} #${nodeId}`
        )
    )
  }

  /**
   * @param {Function} predicate Predicate function to determine which hooks are still valid
   */
  pruneHooks0(hookList, predicate) {

    const { logicGatePathPrefix, dataPathPrefix } = RootProxy;

    hookList.forEach(([k, v]) => {

      const isLogicGate = k.match(logicGatePathPrefix);

      // Logic gate paths are expected to have a single hook due to
      // their dynamic nature, see resolveLogicPath(...)
      assert(!isLogicGate || v.length === 1);

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

  triggerHooks(fqPath, parentObject, newValue, dataPathHooks, withParent) {
    const {
      logicGatePathRoot, pathSeparator, textNodeHookName, eachBlockHookName,
      gateParticipantHookName, pathProperty, conditionalBlockHookName, dataPathPrefix,
      mapSizeProperty, isNullProperty,
    } = RootProxy;

    const sPath = clientUtils.toCanonicalPath(fqPath.replace(dataPathPrefix, ''));

    if (!this.component.isMounted()) {
      return true;
    }

    const triggerComponentHooks = (phase) => {
      if (!parentObject) return;

      const componentHooks = this.component.getHooks();

      const hookList = [
        ...componentHooks[fqPath] || [],
        ...componentHooks[`${phase}.${fqPath}`] || [],
        ...componentHooks[sPath] || [],
        ...componentHooks[`${phase}.${sPath}`] || [],
      ];

      const evt = { path: fqPath, newValue, parentObject };

      for (const fn of hookList) {
        fn(evt);
      }
    }

    const triggerHooks0 = (path, withParent) => {

      const hooksFilter = (hook) => {
        const selector = `#${this.component.getId()} #${hook.nodeId}`;
        return !hook.nodeId || document.querySelector(selector)
      }

      const hooks = dataPathHooks[path];

      if (!hooks) {
        throw Error(`Unknown path: "${path}"`);
      }

      const parent = parentObject ? parentObject[pathProperty] : null;

      assert(parent || !withParent);

      // Note: Appending-to/Removing-from a parent takes the highest priority as applicable sub-path hooks
      // will be invalidated after this, because their nodeId(s) will no longer be on the DOM

      const parentHooks = withParent ? dataPathHooks[parent] : null;

      (parentHooks || [])
        .filter(hooksFilter)
        .forEach(hook => {

          const selector = `#${this.component.getId()} #${hook.nodeId}`;

          switch (hook.type) {
            case eachBlockHookName:

              // Todo: Support animations: https://cssanimation.rocks/list-items/

              (() => {

                const { htmlWrapperCssClassname } = RootCtxRenderer;
                const { fn, hookMethod, canonicalPath, blockData } = hook;

                const collDef = this.getCollectionDefinition(parent);

                assert(collDef);

                const { collectionType: type } = collDef;

                // Get key from <fqPath>
                const key = (() => {
                  const segments = clientUtils.getSegments({ original: fqPath });
                  return segments[segments.length - 1];
                })();

                const childNodeSelector = `${selector} > div[key='${key}']`;
                const childNode = document.querySelector(childNodeSelector)

                const { index, length } = clientUtils.getCollectionIndexAndLength(parentObject, key);

                if (newValue === undefined) {
                  assert((index >= 0 && index <= length) || type == 'map');
                  assert(childNode);

                  childNode.remove();

                  if (type == 'array' && index < length) {
                    // Update the 'key' attribute to reflect their new positions in the array

                    for (let i = index; i < length; i++) {
                      const node = document.querySelector(`${selector} > :nth-child(${i})`);
                      assert(node.getAttribute('key') == `${i + 1}`);

                      node.setAttribute('key', `${i}`);
                    }
                  }
                  return;
                }

                assert(index >= 0 && index < length);

                const createAndAppendNode0 = (parent, key, content) => {
                  const node = document.createElement('div');
                  node.classList.add(htmlWrapperCssClassname);
                  node.setAttribute('key', key);
                  node.id = clientUtils.randomString();
                  node.innerHTML = content;

                  parent.appendChild(node);
                  return node.id;
                }

                const createAndAppendNode = (content) => {
                  const parent = document.querySelector(selector);
                  assert(
                    index == 0 ||
                    (
                      parent.lastElementChild.getAttribute('key') ==
                      clientUtils.getCollectionKeys(parentObject)[index - 1]
                    )
                  )
                  return createAndAppendNode0(parent, key, content);
                }


                const blockData0 = clientUtils.deepClone({
                  ...blockData,
                  [canonicalPath]: {
                    ...blockData[canonicalPath],
                    index
                  }
                });

                switch (true) {

                  case newValue === null || newValue[isNullProperty]:
                    // null collection members are always represented as an empty strings
                    if (childNode) {
                      childNode.innerHTML = '';
                    } else {
                      createAndAppendNode('');
                    }
                    break;

                  default:

                    // We need to decrement <index> by 1 because: inside <fn>, index will
                    // be incremented by 1 through a call to doBlockUpdate(...)
                    blockData0[canonicalPath].index--;

                    const markup = this.executeWithBlockData(
                      () => {
                        return fn(this.handler);
                      },
                      blockData0,
                    );

                    // Todo: Remove
                    assert(blockData0[canonicalPath].index === index);

                    let elementNodeId;

                    if (childNode) {
                      childNode.innerHTML = markup;
                      elementNodeId = childNode.id;
                    } else {

                      if (type == 'array' && index > 0) {
                        // Backfill sparse indexes (if any)
                        const parent = document.querySelector(selector);

                        for (let i = parent.childNodes.length; i < index; i++) {
                          assert(
                            !parent.querySelector(`:scope > div[key='${i}']`)
                          )

                          createAndAppendNode0(parent, `${i}`, '');
                        }
                      }

                      elementNodeId = createAndAppendNode(markup);
                    }

                    if (Array.isArray(parentObject)) {
                      this.component.backfillArrayChildBlocks(`${parent}[${index}]`, elementNodeId);
                    }

                    break;
                }

                if (hookMethod) {
                  const hook = this.component[hookMethod].bind(this.component);

                  hook({
                    node: document.querySelector(childNodeSelector),
                    blockData: blockData0,
                    initial: false,
                  })
                }
              })();
              break;
          }
        });

      [...hooks]
        .filter(hooksFilter)
        .forEach(hook => {

          const selector = `#${this.component.getId()} #${hook.nodeId}`;

          switch (hook.type) {

            case textNodeHookName:
              (() => {
                let computedValue = newValue

                if (path.startsWith(`${logicGatePathRoot}${pathSeparator}`)) {
                  const gateId = path.replace(`${logicGatePathRoot}${pathSeparator}`, '')
                  computedValue = this.getLogicGateValue({ gate: this.#logicGates[gateId] });
                }

                const { transform } = hook;

                document.getElementById(hook.nodeId).innerHTML = this.component.toHtml(
                  transform ? transform(computedValue) : computedValue
                );
              })();
              break;

            case gateParticipantHookName:
              triggerHooks0(
                `${logicGatePathRoot}${pathSeparator}${hook.gateId}`,
              );
              break;

            case conditionalBlockHookName:
              (() => {
                let computedValue = newValue

                if (path.startsWith(`${logicGatePathRoot}${pathSeparator}`)) {
                  const gateId = path.replace(`${logicGatePathRoot}${pathSeparator}`, '')
                  computedValue = this.getLogicGateValue({ gate: this.#logicGates[gateId] });
                }

                const { invert, fn, inverse, hookMethod, blockData } = hook;

                const b = this.component.analyzeConditionValue(computedValue);

                let branch = document.querySelector(selector)
                  .getAttribute('branch');

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

                if (htmlFn) {
                  const blockData0 = clientUtils.deepClone(blockData);

                  const html = this.executeWithBlockData(
                    htmlFn,
                    blockData0,
                  )

                  document.querySelector(selector).innerHTML = html;
                  document.querySelector(selector).setAttribute('branch', branch)

                  if (hookMethod) {
                    const hook = this.component[hookMethod].bind(this.component);

                    hook({
                      node: document.querySelector(selector),
                      blockData: blockData0,
                      initial: false,
                    })
                  }
                }

              })();
              break;

            case eachBlockHookName:

              (() => {

                const { htmlWrapperCssClassname } = RootCtxRenderer;
                const { fn, inverse, hookMethod, canonicalPath, blockData } = hook;

                const hookList = [];

                const html = this.executeWithBlockData(
                  () => {
                    const computedValue = newValue;
                    let ret = "";

                    const len = computedValue ? computedValue.length || computedValue[mapSizeProperty] : -1;

                    if (len >= 0) {

                      this.component.blockData[canonicalPath] = {
                        length: len, index: -1,
                      };

                      for (let i = 0; i < len; i++) {

                        let markup = fn(this.handler);

                        const elementNodeId = clientUtils.randomString();
                        const key = this.component.getBlockData({ path: canonicalPath, dataVariable: '@key' });

                        markup = `<div id="${elementNodeId}" class="${htmlWrapperCssClassname}" key="${key}">
                                    ${markup}
                                  </div>`;

                        if (Array.isArray(computedValue)) {
                          this.component.backfillArrayChildBlocks(`${path}[${i}]`, elementNodeId);
                        }

                        hookList.push({
                          selector: `div[key='${key}']`,
                          blockData: clientUtils.deepClone(this.component.blockData)
                        });

                        ret += markup;
                      }

                      delete this.component.blockData[canonicalPath];

                    } else {
                      ret = inverse ? inverse(this.handler) : '';
                    }

                    return ret;
                  },
                  clientUtils.deepClone(blockData),
                )

                document.querySelector(selector).innerHTML = html;

                if (hookMethod) {
                  const hook = this.component[hookMethod].bind(this.component);

                  hookList.forEach(({ selector: k, blockData }) => {
                    hook({
                      node: document.querySelector(`${selector} > ${k}`),
                      blockData,
                      initial: false,
                    })
                  });
                }

              })();

              break;


            // Add attribute context - 
            // extensive work needs to be done above. First we need to
            // add data to dataPathHooks... that's not being done at the moment

          }
        });


    }

    triggerComponentHooks('beforeMount');

    triggerHooks0(fqPath, withParent);

    triggerComponentHooks('onMount');
  }

  /**
   * The general contract when calling this method is that the HTML node
   * representing the path: <parent[i]> will be detached from the DOM shortly
   * 
   * This function prunes hooks from the dynamic index <i> of the array <parent>
   */
  pruneHookIndex(parent, i) {
    const {
      dataPathRoot, pathSeparator, arrayChildBlockHookName, logicGatePathRoot
    } = RootProxy;

    const fqPath = `${dataPathRoot}${pathSeparator}${parent}[${i}]`;

    const hookList = Object.entries(this.#dataPathHooks)
      .filter(([k, v]) => k.startsWith(fqPath))

    // Also, add nested logicGates to <hookList>. The main reason we want to do
    // this is to clean up paticipants correlated to <fqPath>. Note: Doing this
    // will also reduce the number of invalid hooks that need to be pruned later. 

    hookList
      .forEach(([k, v]) => {
        v.forEach(({ type, path }) => {
          if (type == arrayChildBlockHookName && path.startsWith(logicGatePathRoot)) {
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

  offsetHookIndex(parent, i, j, len) {
    const {
      dataPathRoot, pathSeparator, arrayChildBlockHookName, logicGatePathPrefix,
    } = RootProxy;

    const toFqPath = (n) => `${dataPathRoot}${pathSeparator}${parent}[${n}]`

    const i_FqPath = toFqPath(i);
    const j_FqPath = toFqPath(j);

    assert(this.#dataPathHooks[i_FqPath]);
    assert(j < len);

    Object.entries(this.#dataPathHooks)
      .filter(([k, v]) => k.startsWith(i_FqPath))
      .forEach(([k, v]) => {

        const arr = v.filter(({ canonicalPath }) => clientUtils.isCanonicalArrayIndex(canonicalPath, parent));

        // Before, moving i to j, update associated blockData referenced in <arr>, if any
        arr
          .filter(({ type }) => type == arrayChildBlockHookName)
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

              if (o.index == j) {
                // This blockData was already updated. This usually happens when
                // multiple <arrayChildBlockHookName> entries exists for the same path
                return;
              }

              assert(o.type == 'array' && o.index === i);

              o.index = j;
              o.length = len;
            });
          });

        const p = k.replace(i_FqPath, j_FqPath);

        if (this.#dataPathHooks[p]) {
          arr.forEach(e => {
            this.#dataPathHooks[p].push(e);
          });
        } else {
          this.#dataPathHooks[p] = [
            ...arr,
          ]
        }
      });
  }

  simpleSetMutationHandler(obj, prop, newValue, changeSet) {

    const {
      dataPathRoot, pathSeparator, pathProperty, typeProperty, mapType, isMapProperty,
      mapKeyPrefix, isNullProperty, getMapWrapper, toFqPath, getDataVariables,
      addDataVariablesToObject,
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
          throw Error(`Invalid index: ${prop} for array: ${obj[pathProperty]}`);
        }
        break;
      case isMap:
        if (!prop || !prop.length || !['String', 'Number', 'Boolean'].includes(prop.constructor.name)) {
          throw Error(`Invalid key: ${prop} for map: ${obj[pathProperty]}`);
        }
        if (!prop.startsWith(mapKeyPrefix)) {
          prop = `${mapKeyPrefix}${prop}`
        }
      default:
        if (!prop || !prop.length || prop.constructor.name !== 'String') {
          throw Error(`Invalid key: ${prop} for object: ${obj[pathProperty]}`);
        }











        if (prop.startsWith('@')) {

          // Meta properties can only be modified in privilegedMode
          if (this.component.isInitialized() && !RootProxy.#isPriviledgedMode()) {
            throw Error(`Permission denied to modify ${prop}`);
          }
          return obj[prop] = newValue;
        }

        break;
    }

    const oldValue = obj[prop];

    if (oldValue === undefined) {
      assert(
        isArray || isMap,

        // In toCanonicalObject(...), we always default missing object properties to null,
        // so oldValue === undefined it means that <prop> is invalid
        `${parent ? `[${parent}] ` : ''}Property ${prop} does not exist`
      );
    }

    if (oldValue && oldValue[isNullProperty]) {
      oldValue = null;
    }

    if (oldValue === newValue) {
      this.component.logger.warn(`[${fqPath}] oldValue === newValue, returning`);
      return false;
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





      throw Error(`Path: ${fqPath} cannot be mutated`);
    }

    if (!this.#dataPathHooks[fqPath]) {

      // Notice that we are doing this check, after we check if
      // oldValue is a component, not before. This is because if
      // we do it before, this error will be thrown if <fqPath>
      // resolved to a component (for components, we do not
      // add an entry to dataPathHooks), which will not provide
      // a descriptive error

      throw Error(`Unknown path: ${fqPath}`);
    }

    // Perform schema validation for <newValue>
    if (newValue != undefined) {
      const validate = (() => {
        try {
          return this.component.constructor.ajv.getSchema(
            `#/definitions/${clientUtils.toCanonicalPath(fqPath0)}`
          )
        } catch (e) {
          throw Error(`Unknown path: ${fqPath}`);
        }
      })();

      if (!validate(newValue)) {
        throw Error(`${fqPath} could not be mutated due to schema mismatch`);
      }
    }

    // This will be used to determine for which paths we need to trigger hooks for. 
    // Note: entries added here should not include dataPathPrefix
    changeSet.push(fqPath0);

    const collDef = this.getCollectionDefinition(parent);

    // This is used to store changeset information
    // Note: It is collected before the collection is modified
    const collInfo = (() => {

      if (!collDef) return false;

      const o = {
        ...clientUtils.getCollectionIndexAndLength(obj, prop),
        type: collDef.collectionType,
        prop,
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
        changeSet.push(toFqPath({ parent, prop: 'length' }));
      }

      if (removedNonLastElement) {
        // Add all indexes after the <index> to <changeSet>

        // <i < length - 1> because after modification, array length will be less by 1
        for (let i = index + 1; i < length - 1; i++) {
          changeSet.push(
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
          changeSet.push(
            toFqPath({ parent, prop: i })
          );
        }
      }

      return o;
    })();

    const setValue = (object, key, value) => {
      object[key] = value;
    }

    if (newValue != undefined) {

      if (typeof newValue == 'object') {

        if (collDef) {
          addDataVariablesToObject(
            newValue,
            this.getDataVariablesForSimpleSetOperation(collInfo),
          )
        }

        this.toCanonicalObject({
          path: fqPath,
          obj: newValue
        });

        if (newValue[typeProperty] == mapType) {
          newValue = getMapWrapper(newValue);
        }

        newValue = this.getObserverProxy(newValue)
      }

      setValue(obj, prop, newValue);

    } else {

      if (collDef) {

        switch (true) {

          case newValue === undefined:
            if (Array.isArray(obj)) {
              obj.splice(prop, 1);

              for (let i = prop; i < obj.length - 1; i++) {
                this.pruneHookIndex(parent, i);
                this.offsetHookIndex(parent, i + 1, i, obj.length);
              }
              this.pruneHookIndex(parent, obj.length - 1);

            } else {
              delete obj[prop];
            }

            // We expect that the size of <obj> should reduce by 1 since we last checked
            assert(collInfo.length - 1 == clientUtils.getCollectionLength(obj));

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

      } else {

        if (newValue === undefined) {
          // Object properties cannot have "undefined", change to null
          newValue = null;
        }

        setValue(obj, prop, newValue);
      }
    }

    return changeSet;
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

      this.toCanonicalObject({
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

    return new Proxy(object, {

      deleteProperty: (obj, prop) => {

        if (prop.startsWith('@')) {

          // Meta properties can only be modified in privilegedMode
          if (this.component.isInitialized() && !RootProxy.#isPriviledgedMode()) {
            throw Error(`Permission denied to modify ${prop}`);
          }

          return delete obj[prop];
        }

        return this.simpleSetMutationHandler(obj, prop, undefined)
      },

      get: (obj, prop) => {




      },

      set: (obj, prop, newValue) => {

        if (this.processingDataUpdate) {
          // Todo: This is not correct, we should be able to update as long as there is no
          // intersection in the paths, fix

          throw Error(`Cannot update '${parent}' while another update is in progress`);
        }

        this.processingDataUpdate = true;

        this.simpleSetMutationHandler(obj, prop, newValue)


        // Investigate whether handlebars runtime functions are cloneable?
        // Todo: Snapshot hooks




        // dataPathHooks[changeSet[0]], set withParent=true

        this.triggerHooks(fqPath, obj, newValue);






        // Todo:
        // Run other hooks, set withParent = false

        // Object.entries(dataPathHooks)
        //        .filter(.... startsWith changeSet[i] && notEqualTo changeSet[0]  ...)
        //        .sort(.... use clientUtils.getCanonicalSegments for short paths first ...)

        // Note: we need to intelligently handle "scalar dataVariable" paths, this can be done by
        // checking if collDef.type exists and is a literal... If it is, we can calculate the value
        // by looking at the last segment, taking the collection length into consideration


        // We will definitely run into the problem of undefineds, the below may help
        try {
          // trigger exec path
        } catch (e) {
          if (e.name == 'TypeError' && e.message.startsWith('Cannot read properties of undefined')) {
            // Make value <undefined>

            // Use this same strategy to retrieve the <parentObj> that will be passed in to triggerHooks
          } else {
            throw e;
          }
        }

        this.processingDataUpdate = false;

        return true;
      },
    });
  }

  getObjectDefiniton(path) {

    const defPrefx = '#/definitions/';
    const { schemaDefinitions } = this.component.constructor;

    let def = schemaDefinitions[
      path.length ?
        clientUtils.toCanonicalPath(path) :
        this.component.getComponentName()
    ];

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

    const canonicalPath = global.clientUtils.toCanonicalPath(path);
    const { additionalProperties } = this.component.constructor.schemaDefinitions[canonicalPath];

    return additionalProperties ? {
      collectionType: 'map',
      ...additionalProperties,
    } : false;
  }

  getArrayDefinition(path) {
    if (!path.length) return false;

    const canonicalPath = global.clientUtils.toCanonicalPath(path);
    const { items } = this.component.constructor.schemaDefinitions[canonicalPath];

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

    Object.defineProperty(obj, firstProperty, { value: first, enumerable: false });
    Object.defineProperty(obj, lastProperty, { value: last, enumerable: false });
    Object.defineProperty(obj, keyProperty, { value: key, enumerable: false });
    Object.defineProperty(obj, indexProperty, { value: index, enumerable: false });
    Object.defineProperty(obj, randomProperty, { value: random, enumerable: false });
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

  createHooksArray() {
    return [];
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
      this.#dataPathHooks[
        `${toFqPath({ parent: k, prop: o })}`
      ] = this.createHooksArray();
    })

    this.#dataPathHooks[k] = this.createHooksArray();
  }

  toCanonicalObject({ path, obj }) {

    const {
      dataPathRoot, pathSeparator, pathProperty, typeProperty, mapType, mapKeyPrefix,
      isNullProperty, mapKeyPrefixRegex, getMapWrapper, addDataVariables, getDataVariables,
      getReservedObjectKeys, toFqPath, getReservedMapKeys, createNullObject,
    } = RootProxy;

    const reservedObjectKeys = getReservedObjectKeys();

    const isArray = Array.isArray(obj);

    if (!isArray) {
      Object.keys(obj).forEach(k => {
        if (reservedObjectKeys.includes(k)) {
          throw Error(`[${path}] An object cannot contain the key: ${k}`);
        }
      })
    }

    Object.defineProperty(obj, pathProperty, { value: path, configurable: false, writable: false, enumerable: false });

    this.#dataPathHooks[`${dataPathRoot}${pathSeparator}${path}`] = this.createHooksArray();

    switch (true) {
      case !!this.getArrayDefinition(path):
        assert(obj.constructor.name == 'Array');
        break;

      case !!this.getMapDefinition(path):
        assert(obj.constructor.name == 'Object', `${path}, ${obj.constructor.name}`);

        const reservedMapKeys = getReservedMapKeys();

        // If this is a map path, add set @type to Map, and trasform the keys
        // to start with the map key prefix: $_

        for (const k of Object.keys(obj).filter(k => !k.startsWith('@'))) {

          if (reservedMapKeys.includes(k)) {
            throw Error(`[${path}] A map cannot contain the key: ${k}`);
          }

          obj[`${mapKeyPrefix}${k}`] = obj[k];
          delete obj[k];
        }

        // Note: this meta property is only used temporarily and it will be pruned
        // later by getMapWrapper(...)
        Object.defineProperty(obj, typeProperty, { value: mapType, enumerable: false });

        break;

      default:

        assert(obj.constructor.name == 'Object');

        const def = this.getObjectDefiniton(path);

        const keys = Object.keys(obj);

        // Ensure that all keys are valid properties defined in the schema
        keys.forEach(k => {
          if (!def.required.includes(k)) {
            throw Error(`[${path}] Unknown property: ${k}`);
          }
        });

        // Add missing properties
        def.required
          .filter(p => !p.startsWith('@') && !keys.includes(p))
          .forEach(p => {
            obj[p] = (() => {
              // Assign a default value based on the data type
              const { type } = def.properties[p];

              if (!type || ['array', 'string', 'object'].includes(type[0])) {
                return null;
              }

              switch (type[0]) {
                case 'number':
                  return 0;
                case 'boolean':
                  return false;
                default:
                  throw Error(`[${path}] Unknown type: ${type[0]} for propery "${p}"`);
              }
            })();
          });
        break;
    }

    const isMap = !isArray && obj[typeProperty] === mapType;

    // Todo: Remove
    Object.keys(obj).forEach(k => {
      assert(![typeProperty, pathProperty, isNullProperty].includes(k));
    });

    const keys = [
      ...Object.keys(obj),
      // Since our data variables are non-enumerable, we want to eagerly add them here.
      // If obj has no data variables defined on it, this will have no effect, as it will
      // be undefined and dataPathHooks will not be updated
      ...getDataVariables()
    ];

    const isCollection = this.getCollectionDefinition(path)

    if (isMap) {
      this.#dataPathHooks[`${dataPathRoot}${pathSeparator}${path}.length`] = this.createHooksArray();
    }

    for (let i = 0; i < keys.length; i++) {
      const prop = keys[i];

      assert(obj[prop] !== undefined);

      // If property is null, and this is a collection of objects, 
      if (obj[prop] === null && isCollection && isCollection.$ref) {
        obj[prop] = createNullObject();
      }

      const p = toFqPath({ isArray, isMap, parent: path, prop });

      if (isMap) {

        switch (true) {
          case obj[prop] !== Object(obj[prop]):
          case obj[prop] instanceof BaseComponent:
            this.addHookForScalarCollectionMember(p)
            break;

          default:
            assert(obj[prop] === Object(obj[prop]));
            // Inject data variables, if this is a map of objects
            addDataVariables(
              obj[prop],
              i == 0,
              i == keys.length - 1,
              prop.replace(mapKeyPrefixRegex, ''),
              i,
              global.clientUtils.randomString()
            )
            break;
        }
      }

      if (isArray) {
        assert(global.clientUtils.isNumber(prop) || prop.startsWith('@'));
      }

      const isEmpty = obj[prop] === null;
      // || obj[prop] === undefined;

      // eslint-disable-next-line default-case
      switch (true) {
        case !isEmpty && obj[prop].constructor.name === 'Object':
          this.toCanonicalObject({ path: p, obj: obj[prop] });

          if (obj[prop][typeProperty] == mapType) {
            obj[prop] = getMapWrapper(obj[prop]);
          }

          obj[prop] = this.getObserverProxy(obj[prop]);

          break;

        case !isEmpty && obj[prop].constructor.name === 'Array':
          // eslint-disable-next-line no-plusplus

          const isCollection = this.getCollectionDefinition(p);

          for (let i = 0; i < obj[prop].length; i++) {

            const o = obj[prop][i];

            assert(o !== undefined);

            // If property is null, and this is a collection of objects, 
            if (o === null && isCollection.$ref) {
              o = obj[prop][i] = createNullObject();
            }

            switch (true) {

              case o !== Object(o):
              case o instanceof BaseComponent:
                this.addHookForScalarCollectionMember(`${p}[${i}]`)
                break;

              default:
                assert(o === Object(o));

                // Inject data variables
                addDataVariables(
                  o,
                  i == 0,
                  i == obj[prop].length - 1,
                  i,
                  i,
                  global.clientUtils.randomString()
                )

                this.toCanonicalObject({ path: `${p}[${i}]`, obj: o });

                if (o[typeProperty] == mapType) {
                  obj[prop][i] = getMapWrapper(o);
                }

                obj[prop][i] = this.getObserverProxy(o);

                break;
            }
          }

          Object.defineProperty(obj[prop], pathProperty, { value: p, configurable: false, writable: false });

          this.#dataPathHooks[`${dataPathRoot}${pathSeparator}${p}`] = this.createHooksArray();
          this.#dataPathHooks[`${dataPathRoot}${pathSeparator}${p}.length`] = this.createHooksArray();

          obj[prop] = this.getObserverProxy(obj[prop]);

          break;

        // case obj[prop] !== undefined:
        default:
          this.#dataPathHooks[`${dataPathRoot}${pathSeparator}${p}`] = this.createHooksArray();
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

          case prop == isMapProperty:
            return true;

          case prop == mapSizeProperty:
            return () => Object.keys(obj).length;

          case prop == mapKeysProperty:
            return () => Reflect.ownKeys(obj)
              .map(k => {
                if (typeof k != 'symbol') {
                  k = k.replace(mapKeyPrefix, '')
                }
                return k;
              });

          default:
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

        // Note: according to https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy/set,
        // proxy.set() should return a boolean value, hence instead of returning <newValue> which
        // is the default behaviour, we will always return true

        return true;
      }
    })
  }

}

module.exports = RootProxy;
