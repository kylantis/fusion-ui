
class ButtonIcon extends components.LightningComponent {

    initCompile() {
    }

    hooks() {
        return {};
    }

    beforeMount() {
        this.#setDefaults();

        // Todo: 
        
        // 1. Ensure that the attribute "aria-pressed" is set to true or false, 
        // depending on its state. This is applicable to the types:
        // border, border-filled, border-inverse

        // 2. Implement - Hint on hover
    }

    events() {
        return ['click'];
    }

    onMount() {
        this.node.querySelector(':scope > button').addEventListener("click", () => {
            this.dispatchEvent('click');
        });
    }

    getIconSvg() {
        return this.getInlineComponent('iconSvg');
    }

    isIconContainer() {
        const { type, container } = this.getInput();
        return container || ["border", "border-filled", "border-inverse"].includes(type);
    }

    #setDefaults() {
    }

    ensureBareIcon(v) {
        if (this.isIconContainer()) {
            this.throw(`"${arguments[0]}" cannot be used with an icon container`);
        }
        return v;
    }

    selectedTransform(v) {
        if (v && !this.isIconContainer()) {
            this.throw(`"selected" cannot be used with a bare icon`);
        }

        return v;
    }
}
module.exports = ButtonIcon;