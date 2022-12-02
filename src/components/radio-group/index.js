
class RadioGroup extends components.LightningComponent {

    initCompile() {
        components.Tooltip;
    }

    hooks() {
        return {
            ['beforeMount.helperText']: async (evt) => {
                const { newValue: helperText, parentObject: obj } = evt;
                if (helperText) {
                    if (!obj.icon) {
                        await this.setHelperTooltip(helperText);
                    }
                } else if (this.helperTooltip) {
                    this.helperTooltip.destroy();
                    delete this.helperTooltip;
                }
            },
        }
    }

    behaviours() {
        return ['refreshTooltip'];
    }

    async refreshTooltip() {
        if (this.helperTooltip) {
            await this.helperTooltip.refresh();
        }
    }

    async setHelperTooltip(helperText) {

        if (!this.helperTooltip) {

            const { rtl } = this.getGlobalVariables();

            const btn = `#${this.getElementId()} button.slds-button_icon`;
            const svg = `${btn} svg`;

            this.helperTooltip = new components.Tooltip({
                input: {

                    targetElement: svg,
                    parts: [{
                        text: helperText,
                    }],
                },
            });

            // We don't want the tooltip to block the user's view of the checkbox
            this.helperTooltip.supportedPositions = [
                rtl ? "left" : "right",
                "top",
                "bottom",
            ]

            await this.helperTooltip.load();

            this.helperTooltip.setPosition();

            const hoverTrigger = document.querySelector(btn);
            let isMouseHover = false;

            hoverTrigger.addEventListener('mouseenter', () => {
                isMouseHover = true;
                setTimeout(() => {
                    if (isMouseHover) {
                        this.helperTooltip.show();
                    }
                }, 200);
            });

            hoverTrigger.addEventListener('mouseleave', () => {
                isMouseHover = false;
                this.helperTooltip.hide();
            });

        } else {
            this.helperTooltip.getInput().parts = [{
                text: helperText,
            }];
        }
    }

    async onMount() {
        const { helperText, icon } = this.getInput();
        if (helperText && !icon) {
            await this.setHelperTooltip(helperText);
        }
    }

    async groupItemHook({ node, blockData }) {

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

                    const marginLeft = this.isMobile() ? '0.967em' : '1.1em';

                    this.node
                        .querySelector(`:scope .slds-form-element__control > .${mstW} > .${mstW}:nth-child(${i + 1}) .${mstW} label .slds-checkbox_faux`)
                        .style.marginLeft = marginLeft;
                })
        }
    }

    beforeMount() {
        this.#setDefaults();
    }

    #setDefaults() {
        const { items } = this.getInput();
        items.forEach((item, i) => {
            // For checkbox for work properly, each item needs to have a name
            // Also, the names need to be unique for onChange(...) to work properly
            if (!item.name || items.filter(({ name }, j) => item.name == name && i != j).length) {
                item.name = clientUtils.randomString();
            }
        })
    }

    onChange(evt) {
        const { items } = this.getInput();
        const { checked, name } = evt.target;

        for (const item of items) {
            if (item.name == name) {
                item.checked = checked;
            }
        }
    }
}
module.exports = RadioGroup;