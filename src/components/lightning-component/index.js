class LightningComponent extends BaseComponent {

    initCompile() {
        this.getInput().cssStyle;
        this.getInput().cssClass;
    }

    behaviours() {
        return [
            'setTooltipText', 'showTooltip', 'hideTooltip', 'refreshTooltip', 'removeTooltip',
            'resetTooltipHover', 'showTooltipOnHover', 'show', 'hide', 'toggleCssClass',
        ];
    }

    getNode() {
        const n = super.getNode0();
        return n.children.length ? n.querySelector(':scope > :nth-child(1)') : n;
    }

    toggleCssClass(predicate, className) {
        const node = this.getNode();

        if (!node) {
            return;
        }
        const { classList } = node;
        if (predicate) {
            classList.add(className);
        } else {
            classList.remove(className);
        }
    }

    show() {
        this.toggleCssClass(false, 'slds-hidden');
        this.toggleCssClass(true, 'slds-visible');
    }

    hide() {
        this.toggleCssClass(false, 'slds-visible');
        this.toggleCssClass(true, 'slds-hidden');
    }

    async setTooltipText(title) {
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

    events() {
        return ['bodyClick'];
    }

    behaviours() {
        return [
            'dispatchBodyClickEventForAll', 'setHtmlAttribute', 'removeHtmlAttribute',
        ];
    }

    setHtmlAttribute(name, value) {
        const node = this.getNode();
        if (!node) {
            return;
        }
        node.setAttribute(name, value);
    }

    removeHtmlAttribute(name) {
        const node = this.getNode();
        if (!node) {
            return;
        }
        node.removeAttribute(name);
    }

    dispatchBodyClickEventForAll() {
        const { dispatchBodyClickEventForAll } = LightningComponent;
        return dispatchBodyClickEventForAll();
    }

    static dispatchBodyClickEventForAll() {
        const { getAllComponents } = BaseComponent;
        Object.values(getAllComponents())
            .forEach(i => i.dispatchEvent('bodyClick'));
    }

    getOverlayAttribute() {
        const { getOverlayAttribute } = LightningComponent;
        return getOverlayAttribute();
    }

    static getOverlayAttribute() {
        return 'overlay';
    }

    static {
        document.body.addEventListener('click', ({ target }) => {

            const k = this.getOverlayAttribute();

            const selector = `[${k}='true'], [${k}='true'] *:not([${k}='false'] *)`;

            if (target.matches(selector)) {
                return;
            }

            this.dispatchBodyClickEventForAll();
        });
    }
}

module.exports = LightningComponent;