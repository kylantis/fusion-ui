
class FormElement extends components.LightningComponent {

    beforeCompile() {
        components.Tooltip;

        this.getInput().disabled;
        this.getInput().readonly;
        this.getInput().error;
        this.getInput().layoutType;

        this.getInput().editable;
        this.getInput().inlineEdit;
    }

    static isAbstract() {
        return true;
    }

    isLoadable() {
        if (this.isHeadlessContext()) {
            return true;
        }
        return (this.getComponentName() == FormElement.name) ? false : super.isLoadable();;
    }

    isCompound() {
        const { layoutType } = this.getInput();
        return layoutType == 'compound';
    }

    setupFormElement() {  
    }

    loadStandaloneControl() {
    }

    hooks() {
        return {
            ['afterMount.error']: (evt) => {
                const { newValue: error } = evt;
                this.toggleErrorClass(!!error);
            },
            ['afterMount.readonly']: (evt) => {
                const { newValue: readonly } = evt;
                this.toggleReadOnlyClass(readonly);
            },
            ['afterMount.editable']: (evt) => {
                const { newValue: editable } = evt;
                this.toggleEditableClass(editable);
            },
        }
    }

    events() {
        return ['change'];
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

    getNode() {
        return this.node.querySelector(':scope .slds-form-element');
    }

    labelTransform(nodes) {
        const { readonly } = this.getInput();

        if (readonly) {
            nodes
                .filter(({ nodeType }) => nodeType == 'tag')
                .forEach(({ content }) => {
                    // Convert "label" tag to "span" tag
                    assert(content.name == 'label');
                    content.name = 'span';
                });
        }
    }

    toggleErrorClass(error) {
        this.toggleCssClass(error, 'slds-has-error');
    }

    toggleReadOnlyClass(readonly) {
        this.toggleCssClass(readonly, 'slds-form-element_readonly');

        if (readonly) {
            this.toggleEditMode(false);
        }
    }

    toggleEditableClass(editable) {
        this.toggleCssClass(editable, 'slds-form-element_edit');
    }

    onEditButtonClick() {
        if (this.canEditInline()) {

            this.getInput().readonly = false;
            this.toggleEditMode(true);

        } else {
            alert(`Todo: Load a popover to allow the user make edit ${this.getId()}`);
        }
    }

    supportsInlineEdits() {
        return true;
    }

    canEditInline() {
        const { inlineEdit } = this.getInput();
        return this.supportsInlineEdits() && inlineEdit;
    }

    toggleEditMode(isEditing) {
        if (isEditing) {
            this.toggleCssClass(false, 'slds-hint-parent');
            this.toggleCssClass(true, 'slds-is-editing');
        } else {
            this.toggleCssClass(true, 'slds-hint-parent');
            this.toggleCssClass(false, 'slds-is-editing');
        }
    }

    onMount() {
        const { error, readonly, editable } = this.getInput();

        if (error) {
            this.toggleErrorClass(true);
        }

        if (readonly) {
            this.toggleReadOnlyClass(readonly);
        }

        if (editable) {
            this.toggleEditableClass(true);
        }
    }

    getPopupWidgetContainer() {
        return !this.isCompound() ?
            document.querySelector(`#${this.getId()}-popup-widget`) :
            null;
    }

    hasInputElement() {
        return true;
    }
}

module.exports = FormElement;