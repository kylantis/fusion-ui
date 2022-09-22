
class Button extends components.LightningComponent {

    events() {
        return ['click'];
    }

    synchronizeStateButtonSizes() {
        
    }

    hooks() {
        return {
            ['onMount.states.$_.title']: () => {
                this.synchronizeStateButtonSizes();
            },
        }
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
        this.synchronizeStateButtonSizes();

        this.node.querySelector(':scope .slds-text-not-selected')
            .addEventListener("click", () => {
                this.dispatchEvent('click');
            });

        const selectedFocusBtn = this.node.querySelector(':scope .slds-text-selected-focus');

        if (selectedFocusBtn) {
            selectedFocusBtn.addEventListener("click", () => {
                this.dispatchEvent('click', 'selected-focus');
            });
        }
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