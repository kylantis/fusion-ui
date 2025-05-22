
class ButtonIcon extends components.TextCompanion {

    eagerlyInline() {
        return false;
    }

    getButton() {
        return this.node ? this.node.querySelector(':scope > button') : null;
    }

    events() {
        return ['click'];
    }

    onMount() {
        // Todo: Ensure that the attribute "aria-pressed" is set to true or false, depending on its 
        // state. This is applicable to the types: border, border-filled, border-inverse

        this.node.querySelector(':scope > button').addEventListener("click", () => {
            this.dispatchEvent('click');
        });
    }

    // getTooltipTarget() {
    //     return this.isMounted() ? `#${this.getElementId()} svg` : null;
    // }

    getTooltipHoverTarget() {
        return super.getTooltipTarget();
    }

    getIconSvg() {
        return this.getInlineComponent('iconSvg');
    }

    #getContainerTypes() {
        return ["border", "border-filled", "border-inverse"];
    }

    isIconContainer() {
        const { classList } = this.getNode();

        if (classList.contains(`slds-button_icon-container`)) {
            return true;
        }

        for (const type of this.#getContainerTypes()) {
            if (classList.contains(`slds-button_icon-${type}`)) {
                return true;
            }
        }

        return false;
    }
}

module.exports = ButtonIcon;