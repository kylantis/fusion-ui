
class BaseComboBox extends components.FormElement {

    beforeCompile() {
        this.getInput().placeholderText;
    }

    getDefaultValues() {
        return {
            ['placeholderText']: () => 'Select Option'
        };
    }

    beforeRender() {
        const { multiSelect } = this.getInput();

        if (multiSelect) {
            this.setupSelectedOptions();
        }
    }

    getSelectedOptionItemData({ identifier, icon, title }) {
        return { identifier, icon, label: title, deletable: true };
    }

    setupSelectedOptions() {
        const input = this.getInput();
        const { options } = input;

        if (!options) return;

        const items = [];

        Object.values(options.getAllItems())
            .forEach((item) => {
                items.push(this.getSelectedOptionItemData(item));
            })

        input.selectedOptions = new components.Pill({
            input: {
                items,
                itemPredicate: 'selectedOptionPredicate',

            }
        });

        input.selectedOptions
            .on('itemRemove', (identifier) => {
                this.unselectValueFromOptions(identifier);
                input.selectedOptions.getEventContext().preventDefault();
            });
    }

    selectedOptionPredicate({ identifier }) {
        return this.getAllSelectedIdentifiers().includes(identifier);
    }

    onMount() {
        const { displayOnHover, options } = this.getInput();

        if (!displayOnHover) {
            this.getInputNode()
                .addEventListener("click", () => {
                    this.toggleOptions();
                });

            this.on('bodyClick', () => {
                if (this.isExpanded()) {
                    this.toggleOptions();
                }
            });
        }

        if (options) {
            this.setupOptions();
        }

        this.updateValue();
    }

    hooks() {
        return {
            ['afterMount.options']: (evt) => {
                const { mutateObjectFromHookInfo } = BaseComponent;

                const { newValue, hookType, hookOptions } = evt;

                const { options, multiSelect, selectedOptions } = this.getInput();

                if (!hookType) {
                    // for re-assignment, i.e. input.options = ...

                    if (newValue) {
                        this.setupOptions();

                        if (multiSelect) {
                            this.setupSelectedOptions();
                        }
                    }
                } else if (multiSelect) {
                    // for array mutations i.e. input.options.splice(...), e.t.c

                    mutateObjectFromHookInfo(
                        hookType, hookOptions, 
                        options.getInput(), selectedOptions.getInput().items,
                        (item) => item == null ? null : this.getSelectedOptionItemData(item)
                    )
                }
            },
            ['beforeMount.multiSelect']: ({ newValue }) => {

                if (newValue) {
                    this.setupSelectedOptions();

                } else {

                    const { options } = this.getInput();

                    Object.values(options.getAllItems())
                        .forEach(item => {
                            item.selected = false;
                        })

                    this.updateValue();
                }
            }
        }
    };

    behaviours() {
        return ['selectValueFromOptions', 'unselectValueFromOptions'];
    }

    setupOptions() {

        const input = this.getInput();
        const { options } = input;

        options.on('click', (identifier) => {
            const { multiSelect } = input;

            if (multiSelect && this.isOptionSelected(identifier)) {
                this.unselectValueFromOptions(identifier);
            } else {
                this.selectValueFromOptions(identifier);
            }

            if (this.isExpanded()) {
                this.toggleOptions();
            }
        });
    }

    unselectValueFromOptions(identifier) {
        const { options, selectedOptions, multiSelect } = this.getInput();

        options.getAllItems()[identifier].selected = false;

        if (multiSelect) {
            selectedOptions.refreshItem(identifier);
        }

        this.updateValue();
    }

    selectValueFromOptions(identifier) {
        const { options, selectedOptions, multiSelect } = this.getInput();

        const selectedIdentifiers = this.getAllSelectedIdentifiers();

        if (selectedIdentifiers.includes(identifier)) {
            // already selected
            return;
        }

        const items = options.getAllItems();

        if (!multiSelect && selectedIdentifiers[0]) {
            // unselect previously selected
            items[selectedIdentifiers[0]].selected = false;
        }

        items[identifier].selected = true;

        if (multiSelect) {
            selectedOptions.refreshItem(identifier);
        }

        this.updateValue();
    }

    updateValue() {
        const input = this.getInput();
        const { placeholderText } = input;
        const selectedOptions = this.getAllSelectedOptions();

        const value = selectedOptions.length > 1
            ? `${selectedOptions.length} Options Selected` :
            selectedOptions[0] ? selectedOptions[0].title :
                placeholderText;


        this.toggleCssClass0(this.getInputNode(), value != placeholderText, 'slds-combobox__input-value');
        this.getInputNode().querySelector('span.value').innerHTML = value;
    }

    getAllSelectedIdentifiers() {
        return this.getAllSelectedOptions()
            .map(({ identifier }) => identifier);
    }

    getAllSelectedOptions() {
        const { options } = this.getInput();

        return Object.values(options.getAllItems())
            .filter(({ selected }) => selected);
    }

    isOptionSelected(identifier) {
        const { options } = this.getInput();
        return options.getAllItems()[identifier].selected;
    }

    isExpanded() {
        return this.getDropdownTrigger().classList.contains('slds-is-open');
    }

    toggleOptions() {

        const isExpanded = this.isExpanded();

        this.toggleCssClass0(
            this.getDropdownTrigger(), !isExpanded, 'slds-is-open'
        );

        this.getInputNode().setAttribute('aria-expanded', !isExpanded);
    }

    getDropdownTrigger() {
        return this.getNode().querySelector(`.slds-dropdown-trigger`);
    }

    getInputNode() {
        return this.getNode()
            .querySelector(`.slds-combobox__input`);
    }

    isCompound() {
        return false;
    }

    hasInputElement() {
        return false;
    }

    getListBoxId() {
        const { options } = this.getInput();
        return options ? options.getId() : null;
    }

}
module.exports = BaseComboBox;