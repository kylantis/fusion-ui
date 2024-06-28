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

  #inlineParent;

  #handlers;
  #handlerFunctions = {};

  #eventLock = [];

  #randomString;

  #domUpdateHooks = [];

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

  constructor({ id, input = {}, logger, config } = {}) {

    super({ id, input, logger, config });

    if (!BaseComponent.#token) {
      // eslint-disable-next-line no-undef
      BaseComponent.#token = global.clientUtils.randomString('ungrouped');
      // eslint-disable-next-line no-undef
      RootCtxRenderer.setToken(BaseComponent.#token);
    }

    this.#handlers = {};
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
      .then(async (data) => {

        if (data === undefined) {
          // eslint-disable-next-line no-param-reassign
          data = '';
        }

        if (data instanceof BaseComponent) {
          extendedFutures.push(
            new Promise((resolve) => {
              data.on('load', resolve);
            })
          )
        }

        const load0 = async () => {

          let html;
          let renderContext;

          if (data instanceof BaseComponent) {
            const ret = await data.getRenderedHtml();

            html = ret.htmlString;
            renderContext = ret.renderContext;

          } else {
            html = this.toHtml(data);
          }

          if (transform) {
            html = this[transform](html);
          }

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
        };

        const eager = () => (data instanceof BaseComponent) && data.eagerlyInline();

        if (this.isRootComponent() || this.isMounted()) {

          await promise;
          await load0();

        } else {

          this.on('load', ({ futures }) => {
            futures.push(
              load0()
            );
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

  getAllHandlerFunctions() {
    let handlerFunctions = {};

    this.recursivelyInvokeMethod('eventHandlers').forEach(o => {
      assert(o.constructor.name == 'Object');
      handlerFunctions = { ...handlerFunctions, ...o }
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

    return this.#addHandlerFunction(handler.getFunction());
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
      handler = this.#convertEventHandlerToString(handler);
    }

    assert(typeof handler == 'string');

    // check if the event is currently in dispatch mode
    if (this.#eventLock.includes(evtName)) {
      throw Error(`Event "${evtName}" is currently being dispatched and cannot be modified`);
    }

    // validate handler
    const fn = this[handler] || this.getAllHandlerFunctions()[handler];
    if (typeof fn != 'function') {
      throw Error(`Unknown event handler "${handler}" added for event "${evtName}"`);
    }

    // add handler
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

  #dispatchEvent0(event, ...args) {
    const { handlerFunctionPrefix, oncePattern } = BaseComponent;

    let defaultHandler = this.defaultHandlers()[event]

    if (typeof defaultHandler != 'function') {
      defaultHandler == null;
    }

    // Note: Only dispatch event to server if event is clientOnly as well as defined in getEvents()

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
        let fn = this[handler];

        if ((typeof fn != 'function')) {
          type = 'handler';
          fn = this.getAllHandlerFunctions()[handler];
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
          console.info(`Error occured while running handler for event "${event}": \n ${fn.toString()}`);

          this.logger.error(null, e);
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





  // Convert static API to use strings instead

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




  // #API
  dispatchEvent(event, ...args) {
    return this.#dispatchEvent0(event, ...args);
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
          .includes(y);
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

  s$_jsDependencies() {
    return [];
  }

  s$_cssDependencies() {
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
    const { value } = this.proxyInstance.getInfoFromPath(path);

    const [hookList, metadata] = await Promise.all([
      this.proxyInstance.getHookListFromPath(path, false, false), this.getMetadata(),
    ]);

    const p = `${dataPathRoot}${pathSeparator}${path}`;

    if (!hookList[p]) return;

    return this.proxyInstance.triggerHooks0({
      path: p,
      value, hookTypes: [predicateHookType],
      hookList, metadata,
    });
  }
}
module.exports = BaseComponent;
