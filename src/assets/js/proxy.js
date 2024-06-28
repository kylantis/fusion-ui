/* eslint-disable no-case-declarations */

// Todo: Make all members (that are applicable) private
class RootProxy {

  // eslint-disable-next-line no-useless-escape
  static syntheticMethodPrefix = 's$_';

  static globalsBasePath = 'globals';

  static dataPathRoot = 'data';

  static pathSeparator = '__';

  static dataPathPrefix = RegExp(`^${RootProxy.dataPathRoot}${RootProxy.pathSeparator}`);


  // Note: This variable must always match the one defined in /assets/js/lib/indexed_db.js

  static logicGatePathRoot = 'lg';

  static logicGatePathPrefix = RegExp(`^${RootProxy.logicGatePathRoot}${RootProxy.pathSeparator}`);

  static globalsPathPrefix = RegExp(`^${RootProxy.globalsBasePath}${RootProxy.pathSeparator}`);

  static rawDataPrefix = 'r$_';

  static literalPrefix = 'l$_';

  static emptyObject = {};

  static pathProperty = '@path';

  static firstProperty = '@first';

  static lastProperty = '@last';

  static keyProperty = '@key';

  static indexProperty = '@index';

  static randomProperty = '@random';

  static typeProperty = '@type';

  static prunedProperty = '@pruned';

  static literalType = 'Literal';

  static arrayType = 'Array';

  static objectType = 'Object';

  static mapType = 'Map';

  static componentRefType = 'componentRef';

  static mapKeyPrefix = '$_';

  static mapKeyPrefixRegex = /^\$_/g;


  static predicateHookType = 'predicate';

  static conditionalBlockHookType = 'conditionalBlock';

  static eachBlockHookType = 'eachBlock';

  static textNodeHookType = 'textNode';

  static gateParticipantHookType = 'gateParticipant';

  static nodeAttributeHookType = 'nodeAttribute';

  static nodeAttributeKeyHookType = 'nodeAttributeKey';

  static nodeAttributeValueHookType = 'nodeAttributeValue';

  static collChildSetHookType = 'collChildSet';

  static collChildDetachHookType = 'collChildDetach';

  static arraySpliceHookType = 'arraySplice';

  static inlineComponentHookType = 'inlineComponent';


  static isMapProperty = '$isMap';

  static mapSizeProperty = 'size';

  static mapKeysProperty = 'keys';

  static mapIndexOfProperty = 'indexOf';

  static parentRefProperty = '@parentRef';

  static lenientExceptionMsgPattern = /^Cannot read properties of (undefined|null)/g;

  static filter_EQ = 'eq';

  static filter_GTE_COLL_MEMBER = 'gte_coll_member';

  static filter_GTE_OBJ_MEMBER = 'gte_obj_member';

  static #privilegedMode = false;

  static pathSchemaDefPrefix = '__pathSchema';

  static mutationType_SET = 'set';

  static mutationType_SPLICE = 'splice';

  static mutationType_DELETE = 'delete';



  static INDEXEDDB_PUT_TASK = 'put';

  static INDEXEDDB_DELETE_TASK = 'delete';

  static UPDATE_COLL_CHILD_TASK = 'updateCollChild';

  static PRUNE_COLL_CHILD_TASK = 'pruneCollChild';


  static RESOLVED_PROMISE = Promise.resolve();

  static #workerCalls = {};


  #collChildHookUpdatePromise = RootProxy.RESOLVED_PROMISE;


  #discreteMode = false;

  #randomValues;

  #openHandles = [];

  #pathMetadata = {};

  #dbInfo;


  constructor({ component }) {
    this.component = component;
    this.handler = this.createObjectProxy();

    this.#randomValues = this.#createRandomValuesObject();
  }

  getPathTrie() {
    const { constructor } = this.component;

    if (!constructor.pathTrie) {
      constructor.pathTrieNodeCache = {};

      constructor.pathTrie = new K_Trie(
        clientUtils.getAllSegments, constructor.pathTrieNodeCache
      );
    }
    return constructor.pathTrie;
  }

  #createRandomValuesObject() {
    return new Proxy({}, {
      get: (object, key) => {
        if (object[key] === undefined) {
          object[key] = this.component.randomString('random');
        }

        const o = object[key];
        assert(typeof o == 'string');

        return o;
      },
    })
  }

  doesPathMetadataExist(sPath, property) {
    const attrs = this.#pathMetadata[sPath];
    return attrs && (attrs[property] !== undefined);
  }

  addPathMetada(sPath, properties) {
    if (!this.#pathMetadata[sPath]) {
      this.#pathMetadata[sPath] = {};
    }

    Object.entries(properties).forEach(([k, v]) => {
      this.#pathMetadata[sPath][k] = v;
    });
  }

  getPathMetadata(sPath) {
    return this.#pathMetadata[sPath] || (this.#pathMetadata[sPath] = {});
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

  static async create(component) {
    const proxy = new RootProxy({ component });

    component.proxyInstance = proxy;
    component.rootProxy = proxy.handler;

    if (!self.appContext || !component.isLoadable0()) return;

    if (!proxy.getSchemaDefinitions()) {

      const schema = component.constructor.schema || (await self.appContext.fetch({
        url: `/components/${component.getAssetId()}/config.json`,
        asJson: true,
      })).schema;

      proxy.setSchemaDefinitions(schema);
    }

    const leafs = [];

    component.setInput(
      proxy.#getObserverProxy(
        proxy.#toCanonicalTree({ path: '', obj: component.getInput(), leafs })
      )
    );

    component.seal();

    component.once(
      'beforeRender', () => proxy.#triggerInitialInsertEvents(leafs),
    );

    if (component.dataBindingEnabled()) {
      proxy.#dbInfo = self.appContext.getDbInfo(component.getComponentName());
    }
  }

  #triggerInitialInsertEvents(leafs) {

    leafs.forEach(({ path, key, value, parentObject }) => {
      const sPath = clientUtils.toCanonicalPath(path);

      [...(path == sPath) ? [path] : [path, sPath]]
        .map(p => `insert.${p}`)
        .forEach(evtName => {

          this.component.dispatchEvent(
            evtName,
            {
              path, key, value, parentObject, initial: true,
              onMount: (fn) => {
                this.component.on('onMount', fn);
              },
              afterMount: (fn) => {
                this.component.on('afterMount', fn);
              },
            }
          );
        });
    });
  }

  getSchemaDefinitions() {
    return this.component.constructor.schemaDefinitions;
  }

  static getEnum(enumName) {
    const arr = self.appContext.enums[enumName];

    if (!arr) {
      throw Error(`Could not find enum "${enumName}"`);
    }

    return arr;
  }

  setSchemaDefinitions(schema) {
    const {
      pathProperty, firstProperty, lastProperty, keyProperty, indexProperty, randomProperty, getEnum,
    } = RootProxy;

    const syntheticProperties = [
      pathProperty, firstProperty, lastProperty, keyProperty, indexProperty, randomProperty,
    ];

    const componentName = this.component.getComponentName();

    const { definitions } = schema;
    const defPrefx = '#/definitions/';

    for (let id in definitions) {
      if ({}.hasOwnProperty.call(definitions, id)) {

        let definition = definitions[id];

        if (definition.isComponentRef || definition.isEnumRef) {
          // These will be pruned later
          continue;
        }

        if (definition.$ref) {
          definition = definitions[definition.$ref.replace(defPrefx, '')];
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

                      def.enum = [
                        ...getEnum(enumName),
                        null
                      ];

                      delete def.$ref;
                      break;

                    // Reference to an external component
                    case definitions[refName].isComponentRef:
                    // Reference to the current component
                    case refName == componentName:

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
                  // One reason for this is: it will help us determine enums 
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


        if (id == componentName) {
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
        case definition.isComponentRef:
          delete definitions[id]
          break;
      }
    }

    this.component.constructor.schemaDefinitions = new Proxy(
      definitions,
      {
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
      });

    // Compatibility note for Ajv

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
            return _this.createObjectProxy();

          case isRootPath(prop):
            return prop.match(logicGatePathPrefix) ?
              this.resolveLogicPath({ prop: prop.replace(logicGatePathPrefix, '') }) :
              this.resolveDataPath({ prop: prop.replace(dataPathPrefix, '') });

          case prop === 'data':
            return this;

          case prop === 'length':
            // The forEach helper has an object target
            assert(_this.lastLookup.constructor.name == 'Object');

            return Object.keys(_this.lastLookup).length;

          case global.clientUtils.isNumber(prop):

            // At least access the context, so that the proxy created in setSyntheticContext(...) 
            // intercepts the value and updates the synthetic context

            // eslint-disable-next-line no-unused-expressions
            _this.lastLookup[
              Object.keys(_this.lastLookup)[prop]
            ];

            return this.createObjectProxy();

          default:
            this.component.throwError(`Invalid path "${prop}"`);
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

  getLogicGateValue({ gate, blockData }) {

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
        let variableName = this.component.randomString('varName');

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

    const value = this.component.executeWithBlockData(
      () => {
        return analyzeGate({ type: LOGIC_GATE, original: 0 })
      },
      blockData,
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
      .map(({ original: path, loc }) => {

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
          canonicalPath, loc,
        }
      })
      .filter(e => !!e);
  }

  resolveLogicPath({ prop }) {
    const { logicGatePathRoot, pathSeparator } = RootProxy;

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

    const canonicalGate = this.component.getLogicGates()[prop];

    const gateId = this.component.randomString('gateId');
    const path = `${logicGatePathRoot}${pathSeparator}${gateId}`;

    const gate = {
      canonicalId: prop,
      hook: canonicalGate.table[0].hook,
    }

    const v = this.getLogicGateValue({ gate });

    const rawValue = this.getRawValueWrapper(v);
    const value = this.getValue(v);


    if (this.component.dataBindingEnabled()) {

      const canonicalParticipants = [];

      const participants = this.getParticipantsFromLogicGate(canonicalGate)
        .filter(({ synthetic }) => !synthetic)
        .map(({ original, canonicalPath }) => {
          canonicalParticipants.push(canonicalPath);
          return original;
        });

      this.component.getEmitContext().logicGates[gateId] = {
        gate, participants, canonicalParticipants,
      };
    }

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
    const { literalPrefix } = RootProxy;
    const p = prop.replace(literalPrefix, '');

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

  resolveDataPath({ prop }) {
    const {
      literalPrefix, globalsBasePath, pathSeparator, parsePathExpressionLiteralValue,
    } = RootProxy;

    // eslint-disable-next-line no-undef
    assert(prop.constructor.name === 'String');

    if (prop.startsWith(literalPrefix)) {
      // eslint-disable-next-line no-eval
      return this.component.evaluateExpression(
        `return ${parsePathExpressionLiteralValue(prop)}`
      );
    }

    const { path, isRawReturn, includePath, lenientResolution } = this.getTemplatePathInfo(prop);

    assert(
      !path.startsWith(`${globalsBasePath}${pathSeparator}`) || isRawReturn
    );

    // eslint-disable-next-line no-case-declarations
    const v = this.component
      .getPathValue({ path, includePath, lenientResolution });

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

  getTemplatePathInfo(path) {
    const { rawDataPrefix } = RootProxy;

    assert(path.constructor.name === 'String');

    let isRawReturn = false;

    if (path.startsWith(rawDataPrefix)) {
      // eslint-disable-next-line no-param-reassign
      path = path.replace(rawDataPrefix, '');
      isRawReturn = true;
    }

    const suffixMarker = /\!$/g;
    const lenientMarker = /\?$/g;

    // 1. Should include path?
    const includePath = path.match(suffixMarker);

    if (includePath) {
      // eslint-disable-next-line no-param-reassign
      path = path.replace(suffixMarker, '');
    }

    // 2. Should return raw data?
    isRawReturn = isRawReturn || path.match(suffixMarker);
    if (isRawReturn) {
      // eslint-disable-next-line no-param-reassign
      path = path.replace(suffixMarker, '');
    }

    // 3. Should enable lenient path resolution?
    const lenientResolution = path.match(lenientMarker);
    if (lenientResolution) {
      // eslint-disable-next-line no-param-reassign
      path = path.replace(lenientMarker, '');
    }

    return {
      path, isRawReturn, includePath, lenientResolution,
    }
  }

  #getFullyQualifiedSelector(selector) {
    const rootId = this.component.getElementId();
    return (`#${rootId}` == selector) ? selector : `#${rootId} ${selector}`;
  }

  getHookFilter({ selector }) {
    // Note: HookType "gateParticipant" do not store a selector, and are usually 
    // pruned when the parent logic gate is being pruned
    return this.component.isConnected() &&
      (!selector ||
        document.querySelector(
          this.#getFullyQualifiedSelector(selector)
        )
      );
  }

  executeDiscrete(fn) {
    this.#discreteMode = true;
    if (typeof fn == 'function') {
      fn();
    }
    this.#discreteMode = false;
  }

  async triggerHooks({ fqPath, hookList, hookType, hookOptions, metadata }) {

    if (!this.component.isComponentRendered() || !this.component.isConnected()) {
      return;
    }

    const {
      textNodeHookType, eachBlockHookType, gateParticipantHookType, conditionalBlockHookType,
      dataPathPrefix, nodeAttributeHookType, nodeAttributeKeyHookType, nodeAttributeValueHookType,
      inlineComponentHookType,
    } = RootProxy;

    const { value } = this.getInfoFromPath(fqPath.replace(dataPathPrefix, ''));

    const mainHookTypes = hookType ? [hookType] : [
      nodeAttributeHookType, nodeAttributeKeyHookType, nodeAttributeValueHookType,
      textNodeHookType, gateParticipantHookType, conditionalBlockHookType, eachBlockHookType,
      inlineComponentHookType,
    ];

    await this.triggerHooks0({
      path: fqPath, value, hookTypes: mainHookTypes, hookOptions, hookList, metadata,
    })
  }

  async triggerHooks0({ path, value, hookTypes, changeListener, filteredSelectors, hookOptions, hookList, metadata }) {

    const {
      HookList, logicGatePathRoot, pathSeparator, textNodeHookType, eachBlockHookType, gateParticipantHookType,
      conditionalBlockHookType, dataPathPrefix, nodeAttributeHookType, nodeAttributeKeyHookType, nodeAttributeValueHookType,
      mapSizeProperty, predicateHookType, isMapProperty, collChildSetHookType, collChildDetachHookType, arraySpliceHookType,
      inlineComponentHookType, mapKeysProperty, toFqPath,
    } = RootProxy;

    const path0 = path.replace(dataPathPrefix, '');

    const hookFilter = (hook) => {
      const { id, selector } = hook;

      if (!selector) return true;

      if ((filteredSelectors || []).includes(selector)) {
        return false;
      }

      const b = !!document.querySelector(
        this.#getFullyQualifiedSelector(selector)
      );

      if (!b) {
        HookList.delete(this, [id]);
      }

      return b;
    }

    const renderBlock = (consumer, markupPredicate, parentNode, transform, blockStack) => {
      this.component.startTokenizationContext({ blockStack });

      const markup = markupPredicate();

      if (blockStack.length) {
        this.component.getEmitContext().write(markup, true);
      }

      const htmlString = this.component.finalizeTokenizationContext({ transform });

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

      this.component.dispatchEvent('templateRender');

      this.component.pruneLifecycleEventHandlers();
    }

    const createCollChildNode = (consumer, key, id, markupPredicate, parentNode, transform, opaqueWrapper, loc, blockStack) => {
      const nodeId = id || clientUtils.randomString('nodeId');

      renderBlock(
        (node) => consumer(node),
        () => this.component.execBlockIteration(markupPredicate, opaqueWrapper, key, nodeId, loc),
        parentNode, transform, blockStack,
      )

      return { nodeId };
    }

    const isTextNode = ({ nodeName }) => nodeName == '#text';

    const getSibling = (node, clockwise) => {
      const k = clockwise ? 'nextSibling' : 'previousSibling';
      let r = node[k];

      while (isTextNode(r)) {
        assert(!r.nodeValue.trim());
        r = r[k];
      }

      return r;
    }

    const nextSibling = (node) => getSibling(node, true);

    const previousSibling = (node) => getSibling(node);

    const findNodesInRange = (markerStart, markerEnd, predicate, finalizer, consumer, clockwise) => {

      const visitNode = (node) => {
        const key = node.getAttribute('key');

        if (predicate(key)) {
          consumer(node);
        }

        return finalizer(key);
      }

      if (clockwise) {
        let sibling = nextSibling(markerStart);

        while (sibling != markerEnd) {
          if (visitNode(sibling)) {
            break;
          }

          sibling = nextSibling(sibling);
        }
      } else {
        let sibling = previousSibling(markerEnd);

        while (sibling != markerStart) {
          if (visitNode(sibling)) {
            break;
          }

          sibling = previousSibling(sibling);
        }
      }
    }

    await Promise.all(
      hookList[path]
        .filter(hookInfo => hookFilter(hookInfo))
        .map(hookInfo => ({ ...hookInfo, ...hookOptions || {} }))
        .map(hookInfo => {

          const selector = hookInfo.selector ? this.#getFullyQualifiedSelector(hookInfo.selector) : null;

          const getRenderedValue = () => {
            const { transform } = hookInfo;

            let computedValue = value;

            if (transform) {
              computedValue = this.component[transform](computedValue);
            }

            return this.component.toHtml(computedValue);
          }

          const getTagName = (node) => {
            return node.tagName.toLowerCase();
          }

          const getCollChildNodes = (targetNode, opaqueWrapper, markerEnd) => {
            if (opaqueWrapper) {
              const arr = []

              findNodesInRange(
                targetNode, document.querySelector(markerEnd), () => true, () => false, (n) => arr.push(n),
              );

              return arr;
            } else {
              return [
                ...targetNode.children,
              ]
            }
          }

          const getCollMemberNodes = (targetNode, opaqueWrapper, markerEnd) => {
            const ret = getCollChildNodes(targetNode, opaqueWrapper, markerEnd);

            ret.forEach(n => {
              assert(n.getAttribute('key'));
            });

            return ret;
          }

          const getCollMemberNode = (targetNode, childKey, opaqueWrapper, markerEnd) => {

            if (opaqueWrapper) {
              let r;

              const { index, length } = clientUtils.getCollectionIndexAndLength(value, childKey);

              const predicate = (k) => k == childKey;

              findNodesInRange(
                targetNode, document.querySelector(markerEnd), predicate, predicate, (n) => {
                  r = n;
                },
                (length - index) > index
              );

              assert(r);
              return r;

            } else {
              return targetNode.querySelector(`:scope > [key='${childKey}']`);
            }
          }

          const addPredicateHookId = (node, hookId) => {
            assert(hookId);
            node.dataset.predicateHookId = hookId;
          }

          const getPredicateHookId = (node) => {
            const { dataset: predicateHookId } = node;
            assert(predicateHookId);

            return predicateHookId;
          }

          const getBlockTemplateFunction = (loc, inverse) => {
            const locString = clientUtils.getLine({ loc }, false, true);
            const templateSpec = this.component.getTemplateSpecForBlock({ metadata, locString, inverse });

            if (!templateSpec) {
              assert(inverse);
              return global.TemplateRuntime.NOOP;
            }

            return this.component.getTemplateFunction({ metadata, templateSpec, locString })
          }

          if (hookTypes && !hookTypes.includes(hookInfo.type)) {
            return;
          }

          switch (hookInfo.type) {

            case nodeAttributeHookType:
              return (async () => {
                const { attrTokenType, mustacheRef, blockData } = hookInfo;

                const node = document.querySelector(selector);
                const { dataset: { attrValueGroups } } = node;

                const { previousValue, currentValue } = await this.component.setRenderedValue(
                  attrTokenType, mustacheRef, getRenderedValue(), blockData, attrValueGroups,
                );

                if (previousValue) {
                  const [k] = previousValue.split('=');

                  this.component.setNodeAttribute(node, k);
                }

                if (currentValue) {
                  const [k, v] = currentValue.split('=');

                  this.component.setNodeAttribute(
                    node, k, v.replace(/(^["'])|(["']$)/g, ''),
                  );
                }
              })();

            case nodeAttributeKeyHookType:
              return (async () => {
                const { attrTokenType, mustacheRef, tokenList, tokenIndex, attrValueGroupId, blockData } = hookInfo;

                const node = document.querySelector(selector);
                const { dataset: { attrValueGroups } } = node;

                const { previousValue, currentValue } = await this.component.setRenderedValue(
                  attrTokenType, mustacheRef, getRenderedValue(), blockData, attrValueGroups,
                );

                if (previousValue) {
                  this.component.setNodeAttribute(node, previousValue);
                }

                if (currentValue) {
                  const rgx = /({{)|(}})/g;
                  let v = this.component.getAttrValueFromTokenList(tokenList, tokenIndex + 3);

                  if (v.match(rgx)) {
                    v = await this.component.getRenderedValue(v, attrValueGroupId, { [mustacheRef]: currentValue },);
                  }

                  this.component.setNodeAttribute(node, currentValue, v);
                }
              })();

            case nodeAttributeValueHookType:
              return (async () => {
                const { attrTokenType, mustacheRef, tokenList, tokenIndex, attrValueGroupId, blockData } = hookInfo;

                const node = document.querySelector(selector);

                const { previousValue, currentValue } = await this.component.setRenderedValue(
                  attrTokenType, mustacheRef, getRenderedValue(), blockData,
                );

                const wholeMustacheRgx = /^{{\w+}}$/g;

                let k = this.component.getAttrKeyFromTokenList(tokenList, tokenIndex - 3);
                let v = currentValue;

                if (k.match(wholeMustacheRgx)) {
                  k = await this.component.getRenderedValue(k);
                }

                const valueTokenContent = this.component.getAttrValueFromTokenList(tokenList, tokenIndex);

                if (attrValueGroupId && !valueTokenContent.match(wholeMustacheRgx)) {
                  v = await this.component.getRenderedValue(
                    valueTokenContent, attrValueGroupId, { [mustacheRef]: currentValue },
                  );
                }

                node.skipObserve = k;
                this.component.setNodeAttribute(node, k, v);
              })();

            case textNodeHookType:
              return (async () => {
                const { hook, hookPhase, blockData, transform, loc } = hookInfo;

                const node = document.querySelector(selector);

                let value = getRenderedValue();

                if (transform) {
                  value = this.component.executeWithBlockData(
                    () => this.component[transform].bind(this.component)(value),
                    blockData,
                  );
                }

                node.innerHTML = value;

                if (hook) {
                  await this.component.triggerHooks(
                    hook, hookPhase, null, loc, { node, blockData, loc, initial: false }
                  );
                }
              })();

            case gateParticipantHookType:
              return (async () => {
                const { parentHook } = hookInfo;
                const { gateId, gate, blockData } = parentHook;

                this.component.startSyntheticCacheContext();

                const value = this.getLogicGateValue({ gate, blockData });

                this.component.pruneSyntheticCache();

                const p = `${logicGatePathRoot}${pathSeparator}${gateId}`;

                return this.triggerHooks0({
                  path: p, value, hookList: { [p]: [parentHook] }, metadata,
                });
              })();

            case conditionalBlockHookType:
              return (async () => {
                const computedValue = value;

                const { invert, hook, hookPhase, blockData, transform, transient, loc, blockStack, blockId } = hookInfo;

                const b = this.component.analyzeConditionValue(computedValue);

                let targetNode = document.querySelector(selector);

                let branch = targetNode.getAttribute('branch');
                assert(branch);

                if (transient) {
                  branch = (branch == 'fn') ? 'inverse' : 'fn'
                }

                let htmlFn = null

                if (invert ? !b : b) {
                  if (branch != 'fn') {
                    branch = 'fn';
                    htmlFn = getBlockTemplateFunction(loc);
                  }
                } else {
                  if (branch != 'inverse') {
                    branch = 'inverse';
                    htmlFn = getBlockTemplateFunction(loc, true);
                  }
                }

                if (!htmlFn) {
                  return;
                }

                if (changeListener) {
                  // Indicate that <selector> was updated as a result of this hook
                  changeListener(hookInfo.selector);
                }

                const markupPredicate = () => this.component.executeWithBlockData(
                  () => {
                    const { attributes } = targetNode;
                    const tagName = getTagName(targetNode);

                    return `<${tagName} ${clientUtils.toHtmlAttrString(attributes)}>
                              ${htmlFn()}
                            </${tagName}>`;
                  },
                  blockData,
                )

                this.component.startRenderingContext();

                renderBlock(
                  (node) => {
                    const n = node.children[0];

                    targetNode.parentNode.replaceChild(
                      n, targetNode,
                    );

                    targetNode = n;
                  },
                  markupPredicate, targetNode.parentNode, transform,
                  [...blockStack, this.component.getBlockContextObject({ blockId, loc })],
                )

                targetNode.setAttribute('branch', branch)

                const hookOptions = {
                  node: targetNode, blockData, initial: false,
                };

                if (hook) {
                  await this.component.triggerBlockHooks(hook, hookPhase, 'onMount', loc, hookOptions);
                }

                const { futures } = this.component.finalizeRenderingContext();

                if (hook) {
                  await Promise.all(futures);
                  await this.component.triggerBlockHooks(hook, hookPhase, 'afterMount', loc, hookOptions);
                }

              })();

            case eachBlockHookType:

              return (async () => {

                const { hook, hookPhase, canonicalPath, blockData, transform, predicate, opaqueWrapper, markerEnd, loc, blockId, memberBlockId } = hookInfo;

                const computedValue = value;
                const targetNode = document.querySelector(selector);

                const isArray = Array.isArray(computedValue);

                assert(isArray || computedValue[isMapProperty]);

                const len = computedValue ? isArray ? computedValue.length : computedValue[mapSizeProperty] : -1;

                // Clear existing child nodes
                (() => {
                  const children = getCollChildNodes(targetNode, opaqueWrapper, markerEnd);

                  if (!children.length) return;

                  if (children[0].getAttribute('key') && predicate) {
                    // remove associated "predicate" hooks

                    children.forEach(n => {
                      HookList.delete(this, [
                        getPredicateHookId(n)
                      ]);
                    })
                  }

                  children.forEach(n => {
                    n.remove();
                  });
                })();

                const blockStack = [...hookInfo.blockStack, this.component.getBlockContextObject({ blockId, loc })];

                if (len >= 0) {

                  const hookList = [];

                  let keyMarkerNode;

                  const keys = Object.keys(computedValue);

                  this.component.startRenderingContext();

                  const blockData0 = {
                    ...blockData,
                    [canonicalPath]: {
                      type: isArray ? 'array' : 'map', length: len,
                    }
                  };

                  for (let i = 0; i < len; i++) {

                    blockData0[canonicalPath].index = i;

                    const blockData = clientUtils.deepClone(blockData0);

                    const memberNodeId = clientUtils.randomString('nodeId');

                    const p = toFqPath({ isArray, isMap: !isArray, parent: path, prop: keys[i] });

                    let predicateHookId;

                    if (predicate) {
                      const arrayBlockPath = this.component.getArrayBlockPath(blockData);

                      predicateHookId = this.#createHook(
                        p,
                        {
                          type: predicateHookType, selector: `#${memberNodeId}`,
                          blockStack, blockId: memberBlockId, fn: hookInfo.fn, predicate, hook, hookPhase, transform, opaqueWrapper,
                          arrayBlockPath, blockData, canonicalPath: `${canonicalPath}_$`, loc,
                        }
                      );
                    }

                    const key = this.component.getBlockData({ path: canonicalPath, dataVariable: '@key', blockDataProducer: () => blockData });

                    const currentValue = computedValue[key];
                    const isNull = currentValue === null || (predicate ? !this.component[predicate].bind(this.component)(currentValue) : false);

                    const markupPredicate =
                      () => isNull ?
                        // null collection members are always represented as an empty string
                        '' :
                        this.component.executeWithBlockData(
                          getBlockTemplateFunction(loc), blockData,
                        )

                    const consumer = (node) => {
                      const n = node.children[0];

                      assert(n.id == memberNodeId);

                      if (predicate) {
                        addPredicateHookId(n, predicateHookId);
                      }

                      if (i == 0) {
                        if (opaqueWrapper) {
                          targetNode.insertAdjacentElement("afterend", n);
                        } else {
                          targetNode.appendChild(n);
                        }
                      } else {
                        keyMarkerNode.insertAdjacentElement("afterend", n);
                      }

                      keyMarkerNode = n;
                    }

                    createCollChildNode(
                      consumer, key, memberNodeId, markupPredicate, targetNode, transform, opaqueWrapper, loc,
                      [
                        ...blockStack,
                        this.component.getBlockContextObject({
                          blockId: memberBlockId, blockData, loc,
                        })
                      ],
                    );

                    if (hook) {
                      hookList.push({
                        node: document.querySelector(`#${memberNodeId}`),
                        blockData,
                      });
                    }
                  }

                  if (hook) {
                    await Promise.all(hookList.map(async ({ node, blockData }) => {
                      await this.component.triggerBlockHooks(hook, hookPhase, 'onMount', loc, { node, blockData, initial: false });
                    }))
                  }

                  const { futures } = this.component.finalizeRenderingContext();

                  if (hook) {
                    await Promise.all(futures);

                    await Promise.all(hookList.map(async ({ node, blockData }) => {
                      await this.component.triggerBlockHooks(hook, hookPhase, 'afterMount', loc, { node, blockData, initial: false });
                    }))
                  }

                } else {

                  const { htmlWrapperCssClassname } = RootCtxRenderer;

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

                            const wrapper = document.createElement('div');
                            wrapper.className = htmlWrapperCssClassname;
                            wrapper.appendChild(n);

                            return wrapper;
                          })
                    }
                  }

                  const markupPredicate = () => this.component.executeWithBlockData(
                    getBlockTemplateFunction(loc, true),
                    blockData,
                  )

                  const consumer = (node) => {

                    let keyMarkerNode;
                    const elemList = toElementList(node);

                    elemList
                      .forEach((n, i) => {

                        if (i == 0) {
                          if (opaqueWrapper) {
                            targetNode.insertAdjacentElement("afterend", n);
                          } else {
                            targetNode.appendChild(n);
                          }
                        } else {
                          keyMarkerNode.insertAdjacentElement("afterend", n);
                        }

                        keyMarkerNode = n;
                      });
                  }

                  renderBlock(
                    consumer, markupPredicate, targetNode, transform, blockStack,
                  )
                }

              })();

            case inlineComponentHookType:

              return (async () => {
                const node = document.querySelector(selector);

                if (!value) {
                  node.innerHTML = '';
                  return;
                }

                const { transform, hook, hookPhase, blockData, loc, syntheticPath, ref } = hookInfo;

                this.component.startRenderingContext();

                this.component.executeWithBlockData(() => {
                  const data = this.component[syntheticPath].bind(this.component)();
                  assert(data instanceof BaseComponent);

                  this.component.render({
                      data, target: selector, transform, loc,
                  });

                }, blockData);

                const hookOptions = { node, blockData, loc, initial: false };

                if (hook) {
                  await this.component.triggerHooks(hook, hookPhase, 'onMount', loc, hookOptions);
                }

                const { futures } = this.component.finalizeRenderingContext();

                if (hook) {
                  await Promise.all(futures);
                  await this.component.triggerHooks(hook, hookPhase, 'afterMount', loc, hookOptions);
                }
              })();

            // Below are special purpose hook types

            case predicateHookType:

              return (async () => {

                const computedValue = value;
                const { parentObject, childKey } = this.getInfoFromPath(path0);

                const canonicalPath = hookInfo.canonicalPath.replace(/_\$$/g, '');

                const { blockData, predicate, hook, hookPhase, transform, opaqueWrapper, loc, blockStack, blockId } = hookInfo;

                const targetNode = document.querySelector(selector);
                const isArray = Array.isArray(parentObject);

                assert(isArray || parentObject[isMapProperty]);

                const b = this.component[predicate].bind(this.component)(computedValue);

                const isEmpty = !targetNode.innerHTML || targetNode.getAttribute(this.component.getEmptyNodeAttributeKey());

                if (b) {
                  if (!isEmpty) {
                    return;
                  }
                } else if (isEmpty) {
                  return;
                }

                if (changeListener) {
                  // Indicate that <selector> was updated as a result of this hook
                  changeListener(hookInfo.selector);
                }

                assert(childKey == targetNode.getAttribute('key'));

                const index = Object.keys(parentObject).indexOf(`${childKey}`);

                assert(index >= 0 && (index == blockData[canonicalPath].index));

                const markupPredicate =
                  () => !b ?
                    // null collection members are always represented as an empty string
                    '' :
                    this.component.executeWithBlockData(
                      getBlockTemplateFunction(loc),
                      blockData,
                    )

                this.component.startRenderingContext();

                createCollChildNode(
                  (node) => {
                    const n = node.children[0];

                    assert(n.id == targetNode.id);

                    addPredicateHookId(
                      n, getPredicateHookId(targetNode)
                    )

                    targetNode.insertAdjacentElement("afterend", n);
                    targetNode.remove();
                  },
                  childKey, targetNode.id, markupPredicate, targetNode.parentElement, transform, opaqueWrapper, loc,
                  [
                    ...blockStack,
                    this.component.getBlockContextObject({
                      blockId, blockData, loc,
                    })
                  ],
                );

                const hookOptions = {
                  node: document.querySelector(`#${targetNode.id}`),
                  blockData,
                  initial: false,
                };

                if (hook) {
                  await this.component.triggerBlockHooks(hook, hookPhase, 'onMount', loc, hookOptions);
                }

                const { futures } = this.component.finalizeRenderingContext();

                if (hook) {
                  await Promise.all(futures);
                  await this.component.triggerBlockHooks(hook, hookPhase, 'afterMount', loc, hookOptions);
                }

              })();

            case collChildDetachHookType:

              (() => {
                assert(this.isCollectionObject(value));

                const targetNode = document.querySelector(selector);
                const { opaqueWrapper, markerEnd, childKey } = hookInfo;

                const memberNode = getCollMemberNode(targetNode, childKey, opaqueWrapper, markerEnd);
                memberNode.remove();
              })();

              break;

            case arraySpliceHookType:

              (() => {
                assert(this.isCollectionObject(value));

                const { opaqueWrapper, markerEnd, blockId, deletedElements, offsetIndexes, newIndexes = [], shuffle } = hookInfo;

                const targetNode = document.querySelector(selector);

                deletedElements.forEach(({ childKey }) => {
                  this.triggerHooks0({
                    path, value, hookTypes: [collChildDetachHookType], hookOptions: { childKey },
                    hookList: {
                      [path]: [
                        hookList[path].find(
                          ({ type, blockId: _blockId }) => type == collChildDetachHookType && _blockId == blockId
                        )
                      ]
                    },
                    metadata,
                  });
                });

                const offsetKeys = Object.keys(offsetIndexes);

                if (offsetKeys.length) {

                  const offsetNodes = [
                    getCollMemberNode(targetNode, offsetKeys[0], opaqueWrapper, markerEnd)
                  ];

                  offsetKeys.forEach((k, i) => {
                    if (i == 0) return;

                    const node = (() => {
                      if (opaqueWrapper) {
                        // Note: we know that all keys are arithmetically progressed by 1, i.e. n, n + 1, c + 2, e.t.c.,
                        // hence we can continuously call get the nextSibling
                        return nextSibling(offsetNodes[i - 1]);

                      } else {
                        return getCollMemberNode(targetNode, k, false)
                      }
                    })();

                    offsetNodes.push(node);
                  });

                  Object.values(offsetIndexes)
                    .forEach((v, i) => {
                      offsetNodes[i].setAttribute('key', `${v}`);
                    });

                }


                newIndexes.forEach(i => {
                  this.triggerHooks0({
                    path, value, hookTypes: [collChildSetHookType], hookOptions: { childKey: `${i}` },
                    hookList: {
                      [path]: [
                        hookList[path].find(
                          ({ type, blockId: _blockId }) => type == collChildSetHookType && _blockId == blockId
                        )
                      ]
                    },
                    metadata,
                  });
                });


                if (shuffle) {
                  const memberNodes = getCollMemberNodes(targetNode, opaqueWrapper, markerEnd);

                  assert(!newIndexes.length && offsetKeys.length == memberNodes.length);

                  memberNodes.sort((a, b) => {
                    return parseInt(a.getAttribute('key')) - parseInt(b.getAttribute('key'));
                  });

                  if (opaqueWrapper) {

                    memberNodes.forEach(n => n.remove());

                    let keyMarkerNode = targetNode;

                    memberNodes.forEach((node, i) => {
                      keyMarkerNode.insertAdjacentElement("afterend", node);
                      keyMarkerNode = node;
                    });

                  } else {
                    memberNodes.forEach((node) => {
                      targetNode.appendChild(node);
                    });
                  }
                }

              })();

              break;

            case collChildSetHookType:

              return (async () => {

                assert(this.isCollectionObject(value));

                const { hook, hookPhase, canonicalPath, transform, predicate, opaqueWrapper, markerEnd, loc, blockStack, blockId, childKey } = hookInfo;

                const { collectionType: type } = this.getCollectionDefinition(path0);

                assert(clientUtils.isNumber(childKey) || type == 'map');

                const targetNode = document.querySelector(selector);

                const childNode = document.querySelector(`${selector} > [key='${childKey}']`);

                const { index, length } = clientUtils.getCollectionIndexAndLength(value, childKey);
                const childValue = value[childKey];

                assert(index >= 0 && index < length && childValue !== undefined);

                const blockData = {
                  ...hookInfo.blockData,
                  [canonicalPath]: { type, length, index },
                };

                const backfillSparseElements = () => {
                  if (type == 'array' && index > 0) {

                    const len = getCollMemberNodes(targetNode, opaqueWrapper, markerEnd).length;

                    for (let i = len; i < index; i++) {

                      this.triggerHooks0({
                        path, value, hookTypes: [collChildSetHookType], hookOptions: { childKey: `${i}` },
                        hookList: {
                          [path]: [
                            hookList[path].find(
                              ({ type, blockId: _blockId }) => type == collChildSetHookType && _blockId == blockId,
                            )
                          ]
                        },
                        metadata,
                      });
                    }
                  }
                }

                backfillSparseElements();

                const isNull = childValue === null || (predicate ? !this.component[predicate].bind(this.component)(childValue) : false);

                const markupPredicate =
                  () => isNull ?
                    // null collection members are always represented as an empty strings
                    '' :
                    this.component.executeWithBlockData(
                      getBlockTemplateFunction(loc),
                      blockData,
                    );

                let memberNodeId;

                this.component.startRenderingContext();

                const p = toFqPath({ type, parent: path, prop: childKey });

                const _blockStack = [
                  ...blockStack,
                  this.component.getBlockContextObject({ blockId, blockData, loc })
                ];

                if (childNode) {
                  memberNodeId = childNode.id;

                  createCollChildNode(
                    (node) => {
                      const n = node.children[0];

                      assert(n.id == memberNodeId);

                      if (predicate) {
                        addPredicateHookId(
                          n, getPredicateHookId(childNode)
                        )
                      }

                      childNode.insertAdjacentElement("afterend", n);
                      childNode.remove();
                    },
                    childKey, memberNodeId, markupPredicate, targetNode, transform, opaqueWrapper, loc, _blockStack,
                  );

                } else {
                  memberNodeId = clientUtils.randomString('nodeId');

                  let predicateHookId;

                  if (predicate) {
                    const arrayBlockPath = this.component.getArrayBlockPath(blockData);

                    predicateHookId = this.#createHook(
                      p,
                      {
                        type: predicateHookType, selector: `#${memberNodeId}`,
                        blockStack, blockId, fn: hookInfo.fn, predicate, hook, hookPhase, transform, opaqueWrapper,
                        arrayBlockPath, blockData, canonicalPath: `${canonicalPath}_$`, loc,
                      }
                    );
                  }

                  const getFirstChildConsumer = () => {
                    return (node) => {
                      const n = node.children[0];

                      if (predicate) {
                        addPredicateHookId(n, predicateHookId);
                      }

                      if (opaqueWrapper) {
                        targetNode.insertAdjacentElement("afterend", n)
                      } else {
                        targetNode.appendChild(n);
                      }
                    };
                  }

                  const getSiblingAppendConsumer = (tailKey) => {
                    const tailSibling = getCollMemberNode(targetNode, tailKey, opaqueWrapper, markerEnd);

                    return (node) => {
                      const n = node.children[0];

                      if (predicate) {
                        addPredicateHookId(n, predicateHookId);
                      }

                      tailSibling.insertAdjacentElement("afterend", n)
                    };
                  }

                  const getNodeConsumer = (index) => {
                    return index == 0 ?
                      getFirstChildConsumer() :
                      getSiblingAppendConsumer(
                        (type == 'map') ? value[mapKeysProperty]()[index - 1] : index - 1
                      );
                  }

                  createCollChildNode(
                    getNodeConsumer(index), childKey, memberNodeId, markupPredicate, targetNode, transform, opaqueWrapper, loc, _blockStack,
                  );
                }

                const hookOptions = {
                  node: document.querySelector(`#${memberNodeId}`), blockData, initial: false,
                };

                if (hook) {
                  await this.component.triggerBlockHooks(hook, hookPhase, 'onMount', loc, hookOptions);
                }

                const { futures } = this.component.finalizeRenderingContext();

                if (hook) {
                  await Promise.all(futures);
                  await this.component.triggerBlockHooks(hook, hookPhase, 'afterMount', loc, hookOptions);
                }

              })();
          }
        })
        .filter(h => h));

  }

  #createHook(path, hook) {
    const { HookList } = RootProxy;

    return HookList.add(
      this, path, hook,
    );
  }

  #getTrieSubPaths(path) {
    const trie = this.getPathTrie();
    const arr = [];

    const trieNode = trie.getNode(path);

    if (trieNode) {
      trie.getLeafs(trieNode)
        .forEach(node => {
          arr.push(trie.getReverseWord(node));
        })
    }

    return arr;
  }

  #pruneCollChild({ parent, key, timestamp, trigger }) {
    const { PRUNE_COLL_CHILD_TASK, HookList, MustacheStatementList } = RootProxy;

    return trigger
      .then(() => {

        const { aux } = this.runTask(
          PRUNE_COLL_CHILD_TASK,
          HookList.getStoreName(this),
          MustacheStatementList.getStoreName(this),
          this.component.getId(),
          parent,
          key,
          timestamp,
        );

        return aux;
      });
  }

  #updateCollChild({ parent, key, info, timestamp, trigger }) {

    const { toFqPath, isNumber } = clientUtils;
    const {
      pathProperty, UPDATE_COLL_CHILD_TASK, setObjectPath, HookList,
    } = RootProxy;

    const isArray = isNumber(key);

    const path = toFqPath({ isArray, isMap: !isArray, parent, prop: key });
    const newPath = (isArray && (info.index != undefined)) ?
      toFqPath({ isArray, parent, prop: `${info.index}` }) : null;

    if (newPath) {
      // Update @path, if applicable

      [path, ...this.#getTrieSubPaths(path)]
        .forEach(p => {
          const { value: obj } = this.getInfoFromPath(p);

          if (obj && ['Object', 'Array'].includes(obj.constructor.name)) {

            assert(obj[pathProperty] == p);

            setObjectPath({
              obj,
              path: p.replace(path, newPath)
            });
          }
        });
    }

    return trigger.then(() => {

      const { aux } = this.runTask(
        UPDATE_COLL_CHILD_TASK,
        HookList.getStoreName(this),
        this.component.getId(),
        parent, key, info, timestamp,
      );

      return aux;
    });
  }

  #ensureNoOpenHandle(path) {
    this.#openHandles.forEach(p => {
      if (path.startsWith(p)) {
        this.component.throwError(
          `This operation cannot continue because there is currently an open handle on path "${p}"`
        );
      }
    });
  }

  #pushOpenHandle(path) {
    this.#openHandles.push(path);
  }

  #popOpenHandle(path) {
    const arr = this.#openHandles;

    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i] == path) {
        arr.splice(i, 1);
        return;
      }
    }
  }

  #ensureNonDiscreteContext() {
    if (this.#discreteMode) {
      this.component.throwError(
        `This operation cannot continue in a discrete context`
      );
    }
  }

  #addToChangeSet(changeSet, p, filter, opts) {
    const { dataPathRoot, pathSeparator } = RootProxy;

    changeSet.push({
      path: `${dataPathRoot}${pathSeparator}${p}`, filter, opts,
    });
  }

  static setObjectAsPruned(obj) {

    const { prunedProperty } = RootProxy;
    const { visitObject } = clientUtils;

    const addPrunedPropery = (obj) => {
      Object.defineProperty(obj, prunedProperty, { value: true, configurable: false, enumerable: false });
    }

    const visitComponent = (val) => {
      const input = val.getInput();
      if (!input) return;

      addPrunedPropery(input);

      visitObject(input, visitor);
    };

    const visitor = (key, val) => {
      switch (true) {
        case val instanceof BaseComponent:
          visitComponent(val);
          break;

        case val && typeof val == 'object':
          addPrunedPropery(val);
          return true;
      }
    };

    if (obj instanceof BaseComponent) {
      visitComponent(obj);
    } else {
      addPrunedPropery(obj);
      visitObject(obj, visitor);
    }
  }

  ensurePrivilegedMode() {
    if (!RootProxy.#isPriviledgedMode()) {
      this.component.throwError(`Permission denied`);
    }
  }

  isPathImmutable(fqPath0) {
    const sPath0 = clientUtils.toCanonicalPath(fqPath0);
    const immutablePaths = this.component.immutablePaths();

    return immutablePaths[fqPath0] || immutablePaths[sPath0];
  }

  isCollectionInView(sPath) {
    return this.component.getRenderedCollections().includes(sPath);
  }

  hasCollectionInView(sPath) {
    const properties = this.getPathMetadata(sPath);
    const { hasCollectionInView } = properties;

    return hasCollectionInView !== undefined ?
      hasCollectionInView :
      properties.hasCollectionInView = (() => {
        if (this.isCollectionInView(sPath)) {
          return true;
        }

        for (const p of this.component.getRenderedCollections()) {
          if (p.startsWith(sPath)) {
            return true;
          }
        }
        return false;
      })();
  }

  static createSimpleSetMutationOp(obj, key, value) {
    const { mutationType_SET } = RootProxy;

    return {
      type: mutationType_SET, obj, key, val: value,
    };
  }

  #simpleSetMutationHandler(obj, prop, newValue) {

    const {
      pathProperty, isMapProperty, mapKeyPrefix,
      firstProperty, lastProperty, keyProperty, indexProperty, collChildSetHookType,
      collChildDetachHookType, arraySpliceHookType, filter_EQ, filter_GTE_COLL_MEMBER, filter_GTE_OBJ_MEMBER,
      mutationType_SET, mutationType_SPLICE, mutationType_DELETE, toFqPath, getDataVariables,
      setObjectAsPruned, createSimpleSetMutationOp,
    } = RootProxy;

    const parent = obj[pathProperty];


    const isArray = Array.isArray(obj);
    const isMap = !isArray && obj[isMapProperty];

    const isCollection = isArray || isMap;


    if (isCollection) {
      this.#ensureNoOpenHandle(parent);
    }

    switch (true) {
      case isArray:

        switch (true) {
          case prop == 'length':
            assert(typeof newValue == 'number');
            if (newValue < obj.length) {
              for (let i = obj.length - 1; i >= newValue; i--) {
                this.#simpleSetMutationHandler(obj, i, undefined);
              }
            } else if (newValue > obj.length) {
              this.#simpleSetMutationHandler(obj, newValue - 1, null);
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

        // <obj> is wrapped with our map wrapper, hence this should be true
        assert(prop.startsWith(mapKeyPrefix));

      default:
        if (!prop || !prop.length || prop.constructor.name !== 'String') {
          this.component.logger.error(`Invalid key: ${prop} for object: ${obj[pathProperty]}`);
          return false;
        }

        // Data variables need to set using Object.defineProperty(...) inorder for them to be
        // properly setup, i.e. configurable: true/false, enumerable: false , e.t.c
        assert(!prop.startsWith('@'));

        break;
    }

    let oldValue = obj[prop];

    if (oldValue === undefined) {
      assert(
        isCollection,
        // In #toCanonicalTree(...), we always default known object properties that are missing
        // to either null OR a non-undefined value defined by a component initializer, hence if 
        // oldValue === undefined, it means that <prop> is invalid
        `${parent ? `[${parent}] ` : ''}Property "${prop}" does not exist`
      );
    }

    if (oldValue === newValue) {
      // oldValue === newValue, returning

      this.component.getDomUpdateHooks().forEach(fn => fn());
      this.component.pruneDomUpdateHooks();

      return true;
    }

    const fqPath0 = toFqPath({ isArray, isMap, parent, prop });

    const sPath0 = clientUtils.toCanonicalPath(fqPath0);

    // Perform Validations

    if (this.isPathImmutable(fqPath0)) {
      this.component.logger.error(`Path "${fqPath0}" is immutable`);
      return false;
    }

    if (this.hasCollectionInView(sPath0)) {
      this.#ensureNonDiscreteContext();
    }

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

      o.offsetIndexes = {};

      if (o.removedNonLastElement) {
        for (let i = prop + 1; i < obj.length; i++) {
          o.offsetIndexes[i] = i - 1;
        }
      }

      o.offset = o.elementRemoved ? -1 : 1 + o.sparseIndexes.length;

      return o;
    })();

    const {
      newElementAdded, elementRemoved, removedNonLastElement, removedLastElement, keys, index, length, offset, sparseIndexes, offsetIndexes,
    } = collInfo || {};


    // REGISTER CHANGE SETS

    const mutationList = [];
    const changeSet = [];

    const changedCollMembers = [];

    const addSimpleSetMutation = (obj, key, value) => {
      if (typeof obj == "object") {
        mutationList.push(
          createSimpleSetMutationOp(obj, key, value)
        );
      }
    }

    if (isCollection) {

      const childKey = isMap ? prop.replace(mapKeyPrefix, '') : `${prop}`;

      if (newValue === undefined) {

        const deletedElements = [{ childKey }];

        if (isArray) {

          this.#addToChangeSet(
            changeSet,
            parent, filter_EQ,
            {
              hookType: arraySpliceHookType,
              hookOptions: { deletedElements, offsetIndexes, newIndexes: [] }
            },
          );

        } else {

          this.#addToChangeSet(
            changeSet,
            parent, filter_EQ,
            {
              hookType: collChildDetachHookType,
              hookOptions: deletedElements[0],
            });
        }

      } else {

        this.#addToChangeSet(
          changeSet,
          parent, filter_EQ,
          {
            hookType: collChildSetHookType,
            hookOptions: { childKey, oldValue, sparseIndexes }
          });
      }

      changedCollMembers.push(fqPath0);

    } else {
      this.#addToChangeSet(changeSet, fqPath0, filter_GTE_OBJ_MEMBER);
    }

    if (newElementAdded || elementRemoved) {
      this.#addToChangeSet(changeSet, toFqPath({ parent, prop: 'length' }), filter_EQ);
    }

    if (newElementAdded && length > 0) {

      addSimpleSetMutation(
        obj[length - 1], lastProperty, false,
      );

      this.#addToChangeSet(
        changeSet,
        toFqPath({
          parent: toFqPath({ parent, prop: length - 1 }),
          prop: lastProperty,
        }),
        filter_EQ,
      );
    }

    if (removedLastElement && index > 0) {

      addSimpleSetMutation(
        obj[index - 1], lastProperty, true,
      );

      this.#addToChangeSet(
        changeSet,
        toFqPath({
          parent: toFqPath({ parent, prop: index - 1 }),
          prop: lastProperty,
        }),
        filter_EQ,
      );
    }

    if (removedNonLastElement) {

      Object.entries(offsetIndexes).forEach((i, j) => {

        if (j == 0) {
          addSimpleSetMutation(
            obj[i], firstProperty, true,
          );

          this.#addToChangeSet(
            changeSet,
            toFqPath({
              parent: toFqPath({ parent, prop: i }),
              prop: firstProperty,
            }),
            filter_EQ,
          );
        }

        addSimpleSetMutation(
          obj[i], keyProperty, `${j}`,
        );

        addSimpleSetMutation(
          obj[i], indexProperty, j,
        );

        changedCollMembers.push(
          toFqPath({ parent, prop: i })
        );

        changedCollMembers.push(
          toFqPath({ parent, prop: j })
        );
      });
    }

    if (sparseIndexes) {
      sparseIndexes.forEach(i => {
        changedCollMembers.push(
          toFqPath({ parent, prop: i })
        );
      });
    }

    [...new Set(changedCollMembers)].forEach(p => {
      this.#addToChangeSet(
        changeSet, p, filter_GTE_COLL_MEMBER
      );
    });


    let collChildHookUpdateResolve;

    const collChildHookUpdatePromise = new Promise((resolve) => {
      collChildHookUpdateResolve = resolve;
    });

    const promises = [];

    if (collInfo) {

      // HOOK RE-BALANCING

      const newLength = length + offset;

      const timestamp = new Date();

      switch (true) {
        case newElementAdded:

          for (let i = 0; i < length; i++) {
            promises.push(
              this.#updateCollChild({
                parent, key: keys[i], info: { length: newLength }, timestamp, trigger: collChildHookUpdatePromise,
              })
            )
          }
          break;

        case elementRemoved:

          for (let i = 0; i < index; i++) {
            promises.push(
              this.#updateCollChild({
                parent, key: keys[i], info: { length: newLength }, timestamp, trigger: collChildHookUpdatePromise,
              })
            )
          }

          promises.push(
            this.#pruneCollChild({
              parent, key: keys[index], timestamp, trigger: collChildHookUpdatePromise,
            })
          )

          for (let i = index + 1; i < length; i++) {
            assert(removedNonLastElement);

            promises.push(
              this.#updateCollChild({
                parent, key: keys[i], info: { index: i - 1, length: newLength }, timestamp, trigger: collChildHookUpdatePromise,
              })
            )
          }

          break;
      }

    }



    // DO SET


    const elements = [{
      path: fqPath0,
      prop,
      value: (newValue === undefined && !collDef) ? null : newValue,
      dataVariables: (newValue !== undefined && collDef) ? this.getDataVariablesForSimpleSetOperation(collInfo) : null
    }];

    if (sparseIndexes) {

      for (let i of sparseIndexes) {
        elements.push({
          path: toFqPath({ parent, prop: i }),
          prop: i,
          value: null,
          dataVariables: {
            first: i == 0,
            last: false,
            key: `${i}`,
            index: i,
          }
        });
      }
    }


    for (let i = 0; i < elements.length; i++) {
      const { path, prop, value, dataVariables } = elements[i];

      const leafs = [];

      const { error, mutationType, value: val } = this.#getMutationType({
        path, value, parentObject: obj, collDef, dataVariables, leafs,
      });

      if (error) {
        return false;
      }

      switch (mutationType) {
        case mutationType_SET:
          mutationList.push({ type: mutationType_SET, obj, key: prop, val, leafs });
          break;
        case mutationType_SPLICE:
          mutationList.push({ type: mutationType, obj, key: prop, delCount: 1, repl: [] })
          break;
        case mutationType_DELETE:
          mutationList.push({ type: mutationType, obj, key: prop })
          break;
      }
    }

    if (oldValue && typeof oldValue == 'object') {
      setObjectAsPruned(oldValue);
    }

    const { finalizers, exclusionSet } = this.#executeMutations({ mutationList });

    this.#finalizeMutationHandler(
      [isCollection ? parent : fqPath0, changeSet, finalizers, exclusionSet],
      promises,
      collChildHookUpdateResolve,
      offsetIndexes,
      this.#discreteMode,
    );

    return true;
  }

  #finalizeMutationHandler(
    domUpdateOptions, promises, collChildHookUpdateResolve, offsetIndexes, discreteMode,
  ) {

    const updateDOM = () => {
      const [parent, changeSet, finalizers=[], exclusionSet] = domUpdateOptions;

      const valueOverrides = {};

      if (offsetIndexes) {
        Object.entries(offsetIndexes).forEach(([k, v]) => {

          const { value } = this.getInfoFromPath(`${parent}[${v}]`);
          valueOverrides[`${parent}[${k}]`] = value;
        });
      }

      // console.info(valueOverrides);

      this.component.getDomUpdateHooks().forEach(fn => {
        finalizers.push(fn);
      });

      this.component.pruneDomUpdateHooks();

      return this.#updateDOM(parent, changeSet, finalizers, exclusionSet);
    }

    const p = clientUtils.wrapPromise(
      this.#collChildHookUpdatePromise
        .then(() => {
          if (!discreteMode) {
            return updateDOM();
          }
        })
        .then(() => {
          const ret = Promise.all(promises);

          p.then(() => {
            if (this.#collChildHookUpdatePromise.isResolved()) {
              this.#collChildHookUpdatePromise = RootProxy.RESOLVED_PROMISE;
            }
          });

          collChildHookUpdateResolve();

          return ret;
        })
    );

    this.#collChildHookUpdatePromise = p;
  }

  #arraySpliceMutationHandler(obj, index, delCount, replElements) {

    const {
      pathProperty, firstProperty, lastProperty, keyProperty, indexProperty, arraySpliceHookType,
      mutationType_SET, mutationType_SPLICE, filter_EQ, filter_GTE_COLL_MEMBER, toFqPath, setObjectAsPruned,
      createSimpleSetMutationOp,
    } = RootProxy;

    const { isNumber, peek } = clientUtils;

    const parent = obj[pathProperty];

    assert(Array.isArray(obj));

    this.#ensureNonDiscreteContext();
    this.#ensureNoOpenHandle(parent);

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

    const changedCollMembers = [];

    const mutationList = [];
    const changeSet = [];

    const addSimpleSetMutation = (obj, key, value) => {
      if (typeof obj == "object") {
        mutationList.push(
          createSimpleSetMutationOp(obj, key, value)
        );
      }
    }

    if (offset != 0) {
      this.#addToChangeSet(changeSet, toFqPath({ parent, prop: 'length' }), filter_EQ)
    }

    if (index == length && replElements.length) {
      assert(offset > 0);

      addSimpleSetMutation(
        obj[length - 1], lastProperty, false,
      );

      this.#addToChangeSet(
        changeSet,
        toFqPath({
          parent: toFqPath({ parent, prop: length - 1 }),
          prop: lastProperty,
        }),
        filter_EQ
      );
    }

    const newLength = length + offset;

    if (index > 0 && offset < 0 && index == newLength) {

      addSimpleSetMutation(
        obj[index - 1], lastProperty, true,
      );

      this.#addToChangeSet(
        changeSet,
        toFqPath({
          parent: toFqPath({ parent, prop: index - 1 }),
          prop: lastProperty,
        }),
        filter_EQ
      );
    }


    Object.entries(offsetIndexes)
      .forEach(([i, j]) => {
        i = Number(i);
        const p = toFqPath({ parent, prop: i });


        addSimpleSetMutation(
          obj[i], keyProperty, `${j}`,
        );

        this.#addToChangeSet(
          changeSet,
          toFqPath({ parent: p, prop: keyProperty }),
          filter_EQ
        );


        addSimpleSetMutation(
          obj[i], indexProperty, j,
        );

        this.#addToChangeSet(
          changeSet,
          toFqPath({ parent: p, prop: indexProperty }),
          filter_EQ
        );


        if ([i, j].includes(0)) {

          addSimpleSetMutation(
            obj[i], firstProperty, j == 0,
          );

          this.#addToChangeSet(
            changeSet,
            toFqPath({ parent: p, prop: firstProperty }),
            filter_EQ
          );
        }

        changedCollMembers.push(p);

        changedCollMembers.push(
          toFqPath({ parent, prop: j })
        );
      });

    newIndexes.forEach(i => {
      changedCollMembers.push(
        toFqPath({ parent, prop: i })
      );
    });

    const deletedElements = delIndexes.map(i => {
      changedCollMembers.push(
        toFqPath({ parent, prop: i })
      );

      return { childKey: `${i}` };
    });

    this.#addToChangeSet(
      changeSet,
      parent, filter_EQ,
      {
        hookType: arraySpliceHookType,
        hookOptions: { deletedElements, offsetIndexes, newIndexes }
      });


    [...new Set(changedCollMembers)].forEach(p => {
      this.#addToChangeSet(
        changeSet, p, filter_GTE_COLL_MEMBER,
      );
    })

    let collChildHookUpdateResolve;

    const collChildHookUpdatePromise = new Promise((resolve) => {
      collChildHookUpdateResolve = resolve;
    });

    const promises = [];

    // HOOK RE-BALANCING

    const timestamp = new Date();

    for (let i = 0; i < length; i++) {

      switch (true) {

        case i < index:
          promises.push(
            this.#updateCollChild({
              parent, key: i, info: { length: newLength }, timestamp, trigger: collChildHookUpdatePromise,
            })
          );
          break;

        case delIndexes.includes(i):
          promises.push(
            this.#pruneCollChild({ parent, key: i, timestamp, trigger: collChildHookUpdatePromise, })
          );
          break;

        case offsetIndexes[i] !== undefined:
          promises.push(
            this.#updateCollChild({
              parent, key: i, info: { index: offsetIndexes[i], length: newLength }, timestamp, trigger: collChildHookUpdatePromise,
            })
          );
          break;
      }
    }



    // DO SET




    let hasError = false;

    const collDef = this.getCollectionDefinition(parent);

    const leafsList = [];

    replElements = replElements.map((value, i) => {

      if (hasError) {
        return;
      }


      const idx = index + i;

      const path = toFqPath({ parent, prop: idx });

      if (value === undefined) {
        value = null;
      }

      const dataVariables = {
        first: idx == 0,
        last: (i == replElements.length - 1) && !Object.keys(offsetIndexes).length,
        key: `${idx}`,
        index: idx,
      };

      leafsList.push([]);

      const { error, mutationType, value: val } = this.#getMutationType({ path, value, parentObject: obj, collDef, dataVariables, leafs: leafsList[i], });

      if (error) {
        hasError = true;
        return;
      }

      assert(mutationType == mutationType_SET);

      return val;
    });


    if (hasError) {
      return false;
    }

    mutationList.push({
      type: mutationType_SPLICE,
      obj, key: index,
      delCount: delIndexes.length,
      repl: replElements,
      leafsList,
      delIndexes, newIndexes, offsetIndexes,
    });

    const removedElements = delIndexes.map(i => {
      const e = obj[i];

      if (e && typeof e == 'object') {
        setObjectAsPruned(e);
      }
      return e;
    });

    const { finalizers, exclusionSet } = this.#executeMutations({ mutationList });

    this.#finalizeMutationHandler(
      [parent, changeSet, finalizers, exclusionSet],
      promises,
      collChildHookUpdateResolve,
      offsetIndexes,
    );

    return removedElements;
  }

  #arrayReorderMutationHandler(obj, offsetIndexes) {

    const {
      pathProperty, arraySpliceHookType, filter_EQ, filter_GTE_COLL_MEMBER, keyProperty, indexProperty,
      firstProperty, lastProperty, toFqPath,
    } = RootProxy;

    const parent = obj[pathProperty];

    assert(Array.isArray(obj));

    this.#ensureNonDiscreteContext();
    this.#ensureNoOpenHandle(parent);

    // REGISTER CHANGE SETS

    const changeSet = [];

    this.#addToChangeSet(
      changeSet, parent, filter_EQ,
      {
        hookType: arraySpliceHookType,
        hookOptions: { offsetIndexes, shuffle: true, newIndexes: [], deletedElements: [] }
      });


    Object.entries(offsetIndexes)
      .forEach(([i, j]) => {
        i = Number(i);
        const p = toFqPath({ parent, prop: i });


        addSimpleSetMutation(
          obj[j], keyProperty, `${j}`,
        );

        this.#addToChangeSet(
          changeSet,
          toFqPath({ parent: p, prop: keyProperty }),
          filter_EQ
        );


        addSimpleSetMutation(
          obj[j], indexProperty, j,
        );

        this.#addToChangeSet(
          changeSet,
          toFqPath({ parent: p, prop: indexProperty }),
          filter_EQ
        );


        if ([i, j].includes(0)) {

          addSimpleSetMutation(
            obj[j], firstProperty, j == 0,
          );

          this.#addToChangeSet(
            changeSet,
            toFqPath({ parent: p, prop: firstProperty }),
            filter_EQ
          );
        }


        if ([i, j].includes(obj.length - 1)) {

          addSimpleSetMutation(
            obj[j], lastProperty, j == obj.length - 1,
          );

          this.#addToChangeSet(
            changeSet,
            toFqPath({ parent: p, prop: lastProperty }),
            filter_EQ
          );
        }

        this.#addToChangeSet(
          changeSet, p, filter_GTE_COLL_MEMBER,
        );
      });


    let collChildHookUpdateResolve;

    const collChildHookUpdatePromise = new Promise((resolve) => {
      collChildHookUpdateResolve = resolve;
    });

    const promises = [];

    // HOOK RE-BALANCING

    const timestamp = new Date();

    Object.entries(offsetIndexes)
      .forEach(([k, v]) => {
        promises.push(
          this.#updateCollChild({
            parent, key: Number(k), info: { index: v }, timestamp, trigger: collChildHookUpdatePromise,
          })
        );
      });

    this.#finalizeMutationHandler(
      [parent, changeSet],
      promises,
      collChildHookUpdateResolve,
      offsetIndexes,
    );
  }

  #executeMutations({ mutationList }) {
    const {
      mutationType_SET, mutationType_SPLICE, mutationType_DELETE, pathProperty, typeProperty, mapType,
      parentRefProperty, toFqPath, setDataVariable,
    } = RootProxy;

    const changes = [];

    mutationList.forEach((mutation) => {
      const { type: mutationType, obj, key, val, leafs = [], leafsList } = mutation;

      const addToChanges = ({ path, key, spliceIndex, val, willPrune, leafs, mutationType }) => {

        const add0 = (opts) => {
          // Todo: should we prune #randomValues here?

          changes.push(opts);
        };

        const addPrimary = () => {
          // Note: <spliceIndex> is passed in when <obj> is an array, in order to make it possible for observers 
          // to be able to mirror changes made in <obj> into a secondary array, such that the caller can 
          // recursively run a splice on the secondary array and maintain equality with the primary array: <obj>

          add0({
            mutationType, path, oldValue: willPrune ? val : undefined,
            currentValue: willPrune ? undefined : val,
            parentObject: obj, key, spliceIndex, primary: true,
          });
        }

        if (willPrune) {
          if (val && ['Array', 'Object'].includes(val.constructor.name)) {

            this.#visitObject(
              val,
              (path, val, obj, key) => {
                add0({
                  mutationType, path, oldValue: val, currentValue: undefined,
                  parentObject: obj, key,
                });
              },
              false,
            )
          }

          addPrimary();

        } else {

          addPrimary();

          leafs.forEach(({ path, key, value, parentObject }) => {
            add0({
              mutationType, path, oldValue: undefined, currentValue: value,
              parentObject, key,
            });
          });
        }
      }

      switch (mutationType) {
        case mutationType_SET:
          (() => {
            if (obj && ['Array', 'Object'].includes(obj.constructor.name)) {

              const isArray = Array.isArray(obj);
              const isMap = !isArray && obj[typeProperty] == mapType;

              const path = toFqPath({ isArray, isMap, parent: obj[pathProperty], prop: key });
              const spliceIndex = isArray ? key : undefined;

              if (obj[key] !== undefined) {
                addToChanges({ mutationType, path, key, spliceIndex, val: obj[key], willPrune: true });
              } else {
                assert(isArray || isMap);
              }

              addToChanges({ mutationType, path, key, spliceIndex, val, leafs });

              if (key.startsWith('@')) {
                setDataVariable(obj, key, val)
              } else {
                obj[key] = val;
              }
            }
          })()
          break;

        case mutationType_SPLICE:
          (() => {
            assert(Array.isArray(obj));

            const { delCount, repl, delIndexes, newIndexes, offsetIndexes } = mutation;

            for (let i = 0; i < delCount; i++) {
              const idx = key + i;
              const path = toFqPath({ isArray: true, parent: obj[pathProperty], prop: idx });

              addToChanges({ mutationType, path, key: idx, spliceIndex: key, val: obj[idx], willPrune: true });
            }

            for (let i = repl.length - 1; i >= 0; i--) {
              const idx = key + i;
              const path = toFqPath({ isArray: true, parent: obj[pathProperty], prop: idx });

              addToChanges({ mutationType, path, key: idx, spliceIndex: key, val: repl[i], leafs: leafsList[i] });
            }

            const deletedElements = obj.splice(key, delCount, ...repl);
            assert(deletedElements.length == delCount);

            const path = obj[pathProperty];
            const sPath = clientUtils.toCanonicalPath(path);

            [path, sPath]
              .forEach(p => {
                this.component.dispatchEvent(
                  `splice.${p}`, {
                  path,
                  value: obj,
                  parentObject: obj[parentRefProperty],
                  newLength: obj.length,
                  delIndexes: [...delIndexes],
                  newIndexes: [...newIndexes],
                  offsetIndexes: { ...offsetIndexes },
                });
              });
          })();

          break;

        case mutationType_DELETE:
          assert(obj[typeProperty] == mapType);

          const path = toFqPath({ isMap: true, parent: obj[pathProperty], prop: key });

          addToChanges({ mutationType, path, key, val: obj[key], willPrune: true });

          delete obj[key];
          break;
      }
    });

    const exclusionSet = new Set();
    const finalizers = [];

    const afterMount = (fn) => finalizers.push(fn);

    changes.forEach((changeInfo) => {
      const { path, oldValue, currentValue, parentObject, key, spliceIndex, primary } = changeInfo;

      const sPath = clientUtils.toCanonicalPath(path);
      const isCollChild = this.isCollectionObject(parentObject);

      const parent = parentObject[pathProperty];
      const sParent = clientUtils.toCanonicalPath(parent);

      const eventNamePrefix = (currentValue == undefined) ? 'remove' : 'insert';

      const handle = (isCollChild && this.isCollectionInView(sParent)) ? parent : this.hasCollectionInView(sPath) ? path : null;

      [path, sPath]
        .map(p => `${eventNamePrefix}.${p}`)
        .forEach(evtName => {

          if (handle) {
            this.#pushOpenHandle(handle);
          }

          const { defaultPrevented } = this.component.dispatchEvent(
            evtName, {
            path, key, value: (oldValue !== undefined) ? oldValue : currentValue,
            parentObject, spliceIndex, primary, afterMount, onMount: afterMount,
          },
          );

          if (handle) {
            this.#popOpenHandle(handle);
          }

          if (!handle && defaultPrevented) {
            exclusionSet.add(path);
          }
        });
    });

    return { finalizers, exclusionSet };
  }

  isCollectionObject(obj) {
    const { typeProperty, mapType } = RootProxy;
    return Array.isArray(obj) || (obj && obj[typeProperty] == mapType);
  }

  #getMutationType({ path, value, parentObject, collDef, dataVariables, leafs }) {
    const {
      typeProperty, mapType, mutationType_SET, mutationType_SPLICE,
      mutationType_DELETE, getMapWrapper, setObjectParentRef,
    } = RootProxy;

    if (value !== undefined) {
      value = this.invokeTransformers(
        this.component.getInitializers(), this.component.getTransformers(), path, value, parentObject,
      );
    }

    if (value != undefined) {

      if (['Object', 'Array'].includes(value.constructor.name)) {

        if (collDef) {
          this.addDataVariablesToObject(
            value, dataVariables,
          )
        }

        const b = this.tryOrLogError(
          () => {
            value = this.#toCanonicalTree({
              path, obj: value, leafs, parentObject,
            });
          }
        );

        if (!b) {
          return { error: true };
        }

        if (value[typeProperty] == mapType) {
          value = getMapWrapper(value);
        }

        value = this.#getObserverProxy(value);

      } else {

        const b = this.tryOrLogError(
          () => {
            this.validateSchema(path, value, parentObject);
          }
        );

        if (!b) {
          return { error: true };
        }

        this.#addPathToTrie(path, !!collDef)
      }

      if (typeof value == 'object') {
        setObjectParentRef(value, parentObject)
      }

    } else {

      if (collDef && (value === undefined)) {

        return {
          mutationType: (collDef.collectionType = 'array') ? mutationType_SPLICE : mutationType_DELETE,
        }

      } else {
        this.#addPathToTrie(path, !!collDef)
      }
    }

    return { mutationType: mutationType_SET, value };
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

  getDataVariablesForSimpleSetOperation(collInfo) {
    const { mapKeyPrefixRegex } = RootProxy;
    const { index, length, type, prop } = collInfo;

    const first = index == 0 || (index < 0 && length == 0)
    const last = index == length - 1 || type == 'map' ? index < 0 : index >= length;
    const key = type == 'array' ? `${prop}` : prop.replace(mapKeyPrefixRegex, '');
    const i = type == 'array' ? index : length;

    return {
      first, last, key, index: i,
    }
  }

  addDataVariablesToObject(o, { first, last, key, index }) {
    const { addDataVariables } = RootProxy;
    addDataVariables(
      o, first, last, key, index, this.component.randomString('random')
    );
  }

  static #getObserverProxyMethods(_this) {
    return {

      deleteProperty: (obj, prop) => {
        const dv = prop.startsWith('@');

        if (dv || _this.isPrunedObject(obj)) {

          // Meta properties can only be modified in privilegedMode
          if (dv && _this.component.isSealed() && !RootProxy.#isPriviledgedMode()) {
            _this.component.throwError(`Permission denied to modify ${prop}`);
          }

          delete obj[prop];
          return true;
        }

        return _this.#simpleSetMutationHandler(obj, prop, undefined);
      },

      get: (obj, prop) => {
        const { pathProperty, toFqPath } = RootProxy;

        if (Array.isArray(obj)) {
          switch (prop) {

            case 'splice':
              return (index, delCount, ...replElements) => {

                if (_this.isPrunedObject(obj)) {
                  return obj.splice(index, delCount, ...replElements);
                }

                return _this.#arraySpliceMutationHandler(obj, index, delCount, replElements);
              };


            case 'unshift':
              return (...elements) => {

                if (_this.isPrunedObject(obj)) {
                  return obj.unshift(...elements);
                }

                _this.#arraySpliceMutationHandler(obj, 0, 0, elements);

                return obj.length;
              };


            case 'shift':
              return () => {

                if (_this.isPrunedObject(obj)) {
                  return obj.shift();
                }

                return _this.#arraySpliceMutationHandler(obj, 0, 1, [])[0];
              };


            case 'reverse':
              return () => {

                if (_this.isPrunedObject(obj)) {
                  return obj.reverse();
                }

                const offsetIndexes = {};

                for (let i = 0; i < obj.length; i++) {
                  offsetIndexes[i] = obj.length - 1 - i;
                }

                obj.reverse();

                _this.#arrayReorderMutationHandler(obj, offsetIndexes);
                return obj;
              };


            case 'sort':
              return (sortFn) => {

                if (_this.isPrunedObject(obj)) {
                  return obj.sort(sortFn);
                }

                const arr = [...obj];

                obj.sort(sortFn);

                const offsetIndexes = {};

                for (let i = 0; i < arr.length; i++) {
                  offsetIndexes[i] = obj.indexOf(arr[i]);
                }

                _this.#arrayReorderMutationHandler(obj, offsetIndexes);
                return obj;
              };

          }
        }

        return obj[prop];
      },

      set: (obj, prop, newValue) => {
        if (_this.isPrunedObject(obj)) {
          obj[prop] = newValue;
          return true;
        }

        _this.#simpleSetMutationHandler(obj, prop, newValue)
        return true;
      }
    }
  }

  #getObserverProxy(object) {
    return new Proxy(object, {
      deleteProperty: (obj, prop) => RootProxy.#getObserverProxyMethods(this).deleteProperty(obj, prop),
      get: (obj, prop) => RootProxy.#getObserverProxyMethods(this).get(obj, prop),
      set: (obj, prop, newValue) => RootProxy.#getObserverProxyMethods(this).set(obj, prop, newValue),
    });
  }

  isPrunedObject(obj) {
    const { prunedProperty } = RootProxy;
    return obj[prunedProperty];
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

      const parent = arr.join('.');

      const emptyRet = {
        parentPath: parent,
        parentObject: null,
        value: noOpValue,
        childKey: dataVariable,
      };

      const coll = value(
        clientUtils.getPathStringInfo(arr).parent,
      );

      if (!coll) {
        return emptyRet;
      } else {

        const isMap = coll[isMapProperty] || coll[typeProperty] == mapType || coll instanceof Map;
        const isArray = Array.isArray(coll);

        assert(isArray || isMap);

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

        return {
          parentPath: parent, parentObject,
          childKey: dataVariable, value: v
        };
      }
    }

    const { parent, key: childKey } = clientUtils.getPathStringInfo(pathArray);

    return {
      parentPath: parent,
      parentObject: value(parent) || null,
      childKey, value: value(path),
    };
  }

  isScalarValue(o) {
    return o !== Object(o) || o instanceof BaseComponent;
  }

  async getHookListFromPath(path, startsWith, includeLogicGates) {
    const {
      HookList, dataPathRoot, pathSeparator, logicGatePathPrefix, gateParticipantHookType,
      RESOLVED_PROMISE,
    } = RootProxy;

    const hookList = {};

    const addToHookList = (p, hook) => {
      if (!hookList[p]) {
        hookList[p] = [];
      }
      hookList[p].push(hook);
    }

    const queryFn = (...args) => {
      return startsWith ? HookList.startsWithQuery(...args) : HookList.equalsQuery(...args);
    }

    const fqPath = `${dataPathRoot}${pathSeparator}${path}`;

    await Promise.all([

      queryFn(this, 'owner', fqPath)
        .then(arr => {
          arr.forEach(hook => {
            addToHookList(hook.owner, hook);
          });
        }),

      includeLogicGates ? queryFn(this, 'participants', fqPath)
        .then(arr => {

          arr.forEach(hook => {
            const { owner, participants, canonicalParticipants } = hook;
            const gateId = owner.replace(logicGatePathPrefix, '');

            participants.forEach((p, i) => {
              if (!p.startsWith(fqPath)) return;

              addToHookList(
                p,
                {
                  type: gateParticipantHookType,
                  canonicalPath: canonicalParticipants[i],
                  loc: hook.loc,
                  parentHook: { ...hook, gateId },
                }
              )
            });
          });
        }) :
        RESOLVED_PROMISE,
    ]);

    return hookList;
  }

  #getHookList(parent, path, filter, source, target = {}) {
    const { filter_EQ, filter_GTE_COLL_MEMBER, filter_GTE_OBJ_MEMBER, pathSeparator } = RootProxy;

    const addHooksforPath = (p) => {
      const arr = source[p];
      if (!arr) return;
      target[p] = arr;
    }

    switch (filter) {
      case filter_GTE_COLL_MEMBER:
        (() => {
          const _hookFilter = ({ canonicalPath }) => canonicalPath.includes('[') &&
            !clientUtils.isCanonicalArrayIndex(canonicalPath.split(pathSeparator).join('.'), parent);

          const visitPath = (p) => {
            const arr = source[p];
            if (!arr) return;

            const _arr = arr.filter(_hookFilter);

            if (_arr.length) {
              target[p] = _arr;
            }
          }

          visitPath(path);

          this.#getTrieSubPaths(path)
            .forEach(p => {
              visitPath(p);
            });

        })();
        break;

      case filter_GTE_OBJ_MEMBER:
        (() => {
          addHooksforPath(path);

          this.#getTrieSubPaths(path)
            .forEach(p => {
              addHooksforPath(p);
            });
        })();
        break;

      case filter_EQ:
        (() => {
          addHooksforPath(path);
        })();
        break;
    }

    return target;
  }

  async #updateDOM(parent, changeSet, finalizers = [], exclusionSet) {

    assert(!this.#discreteMode);
    if (this.component.isHeadlessContext() || !this.component.isComponentRendered()) return;

    const startTime = performance.now();

    const [_hookList, metadata] = await Promise.all([
      this.getHookListFromPath(parent, true, true), this.component.getMetadata(),
    ]);

    const endTime = performance.now();

    console.info(this.component.getComponentName(), `hook query completed after ${endTime - startTime} milliseconds`);

    const promises = [];

    changeSet
      .forEach(({ path, filter, opts }) => {
        const hookList = this.#getHookList(parent, path, filter, _hookList);

        Object.keys(hookList)
          .filter(p => !exclusionSet || !exclusionSet.has(p))
          .forEach(p => {
            promises.push(
              this.triggerHooks({
                fqPath: p,
                hookList,
                metadata,
                ...opts,
              })
            );
          });
      });

    return Promise.all(promises)
      .then(() => {
        finalizers.forEach((fn) => fn());
      });
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

    const canonicalPath = path.includes('[') ? global.clientUtils.toCanonicalPath(path) : path;
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
      firstProperty, lastProperty, keyProperty, indexProperty, randomProperty, setDataVariable,
    } = RootProxy;

    setDataVariable(obj, firstProperty, first);
    setDataVariable(obj, lastProperty, last);
    setDataVariable(obj, keyProperty, key);
    setDataVariable(obj, indexProperty, index);
    setDataVariable(obj, randomProperty, random);

    return [
      firstProperty, lastProperty, keyProperty, indexProperty, randomProperty,
    ];
  }

  static setDataVariable(obj, prop, value) {
    Object.defineProperty(obj, prop, { value, enumerable: false, configurable: true, });
  }

  /**
   * This constructs a key that can be used to make a call to {dataPathHooks}
   * @returns String
   */
  static toFqPath({ type, isArray, isMap, parent, prop }) {
    return clientUtils.toFqPath({ type, isArray, isMap, parent, prop });
  }

  validateSchema(path, value, parentObj) {

    if (value === null) {
      return;
    }

    const { toDefinitionName, isMapObject, getEnum } = RootProxy;

    const schemaDefinitions = this.getSchemaDefinitions();

    const {
      $ref, type, additionalProperties, items, component, enum: enum0
    } = schemaDefinitions[
      toDefinitionName(clientUtils.toCanonicalPath(path))
      ];

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

    if (parentObj && isMapObject(parentObj)) {

      const { parent, key } = clientUtils.getPathStringInfo(path);

      const { keyType } = schemaDefinitions[
        toDefinitionName(clientUtils.toCanonicalPath(parent))
      ];

      if (keyType != 'String') {
        const allowedKeys = getEnum(keyType);

        if (!allowedKeys.includes(`${key}`)) {
          this.component.throwError(
            `ValidationError - Expected map "${parent}" to have any of the keys ${allowedKeys}, but instead found key "${key}"`
          );
        }
      }
    }
  }

  #getDefaultValueForType(type) {
    switch (type) {
      case 'array':
        return [];
      case 'object':
        return {};
      case 'string':
        return '';
      case 'number':
        return 0;
      case 'boolean':
        return false;
      default:
        throw Error(`Unknown type "${type}"`);
    };
  }

  getDefinedInitializerForPath(initializers, path, sPath) {
    let ret = initializers[path];

    if (!ret) {
      if (!sPath) {
        sPath = clientUtils.toCanonicalPath(path);
      }
      ret = initializers[sPath];
    }

    return ret ? ret[0] : undefined;
  }

  getDefaultInitializerForPath(sPath) {
    if (!this.component.getNonNullPaths().includes(sPath)) return null;

    const { type } = this.getSchemaDefinitions()[
      getSchemaKey(sPath)
    ];

    return this.#getDefaultValueForType(type);
  }

  invokeTransformers(initializers, transformers, path, val, parentObject) {
    assert(val !== undefined);

    const sPath = clientUtils.toCanonicalPath(path);

    if (val == null) {
      const initializer = this.getDefinedInitializerForPath(initializers, path, sPath) ||
        this.getDefaultInitializerForPath(sPath);

      if (initializer != null) {
        val = (typeof initializer == 'function') ? initializer(parentObject) : initializer;
      }
    }

    const fnList = [...new Set([
      ...transformers[path] || [],
      ...transformers[sPath] || [],
    ])];

    let v = val;

    fnList.forEach(fn => {
      let y = fn(v, parentObject);

      if (y === undefined) {
        y = null;
      }

      v = y;
    });

    return v;
  }

  static setObjectPath({ obj, path }) {
    const { pathProperty } = RootProxy;
    Object.defineProperty(obj, pathProperty, { value: path, configurable: true, enumerable: false });
  }

  static setObjectParentRef(value, parentObject) {
    const { parentRefProperty } = RootProxy;

    if (['Array', 'Object'].includes(value.constructor.name)) {
      Object.defineProperty(value, parentRefProperty, { value: parentObject, configurable: false, enumerable: false });
    } else {
      assert(value instanceof BaseComponent);
      value.addMetadata('parentRef', parentObject);
    }
  }

  #visitObject(obj, visitor, parentFirst) {
    const { typeProperty, mapType, pathProperty, toFqPath } = RootProxy;

    assert(
      parentFirst !== undefined &&
      ['Array', 'Object'].includes(obj.constructor.name) &&
      obj[pathProperty] && typeof visitor == "function"
    );

    const isArray = Array.isArray(obj);
    const isMap = !isArray && obj[typeProperty] === mapType;

    for (let prop of Object.keys(obj)) {
      const val = obj[prop];
      assert(val !== undefined);

      const p = toFqPath({ isArray, isMap, parent: obj[pathProperty], prop });

      if (parentFirst) {
        visitor(p, val, obj, prop);
      }

      if (val && ['Array', 'Object'].includes(val.constructor.name)) {
        this.#visitObject(val, visitor, parentFirst);
      }

      if (!parentFirst) {
        visitor(p, val, obj, prop);
      }
    }

    return obj;
  }

  #addPathToTrie(path, withDataVariables) {
    const { getDataVariables, toFqPath } = RootProxy;

    const trie = this.getPathTrie();

    trie.insert(path);

    if (withDataVariables) {
      getDataVariables().forEach((o) => {
        trie.insert(
          toFqPath({ parent: path, prop: o })
        );
      });
    }
  }

  #toCanonicalTree({ path, obj, leafs, parentObject, initializers, transformers, root = true }) {

    const {
      dataPathPrefix, typeProperty, mapType, mapKeyPrefix, mapKeyPrefixRegex, pathProperty,
      getMapWrapper, addDataVariables, getReservedObjectKeys, toFqPath, getReservedMapKeys, getDataVariables,
      setObjectPath, setObjectParentRef,
    } = RootProxy;

    if (root) {
      initializers = this.component.getInitializers();
      transformers = this.component.getTransformers()
    }

    if (obj[pathProperty]) {
      obj = clientUtils.cloneComponentInputData(obj);
    }

    assert(!path.match(dataPathPrefix));

    setObjectPath({ obj, path });

    const reservedObjectKeys = getReservedObjectKeys();

    const isArray = Array.isArray(obj);

    if (!isArray) {
      Object.keys(obj).forEach(k => {
        if (reservedObjectKeys.includes(k)) {
          this.component.throwError(`[${path}] An object cannot contain the key: ${k}`);
        }
      })
    }

    switch (true) {

      case !!this.getMapDefinition(path):
        const reservedMapKeys = getReservedMapKeys();

        // If this is a map path, add set @type to Map, and transform the keys
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

        if (!def) {
          // Validation error will likely be thrown below, break
          break;
        }

        const keys = Object.keys(obj);

        // Add missing properties
        def.required
          .filter(p => !p.startsWith('@') && !keys.includes(p))
          .forEach(p => {
            obj[p] = (() => {
              // Todo: changes made here should be synchronized wih the server

              // Assign a default value based on the data type
              const { type } = def.properties[p];

              if (!type || ['array', 'string', 'object'].includes(type[0])) {
                return null;
              }

              if (this.getDefinedInitializerForPath(initializers, toFqPath({ parent: path, prop: p })) != null) {
                // We need to return null, so that invokeTransformers(...) will apply the defined initializer
                return null;
              }

              return this.#getDefaultValueForType(type[0]);
            })();
          });
        break;
    }

    if (root && path) {
      this.validateSchema(path, obj, parentObject);
    }

    const isMap = !isArray && (obj[typeProperty] === mapType);

    const isCollection = isArray || isMap;

    const keys = Object.keys(obj);

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
      const p = toFqPath({ isArray, isMap, parent: path, prop });

      if (obj[prop] === undefined) {
        this.component.throwError(`Path "${p}" cannot have "undefined" as it's value`);
      }

      if (!prop.startsWith('@')) {
        obj[prop] = this.invokeTransformers(initializers, transformers, p, obj[prop], obj);

        this.validateSchema(p, obj[prop], obj);

        this.#addPathToTrie(p, isCollection);
      }

      if (isCollection && obj[prop] === Object(obj[prop])) {

        // Inject data variables, if this is a collection of objects
        addDataVariables(
          obj[prop],
          i == 0,
          i == keys.length - 1,
          prop.replace(mapKeyPrefixRegex, ''),
          i,
          this.component.randomString('random')
        );
      }

      const isEmpty = obj[prop] === null;

      const leaf = { path: p, key: prop, parentObject: obj };
      leafs.push(leaf);

      if (!isEmpty && ['Object', 'Array'].includes(obj[prop].constructor.name)) {

        obj[prop] = this.#toCanonicalTree({
          path: p, obj: obj[prop], parentObject: obj,
          leafs, initializers, transformers,
          root: false
        });

        if (obj[prop][typeProperty] == mapType) {
          obj[prop] = getMapWrapper(obj[prop]);
        }

        obj[prop] = this.#getObserverProxy(obj[prop]);
      }

      leaf.value = obj[prop];

      if (obj[prop] && (typeof obj[prop] == 'object')) {
        setObjectParentRef(obj[prop], obj);
      }
    }

    return obj;
  }

  static getReservedObjectKeys() {
    const { isMapProperty, parentRefProperty } = RootProxy;
    return [isMapProperty, parentRefProperty];
  }

  static getReservedMapKeys() {
    const { mapSizeProperty, mapKeysProperty, mapIndexOfProperty } = RootProxy;
    return [mapSizeProperty, mapKeysProperty, mapIndexOfProperty];
  }

  static getMapWrapper(obj) {
    const {
      typeProperty, mapType, mapKeyPrefix, isMapProperty, mapSizeProperty, mapKeysProperty, mapIndexOfProperty,
    } = RootProxy;

    assert(obj[typeProperty] == mapType)

    // At this point, obj is already wrapped with our observer proxy, so
    // we need to run in a privileged context, before we delete this meta property
    RootProxy.#runPriviledged(() => {
      delete obj[typeProperty];
    })

    // Props can start with "@" if <obj> is also a collection child, and the user wants to 
    // access data variable(s)
    const toKey = (prop) => `${prop.startsWith('@') || prop.startsWith(mapKeyPrefix)
      ? '' : mapKeyPrefix}${prop}`;

    const getKeys = (obj) => Reflect.ownKeys(obj)
      .filter(k => typeof k != 'symbol' && k.startsWith(mapKeyPrefix));

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
            return () => getKeys(obj)
              .map(k => k.replace(mapKeyPrefix, ''));

          case prop == mapIndexOfProperty:
            return (k) => getKeys(obj).indexOf(toKey(k));

          case typeof prop == 'symbol':
            return obj[prop];

          default:
            assert(typeof prop == 'string');
            return obj[toKey(prop)]
        }
      },
      set(obj, prop, newValue) {

        assert(!Object.getPrototypeOf(obj)[prop]);
        assert(typeof prop == 'string');

        obj[toKey(prop)] = newValue;

        // Note: according to the JS spec, (see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy/set),
        // proxy.set() should return a boolean value, hence instead of returning <newValue> which
        // is the default behaviour, we will always return true

        return true;
      },
      deleteProperty(obj, prop) {

        assert(!Object.getPrototypeOf(obj)[prop]);
        assert(typeof prop == 'string');

        return delete obj[toKey(prop)];
      }
    })
  }

  static isMapObject(obj) {
    const { isMapProperty, typeProperty, mapType } = RootProxy;
    return obj[typeProperty] == mapType || obj[isMapProperty];
  }

  getDbInfo() {
    return this.#dbInfo;
  }

  getDbConnection() {
    const { dbName } = this.getDbInfo();
    return self.appContext.getDatabaseConnection(dbName);
  }

  #getDbWorker() {
    const { dbName } = this.getDbInfo();
    return self.appContext.getDbWorker(dbName);
  }

  runTask(fnName, ...params) {
    return RootProxy.runTask(
      this.#getDbWorker(), fnName, ...params,
    );
  }

  static runTask(worker, fnName, ...params) {
    const { randomString } = clientUtils;

    const callId = randomString();
    const auxCallId = randomString();

    assert(!this.#workerCalls[callId] && !this.#workerCalls[auxCallId]);

    const aux = new Promise((resolve, reject) => {
      this.#workerCalls[auxCallId] = { resolve, reject };
    })

    const ret = new Promise((resolve, reject) => {
      this.#workerCalls[callId] = { resolve, reject };

      const _this = this;

      // handle worker message one-time
      function handleMessage(event) {
        const { callId: _callId, ret } = event.data;

        if (![auxCallId, callId].includes(_callId)) return;

        const { resolve, reject } = _this.#workerCalls[_callId];

        if (ret instanceof Error) {
          reject(ret);
        } else {
          resolve(ret);
        }

        delete _this.#workerCalls[_callId];

        if (_callId == auxCallId) {
          worker.removeEventListener('message', handleMessage);
        }
      }
      worker.addEventListener('message', handleMessage);


      // send request to worker
      worker.postMessage([
        callId, auxCallId, fnName, params,
      ]);
    });

    ret.aux = aux;

    return ret;
  }

  static MustacheStatementList = class MustacheStatementList {
    static primaryKey = K_IndexedDB.DEFAULT_PRIMARY_KEY;

    static getStoreName(proxy) {
      const { bucketName } = proxy.getDbInfo();
      return `${bucketName}_mustache_statements`;
    }

    static query(proxy, groupId, id) {
      const db = proxy.getDbConnection();

      const storeName = this.getStoreName(proxy);
      const indexName = groupId ? this.getIndexName('groupId') : null;

      const componentId = proxy.component.getId();

      return db.getAll(storeName, indexName, groupId || `${componentId}_${id}`)
        .then(
          rows => rows.filter(
            ({ [this.primaryKey]: id }) => groupId ? id.startsWith(`${componentId}_`) : true,
          ).map(row => ({ ...row, [this.primaryKey]: row[this.primaryKey].replace(`${componentId}_`, '') }))
        );
    }

    static async put(proxy, rows) {
      const { INDEXEDDB_PUT_TASK } = RootProxy;
      const storeName = this.getStoreName(proxy);

      const componentId = proxy.component.getId();

      const ids = [];

      const _rows = rows.map(row => {
        const id = row[this.primaryKey];
        const prefix = `${componentId}_`;

        const _id = id.startsWith(prefix) ? id : `${prefix}${id}`;

        ids.push(_id)

        return {
          ...row,
          [this.primaryKey]: _id,
        };
      });

      await proxy.runTask(
        INDEXEDDB_PUT_TASK, storeName, _rows,
      );

      return ids;
    }

    static getIndexName(columnName) {
      return `${columnName}_index`;
    }
  }

  static HookList = class HookList {
    static primaryKey = K_IndexedDB.DEFAULT_PRIMARY_KEY;

    static getStoreName(proxy) {
      const { bucketName } = proxy.getDbInfo();
      return `${bucketName}_hook_list`;
    }

    static async add(proxy, path, hook) {
      const { primaryKey } = HookList;

      hook[primaryKey] = proxy.component.randomString('dom_hooks');
      hook.owner = path;

      const [id] = await this.put(proxy, [hook]);
      return id;
    }

    static delete(proxy, ids) {
      const { INDEXEDDB_DELETE_TASK } = RootProxy;
      const storeName = this.getStoreName(proxy);

      return proxy.runTask(
        INDEXEDDB_DELETE_TASK, storeName, ids,
      )
    }

    static equalsQuery(proxy, colName, value) {
      const db = proxy.getDbConnection();

      const storeName = this.getStoreName(proxy);
      const indexName = this.getIndexName(colName);

      return db.getAll(storeName, indexName, value)
        .then(rows => rows.filter(
          ({ [this.primaryKey]: id }) => id.startsWith(`${proxy.component.getId()}_`),
        ));
    }

    static startsWithQuery(proxy, colName, prefix) {
      const db = proxy.getDbConnection();

      const storeName = this.getStoreName(proxy);
      const indexName = this.getIndexName(colName);

      return db.getAll(
        storeName, indexName,
        IDBKeyRange.bound(prefix, prefix + 'uffff', false, false),
      )
        .then(rows => rows.filter(
          ({ [this.primaryKey]: id }) => id.startsWith(`${proxy.component.getId()}_`),
        ));
    }

    static async put(proxy, rows) {
      const { INDEXEDDB_PUT_TASK } = RootProxy;
      const storeName = this.getStoreName(proxy);

      const componentId = proxy.component.getId();

      const ids = [];

      const _rows = rows.map(row => {
        const id = row[this.primaryKey];
        const prefix = `${componentId}_`;

        const _id = id.startsWith(prefix) ? id : `${prefix}${id}`;

        ids.push(_id)

        return {
          ...row,
          [this.primaryKey]: _id,
        };
      });

      await proxy.runTask(
        INDEXEDDB_PUT_TASK, storeName, _rows,
      );

      return ids;
    }

    static getIndexName(columnName) {
      return `${columnName}_index`;
    }
  }
}

module.exports = RootProxy;
