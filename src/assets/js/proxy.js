
class RootProxy {
    // static enableLogging = true;
    static customBlockPrefix = 'c$_';

    constructor({ component }) {
        this.component = component;
        this.handler = this.createObjectProxy();
    }

    getValue(value) {
        this.lastLookup = value;

        switch (true) {
        case value instanceof Array:
            return this.createArrayProxy(value);

        case value instanceof Object:
            return this.handler;

        default:
            return value;
        }
    }

    createObjectProxy() {
        return new Proxy({}, {
            get: (obj, prop) => {
                let value;

                if (prop === Symbol.iterator) {
                    // obj which is an object is the target of an each
                    // return an iterator function that yields an empty object
                    // eslint-disable-next-line no-underscore-dangle
                    const _this = this;
                    // eslint-disable-next-line func-names
                    return function* () {
                        const keys = Object.keys(_this.lastLookup);
                        for (let i = 0; i < keys.length; i++) {
                            // At least, attempt to do a read on the underlying json
                            // object, so that if it is a proxy itself, the "get"
                            // interceptor method will be invoked
                            // eslint-disable-next-line no-unused-expressions
                            _this.lastLookup[keys[i]];

                            yield _this.handler;
                        }
                    };
                }

                switch (true) {
                // eslint-disable-next-line no-prototype-builtins
                case !!Object.getPrototypeOf(obj)[prop]:
                    value = obj[prop];
                    break;

                default:

                    // eslint-disable-next-line no-undef
                    assert(prop.constructor.name === 'String');

                    // eslint-disable-next-line no-case-declarations
                    const { customBlockPrefix } = RootProxy;

                    // eslint-disable-next-line no-case-declarations
                    const isCustomBlockParam = prop.startsWith(customBlockPrefix);
                    if (isCustomBlockParam) {
                        // eslint-disable-next-line no-param-reassign
                        prop = prop.replace(customBlockPrefix, '');
                    }

                    // eslint-disable-next-line no-case-declarations
                    const v = this.component
                        .getPathValue({ path: prop });

                    value = isCustomBlockParam ? v : this.getValue(v);

                    break;
                }

                return value;
            },
        });
    }

    createArrayProxy(array) {
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

    static create({ component }) {
        const proxy = new RootProxy({ component });
        proxy.component.proxy = proxy;
        return proxy.handler;
    }
}

module.exports = RootProxy;
