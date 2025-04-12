/* eslint-disable linebreak-style */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-case-declarations */

// eslint-disable-next-line no-undef
class BaseComponent extends WebRenderer {

  static #token;

  static eventNameDelim = /\s*\|\s*/g;

  static handlerFunctionPrefix = 'f_';
  static oncePattern = /_once$/g;

  static #staticHandlers = {};

  static #refsMap = new Map();
  static #idToRefMap = new Map();

  #inlineParent;

  #handlers;
  #handlerFunctions = {};

  #eventLock = [];

  #randomString;

  #domUpdateHooks = [];


  static #serverEvents;
  #serverEventDispatches = new Map();
  #serverEventListeners;


  // #API
  static CONSTANTS = {
    // Paths/Introspection
    pathSeparator: RootProxy.pathSeparator,
    pathProperty: RootProxy.pathProperty,
    parentRefProperty: RootProxy.parentRefProperty,
    // Data Variables
    firstProperty: RootProxy.firstProperty,
    lastProperty: RootProxy.lastProperty,
    keyProperty: RootProxy.keyProperty,
    indexProperty: RootProxy.indexProperty,
    randomProperty: RootProxy.randomProperty,
    // Data types
    literalType: RootProxy.literalType,
    arrayType: RootProxy.arrayType,
    objectType: RootProxy.objectType,
    mapType: RootProxy.mapType,
    componentRefType: RootProxy.componentRefType,
    // Hook Types
    predicateHookType: RootProxy.predicateHookType,
    conditionalBlockHookType: RootProxy.conditionalBlockHookType,
    eachBlockHookType: RootProxy.eachBlockHookType,
    textNodeHookType: RootProxy.textNodeHookType,
    nodeAttributeHookType: RootProxy.nodeAttributeHookType,
    nodeAttributeKeyHookType: RootProxy.nodeAttributeKeyHookType,
    nodeAttributeValueHookType: RootProxy.nodeAttributeValueHookType,
    collChildSetHookType: RootProxy.collChildSetHookType,
    collChildDetachHookType: RootProxy.collChildDetachHookType,
    arraySpliceHookType: RootProxy.arraySpliceHookType,
    // Mutation Types
    mutationType_SET: RootProxy.mutationType_SET,
    mutationType_SPLICE: RootProxy.mutationType_SPLICE,
    mutationType_DELETE: RootProxy.mutationType_DELETE,
  };

  constructor({ id, input = {}, logger, config, ref, serverEventListeners, isRoot, } = {}) {

    super({ id, input, logger, config, isRoot });

    if (!BaseComponent.#token) {
      // eslint-disable-next-line no-undef
      BaseComponent.#token = global.clientUtils.randomString('ungrouped');
      // eslint-disable-next-line no-undef
      RootCtxRenderer.setToken(BaseComponent.#token);
    }

    this.#handlers = {};

    if (ref) {
      BaseComponent.#refsMap.set(ref, this);
      BaseComponent.#idToRefMap.set(this.getId(), ref);
    }

    this.#serverEventListeners = serverEventListeners;
  }

  awaitHtmlDependencies() {
    return false;
  }

  static onComponentPruned(id) {
    const ref = BaseComponent.#idToRefMap.get(id);

    if (ref) {
      BaseComponent.#idToRefMap.delete(id);
      BaseComponent.#refsMap.delete(ref);
    }
  }

  static getComponentByRef(ref) {
    return BaseComponent.#refsMap.get(ref);
  }

  #addDomUpdateHook(fn) {
    this.#domUpdateHooks.push(fn);
  }

  getDomUpdateHooks() {
    return [...this.#domUpdateHooks];
  }

  pruneDomUpdateHooks() {
    this.#domUpdateHooks = null;
    this.#domUpdateHooks = [];
  }

  updateInputData(targetComponent, parentObject, prop, value) {
    return new Promise((resolve) => {
      targetComponent.#addDomUpdateHook(() => {
        resolve();
      });
      parentObject[prop] = value;
    });
  }

  setInlineParent(inlineParent) {
    assert(
      this.#inlineParent === undefined ||
      // Component instances may be re-used at compile-time
      !self.appContext
    );
    this.#inlineParent = inlineParent;
  }

  getInlineParent() {
    return this.#inlineParent;
  }

  // eslint-disable-next-line class-methods-use-this
  toHtml(value) {

    if (value instanceof Promise || value instanceof BaseComponent) {
      return '';
    }

    const { mapKeyPrefixRegex, getDataVariables } = RootProxy;

    const replacer = (name, val) => {
      if (val && val.constructor.name === 'Object') {
        const keys = Object.keys(val);

        // Remove data variables from <keys>
        if (keys.includes(getDataVariables()[0])) {
          for (const variable of getDataVariables()) {
            assert(keys.includes(variable));
            keys.splice(keys.indexOf(variable), 1);
          }
        }

        const o = {};

        keys.forEach(k => {
          o[k
            // Remove $_ prefixes for map keys, if applicable
            .replace(mapKeyPrefixRegex, '')
          ] = val[k];
        });

        return o;
      }
      return val;
    }

    return Object(value) !== value ? `${value}` : JSON.stringify(value, replacer, null);
  }

  getRenderedHtml() {
    return super.getRenderedHtml({
      token: BaseComponent.#token,
    });
  }

  // #API
  initializers() {
    return {};
  }

  // #API
  // Note: This is used only for object members, not collection members
  immutablePaths() {
    return [];
  }

  // #API
  load(opts = {}) {
    return super.load({
      token: BaseComponent.#token,
      ...opts,
    });
  }

  render({ data, target, transform, loc }) {
    if (data === undefined) {
      return Promise.resolve();
    }

    assert(target);

    const { promise, futures, extendedFutures } = this.getRenderContext();

    return this.#render0({ data, target, transform, promise, futures, extendedFutures });
  }

  eagerlyInline() {
    return false;
  }

  #render0({ data, target, transform, promise, futures, extendedFutures }) {

    const future = Promise.resolve(data)
      // eslint-disable-next-line no-shadow
      .then(async data => {

        if (data === undefined) {
          // eslint-disable-next-line no-param-reassign
          data = '';
        }

        const isComponent = data instanceof BaseComponent;

        if (isComponent) {
          extendedFutures.push(
            new Promise((resolve) => {
              data.on('afterMount', resolve);
            })
          )
        }

        let html;
        let renderContext;


        const load0 = async () => {

          if (isComponent) {
            const root = this.isRootComponent();
            const rand = clientUtils.getRandomInt;

            await new Promise(resolve => {
              setTimeout(
                resolve,
                (this.getInstanceIndex() % 2 == 0) ?
                  root ? rand(0, 1) : rand(10, 20) :
                  root ? rand(3, 5) : rand(21, 30)
              );
            });

            const ret = await data.getRenderedHtml();

            html = ret.htmlString;
            renderContext = ret.renderContext;

          } else {
            html = this.toHtml(data);
          }

          if (transform) {
            html = this[transform](html);
          }

          assert(html != undefined);

          await promise;

          const node = document.querySelector(target);

          if (data instanceof BaseComponent) {
            await data.load({
              container: target,
              html,
              renderContext,
            });
          } else {
            node.innerHTML = html;
          }
        }

        if (isComponent && (this.isRootComponent() || this.isMounted())) {
          load0();

        } else {
          this.on('load', () => {
            load0()
          });
        }
      });

    futures.push(future);

    return future;
  }

  // #API
  log(msg, level = 'info') {
    // Todo: verify level
    this.logger[level](`[${this.getId()}] ${msg}`);
  }

  /**
   * The main goal for this is to allow the component dynamically register fields 
   * in it's object model. Note: this method is only invoked at compile-time.
   * Also, note that there is no way to define map and component types here. This can only
   * be done from the template
   * 
   */
  beforeCompile() {
  }

  // #API
  behaviours() {
    return ['destroy'];
  }
  // #API
  events() {
    return ['destroy'];
  }

  defaultHandlers() {
    return {};
  }

  static getNodeId(node) {
    assert(node.id);
    return node.id;
  }

  // #API
  getHandlers() {
    return this.#handlers;
  }

  // #API
  setHandlers(handlers) {
    this.#handlers = handlers;
  }

  // #API
  getHandlerFunctions() {
    return this.#handlerFunctions;
  }

  // #API
  setHandlerFunctions(handlerFunctions) {
    this.#handlerFunctions = handlerFunctions;
  }

  pruneLifecycleEventHandlers() {
    const { handlerFunctionPrefix } = BaseComponent;

    Object.entries(this.#handlers)
      .filter(([k]) => this.isLifecycleEvent(k))
      .forEach(([k, v]) => {

        Object.keys(v)
          .filter(h => h.startsWith(handlerFunctionPrefix))
          .forEach(h => {
            delete this.#handlerFunctions[h];
          });

        delete this.#handlers[k];
      });
  }

  getAllHandlerFunctions(event) {
    const handlerFunctions = {};
    const _this = this;

    Object.entries(this.getEventHandlers())
      .forEach(([k, v]) => {
        handlerFunctions[k] = function (...args) {
          v.forEach(fn => {
            try {
              fn.bind(this)(...args);
            } catch (e) {
              _this.#logEventHandlerError(e, event, fn);
            }
          });
        }
      });

    return {
      ...handlerFunctions,
      ...this.#handlerFunctions,
    };
  }

  #addHandlerFunction(fn) {
    const { handlerFunctionPrefix } = BaseComponent;

    const str = `${handlerFunctionPrefix}${this.randomString('handlerFunctions')}`;
    this.#handlerFunctions[str] = fn;

    return str;
  }

  #convertEventHandlerToString(handler) {
    assert(handler instanceof EventHandler);

    return this.#addHandlerFunction(handler);
  }

  #convertHandlerFnToString(evtName, handler) {
    if (!this.isLifecycleEvent(evtName)) {
      throw Error(
        `"${evtName}" is not a lifecycle event, hence <handler> cannot be a function. Use EventHandler instead`
      );
    }

    return this.#addHandlerFunction(handler);
  }

  // #API
  once(evtName, handler) {
    this.#on0(evtName, handler, true);
    return this;
  }

  #on0(evtName, handler, once) {

    if (typeof handler == 'function') {
      handler = this.#convertHandlerFnToString(evtName, handler);
    }

    if (handler instanceof EventHandler) {
      handler.setEventName(evtName);
      handler = this.#convertEventHandlerToString(handler);
    }

    assert(typeof handler == 'string');

    // check if the event is currently in dispatch mode
    if (this.#eventLock.includes(evtName)) {
      throw Error(`Event "${evtName}" is currently being dispatched and cannot be modified`);
    }

    const handlers = this.#handlers[evtName] || (this.#handlers[evtName] = {});
    handlers[`${handler}${once ? '_once' : ''}`] = true;
  }

  // #API
  on(evtName, handler) {
    const { eventNameDelim } = BaseComponent;

    evtName.split(eventNameDelim).forEach((name) => {
      this.#on0(name, handler, false);
    });

    return this;
  }

  #newEventContext() {
    const _this = this;

    return new class {
      constructor() {
        this.defaultPrevented = false;
        this.component = _this;
      }

      preventDefault() {
        this.defaultPrevented = true;
      }
    }
  }

  getBehavioursSignature() {
    const name = this.getComponentName();
    const classMetadata = self.appContext.getComponentClassMetadataMap()[name];

    if (!classMetadata.behavioursSignature) {
      classMetadata.behavioursSignature = this.getSyntheticMethod({ name: 'behavioursSignature' })();
    }

    return classMetadata.behavioursSignature;
  }

  getEventsSignature() {
    const name = this.getComponentName();
    const classMetadata = self.appContext.getComponentClassMetadataMap()[name];

    if (!classMetadata.eventsSignature) {
      classMetadata.eventsSignature = this.getSyntheticMethod({ name: 'eventsSignature' })();
    }

    return classMetadata.eventsSignature;
  }

  #validateArgTypes(resourceType, resourceName, argTypes, args) {
    const throwSchemaError = (msg) => {
      throw Error(`Schema mismatch occured for ${resourceType} "${resourceName}": ${msg}`);
    }

    if (argTypes.length != args.length) {
      throwSchemaError(`expected arg length of ${argTypes.length} but found ${args.length}`);
    }

    for (let i = 0; i < argTypes.length; i++) {
      const { type, $ref } = argTypes[i];

      if (type) {
        if (typeof args[i] != type.toLowerCase()) {
          throwSchemaError(`expected ${type.toLowerCase()} but found ${typeof args[i]} at arg[${i}]`);
        }
      } else {
        assert($ref, `Unable to parse signature for ${resourceType} "${resourceName}"`);

        try {
          this.proxyInstance.validateSchema(`arg[${i}]`, $ref, args[i]);
        } catch (e) {
          throwSchemaError(e.message);
        }
      }
    }
  }

  async #dispatchServerEvent(event, ...args) {
    const { unsafeEval, decompressArrayBuf } = AppContext;

    if (!this.#serverEventListeners) return;

    if (this.#serverEventDispatches.get(event)) {
      // this event is already currently being dispatched, return
      return;
    }

    const uri = this.#serverEventListeners[event];
    if (!uri) return;

    const initial = !this.#serverEventDispatches.has(event);

    this.#serverEventDispatches.set(event, true);

    const body = { uri, initial };

    for (let i = 0; i < args.length; i++) {
      body[`arg${i}`] = args[i];
    }

    const sessionId = self.appContext.getSessionId();

    const argTypes = this.getEventsSignature()[event];

    if (argTypes) {
      this.#validateArgTypes('event', event, argTypes, args);
    }

    const queryParams = new URLSearchParams();
    queryParams.append('sessionId', sessionId);
    queryParams.append('eventName', event);
    queryParams.append('componentType', this.constructor.name);

    const loadedComponents = Object.entries(self.appContext.getComponentList())
      .map(([k], i) => global.components[k] ? i : null)
      .filter(e => e != null);

    const response = await self.fetch(
      `${self.appContext.getComponentServiceUri()}/dispatch-event?${queryParams.toString()}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Loaded-Components': JSON.stringify(loadedComponents)
        },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      throw new Error(`Unable to dispatch event "${event}" to the server`);
    }

    const filesStart = Number(response.headers.get('Files-Start'));
    const buffer = await response.arrayBuffer();

    const dataStart = new TextDecoder('utf-8').decode(buffer.slice(0, filesStart));

    const { runtimeBootConfig, fileIndices } = JSON.parse(dataStart);
    const { renderTree, cssDependencies, jsDependencies } = runtimeBootConfig;

    const cssDepsPromise = self.appContext.loadCSSDependencies(cssDependencies);
    const jsDepsPromise = self.appContext.loadJSDependencies(jsDependencies);

    const fileEntries = Object.entries(fileIndices);

    for (let i = 0; i < fileEntries.length; i++) {
      const start = (i == 0) ? filesStart : fileEntries[i - 1][1] + filesStart;
      const end = fileEntries[i][1] + filesStart;

      self.appContext.getNetworkCache()
        .set(
          fileEntries[i][0], decompressArrayBuf(
            buffer.slice(start, end)
          ).then(buf => new TextDecoder('utf-8').decode(buf))
        );
    }

    await self.appContext.loadComponentClasses(
      clientUtils.objectValuesAsKeys(renderTree)
    );

    const dataEnd = new TextDecoder('utf-8').decode(buffer.slice(
      fileEntries.length ? fileEntries.at(-1)[1] + filesStart : filesStart, buffer.byteLength
    ));
    const { actions } = unsafeEval(`module.exports=${dataEnd}`);

    await jsDepsPromise;

    await Promise.all(
      Object.entries(actions)
        .map(async ([ref, specList]) => {
          const component = BaseComponent.#refsMap.get(ref);

          if (!component) {
            this.logger.warn(`Could not find component with ref "${ref}"`);
            return;
          }

          if (!component.isComponentRendered()) {
            await component.load({ wait: false });

            await new Promise(resolve => {
              requestAnimationFrame(resolve);
            });

            await cssDepsPromise;
          }

          const behavioursSignature = component.getBehavioursSignature();

          specList.forEach(({ behaviourName, args }) => {
            const argTypes = behavioursSignature[behaviourName];

            if (argTypes) {
              this.#validateArgTypes('behaviour', behaviourName, argTypes, args);
            }

            if (typeof component[behaviourName] == 'function') {
              component[behaviourName].bind(component)(...args);
            }
          });
        })
    );

    this.#serverEventDispatches.set(event, false);
  }

  #dispatchClientEvent(event, ...args) {
    const { handlerFunctionPrefix, oncePattern } = BaseComponent;

    let defaultHandler = this.defaultHandlers()[event]

    if (typeof defaultHandler != 'function') {
      defaultHandler == null;
    }

    const helpersNamespace = this.getHelpersNamespace();
    const definedHandlers = this.getAllHandlerFunctions(event);

    const ctx = this.#newEventContext();
    const finalizers = [];

    const handlers = Object.keys(this.#handlers[event] || {})
      .map((handler) => {
        assert(typeof handler == 'string');

        if (handler.match(oncePattern)) {
          const b = delete this.#handlers[event][handler];
          assert(b);

          handler = handler.replace(oncePattern, '');

          finalizers.push(() => {

            if (handler.startsWith(handlerFunctionPrefix)) {
              const b = delete this.#handlerFunctions[handler];
              assert(b);
            }
          });
        }

        let type = 'method';
        let fn = handler.startsWith(`${helpersNamespace}.`) ?
          () => {
            const { unsafeEval } = AppContext;
            return unsafeEval(handler);
          }
          : this[handler];

        if (typeof fn != 'function') {
          type = 'handler';
          fn = definedHandlers[handler];

          if (fn instanceof EventHandler) {
            fn = fn.getFunction();
          }
        }

        if (typeof fn != 'function') {
          this.throwError(`Unknown handler "${handler}" for event "${event}"`);
        }

        return { type, fn, };
      });

    if (handlers.length) {
      this.#eventLock.push(event);
    }

    [...handlers.length ? handlers : defaultHandler ? [{ type: 'handler', fn: defaultHandler }] : []]
      .forEach(({ type, fn }) => {
        assert(typeof fn == 'function');

        try {
          fn.bind((type == 'method') ? this : ctx)(...args)
        } catch (e) {
          this.#logEventHandlerError(e, event, fn);
        }
      });

    finalizers.forEach(fn => fn());

    if (handlers.length) {
      this.#eventLock.splice(
        this.#eventLock.indexOf(event), 1
      );
    }

    return ctx;
  }

  #logEventHandlerError(err, event, fn) {
    console.info(`Error occured while running handler for event "${event}": \n ${fn.toString()}`);
    this.logger.error(null, err);
  }



  // TODO: Convert static event API to use EventHandler instead

  static on(event, handler) {
    assert(typeof handler == 'function');

    const handlers = this.#staticHandlers[event] || (this.#staticHandlers[event] = []);
    handlers.push(handler);
  }

  static dispatchEvent(event, ...args) {
    (this.#staticHandlers[event] || [])
      .forEach(handler => {
        handler(...args);
      });
  }

  static removeEventHandler(event, handler) {
    const handlers = this.#staticHandlers[event];
    const idx = handlers ? handlers.indexOf(handler) : -1;

    if (idx >= 0) {
      handlers.splice(idx, 1);
    }
  }



  // #API
  dispatchEvent(event, ...args) {
    this.#dispatchServerEvent(event, ...args);
    return this.#dispatchClientEvent(event, ...args);
  }

  // #API
  booleanOperators() {
    return {
      LT: (x, y) => x < y,
      LTE: (x, y) => x <= y,
      GT: (x, y) => x > y,
      GTE: (x, y) => x >= y,
      EQ: (x, y) => x == y,
      NEQ: (x, y) => x != y,
      INCLUDES: (x, y) => {
        if (!x) { return false; }

        const isString = typeof x == 'string';
        const isArray = x.constructor.name == 'Array';
        const isObject = x.constructor.name == 'Object';

        assert(isString || isArray || isObject, `Left-hand side of INCLUDES must be a string, array or object, got value ${x}`);

        return (
          isObject ? x.keys instanceof Function ? x.keys() : Object.keys(x)
            : x
        )
          .includes(`${y}`);
      },
      INSTANCEOF: (x, y) => {
        if (!x) { return false; }
        const componentClass = components[y];
        assert(x instanceof BaseComponent, 'Left-hand side of INSTANCEOF must be a component');
        assert(!!componentClass, 'Right-hand side of INSTANCEOF must be a valid component name');

        return x instanceof componentClass;
      },
      STARTSWITH: (x, y) => {
        if (typeof x != 'string') {
          return false;
        }
        return x.startsWith(y);
      }
    }
  }

  // #API
  destroy() {
    const { setObjectAsPruned } = RootProxy;

    this.dispatchEvent('destroy');

    super.destroy();

    if (this.isConnected()) {
      const node = document.getElementById(this.getElementId());

      // Detach from DOM
      node.parentElement.removeChild(node)
    }

    // Delete all properties of the instance
    for (const key in this) {
      if (this.hasOwnProperty(key)) {
        delete this[key];
      }
    }

    setObjectAsPruned(this);
  }

  s$_ownJsDependencies() {
    return [];
  }

  s$_ownCssDependencies() {
    return [];
  }

  s$_allJsDependencies() {
    return [];
  }

  s$_allCssDependencies() {
    return [];
  }

  // #API
  getGlobalVariables() {
    return {
      // ... User Global Variables
      ...self.appContext ? self.appContext.getUserGlobals() : {},
      // ... Component Global Variables
      componentId: this.getId(),
      random: this.#randomString || (this.#randomString = this.randomString('ungrouped'))
    }
  }

  getGlobalVariableTypes() {
    const { literalType } = RootProxy;
    return {
      // ... User Global Variables
      rtl: literalType,
      // ... Component Global Variables
      componentId: literalType,
      random: literalType,
    };
  }

  // #API
  static getWrapperCssClass() {
    const { htmlWrapperCssClassname } = RootCtxRenderer;
    return htmlWrapperCssClassname;
  }

  static cloneInputData(data) {
    return clientUtils.cloneComponentInputData(data);
  }

  static cloneComponent({ component, inputVistor = (i) => i, inputConsumer, inputProducer }) {
    const { cloneInputData } = BaseComponent;

    let input;

    if (inputProducer) {
      input = inputProducer();
    } else {
      input = inputVistor(
        cloneInputData(
          component.getInput(),
        )
      );
      if (inputConsumer) {
        inputConsumer(input);
      }
    }

    const o = new component.constructor({
      input,
      config: { ...component.getConfig() }
    });

    Object.entries(component.getHandlers())
      .forEach(([k, v]) => {
        o.#handlers[k] = v;
      });

    return o;
  }

  getEmptyNodeAttributeKey() {
    return 'empty';
  }

  // #API
  getPathStringInfo(pathArray) {
    return clientUtils.getPathStringInfo(pathArray);
  }
  // #API
  getSharedEnum(enumName) {
    return self.appContext ? self.appContext.enums[enumName] : null
  }
  // #API
  randomString(groupName) {
    const { randomString } = BaseComponent;
    return randomString(`${this.getId()}${groupName ? `.${groupName}` : ''}`);
  }
  // #API
  static randomString(groupName, length) {
    return clientUtils.randomString(groupName, length);
  }
  // #API
  executeDiscrete(fn, interceptor) {
    this.proxyInstance.executeDiscrete(fn, interceptor);
  }
  // #API
  getDataVariableValue(dataVariable, index, keys) {
    const { getDataVariableValue } = RootCtxRenderer;
    return getDataVariableValue(dataVariable, index, keys);
  }
  // #API
  visitHtmlAst({ ast, emitter, tagVisitor }) {
    const { visitHtmlAst } = RootCtxRenderer;
    return visitHtmlAst({ ast, emitter, tagVisitor });
  }
  // #API
  async checkPredicate(path) {
    const { dataPathRoot, pathSeparator, predicateHookType } = RootProxy;
    this.ensureComponentRendered();

    const [hookList, metadata] = await Promise.all([
      this.proxyInstance.getHookListFromPath(path, false, false), this.getMetadata(),
    ]);

    const p = `${dataPathRoot}${pathSeparator}${path}`;

    if (!hookList[p]) return;

    return this.proxyInstance.triggerHooks({
      path: p, hookType: predicateHookType, hookList, metadata,
    });
  }
}
module.exports = BaseComponent;
