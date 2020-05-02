
class DsProxy {
    // static enableLogging = true;

    constructor({ component }) {
        this.component = component;
    }

    getValue(value) {
        switch (true) {
        case value instanceof Array:
            return this.createArrayProxy({ array: value });

        case value instanceof Object:
            return this.createObjectProxy();

        default:
            return value;
        }
    }

    createObjectProxy() {
        return new Proxy({}, {
            get: (obj, prop) => {
                let value;

                switch (true) {
                // eslint-disable-next-line no-prototype-builtins
                case obj.prototype.hasOwnProperty(prop):
                    value = obj[prop];
                    break;

                case this.component.isSynthetic(prop):
                    value = this.component.getSyntheticMethod({
                        name: prop,
                        autoPrefix: false,
                    })();
                    break;

                default:
                    value = this.component
                        .lookupDataStore({ fqPath: prop });
                    break;
                }

                return value;
            },
        });
    }

    createArrayProxy({ array }) {
        return new Proxy(array, {
            get: (obj, prop) => {
                if (!Number.isNaN(parseInt(prop, 10))) {
                    let value = obj[prop];

                    if (value.constructor.name !== 'Array') {
                        // If the element in this index is not an array,
                        // return an empty object, which will then be
                        // wrapped by the object proxy

                        // If hbs knows that the element is a primitive, it
                        // will refuse to resolve mustache statements inside
                        // the each block that neither reference {{this}}
                        // nor a block param in the upper context. Both of
                        // which are not attainable in our scenario

                        value = {};
                    }

                    return this.getValue(value);
                }
                return obj[prop];
            },
        });
    }

    getError({ path, code }) {
        switch (code) {
        case 404:
            return `<code>[${path}] not found</code>`;

        default:
            return '';
        }
    }

    create() {
        return this.createObjectProxy();
    }

    static create({ component }) {
        return new DsProxy({ component }).create();
    }
}

module.exports = DsProxy;
