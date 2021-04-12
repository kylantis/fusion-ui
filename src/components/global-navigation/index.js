
class GlobalNavigation extends BaseComponent {

    init() {
        this.getInput().tabs[0].isActive;
        this.getInput().switcher.isActive;
    }

    getSwitcherIdentifier() {
        return 'switcher_identifier';
    }

    events() {
        return [
            ...super.events(),
            'tabActive', 'tabInactive', 'tabItemClick'
        ]
    }

    defaultHandlers() {
        return {
            tabItemClick: (identifier) => {

                const items = this.getItems();
                const { hasSubMenu, content, li } = items[identifier];

                console.info();

                if (content) {
                    this.setActiveItem(identifier);

                    if (hasSubMenu && !this.isMobile()) {
                        // If on mobile, we can't close the visible sub menu, because
                        // the user may want to access the submenu - and they need to click
                        // to access it. On desktop, we can close because the user can just 
                        // hover to re-open the submenu

                        this.closeVisibleSubMenu();
                    }
                }
            }
        };
    }

    closeVisibleSubMenu() {
        if (this.lastItemFocused) {

            const items = this.getItems();
            const item = items[this.lastItemFocused];

            const { li } = item;

            if (this.isMobile()) {
                const { parentNode } = li;
                parentNode.innerHTML = parentNode.innerHTML;

                item.li = parentNode.querySelector('.slds-context-bar__item');
                this.addClickListener(item.li);

            } else {
                li.classList.add('slds-dropdown-trigger_click');

                li.addEventListener('mouseleave', function () {

                    const identifier = this.getAttribute('identifier');
                    items[identifier].li.classList.remove('slds-dropdown-trigger_click');
                }, {
                    once: true
                });
            }
        }
    }

    /**
     * Note: This sets item.isActive to false, but makes no change
     * to the content in view. The user would need to update that
     * manually, by calling setContent(...)
     */
    clearSelection() {

        const activeClassName = 'slds-is-active';

        if (this.lastItemFocused) {

            this.closeVisibleSubMenu();

            const items = this.getItems();
            const item = items[this.lastItemFocused];
            const { li } = item;

            li.classList.remove(activeClassName);
            item.isActive = false;
        }
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

    setContent(identifier) {

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
            activeItem.isActive = false;

            this.dispatch('tabInactive', active)
        }

        // Indicate that this tab is active
        item.li.classList.add(activeClassName);

        if (item.content) {
            this.setContent(identifier);
        }

        item.isActive = true;
        this.dispatch('tabActive', identifier)
    }

    itemTransform({ node, blockData }) {

        const li = node.querySelector(':scope > .slds-context-bar__item');

        const _this = this;

        const { index = -1, length } = blockData[`tabs`] || {};

        const { isActive, subMenu, content } = index >= 0 ?
            this.getInput()['tabs'][index] :
            this.getInput()['switcher'];

        const items = this.getItems();

        const identifier = li.getAttribute('identifier');

        if (!identifier) {
            const msg = `[${this.getId()}] Empty item identifier`;
            throw Error(msg)
        }

        items[identifier] = { li, hasSubMenu: !!subMenu, content, subMenu };

        if (isActive) {
            this.setActiveItem(identifier, false);
        }

        if (
            // If index < 0, i.e -1, then this is the switcher bar item, else
            // this is one of the tab bar items
            index > 0 &&
            index == length - 1 && !this.getActive()) {

            // This is the last tab, but we do not yet have any active tab
            // Look for the first tab that has content, and make that the 
            // active one
            for (const identifier of [...Object.keys(items)]) {
                if (items[identifier].content) {
                    this.setActiveItem(identifier);
                    break;
                }
            }
        }

        if (!this.isMobile()) {
            li.addEventListener('mouseenter', function (evt) {
                const identifier = this.getAttribute('identifier');
                _this.lastItemFocused = identifier;

                // Todo: use .slds-has-focus
            }, false);
        }

        this.addClickListener(li);
    }

    addClickListener(li) {
        const _this = this;
        const items = this.getItems();

        li.addEventListener('click', function (evt) {

            const identifier = this.getAttribute('identifier');
            const item = items[identifier];

            // If this item has a submenu, this handler will be triggered
            // when item(s) on the submenu are clicked
            if (item.hasSubMenu && _this.isSubMenuRelatedEvent(item, evt)) {
                return;
            }

            _this.lastItemFocused = identifier;

            // Trigger the click event
            _this.dispatch('tabItemClick', identifier)
        }, false);
    }

    isSubMenuRelatedEvent(item, event) {
        const { subMenu } = item;
        const { path } = event;

        for (const elem of path) {
            const { classList } = elem;

            switch (true) {
                case classList.contains(subMenu.itemClassName()):
                    return true;
                case classList.contains('slds-context-bar__item'):
                    return false;
                default:
                    break;
            }
        }
        return false;
    }

}
module.exports = GlobalNavigation;