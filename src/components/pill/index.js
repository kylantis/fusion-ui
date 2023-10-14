
class Pill extends components.LightningComponent {

    getDefaultValues() {
        return {
            ['items_$.identifier']: () => this.randomString()
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