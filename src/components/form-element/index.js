
class FormElement extends components.LightningComponent {

    initCompile() {
        components.Tooltip;

        this.getInput().disabled;
        this.getInput().readonly;
        this.getInput().error;
        this.getInput().layoutType;

        this.getInput().editable;
        this.getInput().inEditMode;
        this.getInput().insideForm;
    }

    static isAbstract() {
        return true;
    }

    isLoadable() {
        return (this.getComponentName() == FormElement.name) ? false : super.isLoadable();;
    }

    isCompound() {
        const { layoutType } = this.getInput();
        return layoutType == 'compound';
    }

    hooks() {
        return {
            ['onMount.readonly']: (evt) => {
                const { newValue: readonly } = evt;
                this.toggleReadOnlyClass(readonly);
            },
            ['onMount.error']: (evt) => {
                const { newValue: error } = evt;
                this.toggleErrorClass(!!error);
            },
            ['onMount.editable']: (evt) => {
                const { newValue: editable } = evt;
                this.toggleEditableClass(editable);
            },
            ['onMount.inEditMode']: (evt) => {
                const { newValue: inEditMode } = evt;
                this.toggleEditModeClass(inEditMode);
            }
        }
    }

    events() {
        return ['change'];
    }

    behaviours() {
        return ['refreshTooltip'];
    }

    getTooltipTarget() {
        const { titleIcon } = this.getInput();
        return titleIcon ? titleIcon.getTooltipTarget() : super.getTooltipTarget();
    }

    getTooltipHoverTarget() {
        const { titleIcon } = this.getInput();
        return titleIcon ? titleIcon.getTooltipHoverTarget() : super.getTooltipHoverTarget();
    }

    getTooltipPositions() {
        const { rtl } = this.getGlobalVariables();
        // If we have a tooltip, we don't want it to block the user's view of the checkbox
        return [
            "top",
            "bottom",
            ...rtl ? ["left", "right"] : ["right", "left"],
        ];
    }

    getFormElementNode() {
        return this.node.querySelector(':scope .slds-form-element');
    }

    toggleFormElementCssClass(predicate, className) {
        const formElement = this.getFormElementNode();
        if (!formElement) {
            return;
        }
        const { classList } = formElement;
        if (predicate) {
            classList.add(className);
        } else {
            classList.remove(className);
        }
    }

    supportsInlineEdits() {
        return false;
    }

    formElementLabelTransform({ node }) {
        const { readonly } = this.getInput();

        if (readonly) {
            // Convert "label" tag to "span" tag
            node.content.children
                .filter(({ nodeType }) => nodeType == 'tag')
                .forEach(({ content }) => {
                    assert(content.name == 'label');
                    content.name = 'span';
                });
        }
    }

    toggleReadOnlyClass(readonly) {
        const { insideForm } = this.getInput();

        if (insideForm) {
            this.toggleFormElementCssClass(readonly, 'slds-form-element_readonly');
        }
    }

    toggleErrorClass(error) {
        this.toggleFormElementCssClass(error, 'slds-has-error');
    }

    toggleEditableClass(editable) {
        if (!this.supportsInlineEdits()) {
            return;
        }
        this.toggleFormElementCssClass(editable, 'slds-form-element_edit');
    }

    toggleEditModeClass(inEditMode) {
        const { editable } = this.getInput();

        if (!editable || !this.supportsInlineEdits()) {
            return;
        }

        const formElement = this.getFormElementNode();
        if (!formElement) {
            return;
        }

        const { classList } = formElement;

        if (inEditMode) {
            classList.remove('slds-hint-parent')
            classList.add('slds-is-editing');
        } else {
            classList.add('slds-hint-parent')
            classList.remove('slds-is-editing');

            // Todo: Add "edit" icon on the right
        }
    }

    async onMount() {
        const { readonly, error, editable, inEditMode } = this.getInput();

        if (readonly) {
            this.toggleReadOnlyClass(readonly);
        }

        if (error) {
            this.toggleErrorClass(true);
        }

        if (editable) {
            this.toggleEditableClass(true);
            this.toggleEditModeClass(inEditMode);
        }
    }
}

module.exports = FormElement;