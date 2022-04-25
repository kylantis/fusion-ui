
class Icon extends components.LightningComponent {

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
        return name.replaceAll('_', '-');
    }
}
module.exports = Icon;