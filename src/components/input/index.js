
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

    initializers() {
        return {
            ['editable']: true,
            ['inlineEdit']: true,
            ['type']: 'text',
        }
    }

    afterMount() {
        this.on('insert.value', 'insert.value');
    }
    
    getInputElement() {
        return this.getNode().querySelector('input');
    }

    getValue() {
        return this.getInput().value || null;
    }

    events() {
        return ['click', 'enter'];
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

        this.dispatchEvent('change', value);
    }

    onKeyDown(evt) {
        if (evt.key == 'Enter') {
            this.dispatchEvent('enter');
        }
    }

    getWidgetElementId() {
        return `${this.getId()}-widget`
    }

    prettifyTransform(value) {
        return value || '';
    }
}

module.exports = Input;