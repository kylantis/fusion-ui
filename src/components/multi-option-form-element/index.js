
class MultiOptionFormElement extends components.FormElement {

    static isAbstract() {
        return true;
    }

    initCompile() {
        this.getInput().cssClass;
        this.getInput().items[0].name;
    }

    beforeMount() {
        this.#setDefaults();
    }

    isLoadable() {
        const { type, items } = this.getInput();

        if (this.getComponentName() == MultiOptionFormElement.name) {
            return false;
        }

        if (!type) {
            this.logger.warn(`[${this.getId()}] A type needs to be specified`);
            return false;
        }
        if (!items.length) {
            this.logger.warn(`[${this.getId()}] At least one option needs to be provided`);
            return false;
        }

        return true;
    }

    #setDefaults() {
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
    }

    onMount() {
        const { type, required } = this.getInput();
        if (required) {
            this.toggleRequiredClass(true);
        }

        if (this.isCompound()) {

            // We need to place the <input> element immediately before <label> (as a direct sibling)
            this.getFormElementNode()
                .querySelectorAll(`.slds-${type}`)
                .forEach(node => {
                    const input = node.querySelector('input');
                    const label = node.querySelector(`.slds-${type}__label`);

                    input.parentNode.remove();
                    label.parentNode.insertBefore(input, label);                    
                });
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
            ['onMount.required']: (evt) => {
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
        return true;
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

    itemHook({ blockData }) {
        const { index } = blockData['items'];
        const { items } = this.getInput();

        const item = items[index];
        this.registerItem(item);
    }

    getCheckedItem() {
        return Object.values(this.getItems()).filter(({ checked: c }) => c)[0];
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
        }
    }

    onChange(evt) {
        const { checked, id } = evt.target;

        if (!this.isMultiCheckable()) {
            assert(checked);
            this.uncheck();
        }

        this.getItems()[id].checked = checked;
    }
}

module.exports = MultiOptionFormElement;