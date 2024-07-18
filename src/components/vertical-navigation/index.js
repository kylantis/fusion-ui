
class VerticalNavigation extends components.LightningComponent {

    static DEFAULT_TRUNCATE_SIZE = 3;

    #sectionIds = [];
    #itemIds = [];

    #items = {};

    beforeCompile() {
        this.getInput().truncateSize;

        this.getInput().sections[0].items[0].sectionId;
        this.getInput().sections[0].items[0].rendered;
    }

    eventHandlers() {
        return {
            ['remove.sections_$']: ({ value: section }) => {
                if (!section) return;

                const { id } = section;

                this.#sectionIds.splice(
                    this.#sectionIds.indexOf(id), 1
                );
            },
            ['insert.sections_$.items_$']: ({ value: item, parentObject }) => {
                if (!item) return;

                const { id: sectionId } = parentObject['@parentRef'];

                item.sectionId = sectionId;
                this.#items[item.id] = item;
            },
            ['remove.sections_$.items_$']: ({ value: item }) => {
                if (!item) return;

                const { id } = item;

                this.#itemIds.splice(
                    this.#itemIds.indexOf(id), 1
                );

                delete this.#items[id];
            }
        }
    }

    beforeRender() {
        const { DEFAULT_TRUNCATE_SIZE } = VerticalNavigation;

        const input = this.getInput();

        if (!input.truncateSize) {
            input.truncateSize = DEFAULT_TRUNCATE_SIZE;
        }

        this.on('remove.sections_$', 'remove.sections_$');
        this.on('insert.sections_$.items_$', 'insert.sections_$.items_$');
        this.on('remove.sections_$.items_$', 'remove.sections_$.items_$');
    }

    immutablePaths() {
        return ['sections_$.id', 'sections_$.items_$.id'];
    }

    initializers() {
        return {
            ['sections_$.id']: () => this.randomString(),
            ['sections_$.items_$.id']: () => this.randomString(),
            ['sections_$.overflow']: () => { },
            ['sections_$.overflow.expanded']: false,
        }
    }

    transformers() {
        return {
            ['sections_$.id']: (sectionId) => {
                if (this.#sectionIds.includes(sectionId)) {
                    sectionId = this.randomString();
                }
                this.#sectionIds.push(sectionId);
                return sectionId;
            },

            ['sections_$.items_$.id']: (itemId) => {
                if (this.#itemIds.includes(itemId)) {
                    itemId = this.randomString();
                }
                this.#itemIds.push(itemId);
                return itemId;
            },
        };
    }

    events() {
        return ['itemClick', 'itemRender'];
    }

    behaviours() {
        return ['toggleOverflowArea'];
    }

    onItemClick(item_id) {
        this.dispatchEvent('itemClick', item_id);
    }

    onItemRender(itemId) {

        // Note: due to way we are executing this method from the template, we need
        // to ignore any compile-time invocations
        if (!self.appContext) return;

        const item = this.getItems()[itemId];
        assert(item);

        if (!item.rendered) {
            item.rendered = true;

            this.dispatchEvent('itemRender', item);
        }

        return '';
    }

    getItems() {
        return this.#items;
    }

    toggleOverflowArea(sectionIndex) {
        const input = this.getInput();

        if (input) {
            const { sections } = input;

            const { overflow } = sections[Number(sectionIndex)];
            overflow.expanded = !overflow.expanded;

        } else {

            const node = this.getNode().querySelector(`.slds-nav-vertical__section[data-index='${sectionIndex}']`);

            if (!node || !node.querySelector('.slds-nav-vertical__overflow')) return;

            const btn = node.querySelector('.slds-nav-vertical__action_overflow');
            if (!btn) return; // overflow is disabled

            const currentValue = btn.getAttribute('aria-expanded') == 'true';
            const newLabel = !currentValue ? 'Show Less' : 'Show More';

            btn.setAttribute('aria-expanded', !currentValue);
            btn.querySelector('.slds-nav-vertical__action-text').childNodes
                .forEach((node, i) => {
                    switch (i) {
                        case 0:
                            assert(node.nodeType == Node.TEXT_NODE);
                            node.textContent = newLabel;
                            break;
                        case 1:
                            assert(node.classList.has('.slds-assistive-text'));
                            node.innerHTML = newLabel;
                            break;
                    }
                });

            const { classList } = node.querySelector(`#section-${sectionIndex}-overflow`);

            if (!currentValue) {
                classList.add('slds-show');
                classList.remove('slds-hide');
            } else {
                classList.add('slds-hide');
                classList.remove('slds-show');
            }
        }
    }
}
module.exports = VerticalNavigation;