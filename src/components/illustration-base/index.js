
class IllustrationBase extends components.LightningComponent {

    initCompile() {
        this.getInput().name;
    }

    onMount() {
        const { name } = this.getInput();

        if (!name) {
            return;
        }

        const decorator = this.getDecorator(`${name}_svg`);
        this.renderDecorator(decorator, this.getNode());
    }
}
module.exports = IllustrationBase;
