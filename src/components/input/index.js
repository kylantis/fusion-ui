
class Input extends components.FormElement {

    beforeMount() {
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

    clearInput() {
        this.getInput().value = null;
    }

    onChange(evt) {
        const { value } = evt.target;
        this.dispatchEvent('change', value);

        this.getInput().value =  value;
    }
}

module.exports = Input;