
class BaseComponent {
    static syntheticMethodPrefix = 's$_';

    constructor({
        id, input, parent,
        render = true,
    } = {}) {
        this.id = id;
        this.parent = parent;

        // Add to data store
        BaseComponent.getDataStore()
            .set(this.id, {
                input,
            });

        // Initialze block data map
        this.blockData = {};

        // Polyfill NodeJS global object
        window.global = window;

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

        // eslint-disable-next-line no-unused-vars
        const value = this.lookupDataStore({
            fqPath: path,
        });

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

    getDataPath({ fqPath, indexResolver }) {
        if (!indexResolver) {
            // eslint-disable-next-line no-param-reassign
            indexResolver = path => this.blockData[path].index;
        }

        const segments = fqPath.split('__');
        const parts = [];

        for (let i = 0; i < segments.length; i++) {
            let part = segments[i];

            if (part.endsWith('_$')) {
                [part] = part.split('_$');

                // This should resolve to either an array or object
                const path = parts.slice(0, i).concat([part]).join('.');

                const value = this.lookupDataStore0({
                    path,
                });

                const index = indexResolver(
                    segments.slice(0, i).concat([part]).join('__'),
                );

                switch (true) {
                case value instanceof Array:
                    part += `[${index}]`;
                    break;
                case value instanceof Object:
                    part += `['${Object.keys(value)[index]}']`;
                    break;
                default:
                    throw new Error(`Unknown object path: ${path}`);
                }
            }

            parts.push(part);
        }

        return parts.join('.');
    }

    lookupDataStore({ fqPath, indexResolver }) {
        // console.log(fqPath);
        const path = this.getDataPath({ fqPath, indexResolver });
        // console.log(path);

        return this.lookupDataStore0({ path });
    }

    lookupDataStore0({ path }) {
        try {
            // eslint-disable-next-line no-eval
            return eval(`this.getInput().${path}`);
        } catch (e) {
            throw new Error(`Unknown path: ${path}`);
        }
    }

    render() {
        // Registers helpers
        const componentHelpers = {};
        for (const helperName of this.getHelpers()) {
            componentHelpers[helperName] = () => this[helperName].apply(this);
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
            ? BaseComponent.syntheticMethodPrefix : ''}${name}`];
    }
}

BaseComponent.loadedStyles = [];
BaseComponent.loadedScripts = [];

module.exports = BaseComponent;
