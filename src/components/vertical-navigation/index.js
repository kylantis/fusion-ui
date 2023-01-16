
class VerticalNavigation extends components.LightningComponent {

    static DEFAULT_TRUNCATE_SIZE = 3;

    initCompile() {
        this.getInput().truncateSize;

        // Client-only field needed by <this.items> to help us map sections to items
        this.getInput().sections[0].items[0].sectionId;
    }

    beforeMount() {
        const { DEFAULT_TRUNCATE_SIZE } = VerticalNavigation;

        const input = this.getInput();

        if (!input.truncateSize) {
            input.truncateSize = DEFAULT_TRUNCATE_SIZE;
        }

        this.ensureUniqueIds();
    }

    hooks() {
        return {
            ['sections_$']: ({ oldValue, newValue }) => {
                if (newValue == undefined && oldValue) {
                    const items = this.getItems();

                    Object.values(items)
                        .forEach(({ id, sectionId }) => {
                            if (sectionId == oldValue.id) {
                                delete items[id];
                            }
                        })
                }
            },
            ['sections_$.items_$']: ({ oldValue, newValue }) => {
                if (newValue == undefined && oldValue) {
                    const items = this.getItems();
                    delete items[oldValue.id];
                }
            }
        }
    }

    ensureUniqueIds() {
        const { sections } = this.getInput();

        const itemIds = [];
        for (const section of sections) {
            this.verifySectionId(section);

            section.items.forEach(item => {
                if (!item.id) {
                    item.id = clientUtils.randomString();
                }
                if (itemIds.includes(item.id)) {
                    this.throwError(`Duplicate item id "${item.id}"`);
                }
                itemIds.push(item.id);
            })
        }
    }

    events() {
        return ['click', 'beforeItemRegistered'];
    }

    getItems() {
        return this.items || (this.items = {});
    }

    verifySectionId(section) {
        const { sections } = this.getInput();

        if (!section.id) {
            section.id = clientUtils.randomString();
        }

        if (sections.filter((e) => e != section).map(({ id }) => id).includes(section.id)) {
            this.throwError(`Duplicate section id "${section.id}"`);
        }
    }

    itemHook({ node, blockData, initial }) {

        if (node.querySelector('div').innerHTML.trim() == "") {
            return;
        }

        const { pathSeparator } = RootProxy;

        const { index: sectionIndex } = blockData['sections'];
        const { index: itemIndex } = blockData[`sections_$${pathSeparator}items`];

        const { sections } = this.getInput();

        const section = sections[sectionIndex];

        this.verifySectionId(section);

        const item = section.items[itemIndex];

        if (!item.id) {
            item.id = clientUtils.randomString();
        }

        if (this.getItems()[item.id]) {
            this.throwError(`Duplicate item id "${item.id}"`);
        }

        item.sectionId = section.id;

        this.dispatchEvent('beforeItemRegistered', item)

        this.getItems()[item.id] = item;
    }

    onClick(item_id) {
        this.dispatchEvent('click', item_id);
    }

    toggleOverflowArea(sectionIndex) {
        const { sections } = this.getInput();

        const { overflow } = sections[Number(sectionIndex)];
        overflow.expanded = !overflow.expanded;
    }
}
module.exports = VerticalNavigation;