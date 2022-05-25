
class CheckboxBase extends components.TextCompanion {

    beforeMount() {
        this.#setDefaults();
    }

    #setDefaults() {
    }

    onCheckboxChange(evt) {
        const input = this.getInput();
        const { checked } = evt.target;

        input.checked = checked;
    }

}
module.exports = CheckboxBase;