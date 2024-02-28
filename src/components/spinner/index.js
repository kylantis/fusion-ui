
class Spinner extends components.LightningComponent {

    initializers() {
        return {
            ['color']: 'brand',
            ['size']: 'medium',
            ['container']: 'default',
        };
    }

    onMount() {
        const { rtl } = this.getGlobalVariables();

        if (rtl) {
            this.getContainer().setAttribute('dir', 'rtl');
        }

        this.show();
    }

    getNode() {
        const { container } = this.getInput();
        return this.node.querySelector(
            container ? '.slds-spinner_container' : '.slds-spinner'
        );
    }

    getContainer() {
        return this.node.parentElement;
    }

    canDisplay() {
        return getComputedStyle(this.getNode()).display != 'none';
    }

    setCssDisplay(display = 'initial') {
        this.getNode().style.display = display;
    }

    show() {
        this.getContainer().classList.add('slds-is-relative');
        this.show0(this.getNode());
    }

    hide() {
        this.getContainer().classList.remove('slds-is-relative');
        this.hide0(this.getNode());
    }

    sizeTransform(size) {
        if (size && ['x-large', 'xx-large'].includes(size)) {
            size = 'large';
        }
        return size;
    }
}
module.exports = Spinner;