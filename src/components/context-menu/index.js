
class ContextMenu extends components.OverlayComponent {

    constructor(opts) {
        super(opts);
        this.testMode = opts.testMode;
    }

    initCompile() {
        this.getInput().clickType;
        this.getInput().useTargetPosition;
        this.getInput().hideOnItemClick;
        this.getInput().positions[0];
    }

    hooks() {
        return {
            menu: (evt) => this.onMenuChange(evt.newValue)
        }
    }

    getSupportedPositions() {
        const { positions } = this.getInput()
        return (positions && positions.length) ?
            [...positions] :
            ["bottom-right", "bottom-left", "top-right", "top-left"];
    }

    onMenuChange(newMenu) {

        // Note: Hooks are eagerly called by RootProxy - even before the
        // newValue is validated, transformed or saved, hence we need to 
        // manually validate that <menu> is a Menu instance
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
        const { cloneMenu, getMenuNode } = ContextMenu;
        const { getOverlayConfig } = components.OverlayComponent;

        this.destroyMenus();

        this.menus = {};

        this.getSupportedPositions().forEach(pos => {
            switch (pos) {
                case "top-left":
                    this.menus[pos] = cloneMenu(menu, 'left', 'top');
                    break;
                case "top-right":
                    this.menus[pos] = cloneMenu(menu, 'right', 'top');
                    break;
                case "bottom-left":
                    this.menus[pos] = cloneMenu(menu, 'left', 'bottom');
                    break;
                case "bottom-left":
                    this.menus[pos] = cloneMenu(menu, 'left', 'bottom');
                    break;
            }
        });

        const { container } = getOverlayConfig();

        await Promise.all(
            Object.values(this.menus)
                .map(menu =>
                    menu.load({ container })
                        .then(() => {
                            const node = getMenuNode(menu);

                            node.style.top = 0;
                            node.style.left = 0;

                            // Note: This will override .slds-dropdown: transform: translateX(-50%);
                            // in lightning design css
                            node.style.transform = `translateX(0%)`;

                            node.style.visibility = 'hidden';

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

                const { getMenuNode } = ContextMenu;
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

        targetNodes.push(targetNode);
    }

    static getBodyClickListener() {
        const { getInstances } = ContextMenu;

        return ContextMenu.bodyClickListener || (
            ContextMenu.bodyClickListener = ({ target }) => {

                Object.values(getInstances())
                    .forEach(i => {
                        let { hideOnItemClick } = i.getInput();

                        if (hideOnItemClick == null) {
                            hideOnItemClick = true;
                        }

                        if (i.targetNodes && i.targetNodes.includes(target)) {
                            // Clicks on <targetNodes> is handled by this.targetClickListener
                            return;
                        }

                        if (!i.selectedMenuItemArea || hideOnItemClick) {
                            i.hide();
                        }
                    });
            });
    };

    static getInstances() {
        return ContextMenu.instances || (ContextMenu.instances = {});
    }

    async onMount() {
        const { getInstances, getBodyClickListener } = ContextMenu;
        const { menu } = this.getInput();

        await this.calculateAreas();

        await this.setupMenus(menu);

        Object.values(this.menus)
            .forEach(menu => {

                document.querySelectorAll(
                    `#${menu.getElementId()} > .slds-dropdown li.slds-dropdown__item`
                )
                    .forEach(node => {
                        node.addEventListener("click", (evt) => {
                            this.selectedMenuItemArea = true;

                            setTimeout(() => {
                                this.selectedMenuItemArea = null;
                            }, 200);
                        });
                    })
            });

        getInstances()[this.getId()] = this;

        if (!ContextMenu.bodyClickListener) {
            document.body.addEventListener('click', getBodyClickListener());
        }
    }

    getRequiredArea(position) {
        return this.areas[position].requiredArea;
    }

    getRenderingArea(position) {
        return this.areas[position].renderingArea;
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

    async calculateAreas() {

        const { cloneMenu, calculateArea0 } = ContextMenu;

        this.areas = {};

        // Render a container div where our menu will be rendered
        // The reason we want to provide a container instead of have the menu
        // rendered in the document body is because we want it to be invisible
        const container = document.createElement('div');
        container.id = global.clientUtils.randomString();

        if (!this.testMode) {
            container.style.visibility = 'hidden';
        }

        document.body.appendChild(container);

        this.areas['top-left'] = this.areas['top-right'] =
            await calculateArea0(
                cloneMenu(this.getInput().menu, 'right', 'top'),
                container,
                'top',
                !this.testMode
            )

        this.areas['bottom-left'] = this.areas['bottom-right'] =
            await calculateArea0(
                cloneMenu(this.getInput().menu, 'right', 'bottom'),
                container,
                'bottom',
                !this.testMode
            )

        if (!this.testMode) {
            document.body.removeChild(container);
        }
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

        return {
            requiredArea, renderingArea
        }
    }

    static cloneMenu(menu, x, y) {

        const { cloneComponent } = BaseComponent;
        const { randomString } = global.clientUtils;

        let x0 = x;

        const inputVisitor = (input) => {
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

        return cloneComponent(menu, inputVisitor);
    }

}
module.exports = ContextMenu;