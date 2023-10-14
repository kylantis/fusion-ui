
class GlobalNavigation extends components.LightningComponent {

    #spinner;

    beforeCompile() {

        // DEV PURPOSE ONLY - PLEASE REMOVE
        components.SidebarLayout;
        components.Illustration;

        components.OverlayComponent;

        this.getInput().tabs[0].isActive;
        this.getInput().tabs[0].contentPadding;
    }

    destroy() {
        document.body.removeEventListener('click', this.bodyClickListener);
        delete this.bodyClickListener;

        super.destroy();

        if (this.#spinner) {
            this.#spinner.destroy();
        }
    }

    hooks() {
        return {}
    }

    getDefaultValues() {
        return {
            ['tabs_$.identifier']: () => this.randomString()
        };
    }

    beforeLoad() {
        this.#createSpinner();
    }

    #createSpinner() {
        const spinner = new components.Spinner();
        this.#spinner = spinner;

        spinner.load();
    }

    onMount() {
        this.on('bodyClick', () => {
            this.closeOpenSubMenu();
        });
    }

    isSolidIcon(icon) {
        return icon.isSolid();
    }

    onTabIconSolidStateChange(icon) {
        const input = icon.getInput();
        input.marginRight = icon.isSolid() ? 'x-small' : null;
    }

    events() {
        return [
            'tabActive', 'tabInactive', 'tabItemClick', 'tabClose'
        ]
    }

    defaultHandlers() {
        return {
            tabItemClick: async (identifier) => {
                const { expandOnHover } = this.getInput();

                if (!expandOnHover) {
                    this.closeOpenSubMenu();
                }

                await this.setActiveItem(identifier);
            },
            tabClose: (identifier) => { },
            tabActive: (identifier) => {
                const { expandOnHover } = this.getInput();

                // Once a tab becomes active we want to ensure that all submenus are closed.
                // If <expandOnHover> is enabled we want to temporarily ensure that when the tab is
                // hovered, the submenus are not made visible

                if (expandOnHover) {
                    const { li, subMenu } = this.getItems()[identifier];

                    // Note: if <li> was opened programmatically, slds-dropdown-trigger_click and slds-is-open
                    // would already be added to its classList



                    // Todo: After data hooks have been fully implemented, this if block may no
                    // longer be necessary because we have a logic target that does exactly
                    // this on the template, i.e. {{ ../expandOnHover ? "" : "slds-dropdown-trigger_click"}}

                    if (!li.classList.contains('slds-dropdown-trigger_click')) {
                        li.classList.add('slds-dropdown-trigger_click')
                    }


                    if (li.classList.contains('slds-is-open')) {
                        li.classList.remove('slds-is-open')
                    }

                    this.visibleSubMenuHover = null;

                    if (subMenu) {
                        li.querySelector('.trigger-submenu').style.visibility = 'visible';
                    }

                } else {
                    // The submenu is likely already closed by the tabItemClick handler.
                    // Call closeOpenSubMenu, in case the tab was made active programmatically
                    this.closeOpenSubMenu();
                }
            },
            tabInactive: (identifier) => {
                const { expandOnHover } = this.getInput();

                if (expandOnHover) {
                    const { li } = this.getItems()[identifier];
                    // Revert the changes made in defaultHandlers.tabActive

                    li.classList.remove('slds-dropdown-trigger_click')
                    li.querySelector('.trigger-submenu').style.visibility = 'hidden';
                }
            },
        };
    }

    behaviours() {
        return ['closeOpenSubMenu'];
    }

    getItems() {
        return this.items || (this.items = {})
    }

    getTabSubmenuTriggerButton(identifier) {
        return this.getInlineComponent(`tab-${identifier}-submenuTrigger-button`);
    }

    getTabCloseButton(identifier) {
        return this.getInlineComponent(`tab-${identifier}-close-button`);
    }

    getActive() {
        const items = this.getItems();

        for (const [identifier, { isActive }] of Object.entries(items)) {
            if (isActive) {
                return identifier;
            }
        }
    }

    getContentContainer() {
        return document.querySelector(
            `#${this.getElementId()} > div > div.content`
        );
    }

    hideContent(identifier) {
        this.getContentDiv(identifier).style.zIndex = -1;
    }

    showContent(identifier) {
        this.getContentDiv(identifier).style.zIndex = 1;
    }

    beforeContentLoaded(container) {

        // If the content contains any overlay components, we need to configure them accordingly
        const overlayConfig = components.OverlayComponent.getOverlayConfig();

        // Use <container> as their new parent, this is especially important as <container>
        // has a separate scrollview, and if the overlay component remains on the body, this will
        // cause it's position to remain static when <container> is being scrolled
        overlayConfig.container = container;
    }

    afterContentLoaded() {
        const overlayConfig = components.OverlayComponent.getOverlayConfig();
        // Prune the configs used in beforeContentLoaded(...)
        delete overlayConfig.container;
    }

    showLoader() {
        if (!this.#spinner.canDisplay()) {
            this.#spinner.setCssDisplay();
        }

        this.#spinner.show((n) => this.show0(n));

        this.clearSpinnerDisplayTimeout();
    }

    hideLoader() {
        this.#spinner.hide((n) => this.hide0(n));

        this.clearSpinnerDisplayTimeout();

        this.spinnerDisplayTimeout = setTimeout(() => {
            this.#spinner.setCssDisplay('none');
        },
            this.getSpinnerDisplayTimeoutInMillis()
        )
    }

    clearSpinnerDisplayTimeout() {
        if (this.spinnerDisplayTimeout) {
            clearTimeout(this.spinnerDisplayTimeout);
        }
        this.spinnerDisplayTimeout = null;
    }

    getSpinnerDisplayTimeoutInMillis() {
        return 60000;
    }

    async setActiveItem(identifier, force = true) {

        // If another tab is actively being loaded, do nothing
        if (this.loading) {
            return;
        }

        const items = this.getItems();
        const active = this.getActive();

        const activeClassName = 'slds-is-active';

        const item = items[identifier];

        if (active) {

            if (
                // The tab is already active
                active == identifier ||
                // Another tab is active, and we don't want to override
                !force
            ) {
                return;
            }

            const activeItem = items[active];

            activeItem.li.classList.remove(activeClassName)

            this.hideContent(active);

            activeItem.isActive = false;
            this.dispatchEvent('tabInactive', active)
        }

        if (!item.isLoaded) {
            this.showLoader();
            
            this.createTabContentContainer(identifier);
        }

        // Indicate that this tab is active
        item.li.classList.add(activeClassName);

        this.showContent(identifier);

        // Note: tab contents are loaded lazily by default
        // If tab context is not yet loaded, load it.
        if (!item.isLoaded) {
            this.loading = true;

            let { content } = item;

            if (!content) {
                content = this.getDefaultTabContent();
            }

            const container = this.getContentId(identifier);

            this.beforeContentLoaded(container);

            if (this.isMounted()) {
                content.once(() => {
                    this.hideLoader();
                }, 'render');
            }

            await content.load({ container, domRelayTimeout: this.isMounted() ? 50 : 0 });

            if (!this.isMounted()) {
                this.hideLoader();
            }

            this.afterContentLoaded(container);

            item.isLoaded = true;

            this.loading = false;
        }

        item.isActive = true;
        this.dispatchEvent('tabActive', identifier);
    }

    getContentDiv(identifier) {
        const contentContainer = this.getContentContainer();
        return contentContainer.querySelector(
            `:scope > #${this.getContentId(identifier)}`
        );
    }

    getContentId(identifier) {
        return `${this.getId()}-content-${identifier}`;
    }

    getDefaultTabContent() {
        return new components.Illustration({
            input: {
                verticallyAlign: true,
                description: 'Page not available',
                size: 'small',
                name: 'page_not_available'
            }
        })
    }

    createTabContentContainer(identifier) {
        const { contentPadding } = this.getItems()[identifier];

        const contextBar = this.getNode().querySelector(':scope > .slds-context-bar');
        const topOffset = Number(getComputedStyle(contextBar).height.replace('px', ''));

        const contentDiv = document.createElement('div');

        contentDiv.id = this.getContentId(identifier);

        contentDiv.style.position = 'absolute';
        contentDiv.style.width = '100%';
        contentDiv.style.height = `${window.innerHeight - topOffset}px`;
        contentDiv.style.overflow = 'scroll';

        if (contentPadding) {
            contentDiv.classList.add(`slds-p-${contentPadding}`);
        }

        contentDiv.style.zIndex = -1;

        this.getContentContainer().appendChild(contentDiv);

        return contentDiv.id;
    }

    async tabHook({ node, blockData }) {
        const li = node.querySelector(':scope > .slds-context-bar__item');

        const { index = -1, length } = blockData[`tabs`] || {};

        let { isActive, subMenu, content, contentPadding } = this.getInput()['tabs'][index]

        const items = this.getItems();

        const identifier = li.getAttribute('identifier');

        if (!identifier) {
            const msg = `[${this.getId()}] Empty item identifier`;
            throw Error(msg)
        }

        if (items[identifier]) {
            throw Error(`Tab with identifier "${identifier}" already exists`);
        }

        [
            li,
            this.getTabSubmenuTriggerButton(identifier).getNode(),
            this.getTabCloseButton(identifier).getNode()
        ]
            .forEach(node => {
                node.setAttribute(this.getOverlayAttribute(), true)
            });

        items[identifier] = {
            li, hasSubMenu: !!subMenu, content, subMenu, contentPadding
        };

        if (isActive && !this.getActive()) {
            // Set this item active, only if no tab is currently active. This means
            // that if in the input data, more than one tab is specified as active,
            // only the first one will be made active.
            await this.setActiveItem(identifier, false);
        }

        if (
            // This is the last tab, 
            index == length - 1 &&
            // but we do not yet have any active tab
            !this.getActive()) {
            // Look for the first tab that has content, and make that the 
            // active one
            for (const identifier of [...Object.keys(items)]) {
                if (items[identifier].content) {
                    await this.setActiveItem(identifier);
                    break;
                }
            }
        }

        this.addListeners(li);
    }

    addListeners(li) {
        const _this = this;
        const items = this.getItems();

        // When a tab is clicked, dispatch 'tabItemClick' event
        li.addEventListener('click', function (evt) {
            const identifier = this.getAttribute('identifier');
            if (_this.isSecondaryEvent(evt)) {
                return;
            }
            _this.dispatchEvent('tabItemClick', identifier)
        }, false);

        // If the 'trigger-close' button is clicked, dispatch 'tabClose' event
        li.querySelector('.trigger-close button')
            .addEventListener('click', (evt) => {
                let identifier;
                for (const node of evt.composedPath()) {
                    if (node.matches(`li.slds-context-bar__item`)) {
                        identifier = node.getAttribute('identifier');
                        break;
                    }
                }
                assert(!!identifier);

                this.dispatchEvent('tabClose', identifier)
            });

        // If the 'trigger-submenu' button is clicked, toggleSubMenuVisibility
        li.querySelector('.trigger-submenu button').addEventListener('click', (evt) => {
            let identifier;
            for (const node of evt.composedPath()) {
                if (node.matches(`li.slds-context-bar__item`)) {
                    identifier = node.getAttribute('identifier');
                    break;
                }
            }
            assert(!!identifier);

            this.toggleSubMenuVisibility(identifier);
        });

        li.addEventListener('mouseenter', function (evt) {
            const { expandOnHover } = _this.getInput();
            const identifier = this.getAttribute('identifier');

            if (!expandOnHover ||
                // When an item is active, the trigger-submenu button is used to toggle
                // submenu visibility
                items[identifier].isActive
            ) {
                return;
            }
            _this.visibleSubMenuHover = identifier;
        });
        li.addEventListener('mouseleave', function (evt) {
            const { expandOnHover } = _this.getInput();
            const identifier = this.getAttribute('identifier');

            if (!expandOnHover ||
                // When an item is active, the trigger-submenu button is used to toggle
                // submenu visibility
                items[identifier].isActive
            ) {
                return;
            }

            _this.visibleSubMenuHover = null;
        });
    }

    closeOpenSubMenu() {
        if (this.visibleSubMenuHover) {
            this.toggleSubMenuVisibility(this.visibleSubMenuHover);
        }
        if (this.visibleSubMenu) {
            this.toggleSubMenuVisibility(this.visibleSubMenu);
        }
    }

    toggleSubMenuVisibility(identifier) {

        const { expandOnHover } = this.getInput();
        const items = this.getItems();

        const { li, isActive } = items[identifier];

        if (expandOnHover && !isActive) {

            if (
                li.matches('li:hover') ||
                // This submenu was likely opened programmatically
                li.matches('.slds-is-open')
            ) {

                // Close submenu

                if (li.classList.contains('slds-is-open')) {
                    // This submenu was likely opened programmatically
                    li.classList.remove(
                        'slds-dropdown-trigger_click',
                        'slds-is-open'
                    );

                    this.visibleSubMenuHover = null;
                } else {
                    li.classList.add('slds-dropdown-trigger_click');
                    setTimeout(() => {
                        li.classList.remove('slds-dropdown-trigger_click');
                    }, 50);
                }

            } else {
                this.closeOpenSubMenu();

                // Open submenu

                // This function likely was called directly through the dev console
                li.classList.add(
                    'slds-dropdown-trigger_click',
                    'slds-is-open'
                );

                // We need to indicate that this submenu is open, so that when the user clicks on
                // the document body, it will be closed automatically
                this.visibleSubMenuHover = identifier;
            }

        } else {
            const { classList } = li;

            const cssClassName = 'slds-is-open';

            if (classList.contains(cssClassName)) {
                // Close submenu

                classList.remove(cssClassName);
                this.visibleSubMenu = null;
            } else {
                this.closeOpenSubMenu();

                // Open submenu

                classList.add(cssClassName);
                this.visibleSubMenu = identifier;
            }
        }
    }

    /**
     * When a user clicks on a submenu item, or the submenu trigger button or 
     * close button, all of these are secondary events
     * 
     * @param item 
     * @param {Event} event 
     * @returns 
     */
    isSecondaryEvent(event) {

        for (const elem of event.composedPath()) {
            const { classList } = elem;

            switch (true) {
                // A submenu item was clicked
                case classList.contains(components.Menu.itemClassName()):
                // The 'trigger-submenu' button was clicked
                case classList.contains('trigger-submenu'):
                // The 'trigger-close' button was clicked
                case classList.contains('trigger-close'):
                    return true;
                case classList.contains('slds-context-bar__item'):
                    return false;
                default:
                    break;
            }
        }
        return false;
    }

    detachTab(identifier) {

    }

    closeSubMenu(identifier) {
        const items = this.getItems();
        const item = items[identifier];

        const { li } = item;
        const { parentNode } = li;

        parentNode.innerHTML = parentNode.innerHTML;

        item.li = parentNode.querySelector('.slds-context-bar__item');

        // Re-attach the click listener to li
        this.addListeners(item.li);

        if (item.li.children.length > 2) {
            // This item contains a submenu
            // We need to bring back the old submenu because we lost the event listeners
            // when we re-assigned innerHTML
            item.li.children.item(2).replaceWith(li.children.item(2));
        }
    }

}
module.exports = GlobalNavigation;