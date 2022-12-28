
class IconSvg extends components.LightningComponent {

    toIconClassName(name) {
        if (this.getSharedEnum('iconColor')
            .includes(name.replace('slds-icon-', ''))) {
            return name;
        }
        return name.replaceAll('_', '-');
    }
}
module.exports = IconSvg;