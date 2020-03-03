// import { formatResultsErrors } from 'jest-message-util';

class BaseComponent {
    static #initialized = false;

    static #componentTags;

    static #clientStubs;

    static arrayIndexTracker = {};

    constructor({ data, parent = document.body, render = true } = {}) {
        this.data = {
            ...data || this.getSampleInputData(),
            id: `${this.tagName()}-${this.getRandomInt()}`,
        };
        this.parent = parent;

        // Register in store
        BaseComponent.getComponentStore().set(this.data.id, this.data);

        if (render) {
            this.loadDependencies().then(() => {
                Promise.all(this.getInitTasks()).then(() => { this.render(); });
            });
        }
    }

    getId() {
        return this.data.id;
    }

    getType() {
        return -1;
    }

    /**
     * A list of tasks to be executed after all js dependencies have loaded, but
     * before DOM rendering begins.
     * @returns {Promise[]}
     */
    getInitTasks() {
        return [];
    }

    getName() {
        return this.constructor.name.toLowerCase();
    }

    /**
     * This returns the components store for the current page context
     */
    static getComponentStore() {
        if (!window.componentStore) {
            window.componentStore = new Map();
        }
        return window.componentStore;
    }

    static getDataPath({ fqPath, indexResolver }) {
        const segments = fqPath.split('__');
        const parts = [];

        for (let i = 0; i < segments.length; i++) {
            let part = segments[i];

            if (part.endsWith('_$')) {
                [part] = part.split('_$');

                const arrayPath = parts.slice(0, i).concat([part]).join('__');

                if (!indexResolver) {
                    // eslint-disable-next-line no-param-reassign
                    indexResolver = path => BaseComponent.arrayIndexTracker[path];
                }

                const index = indexResolver(arrayPath);
                part += `[${index}]`;
            }

            parts.push(part);
        }

        const compId = parts[0];
        const dataPath = parts.slice(1, parts.length).join('.');

        return this.getComponentStore.get(compId)[dataPath];
    }

    static lookupDataStore({ fqPath }) {
        const { compId, dataPath } = BaseComponent.getDataPath({ fqPath });
        return this.getComponentStore.get(compId)[dataPath];
    }

    /**
     * This should contain a sample component input data. This is typically used to:
     * 1. Automatically render a template for demo purposes in the studio
     * 2. It is used to determine mustache properties for which to configure a two-way data binding
     * 3. For documentation and more importantly, code testing purposes
     *
     * Note: if any of the entries has an array value, at least one valid item
     * should be represented in the array value
     */
    getSampleInputData() {
        return {};
    }

    /**
     * Get the list of procedures that respond to client events
     */
    getProcedures() {
        return {};
    }

    // Sample helper
    capitalize() {
        return this.lastName.toUpperCase();
    }

    // Sample helper
    toLowercase(str) {
        return str.toLowerCase();
    }

    render() {
        // eslint-disable-next-line no-undef
        const helpers = $.extend({}, Handlebars.helpers, {
            // Add custom helpers
        });
        this.transformedData = this.transformData();

        const precompiledTemplate = window[`kclient_${this.getName()}_template`];

        // eslint-disable-next-line no-undef
        const template = Handlebars.template(precompiledTemplate);
        const html = template(this.transformedData, { helpers });

        const container = `<div id="${this.getId()}">${html}</div>`;
        $(this.parent).append(container);

        this.rendered();
    }

    static init() {
        if (BaseComponent.#initialized) {
            return;
        }

        // Perform initializations
        BaseComponent.fetchTagsMetadata();
        BaseComponent.setupWebSocket();
        BaseComponent.fetchClientStubs();


        BaseComponent.#initialized = true;
    }

    static setupWebSocket() {

    }

    static fetchClientStubs() {
        return {};
        // Flow
        // Note: when the WS connection is created
        // a token is sent

        // 1. Query for services, the reaponse format:
        // {'app1': ['serviceA', 'serviceB'], ...}
        // 2. Based on data fetched above, fetch the
        // associated JSON for each. The json contains
        // a function factory(token).
    }

    static fetchTagsMetadata() {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', '/components/tags.json', true);
        xhr.onload = (e) => {
            if (e.target.status === 200) {
                BaseComponent.#componentTags = JSON.parse(e.target.response);
            } else {
                // eslint-disable-next-line no-alert
                alert('ERROR: Could not load component tags');
            }
        };
        xhr.send();
    }

    getCssDependencies() {
        return ['/assets/css/site.min.css', '/assets/css/reset.min.css'];
    }

    getJsDependencies() {
        const deps = [
            'https://cdn.jsdelivr.net/npm/jquery@3/dist/jquery.min.js',
            // '/cdn/jquery-3.4.1.min.js',
            '/assets/js/site.min.js',
            'https://cdn.jsdelivr.net/npm/handlebars@latest/dist/handlebars.js',
        ];

        let templates = ['template'];
        this.getPartialsNames().forEach((e) => {
            templates.push(e);
        });

        templates = templates.map(name => `/components/${this.getName()}/${name}.min.js`);

        // Add template and partials
        templates.forEach((e) => {
            deps.push(e);
        });

        return deps;
    }

    /**
   *
   *
   * @param {String} tag
   * @param {Element} node
   * @param {Object} data
   *
   * @returns {Promise}
   */
    // eslint-disable-next-line no-unused-vars
    static async getComponent(tag, data, node) {
        const metadata = BaseComponent.#componentTags[tag];
        if (!metadata) {
            console.error(`No metadata was found for component tag: ${tag}`);
            return null;
        }
        return BaseComponent.loadJS([`/components/${metadata.url}`]).then(() => {
            // eslint-disable-next-line no-eval
            const component = eval(`new ${metadata.className} (data, node)`);
            return Promise.resolve(component);
        });
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
            let styles = this.getCssDependencies();
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
        return BaseComponent.loadJS(this.getJsDependencies());
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

            console.log(`${scripts.map(script => script.url)}`);

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

    static registerServices(services) {
        console.log(services);
    }

    appendNode(parent, tag, classNames) {
        const elem = document.createElement(tag);
        if (classNames) {
            elem.className = `${classNames}`;
        }
        if (parent) {
            parent.appendChild(elem);
        }
        return elem;
    }

    generateComponentId() {
        return `${this.data['@title']}-${this.getRandomInt()}`;
    }

    triggerEvent(eventName, eventData, componentData) {
        if (componentData.hasServerCallback) {
            // Why return?
            return this.triggerFusionCallback(eventName, eventData);
        }

        const { clientCallbacks } = componentData;

        if (clientCallbacks && clientCallbacks[eventName]) {
            // Call client-side hook
            // Why return?
            return clientCallbacks[eventName](eventData);
        }
        console.log(eventName, eventData, componentData);
        return false;
    }

    getRandomInt(min = Math.ceil(1000), max = Math.floor(2000000)) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * This writes data to the web socket, inorder to notify fusion
     * of a bubble
     *
     * @param {String} callbackName
     * @param {Object} callbackData
     */
    // eslint-disable-next-line no-unused-vars
    triggerFusionCallback(callbackName, callbackData) {

    }

    static ABSTRACT_COMPONENT_TYPE = 1;

    static VISUAL_COMPONENT_TYPE = 2;

    static ACTION_TYPE = 3;

    static TEMPLATE_TYPE = 4;

    static TRANSFORMER_TYPE = 5;
}

BaseComponent.loadedStyles = [];
BaseComponent.loadedScripts = [];

if (window.Event) {
    BaseComponent.init();
}
