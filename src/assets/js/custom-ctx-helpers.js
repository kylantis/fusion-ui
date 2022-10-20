
module.exports = {
    conditional() {
        const _this = this;
        return (value, invert, options, ctx) => {
            const b = _this.analyzeConditionValue(value);
            if (invert ? !b : b) {
                return options.fn(ctx);
            } else {
                return options.inverse(ctx);
            }
        };
    },

    with() {
        const _this = this;
        return function (context, options) {
            const { loc, fn, inverse, data, hash } = options;
            const { blockParam } = hash;

            assert(blockParam);

            if (arguments.length != 2) {
                _this.throwError(
                    '#with block requires exactly one argument', loc
                );
            }
            if (clientUtils.isFunction(context)) {
                context = context.call(this);
            }

            if (!clientUtils.isEmpty(context)) {
                data[blockParam] = context;

                return fn(context, {
                    data,
                    blockParams: [context]
                });
            } else {
                return inverse(this);
            }
        }
    },

    each() {
        const _this = this;
        return function (context, options) {
            if (!options) {
                _this.throwError('Must pass iterator to #each block');
            }

            const { fn, inverse, hash } = options;
            const { blockParam } = hash;

            assert(blockParam);

            let i = 0,
                ret = '',
                data;

            if (clientUtils.isFunction(context)) {
                context = context.call(this);
            }

            if (options.data) {
                data = clientUtils.createFrame(options.data);
            }

            function execIteration(field, index, last) {
                if (data) {
                    data.key = field;
                    data.index = index;
                    data.first = index === 0;
                    data.last = !!last;

                    data[blockParam] = context[field];
                }

                ret =
                    ret +
                    fn(context[field], {
                        data,
                        blockParams: [context[field], field]
                    });
            }

            if (context && typeof context === 'object') {
                if (clientUtils.isArray(context)) {
                    for (let j = context.length; i < j; i++) {
                        if (i in context) {
                            execIteration(i, i, i === context.length - 1);
                        }
                    }
                } else if (typeof Symbol === 'function' && context[Symbol.iterator]) {
                    const newContext = [];
                    const iterator = context[Symbol.iterator]();
                    for (let it = iterator.next(); !it.done; it = iterator.next()) {
                        newContext.push(it.value);
                    }
                    context = newContext;
                    for (let j = context.length; i < j; i++) {
                        execIteration(i, i, i === context.length - 1);
                    }
                } else {
                    let priorKey;

                    Object.keys(context).forEach(key => {
                        // We're running the iterations one step out of sync so we can detect
                        // the last iteration without have to scan the object twice and create
                        // an intermediate keys array.
                        if (priorKey !== undefined) {
                            execIteration(priorKey, i - 1);
                        }
                        priorKey = key;
                        i++;
                    });
                    if (priorKey !== undefined) {
                        execIteration(priorKey, i - 1, true);
                    }
                }
            }

            if (i === 0) {
                ret = inverse(this);
            }

            return ret;
        }
    }
};