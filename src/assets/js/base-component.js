/* eslint-disable linebreak-style */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-case-declarations */

// eslint-disable-next-line no-undef
class BaseComponent extends WebRenderer {

  static #token;

  static eventNameDelim = /\s*\|\s*/g;

  #inlineParent;

  #handlers;

  // #API
  static CONSTANTS = {
    // Paths
    pathSeparator: RootProxy.pathSeparator,
    pathProperty: RootProxy.pathProperty,
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
    gateParticipantHookType: RootProxy.gateParticipantHookType,
    arrayChildBlockHookType: RootProxy.arrayChildBlockHookType,
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
      BaseComponent.#token = global.clientUtils.randomString();
      // eslint-disable-next-line no-undef
      RootCtxRenderer.setToken(BaseComponent.#token);
    }

    this.#handlers = {};
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

    if (value instanceof Promise) {
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

  // #API
  async awaitPendingTasks() {
    await Promise.all(
      this.getFutures().map(f => typeof f == 'function' ? f() : f)
    );

    // Clear futures array
    while (this.getFutures().length) {
      this.getFutures().shift();
    }
  }

  render({ data, target, transform, loc }) {
    if (data === undefined) {
      return Promise.resolve();
    }

    assert(target);

    const future = Promise.resolve(data)
      // eslint-disable-next-line no-shadow
      .then(async (data) => {

        if (data === undefined) {
          // eslint-disable-next-line no-param-reassign
          data = '';
        }

        let html = data instanceof BaseComponent ? await data.getRenderedHtml() : this.toHtml(data);

        if (transform) {
          html = this[transform](html);
        }

        await this.getPromise();

        const node = document.querySelector(target);
        
        // clear loader, if any
        node.innerHTML = '';

        if (data instanceof BaseComponent) {
          await data.load({
            container: target,
            html
          });
        } else {
          node.innerHTML = html
        }
      });

    this.getFutures().push(future);

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
   * Todo: Can we add support for non-scalar attributes here by using a setter
   * sometimes instead of a getter in the object proxy 
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
  popEventListener(evt) {
    const arr = this.getHandlers()[evt];
    if (arr) {
      arr.pop();
    }
  }

  // #API
  removeEventListener(evt, handler) {
    const arr = this.getHandlers()[evt];
    if (!arr) {
      return;
    }
    const idx = arr.indexOf(handler);
    assert(idx >= 0);

    arr.splice(idx, 1);
  }

  // #API
  once(handler, ...events) {
    const handler0 = (...args) => {
      handler(...args);

      events.forEach(evt => {
        this.removeEventListener(evt, handler0)
      });
    }

    events.forEach(evt => {
      this.#on0(evt, handler0);
    });
  }

  #on0(event, handler) {
    assert(typeof handler == 'function');

    const handlers = this.getHandlers()[event] || (this.getHandlers()[event] = []);
    handlers.push(handler);
  }

  // #API
  on(evtName, handler) {
    const { eventNameDelim } = BaseComponent;

    evtName.split(eventNameDelim).forEach((name) => {
      this.#on0(name, handler);
    });

    return this;
  }

  #newEventContext() {
    return new class {
      constructor() {
        this.defaultPrevented = false;
      }
      preventDefault() {
        this.defaultPrevented = true;
      }
    }
  }

  #dispatchEvent0(event, ...args) {

    let defaultHandler = this.defaultHandlers()[event]

    if (defaultHandler) {
      if (typeof defaultHandler == 'string') {
        defaultHandler = this[defaultHandler].bind(this);
      }
      assert(typeof defaultHandler == 'function');
    }

    // Note: Only dispatch event to server if event is clientOnly as well as defined in getEvents()

    const ctx = this.#newEventContext();

    [...this.getHandlers()[event] || (defaultHandler ? [defaultHandler] : [])]
      .forEach(handler => {
        try {
          handler.bind(ctx)(...args)
        } catch (e) {
          this.logger.error(e);
        }
      });

    return ctx;
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

    // TODO

    const node = document.getElementById(this.getId());

    if (node) {
      // Detach from DOM
      node.parentElement.removeChild(node)
    }

    setObjectAsPruned(this);

    // clear hooks;

    // remove from componentRefs in base renderer
    delete BaseRenderer.getAllComponents()[this.getId()];
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
      ...self.appContext ? self.appContext.userGlobals : {},
      // ... Component Global Variables
      componentId: this.getId(),
      random: this.randomString0 || (this.randomString0 = clientUtils.randomString())
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
  randomString() {
    const { randomString } = BaseComponent;
    return randomString();
  }
  // #API
  static randomString() {
    return clientUtils.randomString();
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
  static getAllComponents() {
    const { getAllComponents } = BaseRenderer;
    return getAllComponents();
  }
  // #API
  async triggerHook({ path, hookType, hookOptions }) {
    const { dataPathRoot, pathSeparator } = RootProxy;
    const { value } = this.proxyInstance.getInfoFromPath(path);

    return this.proxyInstance.triggerHooks0({
      path: `${dataPathRoot}${pathSeparator}${path}`,
      value, hookTypes: [hookType], hookOptions,
    })
  }
}
module.exports = BaseComponent;
