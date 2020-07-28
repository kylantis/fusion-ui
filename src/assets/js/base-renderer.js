class BaseRenderer {
    constructor({
        id, input,
    } = {}) {
        this.id = id;

        // eslint-disable-next-line default-case
        switch (input.constructor.name) {
        case 'Object':
            this.getDataStore()
                .set(this.id, {
                    input,
                });
            break;
        case 'Function':
            // Note: This is usually the case during compile-time
            this.resolver = input;
            break;
        }

        // Create root proxy
        // eslint-disable-next-line no-undef
        RootProxy.create({ component: this });

        this.addPolyfills();
    }

    getId() {
        return this.id;
    }

    getDataStore() {
        if (!window.dataStore) {
            window.dataStore = new Map();
        }
        return window.dataStore;
    }

    getInput() {
        return this.getDataStore()
            .get(this.id).input;
    }

    load() {
        return Promise.resolve();
    }

    addPolyfills() {
        // Polyfill NodeJS global object
        window.global = window;
        if (!global) {
            window.assert = (condition) => {
                if (!condition) {
                    throw new Error('Assertion Error');
                }
                return true;
            };
        }
    }
}

module.exports = BaseRenderer;
