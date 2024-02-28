
class Checkbox extends components.MultiOptionFormElement {

    beforeRender() {
        const input = this.getInput();
        input.type = "checkbox";
    }

    onMount() {
        const { readonly } = this.getInput();

        if (!this.isCompound() && !readonly) {

            this.getFormElementNode()
                .querySelector('.slds-checkbox')
                .classList.add('slds-checkbox_standalone');
        }
    }
}

module.exports = Checkbox;