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

  // Todo: Rename from HookName to HookType

  static conditionalBlockHookName = 'conditionalBlock';

  static arrayBlockHookName = 'arrayBlock';

  static textNodeHookName = 'textNode';

  static gateParticipantHookName = 'gateParticipant';

  static validateInputSchema = false;

  static globalsBasePath = 'globals';

  #dataPathHooks;

  #logicGates;

  static #privilegedMode = false;

  constructor({ component }) {
    this.component = component;
    this.handler = this.createObjectProxy();
    this.#dataPathHooks = this.createImmutableObject();
    this.#logicGates = {};
  }

  createImmutableObject() {
    return new Proxy({}, {
      set: function (object, key, value) {
        // Only set - if not set already
        return object[key] === undefined ? object[key] = value : true;
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

  static getBooleanExpression(operator) {
    switch (operator) {
      case 'LT':
        return '<';
      case 'LTE':
        return '<=';
      case 'GT':
        return '>';
      case 'GTE':
        return '>=';
      case 'EQ':
        return '==';
      case 'NEQ':
        return '!=';
    }
  }

  getLogicGateValue({ gateId }) {

    const { getBooleanExpression: boolExpr } = RootProxy;

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

    const gate = this.#logicGates[gateId];

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

        if (expr.operator != 'INCLUDES') {
          return `${left} ${boolExpr(expr.operator)} ${right}`
        } else {
          // Todo: maintain original, so we can throw a descriptive error
          return `${left}.includes(${right})`
        }
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

      while (item.type == LOGIC_GATE) {
        const data = gate.table[item.original];
        item = analyzeCondition(data.condition, data.invert) ? data.left : data.right;
      }

      return getValue(item);
    }

    // Todo: Only replace blockData if a sub expression exists in
    // the logic gate
    const blockDataSnapshot = this.component.blockData;

    this.component.blockData = global.clientUtils.deepClone(gate.blockData);

    const value = analyzeGate({
      type: LOGIC_GATE,
      original: 0,
    });

    this.component.blockData = blockDataSnapshot;

    return value;
  }

  resolveLogicPath({ prop }) {

    const {
      dataPathRoot, logicGatePathRoot,
      pathSeparator, gateParticipantHookName, globalsBasePath
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

    const MUST_GRP = 'MustacheGroup';
    const PATH_EXPR = 'PathExpression';
    const BOOL_EXPR = 'BooleanExpression';

    const gate = this.component.getLogicGates()[prop];

    /**
     * If this is a PathExpression, convert from a canonical path to
     * it's executable path
     */
    const toExecutablePath = (item) => {
      const { type, original, left, right } = item;

      switch (type) {
        case PATH_EXPR:
          item.original = this.component.getExecPath({
            fqPath: original.replace(`${dataPathRoot}${pathSeparator}`, ''),
          });
          break;
        case BOOL_EXPR:
          item.left = toExecutablePath(left);
          item.right = toExecutablePath(right);
          break;
        case MUST_GRP:
          item.items = item.items.map(toExecutablePath);
          break;
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
      .filter(p =>
        // Exclude synthetic functions
        this.component.isSynthetic(p.replace('this.', ''))
      )
      .map(p => {

        // Data Path
        p = p.replace(
          `${this.component.getDataBasePath()}.`,
          `${dataPathRoot}${pathSeparator}`
        );

        // Global Variable
        p = p.replace(
          `${this.component.getGlobalsBasePath()}.`,
          `${dataPathRoot}${pathSeparator}${globalsBasePath}.`
        );

        // Data Variables
        const dataVariable = p.match(/(?<=\[')@\w+(?='\]$)/g);
        if (dataVariable) {
          p = p.replace(`['${dataVariable[0]}']`, `.${dataVariable[0]}`);
        }
        return p;
      })
      .forEach(p => {
        this.#dataPathHooks[p].push({
          type: gateParticipantHookName,
          gateId,
        });
      });

    gate.blockData = global.clientUtils.deepClone(this.component.blockData);

    this.#logicGates[gateId] = gate;
    const path = `${logicGatePathRoot}${pathSeparator}${gateId}`;

    this.#dataPathHooks[path] = [];

    const v = this.getLogicGateValue({ gateId });

    const rawValue = this.getRawValueWrapper(v);

    const value = this.getValue(v);

    if (includePath) {
      return {
        path,
        value: isRawReturn ? rawValue : value,
      };
    } else {
      return isRawReturn ? rawValue : value;
    }
  }

  resolveDataPath({ prop, isRawReturn = false }) {

    const { literalPrefix, emptyString, rawDataPrefix } = RootProxy;

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

    const includePath = prop.endsWith('!');

    if (includePath) {
      // eslint-disable-next-line no-param-reassign
      prop = prop.replace(/\!$/g, '');
    }

    isRawReturn = isRawReturn || prop.endsWith('!');

    if (isRawReturn) {
      // eslint-disable-next-line no-param-reassign
      prop = prop.replace(/\!$/g, '');
    }

    // eslint-disable-next-line no-case-declarations
    const v = this.component
      .getPathValue({ path: prop, includePath });

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

  createObjectProxy() {
    const {
      dataPathRoot, dataPathPrefix, logicGatePathPrefix,
      syntheticMethodPrefix, rawDataPrefix, isRootPath
    } = RootProxy;
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

            // At least access the context, so that our array proxy
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

            // At least access the context, so that our array proxy
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

  static create(component) {

    const { validateInputSchema } = RootProxy;
    const proxy = new RootProxy({ component });

    proxy.component.proxyInstance = proxy;
    proxy.component.rootProxy = proxy.handler;

    // On compile-time, it would be too early for <resolver>
    // to be set, so let's use <loadable> instead, since we know
    // it will be false at compile-time and true at runtime
    if (proxy.component.loadable()) {

      if (!component.constructor.schemaDefinitions) {
        // register input schema
        proxy.withSchema(proxy.component.getInputSchema());
      }

      // Add our observer, to orchestrate data binding operations
      proxy.addDataObserver();

      if (validateInputSchema && component.validateInput()) {
        // perform input validation
        proxy.validateInput();
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

        if (definition.$ref) {
          definition = definitions[definition.$ref.replace(defPrefx, emptyString)];
        }

        // Add definition id
        definition.$id = `${defPrefx}${id}`;

        if (definition.isComponent) {
          // A component instance will be validated against
          // this, so simply set additionalProperties to true
          definition.additionalProperties = true;
        }

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
                      def.enum = [
                        ...self.appContext.enums[
                        definitions[refName].originalName
                        ],
                        null
                      ];

                      delete def.$ref;
                      break;

                    // Reference to an external component
                    case definitions[refName].isComponent:
                    // Reference to the current component
                    case refName == this.component.getComponentName():

                      def.type = ['object', 'null']
                      def.additionalProperties = true;

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

    this.component.constructor.schemaDefinitions = definitions;

    this.component.constructor.ajv = new ajv7.default({
      schemas: Object.values(definitions),
      allErrors: true,
      allowUnionTypes: true,
      inlineRefs: false
    });
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

  addDataObserver() {

    const { dataPathRoot, pathSeparator, globalsBasePath } = RootProxy;

    this.toCanonicalObject({ path: '', obj: this.component.getInput() });

    this.component.setInput(
      this.getObserverProxy(this.component.getInput())
    );

    // Add globals to dataPathHooks 
    // Even though this is registered here, global variables are generally never 
    // expected to change
    Object.keys(this.getGlobalVariables())
      .forEach(variable => {
        this.#dataPathHooks[[dataPathRoot, globalsBasePath, variable].join(pathSeparator)] = [];
      });


    // when whole object are removed, via (array or object) operations, also, we need
    // do a bulk remove on this.#dataPaths as well
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

  static createDataChangeEvent({ path, oldValue, newValue }) {
    return class DataChangeEvent extends CustomEvent {
      constructor() {
        super('DataChangeEvent', {
          detail: { path, oldValue, newValue }
        });
      }
    };
  }

  getObserverProxy(object) {
    const {
      dataPathRoot, logicGatePathRoot, pathSeparator, textNodeHookName,
      gateParticipantHookName, pathProperty, typeProperty, mapType,
      getUserGlobals, getMapWrapper, createDataChangeEvent
    } = RootProxy;
    const { getDataVariables } = RootCtxRenderer;

    // Todo: If typeof newValue == "object", the object reference
    // assigned to obj[prop] will be different than the original
    // one passed in due to the re-assignment that happen along the way
    // We need to inform the developer
    // so that he/she can be aware that in such scenario any change
    // made to newValue independently even after the assignment will
    // not affect obj[prop]

    const set = (obj, prop, newValue) => {

      if (prop.startsWith('@')) {

        // Meta properties can only be modified in privilegedMode
        if (this.component.isInitialized() && !RootProxy.#isPriviledgedMode()) {
          throw Error(`Permission denied to modify ${prop}`);
        }

        return obj[prop] = newValue;
      }

      const parent = obj['@path'];

      if (obj[prop] == undefined) {
        throw Error(`${parent ? `[${parent}] ` : ''}Property ${prop} does not exist`);
      }

      const isArray = obj.constructor.name === 'Array';

      if (isArray &&
        !global.clientUtils.isNumber(prop) &&
        ![...getDataVariables(), pathProperty].includes(prop)
      ) {
        throw Error(`Invalid index: ${prop} for array: ${obj['@path']}`);
      }

      // What happens when newValue == undefined
      // Can newValue be null in all scenarios?

      const fqPath = `${dataPathRoot}${pathSeparator}${isArray ?
        `${parent}[${prop}]` :
        `${parent.length ? `${parent}.` : ''}${prop}`
        }`;

      const oldValue = obj[prop];

      if (oldValue instanceof BaseComponent) {
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

      const triggerHooks = path => {

        const customHook = this.component.hooks()[path];

        if (customHook && customHook instanceof Function) {
          const evt = createDataChangeEvent({ path, oldValue, newValue });

          customHook(evt);

          if (evt.defaultPrevented) {
            return;
          }
        }

        const hooks = this.#dataPathHooks[path];

        hooks.forEach(hook => {

          let nodeValue = newValue

          if (path.startsWith(`${logicGatePathRoot}${pathSeparator}`)) {
            const gateId = path.replace(`${logicGatePathRoot}${pathSeparator}`, '')
            nodeValue = this.getLogicGateValue({ gateId });
          }

          switch (hook.type) {

            case textNodeHookName:
              document.getElementById(hook.nodeId).innerHTML = typeof nodeValue == 'string' ? nodeValue : JSON.stringify(nodeValue);
              break;

            case gateParticipantHookName:
              triggerHooks(`${logicGatePathRoot}${pathSeparator}${hook.gateId}`);
              break;

            // Todo: Add other hook types

          }
        });
      }

      const reloadPath = path => {
        // Because of babel optimizations, I need to call this outside
        // the eval string to avoid getting an "undefined" error at runtime
        const component = this.component;
        const p = ['component.getInput()', path].join('.')
        return eval(`${p} = ${p}`)
      };

      triggerHooks(fqPath);

      const isNonPrimitive = (() => {
        const sPath = global.clientUtils.toCanonicalPath(fqPath);
        const def = this.component.constructor.schemaDefinitions[sPath];
        return def.type == 'object' || def.type == 'array'
      })();

      const getValidator = () => {
        try {
          return this.component.constructor.ajv.getSchema(
            global.clientUtils.toCanonicalPath(fqPath)
          )
        } catch (e) {
          throw Error(`Unknown path: ${fqPath}`);
        }
      }


      if (newValue != null && oldValue !== newValue) {

        const validate = getValidator();

        if (!validate(newValue)) {
          throw Error(`${fqPath} could not be mutated due to schema mismatch`);
        }

        if (typeof newValue == 'object') {

          if (this.isCollectionPath(parent)) {

            // If parent is a collection (array or map),
            // Add data variables (remember to make them non-enumerable)

            // Note: When we need to modify any data variables
            // remember to set RootProxy.#privilegedMode to true
          }

          this.toCanonicalObject({
            path: fqPath,
            obj: newValue
          });

          newValue = this.getObserverProxy(newValue)

          if (newValue[typeProperty] == mapType) {
            newValue = getMapWrapper(newValue);
          }
        }

        // If parent is a collection (array or map), we need to update blockData
      }

      obj[prop] = newValue;

      // TODO: 
      // * Implement hook for arrays. @random

      // * Implement hook for maps

      // * Implement hook for conditionals

      // Reload children, if applicable
      if (isNonPrimitive) {

        const childPaths = Object.keys(this.#dataPathHooks)
          .filter(p => p !== fqPath && p.startsWith(`${fqPath}`));

        if (newValue != null) {
          childPaths.forEach(p => reloadPath(p.replace(`${dataPathRoot}${pathSeparator}`, '')));
        } else {

          // Todo: for each child path, get all hook types, and update the dom accordingly
          // For example: In the case of textNode, we need to set .innerHTML to String "null"
        }
      }

      // Reload parent, if applicable
      if (parent.length) {
        reloadPath(parent);
      }

      return true;
    }

    return new Proxy(object, {
      deleteProperty: (obj, prop) => {

        if (prop.startsWith('@')) {

          // Meta properties can only be modified in privilegedMode
          if (this.component.isInitialized() && !RootProxy.#isPriviledgedMode()) {
            throw Error(`Permission denied to modify ${prop}`);
          }

          return delete obj[prop];
        }

        return set(obj, prop, undefined)
      },
      set
    });
  }

  getObjectDefiniton(path) {

    const defPrefx = '#/definitions/';
    const { schemaDefinitions } = this.component.constructor;

    let def = schemaDefinitions[
      path.length ?
        global.clientUtils.toCanonicalPath(path) :
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

  isMapPath(path) {
    return path.length &&
      !!this.component.constructor.schemaDefinitions[
        global.clientUtils.toCanonicalPath(path)
      ].additionalProperties;
  }

  isArrayPath(path) {
    const canonicalPath = global.clientUtils.toCanonicalPath(path);
    return path.length &&
      !!this.component.constructor.schemaDefinitions[canonicalPath].items
  }

  isCollectionPath(path) {
    return this.isMapPath(path) || this.isArrayPath(path);
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
    Recursively add @path to each object and array, 
    and also update this.#dataPaths accordingly
  */
  toCanonicalObject({ path, obj }) {

    const {
      dataPathRoot, pathSeparator, pathProperty, typeProperty, mapType, mapKeyPrefix,
      getMapWrapper, addDataVariables, getDataVariables
    } = RootProxy;

    const isArray = Array.isArray(obj);

    Object.defineProperty(obj, pathProperty, { value: path, configurable: false, writable: false, enumerable: false });

    this.#dataPathHooks[`${dataPathRoot}${pathSeparator}${path}`] = [];

    switch (true) {
      case this.isArrayPath(path):
        assert(obj.constructor.name == 'Array');
        break;

      case this.isMapPath(path):

        assert(obj.constructor.name == 'Object');

        // If this is a map path, add set @type to Map, and trasform the keys
        // to start with the map key prefix: $_

        for (const k of Object.keys(obj).filter(k => !k.startsWith('@'))) {
          obj[`${mapKeyPrefix}${k}`] = obj[k];
          delete obj[k];
        }

        // Note: this meta property is only used temporarily and it will be pruned
        // later by getMapWrapper(...)
        obj[typeProperty] = mapType;

        break;
      default:
        assert(obj.constructor.name == 'Object');

        const def = this.getObjectDefiniton(path);

        // Add missing properties and default to null
        const keys = Object.keys(obj);
        def.required
          .filter(p => !p.startsWith('@') && !keys.includes(p))
          .forEach(p => {
            obj[p] = null;
          });
        break;
    }

    const isMap = !isArray && obj[typeProperty] === mapType;

    const keys = [
      ...Object.keys(obj)
        .filter(k => k != typeProperty && k != pathProperty),
      // Since our data variables are non-enumerable, we want to eagerly add them here.
      // If obj has no data variables defined on it, this will have no effect, as it will
      // be undefined and dataPathHooks will not be updated
      ...getDataVariables()
    ];

    for (let i = 0; i < keys.length; i++) {
      const prop = keys[i];

      if (isMap && obj[prop] === Object(obj[prop])) {
        // Inject data variables
        addDataVariables(
          obj[prop],
          i == 0,
          i == keys.length - 1,
          prop
            // Remove $_ prefixes for map keys, if applicable
            .replace(/^\$_/g, ''),
          i,
          global.clientUtils.randomString()
        )
      }

      if (isArray) {
        assert(global.clientUtils.isNumber(prop));
      }

      const p = `${path}${isArray ? `[${prop}]` : `${path.length ? '.' : ''}${prop}`}`;
      const isEmpty = obj[prop] == null || obj[prop] == undefined;

      // eslint-disable-next-line default-case
      switch (true) {
        case !isEmpty && obj[prop].constructor.name === 'Object':
          this.toCanonicalObject({ path: p, obj: obj[prop] });

          obj[prop] = this.getObserverProxy(obj[prop]);

          if (obj[prop][typeProperty] == mapType) {
            obj[prop] = getMapWrapper(obj[prop]);
          }

          break;

        case !isEmpty && obj[prop].constructor.name === 'Array':
          // eslint-disable-next-line no-plusplus
          for (let i = 0; i < obj[prop].length; i++) {

            if (obj[prop][i] === Object(obj[prop][i])) {

              const o = obj[prop][i];

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
              obj[prop][i] = this.getObserverProxy(o);

              if (obj[prop][i][typeProperty] == mapType) {
                obj[prop][i] = getMapWrapper(obj[prop][i]);
              }

            } else {
              this.#dataPathHooks[`${dataPathRoot}${pathSeparator}${p}[${i}]`] = [];
            }
          }

          Object.defineProperty(obj[prop], pathProperty, { value: p, configurable: false, writable: false });
          this.#dataPathHooks[`${dataPathRoot}${pathSeparator}${p}`] = [];
          this.#dataPathHooks[`${dataPathRoot}${pathSeparator}${p}.length`] = [];

          obj[prop] = this.getObserverProxy(obj[prop]);

          break;

        case obj[prop] !== undefined:
          this.#dataPathHooks[`${dataPathRoot}${pathSeparator}${p}`] = [];
          break;
      }
    }

    return obj;
  }

  static getMapWrapper(obj) {
    const { typeProperty, mapType, mapKeyPrefix } = RootProxy;

    assert(obj[typeProperty] == mapType)

    // At this point, obj is already wrapped with our observer proxy, so
    // we need to run in a privileged context, before we delete this meta property
    RootProxy.#runPriviledged(() => {
      delete obj[typeProperty];
    })

    return new Proxy(obj, {
      get: (obj, prop) => {

        switch (true) {

          case !!Object.getPrototypeOf(obj)[prop]:
            return obj[prop];

          default:
            // Props can start with "@" if <obj> is also a collection
            // child, and the user wants to access data variable(s)
            return obj[
              `${prop.startsWith('@') || prop.startsWith(mapKeyPrefix)
                ? '' : mapKeyPrefix}${prop}`
            ]
        }
      },
      set: (obj, prop, newValue) => {

        assert(!Object.getPrototypeOf(obj)[prop]);

        // Props can start with "@" if <obj> is also a collection
        // child, and the user wants to update data variable(s)
        return obj[
          `${prop.startsWith('@') || prop.startsWith(mapKeyPrefix)
            ? '' : mapKeyPrefix}${prop}`
        ] = newValue;
      }
    })
  }

}

module.exports = RootProxy;
