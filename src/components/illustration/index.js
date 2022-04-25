
class Illustration extends components.LightningComponent {

    beforeMount() {
        this.#setDefaults();
    }

    #setDefaults() {
        const input = this.getInput();
        if (!input.size) {
            input.size = "small";
        }
    }

}
module.exports = Illustration;
