
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

    beforeRender() {
        const { DEFAULT_TRUNCATE_SIZE } = VerticalNavigation;

        const input = this.getInput();

        if (!input.truncateSize) {
            input.truncateSize = DEFAULT_TRUNCATE_SIZE;
        }

        this.on('remove.sections_$', ({ value: section }) => {
            if (!section) return;

            const { id } = section;

            this.#sectionIds.splice(
                this.#sectionIds.indexOf(id), 1
            );
        });

        this.on('insert.sections_$.items_$', ({ value: item, parentObject }) => {
            if (!item) return;

            const { id: sectionId } = parentObject['@parentRef'];

            item.sectionId = sectionId;
            this.#items[item.id] = item;
        });

        this.on('remove.sections_$.items_$', ({ value: item }) => {
            if (!item) return;

            const { id } = item;

            this.#itemIds.splice(
                this.#itemIds.indexOf(id), 1
            );

            delete this.#items[id];
        });
    }

    immutablePaths() {
        return ['sections_$.id', 'sections_$.items_$.id'];
    }

    initializers() {
        return {
            ['sections_$.id']: () => this.randomString(),
            ['sections_$.items_$.id']: () => this.randomString(),
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
        const { sections } = this.getInput();

        const { overflow } = sections[Number(sectionIndex)];
        overflow.expanded = !overflow.expanded;
    }
}
module.exports = VerticalNavigation;