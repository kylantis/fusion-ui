
class GlobalNavigation extends BaseComponent {

    init() {
        this.getInput().tabs[0].isActive;
    }

    preRender() {
    }

    onMount() {
        // Display content container
        const contentContainer = this.getContentContainer();
        contentContainer.style.visibility = 'visible';
    }
    
    events() {
        return [
            ...super.events(),
            'tabActive', 'tabInactive', 'tabItemClick', 'tabClose'
        ]
    }

    defaultHandlers() {
        return {
            tabItemClick: (identifier) => {
                this.setActiveItem(identifier);
            },
            tabClose: (identifier) => { },
            tabActive: (identifier) => {
                this.closeOpenSubMenu();
            },
        };
    }

    getItems() {
        return this.items || (this.items = {})
    }

    getActive() {
        const items = this.getItems();

        for (const [identifier, { isActive }] of Object.entries(items)) {
            if (isActive) {
                return identifier;
            }
        }
    }

    getContentNodeSelector() {
        // Note: due to the transform 'captureContentCoordinates' used by the
        // .content div, it is wrapped in a block, and ultimately is rendered
        // within a wrapper div
        const { getWrapperCssClass } = BaseComponent;
        return `#${this.getId()} > .${getWrapperCssClass()} > .content`;
    }

    getContentContainer() {
        return document.querySelector(this.getContentNodeSelector());
    }

    contentTransform({ node }) {
        const contentContainer = node.querySelector(':scope > .content');

        // Temporarily make the content container hidden, so the user does not see as
        // tab contents are being stacked on top of one another in tabTransform(...) 

        contentContainer.style.visibility = 'hidden';
    }

    hideContent(identifier) {
        this.getContentDiv(identifier).style.zIndex = -1;
    }

    showContent(identifier) {
        this.getContentDiv(identifier).style.zIndex = 1;
    }

    setActiveItem(identifier, force = true) {

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
            this.dispatch('tabInactive', active)
        }

        // Indicate that this tab is active
        item.li.classList.add(activeClassName);

        this.showContent(identifier);

        item.isActive = true;
        this.dispatch('tabActive', identifier)
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

    createTabContentContainer(identifier) {
        const contentDiv = document.createElement('div');

        contentDiv.id = this.getContentId(identifier);
        contentDiv.classList.add('global-navigation-cd');

        contentDiv.style.zIndex = -1;

        this.getContentContainer().appendChild(contentDiv);
        return contentDiv.id;
    }

    getDefaultTabContent() {
        return new components.Illustration({
            input: {
                verticallyAlign: true,
                summary: 'No Content',
                name: 'no_content'
            }
        })
    }

    tabTransform({ node, blockData }) {

        const li = node.querySelector(':scope > .slds-context-bar__item');

        const _this = this;

        const { index = -1, length } = blockData[`tabs`] || {};

        const { isActive, subMenu, content } = this.getInput()['tabs'][index]

        const items = this.getItems();

        const identifier = li.getAttribute('identifier');

        if (!identifier) {
            const msg = `[${this.getId()}] Empty item identifier`;
            throw Error(msg)
        }

        items[identifier] = { li, hasSubMenu: !!subMenu, content, subMenu };

        if (!content) {
            // Todo: Use a default to indicate no content
            content = this.getDefaultTabContent();
        }

        // Load content. 
        // Note: we need to add the promise to this component's <futures> object, so
        // that it becomes part of this component's loading sequence
        this.futures.push(
            content
            .load({ container: this.createTabContentContainer(identifier) })
        )

        if (isActive) {
            this.setActiveItem(identifier, false);
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
                    this.setActiveItem(identifier);
                    break;
                }
            }
        }

        this.addListeners(li);
    }

    addListeners(li) {
        const _this = this;

        // When a tab is clicked, dispatch 'tabItemClick' event
        li.addEventListener('click', function (evt) {
            const identifier = this.getAttribute('identifier');
            if (_this.isSecondaryEvent(evt)) {
                return;
            }
            _this.dispatch('tabItemClick', identifier)
        }, false);


        // If the 'trigger-submenu' button is clicked, toggleSubMenuVisibility
        li.querySelector('.trigger-submenu')
            .addEventListener('click', function (evt) {
                const identifier = this.parentNode.getAttribute('identifier');
                _this.toggleSubMenuVisibility(identifier);
            });

        // If the 'trigger-close' button is clicked, dispatch 'tabClose' event
        li.querySelector('.trigger-close')
            .addEventListener('click', function (evt) {
                const identifier = this.parentNode.parentNode.getAttribute('identifier');
                _this.dispatch('tabClose', identifier)
            });
    }

    isSubMenuOpen(identifier) {
        const items = this.getItems();

        const { classList } = items[identifier].li;
        const cssClassName = 'slds-is-open';

        return classList.contains(cssClassName);
    }

    closeOpenSubMenu() {
        if (this.visibleSubMenu) {
            // Close the submenu that's open first
            this.toggleSubMenuVisibility(this.visibleSubMenu);
        }
    }

    toggleSubMenuVisibility(identifier) {

        const items = this.getItems();

        const { classList } = items[identifier].li;
        const cssClassName = 'slds-is-open';

        if (classList.contains(cssClassName)) {
            classList.remove(cssClassName);
            this.visibleSubMenu = null;
        } else {
            this.closeOpenSubMenu();

            classList.add(cssClassName);
            this.visibleSubMenu = identifier;
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
        const { path } = event;

        for (const elem of path) {
            const { classList } = elem;

            switch (true) {
                // A submenu item was clicked
                case classList.contains(global.components.Menu.itemClassName()):
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