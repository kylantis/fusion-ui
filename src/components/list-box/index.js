
class ListBox extends components.LightningComponent {

    static DEFAULT_LENGTH = 'five';
    static DEFAULT_TYPE = 'vertical';

    #items = [];

    getDefaultValues() {
        const { DEFAULT_LENGTH, DEFAULT_TYPE } = ListBox;
        return {
            ['length']: () => DEFAULT_LENGTH,
            ['type']: () => DEFAULT_TYPE,
            ['groups_$.items_$.identifier']: () => this.randomString()
        };
    }

    #populateItemsArray() {
        const { groups } = this.getInput();

        groups
            .filter(g => g).forEach(({ items }) => {
                items.filter(i => i).forEach(item => {
                    this.#addToItems(item);
                })
            })
    }

    afterMount() {
        this.#populateItemsArray();
    }

    events() {
        return ['click', 'itemsUpdate'];
    }

    getAllItems() {
        return this.#items;
    }

    getAllItemIdentifiers() {
        return this.#items.map(({ identifier }) => identifier);
    }

    #addToItems(item) {
        const { identifier } = item;
        const identifiers = this.getAllItemIdentifiers();

        if (!identifier) {
            this.throwError(`Empty item identifier provided`);
        }

        if (identifiers.includes(identifier)) {
            this.throwError(`Item identifier "${identifier}" already exists`);
        }

        this.#items.push(item);
    }

    #removeFromItems(item) {
        const { identifier } = item;
        const identifiers = this.getAllItemIdentifiers();
        
        const idx = identifiers.indexOf(identifier);
        assert(idx >= 0);

        this.#items.splice(idx, 1);
    }

    hooks() {
        return {



            // TODO: If a group is removed, remove all Items inside it a well
            // i.e. this.#removeFromItems


            // Combo box should have events "initialTrigger" and "trigger" - this is absolutely necessary
            // for cases when the listbox need to be lazy loaded





            ['beforeMount.groups_$.items']: (evt) => {

                const { arrayChildReorderHookType, collChildSetHookType, collChildDetachHookType } = RootProxy;
                const { hookType, hookOptions, newValue: groupItems } = evt;

                let itemsUpdated = false;

                const addedItems = [];
                const removedItems = [];

                const addItem = (item) => {
                    if (!item) return;
                    this.#addToItems(item);
                    addedItems.push(item);
                    itemsUpdated = true;
                }

                const removeItem = (item) => {
                    if (!item) return;
                    this.#removeFromItems(item);
                    removedItems.push(item);
                    itemsUpdated = true;
                }

                if (hookType) {
                    const { childKey, oldValue, newIndexes } = hookOptions;

                    switch (hookType) {
                        case collChildSetHookType:
                            addItem(groupItems[childKey]);
                        case collChildDetachHookType:
                            removeItem(oldValue);
                            break;
                        case arrayChildReorderHookType:
                            newIndexes.forEach(i => {
                                addItem(groupItems[i]);
                            });
                            break;
                    }
                } else {
                    const { oldValue } = evt;

                    if (oldValue) {
                        oldValue.forEach(v => {
                            removeItem(v);
                        });
                    }
                    if (groupItems) {
                        groupItems.forEach(v => {
                            addItem(v);
                        })
                    }
                }

                if (itemsUpdated) {
                    this.dispatchEvent('itemsUpdate', [...this.#items], addedItems, removedItems);
                }
            }
        }
    }

    getAllItems() {
        const { items } = this.getInput();
        return items;
    }

    onClick(identifier) {

        const { [identifier]: { disabled } } = this.getAllItems();

        if (!disabled) {
            this.dispatchEvent('click', identifier);
        }
    }

    lengthTransform(value) {
        if (!value) return value;

        const prefix = `slds-dropdown_length-`;

        return `${prefix}${(() => {
            switch (value) {
                case 'five':
                    return '5';
                case 'seven':
                    return '7';
                case 'ten':
                    return '10';
                case 'with-icon-five':
                    return 'with-icon-5';
                case 'with-icon-seven':
                    return 'with-icon-7';
                case 'with-icon-ten':
                    return 'with-icon-10';
            }
        })()}`
    }

    isSolidIcon(icon) {
        return icon.isSolid();
    }

}
module.exports = ListBox;