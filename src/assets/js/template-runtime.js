
const NULL_CONTEXT = Object.seal({});

const NOOP = () => '';

const escape = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;',
    '=': '&#x3D;',
};

const badChars = /[&<>"'`=]/g,
    possible = /[&<>"'`=]/;

function escapeChar(chr) {
    return escape[chr];
}

function createFrame(object) {
    let frame = extend({}, object);
    frame._parent = object;
    return frame;
}

function extend(obj) {
    for (let i = 1; i < arguments.length; i++) {
        for (let key in arguments[i]) {
            if (Object.prototype.hasOwnProperty.call(arguments[i], key)) {
                obj[key] = arguments[i][key];
            }
        }
    }

    return obj;
}

function wrapProgram(container, fn, data) {
    function prog(context, options = {}) {
        return fn(
            container,
            context,
            container.helpers,
            container.partials,
            options.data || data,
        );
    }
    return prog;
}

function initData(context, data) {
    if (!data || !('root' in data)) {
        data = data ? createFrame(data) : {};
        data.root = context;
    }
    return data;
}

function wrapHelpersToPassLookupProperty(helpers, container) {
    Object.keys(helpers).forEach((helperName) => {
        let helper = helpers[helperName];
        helpers[helperName] = passLookupPropertyOption(helper, container);
    });
    return helpers;
}

function passLookupPropertyOption(helper, container) {
    const lookupProperty = container.lookupProperty;

    return wrapHelper(helper, (options) => {
        return extend({ lookupProperty }, options);
    });
}

function wrapHelper(helper, transformOptionsFn) {
    if (typeof helper !== 'function') {
        // This should not happen, but apparently it does in https://github.com/handlebars-lang/handlebars.js/issues/1639
        // We try to make the wrapper least-invasive by not wrapping it, if the helper is not a function.
        return helper;
    }
    let wrapper = function (/* dynamic arguments */) {
        const options = arguments[arguments.length - 1];
        arguments[arguments.length - 1] = transformOptionsFn(options);
        return helper.apply(this, arguments);
    };
    return wrapper;
}

function validateTemplateSpec(templateSpec) {
    if (!templateSpec || !templateSpec.main) {
        throw Error('Unknown template object: ' + typeof templateSpec);
    }
}

function template(component, metadata, templateSpec, helpers) {
    validateTemplateSpec(templateSpec);

    const container = {
        strict: function (obj, name, loc) {
            if (!obj || !(name in obj)) {
                throw Error('"' + name + '" not defined in ' + obj, {
                    loc: loc,
                });
            }
            return container.lookupProperty(obj, name);
        },
        lookupProperty: function (parent, propertyName) {
            const { syntheticMethodPrefix } = RootProxy;
            const customBlockGateSuffix = '_customBlock';

            if (propertyName.startsWith(syntheticMethodPrefix)) {

                const customBlockGate = propertyName.endsWith(customBlockGateSuffix);

                if (customBlockGate || component.isCustomContext()) {

                    const { path: methodName } = component.proxyInstance.getTemplatePathInfo(
                        customBlockGate ? propertyName.replace(customBlockGateSuffix, '') : propertyName
                    );

                    return component[methodName].bind(component);
                }
            }

            if (parent instanceof Map) {
                return parent.get(propertyName);
            }

            return parent[propertyName];
        },
        lookup: function (depths, name) {
            const len = depths.length;
            for (let i = 0; i < len; i++) {
                let result = depths[i] && container.lookupProperty(depths[i], name);
                if (result != null) {
                    return depths[i][name];
                }
            }
        },
        lambda: function (current, context) {
            return typeof current === 'function' ? current.call(context) : current;
        },
        escapeExpression: (string) => {
            if (typeof string !== 'string') {
                // don't escape SafeStrings, since they're already safe
                if (string && string.toHTML) {
                    return string.toHTML();
                } else if (string == null) {
                    return '';
                } else if (!string) {
                    return string + '';
                }

                // Force a string conversion as this will be done by the append regardless and
                // the regex test will do this transparently behind the scenes, causing issues if
                // an object's to string has escaped characters in it.
                string = '' + string;
            }

            if (!possible.test(string)) {
                return string;
            }
            return string.replace(badChars, escapeChar);
        },
        invokePartial: function (templateSpec, context, options) {
            const { name: decoratorName, data } = options;
            let html;

            const { futures } = component.getRenderContext();

            const _futures = component.renderDecorator0(
                decoratorName, (_html) => {
                    html = _html;
                }, null, metadata, { data },
            );

            _futures.forEach(f => {
                futures.push(f);
            });

            return html;
        },
        fn: function (i) {
            return templateSpec[i];
        },
        program: function (i, data) {
            const fn = this.fn(i);
            return wrapProgram(this, fn, data);
        },
        data: function (value, depth) {
            while (value && depth--) {
                value = value._parent;
            }
            return value;
        },
        nullContext: NULL_CONTEXT,
        partials: {},
        hooks: {
            helperMissing: function () {
                const { loc } = Array.from(arguments).pop();
                component.throwError(`Unknown helper`, loc);
            }
        },
    };

    container.helpers = wrapHelpersToPassLookupProperty(helpers, container);

    function ret(context, options = {}) {
        const { decoratorName, runtimeOptions } = component.getRenderContext();
        let data;

        if (templateSpec.useData) {
            data = decoratorName ? runtimeOptions.data : initData(context, options.data);
            assert(data);
        }

        function main(context) {
            return (
                '' +
                templateSpec.main(
                    container,
                    context,
                    container.helpers,
                    container.partials,
                    data,
                )
            );
        }

        return main(context);
    }

    ret.isTop = true;

    return ret;
}

module.exports = {
    __esModule: true, template, createFrame, NOOP,
};