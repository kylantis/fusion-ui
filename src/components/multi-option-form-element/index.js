
class MultiOptionFormElement extends components.FormElement {

    static isAbstract() {
        return true;
    }

    beforeCompile() {
        this.getInput().cssClass;
        this.getInput().items[0].name;
    }

    beforeRender() {
        const input = this.getInput();
        const { items } = input;

        // If no options were provided, isLoadable() should have returned false, and this should not have executed
        assert(items.length);

        if (!this.isCompound()) {

            // This is needed because {{> render_standalone}} does not access "items_$.required", rather it only
            // uses "required"
            const [item] = items;
            if (!input.required && item.required) {
                input.required = true;
            }
        }

        // input.readonly = true;
    }

    isLoadable() {
        const { type, items } = this.getInput();

        if (!type) {
            this.logger.warn(`[${this.getId()}] A type needs to be specified`);
            return false;
        }

        if (!items.length) {
            this.logger.warn(`[${this.getId()}] At least one option needs to be provided`);
            return false;
        }

        return super.isLoadable();
    }

    onMount() {
        const { required } = this.getInput();
        if (required) {
            this.toggleRequiredClass(true);
        }
    }

    hooks() {
        return {
            ['items_$']: async (evt) => {
                const { newValue, oldValue } = evt;
                if (newValue === undefined) {
                    const inputId = this.getItemInputId(oldValue);
                    delete this.getItems()[inputId];
                }
            },
            ['afterMount.required']: (evt) => {
                const { newValue: required } = evt;
                this.toggleRequiredClass(required);
            }
        }
    }

    toggleRequiredClass(required) {
        if (this.isCompound()) {
            this.toggleFormElementCssClass(required, 'slds-is-required');
        }
    }

    isCompound() {
        const { items } = this.getInput();
        return super.isCompound() || items.length > 1;
    }

    getItems() {
        return this.items || (this.items = {});
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

    registerCompoundItem({ blockData }) {
        const { index } = blockData['items'];
        const { items } = this.getInput();

        const item = items[index];
        this.registerItem(item);
    }

    getCheckedItems() {
        return Object.values(this.getItems()).filter(({ checked: c }) => c);
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