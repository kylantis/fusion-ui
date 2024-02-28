
class ButtonIcon extends components.TextCompanion {

    onMount() {
        // Todo: Ensure that the attribute "aria-pressed" is set to true or false, depending on its 
        // state. This is applicable to the types: border, border-filled, border-inverse
    }

    getButton() {
        return this.node ? this.node.querySelector(':scope > button') : null;
    }

    events() {
        return ['click'];
    }

    onMount() {
        this.node.querySelector(':scope > button').addEventListener("click", () => {
            this.dispatchEvent('click');;
        });
    }

    getTooltipTarget() {
        return this.isMounted() ? `#${this.getElementId()} svg` : null;
    }

    getTooltipHoverTarget() {
        return super.getTooltipTarget();
    }

    getIconSvg() {
        return this.getInlineComponent('iconSvg');
    }

    isIconContainer() {
        const { type, container } = this.getInput();
        return container || ["border", "border-filled", "border-inverse"].includes(type);
    }
}

module.exports = ButtonIcon;