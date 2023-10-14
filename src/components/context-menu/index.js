
class ContextMenu extends components.OverlayComponent {

    constructor(opts) {
        super(opts);
        this.testMode = opts.testMode;
    }

    static getInstances() {
        return ContextMenu.instances || (ContextMenu.instances = {});
    }

    beforeCompile() {
        this.getInput().clickType;
        this.getInput().useTargetPosition;
        this.getInput().positions[0];
    }

    hooks() {
        return {
            ['afterMount.menu']: ({ newValue }) => this.onMenuChange(newValue)
        }
    }

    async onMount() {
        const { getInstances } = ContextMenu;
        const { menu } = this.getInput();

        await this.setupMenus(menu);

        this.on('bodyClick', () => {
            this.hide();
        });

        getInstances()[this.getId()] = this;
    }

    getDefaultSupportedPositions() {
        return ["bottom-right", "bottom-left", "top-right", "top-left"];
    }

    getSupportedPositions() {
        const { positions } = this.getInput();

        const defaultSupported = this.getDefaultSupportedPositions();

        if (positions && positions.length) {
            positions.forEach(p => {
                if (!defaultSupported.includes(p)) {
                    this.throwError(`Unknown position "${p}"`);
                }
            })
            return [...positions];
        } else {
            return defaultSupported;
        }
    }

    onMenuChange(newMenu) {
        assert(newMenu instanceof components.Menu);
        this.setupMenus(newMenu);
    }

    static getMenuNode(menu) {
        return document.querySelector(`#${menu.getElementId()} > .slds-dropdown`);
    }

    show() {
        const { getMenuNode } = ContextMenu;
        const node = getMenuNode(this.currentMenu);

        node.style.visibility = 'visible';
        node.classList.add('visible');
    }

    hide() {
        if (!this.currentMenu) {
            return;
        }

        const { getMenuNode } = ContextMenu;
        const node = getMenuNode(this.currentMenu);

        this.prevTarget = null;

        if (node.classList.contains('visible')) {
            node.classList.remove('visible');

            const fn = () => {
                node.style.visibility = 'hidden';
                node.removeEventListener('transitionend', fn);
            };

            node.addEventListener('transitionend', fn);
        }
    }

    destroyMenus() {
        if (!this.menus) {
            return;
        }

        Object.values(this.menus).forEach(menu => {
            menu.destroy();
        });

        delete this.menus;
    }

    async setupMenus(menu) {
        const { cloneMenu, getMenuNode, calculateArea0 } = ContextMenu;
        const { cloneComponent, cloneInputData } = BaseComponent;
        const { getOverlayConfig } = components.OverlayComponent;

        this.destroyMenus();

        this.areas = {};

        const menuData = {};

        const getSupportedVerticalPositions = (y0) => {
            return this.getSupportedPositions()
                .map(position => {
                    const { x, y } = this.getPositionXY(position);
                    return { position, x, y }
                })
                .filter(({ y }) => y == y0);
        }

        const calculateArea = async (container, { x, y, position }) => {

            this.areas[y] =
                await calculateArea0(
                    cloneMenu(menu, x, y, (i) => {
                        // clone and cache input, so we don't have to re-visit again by calling cloneMenu(...) below
                        menuData[position] = cloneInputData(i);
                    }),
                    container,
                    y,
                    !this.testMode
                )
        }

        const calculateAreas = async () => {

            // Render a container div where our menu will be rendered
            // The reason we want to provide a container instead of have the menu
            // rendered in the document body is because we want it to be invisible
            const container = document.createElement('div');
            container.id = this.randomString();

            if (!this.testMode) {
                container.style.visibility = 'hidden';
            }

            document.body.appendChild(container);

            const topPositions = getSupportedVerticalPositions('top');
            const bottomPositions = getSupportedVerticalPositions('bottom');

            await Promise.all([
                topPositions.length ? calculateArea(container, topPositions[0]) : null,
                bottomPositions.length ? calculateArea(container, bottomPositions[0]) : null
            ]);

            if (!this.testMode) {
                document.body.removeChild(container);
            }
        }

        await calculateAreas();

        this.menus = {};

        this.getSupportedPositions()
            .forEach(pos => {
                const { x, y } = this.getPositionXY(pos);

                this.menus[pos] = menuData[pos] ?
                    cloneComponent({ component: menu, inputProducer: () => menuData[pos] })
                    : cloneMenu(menu, x, y);
            });

        const { container } = getOverlayConfig();

        await Promise.all(
            Object.values(this.menus)
                .map(menu =>
                    menu.load({ container, style: { visibility: 'hidden' } })
                        .then(() => {
                            const node = getMenuNode(menu);

                            node.style.top = 0;
                            node.style.left = 0;

                            // Note: This will override .slds-dropdown: transform: translateX(-50%);
                            // in lightning design css
                            node.style.transform = `translateX(0%)`;

                            node.classList.add('lightning-context-menu');
                        })
                )
        );
    }

    destroy() {
        const { getInstances } = ContextMenu;
        this.destroyMenus();

        // Remove event listeners
        if (this.targetNodes) {
            this.targetNodes.forEach(node => {
                this.removeNode(node);
            });
            delete this.targetNodes;
            delete this.targetClickListener;
        }

        delete getInstances()[this.getId()];

        super.destroy();
    }

    getTargetClickListener() {
        return this.targetClickListener || (
            this.targetClickListener = async (evt) => {

                const { getInstances, getMenuNode } = ContextMenu;
                const { clickType, useTargetPosition } = this.getInput();
                let { which, x, y, target } = evt;

                if (
                    (which == 1 && clickType == 'left') ||
                    (which == 3 && clickType == 'right')) {

                    if (useTargetPosition) {
                        const targetRect = target.getBoundingClientRect();

                        x = targetRect.x + (targetRect.width / 2);
                        y = targetRect.y + (targetRect.height / 2);
                    }

                    if (this.prevTarget == target) {
                        this.hide();

                        return;
                    }

                    this.prevTarget = target;

                    const { position, fn } = this.getPosition(
                        this.getBoundingClientRectOffset0({
                            width: 0, height: 0,
                            top: y,
                            bottom: y,
                            left: x,
                            right: x,
                        })
                    );

                    const menu = this.menus[position];

                    if (this.currentMenu && this.currentMenu != menu) {
                        this.hide();
                    } else {
                        // If we call hide(), our 'transitionend' callback will be invoked after the menu
                        // is visible, hence causing it to be hidden
                    }

                    this.currentMenu = menu;

                    fn(getMenuNode(this.currentMenu));

                    this.show();

                    // Hide other context menu instances
                    Object.values(getInstances())
                        .filter(i => i != this)
                        .forEach(i => {
                            i.hide();
                        })
                }
            }
        )
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

    getPositionXY(position) {
        const [y, x] = position.split('-');
        return { x, y };
    }

    getRequiredArea(position) {
        const { y } = this.getPositionXY(position);
        return (this.areas[y] || {}).requiredArea;
    }

    getRenderingArea(position) {
        const { y } = this.getPositionXY(position);
        return (this.areas[y] || {}).renderingArea;
    }

    isPointerBased() {
        return true;
    }

    static containsSubMenu(menu) {
        for (const group of menu.getInput().groups) {
            for (const item of group.items) {
                if (item.subMenu) {
                    return true;
                }
            }
        }
        return false;
    }

    static async calculateArea0(component, container, subMenuPosition, pruneComponent) {

        const { containsSubMenu } = ContextMenu;

        await component.load({ container: container.id });

        const menuSelector = `#${component.getElementId()} > .slds-dropdown`;
        const menuNode = document.querySelector(menuSelector);

        if (subMenuPosition === 'top') {
            menuNode.style.bottom = 0;
        } else {
            menuNode.style.top = 0;
        }

        menuNode.style.left = 0;
        menuNode.style.transform = 'translateX(0%)';

        const menuRect = menuNode.getBoundingClientRect();

        const renderingArea = {
            horizontal: menuRect.width,
            vertical: menuRect.height,
        };

        let requiredArea;

        if (containsSubMenu(component)) {
            const requiredRect = {
                right: window.innerWidth,
                bottom: window.innerHeight,
                top: window.innerHeight,
            };

            document.querySelectorAll(`${menuSelector} .slds-dropdown_submenu`)
                .forEach(node => {
                    node.previousElementSibling.setAttribute('aria-expanded', true);

                    const { x, y, height, width } = node.getBoundingClientRect();

                    const right = window.innerWidth - (x + width);
                    const bottom = window.innerHeight - (y + height);
                    const top = y;

                    if (right < requiredRect.right) {
                        requiredRect.right = right;
                    }
                    if (bottom < requiredRect.bottom) {
                        requiredRect.bottom = bottom;
                    }
                    if (subMenuPosition === 'top' && top < requiredRect.top) {
                        requiredRect.top = top;
                    }
                });

            requiredArea = {
                horizontal: window.innerWidth - requiredRect.right,
                vertical: window.innerHeight - (subMenuPosition === 'top' ? requiredRect.top : requiredRect.bottom),
            };

            if (requiredArea.horizontal < 0) {
                this.logger.warn(`${component.getId()} has a cumulative width that is larger than the viewport`);
                requiredArea.horizontal = window.innerWidth + Math.abs(requiredArea.horizontal);
            }

            if (requiredArea.vertical < 0) {
                this.logger.warn(`${component.getId()} has a cumulative height that is larger than the viewport`);
                requiredArea.vertical = window.innerHeight + Math.abs(requiredArea.vertical);
            }

        } else {
            requiredArea = renderingArea;
        }

        if (pruneComponent) {
            component.destroy();
        }

        return { requiredArea, renderingArea }
    }

    static cloneMenu(menu, x, y, inputConsumer) {

        const { cloneComponent, randomString } = BaseComponent;

        let x0 = x;

        const inputVisitor = (input) => {
            input.overlay = false;
            input.groups.forEach(group => {

                const children = [];

                group.items.forEach((item) => {
                    if (item.subMenu) {

                        item.subMenuX = x0;
                        item.subMenuY = y;

                        children.push(item.subMenu.getInput());
                    }

                    // Inorder for context menu to work properly, each item
                    // should have an identifier

                    if (!item.identifier) {
                        item.identifier = randomString();
                    }
                });

                x0 = x0 === 'left' ? 'right' : 'left'

                children.forEach(inputVisitor);
            })
            return input;
        }

        return cloneComponent({
            component: menu, inputVisitor, inputConsumer
        });
    }

}
module.exports = ContextMenu;