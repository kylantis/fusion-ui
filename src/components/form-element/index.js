
class FormElement extends components.LightningComponent {

    initCompile() {
        components.Tooltip;

        this.getInput().disabled;
        this.getInput().readonly;
        this.getInput().error;
        this.getInput().layoutType;

        this.getInput().editable;
        this.getInput().inEditMode;
    }

    static isAbstract() {
        return true;
    }

    isLoadable() {
        return this.getComponentName() != FormElement.name;
    }

    isCompound() {
        const { layoutType } = this.getInput();
        return layoutType == 'compound';
    }

    hooks() {
        return {
            ['beforeMount.helperText']: async (evt) => {
                const { newValue: helperText, parentObject: obj } = evt;
                if (helperText) {
                    if (!obj.titleIcon) {
                        await this.setHelperTooltip(helperText);
                    }
                } else if (this.helperTooltip) {
                    this.helperTooltip.destroy();
                    delete this.helperTooltip;
                }
            },
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

    behaviours() {
        return ['refreshTooltip'];
    }

    async refreshTooltip() {
        if (this.helperTooltip) {
            await this.helperTooltip.refresh();
        }
    }

    async setHelperTooltip(helperText) {

        if (this.isHeadlessContext()) {
            return;
        }

        if (!this.helperTooltip) {

            const { rtl } = this.getGlobalVariables();

            const btn = `#${this.getElementId()} button.slds-button_icon`;
            const hoverTarget = document.querySelector(btn);

            if (!hoverTarget) {
                return;
            }

            const svg = `${btn} svg`;

            this.helperTooltip = new components.Tooltip({
                input: {

                    targetElement: svg,
                    parts: [{
                        text: helperText,
                    }],
                },
            });

            // We don't want our tooltip to block the user's view of the checkbox
            this.helperTooltip.supportedPositions = [
                "top",
                "bottom",
                ...rtl ? ["left", "right"] : ["right", "left"],
            ]

            await this.helperTooltip.load();

            this.helperTooltip.setPosition();


            let isMouseHover = false;

            hoverTarget.addEventListener('mouseenter', () => {
                isMouseHover = true;
                setTimeout(() => {
                    if (isMouseHover) {
                        this.helperTooltip.show();
                    }
                }, 200);
            });

            hoverTarget.addEventListener('mouseleave', () => {
                isMouseHover = false;
                this.helperTooltip.hide();
            });

        } else {
            this.helperTooltip.getInput().parts = [{
                text: helperText,
            }];
        }
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

    toggleReadOnlyClass(readonly) {
        this.toggleFormElementCssClass(readonly, 'slds-form-element_readonly');
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
        }


        // TODO: PERFOFM NECESSART TRANSFORMSTIONS
    }

    async onMount() {
        const { helperText, icon, readonly, error, editable, inEditMode } = this.getInput();

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

        // Todo: setHelperTooltip(...) contains logic that should be integrated into the tooltip
        // component, this needs to be done

        if (helperText && !icon) {
            await this.setHelperTooltip(helperText);
        }
    }
}

module.exports = FormElement;