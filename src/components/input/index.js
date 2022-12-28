
class Input extends components.FormElement {

    beforeMount() {
        const input = this.getInput();

        // input.readonly = true;

        this.setControlCssClass();
    }

    hooks() {
        return {
            ['onMount.leftIcon']: () => {
                this.setControlCssClass();
            },
            ['onMount.rightIcon']: () => {
                this.setControlCssClass();
            },
            ['onMount.clearButton']: () => {
                this.setControlCssClass();
            },
            ['onMount.readonly']: () => {
                this.setControlCssClass();
            },
        }
    };

    setControlCssClass() {
        const input = this.getInput();
        let { leftIcon, rightIcon, clearButton, readonly } = input;

        rightIcon = rightIcon || clearButton;

        let controlCssClass = null;

        if ((!readonly) && (leftIcon || rightIcon)) {
            controlCssClass = 'slds-input-has-icon';

            if (leftIcon && rightIcon) {
                controlCssClass += ' slds-input-has-icon_left-right';
            } else {
                controlCssClass += ` slds-input-has-icon_${leftIcon ? 'left' : 'right'}`;
            }
        }

        input.controlCssClass = controlCssClass;
    }

    isCompound() {
        return false;
    }

    getInputNode() {
        return this.node.querySelector('input');
    }

    clearInput() {
        // Todo: After data-binding has been fully implemented, we just need to update <this.getInput().value>
        // but for now, do the below:

        this.getInput().value = null;
        this.getInputNode().value = null;
    }

    onChange(evt) {
        const { value } = evt.target;
        this.dispatchEvent('change', value);

        this.getInput().value =  value;
    }
}

module.exports = Input;