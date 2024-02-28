
class NavigationBar extends components.LightningComponent {

    #itemsBlockData = {};

    onMount() {
        this.on('remove.items_$', ({ value: item }) => {
            if (!item) return;

            const { id } = item;
            delete this.#itemsBlockData[id];
        });
    }

    events() {
        return ['itemClick'];
    }

    behaviours() {
        return ['closeSubMenu'];
    }

    initializers() {
        return {
            ['items_$.id']: () => this.randomString(),
        }
    }

    navItemClickListener(evt) {
        const { target } = evt;

        const itemId = target.getAttribute('data-id');
        const hasSubMenu = target.getAttribute('data-has-submenu');

        // If this item has a submenu, this handler will be triggered
        // when item(s) on the submenu are clicked
        if (hasSubMenu && this.#isSubMenuRelatedEvent(evt)) {
            return;
        }

        this.dispatchEvent('itemClick', itemId)
    }

    itemHook({ node, blockData }) {
        const itemId = node.querySelector(':scope > li').getAttribute('data-id');
        this.#itemsBlockData[itemId] = blockData;
    }

    #isSubMenuRelatedEvent(event) {
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

    closeSubMenu(itemId) {
        const li = this.getNode().querySelector(`li[data-id='${itemId}']`);

        if (!li) return;

        const blockData = this.#itemsBlockData[itemId];
        const decorator = this.getDecorator('item_decorator');

        this.executeWithBlockData(() => {
            this.renderDecorator(decorator, li.parentNode);
        }, blockData);
    }

}
module.exports = NavigationBar;