
class Checkbox extends components.MultiOptionFormElement {

    beforeLoad() {
        const input = this.getInput();
        input.type = "checkbox";
    }

    onMount() {
        if (!this.isCompound()) {
            this.getFormElementNode()
                .querySelector('.slds-checkbox')
                .classList.add('slds-checkbox_standalone');
        }
    }
}

module.exports = Checkbox;