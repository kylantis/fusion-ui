
class BaseComboBox extends components.FormElement {

    #canLazyLoad = true;

    beforeCompile() {
        this.getInput().placeholderText;
    }

    initializers() {
        return {
            ['placeholderText']: () => 'Select Option',
        };
    }

    eventHandlers() {
        return {
            ['insert.displayOnHover']: ({ value }) => {
                if (value) {
                    this.#canLazyLoad = false;
                }
            },
            ['insert.options']: ({ value, afterMount }) => {
                afterMount(() => {
                    this.setupOptions(value);
                })
            },
            ['insert.multiSelect']: ({ value, initial }) => {
                if (initial) return;

                if (value) {
                    this.setupSelectedOptions();

                } else {

                    const input = this.getInput();
                    const { options } = input;

                    Object.values(options.getItems())
                        .forEach(item => {
                            item.selected = false;
                        })

                    input.selectedOptions = null;
                    this.updateValue();
                }
            }
        }
    }

    beforeRender() {
        this.on('insert.displayOnHover', 'insert.displayOnHover');
        this.on('insert.options', 'insert.options');
        this.on('insert.multiSelect', 'insert.multiSelect');
    }

    onMount() {

        this.getInputNode()
            .addEventListener("click", () => {
                const { displayOnHover } = this.getInput();

                if (!displayOnHover) {
                    this.toggleOptions();
                }
            });

        BaseComponent.on('bodyClick', () => {
            const { displayOnHover } = this.getInput();

            if (!displayOnHover && this.isExpanded()) {
                this.toggleOptions();
            }
        });

        this.addCssClassListener(
            this.getDropdownTrigger(), 'slds-is-open', true, () => {
                if (this.#canLazyLoad) {
                    this.dispatchEvent('loadOptions');
                }
            }
        );
    }

    events() {
        return ['loadOptions'];
    }

    behaviours() {
        return ['selectValueFromOptions', 'unselectValueFromOptions'];
    }

    selectedOptionPredicate({ identifier }) {
        return this.getSelectedIdentifiers().includes(identifier);
    }

    getSelectedOptionItemData({ identifier, icon, title }) {
        return { identifier, icon, label: title, deletable: true };
    }

    setupSelectedOptions() {
        const input = this.getInput();
        const { options } = input;

        if (!options) return;

        const items = [];

        Object.values(options.getItems())
            .forEach((item) => {
                items.push(this.getSelectedOptionItemData(item));
            });

        if (this.getSelectedOptions().length) {
            this.#showListBoxSelectionGroup();
        }

        input.selectedOptions = new components.Pill({
            input: {
                items,
                itemPredicate: 'selectedOptionPredicate',

            }
        });

        input.selectedOptions
            .on('itemRemove', new EventHandler(
                function (identifier) {
                    this.preventDefault();
                    _this.unselectValueFromOptions(identifier);
                },
                null,
                { _this: this }
            ));
    }

    setupOptions(options) {

        if (!options) return;

        const input = this.getInput();
        const { multiSelect } = input;

        if (options) {

            options.on('click', new EventHandler(
                (identifier) => {
                    const { multiSelect } = _this.getInput();

                    if (multiSelect && _this.isOptionSelected(identifier)) {
                        _this.unselectValueFromOptions(identifier);
                    } else {
                        _this.selectValueFromOptions(identifier);
                    }

                    if (_this.isExpanded()) {
                        _this.toggleOptions();
                    }
                },
                null,
                { _this: this }
            ));

            options.on('itemsUpdate', new EventHandler(
                (allItems, addedItems, removedItems) => {
                    const input = _this.getInput();

                    addedItems.forEach(item => {
                        const { selectedOptions } = input;

                        if (selectedOptions) {
                            selectedOptions.getInput().items.push(
                                _this.getSelectedOptionItemData(item)
                            )
                        }
                    });

                    removedItems.forEach(item => {
                        const { selectedOptions } = input;

                        if (selectedOptions) {
                            const { items } = selectedOptions.getInput();

                            const idx = items.findIndex(({ identifier }) => identifier == item.identifier);
                            items.splice(idx, 1);
                        }
                    });
                },
                null,
                { _this: this }
            ));

            if (multiSelect) {
                this.setupSelectedOptions();
            }

        } else if (multiSelect) {
            input.selectedOptions = null;
        }

        this.updateValue();
    }

    unselectValueFromOptions(identifier) {
        const { options, selectedOptions, multiSelect } = this.getInput();

        options.getItems()[identifier].selected = false;

        if (multiSelect) {
            if (!this.getSelectedOptions().length) {
                this.#hideListBoxSelectionGroup();
            }
            selectedOptions.refreshItem(identifier);
        }

        this.updateValue();
    }

    #showListBoxSelectionGroup() {
        this.getNode().querySelector('.slds-listbox_selection-group')
            .classList.add('visible');
    }

    #hideListBoxSelectionGroup() {
        this.getNode().querySelector('.slds-listbox_selection-group')
            .classList.remove('visible');
    }

    selectValueFromOptions(identifier) {
        const { options, selectedOptions, multiSelect } = this.getInput();

        const selectedIdentifiers = this.getSelectedIdentifiers();

        if (selectedIdentifiers.includes(identifier)) {
            // already selected
            return;
        }

        if (multiSelect && !selectedIdentifiers.length) {
            this.#showListBoxSelectionGroup();
        }

        const items = options.getItems();

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

        const selectedOptions = this.getSelectedOptions();

        const value = selectedOptions.length > 1
            ? `${selectedOptions.length} Options Selected` :
            selectedOptions[0] ? selectedOptions[0].title :
                placeholderText;


        this.toggleCssClass0(this.getInputNode(), value != placeholderText, 'slds-combobox__input-value');
        this.getInputNode().querySelector('span.value').innerHTML = value;
    }

    getSelectedIdentifiers() {
        return this.getSelectedOptions()
            .map(({ identifier }) => identifier);
    }

    getSelectedOptions() {
        const { options } = this.getInput();

        return Object.values(options.getItems())
            .filter(({ selected }) => selected);
    }

    isOptionSelected(identifier) {
        const { options } = this.getInput();
        return options.getItems()[identifier].selected;
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

    addCssClassListener(targetNode, cssClass, initial, cb) {

        const observer = new MutationObserver((mutationsList, observer) => {
            mutationsList.forEach(mutation => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class' && mutation.target.classList.contains(cssClass)) {

                    if (initial) {
                        observer.disconnect();
                    }

                    cb();
                }
            });
        });

        observer.observe(
            targetNode, {
            attributes: true, attributeOldValue: false, attributeFilter: ['class']
        });
    }
}
module.exports = BaseComboBox;