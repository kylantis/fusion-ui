
class Form extends components.LightningComponent {

    beforeCompile() {
        this.getInput().layoutType;
        this.getInput().editing;

        // string
    }

    initializers() {
        return {
            ['editing']: true,
            ['layoutType']: 'horizontal',
            ['elements']: () => [],
            ['elements_$']: () => [],
        };
    }

    eventHandlers() {
        return {
            ['insert.layoutType']: ({ value: layoutType }) => {
                this.#getElements()
                    .forEach(element => {
                        const input = element.getInput();
                        if (!input.layoutType) {
                            input.layoutType = layoutType;
                        }
                    });
            },
            ['insert.editing']: ({ value: editing }) => {
                this.#getElements()
                    .forEach(element => {
                        const input = element.getInput();
                        input.editing = editing;
                    });
            },
        }
    }

    #getElements() {
        const { elements } = this.getInput();
        const ret = [];

        elements.forEach(row => {
            row
                .filter(e => e)
                .forEach(e => ret.push(e));
        });

        return ret;
    }

    beforeRender() {
        this.on('insert.layoutType', 'insert.layoutType');
        this.on('insert.editing', 'insert.editing');
    }

    behaviours() {
        return ['submit'];
    }

    events() {
        return ['submit'];
    }

    submit() {
        var formValues = {};

        this.#getElements().forEach(e => {
            var { name } = e.getInput();
            formValues[name] = e.getValue();
        });

        this.dispatchEvent('submit', formValues);
    }
}
module.exports = Form;