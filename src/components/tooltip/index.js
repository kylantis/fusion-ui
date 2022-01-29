
class Tooltip extends AbstractComponent {

    init() {
        this.getInput().targetElement;
        this.getInput().position;
    }

    getNode() {
        return this.node.querySelector(`:scope > .slds-popover`);
    }

    behaviours() {
        return ['show', 'hide'];
    }

    onMount(node) {
        this.node = node;
        // node.style.visibility = 'hidden';

        this.setPosition();

        // this.observeTargetElementPosition();
    }

    observeTargetElementPosition() {

        const { targetElement } = this.getInput();

        if (!targetElement) {
            return;
        }

        const container = document.querySelector(targetElement);
    }

    setPosition() {

        const {
            isPositionAvailable, getBoundingClientRectOffset,
        } = Tooltip;
        const { targetElement, position } = this.getInput();

        if (!targetElement) {
            return;
        }

        const container = document.querySelector(targetElement);
        const containerRect = getBoundingClientRectOffset(container);
        const nubbinSize = 16;

        if (!container) {
            throw Error(`[${this.getId()}] Could not find targetElement: ${targetElement}`);
        }

        const positions = (() => {
            let arr = ['top', 'right', 'bottom', 'left'];

            // If the user provided a provided a position, make it the first element
            if (position && arr[0] !== position) {
                arr.splice(arr.indexOf(position), 1)
                arr = [
                    position,
                    ...arr,
                ];
            }

            return arr;
        })();

        const tooltipPosition = (() => {
            for (const p of positions) {
                if (isPositionAvailable(containerRect, p, this.getArea(p))) {
                    return p;
                }
            }
        })();

        if (!tooltipPosition) {
            this.hide();
            this.log(`Could not find space to place tooltip: ${this.getId()}`);
            return;
        }

        // Add nubbin class
        const nubbinPosition = (() => {
            switch (tooltipPosition) {
                case 'top':
                    return 'bottom';
                case 'bottom':
                    return 'top';
                case 'left':
                    return 'right';
                case 'right':
                    return 'left';
            }
        })();

        const { classList } = this.getNode();
        const nubbinClassPrefix = 'slds-nubbin_';

        classList.forEach(className => {
            if (className.startsWith(nubbinClassPrefix)) {
                classList.remove(className);
            }
        })
        classList.add(`${nubbinClassPrefix}${nubbinPosition}`);

        // Set tooltip position
        const cssPosition = (() => {

            const { top, left, width, height } = containerRect;
            const { horizontal, vertical } = this.getArea(tooltipPosition);

            switch (tooltipPosition) {
                case 'top':
                    return {
                        left: horizontal < width ? left + (Math.floor(width / 2) - Math.floor(horizontal / 2)) :
                            left - Math.floor(horizontal / 2) + Math.floor(width / 2),
                        top: top - vertical,
                    };
                case 'bottom':
                    return {
                        left: horizontal < width ? left + (Math.floor(width / 2) - Math.floor(horizontal / 2)) :
                            left - Math.floor(horizontal / 2) + Math.floor(width / 2),
                        top: top + height + nubbinSize,
                    };
                case 'left':
                    return {
                        top: vertical < height ? top + (Math.floor(height / 2) - Math.floor(vertical / 2)) :
                            top - Math.floor(vertical / 2) + Math.floor(height / 2),
                        left: left - horizontal,
                    };
                case 'right':
                    return {
                        top: vertical < height ? top + (Math.floor(height / 2) - Math.floor(vertical / 2)) :
                            top - Math.floor(vertical / 2) + Math.floor(height / 2),
                        left: left + width + nubbinSize,
                    };
            }
        })();

        const { style } = this.getNode();

        Object.entries(cssPosition).forEach(([key, value]) => {
            style[key] = value;
        })

        style.position = 'absolute';
        // style.transform = 'translateX(0%)';
    }

    getArea(position) {
        const nubbinSize = 16;

        let { width, height } = this.getNode().getBoundingClientRect();

        // Add the size of the nubbin
        switch (position) {
            case 'top':
            case 'bottom':
                height += nubbinSize;
                break;
            case 'left':
            case 'right':
                width += nubbinSize;
                break;
        }

        return {
            horizontal: width,
            vertical: height,
        }
    }

    getShowToggleClass() {
        return "slds-rise-from-ground";
    }

    getHideToggleClass() {
        return "slds-fall-into-ground";
    }

    show() {
        const node = this.getNode()

        // if (animate) {
        node.style.visibility = 'unset';
        node.classList.remove(this.getHideToggleClass());
        node.classList.add(this.getShowToggleClass());
        // } else {
        node.style.visibility = 'visible';
        // }
    }

    hide() {
        const node = this.getNode();

        // if (animate) {
        node.classList.remove(this.getShowToggleClass());
        node.classList.add(this.getHideToggleClass());
        // } else {
        node.style.visibility = 'hidden';
        // }
    }

    static getBoundingClientRectOffset(container) {
        const bodyRect = document.body.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        return {
            top: containerRect.top - bodyRect.top,
            left: containerRect.left - bodyRect.left,
            bottom: bodyRect.bottom - containerRect.bottom,
            right: bodyRect.right - containerRect.right,
            width: containerRect.width,
            height: containerRect.height,
        };
    }

    static isPositionAvailable(rect, position, tooltipArea) {
        const {
            top, left, bottom, right, width, height
        } = rect;

        const fn = ({ position, horizontal, vertical }) => {

            let hasVeticalSpace;
            let hasHorizontalSpace;

            switch (position) {
                case 'top':
                    hasVeticalSpace = top > vertical;
                case 'bottom':
                    if (hasVeticalSpace == undefined) {
                        hasVeticalSpace = bottom > vertical;
                    }
                    hasHorizontalSpace = (() => {
                        if (horizontal < width) {
                            return true;
                        }
                        const offset = Math.ceil((horizontal - width) / 2);
                        return left > offset && right > offset;
                    })()
                    break;

                case 'left':
                    hasHorizontalSpace = left > horizontal;
                case 'right':
                    if (hasHorizontalSpace == undefined) {
                        hasHorizontalSpace = right > horizontal;
                    }
                    hasVeticalSpace = (() => {
                        if (vertical < height) {
                            return true;
                        }
                        const offset = Math.ceil((vertical - height) / 2);
                        return top > offset && bottom > offset;
                    })()
                    break;

                default:
                    throw Error(`Unknown tooltip position: ${position}`);
            }

            return hasVeticalSpace && hasHorizontalSpace;
        }

        const { horizontal, vertical } = tooltipArea;
        return fn({ position, horizontal, vertical });
    }

}
module.exports = Tooltip;