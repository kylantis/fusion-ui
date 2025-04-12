
class FormElementGroup extends components.FormElement {

    initializers() {
        return {
            ['rows']: () => [],
            ['rows_$.fields']: () => [],
            ['rows_$.fields_$.columnSize']: "size_1-of-2",
        }
    }

    transformers() {
        return {
            ['editable']: () => false,
            ['readonly']: () => false,
        }
    }

    eventHandlers() {
        return {
            ['insert.rows_$.fields_$.formElement']: ({ value: formElement }) => {
                if (formElement) {
                    formElement.on('change', new EventHandler(
                        () => this.dispatchChangeEvent(),
                        this,
                    ))
                }
            },
        }
    }

    beforeRender() {
       this.on('insert.rows_$.fields_$.formElement', 'insert.rows_$.fields_$.formElement');
    }

    dispatchChangeEvent() {
        this.dispatchEvent('change', this.getValue());
    }

    getValue() {
        const { rows } = this.getInput();
        return rows
            .map(
                ({ fields }) => fields
                    .filter(({ formElement }) => formElement)
                    .map(({ formElement }) => formElement.getValue())
            )
            .join(',');
    }

    isCompound() {
        return true;
    }
}

module.exports = FormElementGroup;