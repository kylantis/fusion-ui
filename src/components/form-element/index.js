/*
 *  Fusion UI
 *  Copyright (C) 2025 Kylantis, Inc
 *  
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *  
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *  
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
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

        this.getInput().dependsOnRef;
    }

    initializers() {
        return {
            ['name']: () => this.randomString()
        };
    }

    eventHandlers() {
        return {
            ['insert.dependsOnRef']: ({ value: dependsOnRef, parentObject }) => {
                if (!dependsOnRef) return;

                const componentByRef = BaseComponent.getComponentByRef(dependsOnRef)

                if (componentByRef) {
                    if (!(componentByRef instanceof FormElement)) {
                        this.logger.error(null, 'Unknown component: ', componentByRef);
                    } else {
                        parentObject.dependsOn = componentByRef;
                    }
                }
            },
        }
    }

    beforeRender() {
        this.on('insert.dependsOnRef', 'insert.dependsOnRef');
    }

    onMount() {
        const input = this.getInput();
        let { dependsOn } = input;

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

    behaviours() {
        return ['setError', 'setMessage'];
    }

    events() {
        return ['change', 'activate'];
    }

    setError(error) {
        const input = this.getInput();
        input.error = error;
    }

    setMessage(message) {
        const input = this.getInput();
        input.message = message;
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