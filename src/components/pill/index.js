
class Pill extends components.LightningComponent {

    initializers() {
        return {
            ['items_$']: (item) => {
                const { randomString } = BaseComponent;

                if (!item.identifier) {
                    item.identifier = randomString();
                }
            }
        }
    }

    events() {
        return ['removeButtonClick', 'click'];
    }

    onClick(identifier) {
        this.dispatchEvent('click', identifier);
    }

    onRemoveButtonClick(identifier) {
        this.dispatchEvent('removeButtonClick', identifier);

        const { items } = this.getInput();
        const idx = items.findIndex(({ identifier: id }) => id == identifier);

        assert(idx >= 0);
        items.splice(idx, 1);
    }

}
module.exports = Pill;