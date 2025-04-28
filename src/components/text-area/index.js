
class TextArea extends components.FormElement {

    loadStandaloneControl() {
        this.getTextAreaElement()
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
            },
            ['insert.disabled']: ({ value: disabled, parentObject }) => {
                parentObject.editable = !disabled;
            }
        }
    }

    beforeRender() {
        this.on('insert.disabled', 'insert.disabled');
    }
    
    afterMount() {
        this.on('insert.value', 'insert.value');
    }
    
    getTextAreaElement() {
        return this.getNode().querySelector('textarea');
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

    prettifyTransform(value) {
        return value || '';
    }
}

module.exports = TextArea;