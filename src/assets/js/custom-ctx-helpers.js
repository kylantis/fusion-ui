
module.exports = {
    conditional() {
        const _this = this;
        return (value, invert, options, ctx) => {

            const { hash: { hook, hookPhase, hookOrder, outerTransform }, loc } = options;

            const nodeId = _this.getSyntheticNodeId();

            if (hook) {
                _this.registerHook(`#${nodeId}`, hook, hookPhase, hookOrder, loc, options.data.state.blockData);
            }

            if (outerTransform) {
                assert(nodeId);

                _this.registerTransform(nodeId, outerTransform);
            }

            const b = _this.analyzeConditionValue(value);

            _this.getEmitContext().blockStack.push(loc);

            const renderedValue = (() => {
                if (invert ? !b : b) {
                    return options.fn(ctx);
                } else {
                    return options.inverse(ctx);
                }
            })();

            _this.getEmitContext().blockStack.pop();

            _this.getEmitContext().write(renderedValue);

            return renderedValue;
        };
    },

    with() {
        const _this = this;
        return function (context, options) {
            if (arguments.length != 2) {
                _this.throwError(
                    '#with block requires exactly one argument', loc
                );
            }

            const { loc, fn, inverse, hash } = options;
            const { blockParam, hook, hookPhase, hookOrder, outerTransform } = hash;
            assert(blockParam);

            const nodeId = _this.getSyntheticNodeId();

            if (hook) {
                _this.registerHook(`#${nodeId}`, hook, hookPhase, hookOrder, loc, options.data.state.blockData);
            }

            if (outerTransform) {
                assert(nodeId);

                _this.registerTransform(nodeId, outerTransform);
            }

            if (clientUtils.isFunction(context)) {
                context = context.call(this);
            }

            _this.getEmitContext().blockStack.push(loc);

            const renderedValue = (() => {
                if (!clientUtils.isEmpty(context)) {
                    let data;

                    if (options.data) {
                        data = clientUtils.createFrame(options.data);
                        data[blockParam] = context;
                    }
                    return fn(context, {
                        data,
                        // Handlebars wants us to add "blockParams", so let's make the engine happy even though we
                        // know calls to blockParams have been transformed at compile time to access the corresponding
                        // data variables
                        blockParams: [context]
                    });
                } else {
                    return inverse(this);
                }
            })();

            _this.getEmitContext().blockStack.pop();

            _this.getEmitContext().write(renderedValue);

            return renderedValue;
        }
    },

    each() {
        const _this = this;
        return function (context, options) {
            if (!options) {
                _this.throwError('Must pass iterator to #each block');
            }

            const { fn, inverse, hash, loc } = options;
            const { blockParam, hook, hookPhase, hookOrder, outerTransform, predicate } = hash;
            assert(blockParam);

            const nodeId = _this.getSyntheticNodeId();

            if (outerTransform) {
                assert(nodeId);

                _this.registerTransform(nodeId, outerTransform);
            }

            let i = 0,
                ret = '',
                data;

            if (clientUtils.isFunction(context)) {
                context = context.call(this);
            }

            if (options.data) {
                data = clientUtils.createFrame(options.data);
            }

            _this.getEmitContext().blockStack.push(loc);

            if (context && typeof context === 'object') {

                function execIteration(field, index, last) {

                    const currentValue = context[field];

                    if (data) {

                        data.key = field;
                        data.index = index;
                        data.first = index === 0;
                        data.last = !!last;
                        data.random = clientUtils.randomString();

                        data[blockParam] = currentValue;
                    }

                    const isNull = currentValue == null || (predicate ? !_this[predicate].bind(_this)(currentValue) : false);

                    const markup = isNull ?
                        '' :
                        fn(
                            currentValue,
                            {
                                data,
                                // Handlebars wants us to add "blockParams", so let's make the engine happy even though we
                                // know calls to blockParams have been transformed at compile time to access the corresponding
                                // data variables
                                blockParams: [currentValue, field]
                            })

                    ret = ret + markup;

                    if (hook) {
                        _this.registerHook(`#${nodeId} > :nth-child(${index + 1})`, hook, hookPhase, hookOrder, loc, options.data.state.blockData);
                    }
                }

                if (Array.isArray(context)) {
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

            const renderedValue = ret;

            _this.getEmitContext().blockStack.pop();

            _this.getEmitContext().write(renderedValue);

            return renderedValue;
        }
    }
};