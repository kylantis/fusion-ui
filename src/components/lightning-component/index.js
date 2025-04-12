class LightningComponent extends BaseComponent {

    static rootFontSize;

    static isAbstract() {
        return true;
    }

    beforeCompile() {
        this.getInput().cssStyles['@mapKey'];
        this.getInput().cssClass;
    }

    beforeRender() {
        const { rootFontSize } = LightningComponent;

        if (!rootFontSize) {
            LightningComponent.rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
        }
    }

    static getRootFontSize() {
        const { rootFontSize } = LightningComponent;
        return rootFontSize;
    }

    behaviours() {
        return [
            'setTooltipText', 'showTooltip', 'hideTooltip', 'refreshTooltip', 'removeTooltip',
            'resetTooltipHover', 'showTooltipOnHover', 'show', 'hide', 'toggleCssClass',
        ];
    }

    onMount() {
        const { cssStyles } = this.getInput();
        const node = this.getNode();

        if (node && cssStyles && cssStyles.size) {
            for (var name in cssStyles) {
                node.style[name] = cssStyles[name];
            }
        }
    }

    getNode() {
        const n = super.getNode0();
        assert(n);
        return (n.children.length == 1) ? n.querySelector(':scope > :nth-child(1)') : n;
    }

    toggleCssClass(predicate, className) {
        this.toggleCssClass0(this.getNode(), predicate, className);
    }

    toggleCssClass0(node, predicate, className) {
        LightningComponent.toggleCssClass0(node, predicate, className);
    }

    static toggleCssClass0(node, predicate, className) {
        if (!node) return;

        const { classList } = node;
        if (predicate) {
            classList.add(className);
        } else {
            classList.remove(className);
        }
    }

    #getCssRuleNameToShow() {
        return 'lightning-transition-in';
    }

    #getCssRuleNameToHide() {
        return 'lightning-transition-out';
    }

    /**
     * This method is to used by subclasses that need to inline the "visibility" styles needed
     * for the show() and hide() behaviours. To provide more context, there are cases
     * where higher specificity is needed, hence the need to inline these rules using
     * the id selector which carries the highest weight in CSS specificity
     * 
     * @param {string} targetId 
     * @returns {string}
     */
    getInlineStylesForVisibility(targetId) {
        const s = (document.querySelector(`#${targetId}`) == this.getNode())
            ? '' : ' ';

        return `
        <style>
            .${this.#getCssRuleNameToShow()}${s}#${targetId} {
                visibility: visible;
                transition: visibility 0.3s ease-in;
            }

            .${this.#getCssRuleNameToHide()}${s}#${targetId} {
                visibility: hidden;
                transition: visibility 0.3s ease-in;
            }
        </style>
        `;
    }

    show() {
        this.show0(this.getNode());
    }

    show0(node) {
        this.toggleCssClass0(node, false, this.#getCssRuleNameToHide());
        this.toggleCssClass0(node, true, this.#getCssRuleNameToShow());
    }

    hide() {
        this.hide0(this.getNode());
    }

    hide0(node) {
        this.toggleCssClass0(node, false, this.#getCssRuleNameToShow());
        this.toggleCssClass0(node, true, this.#getCssRuleNameToHide());
    }

    async setTooltipText(title) {
        if (!title) return;

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
                    nubbin: true,
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
            await this.tooltip.setPosition();
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
        if (!this.isMounted()) return null;

        const rootSelector = `#${this.getElementId()}`;
        const node = this.getNode();

        return (node && (node != this.getNode0())) ?
            `${rootSelector} ${node.tagName.toLowerCase()}` : rootSelector;
    }

    getTooltipHoverTarget() {
        return this.getTooltipTarget();
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
        return [];
    }

    behaviours() {
        return [
            'setHtmlAttribute', 'removeHtmlAttribute',
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

    getOverlayAttribute() {
        const { getOverlayAttribute } = LightningComponent;
        return getOverlayAttribute();
    }

    static getOverlayAttribute() {
        return 'overlay';
    }

    static {
        document.body.addEventListener('mousedown', ({ target }) => {

            const k = this.getOverlayAttribute();

            const selector = `[${k}='true'], [${k}='true'] *:not([${k}='false'] *)`;

            if (target.matches(selector)) {
                return;
            }

            BaseComponent.dispatchEvent('bodyClick');
        });
    }
}

module.exports = LightningComponent;