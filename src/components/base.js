class BaseComponent {
    constructor(data, node, render = true) {
        this.data = data;
        this.node = node || document.body;
        if (render) {
            this.loadDependencies().then(() => {
                this.render();
            });
        }
    }

    getCssDependencies() {
        return ['/assets/css/site.min.css', '/assets/css/reset.min.css'];
    }

    getJsDependencies() {
        return [
            'https://cdn.jsdelivr.net/npm/jquery@3/dist/jquery.min.js',
            '/assets/js/site.min.js'];
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
    static getComponent(tag, data, node) {
        const metadata = BaseComponent.componentTags[tag];
        if (!metadata) {
            console.error(`No metadata was found for component tag: ${tag}`);
            return null;
        }
        return BaseComponent.loadJS([`/components/${metadata.url}`]).then(() => {
            // eslint-disable-next-line no-eval
            eval(`new ${metadata.className} (data, node)`);
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
}
BaseComponent.loadedStyles = [];
BaseComponent.loadedScripts = [];

// This check is done, so that the scanCtags gulp task will not run this
if (window.Event) {
    // Fetch component tags metadata
    // eslint-disable-next-line no-inner-declarations
    function fetchTagsMetadata() {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', '/components/tags.json', true);
        xhr.onload = (e) => {
            if (e.target.status === 200) {
                BaseComponent.componentTags = JSON.parse(e.target.response);
            } else {
                // eslint-disable-next-line no-alert
                alert('ERROR: Could not load component tags');
            }
        };
        xhr.send();
    }
    fetchTagsMetadata();
}
