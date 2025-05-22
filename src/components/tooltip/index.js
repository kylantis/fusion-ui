
class Tooltip extends components.Popover {

    beforeRender() {
        const input = this.getInput();

        input.cssClass = "slds-popover_tooltip";
        input.role = "tooltip";
        input.closeIcon = false;
    }

    getSupportedPositions() {
        return this.supportedPositions || [
            "right",
            "left",
            "top",
            "bottom",
        ];
    }
}

module.exports = Tooltip;