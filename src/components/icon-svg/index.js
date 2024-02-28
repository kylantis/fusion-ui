
class IconSvg extends components.LightningComponent {

    initializers() {
        const { type } = this.getInput();
        return {
            foreground: type == 'utility' ? 'text-default' : null,
            solid: true,
        };
    }
    
    toIconClassName(name) {
        if (this.getSharedEnum('iconColor')
            .includes(name.replace('slds-icon-', ''))) {
            return name;
        }
        return name.replaceAll('_', '-');
    }
}
module.exports = IconSvg;