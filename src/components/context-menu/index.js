
class ContextMenu extends components.OverlayComponent {

    #renderingArea;

    beforeCompile() {
        this.getInput().clickType;
        this.getInput().useTargetPosition;
        this.getInput().positions[0];
    }

    beforeRender() {
        const { menu } = this.getInput();

        if (!menu) {
            this.throwError(`A menu instance is required to load this component`);
        }
    }

    immutablePaths() {
        return ['menu'];
    }

    async onMount() {
        const { menu } = this.getInput();

        menu.on('menuHide', new EventHandler(() => {
            this.prevTarget = null;
        }, this));
    }

    getDefaultSupportedPositions() {
        return ["bottom-right", "bottom-left", "top-right", "top-left"];
    }

    getSupportedPositions() {
        const { positions } = this.getInput();

        const defaultSupported = this.getDefaultSupportedPositions();

        if (positions && positions.length) {
            const arr = positions.filter(p => defaultSupported.includes(p));
            return [...(arr.length ? arr : defaultSupported)];
        } else {
            return defaultSupported;
        }
    }

    destroy() {
        const { menu } = this.getInput();

        menu.destroy();

        // Remove event listeners
        if (this.targetNodes) {
            this.targetNodes.forEach(node => {
                this.removeNode(node);
            });
            delete this.targetNodes;
            delete this.targetClickListener;
        }

        super.destroy();
    }

    getTargetClickListener() {
        return this.targetClickListener || (
            this.targetClickListener = async (evt) => {

                const { clickType, useTargetPosition, menu } = this.getInput();
                let { which, x, y, target } = evt;

                const b = (which == 1 && clickType == 'left') ||
                    (which == 3 && clickType == 'right');

                if (!b) return;

                if (useTargetPosition) {
                    const targetRect = target.getBoundingClientRect();

                    x = targetRect.x + (targetRect.width / 2);
                    y = targetRect.y + (targetRect.height / 2);
                }

                if (this.prevTarget == target) {
                    menu.hideMenu();

                    return;
                }

                this.prevTarget = target;

                const { fn } = this.getPosition(
                    this.getBoundingClientRectOffset0({
                        width: 0, height: 0,
                        top: y,
                        bottom: y,
                        left: x,
                        right: x,
                    })
                );

                fn(menu.getNode());

                this.#showMenu();
            }
        )
    }

    #showMenu() {
        const { menu } = this.getInput();

        // Note: for all "overlay" menus, Menu.hideMenu() is called whenever 'bodyClick' is dispatched,
        // Notice how we are temporarily setting overlay=false before dispatch, there are two reasons for this:
        // 1. We need to exempt this menu from being hidden - because the 'transitionend' callback will 
        // be invoked several milliseconds after invocation which then hides the menu afterward... 
        // causing our menu to first show then immediately hide, see  Menu.hideMenu()
        // 2. We don't want the 'menuHide' event triggered on <menu>, as doing so will nullify <prevTarget>
        // which has just been set

        const input = menu.getInput();
        input.overlay = false;

        BaseComponent.dispatchEvent('bodyClick');
        input.overlay = true;

        menu.showMenu();
    }

    getTriggerEvent() {
        return 'mouseup';
    }

    getNodeKey() {
        return `${this.getId()}-registered`;
    }

    removeNode(targetNode) {
        const key = this.getNodeKey();

        if (!targetNode.getAttribute(key)) {
            // This context menu has already been unregistered from this node
            return;
        }

        this.targetNodes.splice(this.targetNodes.indexOf(targetNode), 1)

        targetNode.removeEventListener(this.getTriggerEvent(), this.targetClickListener);

        targetNode.removeAttribute(key);
        targetNode.removeAttribute(this.getOverlayAttribute());
    }

    addNode(targetNode) {
        const key = this.getNodeKey();

        if (targetNode.getAttribute(key)) {
            // This context menu has already been registered to this node
            return;
        }

        // This array is used to keep track of DOM nodes we add our event listener to
        // It will be used by destroy() to remove the event listeners
        const targetNodes = this.targetNodes || (this.targetNodes = []);

        targetNode.addEventListener(this.getTriggerEvent(), this.getTargetClickListener())

        targetNode.setAttribute(key, true);
        targetNode.setAttribute(this.getOverlayAttribute(), true);

        targetNodes.push(targetNode);
    }

    getRequiredArea() {
        return this.getRenderingArea();
    }

    getRenderingArea() {
        const { menu } = this.getInput();

        if (!this.#renderingArea) {
            this.#renderingArea = menu.getRenderingArea();
        }

        return this.#renderingArea;
    }

    isPointerBased() {
        return true;
    }
}
module.exports = ContextMenu;