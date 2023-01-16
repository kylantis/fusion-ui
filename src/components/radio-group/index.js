
class RadioGroup extends components.MultiOptionFormElement {

    beforeLoad() {
        const input = this.getInput();
        input.type = "radio";
    }

    isCompound() {
        return true;
    }
}

module.exports = RadioGroup;