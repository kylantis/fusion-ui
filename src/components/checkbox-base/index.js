
class CheckboxBase extends components.TextCompanion {

    onChange(evt) {
        const input = this.getInput();
        const { checked } = evt.target;

        if (input) {
            this.executeDiscrete(() => {
                input.checked = checked;
            });
        }
    }

}
module.exports = CheckboxBase;