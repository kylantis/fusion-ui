
class Popover extends components.OverlayComponent {

    beforeCompile() {
        this.getInput().targetElement;
        this.getInput().nubbin;
    }

    useWeakRef() {
        return false;
    }

    initializers() {
        return {
            nubbin: true,
        }
    }

    static isAbstract() {
        return true;
    }

    behaviours() {
        return ['setTargetComponent', 'setPosition', 'showPopover', 'closePopover'];
    }

    setTargetComponent(component) {
        if (typeof component == 'string') {
            const componentByRef = BaseComponent.getComponentByRef(component)

            if (componentByRef) {
                component = componentByRef;
            }
        }

        if (!(component instanceof BaseComponent)) {
            this.logger.error(null, 'Unknown component: ', component);
            return;
        }

        this.getInput().targetComponent = component;
        this.setPosition();
    }

    setPosition() {
        const { targetElement, targetComponent, nubbin } = this.getInput();

        let target;

        if (targetElement) {
            target = document.querySelector(targetElement);
        }

        if (targetComponent && targetComponent.isComponentRendered()) {
            target = targetComponent.getNode();
        }

        if (!target || getComputedStyle(target).display == 'contents') return;

        const rect = target.getBoundingClientRect();

        const { position, fn } = this.getPosition(
            this.getBoundingClientRectOffset0(rect)
        );

        fn();

        if (nubbin) {
            this.addNubbinCssClass(position);
        }
    }

    onMount() {
        this.closePopover();

        const node = this.getNode();

        node.style.display = 'block';
        node.style.position = 'absolute';

        const container = this.container ? document.getElementById(this.container) : null;

        if (container) {
            container.appendChild(
                this.node.parentElement.removeChild(this.node)
            )
        }

        this.setPosition();
    }

    getCloseIcon() {
        return this.getInlineComponent('closeIcon');
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

    // getCssPosition(containerRect, position, area) {
    //     Try 24 Pixels as the offset


    // }

    getShowToggleClass() {
        return "slds-rise-from-ground";
    }

    getHideToggleClass() {
        return "slds-fall-into-ground";
    }

    showPopover() {
        const node = this.getNode();

        node.style.zIndex = 0;

        if (this.getHideToggleClass() && this.getHideToggleClass()) {
            node.style.visibility = 'unset';
            node.classList.remove(this.getHideToggleClass());
            node.classList.add(this.getShowToggleClass());
        } else {
            node.style.visibility = 'visible';
        }
    }

    closePopover() {
        const node = this.getNode();

        if (this.getHideToggleClass() && this.getHideToggleClass()) {
            node.classList.remove(this.getShowToggleClass());
            node.classList.add(this.getHideToggleClass());
        } else {
            node.style.visibility = 'hidden';
        }

        // After popover has been hidden, we want to have it stacked under (not just hidden)
        setTimeout(() => node.style.zIndex = -1, 300)
    }

    useContainer() {
        return true;
    }

    getOverlayNode() {
        return this.getNode();
    }

    isVisible() {
        const node = this.getNode();
        const { style, classList } = node;

        return this.isMounted() && style.visibility != 'hidden' && !classList.contains(this.getHideToggleClass());
    }

    getSupportedPositions() {
        return this.supportedPositions || [
            "right",
            "left",
            "top",
            "bottom",
        ];
    }

    getPadding() {
        const { nubbin } = this.getInput();
        return nubbin ? 12 : 0;
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

module.exports = Popover;