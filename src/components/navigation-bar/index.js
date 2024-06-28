
class NavigationBar extends components.LightningComponent {

    #itemsBlockData = {};

    eventHandlers() {
        return {
            ['remove.items_$']: ({ value: item }) => {
                if (!item) return;

                const { id } = item;
                delete this.#itemsBlockData[id];
            },
            ['splice.items']: ({ offsetIndexes, newLength }) => {
                Object.values(this.#itemsBlockData)
                    .forEach(blockData => {
                        const entry = blockData['items'];
                        const j = offsetIndexes[entry.index];

                        if (j !== undefined) {
                            entry.index = j;
                        }

                        entry.length = newLength;
                    });
            }
        }
    }

    immutablePaths() {
        return ['items_$.id'];
    }

    onMount() {
        this.on('remove.items_$', 'remove.items_$');
        this.on('splice.items', 'splice.items');
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

    transformers() {
        return {
            ['items_$.id']: (id) => {
                if (this.#itemsBlockData[id]) {
                    id = this.randomString();
                }
                return id;
            },
        };
    }

    navItemClickListener(evt) {
        const { currentTarget } = evt;

        const itemId = currentTarget.getAttribute('data-id');
        const hasSubMenu = currentTarget.getAttribute('data-has-submenu');

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

    async closeSubMenu(itemId) {
        const li = this.getNode().querySelector(`li[data-id='${itemId}']`);
        if (!li) return;

        const blockData = this.#itemsBlockData[itemId];
        this.renderDecorator('item_decorator', li.parentNode, blockData);
    }

}
module.exports = NavigationBar;