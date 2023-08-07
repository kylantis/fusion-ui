
class Spinner extends components.LightningComponent {

    initCompile() {
    }

    hooks() {
        return {
            ['afterMount.inlined']: ({ newValue: inlined }) => {
                if (inlined) {
                    this.addAbsoluteCenterClass();
                } else {
                    this.removeAbsoluteCenterClass();
                }
            },
            // Todo: Add hook for "container"
        }
    }

    onMount() {
        const { rtl } = this.getGlobalVariables();

        if (rtl) {
            this.getContainer().setAttribute('dir', 'rtl');
        }

        this.show();
    }

    getContainer() {
        return this.node.parentElement;
    }

    addAbsoluteCenterClass() {
        this.getContainer().classList
            .add('slds-align_absolute-center');
    }

    removeAbsoluteCenterClass() {
        this.getContainer().classList
            .remove('slds-align_absolute-center');
    }

    show() {
        const { inlined } = this.getInput();

        if (inlined) {
            this.addAbsoluteCenterClass();
        }

        this.getContainer().classList.add('slds-is-relative');

        this.node.style.visibility = 'visible';
    }

    hide() {
        const { inlined } = this.getInput();

        if (inlined) {
            this.removeAbsoluteCenterClass();
        }

        this.getContainer().classList.remove('slds-is-relative');

        this.node.style.visibility = 'hidden';
    }

    sizeTransform(size) {
        if (size && ['x-large', 'xx-large'].includes(size)) {
            size = 'large';
        }
        return size;
    }
}
module.exports = Spinner;