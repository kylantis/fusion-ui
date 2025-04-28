
class ComboBox extends components.FormElement {

    beforeCompile() {
        this.getInput().placeholderText;
        this.getInput().type;
    }

    useWeakRef() {
        return false;
    }

    initializers() {
        return {
            ['placeholderText']: 'Select Option',
            ['type']: 'select',
            ['searchIconPosition']: 'left',
            ['clearInputIcon']: 'close',
        };
    }

    immutablePaths() {
        return ['type'];
    }

    isSelectable() {
        const { type } = this.getInput();
        return type.includes('select');
    }

    isAutoComplete() {
        const { type } = this.getInput();
        return type.includes('autocomplete');
    }

    #unselectAll() {

        this.getSelectedOptions()
            .forEach(item => {
                item.selected = false;
                item.focus = false;

                this.dispatchEvent('unselect', item.identifier);
            });

        this.#updateComboBoxInput();
    }

    eventHandlers() {
        return {
            ['insert.options']: ({ value, afterMount }) => {
                afterMount(() => {
                    this.#setupOptions(value);
                })
            },
            ['insert.multiSelect']: ({ value, initial }) => {
                if (initial) return;

                if (value) {
                    this.#setupSelectedOptions();

                    if (this.isAutoComplete()) {
                        this.#updateComboBoxInput();
                    }

                } else {
                    this.getInput().selectedOptions = null;
                    this.#unselectAll();
                }
            }
        }
    }

    beforeRender() {
        const { options } = this.getInput();

        if (this.isSelectable()) {

            this.on('insert.options', 'insert.options');
            this.on('insert.multiSelect', 'insert.multiSelect');

        } else if (options) {

            Object.values(options.getItems())
                .forEach(item => {
                    item.selected = false;
                });
        }
    }

    onMount() {
        BaseComponent.on('bodyClick', () => {
            this.hideOptions();
        });
    }

    events() {
        return [
            'inputClick', 'input', 'inputClear', 'select', 'unselect'
        ];
    }

    behaviours() {
        return [
            'selectValueFromOptions', 'unselectValueFromOptions', 'unselectCurrentValue',
            'showOptions', 'hideOptions', 'toggleOptions', 'setOptions', 'setLoading'
        ];
    }

    setLoading(loading) {
        this.getInput().loading = loading;
    }

    getValue() {
        const { multiSelect } = this.getInput();

        return this.isSelectable() ?
            multiSelect ? this.getSelectedIdentifiers().join(',') : this.getSelectedIdentifiers()[0] || null :
            this.#getComboBoxInput().value || null;
    }

    onInputClick() {
        const { multiSelect } = this.getInput();

        this.dispatchEvent('inputClick');

        if (this.isAutoComplete()) {

            if (this.isSelectable() && !multiSelect && this.getSelectedOptions().length) {
                // do nothing
            } else {
                this.showOptions();
            }

        } else {
            this.toggleOptions();
        }
    }

    #dispatchChangeEvent() {
        this.dispatchEvent('change', this.getValue());
    }

    onChange(evt) {
        const { value } = evt.target;

        this.dispatchEvent('input', value);
        this.#dispatchChangeEvent();
    }

    loadReadonly() {
        const { options } = this.getInput();

        if (!options) return;

        this.afterRender(() => {
            const target = this.getNode().querySelector(`#${this.getId()}-readonly`);
            options.renderDecorator('readonly', target, {});
        });

        return "";
    }

    selectedOptionPredicate({ identifier }) {
        return this.getSelectedIdentifiers().includes(identifier);
    }

    getSelectedOptionItemData({ identifier, icon, title }) {
        return { identifier, icon, label: title, deletable: true };
    }

    #setupSelectedOptions() {
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

    #setupOptions(options) {
        assert(this.isSelectable());

        if (!options) return;

        const input = this.getInput();
        const { multiSelect } = input;

        if (options) {

            options.getInput().allowMultipleStates = false;

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
                this.#setupSelectedOptions();
            } else {

                // If there is more than one option selected, unselect the others
                this.getSelectedOptions().forEach((item, i) => {
                    if (i) {
                        this.#unselectValueFromOptions(item.identifier);
                    } else {
                        item.focus = true;
                    }
                });
            }

        } else if (multiSelect) {
            input.selectedOptions = null;
        }

        this.#updateComboBoxInput();
    }

    clearAutoCompleteInput() {
        this.#getComboBoxInput().value = '';
        this.dispatchEvent('inputClear');
    }

    setInputIconPosition(pos) {
        const positions = ['right', 'left-right', 'group-right'];
        assert(positions.includes(pos));

        this.afterRender(() => {
            const classPrefix = 'slds-input-has-icon_';
            const formElement = this.getNode().querySelector('.slds-combobox__form-element');

            positions.forEach(p => {
                this.toggleCssClass0(formElement, false, `${classPrefix}${p}`);
            });

            this.toggleCssClass0(formElement, true, `${classPrefix}${pos}`);
        });

        return '';
    }

    setOptions(options) {
        const input = this.getInput();
        input.options = options;
    }

    unselectCurrentValue() {
        const selectedIdentifiers = this.getSelectedIdentifiers();

        if (selectedIdentifiers.length == 1) {
            this.unselectValueFromOptions(selectedIdentifiers[0]);
        }
    }

    unselectValueFromOptions(identifier) {
        this.#unselectValueFromOptions(identifier, true);
        this.#dispatchChangeEvent();
    }

    #unselectValueFromOptions(identifier, updateValue) {
        if (!this.isSelectable()) return;

        const { options, selectedOptions, multiSelect } = this.getInput();

        const item = options.getItems()[identifier];

        if (!item.selected) {
            // not currently selected
            return;
        }

        item.selected = false;

        if (multiSelect) {
            if (!this.getSelectedOptions().length) {
                this.#hideListBoxSelectionGroup();
            }
            selectedOptions.refreshItem(identifier);
        } else {
            item.focus = false;
        }

        this.dispatchEvent('unselect', identifier);

        if (updateValue) {
            this.#updateComboBoxInput();
        }
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
        if (!this.isSelectable()) return;

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
            this.#unselectValueFromOptions(selectedIdentifiers[0]);
        }

        const item = items[identifier];
        item.selected = true;

        if (multiSelect) {
            selectedOptions.refreshItem(identifier);
        } else {
            item.focus = true;
        }

        this.#updateComboBoxInput();

        this.dispatchEvent('select', identifier);
        this.#dispatchChangeEvent();
    }

    async #updateComboBoxInput() {

        const input = this.getInput();
        const { placeholderText, multiSelect } = input;

        assert(this.isSelectable());

        const selectedOptions = this.getSelectedOptions();

        const container = this.getNode().querySelector('.slds-combobox_container');
        const formElement = container.querySelector('.slds-combobox__form-element');

        let inputFauxElement = formElement.querySelector('.slds-input_faux');

        if (this.isAutoComplete()) {

            const renderInput = async () => {
                await this.renderDecorator('input', inputFauxElement.parentElement);

                this.toggleCssClass0(
                    container, false, 'slds-has-selection'
                );
            }

            const renderInputFaux = async () => {
                const inputElement = formElement.querySelector('.slds-input');

                await this.renderDecorator('input_faux', inputElement.parentElement);

                this.toggleCssClass0(
                    container, true, 'slds-has-selection'
                );

                inputFauxElement = formElement.querySelector('.slds-input_faux');
            }

            if (multiSelect) {
                if (inputFauxElement) {

                    // "multiSelect" was set to true, after a single selection was made, hence we
                    // need to switch from faux to input

                    await renderInput();
                }
                return;
            }

            const hasSelection = !!selectedOptions.length;

            if (hasSelection) {
                if (!inputFauxElement) {
                    await renderInputFaux();
                }
            } else {
                if (inputFauxElement) {
                    await renderInput();
                }
                return;
            }
        }

        const value = selectedOptions.length > 1
            ? `${selectedOptions.length} Options Selected` :
            selectedOptions[0] ? selectedOptions[0].title :
                placeholderText;


        this.toggleCssClass0(inputFauxElement, value != placeholderText, 'slds-combobox__input-value');
        inputFauxElement.querySelector('span.value').innerHTML = value;
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

    #getComboBoxInput() {
        return this.getNode()
            .querySelector(`.slds-combobox__input`);
    }

    toggleOptions() {
        const isExpanded = this.isExpanded();

        this.toggleCssClass0(
            this.getDropdownTrigger(), !isExpanded, 'slds-is-open'
        );

        this.#getComboBoxInput().setAttribute('aria-expanded', !isExpanded);
    }

    showOptions() {
        if (!this.isExpanded()) {
            this.toggleOptions();
        }
    }

    hideOptions() {
        if (this.isExpanded()) {
            this.toggleOptions();
        }
    }

    getDropdownTrigger() {
        return this.getNode().querySelector(`.slds-dropdown-trigger`);
    }

    isCompound() {
        return false;
    }

    getListBoxId() {
        const { options } = this.getInput();
        return options ? options.getId() : null;
    }
}
module.exports = ComboBox;