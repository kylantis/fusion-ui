
// eslint-disable-next-line no-undef
class CustomCtxRenderer extends RootCtxRenderer {
    constructor({
        id, input,
    } = {}) {
        super({ id, input });

        this.canonicalQualifiers = {};
    }

    renderBlock({ methodName, data, options }) {
        this.validateType({
            path: methodName,
            value: data,
            validTypes: ['Object', 'Array'],
        });

        const { hash, fn } = options;

        const { blockParam } = hash;
        delete hash.blockParam;

        const qualifiers = {};
        qualifiers[blockParam] = data;
        for (const k in hash) {
            if (Object.prototype.hasOwnProperty.call(hash, k)) {
                qualifiers[k] = hash[k];
            }
        }

        const prevCanonicalQualifiers = this.canonicalQualifiers;
        this.canonicalQualifiers = {
            ...this.canonicalQualifiers,
            ...qualifiers,
        };
        for (const k in this.canonicalQualifiers) {
            if (data[k]) {
                throw new Error(`Qualifier: ${k} exists multiple times in the current context`);
            }
        }
        const input = {
            ...data,
            ...this.canonicalQualifiers,
        };

        let root = this.hbsInput;
        const rootData = root.data;
        delete root.data;
        root = {
            ...root,
            ...rootData,
        };

        // Add @root
        // Todo: investigate if this is respected, or whether hbs uses its
        // pwn @root
        input['@root'] = root;

        const output = fn(input);

        this.canonicalQualifiers = prevCanonicalQualifiers;

        return output;
    }

    isPrimitive(value) {
        return value == null || ['String', 'Number', 'Boolean']
            .includes(value.constructor.name);
    }

    validateType({
        path, value, validTypes = [], strict = false,
    }) {
        if (validTypes && validTypes.length) {
            for (const type of validTypes) {
                // eslint-disable-next-line default-case
                switch (true) {
                case type === 'Array' && value != null && value.constructor.name === 'Array':
                    if (value.length || !strict) {
                        return value;
                    }
                    break;

                case type === 'Object' && value != null && value.constructor.name === 'Object':
                    if ((!!Object.keys(value).length) || !strict) {
                        return value;
                    }
                    break;

                case type === 'Literal' && this.isPrimitive(value):
                    return value;
                }
            }

            throw new Error(`${path} must resolve to a non-empty value with one of the types: ${validTypes}`);
        }
        return value;
    }
}

module.exports = CustomCtxRenderer;
