
class NavigationBar extends components.LightningComponent {

    beforeCompile() {
    }

    events() {
        return ['navItemClick'];
    }

    defaultHandlers() {
        return {
        };
    }

    getItems() {
        return this.items || (this.items = {})
    }

    registerNavItem({ node, blockData }) {

        const li = node.querySelector(':scope > .slds-context-bar__item');

        const { index = -1 } = blockData[`items`] || {};

        const { subMenu } = this.getInput()['items'][index]

        const items = this.getItems();

        const identifier = li.getAttribute('identifier');

        if (!identifier) {
            const msg = `[${this.getId()}] Empty item identifier`;
            throw Error(msg)
        }

        items[identifier] = { li, hasSubMenu: !!subMenu, subMenu };

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
            if (item.hasSubMenu && _this.isSubMenuRelatedEvent(evt)) {
                return;
            }

            // Trigger the click event
            _this.dispatchEvent('navItemClick', identifier)
        }, false);
    }

    isSubMenuRelatedEvent(event) {
        const { path } = event;

        for (const elem of path) {
            const { classList } = elem;

            switch (true) {
                case classList.contains(components.Menu.itemClassName()):
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
        const items = this.getItems();
        const item = items[identifier];

        const { li } = item;
        const { parentNode } = li;

        parentNode.innerHTML = parentNode.innerHTML;

        item.li = parentNode.querySelector('.slds-context-bar__item');

        // Re-attach the click listener to li
        this.addClickListener(item.li);

        if (item.li.children.length > 1) {
            // This item contains a submenu
            // We need to bring back the old submenu because we lost the event listeners
            // when we re-assigned innerHTML
            item.li.children.item(2).replaceWith(li.children.item(2));
        }
    }

}
module.exports = NavigationBar;