
class Tooltip extends components.Popover {

    beforeMount() {
        const input = this.getInput();

        input.cssClass = "slds-popover_tooltip";
        input.role = "tooltip";
        input.closeIcon = false;
        input.scrollable = false;
    }
}

module.exports = Tooltip;