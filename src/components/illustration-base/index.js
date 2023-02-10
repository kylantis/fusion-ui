
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
        this.getNode().innerHTML = this.renderDecorator(decorator);
    }

    getNode() {
        return this.node.querySelector(`:scope > .slds-illustration`);
    }
}
module.exports = IllustrationBase;
