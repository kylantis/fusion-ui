
class Button extends components.LightningComponent {

    events() {
        return ['click'];
    }

    synchronizeStateButtonSizes() {
       
    }

    hooks() {
        return {
            ['states.$_.title']: (evt) => {
                const { newValue: title, parentObject: { ['@key']: state } } = evt;
                
                setTimeout(() => {
                    // When this hooks is called, the DOM would not have been updated, hence
                    // we want to wait a little
                    this.synchronizeStateButtonSizes();
                }, 500);
            },
        }
    }

    /**
     * This function checks if the solid state of this
     */
    #willChangeSolidState(property, value) {
        const { isSolid0 } = Icon;

        const input = { ...this.getInput() };
        input[property] = value;

        const { type, textDefault, solid } = input;

        return this.isSolid() !== isSolid0({ type, textDefault, solid });
    }

    beforeMount() {
        const input = this.getInput();
        const { stateful, type } = input;
        if (stateful) {
            if (type != 'neutral') {
                throw Error(
                    'Stateful buttons are only used with the neutral variation'
                );
            }
        }
    }

    onMount() {
        this.node.querySelector(':scope > button').addEventListener("click", () => {
            this.dispatchEvent('click');;
        });
    }

    toStateCssClass(state) {
        switch (state) {
            case 'selected-clicked':
                return 'selected';
            case 'selected':
                return 'selected-focus';
            default:
                throw Error(`Unknown state: ${state}`);
        }
    }
}
module.exports = Button;