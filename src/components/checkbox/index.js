
class Checkbox extends components.LightningComponent {

    async itemTransform({ node, blockData }) {

        const { htmlWrapperCssClassname: mstW } = RootCtxRenderer

        const { index, length } = blockData['items'];
        const { required } = this.getInput().items[index];

        if (required) {
            this.hasRequiredItem = true;
        }

        if (index == length - 1 && this.hasRequiredItem) {
            // Add a small left margin to non-required items, so that
            // they are on the same plane as their required counterparts
            this.getInput().items
                .forEach((item, i) => {
                    if (item.required) { return; }

                    const marginLeft = this.isMobile() ? '0.967em' : '1em';

                    this.node
                        .querySelector(`:scope .slds-form-element__control > .${mstW} > .${mstW}:nth-child(${i + 1}) .${mstW} label .slds-checkbox_faux`)
                        .style.marginLeft = marginLeft;
                })
        }
    }

    onMount(node) {
        this.node = node;
    }

    getUsers() {
        return {
            item: { label: "hello" }
        };
    }
}
module.exports = Checkbox;