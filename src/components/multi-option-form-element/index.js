
class MultiOptionFormElement extends components.FormElement {

    #items = {};

    static isAbstract() {
        return true;
    }

    eventHandlers() {
        return {
            ['remove.items_$']: ({ value: item }) => {
                if (!item) return;

                delete this.getItems()[this.getItemInputId(item)];
            }
        }
    }

    beforeRender() {
        const input = this.getInput();
        const { items } = input;

        // If no options were provided, isLoadable() should have returned false, and this should not have executed
        assert(items.length);

        if (!this.isCompound()) {

            // This is needed because {{> render_standalone}} does not access "items_$.required", rather it only
            // uses "required". However, any future updates needs to be done directly on input.required

            const [item] = items;
            if (!input.required && item.required) {
                input.required = true;
            }
        }

        this.on('remove.items_$', 'remove.items_$');
    }

    isLoadable() {
        const { type, items } = this.getInput();

        if (!type) {
            this.logger.warn(null, `A type needs to be specified`);
            return false;
        }

        if (!items.length) {
            this.logger.warn(null, `At least one option needs to be provided`);
            return false;
        }

        return super.isLoadable();
    }

    isCompound() {
        const { items } = this.getInput();
        return super.isCompound() || items.length > 1;
    }

    getItems() {
        return this.#items;
    }

    isMultiCheckable() {
        const { type } = this.getInput();
        return type == 'checkbox';
    }

    getItemInputName(item) {
        const { random } = this.getGlobalVariables();

        if (this.isMultiCheckable()) {
            if (!item.name) {
                item.name = this.randomString();
            }
        } else {
            item.name = random;
        }

        return item.name;
    }

    getItemInputId(item) {
        const { randomProperty } = BaseComponent.CONSTANTS;

        const id = `${this.getId()}${this.isCompound() ? `-${item[randomProperty]}` : ''}`;
        return `${id}_input`;
    }

    getCheckedItems() {
        const { items } = this.getInput();
        return items.filter(({ checked: c }) => c);
    }

    getCheckedItem() {
        return this.getCheckedItems()[0];
    }

    registerItem(item) {

        if (!this.isMultiCheckable() && item.checked) {
            this.uncheck();
        }

        const inputId = this.getItemInputId(item);
        this.getItems()[inputId] = item;

        return '';
    }

    uncheck() {
        const checkeditem = this.getCheckedItem();

        if (checkeditem) {
            checkeditem.checked = false;

            this.dispatchEvent('change', checkeditem.name, false);
        }
    }

    onChange(evt) {
        const { checked, id } = evt.target;

        if (!this.isMultiCheckable()) {
            this.uncheck();
        }

        const item = this.getItems()[id];
        item.checked = checked;

        this.dispatchEvent('change', item.name, checked);
    }
}

module.exports = MultiOptionFormElement;