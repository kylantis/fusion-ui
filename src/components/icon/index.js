class Icon extends AbstractComponent {

    init() {
        this.getInput().helperText;
        this.getInput().helperTextVisibility;
    }

    toIconClassName(name) {
        return name.replaceAll('_', '-');
    }

    getNodeSelector() {
        const { role } = this.getInput();
        return `#${this.getId()} ${role == 'button' ? role : 'span'}`;
    }

    async loadHelperText() {
        const { helperText } = this.getInput();
        if (!helperText) {
            return;
        }

        const tooltip = new components.Tooltip({
            input: {
                parts: [{ text: helperText }],
                targetElement: `#${this.getId()} .slds-icon_container`,
            }
        });

        await tooltip.load();

        tooltip.show();

        global.abc = tooltip;
    }

    async onMount() {
        await this.loadHelperText();
    }

}
module.exports = Icon;