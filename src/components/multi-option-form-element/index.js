
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

                item.inputId = this.generateItemInputId(item);
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

    initializers() {
        return {
            ['items_$.name']: () => this.randomString()
        };
    }

    isCompound() {
        const { items } = this.getInput();
        return items.length > 1;
    }

    isMultiCheckable() {
        const { type } = this.getInput();
        return type == 'checkbox';
    }

    generateItemInputName() {
        const { random } = this.getGlobalVariables();
        return `${this.getId()}-${this.isMultiCheckable() ? this.randomString() : random}`;
    }

    generateItemInputId(item) {
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

            this.dispatchEvent('unselect', checkeditem.name);
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

        this.dispatchEvent(checked ? 'select' : 'unselect', item.name);

        if (checked) {
            this.dispatchEvent('change', item.name);
        }
    }

    getValue() {
        return this.isMultiCheckable() ?
            this.getCheckedItems().map(({ name }) => name).join(',') :
            (this.getCheckedItem() || { name: null }).name;
    }
}

module.exports = MultiOptionFormElement;