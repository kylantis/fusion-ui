
class RadioGroup extends components.MultiOptionFormElement {

    beforeLoad() {
        const input = this.getInput();
        input.type = "radio";
        input.readonly = true;
    }

    isCompound() {
        return true;
    }
}

module.exports = RadioGroup;