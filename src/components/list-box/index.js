
class ListBox extends components.LightningComponent {

    #itemIds = [];
    #items = {};

    beforeRender() {

        this.on('insert.groups_$.items_$', ({ value: item, initial }) => {
            if (!item) return;

            this.#items[item.identifier] = item;

            if (!initial) {
                this.dispatchEvent('itemsUpdate', [...this.#items], [item], []);
            }
        });

        this.on('remove.groups_$.items_$', ({ value: item }) => {
            if (!item) return;

            const { identifier } = item;

            this.#itemIds.splice(
                this.#itemIds.indexOf(identifier), 1
            );

            delete this.#items[identifier];

            if (!initial) {
                this.dispatchEvent('itemsUpdate', [...this.#items], [], [item]);
            }
        });
    }

    immutablePaths() {
        return ['groups_$.items_$.identifier'];
    }

    initializers() {
        return {
            ['length']: () => 'five',
            ['type']: () => 'vertical',
            ['groups_$.items_$.identifier']: () => this.randomString()
        };
    }

    transformers() {
        return {
            ['groups_$.items_$.identifier']: (identifier) => {
                if (this.#itemIds.includes(identifier)) {
                    identifier = this.randomString();
                }
                this.#itemIds.push(identifier);
                return identifier;
            },
        };
    }

    events() {
        return ['click', 'itemsUpdate'];
    }

    cloneInlineComponents() {
        return ['groups_$.items_$.icon'];
    }

    getItems() {
        return this.#items;
    }

    onClick(identifier) {

        const { [identifier]: { disabled } } = this.getItems();

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