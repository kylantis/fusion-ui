/*
 *  Fusion UI
 *  Copyright (C) 2025 Kylantis, Inc
 *  
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *  
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *  
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

class GlobalNavigation extends components.LightningComponent {

    #tabIds = [];

    #items = {};
    #expandOnHover;

    #mountPromise;

    beforeCompile() {
        this.getInput().tabs[0].isActive;
        this.getInput().tabs[0].contentPadding;
    }

    eventHandlers() {
        return {
            ['remove.tabs_$']: ({ value: tab }) => {
                if (!tab) return;

                const { identifier } = tab;

                this.#tabIds.splice(
                    this.#tabIds.indexOf(identifier), 1
                );

                delete this.#items[identifier];
            }
        }
    }

    beforeRender() {
        this.on('remove.tabs_$', 'remove.tabs_$');

        this.#mountPromise = new Promise(resolve => {
            this.on('afterMount', resolve);
        });
    }

    onMount() {

        BaseComponent.on('bodyClick', () => {
            this.closeOpenSubMenu();
        });
    }

    initializers() {
        return {
            ['tabs_$.identifier']: () => this.randomString(),
            ['useWaffleIcon']: () => true
        };
    }

    transformers() {
        return {
            ['tabs_$.identifier']: (tabId) => {
                if (!tabId || this.#tabIds.includes(tabId)) {
                    tabId = this.randomString();
                }
                this.#tabIds.push(tabId);
                return tabId;
            },
            ['expandOnHover']: (value) => {
                this.#expandOnHover = value;
            }
        };
    }

    destroy() {
        document.body.removeEventListener('click', this.bodyClickListener);
        delete this.bodyClickListener;

        super.destroy();
    }


    behaviours() {
        return [
            'showSpinner', 'hideSpinner', 'setActiveItem', 'closeOpenSubMenu',
            'toggleSubMenuVisibility', 'closeSubMenu'
        ];
    }

    events() {
        return [
            'tabActive', 'tabInactive', 'tabItemClick', 'tabClose', 'waffleClick'
        ]
    }

    defaultHandlers() {
        return {
            tabItemClick: (identifier) => {
                if (!this.#expandOnHover) {
                    this.closeOpenSubMenu();
                }

                BaseComponent.dispatchEvent('bodyClick');

                this.setActiveItem(identifier);
            },
            tabClose: (identifier) => { },
            tabActive: (identifier) => {
                // Once a tab becomes active we want to ensure that all submenus are closed.
                // If <expandOnHover> is enabled we want to temporarily ensure that when the tab is
                // hovered, the submenus are not made visible

                if (this.#expandOnHover) {
                    const { li, subMenu } = this.#getItems()[identifier];

                    // Note: if <li> was opened programmatically, slds-dropdown-trigger_click and slds-is-open
                    // would already be added to its classList


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
                if (this.#expandOnHover) {
                    const { li } = this.#getItems()[identifier];
                    // Revert the changes made in defaultHandlers.tabActive

                    li.classList.remove('slds-dropdown-trigger_click')
                    li.querySelector('.trigger-submenu').style.visibility = 'hidden';
                }
            },
        };
    }

    #getItems() {
        return this.#items;
    }

    isSolidIcon(icon) {
        return icon.isSolid();
    }

    onTabIconSolidStateChange(icon) {
        const input = icon.getInput();
        input.marginRight = icon.isSolid() ? 'x-small' : null;
    }

    #getTabSubmenuTriggerButton(identifier) {
        return this.getInlineComponent(`tab-${identifier}-submenuTrigger-button`);
    }

    #getTabCloseButton(identifier) {
        return this.getInlineComponent(`tab-${identifier}-close-button`);
    }

    #getActive() {
        const items = this.#getItems();

        for (const [identifier, { isActive }] of Object.entries(items)) {
            if (isActive) {
                return identifier;
            }
        }
    }

    #getContentContainer() {
        return document.querySelector(
            `#${this.getElementId()} > div > div.content`
        );
    }

    #hideContent(identifier) {
        this.#getContentDiv(identifier).style.zIndex = -1;
    }

    #showContent(identifier) {
        this.#getContentDiv(identifier).style.zIndex = 1;
    }

    #beforeContentLoaded(containerSelector) {

        // If the content contains any overlay components, we need to configure them accordingly
        const overlayConfig = components.OverlayComponent.getOverlayConfig();

        // Use <container> as their new parent, this is especially important as <container>
        // has a separate scrollview, and if the overlay component remains on the body, this will
        // cause it's position to remain static when <container> is being scrolled
        overlayConfig.container = containerSelector;

        const containerNode = document.querySelector(containerSelector);

        containerNode.addEventListener('scroll', components.OverlayComponent.containerScrollListener);
    }

    #afterContentLoaded() {
        const overlayConfig = components.OverlayComponent.getOverlayConfig();
        // Prune the configs used in #beforeContentLoaded(...)
        delete overlayConfig.container;
    }

    showSpinner() {
        const spinner = this.getInlineComponent('spinner');

        if (!spinner.canDisplay()) {
            spinner.setCssDisplay();
        }

        spinner.show();

        this.#clearSpinnerDisplayTimeout();
    }

    hideSpinner() {
        const spinner = this.getInlineComponent('spinner');

        spinner.hide();

        this.#clearSpinnerDisplayTimeout();

        this.spinnerDisplayTimeout = setTimeout(() => {
            spinner.setCssDisplay('none');
        },
            this.#getSpinnerDisplayTimeoutInMillis()
        )
    }

    #clearSpinnerDisplayTimeout() {
        if (this.spinnerDisplayTimeout) {
            clearTimeout(this.spinnerDisplayTimeout);
        }
        this.spinnerDisplayTimeout = null;
    }

    #getSpinnerDisplayTimeoutInMillis() {
        return 60000;
    }

    getDefaultDomRelayTimeout() {
        return 50;
    }

    async setActiveItem(identifier, force = true) {

        // If another tab is actively being loaded, do nothing
        if (this.loading) {
            return;
        }

        const items = this.#getItems();
        const active = this.#getActive();

        const activeClassName = 'slds-is-active';

        const item = items[identifier];

        if (
            // The tab is already active
            active == identifier ||
            // Another tab is active, and we don't want to override
            !force
        ) {
            return;
        }

        // Indicate that this tab is active
        item.li.classList.add(activeClassName);

        if (active) {
            const activeItem = items[active];

            activeItem.li.classList.remove(activeClassName)

            this.#hideContent(active);

            activeItem.isActive = false;
            this.dispatchEvent('tabInactive', active)
        }

        item.isActive = true;

        if (!item.isLoaded) {
            this.#createTabContentContainer(identifier);
        }

        // Note: tab contents are loaded lazily by default
        // If tab context is not yet loaded, load it.

        if (!item.isLoaded) {
            this.loading = true;

            let { content } = item;

            if (!content) {
                content = await this.#getDefaultTabContent();
            }

            await this.#loadContentIntoTab(identifier, content);

            item.isLoaded = true;
            this.loading = false;

        } else {
            this.#showContent(identifier);
        }
    }

    async #loadContentIntoTab(identifier, content) {
        this.showSpinner();

        const containerSelector = `#${this.#getContentId(identifier)}`;

        this.#beforeContentLoaded(containerSelector);

        await content.load({ container: containerSelector, domRelayTimeout: this.isMounted() ? 50 : 0 });

        this.#showContent(identifier);

        this.hideSpinner();

        this.#afterContentLoaded(containerSelector);

        this.dispatchEvent('tabActive', identifier);
    }

    #getContentDiv(identifier) {
        const contentContainer = this.#getContentContainer();
        return contentContainer.querySelector(
            `:scope > #${this.#getContentId(identifier)}`
        );
    }

    #getContentId(identifier) {
        return `${this.getElementId()}-content-${identifier}`;
    }

    async #getDefaultTabContent() {

        // Since 'Illustration' is not inlined in the template, loading of the component class will be
        // deffered, hence we need to wait (if necessary) until this component is mounted
        await this.#mountPromise;

        return new components.Illustration({
            input: {
                verticallyAlign: true,
                description: 'Page not available',
                size: 'small',
                name: 'page_not_available'
            }
        })
    }

    #createTabContentContainer(identifier) {
        const { contentPadding } = this.#getItems()[identifier];

        const contextBar = this.getNode().querySelector(':scope > .slds-context-bar');
        const topOffset = Number(getComputedStyle(contextBar).height.replace('px', ''));

        const contentDiv = document.createElement('div');

        contentDiv.id = this.#getContentId(identifier);

        contentDiv.style.position = 'absolute';
        contentDiv.style.width = '100%';
        contentDiv.style.height = `${window.innerHeight - topOffset}px`;
        contentDiv.style.overflow = 'scroll';

        if (contentPadding) {
            contentDiv.classList.add(`slds-p-${contentPadding}`);
        }

        contentDiv.style.zIndex = -1;

        this.#getContentContainer().appendChild(contentDiv);

        return contentDiv.id;
    }

    async tabHook({ node, blockData }) {

        const li = node.querySelector(':scope > .slds-context-bar__item');

        const { index, length } = blockData['tabs'];

        const { isActive, subMenu, content, contentPadding } = this.getInput()['tabs'][index]

        const items = this.#getItems();

        const identifier = li.getAttribute('identifier');

        [
            li,
            this.#getTabSubmenuTriggerButton(identifier).getNode(),
            this.#getTabCloseButton(identifier).getNode()
        ]
            .forEach(node => {
                node.setAttribute(this.getOverlayAttribute(), true)
            });


        // Todo: stop maiintaining a separate items object

        items[identifier] = { li, hasSubMenu: !!subMenu, content, subMenu, contentPadding };

        if (isActive && !this.#getActive()) {
            // Set this item active, only if no tab is currently active. This means
            // that if in the input data, more than one tab is specified as active,
            // only the first one will be made active.

            await this.setActiveItem(identifier, false);
        }

        if (
            // This is the last tab, 
            index == length - 1 &&
            // but we do not yet have any active tab
            !this.#getActive()) {

            // Look for the first tab that has content, and make that the active one
            const identifier = Object.keys(items).find(id => items[id].content);

            if (identifier) {
                await this.setActiveItem(identifier);
            }
        }

        this.#addListeners(li);
    }

    #addListeners(li) {

        // When a tab is clicked, dispatch 'tabItemClick' event
        li.addEventListener('click', (evt) => {
            const { currentTarget } = evt;
            const identifier = currentTarget.getAttribute('identifier');

            if (this.#isSecondaryEvent(evt)) {
                return;
            }
            this.dispatchEvent('tabItemClick', identifier)
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

        li.addEventListener('mouseenter', (evt) => {
            const { currentTarget } = evt;

            const identifier = currentTarget.getAttribute('identifier');
            const items = this.#getItems();

            if (!this.#expandOnHover ||
                // When an item is active, the trigger-submenu button is used to toggle
                // submenu visibility
                items[identifier].isActive
            ) {
                return;
            }
            this.visibleSubMenuHover = identifier;
        });

        li.addEventListener('mouseleave', (evt) => {
            const { currentTarget } = evt;

            const identifier = currentTarget.getAttribute('identifier');
            const items = this.#getItems();

            if (!this.#expandOnHover ||
                // When an item is active, the trigger-submenu button is used to toggle
                // submenu visibility
                items[identifier].isActive
            ) {
                return;
            }

            this.visibleSubMenuHover = null;
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
        const items = this.#getItems();

        const { li, isActive } = items[identifier];

        if (this.#expandOnHover && !isActive) {

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
    #isSecondaryEvent(event) {

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

    closeSubMenu(identifier) {
        const items = this.#getItems();
        const item = items[identifier];

        const { li } = item;
        const { parentNode } = li;

        parentNode.innerHTML = parentNode.innerHTML;

        item.li = parentNode.querySelector('.slds-context-bar__item');

        // Re-attach the click listener to li
        this.#addListeners(item.li);

        if (item.li.children.length > 2) {
            // This item contains a submenu
            // We need to bring back the old submenu because we lost the event listeners
            // when we re-assigned innerHTML
            item.li.children.item(2).replaceWith(li.children.item(2));
        }
    }

    onWaffleButtonClick() {
        this.dispatchEvent('waffleClick');
    }
}
module.exports = GlobalNavigation;