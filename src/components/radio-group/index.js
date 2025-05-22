
class RadioGroup extends components.MultiOptionFormElement {

    beforeRender() {
        const input = this.getInput();
        input.type = "radio";
    }

    isCompound() {
        return true;
    }
}

module.exports = RadioGroup;