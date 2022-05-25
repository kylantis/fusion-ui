
class Icon extends components.TextCompanion {
  
    static SOLID_STATE_CHANGE_EVT = 'solidStateChange';

    initCompile() {
    }

    events() {
        const { SOLID_STATE_CHANGE_EVT } = Icon;
        return [SOLID_STATE_CHANGE_EVT];
    }

    hooks() {
        const { SOLID_STATE_CHANGE_EVT } = Icon;
        return {
            type: (evt) => {
                const { newValue } = evt;
                if (this.#willChangeSolidState('type', newValue)) {
                    this.dispatchEvent(SOLID_STATE_CHANGE_EVT, this);
                }
            },
            textDefault: (evt) => {
                const { newValue } = evt;
                if (this.#willChangeSolidState('textDefault', newValue)) {
                    this.dispatchEvent(SOLID_STATE_CHANGE_EVT, this);
                }
            },
            solid: (evt) => {
                const { newValue } = evt;
                if (this.#willChangeSolidState('solid', newValue)) {
                    this.dispatchEvent(SOLID_STATE_CHANGE_EVT, this);
                }
            }
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
        this.#setDefaults();
    }

    #setDefaults() {
        const input = this.getInput();
        if (!input.size) {
            input.size = "small";
        }
    }

    toIconClassName(name) {
        if (name == 'slds-icon-text-default') {
            return name;
        }

        return name.replaceAll('_', '-');
    }

    isSolid() {
        const { isSolid0 } = Icon;
        const { type, textDefault, solid } = this.getInput();
        return isSolid0({ type, textDefault, solid });
    }

    static isSolid0({ type, textDefault, solid }) {
        return type != 'utility' &&
            !textDefault &&
            (solid || solid === undefined);
    }
}
module.exports = Icon;