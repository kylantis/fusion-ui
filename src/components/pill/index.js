
class Pill extends components.LightningComponent {

    #identifiers = [];

    onMount() {
        this.on('remove.items_$', ({ value: item }) => {
            if (!item) return;

            const { identifier } = item;

            const index = this.#identifiers.indexOf(identifier);
            assert(index >= 0);

            this.#identifiers.splice(index, 1);
        });
    }

    immutablePaths() {
        return ['items_$.identifier'];
    }

    cloneInlineComponents() {
        const { itemPredicate } = this.getInput();
        return itemPredicate ? true : [
            'items[0].avatar',
            'items[0].icon',
        ]
    }

    initializers() {
        return {
            ['items_$.identifier']: () => this.randomString(),
            ['alignment']: () => 'horizontal',
        };
    }

    transformers() {
        return {
            ['items_$.identifier']: (identifier) => {
                if (this.#identifiers.includes(identifier)) {
                    identifier = this.randomString();
                }
                this.#identifiers.push(identifier);
                return identifier;
            },
        };
    }

    events() {
        return ['itemRemove', 'click'];
    }

    onClick(identifier) {
        this.dispatchEvent('click', identifier);
    }

    getIndexForIdentifier(identifier) {
        const { items } = this.getInput();
        return items.findIndex(({ identifier: id }) => id == identifier);
    }

    onRemoveButtonClick(identifier) {
        const { defaultPrevented } = this.dispatchEvent('itemRemove', identifier);

        if (!defaultPrevented) {
            const { items } = this.getInput();
            const idx = this.getIndexForIdentifier(identifier);

            assert(idx >= 0);
            items.splice(idx, 1);
        }
    }

    itemPredicateFn(item) {
        const { itemPredicate } = this.getInput();

        const inlineParent = this.getInlineParent();

        if (itemPredicate && inlineParent) {
            const predicateFn = inlineParent[itemPredicate];

            if (typeof predicateFn == "function") {
                return predicateFn.bind(inlineParent)(item);
            }
        }
        return true;
    }

    refreshItem(identifier) {
        const { predicateHookType } = BaseComponent.CONSTANTS;

        const idx = this.getIndexForIdentifier(identifier);

        if (idx >= 0) {
            this.triggerHook({
                path: `items[${idx}]`, hookType: predicateHookType
            })
        }
    }

}
module.exports = Pill;