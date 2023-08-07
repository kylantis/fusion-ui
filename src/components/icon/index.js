
class Icon extends components.TextCompanion {

    static SOLID_STATE_CHANGE_EVT = 'solidStateChange';

    events() {
        const { SOLID_STATE_CHANGE_EVT } = Icon;
        return [SOLID_STATE_CHANGE_EVT];
    }

    hooks() {
        const { SOLID_STATE_CHANGE_EVT } = Icon;
        return {
            ['beforeMount.type']: (evt) => {
                const { newValue } = evt;
                if (this.#willChangeSolidState('type', newValue)) {
                    this.dispatchEvent(SOLID_STATE_CHANGE_EVT, this);
                }
            },
            ['beforeMount.foreground']: (evt) => {
                const { newValue } = evt;
                if (this.#willChangeSolidState('foreground', newValue)) {
                    this.dispatchEvent(SOLID_STATE_CHANGE_EVT, this);
                }
            },
            ['beforeMount.solid']: (evt) => {
                const { newValue } = evt;
                if (this.#willChangeSolidState('solid', newValue)) {
                    this.dispatchEvent(SOLID_STATE_CHANGE_EVT, this);
                }
            }
        }
    }
    
    getDefaultValues() {
        const { type } = this.getInput();
        return {
            foreground: type == 'utility' ? 'text-default' : null,
            solid: true,
        };
    }

    /**
     * This function checks if the solid state of this icon is changed when the provided property changes
     */
    #willChangeSolidState(property, value) {
        const { isSolid0 } = Icon;

        const input = { ...this.getInput() };
        input[property] = value;

        const { type, solid } = input;
        return this.isSolid() !== isSolid0({ type, solid });
    }

    isSolid() {
        const { isSolid0 } = Icon;
        const { type, solid } = this.getInput();
        return isSolid0({ type, solid });
    }

    static isSolid0({ type, solid }) {
        return type != 'utility' && (solid || solid == undefined);
    }

    beforeRender() {
        const input = this.getInput();
        if (!input.size) {
            input.size = "small";
        }
    }
}
module.exports = Icon;