
class IllustrationBase extends components.LightningComponent {

    beforeCompile() {
        this.getInput().name;
    }

    async onMount() {
        const { name } = this.getInput();

        if (!name) return;

        this.renderDecorator(`${name}_svg`, this.getNode());
    }
}
module.exports = IllustrationBase;
