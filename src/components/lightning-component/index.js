class LightningComponent extends BaseComponent {

    initCompile() {
    }

    jsDependencies() {
        return [
            ...super.jsDependencies(),
            // Todo: Add extra js files to be used across all lightning components
        ];
    }

    onMount() {
    }

    event() {
        return [];
    }

    behaviours() {
        return [
            'setTooltip', 'showTooltip', 'hideTooltip', 'refreshTooltip', 'removeTooltip',
            'resetTooltipHover', 'showTooltipOnHover',
        ];
    }

    async setTooltip(title) {
        if (this.isHeadlessContext() || !title) {
            return;
        }

        if (this.tooltip) {

            this.tooltip.getInput().parts = [{
                text: title,
            }];

        } else {

            const target = this.getTooltipTarget();

            if (!target) {
                return;
            }

            this.tooltip = new components.Tooltip({
                input: {
                    targetElement: target,
                    parts: [{
                        text: title,
                    }],
                },
            });

            this.tooltip.supportedPositions = this.getTooltipPositions();

            await this.tooltip.load();

            this.tooltip.setPosition();
        }
    }

    getTooltip() {
        return this.tooltip;
    }

    showTooltip() {
        if (this.tooltip) {
            this.tooltip.showPopover();
        }
    }

    hideTooltip() {
        if (this.tooltip) {
            this.tooltip.closePopover();
        }
    }

    async refreshTooltip() {
        if (this.tooltip) {
            await this.tooltip.refresh();
        }
    }

    removeTooltip() {
        if (this.tooltip) {
            this.tooltip.destroy();
            delete this.tooltip;
        }
    }

    resetTooltipHover() {

        if (!this.tooltipHoverInfo) {
            return;
        }

        const { targetNode, onMouseEnter, onMouseLeave } = this.tooltipHoverInfo;

        targetNode.removeEventListener('mouseenter', onMouseEnter);
        targetNode.removeEventListener('mouseleave', onMouseLeave);

        delete this.tooltipHoverInfo;
    }

    showTooltipOnHover() {

        const target = this.getTooltipHoverTarget();

        if (!target || this.tooltipHoverInfo) {
            return;
        }

        const targetNode = document.querySelector(target);
        let isMouseHover = false;

        const onMouseEnter = () => {
            isMouseHover = true;
            setTimeout(() => {
                if (isMouseHover) {
                    this.showTooltip();
                }
            }, 200);
        };

        const onMouseLeave = () => {
            isMouseHover = false;
            this.hideTooltip();
        }

        targetNode.addEventListener('mouseenter', onMouseEnter);
        targetNode.addEventListener('mouseleave', onMouseLeave);

        this.tooltipHoverInfo = { targetNode, onMouseEnter, onMouseLeave };
    }

    getTooltipPositions() {
        return ["top", "bottom", "right", "left"];
    }

    getTooltipTarget() {
        return this.isMounted() ? `#${this.getElementId()}` : null;
    }

    getTooltipHoverTarget() {
        return this.getTooltipTarget();
    }

    cssDependencies() {
        return [
            '/assets/styles/salesforce-lightning-design-system.min.css',
            ... this.isMobile() ? ['/assets/styles/salesforce-lightning-design-system_touch.min.css'] : [],
            '/assets/styles/base.min.css',
            ...super.cssDependencies(),
        ];
    }

    static isAbstract() {
        return true;
    }

    getLoader() {
        return `
            <div style='position: absolute; display: table; width: 100%; height: 100%;'>
              <div style='vertical-align: middle; display: table-cell;'>
                <img width='20px' src='/assets/images/loader.gif' style='display: block; margin-left: auto; margin-right: auto;'>
              </div>
            </div>
        `;
    }

    isMobile() {
        return navigator.userAgent.match(/Android/i)
            || navigator.userAgent.match(/webOS/i)
            || navigator.userAgent.match(/iPhone/i)
            || navigator.userAgent.match(/iPad/i)
            || navigator.userAgent.match(/iPod/i)
            || navigator.userAgent.match(/BlackBerry/i)
            || navigator.userAgent.match(/Windows Phone/i)
    }

    hasInputProperty(component, propertyName) {
        assert(component instanceof BaseComponent);
        assert(typeof propertyName == 'string');

        return component.getInput()[propertyName] != undefined;
    }

}

module.exports = LightningComponent;