
class IconSvg extends components.LightningComponent {

    initializers() {
        const { type } = this.getInput();
        return {
            foreground: type == 'utility' ? 'text-default' : null,
            solid: true,
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