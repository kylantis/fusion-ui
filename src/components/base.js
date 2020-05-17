
class BaseComponent {
    static syntheticMethodPrefix = 's$_';

    // eslint-disable-next-line no-useless-escape
    static customBlockPrefix = 'c$_';

    constructor({
        id, input, parent,
        render = true,
    } = {}) {
        this.id = id;
        this.parent = parent;

        this.runtime = render;

        // Add to data store
        BaseComponent.getDataStore()
            .set(this.id, {
                input,
            });

        // Initialze block data map
        this.blockData = {};

        // Polyfill NodeJS global object
        window.global = window;
        window.assert = (condition) => {
            if (!condition) {
                throw new Error('Assertion Error');
            }
            return true;
        };

        this.syntheticContext = {};

        // Render, if applicable
        this.rendered = false;
        if (render) {
            this.loadDependencies()
                .then(() => Promise.all(this.init()))
                .then(() => this.render())
                .then(() => { this.rendered = true; });
        }
    }

    getInput() {
        return BaseComponent.getDataStore()
            .get(this.id).input;
    }

    getId() {
        return this.id;
    }

    getName() {
        try {
            return this.getSyntheticMethod({ name: 'name' })();
        } catch (e) {
            // This likely happened during pre-compiled time
            // when the synthetic method have not been emmited yet
            return this.constructor.name.toLowerCase();
        }
    }

    getHelpers() {
        return this.getSyntheticMethod({ name: 'helpers' })();
    }

    /**
     * A list of tasks to be executed after all js dependencies have loaded, but
     * before DOM rendering begins.
     * For example, if the user wants
     * @returns {Promise[]}
     */
    init() {
        return [];
    }

    /**
     * This returns the components store for the current page context
     */
    static getDataStore() {
        if (!window.dataStore) {
            window.dataStore = new Map();
        }
        return window.dataStore;
    }

    getSyntheticContext({
        alias,
        key,
    }) {
        return this.syntheticContext[alias][key];
    }

    setSyntheticContext({
        alias,
        value,
    }) {
        this.syntheticContext[alias] = {
            value,
        };

        const construct = alias.split('$$')[0];

        if (construct === 'each') {
            // eslint-disable-next-line default-case
            switch (true) {
            case value.constructor.name === 'Array':
                if (this.runtime) {
                    // Proxy the array, and dynamically update syntheticContext.current
                    // for each iteration

                    // eslint-disable-next-line no-param-reassign
                    value = new Proxy(value, {
                        get: (obj, prop) => {
                            const v = obj[prop];
                            if (!Number.isNaN(parseInt(prop, 10))) {
                                this.syntheticContext[alias].current = v;
                            }
                            return v;
                        },
                    });
                } else {
                    // Note: this is used by TenplateProcessor during sub-path
                    // traversal, as the proxy above this is designed for use
                    // during runtime
                    [this.syntheticContext[alias].current] = value;
                }
                break;

            case value.constructor.name === 'Object':
                if (this.runtime) {
                    // eslint-disable-next-line no-param-reassign
                    value = new Proxy(value, {
                        get: (obj, prop) => {
                            const v = obj[prop];
                            if (!Object.getPrototypeOf(obj)[prop]) {
                                this.syntheticContext[alias].current = v;
                            }
                            return v;
                        },
                    });
                } else {
                    const keys = Object.keys(value);
                    this.syntheticContext[alias].current = keys.length ? value[keys[0]] : undefined;
                }
                break;
            }
        } else {
            // eslint-disable-next-line no-undef
            assert(construct === 'with');

            // Note that since this synthetic invocation is
            // for an #if block (or rather #with turned #if block),
            // the invocation happened from our object proxy,
            // hence no need to

            this.syntheticContext[alias].current = value;
        }

        return value;
    }

    doBlockInit({ path, blockId }) {
        const blockData = this.blockData[path] || (this.blockData[path] = {});

        if (blockId) {
            // eslint-disable-next-line no-unused-expressions
            blockData.blockIds
                ? blockData.blockIds.push(blockId) : (blockData.blockIds = [blockId]);
        }

        blockData.index = -1;
    }

    doBlockUpdate({ path }) {
        const blockData = this.blockData[path];
        // eslint-disable-next-line no-plusplus
        blockData.index++;
    }

    getBlockData({ path, dataVariable }) {
        // eslint-disable-next-line no-unused-vars
        const blockData = this.blockData[path];

        const value = this.syntheticContext[path] !== undefined
            ? this.syntheticContext[path].value
            : this.getPathValue({ path });

        const length = value instanceof Array
            ? value.length : Object.keys(value).length;

        switch (dataVariable) {
        case '@first':
            return blockData.index === 0;

        case '@last':
            return blockData.index === length - 1;

        case '@index':
            return blockData.index;

        case '@key':
            return Object.keys(value)[blockData.index];

        default:
            throw new Error(`Unknown data variable: ${dataVariable}`);
        }
    }

    getPathValue({ path }) {
        let value;

        switch (true) {
        case this.isSynthetic(path)
                && path.split('__').length === 1:
            // eslint-disable-next-line no-eval
            value = eval(this.createSyntheticInvocation(path));
            break;

        default:
            value = this.resolvePath({
                fqPath: path,
            });
            break;
        }

        return value;
    }

    createSyntheticInvocation(name) {
        // Todo: create a caching mechanism
        // then after fetching the data, dynamically create
        // a function that returns that data, then return
        // the function name instead.

        return `this.${name}()`;
    }

    getExecPath({ fqPath, indexResolver }) {
        if (!indexResolver) {
            // eslint-disable-next-line no-param-reassign
            indexResolver = path => this.blockData[path].index;
        }

        const segments = fqPath.split('__');
        const parts = [];

        if (!this.isSynthetic(fqPath)) {
            parts.push('this.getInput()');
        }

        const len = Number(parts.length);

        for (let i = 0; i < segments.length; i++) {
            let part = segments[i];

            if (part.endsWith('_$')) {
                [part] = part.split('_$');

                // This should resolve to either an array or object
                const prefix = parts.slice(0, i + len);

                const path = prefix.concat([part]).join('.');

                // eslint-disable-next-line no-eval
                const value = eval(path);

                const index = indexResolver(
                    fqPath.split('__', i).concat([
                        part,
                    ]).join('__'),
                );

                switch (true) {
                case value instanceof Array:
                    part += `[${index}]`;
                    break;
                case value instanceof Object:
                    part += `['${Object.keys(value)[index]}']`;
                    break;
                default:
                    throw new Error(`Unknown path: ${path}`);
                }
            } else if (part.endsWith('_@')) {
                [part] = part.split('_@');

                if (this.isSynthetic(part)) {
                    // eslint-disable-next-line no-undef
                    assert(i === 0);
                    // Use getSyntheticMethod to take advantage
                    // of invocation caching
                    part = this.createSyntheticInvocation(part);
                }
            }

            parts.push(part);

            if (i < segments.length - 1) {
                const path = parts.join('.');
                // this must resolve to an object
                // eslint-disable-next-line no-eval
                const pathValue = eval(path);

                if ((!pathValue) || (pathValue.constructor.name !== 'Object' && pathValue.constructor.name !== 'Array')) {
                    throw new Error(`Path: ${path} must be an Array or Object, current value=${pathValue}`);
                }
            }
        }

        const result = parts.join('.');
        return result;
    }

    resolvePath({ fqPath, indexResolver }) {
        const path = this.getExecPath({ fqPath, indexResolver });
        // eslint-disable-next-line no-eval
        return eval(path);
    }

    // eslint-disable-next-line no-unused-vars
    analyzeCondition({ path }) {
        const value = this.getPathValue({ path });

        const b = !!value;

        if (!b) {
            return false;
        }

        const type = value.constructor.name;

        // eslint-disable-next-line default-case
        switch (true) {
        case type === 'Array' && value.length === 0:
        case type === 'Object' && Object.keys(value).length === 0:
            return false;
        }

        return true;
    }

    render() {
        // Registers helpers
        const componentHelpers = {};
        for (const helperName of this.getHelpers()) {
            componentHelpers[helperName] = this[helperName].bind(this);
        }

        const helpers = {
            // eslint-disable-next-line no-undef
            ...Handlebars.helpers,
            ...componentHelpers,
        };

        // Create proxy
        // eslint-disable-next-line no-undef
        const proxy = DsProxy.create({ component: this });

        // Control prototype access, to prevent attackers from executing
        // arbitray code on user machine, more info here:
        // https://handlebarsjs.com/api-reference/runtime-options.html#options-to-control-prototype-access
        const dataPaths = this.getSyntheticMethod({ name: 'dataPaths' })();
        const allowedProtoProperties = {};
        for (const path of dataPaths) {
            allowedProtoProperties[path] = true;
        }

        // Todo: This is not necessary, remove
        window.dataHelpers = dataPaths;

        // eslint-disable-next-line no-undef
        const template = Handlebars.template(
            global[`kclient_${this.getName()}_template`],
        );

        const html = template(proxy, {
            helpers,
            allowedProtoProperties: {
                ...allowedProtoProperties,
            },
            strict: true,
        });

        if (this.parent) {
            const container = document.createElement('div');
            container.id = this.getId();
            container.innerHTML = html;

            this.parent.appendChild(container);
        }

        return html;
    }

    baseCssDeps() {
        return ['/assets/css/site.min.css', '/assets/css/reset.min.css'];
    }

    baseJsDeps() {
        return [
            'https://cdn.jsdelivr.net/npm/handlebars@latest/dist/handlebars.js',
            // 'https://cdn.jsdelivr.net/npm/object-hash@2.0.3/dist/object_hash.min.js',
            `/components/${this.getName()}/template.min.js`,
            '/components/proxy.min.js',
        ];
    }

    loadDependencies() {
        return Promise.all([
            this.loadCSSDependencies(),
            this.loadJSDependencies(),
        ]);
    }

    loadCSSDependencies(timeout = 5000) {
        // eslint-disable-next-line consistent-return
        return new Promise((resolve, reject) => {
            const loaded = [];
            let styles = [...this.baseCssDeps(), ...(this.cssDeps ? this.cssDeps() : [])];
            // Filter styles that have previously loaded
            styles = styles.filter(style => !BaseComponent.loadedStyles
                .includes((style.startsWith('/') ? window.location.origin : '') + style));

            if (!styles.length) {
                return resolve([]);
            }

            console.log(`Loading CSS dependencies: ${styles}`);

            for (const url of styles) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = url;
                link.type = 'text/css';
                link.async = false;
                // eslint-disable-next-line func-names
                link.onload = function () {
                    loaded.push(this.href);
                    BaseComponent.loadedStyles.push(this.href);
                    console.log(`Loaded ${this.href}`);
                    if (loaded.length === styles.length) {
                        resolve();
                    }
                };
                link.onerror = () => reject(this.href);
                document.body.appendChild(link);
            }
            // eslint-disable-next-line consistent-return
            setTimeout(() => {
                if (loaded.length < styles.length) {
                    return reject(styles[loaded.length].url);
                }
            }, timeout);
        });
    }

    loadJSDependencies() {
        console.log('Loading JS dependencies');
        return BaseComponent.loadJS(
            [...this.baseJsDeps(), ...(this.jsDeps ? this.jsDeps() : [])],
        );
    }

    static load(url) {
        return new Promise((resolve, reject) => {
            const oReq = new XMLHttpRequest();
            oReq.onload = () => {
                resolve(oReq.response);
            };
            oReq.onerror = () => {
                reject(new Error(`Could not load ${url}`));
            };
            oReq.open('GET', url);
            oReq.send();
        });
    }

    static loadJS(scriptList, timeout = 5000) {
        // eslint-disable-next-line consistent-return
        return new Promise((resolve, reject) => {
            const loaded = [];
            let scripts = scriptList;
            // Objectify string entries
            scripts = scripts.map(script => (script.constructor.name === 'String' ? {
                url: script,
            } : script));
            // Filter scripts that have previously loaded
            scripts = scripts.filter(script => !BaseComponent.loadedScripts
                .includes((script.url.startsWith('/') ? window.location.origin : '') + script.url));

            if (!scripts.length) {
                return resolve([]);
            }

            for (const elem of scripts) {
                const script = document.createElement('script');
                script.src = elem.url;
                script.type = 'text/javascript';
                script.async = false;
                // eslint-disable-next-line func-names
                script.onload = function () {
                    loaded.push(this.src);
                    BaseComponent.loadedScripts.push(this.src);
                    if (elem.onload) {
                        // eslint-disable-next-line no-eval
                        eval(elem.onload);
                    }
                    console.log(`Loaded ${this.src}`);
                    if (loaded.length === scripts.length) {
                        resolve();
                    }
                };
                script.onerror = () => reject(this.src);
                document.body.appendChild(script);
            }
            // eslint-disable-next-line consistent-return
            setTimeout(() => {
                if (loaded.length < scripts.length) {
                    return reject(scripts[loaded.length].url);
                }
            }, timeout);
        });
    }

    isSynthetic(name) {
        return name.startsWith(BaseComponent.syntheticMethodPrefix);
    }

    getSyntheticMethod({
        name,
        autoPrefix = true,
    }) {
        return this[`${autoPrefix
            ? BaseComponent.syntheticMethodPrefix : ''}${name}`].bind(this);
    }
}

BaseComponent.loadedStyles = [];
BaseComponent.loadedScripts = [];

module.exports = BaseComponent;
