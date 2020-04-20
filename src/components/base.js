
class BaseComponent {
    static #initialized = false;

    static #componentTags;

    static #clientStubs;

    static arrayIndexTracker = {};

    constructor({
        input, parent = document.body, render = true,
    } = {}) {
        this.id = `${this.getName()}-${this.getRandomInt()}`;
        this.parent = parent;

        BaseComponent.getComponentStore().set(this.id, {
            input,
        });

        // Render, if applicable
        if (render) {
            this.loadDependencies()
                .then(() => Promise.all(this.init()))
                .then(() => this.render());
        }
    }

    deepExtend() {
        // Variables
        const extended = {};
        let deep = false;
        let i = 0;
        const { length } = arguments;

        // Check if a deep merge
        if (Object.prototype.toString.call(arguments[0]) === '[object Boolean]') {
            deep = arguments[0];
            i++;
        }

        // Merge the object into the extended object
        const merge = function (obj) {
            for (const prop in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, prop)) {
                    // If deep merge and property is an object, merge properties
                    if (deep && Object.prototype.toString.call(obj[prop]) === '[object Object]') {
                        extended[prop] = extend(true, extended[prop], obj[prop]);
                    } else {
                        extended[prop] = obj[prop];
                    }
                }
            }
        };

        // Loop through each object and conduct a merge
        for (; i < length; i++) {
            const obj = arguments[i];
            merge(obj);
        }

        return extended;
    }

    getId() {
        return this.id;
    }

    getName() {
        try {
            return this.getSyntheticMethod('name')();
        } catch (e) {
            // This likely happened during pre-compiled time
            // when the synthetic method have not been emmited yet
            return this.constructor.name.toLowerCase();
        }
    }

    getHelpers() {
        return this.getSyntheticMethod('helpers')();
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
    static getComponentStore() {
        if (!window.componentStore) {
            window.componentStore = new Map();
        }
        return window.componentStore;
    }

    getDataPath({ fqPath, indexResolver }) {
        if (!indexResolver) {
            // eslint-disable-next-line no-param-reassign
            indexResolver = path => BaseComponent.arrayIndexTracker[path];
        }

        const segments = fqPath.split('__');
        const parts = [];

        for (let i = 0; i < segments.length; i++) {
            let part = segments[i];

            if (part.endsWith('_$')) {
                [part] = part.split('_$');

                const arrayPath = parts.slice(0, i).concat([part]).join('.');
                const array = this.lookupDataStore0({
                    path: arrayPath,
                });

                if (array && array instanceof Array) {
                    const index = indexResolver(arrayPath);
                    part += `[${index}]`;
                } else {
                    throw new Error(`Unknown array path: ${arrayPath}`);
                }
            }

            parts.push(part);
        }

        return parts.join('.');
    }

    lookupDataStore({ fqPath, indexResolver }) {
        const path = this.getDataPath({ fqPath, indexResolver });
        return this.lookupDataStore0({ path });
    }

    lookupDataStore0({ path }) {
        // eslint-disable-next-line no-eval
        return eval(`BaseComponent.getComponentStore()
            .get(this.id).input.${path}`);
    }

    render() {
        const componentHelpers = {};

        for (const helperName of this.getHelpers()) {
            componentHelpers[helperName] = this[helperName];
        }

        // eslint-disable-next-line no-undef
        const helpers = this.deepExtend({}, Handlebars.helpers, componentHelpers);

        window.customHelpers = helpers;

        const precompiledTemplate = window[`kclient_${this.getName()}_template`];

        const inputData = BaseComponent.getComponentStore().get(this.id).input;

        // eslint-disable-next-line no-undef
        const template = Handlebars.template(precompiledTemplate);

        const html = template(inputData, { helpers });

        const container = `<div id="${this.getId()}">${html}</div>`;
        $(this.parent).append(container);
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
        return [
            'https://cdn.jsdelivr.net/npm/jquery@3/dist/jquery.min.js',
            '/assets/js/site.min.js',
            'https://cdn.jsdelivr.net/npm/handlebars@latest/dist/handlebars.js',
            `/components/${this.getName()}/template.min.js`,
        ];
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
                script.onload = function (yy) {
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

    getRandomInt(min = Math.ceil(1000), max = Math.floor(2000000)) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    flattenJson(data) {
        const result = {};
        function recurse(cur, prop) {
            if (Object(cur) !== cur) {
                result[prop] = cur;
            } else if (Array.isArray(cur)) {
                const l = cur.length;
                for (let i = 0; i < l; i++) recurse(cur[i], prop ? `${prop}.${i}` : `${i}`);
                if (l === 0) result[prop] = [];
            } else {
                let isEmpty = true;
                for (const p in cur) {
                    if (Object.prototype.hasOwnProperty.call(cur, p)) {
                        isEmpty = false;
                        recurse(cur[p], prop ? `${prop}.${p}` : p);
                    }
                }
                if (isEmpty) result[prop] = {};
            }
        }
        recurse(data, '');
        return result;
    }

    getSyntheticMethod(name) {
        return this[`s$_${name}`];
    }
}

BaseComponent.loadedStyles = [];
BaseComponent.loadedScripts = [];

if (window.Event) {
    BaseComponent.init();
}

module.exports = BaseComponent;
