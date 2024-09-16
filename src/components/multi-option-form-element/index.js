
class MultiOptionFormElement extends components.FormElement {

    static isAbstract() {
        return true;
    }

    beforeCompile() {
        this.getInput().items[0].name;
        this.getInput().items[0].inputId;
    }

    eventHandlers() {
        return {
            ['insert.items_$']: ({ value: item }) => {
                if (!item) return;

                item.inputId = this.getItemInputId(item);
            },
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

        this.on('insert.items_$', 'insert.items_$');
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

    uncheck() {
        const checkeditem = this.getCheckedItem();

        if (checkeditem) {
            checkeditem.checked = false;

            this.dispatchEvent('change', checkeditem.name, false);
        }
    }

    onChange(evt) {
        const { items } = this.getInput();
        const { checked, id } = evt.target;

        if (!this.isMultiCheckable()) {
            this.uncheck();
        }

        const [item] = items.filter(({ inputId }) => inputId == id);
        item.checked = checked;

        this.dispatchEvent('change', item.name, checked);
    }

    hasValue() {
        return !!this.getCheckedItem();
    }
}

module.exports = MultiOptionFormElement;