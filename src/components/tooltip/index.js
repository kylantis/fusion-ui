
class Tooltip extends components.OverlayComponent {

    initCompile() {
        this.getInput().targetElement;
    }

    behaviours() {
        return ['refresh'];
    }

    refresh() {
        this.setPosition();
    }

    setPosition() {
        const { targetElement } = this.getInput();

        if (!targetElement) {
            return;
        }

        const target = document.querySelector(targetElement);

        if (!target) {
            throw Error(`[${this.getId()}] Could not find targetElement: ${targetElement}`);
        }

        if (getComputedStyle(target).display == 'contents') {
            this.throwError(
                `"${targetElement}" cannot be used as the targetElement because it does not have a box`);
        }

        const rect = target.getBoundingClientRect();

        const { position, fn } = this.getPosition(
            this.getBoundingClientRectOffset0(rect)
        );

        fn(this.getNode());

        this.addNubbinCssClass(position);
    }

    onMount() {
        this.hide();

        const node = this.getNode();
        node.style.position = 'absolute';
        // node.style.left = 0;
        // node.style.top = 0;

        node.style.width = node.style.height = "max-content";

        const container = this.container ? document.getElementById(this.container) : null;

        if (container) {
            container.appendChild(
                this.node.parentElement.removeChild(this.node)
            )
        }

        this.setPosition();
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
        const node = this.getNode();

        if (!node) {
            this.throwError(
                `Could not find tooltip node, did you forget to call .load(...) for this component?`
            )
        }

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
        return [
            "right",
            "left",
            "top",
            "bottom",
           
        ];
    }

    getPadding() {
        return 12;
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