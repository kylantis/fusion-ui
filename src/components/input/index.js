
class Input extends components.FormElement {

    loadStandaloneControl() {
        this.getInputElement()
            .addEventListener('click', () => {
                this.dispatchEvent('click');
            });
    }

    hooks() {
        return {
            ['afterMount.value']: (evt) => {
                const { newValue: value } = evt;
                this.dispatchEvent('change', value);
            }
        };
    }

    getInputElement() {
        return this.getNode().querySelector('input');
    }

    events() {
        return ['click'];
    }

    isCompound() {
        return false;
    }

    clearInput() {
        this.getInput().value = null;
    }

    onChange(evt) {
        const { value } = evt.target;
        this.getInput().value = value;
    }

    getWidgetElementId() {
        return `${this.getId()}-widget`
    }
}

module.exports = Input;