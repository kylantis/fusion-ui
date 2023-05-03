
class ButtonIcon extends components.TextCompanion {

    initCompile() {
    }

    hooks() {
        return {};
    }

    beforeMount() {

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

    ensureBareIcon(v) {
        if (this.isIconContainer()) {
            this.throwError(`"${arguments[0]}" cannot be used with an icon container`);
        }
        return v;
    }

    ensureIconContainer(v) {
        if (v && !this.isIconContainer()) {
            this.throwError(`[selected OR size] property cannot be used with a bare icon`);
        }

        return v;
    }
}
module.exports = ButtonIcon;