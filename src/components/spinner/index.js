
class Spinner extends components.LightningComponent {

    initializers() {
        return {
            ['color']: 'brand',
            ['size']: 'medium',
        };
    }

    getNode() {
        const node = this.getNode0();

        return node.querySelector('.slds-spinner_container') ||
            node.querySelector('.slds-spinner');
    }

    canDisplay() {
        return getComputedStyle(this.getNode()).display != 'none';
    }

    setCssDisplay(display = 'initial') {
        this.getNode().style.display = display;
    }

    sizeTransform(size) {
        if (size && ['x-large', 'xx-large'].includes(size)) {
            size = 'large';
        }
        return size;
    }
}
module.exports = Spinner;