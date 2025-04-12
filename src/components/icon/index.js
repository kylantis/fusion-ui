
class Icon extends components.TextCompanion {

    events() {
        return ['solidStateChange'];
    }

    eagerlyInline() {
        return true;
    }    

    eventHandlers() {
        return {
            ['solidStateChangeDispatch']: ({ key, value }) => {
                if (this.#willChangeSolidState(key, value)) {
                    this.dispatchEvent('solidStateChange', this);
                }
            }
        }
    }

    afterMount() {
        this.on(
            this.getSolidStateIntrinsicProperties()
                .map(p => `insert.${p}`)
                .join('|'),
            'solidStateChangeDispatch'
        );
    }

    initializers() {
        const { type } = this.getInput();

        return {
            ['foreground']: type == 'utility' ? 'text-default' : null,
            ['solid']: true,
            ['size']: ({ size }) => size === null ? null : 'small'
        };
    }

    getSolidStateIntrinsicProperties() {
        return ['type', 'solid']
    }

    /**
     * This function checks if the solid state of this icon is changed when the provided property changes
     */
    #willChangeSolidState(property, value) {
        const { isSolid0 } = Icon;

        const input = { ...this.getInput() };
        input[property] = value;

        const { type, solid } = input;
        return this.isSolid() !== isSolid0({ type, solid });
    }

    isSolid() {
        const { isSolid0 } = Icon;
        
        const input = this.getInput();

        if (input) {
            const { type, solid } = input;
            return isSolid0({ type, solid });

        } else {
            getNode().classList.contains('is-solid-icon');
        }
    }

    static isSolid0({ type, solid }) {
        return type != 'utility' && (solid || solid == undefined);
    }

    static getIconSize(opts) {

        const { getRootFontSize } = components.LightningComponent;
        const { getMarginSizesInRem } = components.TextCompanion;
        const { getIconSvgSizesInRem } = components.IconSvg;

        const fontSize = getRootFontSize();

        const { marginTop, marginBottom, marginLeft, marginRight, size } = opts;

        const toPx = (rem, transform) => {
            let ret = 0;

            [...Array.isArray(rem) ? rem : [rem]]
                .filter(r => r)
                .forEach(r => {
                    r = transform(r);
                    assert(typeof r == 'number');
                    ret += r * fontSize;
                });

            return ret;
        }

        const svgSizeTransform = (size) => getIconSvgSizesInRem()[size];
        const svgSize = toPx(size, svgSizeTransform);

        const ret = {
            width: svgSize,
            height: svgSize,
        };

        const marginSizeTransform = (size) => getMarginSizesInRem()[size];

        [marginTop, marginBottom].forEach(rem => {
            ret.height += toPx(rem, marginSizeTransform);
        });

        [marginLeft, marginRight].forEach(rem => {
            ret.width += toPx(rem, marginSizeTransform);
        });

        return ret;
    }
}
module.exports = Icon;