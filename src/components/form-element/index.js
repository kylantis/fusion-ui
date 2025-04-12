
/**
 * Subsclasses must override: getValue(), isCompound(). And the subclass must also dispatch the 'change'
 * event - passing in a string as the eventArg that represents the new value
 */
class FormElement extends components.LightningComponent {

    beforeCompile() {
        components.Tooltip;

        this.getInput().name;
        this.getInput().disabled;
        this.getInput().readonly;
        this.getInput().error;
        this.getInput().layoutType;

        this.getInput().editable;
        this.getInput().inlineEdit;
        this.getInput().editing;
    }

    initializers() {
        return {
            ['name']: () => this.randomString()
        };
    }

    onMount() {
        const input = this.getInput();
        const { dependsOn } = input;

        if (dependsOn) {
            if (dependsOn.getValue() == null) {
                input.disabled = true;

                dependsOn.once('change', value => {
                    this.dispatchEvent('activate', value);
                    input.disabled = false;
                });
            }
        }
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
        return false;
    }

    immutablePaths() {
        return ['dependsOn'];
    }

    events() {
        return ['change', 'activate'];
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

    getValue() {
        return null;
    }
}

module.exports = FormElement;