
class Input extends components.FormElement {

    loadStandaloneControl() {
        this.getInputElement()
            .addEventListener('click', () => {
                this.dispatchEvent('click');
            });
    }

    eventHandlers() {
        return {
            ['insert.value']: ({ value, afterMount }) => {
                afterMount(() => {
                    this.dispatchEvent('change', value);
                })
            }
        }
    }

    afterMount() {
        this.on('insert.value', 'insert.value');
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

        this.executeDiscrete(() => {
            this.getInput().value = value;
        });
    }

    getWidgetElementId() {
        return `${this.getId()}-widget`
    }
}

module.exports = Input;