
class RootProxy {

  static syntheticMethodPrefix = 's$_';

  static globalsBasePath = 'globals';

  static dataPathRoot = 'data';

  static pathSeparator = '__';

  static dataPathPrefix = RegExp(`^${RootProxy.dataPathRoot}${RootProxy.pathSeparator}`);

  static logicGatePathRoot = 'lg';

  static logicGatePathPrefix = RegExp(`^${RootProxy.logicGatePathRoot}${RootProxy.pathSeparator}`);

  static globalsPathPrefix = RegExp(`^${RootProxy.globalsBasePath}${RootProxy.pathSeparator}`);

  static rawDataPrefix = 'r$_';

  static literalPrefix = 'l$_';

  static lenientMarker = /\?$/g;

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


  static MUST_GRP_EXPR = 'MustacheGroup';
  static BOOL_EXPR = 'BooleanExpression';
  static PATH_EXPR = 'PathExpression';
  static CONDITION_EXPR = 'ConditionExpression';
  static LOGIC_GATE_EXPR = 'LogicGate';


  static isMapProperty = 'isMap';

  static mapSizeProperty = 'size';

  static mapKeysProperty = 'keys';

  static mapIndexOfProperty = 'indexOf';

  static parentRefProperty = '@parentRef';

  static isLiveProperty = '@isLive';

  static lenientExceptionMsgPattern = /^Cannot read properties of (undefined|null)/g;

  static filter_EQ = 'eq';

  static filter_GTE_COLL_MEMBER = 'gte_coll_member';

  static filter_GTE_OBJ_MEMBER = 'gte_obj_member';

  static pathSchemaDefPrefix = '__pathSchema';

  static mutationType_SET = 'set';

  static mutationType_SPLICE = 'splice';

  static mutationType_DELETE = 'delete';

  static mutationType_REORDER = 'reorder';



  static INDEXEDDB_EQUALS_QUERY_TASK = 'equalsQuery';

  static INDEXEDDB_STARTSWITH_QUERY_TASK = 'startsWithQuery';

  static INDEXEDDB_PUT_TASK = 'put';

  static INDEXEDDB_DELETE_TASK = 'delete';

  static UPDATE_COLL_CHILD_TASK = 'updateCollChild';

  static PRUNE_COLL_CHILD_TASK = 'pruneCollChild';


  static RESOLVED_PROMISE = Promise.resolve();

  static #workerCalls = {};

  #collChildHookUpdatePromise = RootProxy.RESOLVED_PROMISE;


  #discreteMode = false;

  #openHandles = [];

  #pathMetadata = {};

  #dbInfo;

  #inputMap = new Map();

  #input;

  constructor({ component }) {
    this.component = component;
    this.handler = this.createRootObjectProxy();
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

  static async create(component) {
    const proxy = new RootProxy({ component });

    component.proxyInstance = proxy;
    component.rootProxy = proxy.handler;

    if (!self.appContext || !component.isLoadable0()) return;

    if (!proxy.#getSchemaDefinitions()) {

      const classMetadata = self.appContext.getComponentClassMetadataMap()[component.getComponentName()];

      const schema = classMetadata.schema || (await self.appContext.fetch({
        url: `/components/${component.getAssetId()}/schema.json`,
        asJson: true,
      }));

      proxy.#setSchemaDefinitions(schema);
    }

    const leafs = [];

    proxy.#toCanonicalTree({
      path: '', obj: component.getInput(), visitor: leaf => {
        leafs.push(leaf)
      }
    });

    proxy.#input = proxy.lookupInputMap('');

    const metaInfo = component.getMetaInfo();

    const useWeakRef = (typeof metaInfo['useWeakRef'] == 'boolean') ?
      metaInfo['useWeakRef'] : component.useWeakRef();

    if (!component.isHeadlessContext() && useWeakRef) {

      // we need to wait until loading has been completed before 
      // creating the weak reference, inorder to prevent the gc from 
      // pruning it before callers have the opportunity to hold on to it.

      component.once('domLoaded', (callback) => {
        const registry = component.getInputFinalizationRegistry();
        registry.register(proxy.#input, component.getId());

        proxy.#input = new WeakRef(proxy.#input);

        if (typeof callback == 'function') {
          callback();
        }
      });
    }

    component.once(
      'beforeRender', () => proxy.#triggerInitialInsertEvents(leafs),
    );

    if (component.dataBindingEnabled()) {
      proxy.#dbInfo = self.appContext.getDbInfo(component.getComponentName());
    }
  }

  #ensureInputMapNotPruned() {
    if (!this.#inputMap) {
      throw Error(`Input map has been pruned`);
    }
  }

  hasInputMap() {
    return !!this.#inputMap;
  }

  pruneInputMap() {
    this.#inputMap = null;

    // Note: the reason we need to set timeout is 
    // 1. to give indexedb some time to fully persist our hooks... 
    // as put operations are relatively slow on indexedb.
    // 2. to maintain optimal TBT

    if (this.component.dataBindingEnabled()) {
      setTimeout(() => {
        this.#pruneHooks();
      }, 15000);
    }
  }

  #pruneHooks() {
    const { DEFAULT_PRIMARY_KEY } = K_Database;
    const { MustacheStatementList, HookList } = RootProxy;

    const db = this.getDbConnection();

    const storeNames = [
      MustacheStatementList.getStoreName(this),
      HookList.getStoreName(this)
    ];

    return Promise.all(
      storeNames.map(async (storeName) => {

        const ids = (await db.startsWithQuery(this, storeName, null, `${this.component.getId()}_`))
          .map(({ [DEFAULT_PRIMARY_KEY]: id }) => id);

        await db.delete(storeName, ids);
      })
    );
  }

  #lookupInputMap0(key) {
    return this.#inputMap.get(key);
  }

  lookupInputMap(path) {
    this.#ensureInputMapNotPruned();

    assert(typeof path == 'string');

    const val = this.#lookupInputMap0(path);

    if (val !== undefined) {
      return val;
    }

    let type;

    if (path) {
      type = this.#lookupInputMap0(`${path}.@type`);

      if (!type) {
        return undefined;
      }
    } else {
      type = 'object';
    }

    return this.#getDynamicObjectProxy(type, path);
  }

  #addToInputMap(key, value) {
    return this.#inputMap.set(key, (value === undefined) ? null : value);
  }

  #removeFromInputMap(key) {
    const value = this.#inputMap.get(key);
    this.#inputMap.delete(key);

    return value;
  }

  getInput() {
    return (this.#input instanceof WeakRef) ? this.#input.deref() : this.#input;
  }

  #triggerInitialInsertEvents(leafs) {

    leafs.forEach(({ path, sPath, key, value, parentPath }) => {
      [...(path == sPath) ? [path] : [path, sPath]]
        .map(p => `insert.${p}`)
        .forEach(evtName => {

          this.component.dispatchEvent(
            evtName,
            {
              path, key,
              value: (value && ['Array', 'Object'].includes(value.constructor.name)) ?
                this.lookupInputMap(path) : value,
              parentObject: this.lookupInputMap(parentPath),
              initial: true,
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

  #getSchemaDefinitions() {
    const { schemaDefinitions } = self.appContext.getComponentClassMetadataMap()[this.component.getComponentName()];
    return schemaDefinitions;
  }

  #setSchemaDefinitions(schema) {
    const { pathProperty, getEnum } = RootProxy;

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

        Object.keys(definition.properties)
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

                  visit(def[childProperty]);

                default:
                  // Allow null values
                  def.type = [def.type, 'null']
                  break;
              }
            }

            visit(def)

            return def;
          })


        if (id != componentName) {
          definition.type = [definition.type, "null"]
        }

        // Register schema, per path
        Object.keys(definition.properties)
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

    self.appContext.getComponentClassMetadataMap()[this.component.getComponentName()]
      .schemaDefinitions = new Proxy(
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

                if (!v) {
                  this.component.throwError(`No schema definition was found for key "${prop}"`);
                }

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

  static getEnum(enumName) {
    const arr = self.appContext.enums[enumName];

    if (!arr) {
      throw Error(`Could not find enum "${enumName}"`);
    }

    return arr;
  }

  createRootObjectProxy() {
    const { dataPathRoot, dataPathPrefix, logicGatePathRoot, pathSeparator, logicGatePathPrefix, isRootPath } = RootProxy;
    // eslint-disable-next-line no-underscore-dangle
    const _this = this;
    return new Proxy({}, {
      get: (obj, prop) => {

        switch (true) {
          case prop === Symbol.iterator:
            return this.getRootObjectProxyIterator();

          // eslint-disable-next-line no-prototype-builtins
          case !!Object.getPrototypeOf(obj)[prop]:
            return obj[prop];

          case prop === 'toHTML':
          case prop === Symbol.toPrimitive:
            return () => _this.component.toHtml(this.lastLookup);

          case prop === 'toJSON':
            return () => this.lastLookup;

          case prop == dataPathRoot:
            return _this.createRootObjectProxy();

          case isRootPath(prop):
            return prop.startsWith(`${logicGatePathRoot}${pathSeparator}`) ?
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

            return this.createRootObjectProxy();

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

            return this.createRootObjectProxy();

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

  getRootObjectProxyIterator() {
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
      dataPathRoot, logicGatePathRoot, pathSeparator, syntheticMethodPrefix, rawDataPrefix
    } = RootProxy;

    return !!(
      path.startsWith(`${dataPathRoot}${pathSeparator}`) ||
      path.startsWith(syntheticMethodPrefix) ||
      path.startsWith(`${rawDataPrefix}${syntheticMethodPrefix}`) ||
      path.startsWith(`${logicGatePathRoot}${pathSeparator}`)
    );
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

  evaluateBooleanExpression(lhs, rhs, operator) {
    const predicates = this.component.getBooleanOperators()[operator];

    if (!predicates) {
      this.component.throwError(`Unknown boolean operator: ${operator}`);
    }

    for (const fn of predicates) {
      if (!fn(lhs, rhs)) {
        return false;
      }
    }
    return true;
  }

  evaluateConditionExpression(parts, conditionInversions, table) {
    const unionOperators = ['AND', 'OR'];

    let op;
    let b;

    loop:
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (
        part &&
        (typeof (part.original || part)) == 'string' &&
        unionOperators.includes(part.original || part)
      ) {
        op = part.original || part;
        continue;
      }

      let _b;

      const evaluateFn = () => {
        _b = !!(table ? this.#getExpressionValue(part, table) : part);

        if (conditionInversions[i]) {
          _b = !_b;
        }
      }

      switch (op) {
        case undefined:
          evaluateFn();
          b = _b;
          break;
        case 'OR':
          if (!b) {
            evaluateFn();
            b = _b;
          }
          if (b) {
            // short-circuiting in logical OR
            break loop;
          }
          break;
        case 'AND':
          if (b) {
            evaluateFn();
            b = _b;
          }
          if (!b) {
            break loop;
          }
          break;
      }
    }

    return b;
  }

  getLogicGateValue({ gate, blockData }) {
    const { LOGIC_GATE_EXPR } = RootProxy;

    const { table } = this.component.getLogicGates()[gate.canonicalId];

    const value = this.component.executeWithBlockData(
      () => this.#getExpressionValue({ type: LOGIC_GATE_EXPR, original: 0 }, table),
      blockData,
    );

    const { hook } = gate;

    if (hook) {
      this.component[hook].bind(this.component)(value);
    }

    return value;
  }

  #getExpressionValue(expr, table) {
    const {
      dataPathPrefix, literalPrefix, lenientMarker, MUST_GRP_EXPR, BOOL_EXPR, PATH_EXPR,
      CONDITION_EXPR, LOGIC_GATE_EXPR, getPathExpressionLiteralValue,
    } = RootProxy;

    switch (true) {

      case expr.type.endsWith('Literal'):
        return expr.original;

      case expr.type == PATH_EXPR:
        return (() => {
          const { original } = expr;
          let path = original.replace(dataPathPrefix, '');

          if (path.startsWith(literalPrefix)) {

            return getPathExpressionLiteralValue(path);
          } else {

            if (path.match(lenientMarker)) {
              path = path.replace(lenientMarker, '');
            }

            return this.component.getPathValue({ path });
          }
        })();

      case expr.type == BOOL_EXPR:
        return (() => {
          const { left, right, operator } = expr;

          const lhs = this.#getExpressionValue(left, table);
          const rhs = this.#getExpressionValue(right, table);

          return this.evaluateBooleanExpression(lhs, rhs, operator);
        })();

      case expr.type == MUST_GRP_EXPR:
        return expr.items.map(item => this.#getExpressionValue(item, table)).join('');

      case expr.type == CONDITION_EXPR:
        return (() => {
          const { parts, conditionInversions } = expr;
          return this.evaluateConditionExpression(parts, conditionInversions, table);
        })();

      case expr.type == LOGIC_GATE_EXPR:
        return (() => {
          const { condition, left, right, invert, conditionInversions } = table[expr.original];

          const ret = this.#getExpressionValue({ type: CONDITION_EXPR, parts: condition, conditionInversions }, table) ?
            this.#getExpressionValue(left, table) : this.#getExpressionValue(right, table);

          return invert ? !ret : ret;
        })();

      default:
        this.component.throwError(`Unknown type "${expr.type}"`);
        break;
    }
  }

  getParticipantsFromLogicGate(gate) {
    const { dataPathPrefix, literalPrefix } = RootProxy;

    return gate.participants
      .map(({ original, loc }) => {

        const canonicalPath = original.replace(dataPathPrefix, '');
        if (canonicalPath.startsWith(literalPrefix)) return null;

        return {
          original: this.component.getExecPath({ fqPath: canonicalPath }),
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

  static getPathExpressionLiteralValue(prop) {
    const { literalPrefix } = RootProxy;
    const p = prop.replace(literalPrefix, '');

    switch (true) {
      case p == 'null':
        return null;
      case p == 'undefined':
        return null;
      case p == 'true':
        return true;
      case p == 'false':
        return false;
      case clientUtils.isNumber(p):
        return Number(p);
      default:
        return p;
    }
  }

  resolveDataPath({ prop }) {
    const {
      literalPrefix, globalsBasePath, pathSeparator, getPathExpressionLiteralValue,
    } = RootProxy;

    // eslint-disable-next-line no-undef
    assert(prop.constructor.name === 'String');

    if (prop.startsWith(literalPrefix)) {
      return getPathExpressionLiteralValue(prop);
    }

    const { path, isRawReturn, includePath, lenient } = this.getTemplatePathInfo(prop);

    assert(
      !path.startsWith(`${globalsBasePath}${pathSeparator}`) || isRawReturn
    );

    // eslint-disable-next-line no-case-declarations
    const v = this.component
      .getPathValue({ path, includePath, lenient });

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
    const lenient = path.match(lenientMarker);
    if (lenient) {
      // eslint-disable-next-line no-param-reassign
      path = path.replace(lenientMarker, '');
    }

    return {
      path, isRawReturn, includePath, lenient,
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

  triggerHooks({ fqPath, hookList, hookType, hookOptions, metadata, blockDataTransformer }) {

    if (!this.component.isComponentRendered() || !this.component.isConnected()) {
      return;
    }

    const {
      textNodeHookType, eachBlockHookType, gateParticipantHookType, conditionalBlockHookType,
      nodeAttributeHookType, nodeAttributeKeyHookType, nodeAttributeValueHookType,
      inlineComponentHookType,
    } = RootProxy;

    const mainHookTypes = hookType ? [hookType] : [
      nodeAttributeHookType, nodeAttributeKeyHookType, nodeAttributeValueHookType,
      textNodeHookType, gateParticipantHookType, conditionalBlockHookType, eachBlockHookType,
      inlineComponentHookType,
    ];

    return this.triggerHooks0({
      path: fqPath, hookTypes: mainHookTypes, hookOptions, hookList, metadata, blockDataTransformer
    })
  }

  triggerHooks0({ path, hookTypes, changeListener, filteredSelectors, hookOptions, hookList, metadata, blockDataTransformer }) {

    const {
      HookList, logicGatePathRoot, pathSeparator, textNodeHookType, eachBlockHookType, gateParticipantHookType,
      conditionalBlockHookType, dataPathPrefix, nodeAttributeHookType, nodeAttributeKeyHookType, nodeAttributeValueHookType,
      mapSizeProperty, predicateHookType, isMapProperty, collChildSetHookType, collChildDetachHookType, arraySpliceHookType,
      inlineComponentHookType, mapKeysProperty, logicGatePathPrefix, toFqPath,
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
          this.#logError({
            parentNode,
            htmlString
          });
          throw Error('Unable to create contextual fragment');
        }
      }

      consumer(node);

      this.component.dispatchEvent('domLoaded');

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

    return Promise.all(
      hookList[path]
        .map(hookInfo => ({ ...hookInfo, ...hookOptions || {} }))
        .map(hookInfo => {
          if (!hookFilter(hookInfo)) return;

          if (typeof blockDataTransformer == 'function') {
            hookInfo.blockData = blockDataTransformer(path0, hookInfo.blockData)
          }

          const selector = hookInfo.selector ? this.#getFullyQualifiedSelector(hookInfo.selector) : null;

          const value = (() => {
            const { canonicalPath, blockData, gate } = hookInfo;

            if (canonicalPath.match(logicGatePathPrefix)) {

              this.component.startSyntheticCacheContext();
              const ret = this.getLogicGateValue({ gate, blockData });
              this.component.pruneSyntheticCache();

              return ret;

            } else {
              return this.component.executeWithBlockData(
                () => this.component.getPathValue({ path: canonicalPath }),
                blockData,
              )
            }
          })();

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

          if (hookTypes && !hookTypes.includes(hookInfo.type)) return;

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
                const { parentHook, gateId } = hookInfo;
                const p = `${logicGatePathRoot}${pathSeparator}${gateId}`;

                return this.triggerHooks0({
                  path: p, hookList: { [p]: [parentHook] }, metadata, blockDataTransformer,
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

                    const blockData = this.component.cloneBlockData(blockData0);

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
                this.component.pushToEmitContext({ variables: {} });

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

                this.component.popEmitContext();
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
                assert(this.#isCollectionObject(value));

                const targetNode = document.querySelector(selector);
                const { opaqueWrapper, markerEnd, childKey } = hookInfo;

                const memberNode = getCollMemberNode(targetNode, childKey, opaqueWrapper, markerEnd);
                memberNode.remove();
              })();

              break;

            case arraySpliceHookType:

              (() => {
                assert(this.#isCollectionObject(value));

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
                    blockDataTransformer,
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
                    blockDataTransformer,
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

                assert(this.#isCollectionObject(value));

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
                        blockDataTransformer,
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

  getTrieSubPaths(path) {
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

        const args = [
          HookList.getStoreName(this),
          MustacheStatementList.getStoreName(this),
          this.component.getId(),
          parent,
          key,
          timestamp,
        ];

        if (this.#getDbWorker()) {

          const { aux } = this.runTask(
            PRUNE_COLL_CHILD_TASK,
            ...args,
          );

          return aux;

        } else {

          return clientUtils.pruneCollChild(
            this.getDbConnection(),
            ...args,
          );
        }
      });
  }

  #updateCollChild({ parent, key, info, timestamp, trigger, updateInputMap = true }) {

    const { isNumber } = clientUtils;
    const { UPDATE_COLL_CHILD_TASK, toFqPath, HookList } = RootProxy;

    const isArray = isNumber(key);

    const newPath = (isArray && (info.index != undefined)) ?
      toFqPath({ isArray, parent, prop: `${info.index}` }) : null;

    if (updateInputMap && newPath) {
      const path = toFqPath({ isArray, isMap: !isArray, parent, prop: key });

      [path, ...this.getTrieSubPaths(path)]
        .forEach(p => {
          const _p = p.replace(path, newPath);

          const _val = this.#lookupInputMap0(p);

          if (_val !== undefined) {
            this.#removeFromInputMap(p);

            this.#addPathToTrie(_p);
            this.#addToInputMap(_p, _val);
          }
        });
    }

    return trigger.then(() => {

      const args = [
        HookList.getStoreName(this),
        this.component.getId(),
        parent, key, info, timestamp,
      ];

      if (this.#getDbWorker()) {

        const { aux } = this.runTask(
          UPDATE_COLL_CHILD_TASK,
          ...args,
        );

        return aux;

      } else {

        return clientUtils.updateCollChild(
          this.getDbConnection(),
          ...args,
        );
      }
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

  #simpleSetMutationHandler(obj, prop, newValue) {
    const {
      pathProperty, isMapProperty, mapKeyPrefix, firstProperty, lastProperty, keyProperty, indexProperty,
      collChildSetHookType, collChildDetachHookType, arraySpliceHookType, filter_EQ, filter_GTE_COLL_MEMBER,
      filter_GTE_OBJ_MEMBER, mutationType_SET, mutationType_SPLICE, mutationType_DELETE, toFqPath,
    } = RootProxy;

    const { toCanonicalPath, isNumber, getCollectionIndexAndLength } = clientUtils;

    const parent = obj[pathProperty];
    const sParent = toCanonicalPath(parent);

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

          case !isNumber(prop):
            this.#logError(`Invalid index: ${prop} for array: ${obj[pathProperty]}`);
            return false;
        }

        prop = Number(prop);
        break;

      case isMap:

        if (!prop) {
          this.#logError(`Empty key provided for setter, map=${obj[pathProperty]}`);
          return false;
        }

        if (!`${prop}`.startsWith(mapKeyPrefix)) {
          prop = `${mapKeyPrefix}${prop}`
        }
        break;

      default:
        assert(typeof prop == 'string');
        break;
    }

    let oldValue = obj[prop];

    if (oldValue === undefined) {
      assert(
        isCollection,
        // In #toCanonicalTree(...), we always populate known object properties that are missing
        // on the object, hence if oldValue === undefined, it means that <prop> is invalid
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

    const sPath0 = toCanonicalPath(fqPath0);

    // Perform Validations

    if (this.isPathImmutable(fqPath0)) {
      this.#logError(`Path "${fqPath0}" is immutable`);
      return false;
    }

    if (this.hasCollectionInView(sPath0)) {
      this.#ensureNonDiscreteContext();
    }

    const collInfo = (() => {
      if (!isCollection) return false;

      const o = {
        ...getCollectionIndexAndLength(obj, prop),
        type: isArray ? 'array' : 'map',
        prop,
        keys: Object.keys(obj).map(k => isArray ? Number(k) : k),
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
      newElementAdded, elementRemoved, removedNonLastElement, removedLastElement, keys,
      index, length, offset, sparseIndexes, offsetIndexes,
    } = collInfo || {};


    // register change set

    const changeSet = [];
    const changedCollMembers = [];


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

      this.#setDataVariableForCollMember(
        parent, keys[length - 1], lastProperty, false,
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

      this.#setDataVariableForCollMember(
        parent, keys[index - 1], lastProperty, true,
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
          this.#setDataVariableForCollMember(
            parent, keys[i], firstProperty, true,
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

        this.#setDataVariableForCollMember(
          parent, keys[i], keyProperty, `${j}`,
        );

        this.#setDataVariableForCollMember(
          parent, keys[i], indexProperty, j,
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



    const mutationType = (newValue === undefined && isCollection) ? isArray ? mutationType_SPLICE : mutationType_DELETE : mutationType_SET;
    const handle = (isCollection && this.isCollectionInView(sParent)) ? parent : this.hasCollectionInView(sPath0) ? fqPath0 : null;

    const changeEvents = {};

    if (mutationType == mutationType_SPLICE) {
      [parent, ...(sParent != parent) ? [sParent] : []]
        .forEach(p => {
          changeEvents[p] = {
            eventType: mutationType,
            mutationType,
            path: parent,
            sPath: sParent,
            parentObject: obj,
            newLength: length + offset,
            delIndexes: [prop],
            newIndexes: [],
            offsetIndexes: { ...offsetIndexes },
          };
        });
    }

    const addEventsForLeaf = (eventType, leaf) => {
      const { path, sPath } = leaf;

      [path, ...(sPath != path) ? [sPath] : []]
        .forEach(p => {
          changeEvents[p] = {
            eventType, mutationType, ...leaf,
          }
        });
    }


    // generate "detach" events

    if (oldValue !== undefined) {

      this.#buildObjectFromMap(
        fqPath0, null, obj, `${prop}`, true,
        this.#removeInputMapEntries(fqPath0),
        leaf => {
          addEventsForLeaf('remove', leaf);
        });
    }



    let collChildHookUpdateResolve;

    const collChildHookUpdatePromise = new Promise((resolve) => {
      collChildHookUpdateResolve = resolve;
    });

    const promises = [];

    if (collInfo) {

      const newLength = length + offset;

      if (isArray) {
        this.#addToInputMap(`${parent}.length`, newLength);
      }

      if (isMap && (newElementAdded || elementRemoved)) {
        const _keys = [...keys];

        if (newElementAdded) {
          _keys.push(prop);
        } else {
          const idx = _keys.indexOf(prop);
          assert(idx >= 0);

          _keys.splice(idx, 1);
        }

        this.#addToInputMap(`${parent}.@keys`, _keys);
      }

      // re-balance hooks

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

    // generate "insert" events

    if (mutationType == mutationType_SET) {

      const elements = [{
        path: fqPath0,
        key: prop,
        value: newValue,
        dataVariables: isCollection ? this.#getCollChildDataVariables(collInfo) : null
      }];

      if (sparseIndexes) {

        for (let i of sparseIndexes) {
          elements.push({
            path: toFqPath({ parent, prop: i }),
            key: i,
            value: null,
            dataVariables: {
              first: i == 0,
              last: false,
              key: `${i}`,
              index: i,
            },
            sparse: true,
          });
        }
      }

      for (let i = 0; i < elements.length; i++) {
        const { path, key, value, dataVariables, sparse } = elements[i];

        const { error } = this.#addInputMapEntries({
          path, value, parentObject: obj, key, dataVariables,
          visitor: leaf => {
            addEventsForLeaf('insert', { ...leaf, sparse });
          },
        });

        if (error) {
          return false;
        }
      }
    }

    const { finalizers, exclusionSet } = this.#dispatchEventForChanges(handle, changeEvents);

    this.#finalizeMutationHandler(
      [isCollection ? parent : fqPath0, changeSet, finalizers, exclusionSet],
      promises,
      collChildHookUpdateResolve,
      offsetIndexes,
      collInfo ? length + offset : null,
      this.#discreteMode,
    );

    return true;
  }

  #finalizeMutationHandler(
    domUpdateOptions, promises, collChildHookUpdateResolve, offsetIndexes, newLength, discreteMode,
  ) {
    const { pathSeparator } = RootProxy;
    const { isCanonicalArrayIndex, deepClone } = clientUtils;

    const updateDOM = () => {
      const [parent, changeSet, finalizers = [], exclusionSet] = domUpdateOptions;

      const offsetKeys = offsetIndexes ? Object.keys(offsetIndexes) : [];

      const blockDataTransformer = (path, _blockData) => {
        if (path == parent || (!offsetKeys.length && newLength == null)) return _blockData;

        const blockData = deepClone(_blockData);

        Object.entries(blockData)
          .filter(([k]) => isCanonicalArrayIndex(
            `${k.split(pathSeparator).join('.')}_$`, parent,
          ))
          .forEach(([k, v]) => {
            const { index } = v;

            if (offsetIndexes && offsetIndexes[index] != null) {
              v.index = offsetIndexes[index];
            }

            if (newLength != null) {
              v.length = newLength;
            }
          });

        return blockData;
      }

      this.component.getDomUpdateHooks().forEach(fn => {
        finalizers.push(() => {
          requestIdleCallback(() => {
            fn();
          });
        });
      });

      this.component.pruneDomUpdateHooks();

      return this.#updateDOM(
        parent, changeSet, finalizers, exclusionSet, blockDataTransformer
      );
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

  static getArraySpliceInfo(obj, index, delCount, replElements) {
    const { isNumber } = clientUtils;

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
      const tailIndex = delIndexes.length ? delIndexes.at(-1) + 1 : index;

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

    return { index, delIndexes, offset, offsetIndexes, newIndexes };
  }

  #arraySpliceMutationHandler(obj, _index, delCount, replElements) {

    const {
      pathProperty, firstProperty, lastProperty, keyProperty, indexProperty, arraySpliceHookType,
      mutationType_SPLICE, filter_EQ, filter_GTE_COLL_MEMBER, toFqPath, getArraySpliceInfo
    } = RootProxy;

    const { toCanonicalPath } = clientUtils;

    const parent = obj[pathProperty];
    const sParent = toCanonicalPath(parent);

    assert(Array.isArray(obj));

    this.#ensureNonDiscreteContext();
    this.#ensureNoOpenHandle(parent);

    const { index, delIndexes, offset, offsetIndexes, newIndexes } = getArraySpliceInfo(
      obj, _index, delCount, replElements,
    );

    const length = obj.length;


    // register change set

    const changeSet = [];
    const changedCollMembers = [];


    if (offset != 0) {
      this.#addToChangeSet(changeSet, toFqPath({ parent, prop: 'length' }), filter_EQ)
    }

    if (index == length && replElements.length) {
      assert(offset > 0);

      this.#setDataVariableForCollMember(
        parent, length - 1, lastProperty, false,
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

      this.#setDataVariableForCollMember(
        parent, index - 1, lastProperty, true,
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


        this.#setDataVariableForCollMember(
          parent, i, keyProperty, `${j}`,
        );

        this.#addToChangeSet(
          changeSet,
          toFqPath({ parent: p, prop: keyProperty }),
          filter_EQ
        );


        this.#setDataVariableForCollMember(
          parent, i, indexProperty, j,
        );

        this.#addToChangeSet(
          changeSet,
          toFqPath({ parent: p, prop: indexProperty }),
          filter_EQ
        );


        if ([i, j].includes(0)) {

          this.#setDataVariableForCollMember(
            parent, i, firstProperty, j == 0,
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
    });



    const removedElements = [];

    const mutationType = mutationType_SPLICE;
    const handle = this.isCollectionInView(sParent) ? parent : null;

    const changeEvents = {};

    [parent, ...(sParent != parent) ? [sParent] : []]
      .forEach(p => {
        changeEvents[p] = {
          eventType: mutationType,
          mutationType,
          path: parent,
          sPath: sParent,
          parentObject: obj,
          newLength: newLength,
          delIndexes: [...delIndexes],
          newIndexes: [...newIndexes],
          offsetIndexes: { ...offsetIndexes },
        };
      });

    const addEventsForLeaf = (eventType, leaf) => {
      const { path, sPath } = leaf;

      [path, ...(sPath != path) ? [sPath] : []]
        .forEach(p => {
          changeEvents[p] = {
            eventType, mutationType, ...leaf,
          }
        });
    }


    // generate "detach" events

    delIndexes.forEach(i => {
      const path = toFqPath({ parent, prop: i });

      this.#buildObjectFromMap(
        path, null, obj, `${i}`, true,
        this.#removeInputMapEntries(path),
        leaf => {
          const { primary, value } = leaf;

          if (primary) {
            removedElements.push(value);
          }

          addEventsForLeaf('remove', leaf);
        });
    });



    let collChildHookUpdateResolve;

    const collChildHookUpdatePromise = new Promise((resolve) => {
      collChildHookUpdateResolve = resolve;
    });

    const promises = [];


    this.#addToInputMap(`${parent}.length`, newLength);

    // re-balance hooks

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

        // note: the offset-direction must be opposite of the iteration direction
        case newLength < length && offsetIndexes[i] !== undefined:
          promises.push(
            this.#updateCollChild({
              parent, key: i, info: { index: offsetIndexes[i], length: newLength }, timestamp, trigger: collChildHookUpdatePromise,
            })
          );
          break;
      }
    }

    if (newLength > length) {
      for (let i = length - 1; i >= 0; i--) {
        if (offsetIndexes[i] !== undefined) {
          promises.push(
            this.#updateCollChild({
              parent, key: i, info: { index: offsetIndexes[i], length: newLength }, timestamp, trigger: collChildHookUpdatePromise,
            })
          );
        }
      }
    }

    for (let i = 0; i < replElements.length; i++) {
      const value = replElements[i];

      const idx = index + i;
      const path = toFqPath({ parent, prop: idx });

      const dataVariables = {
        first: idx == 0,
        last: (i == replElements.length - 1) && !Object.keys(offsetIndexes).length,
        key: `${idx}`,
        index: idx,
      };

      const { error } = this.#addInputMapEntries({
        path, value, parentObject: obj, key: `${idx}`, dataVariables,
        visitor: leaf => {
          addEventsForLeaf('insert', leaf);
        },
      });

      if (error) {
        return false;
      }
    }

    const { finalizers, exclusionSet } = this.#dispatchEventForChanges(handle, changeEvents);

    this.#finalizeMutationHandler(
      [parent, changeSet, finalizers, exclusionSet],
      promises,
      collChildHookUpdateResolve,
      offsetIndexes,
      newLength,
    );

    return removedElements;
  }

  #arrayReorderMutationHandler(obj, offsetIndexes) {

    const {
      pathProperty, arraySpliceHookType, filter_EQ, filter_GTE_COLL_MEMBER, keyProperty, indexProperty,
      firstProperty, lastProperty, toFqPath, mutationType_REORDER,
    } = RootProxy;

    const { toCanonicalPath } = clientUtils;

    const parent = obj[pathProperty];
    const sParent = toCanonicalPath(parent);

    assert(Array.isArray(obj));

    this.#ensureNonDiscreteContext();
    this.#ensureNoOpenHandle(parent);


    const _inputMap = {};

    Object.entries(offsetIndexes)
      .forEach(([i, j]) => {
        const path = `${parent}[${i}]`;
        const newPath = `${parent}[${j}]`;

        [path, ...this.getTrieSubPaths(path)].forEach(p => {
          const _p = p.replace(path, newPath);

          const _val = this.lookupInputMap(p);
          this.#removeFromInputMap(p);

          _inputMap[_p] = _val;
        })
      });

    Object.entries(_inputMap).forEach(([k, v]) => {
      this.#addToInputMap(k, v);
    });


    // register change set

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


        this.#setDataVariableForCollMember(parent, j, keyProperty, `${j}`);

        this.#addToChangeSet(
          changeSet,
          toFqPath({ parent: p, prop: keyProperty }),
          filter_EQ
        );


        this.#setDataVariableForCollMember(parent, j, indexProperty, j);

        this.#addToChangeSet(
          changeSet,
          toFqPath({ parent: p, prop: indexProperty }),
          filter_EQ
        );


        if ([i, j].includes(0)) {

          this.#setDataVariableForCollMember(parent, j, firstProperty, j == 0);

          this.#addToChangeSet(
            changeSet,
            toFqPath({ parent: p, prop: firstProperty }),
            filter_EQ
          );
        }


        if ([i, j].includes(obj.length - 1)) {

          this.#setDataVariableForCollMember(parent, j, lastProperty, j == obj.length - 1);

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


    const mutationType = mutationType_REORDER;
    const handle = this.isCollectionInView(sParent) ? parent : null;

    const changeEvents = {};

    [parent, ...(sParent != parent) ? [sParent] : []]
      .forEach(p => {
        changeEvents[p] = {
          eventType: mutationType,
          mutationType,
          path: parent,
          sPath: sParent,
          parentObject: obj,
          offsetIndexes: { ...offsetIndexes },
        };
      });



    let collChildHookUpdateResolve;

    const collChildHookUpdatePromise = new Promise((resolve) => {
      collChildHookUpdateResolve = resolve;
    });

    const promises = [];

    // re-balance hooks

    const timestamp = new Date();

    Object.entries(offsetIndexes)
      .forEach(([k, v]) => {
        promises.push(
          this.#updateCollChild({
            parent, key: Number(k), info: { index: v }, timestamp, trigger: collChildHookUpdatePromise,
            updateInputMap: false,
          })
        );
      });

    const { finalizers, exclusionSet } = this.#dispatchEventForChanges(handle, changeEvents);

    this.#finalizeMutationHandler(
      [parent, changeSet, finalizers, exclusionSet],
      promises,
      collChildHookUpdateResolve,
      offsetIndexes,
      obj.length,
    );
  }

  #setDataVariableForCollMember(parent, prop, name, val) {
    const { toFqPath, mapKeyPrefix } = RootProxy;

    assert(name.startsWith('@'));

    const isArray = typeof prop == 'number';
    const isMap = !isArray && prop.startsWith(mapKeyPrefix);

    assert(isArray || isMap);

    const path = toFqPath({
      parent: toFqPath({ isArray, isMap, parent, prop }),
      key: name,
    });

    this.#addToInputMap(path, val);
  }

  #dispatchEventForChanges(handle, changeEvents) {
    const { dataPathRoot, pathSeparator } = RootProxy;

    const exclusionSet = new Set();
    const finalizers = [];

    const afterMount = (fn) => finalizers.push(fn);

    Object.entries(changeEvents).forEach(([k, v]) => {
      const { eventType, path } = v;

      if (handle) {
        this.#pushOpenHandle(handle);
      }

      const { defaultPrevented } = this.component.dispatchEvent(
        `${eventType}.${k}`, {
        ...v, afterMount, onMount: afterMount
      },
      );

      if (handle) {
        this.#popOpenHandle(handle);
      }

      if (!handle && defaultPrevented) {
        exclusionSet.add(`${dataPathRoot}${pathSeparator}${path}`);
      }
    });

    return { exclusionSet, finalizers };
  }

  #buildObjectFromMap(path, sPath, parentObject, key, primary, entries, visitor) {
    const {
      isMapProperty, mapKeyPrefix, mapSizeProperty, mapKeysProperty, mapIndexOfProperty,
      isLiveProperty, pathProperty, toFqPath, setObjectParentRef, addNonEnumerableProperty,
    } = RootProxy;

    assert(typeof key == 'string');

    if (!sPath) {
      sPath = clientUtils.toCanonicalPath(path);
    }

    const value = (() => {
      const type = entries.get(`${path}.@type`);

      switch (type) {

        case 'literal':
          return entries.get(path);
        case 'component':
          return (() => {
            const ret = entries.get(path);
            setObjectParentRef(ret, parentObject);
            return ret;
          })();

        default:
          assert(['object', 'array', 'map'].includes(type));

          const ret = (type == 'array') ?
            [...new Array(entries.get(`${path}.length`))] :
            {};

          addNonEnumerableProperty(ret, pathProperty, path);
          setObjectParentRef(ret, parentObject);

          addNonEnumerableProperty(ret, isLiveProperty, false);
          addNonEnumerableProperty(ret, isMapProperty, type == 'map');

          const collInfo = (() => {
            switch (true) {
              case parentObject[isMapProperty]:
                return {
                  type: 'map',
                  keys: parentObject[mapKeysProperty]()
                    .map(k => `${mapKeyPrefix}${k}`),
                }
              case Array.isArray(parentObject):
                return {
                  type: 'array',
                  keys: [...new Array(parentObject.length)].map((e, i) => `${i}`),
                }
            }
          })();

          if (collInfo) {
            const { type, keys } = collInfo;
            const index = keys.indexOf(key);

            assert(index >= 0);

            const dataVariables = this.#getCollChildDataVariables({
              index,
              length: keys.length,
              type,
              prop: key,
            });

            Object.entries({
              ...dataVariables,
              random: this.component.randomString('random')
            })
              .forEach(([k, v]) => {
                addNonEnumerableProperty(ret, `@${k}`, v);
              });
          }

          const ownKeys = this.#getOwnKeysFromMap(type, path, entries);

          if (type == 'map') {

            addNonEnumerableProperty(ret, mapSizeProperty, ownKeys.length);
            addNonEnumerableProperty(
              ret, mapKeysProperty, () => ownKeys.map(k => k.replace(mapKeyPrefix, ''))
            );
            addNonEnumerableProperty(ret, mapIndexOfProperty, (k) => ownKeys.indexOf(
              `${k.startsWith(mapKeyPrefix) ? '' : mapKeyPrefix}${k}`
            ));
          }

          ownKeys
            .forEach(k => {
              const _path = toFqPath({ type, parent: path, prop: k });
              let _sPath = sPath;

              switch (type) {
                case 'object':
                  _sPath += `.${k}`;
                  break;
                case 'array':
                  _sPath += `_$`;
                  break;
                case 'map':
                  _sPath += `.$_`;
                  break;
              }

              ret[k] = this.#buildObjectFromMap(_path, _sPath, ret, k, false, entries, visitor);
            });

          return ret;
      }
    })();

    if (typeof visitor == 'function') {
      visitor({ path, sPath, key, value, parentObject, primary });
    }

    return value;
  }

  #getOwnKeysFromMap(type, path, entries) {
    switch (type) {
      case 'object':
        const trie = this.getPathTrie();
        return Object.keys(
          (path ? trie.getNode(path) : trie.getRoot()).getChildren()
        )
          .filter(k => !k.startsWith('@'));
      case 'array':
        return [
          ...new Array(
            this.#getArrayLengthFromMap(path, entries)
          )].map((e, i) => `${i}`);
      case 'map':
        return entries.get(`${path}.@keys`);
      default:
        throw Error(`Unknown type "${type}"`);
    }
  }

  #getArrayLengthFromMap(path, entries) {
    return entries.get(`${path}.length`);
  }

  #addInputMapEntries({ path, value, parentObject, key, dataVariables, visitor }) {
    const { typeProperty } = RootProxy;
    const { toCanonicalPath, getAllSegments } = clientUtils;

    const sPath = toCanonicalPath(path);

    const b = this.#tryOrLogError(
      () => {
        value = this.#invokeTransformers(
          this.component.getInitializers(), this.component.getTransformers(), path, sPath, value, parentObject,
        );

        this.#validateSchema(path, sPath, value, parentObject);
      });

    if (!b) {
      return { error: true };
    }

    visitor({ path, sPath, key, value, parentObject, primary: true });

    if (value != null && ['Object', 'Array'].includes(value.constructor.name)) {

      const b = this.#tryOrLogError(
        () => {
          this.#toCanonicalTree({
            path, sPath, obj: value, visitor, parentObject,
          });
        }
      );

      if (!b) {
        return { error: true };
      }
    }

    const segments = getAllSegments(path);

    this.#addPathToTrie(path, segments);

    const type = this.#getValueType(value);

    this.#addPathToTrie(`${path}.@type`, [...segments, '@type']);
    this.#addToInputMap(`${path}.@type`, type);

    switch (true) {

      case type == 'map':
        delete value[typeProperty];

        this.#addPathToTrie(`${path}.@keys`, [...segments, '@keys']);
        this.#addToInputMap(`${path}.@keys`, Object.keys(value));
        break;

      case ['literal', 'component'].includes(type):
        this.#addToInputMap(path, value);
        break;
    }

    if (dataVariables) {

      Object.entries({
        ...dataVariables,
        random: this.component.randomString('random')
      })
        .map(([k, v]) => [`@${k}`, v])
        .forEach(([k, v]) => {
          this.#addPathToTrie(`${path}.${k}`, [...segments, k]);
          this.#addToInputMap(`${path}.${k}`, v);
        });
    }

    return { error: false };
  }

  #removeInputMapEntries(path) {
    const entries = new Map();

    const val = this.#removeFromInputMap(path);

    if (val !== undefined) {
      entries.set(path, val);
    }

    this.getTrieSubPaths(path)
      .forEach(p => {
        const val = this.#removeFromInputMap(p);

        if (val !== undefined) {
          entries.set(p, val);
        }
      });

    return entries;
  }

  #getDynamicObjectProxy(type, path) {
    const {
      pathProperty, isMapProperty, mapSizeProperty, mapKeysProperty, mapIndexOfProperty,
      parentRefProperty, isLiveProperty, mapKeyPrefix, getReservedObjectKeys,
      getReservedMapKeys, toFqPath,
    } = RootProxy;

    const { getPathStringInfo } = clientUtils;

    assert(['array', 'map', 'object'].includes(type));

    this.#ensureInputMapNotPruned();

    const isArray = type == 'array';
    const isMap = type == 'map';

    const _this = this;

    const proxy = new Proxy(
      isArray ? [] : {},
      {
        ownKeys: () => {
          this.#ensureInputMapNotPruned();

          return [
            ...this.#getOwnKeysFromMap(type, path, this.#inputMap),
            ...isArray ? ['length'] : [],
          ];
        },

        getOwnPropertyDescriptor: (obj, prop) => {
          return {
            writable: true,
            value: proxy[prop],
            enumerable: prop !== 'length',
            configurable: prop !== 'length',
          };
        },

        deleteProperty: (obj, prop) => {
          this.#ensureInputMapNotPruned();

          return this.#simpleSetMutationHandler(proxy, prop, undefined);
        },

        get: (obj, prop) => {
          this.#ensureInputMapNotPruned();

          if (isArray) {
            switch (prop) {

              case 'length':
                return this.#getArrayLengthFromMap(path, this.#inputMap);

              case Symbol.iterator:
                return function* () {
                  const keys = _this.#getOwnKeysFromMap(type, path, _this.#inputMap);

                  for (let i = 0; i < keys.length; i++) {
                    yield proxy[i];
                  }
                };

              case 'splice':
                return (index, delCount, ...replElements) => {
                  return this.#arraySpliceMutationHandler(proxy, index, delCount, replElements);
                };

              case 'unshift':
                return (...elements) => {
                  this.#arraySpliceMutationHandler(proxy, 0, 0, elements);
                  return proxy.length;
                };

              case 'shift':
                return () => {
                  return this.#arraySpliceMutationHandler(proxy, 0, 1, [])[0];
                };

              case 'reverse':
                return () => {
                  const offsetIndexes = {};
                  const len = proxy.length;

                  for (let i = 0; i < len; i++) {
                    offsetIndexes[i] = len - 1 - i;
                  }

                  this.#arrayReorderMutationHandler(proxy, offsetIndexes);
                  return proxy;
                };

              case 'sort':
                return (sortFn) => {
                  const arr = Object.keys(proxy).map(k => proxy[k]);
                  const _arr = [...arr];

                  _arr.sort(sortFn);
                  const offsetIndexes = {};

                  for (let i = 0; i < arr.length; i++) {
                    offsetIndexes[i] = _arr.indexOf(arr[i]);
                  }

                  this.#arrayReorderMutationHandler(proxy, offsetIndexes);
                  return proxy;
                };

              case 'filter':
                return (filterFn) => {
                  const ret = [];
                  for (const e of proxy[Symbol.iterator]()) {
                    if (filterFn(e)) {
                      ret.push(e);
                    }
                  }
                  return ret;
                };

              case 'forEach':
                return (consumerFn) => {
                  for (const e of proxy[Symbol.iterator]()) {
                    consumerFn(e)
                  }
                };

              case 'findIndex':
                return (consumerFn) => {
                  const keys = _this.#getOwnKeysFromMap(type, path, _this.#inputMap);

                  for (let i = 0; i < keys.length; i++) {
                    if (consumerFn(proxy[i])) {
                      return i;
                    }
                  }

                  return -1;
                };
            }
          }

          if (isMap) {
            switch (prop) {
              case mapSizeProperty:
                return Reflect.ownKeys(proxy).length;

              case mapIndexOfProperty:
                return (k) => Reflect.ownKeys(proxy).indexOf(
                  `${k.startsWith(mapKeyPrefix) ? '' : mapKeyPrefix}${k}`
                );

              case mapKeysProperty:
                return () => Reflect.ownKeys(proxy).map(k => k.replace(mapKeyPrefix, ''));
            }
          }

          if (this.component.isHeadlessContext()) {
            switch (prop) {
              case global.nodeCustomInspect:
                return (depth, options) => global.nodeInspect(
                  proxy.toJSON(), { ...options, customInspect: false }
                );
            }
          }

          switch (prop) {
            case pathProperty:
              return path;

            case parentRefProperty:
              if (path) {
                const { parent } = getPathStringInfo(path);
                const type = parent ? this.#lookupInputMap0(`${parent}.@type`) : 'object';

                return this.#getDynamicObjectProxy(type, parent)
              }
              return null;

            case isLiveProperty:
              return true;

            case isMapProperty:
              return isMap;

            case Symbol.toPrimitive:
              return JSON.stringify(proxy.toJSON());

            case Symbol.toStringTag:
              return 'stringTag';

            case 'toJSON':
              return () => {
                if (path) {
                  const { key } = getPathStringInfo(path);

                  return this.#buildObjectFromMap(
                    path, null, proxy[parentRefProperty], `${key}`, true, this.#inputMap
                  );
                }

                const ret = {};
                this.#getOwnKeysFromMap(type, path)
                  .forEach(k => {
                    ret[k] = this.#buildObjectFromMap(k, k, ret, k, true, this.#inputMap);
                  });
                return ret;
              };

            case 'constructor':
              return isArray ? Array : Object;

            default:

              const _path = toFqPath({
                type, parent: path,
                prop: `${isMap && !prop.startsWith(mapKeyPrefix) ? mapKeyPrefix : ''}${prop}`
              });

              const val = this.#lookupInputMap0(_path);

              if (val !== undefined) {
                return val;
              }

              const _type = this.#lookupInputMap0(`${_path}.@type`);

              if (!_type) {
                return undefined;
              }

              return this.#getDynamicObjectProxy(_type, _path);
          }
        },

        set: (obj, prop, newValue) => {
          this.#ensureInputMapNotPruned();

          if (
            typeof prop == 'string' &&
            (getReservedObjectKeys().includes(prop) ||
              (isMap && getReservedMapKeys().includes(prop)))
          ) {
            this.#logError(`Unable to set value ${path + (path ? '.' : '')}${prop}`);
            return false;
          }

          return this.#simpleSetMutationHandler(proxy, prop, newValue);
        }
      });

    return proxy;
  }

  /**
 * The browser will discard our observer proxy if it ever throws a single error hence we must not throw any errors.
  So we need to route functions that can throw user-generated error through this function
 */
  #tryOrLogError(fn) {
    try {
      fn();
      return true;
    } catch (e) {
      this.#logError(`Uncaught ${e.constructor.name}: ${e.message}`);
      return false;
    }
  }

  #logError(msg) {
    this.component.logger.error(msg);
  }

  #getCollChildDataVariables({ index, length, type, prop }) {
    const { mapKeyPrefixRegex } = RootProxy;

    const first = index == 0 || (index < 0 && length == 0)
    const last = index == length - 1 || type == 'map' ? index < 0 : index >= length;
    const key = type == 'array' ? `${prop}` : prop.replace(mapKeyPrefixRegex, '');
    const i = type == 'array' ? index : length;

    return {
      first, last, key, index: i,
    }
  }

  #isCollectionObject(obj) {
    const { isMapProperty } = RootProxy;
    return Array.isArray(obj) || (obj && obj[isMapProperty]);
  }

  getInfoFromPath(path) {
    assert(path.length);

    const value = (p) =>
      this.component.resolver ? this.component.resolver.resolve({ path: p }) :
        this.lookupInputMap(p);

    const { parent, key: childKey } = clientUtils.getPathStringInfo(path);

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

    const dataPrefix = `${dataPathRoot}${pathSeparator}`;
    const fqPath = `${dataPrefix}${path}`;

    await Promise.all([

      queryFn(this, 'owner', fqPath)
        .then(arr => {
          arr.forEach(hook => {
            addToHookList(hook.owner, hook);
          });
        }),

      includeLogicGates ? queryFn(this, 'participants', path)
        .then(arr => {

          arr.forEach(hook => {
            const { owner, participants, canonicalParticipants, blockData } = hook;
            const gateId = owner.replace(logicGatePathPrefix, '');

            participants.forEach((p, i) => {
              if (!p.startsWith(path)) return;

              addToHookList(
                `${dataPrefix}${p}`,
                {
                  type: gateParticipantHookType, gateId,
                  blockData, canonicalPath: canonicalParticipants[i],
                  parentHook: hook, loc: hook.loc,
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

          this.getTrieSubPaths(path)
            .forEach(p => {
              visitPath(p);
            });

        })();
        break;

      case filter_GTE_OBJ_MEMBER:
        (() => {
          addHooksforPath(path);

          this.getTrieSubPaths(path)
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

  async #updateDOM(parent, changeSet, finalizers, exclusionSet, blockDataTransformer) {
    if (this.component.isHeadlessContext() || !this.component.isComponentRendered()) return;

    if (this.component.hasPendingHooks()) {

      await new Promise(resolve => {
        this.component.once('popHooksQueue', new EventHandler(() => {
          _resolve();
        }, null, { _resolve: resolve }));
      })
    }

    const [_hookList, metadata] = await Promise.all([
      this.getHookListFromPath(parent, true, true), this.component.getMetadata(),
    ]);

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
                blockDataTransformer,
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

  getObjectDefiniton(sPath) {
    const { toDefinitionName } = RootProxy;

    const defPrefx = '#/definitions/';
    const schemaDefinitions = this.#getSchemaDefinitions();

    const k = sPath ? toDefinitionName(sPath) : this.component.getComponentName();

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

    const { additionalProperties } = this.#getSchemaDefinitions()[
      getSchemaKey(path)
    ];

    return additionalProperties ? {
      collectionType: 'map',
      ...additionalProperties,
    } : false;
  }

  getArrayDefinition(path) {
    if (!path.length) return false;
    const { getSchemaKey } = RootProxy;

    const { items } = this.#getSchemaDefinitions()[
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

  static addNonEnumerableProperty(obj, prop, value) {
    Object.defineProperty(obj, prop, { value, enumerable: false, configurable: false, });
  }

  /**
   * This constructs a key that can be used to make a call to {dataPathHooks}
   * @returns String
   */
  static toFqPath({ type, isArray, isMap, parent, prop, key }) {
    return clientUtils.toFqPath({ type, isArray, isMap, parent, prop, key });
  }

  #validateSchema(path, sPath, value, parentObj) {
    const { toDefinitionName, isMapObject, getEnum } = RootProxy;

    const schemaDefinitions = this.#getSchemaDefinitions();

    const {
      $ref, type, additionalProperties, items, component, enum: enum0
    } = schemaDefinitions[
      toDefinitionName(sPath || clientUtils.toCanonicalPath(path))
      ];

    if (value == null) return;

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

  #getNonNullValueForType(type) {
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

  #getDefinedInitializerForPath(initializers, path, sPath) {
    let ret = initializers[path];

    if (!ret) {
      ret = initializers[sPath];
    }

    return ret ? ret[0] : undefined;
  }

  #invokeTransformers(initializers, transformers, path, sPath, val, parentObject) {

    if (val === undefined) {
      const initializer = this.#getDefinedInitializerForPath(initializers, path, sPath);

      val = (typeof initializer == 'function') ? initializer(parentObject) : initializer;
    }

    if (val == null && this.component.getNonNullPaths().includes(sPath)) {
      const { type } = this.#getSchemaDefinitions()[
        getSchemaKey(sPath)
      ];

      val = this.#getNonNullValueForType(type);
    }

    const fnList = [...new Set([
      ...transformers[path] || [],
      ...transformers[sPath] || [],
    ])];

    const initial = !this.#input;
    let v = val;

    fnList.forEach(fn => {
      let y = fn(v, initial, parentObject);

      if (y === undefined) {
        y = null;
      }

      v = y;
    });

    return v;
  }

  static setObjectParentRef(value, parentObject) {
    const { parentRefProperty, addNonEnumerableProperty } = RootProxy;

    if (['Array', 'Object'].includes(value.constructor.name)) {
      addNonEnumerableProperty(value, parentRefProperty, parentObject);
    } else {
      assert(value instanceof BaseComponent);
      value.addMetaInfo('parentRef', parentObject);
    }
  }

  #addPathToTrie(path, segments) {
    const trie = this.getPathTrie();

    if (!segments) {
      segments = clientUtils.getAllSegments(path);
    }

    trie.insert(path, segments);
  }

  #toCanonicalTree({ path, sPath, segments, obj, visitor, parentObject, initializers, transformers, root = true }) {

    const {
      dataPathPrefix, typeProperty, mapType, mapKeyPrefix, getReservedObjectKeys,
      getReservedMapKeys, toFqPath,
    } = RootProxy;

    if (root) {
      initializers = this.component.getInitializers();
      transformers = this.component.getTransformers();

      if (path.length) {
        if (!sPath) {
          sPath = clientUtils.toCanonicalPath(path);
        }
        segments = clientUtils.getAllSegments(path);
      } else {
        sPath = '';
        segments = [];
      }
    }

    assert(!path.match(dataPathPrefix));

    const reservedObjectKeys = getReservedObjectKeys();

    Object.keys(obj)
      .forEach(k => {
        if (typeof k == 'string' && reservedObjectKeys.includes(k)) {
          this.component.throwError(`[${path}] An object cannot contain the key: ${k}`);
        }
      });

    switch (true) {

      case !!this.getMapDefinition(sPath):
        const reservedMapKeys = getReservedMapKeys();

        // If this is a map path, add set @type to Map, and transform the keys
        // to start with the map key prefix: $_

        for (const k of Object.keys(obj)) {

          if (reservedMapKeys.includes(k)) {
            this.component.throwError(`[${path}] A map cannot contain the reserved key: ${k}`);
          }

          obj[`${mapKeyPrefix}${k}`] = obj[k];
          delete obj[k];
        }

        Object.defineProperty(obj, typeProperty, { value: mapType, enumerable: false, configurable: true });

        break;

      case obj.constructor.name == 'Object':
        const def = this.getObjectDefiniton(sPath);
        const keys = Object.keys(obj);

        // Add missing properties
        def.required
          .filter(p => !keys.includes(p))
          .forEach(p => {
            obj[p] = undefined;
          });
        break;
    }

    const isArray = Array.isArray(obj);
    const isMap = !isArray && (obj[typeProperty] === mapType);

    const isCollection = isArray || isMap;

    const keys = Object.keys(obj);

    if (isArray) {
      this.#addPathToTrie(`${path}.length`, [...segments, 'length']);
      this.#addToInputMap(`${path}.length`, keys.length);
    }

    for (let i = 0; i < keys.length; i++) {
      const prop = keys[i];

      const key = clientUtils.toFqKey({ isArray, isMap, prop });

      const _path = toFqPath({ parent: path, key });
      const _sPath = sPath + (
        isArray ? '_$' : isMap ? '.$_' : `${sPath ? '.' : ''}${prop}`
      );
      const _segments = [...segments, key];

      obj[prop] = this.#invokeTransformers(initializers, transformers, _path, _sPath, obj[prop], obj);

      this.#validateSchema(_path, _sPath, obj[prop], obj);

      visitor({ path: _path, sPath: _sPath, key: prop, parentPath: path, value: obj[prop] });

      if (obj[prop] != null && ['Object', 'Array'].includes(obj[prop].constructor.name)) {

        this.#toCanonicalTree({
          path: _path, sPath: _sPath, segments: _segments,
          obj: obj[prop], parentObject: obj,
          visitor, initializers, transformers,
          root: false
        });
      }

      this.#addPathToTrie(_path, _segments);

      const type = this.#getValueType(obj[prop]);

      this.#addPathToTrie(`${_path}.@type`, [..._segments, '@type']);
      this.#addToInputMap(`${_path}.@type`, type);

      switch (true) {
        case type == 'map':
          delete obj[prop][typeProperty];

          this.#addPathToTrie(`${_path}.@keys`, [..._segments, '@keys']);
          this.#addToInputMap(`${_path}.@keys`, Object.keys(obj[prop]));
          break;

        case ['literal', 'component'].includes(type):
          this.#addToInputMap(_path, obj[prop]);
          break;
      }

      if (isCollection) {

        this.#getLeafsForDataVariables(_path, _sPath, keys, i)
          .forEach(leaf => {
            const { key, path, value } = leaf;
            visitor(leaf);

            this.#addPathToTrie(path, [..._segments, key]);
            this.#addToInputMap(path, value);
          });
      }
    }
  }

  #getValueType(val) {
    const { typeProperty, mapType } = RootProxy;
    return val !== Object(val) ? 'literal' :
      val instanceof BaseComponent ? 'component' :
        Array.isArray(val) ? 'array' :
          val[typeProperty] == mapType ? 'map' :
            'object';
  }

  #getLeafsForDataVariables(path, sPath, keys, index) {
    const { getDataVariables, randomProperty } = RootProxy;
    const { getDataVariableValue } = RootCtxRenderer;

    return getDataVariables()
      .map(name => ({
        path: `${path}.${name}`,
        sPath: `${sPath}.${name}`,
        key: name,
        parentPath: path,
        value: (name == randomProperty) ?
          this.component.randomString('random') :
          getDataVariableValue(name, index, keys),
      }));
  }

  static getReservedObjectKeys() {
    const {
      pathProperty, isMapProperty, parentRefProperty, isLiveProperty, keyProperty,
      indexProperty, firstProperty, lastProperty, randomProperty,
    } = RootProxy;

    return [
      pathProperty, isMapProperty, parentRefProperty, isLiveProperty, keyProperty,
      indexProperty, firstProperty, lastProperty, randomProperty,
    ];
  }

  static getReservedMapKeys() {
    const { mapSizeProperty, mapKeysProperty, mapIndexOfProperty } = RootProxy;
    return [mapSizeProperty, mapKeysProperty, mapIndexOfProperty];
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

  dbEqualsQuery(storeName, indexName, value) {
    const { INDEXEDDB_EQUALS_QUERY_TASK } = RootProxy;

    return this.#getDbWorker() ? this.runTask(
      INDEXEDDB_EQUALS_QUERY_TASK, storeName, indexName, value,
    ) :
      this.getDbConnection()
        .equalsQuery(storeName, indexName, value);
  }

  dbStartsWithQuery(storeName, indexName, prefix) {
    const { INDEXEDDB_STARTSWITH_QUERY_TASK } = RootProxy;

    return this.#getDbWorker() ? this.runTask(
      INDEXEDDB_STARTSWITH_QUERY_TASK, storeName, indexName, prefix,
    ) :
      this.getDbConnection()
        .startsWithQuery(this, storeName, indexName, prefix);
  }

  dbPut(storeName, rows) {
    const { INDEXEDDB_PUT_TASK } = RootProxy;

    return this.#getDbWorker() ? this.runTask(
      INDEXEDDB_PUT_TASK, storeName, rows,
    ) :
      this.getDbConnection()
        .put(storeName, rows);
  }

  dbDelete(storeName, ids) {
    const { INDEXEDDB_DELETE_TASK } = RootProxy;

    return this.#getDbWorker() ? this.runTask(
      INDEXEDDB_DELETE_TASK, storeName, ids,
    ) :
      this.getDbConnection()
        .delete(storeName, ids);
  }

  static MustacheStatementList = class MustacheStatementList {
    static primaryKey = K_Database.DEFAULT_PRIMARY_KEY;

    static getStoreName(proxy) {
      const { bucketName } = proxy.getDbInfo();
      return `${bucketName}_mustache_statements`;
    }

    static query(proxy, groupId, id) {
      const storeName = this.getStoreName(proxy);
      const indexName = groupId ? this.getIndexName('groupId') : null;

      const componentId = proxy.component.getId();

      return proxy.dbEqualsQuery(storeName, indexName, groupId || `${componentId}_${id}`)
        .then(
          rows => rows.filter(
            ({ [this.primaryKey]: id }) => groupId ? id.startsWith(`${componentId}_`) : true,
          ).map(row => ({ ...row, [this.primaryKey]: row[this.primaryKey].replace(`${componentId}_`, '') }))
        );
    }

    static async put(proxy, rows) {
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

      await proxy.dbPut(storeName, _rows);

      return ids;
    }

    static getIndexName(columnName) {
      return `${columnName}_index`;
    }
  }

  static HookList = class HookList {
    static primaryKey = K_Database.DEFAULT_PRIMARY_KEY;

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
      const storeName = this.getStoreName(proxy);

      return proxy.dbDelete(storeName, ids)
    }

    static equalsQuery(proxy, colName, value) {
      const storeName = this.getStoreName(proxy);
      const indexName = this.getIndexName(colName);

      return proxy.dbEqualsQuery(storeName, indexName, value)
        .then(rows => rows.filter(
          ({ [this.primaryKey]: id }) => id.startsWith(`${proxy.component.getId()}_`),
        ));
    }

    static startsWithQuery(proxy, colName, prefix) {
      const storeName = this.getStoreName(proxy);
      const indexName = this.getIndexName(colName);

      return proxy.dbStartsWithQuery(storeName, indexName, prefix)
        .then(rows => rows.filter(
          ({ [this.primaryKey]: id }) => id.startsWith(`${proxy.component.getId()}_`),
        ));
    }

    static async put(proxy, rows) {
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

      await proxy.dbPut(storeName, _rows);

      return ids;
    }

    static getIndexName(columnName) {
      return `${columnName}_index`;
    }
  }
}

module.exports = RootProxy;
