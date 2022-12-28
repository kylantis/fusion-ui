
class RadioGroup extends components.MultiOptionFormElement {

    beforeLoad() {
        const input = this.getInput();
        input.type = "radio";
        input.readonly = true;
    }

    isMultiCheckable() {
        return false;
    }

    isCompound() {
        return true;
    }
}

module.exports = RadioGroup;