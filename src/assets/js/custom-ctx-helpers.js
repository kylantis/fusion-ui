
module.exports = {
    conditional() {
        const _this = this;
        return (value, invert, options, ctx) => {

            const { hash: { hook, hookPhase, hookOrder, transform, nodeIndex }, loc } = options;

            const nodeId = nodeIndex ? this.getNodeIdFromIndex(nodeIndex, loc) : null;

            if (hook) {
                _this.registerHook(`#${nodeId}`, hook, hookPhase, hookOrder, loc, options.data.state.blockData);
            }

            if (transform) {
                _this.registerTransform(
                    _this.nodeIdTransformSelector(nodeId), transform
                );
            }

            const b = _this.analyzeConditionValue(value);

            _this.startBlockContext({ loc });

            const renderedValue = (() => {
                const { fn, inverse } = options;
                if (invert ? !b : b) {
                    return fn(ctx);
                } else {
                    return inverse ? inverse(ctx) : '';
                }
            })();

            _this.endBlockContext();

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
            const { scopeVar, hook, hookPhase, hookOrder, transform, nodeIndex } = hash;
            
            assert(scopeVar);

            const nodeId = nodeIndex ? this.getNodeIdFromIndex(nodeIndex, loc) : null;

            if (hook) {
                _this.registerHook(`#${nodeId}`, hook, hookPhase, hookOrder, loc, options.data.state.blockData);
            }

            if (transform) {
                _this.registerTransform(
                    _this.nodeIdTransformSelector(nodeId), transform
                );
            }

            if (clientUtils.isFunction(context)) {
                context = context.call(this);
            }

            _this.startBlockContext({ loc });

            const renderedValue = (() => {
                if (!clientUtils.isEmpty(context)) {
                    let data;

                    if (options.data) {
                        data = TemplateRuntime.createFrame(options.data);
                        data[scopeVar] = context;
                    }
                    return fn(context, { data });
                } else {
                    return inverse(this);
                }
            })();

            _this.endBlockContext();

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
            const { scopeVar, indexVar,  hook, hookPhase, hookOrder, transform, predicate, nodeIndex, opaqueWrapper } = hash;
            
            assert(scopeVar);

            const nodeId = nodeIndex ? this.getNodeIdFromIndex(nodeIndex, loc) : null;
            
            let i = 0,
                ret = '',
                data;

            if (clientUtils.isFunction(context)) {
                context = context.call(this);
            }

            if (options.data) {
                data = TemplateRuntime.createFrame(options.data);
            }

            if (context && typeof context === 'object') {

                function execIteration(field, index, last) {

                    const currentValue = context[field];

                    if (data) {

                        data.key = field;
                        data.index = index;
                        data.first = index === 0;
                        data.last = !!last;
                        data.random = _this.randomString('random');

                        data[scopeVar] = currentValue;

                        if (indexVar) {
                            data[indexVar] = index;
                        }
                    }

                    const isNull = currentValue == null || (predicate ? !_this[predicate].bind(_this)(currentValue) : false);

                    const func = () => {

                        _this.startBlockContext({ loc });

                        const markup = isNull ?
                            '' :
                            fn(
                                currentValue,
                                { data });

                        _this.endBlockContext();

                        _this.getEmitContext().write(markup);

                        return markup;
                    }

                    const memberNodeId = clientUtils.randomString('nodeId');
                    const markup = nodeId ? _this.execBlockIteration(func, opaqueWrapper, field, memberNodeId, loc) : func();

                    ret = ret + markup;

                    if (hook) {
                        _this.registerHook(`#${memberNodeId}`, hook, hookPhase, hookOrder, loc, options.data.state.blockData);
                    }

                    if (transform) {
                        _this.registerTransform(
                            _this.nodeIdTransformSelector(memberNodeId), transform
                        );
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
                _this.getEmitContext().write(ret);
            }

            return ret;
        }
    }
};