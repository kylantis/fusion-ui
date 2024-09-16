
class FormElement extends components.LightningComponent {

    beforeCompile() {
        components.Tooltip;

        this.getInput().disabled;
        this.getInput().readonly;
        this.getInput().error;
        this.getInput().layoutType;

        this.getInput().editable;
        this.getInput().inlineEdit;
        this.getInput().editing;
    }

    static isAbstract() {
        return true;
    }

    useWeakRef() {
        return false;
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

    immutablePaths() {
        return ['dependsOn'];
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

    labelTransform(node) {
        const { readonly } = this.getInput();
        const { content: { children } } = node;

        if (readonly) {
            children
                .filter(({ nodeType }) => nodeType == 'tag')
                .forEach(({ content }) => {
                    // Convert "label" tag to "span" tag
                    assert(content.name == 'label');
                    content.name = 'span';
                });
        }
    }

    onEditButtonClick() {
        if (this.canEditInline()) {
            const input = this.getInput();

            input.editing = true;
            input.readonly = false;

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

    getPopupWidgetContainer() {
        return !this.isCompound() ?
            document.querySelector(`#${this.getElementId()}-popup-widget`) :
            null;
    }

    hasInputWidget() {
        return true;
    }

    hasValue() {
        return true;
    }
}

module.exports = FormElement;