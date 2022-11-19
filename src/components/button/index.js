
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

    selectStateTransform(selectStateClass) {
        const input = this.getInput();
        const availableStates = Object.keys(input.states);
        const classPrefix = 'slds-is-';

        if (selectStateClass.startsWith(classPrefix)) {
            const selectState = selectStateClass.replace(classPrefix, '');

            switch(true) {
                case !availableStates.includes('selected'):
                    return 'slds-not-selected';
                case !availableStates.includes('selected_focus') && selectState == 'selected':
                    return `${classPrefix}selected-click`;
            }
        }

        return selectStateClass;
    }

    toStateCssClass(state) {
        return state.replace('_', '-');
    }
}
module.exports = Button;