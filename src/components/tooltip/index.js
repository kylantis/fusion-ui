
class Tooltip extends components.OverlayComponent {

    static c = 234;

    initCompile() {
        this.getInput().targetElement;
    }

    onMount() {
        const { getBoundingClientRectOffset, getOverlayConfig } = components.OverlayComponent;

        const { targetElement } = this.getInput();

        if (!targetElement) {
            return;
        }

        const target = document.querySelector(targetElement);

        if (!target) {
            throw Error(`[${this.getId()}] Could not find targetElement: ${targetElement}`);
        }

        const { container } = getOverlayConfig();

        if (container) {
            document.getElementById(container).appendChild(
                this.node.parentElement.removeChild(this.node)
            )
        }

        const containerRect = getBoundingClientRectOffset(target);

        const result = this.getPosition(containerRect);

        if (!result) {
            this.logger.error(`No available position was found to place component: ${this.getId()}`);
            
            this.hide();
            return;
        }

        const { position, top, left } = result;

        const { style } = this.getNode();

        style.top = top;
        style.left = left;
        style.position = 'absolute';

        this.addNubbinCssClass(position);
    }

    addNubbinCssClass(position) {
        // Add nubbin class
        const nubbinPosition = (() => {
            switch (position) {
                case 'top':
                    return 'bottom';
                case 'bottom':
                    return 'top';
                case 'left':
                    return 'right';
                case 'right':
                    return 'left';
            }
        })();

        const { classList } = this.getNode();
        const nubbinClassPrefix = 'slds-nubbin_';

        classList.forEach(className => {
            if (className.startsWith(nubbinClassPrefix)) {
                classList.remove(className);
            }
        })
        classList.add(`${nubbinClassPrefix}${nubbinPosition}`);
    }

    getNode() {
        return this.node.querySelector(`:scope > .slds-popover`);
    }

    getShowToggleClass() {
        return "slds-rise-from-ground";
    }

    getHideToggleClass() {
        return "slds-fall-into-ground";
    }

    show() {
        const node = this.getNode()

        if (this.getHideToggleClass() && this.getHideToggleClass()) {
            node.style.visibility = 'unset';
            node.classList.remove(this.getHideToggleClass());
            node.classList.add(this.getShowToggleClass());
        } else {
            node.style.visibility = 'visible';
        }
    }

    hide() {
        const node = this.getNode();

        if (this.getHideToggleClass() && this.getHideToggleClass()) {
            node.classList.remove(this.getShowToggleClass());
            node.classList.add(this.getHideToggleClass());
        } else {
            node.style.visibility = 'hidden';
        }
    }

    getSupportedPositions() {
        return ["top", "right", "bottom", "left"];
    }

    getPadding() {
        return 16;
    }

    getRequiredArea(position) {
        let { width, height } = this.getNode().getBoundingClientRect();

        // Add the size of the nubbin
        switch (position) {
            case 'top':
            case 'bottom':
                height += this.getPadding();
                break;
            case 'left':
            case 'right':
                width += this.getPadding();
                break;
        }

        return {
            horizontal: width,
            vertical: height,
        }
    }

    getRenderingArea(position) {
        return this.getRequiredArea(position);
    }

}
module.exports = Tooltip;