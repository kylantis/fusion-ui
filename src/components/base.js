
class BaseComponent {
    constructor(data, node, render = true) {
        if (render) {
            this.data = data;
            this.node = node || document.body;
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
            // This should be removed before rendering within the app shell
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
   * @returns {Boolean}
   */
    static getComponent(tag, node, data) {
        console.log(tag, node, data);
    }

    loadDependencies() {
        return Promise.all([
            this.loadCSSDependencies(),
            this.loadJSDependencies(),
        ]);
    }

    loadCSSDependencies(timeout = 5000) {
        console.log('Loading CSS dependencies');

        // eslint-disable-next-line consistent-return
        return new Promise((resolve, reject) => {
            const loaded = [];
            let styles = this.getCssDependencies();

            // Filter styles that have previously loaded
            styles = styles.filter(style => !BaseComponent.loadedStyles.includes(style));

            if (!styles.length) {
                return resolve([]);
            }

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

    loadJSDependencies(timeout = 5000) {
        console.log('Loading JS dependencies');

        // eslint-disable-next-line consistent-return
        return new Promise((resolve, reject) => {
            const loaded = [];
            let scripts = this.getJsDependencies();

            // Objectify string entries
            scripts = scripts.map(script => (script.constructor.name === 'String' ? {
                url: script,
            } : script));

            // Filter scripts that have previously loaded
            scripts = scripts.filter(script => !BaseComponent.loadedScripts.includes(script.url));

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

    getRandomInt(min = Math.ceil(1000), max = Math.floor(20000)) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    callback(event, value) {
        console.log(event, value);
        // Add callback events
    }
}

BaseComponent.loadedStyles = [];
BaseComponent.loadedScripts = [];
