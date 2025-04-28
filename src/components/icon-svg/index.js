
class IconSvg extends components.LightningComponent {

    initializers() {
        return {
            foreground: ({ type }) => type == 'utility' ? 'text-default' : null,
            solid: true,
            size: ({ size, type }) => size === null ? null : (type == 'utility') ? 'x-small' : 'small'
        };
    }

    eagerlyInline() {
        return true;
    }
    
    toIconClassName(name) {
        if (this.getSharedEnum('iconColor')
            .includes(name.replace('slds-icon-', ''))) {
            return name;
        }
        return name.replaceAll('_', '-');
    }

    static getIconSvgSizesInRem() {
        return {
            ['xx-small']: .875,
            ['x-small']: 1,
            ['small']: 1.5,
            ['large']: 3,
        }
    }
}
module.exports = IconSvg;