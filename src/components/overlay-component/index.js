
class OverlayComponent extends components.LightningComponent {

    static #overlayConfig = {};
    #container;

    beforeCompile() {
    }

    static isAbstract() {
        return true;
    }

    static getOverlayConfig() {
        return OverlayComponent.#overlayConfig;
    }

    async onMount() {
        const { getOverlayConfig } = OverlayComponent;

        if (this.useContainer()) {
            const { container } = getOverlayConfig();

            if (container) {
                this.setContainer(container);
            }
        }
    }

    static getContainerOverlays(containerNode) {
        return containerNode.__overlays || (containerNode.__overlays = []);
    }

    setContainer(container) {
        const { getContainerOverlays } = OverlayComponent;

        if (this.#container) return;

        assert(!this.isMounted());

        this.#container = container;

        const overlays = getContainerOverlays(this.getContainer());

        this.on('onMount', () => {
            overlays.push(this);
        });

        this.on('destroy', new EventHandler(
            () => {
                const idx = overlays.indexOf(this);
                assert(idx >= 0);

                overlays.splice(idx, 1);
            },
            this,
            { overlays }
        ));
    }

    getPadding() {
        return 0;
    }

    isPointerBased() {
        return false;
    }

    async getRequiredArea() {
        throw Error(`[${this.getId()}] Please provide an override for getRequiredArea()`);
    }

    async getRenderingArea() {
        throw Error(`[${this.getId()}] Please provide an override for getRenderingArea()`);
    }

    getScore(containerRect, position) {

        const { horizontal, vertical } = this.getRequiredArea(position);

        const { top, left } = this.getCssPosition(containerRect, position, { horizontal, vertical });

        const right = document.body.scrollWidth - (left + horizontal);
        const bottom = document.body.scrollHeight - (top + vertical);

        switch (position) {
            case 'top':
                return top + (left < right ? left : right);
            case 'top-left':
                return top + left;
            case 'top-right':
                return top + right;
            case 'bottom':
                return bottom + (left < right ? left : right);
            case 'bottom-left':
                return bottom + left;
            case 'bottom-right':
                return bottom + right;
            case 'left':
                return left + (top < bottom ? top : bottom);
            case 'right':
                return right + (top < bottom ? top : bottom);
        }
    }

    getAnyPosition(containerRect) {
        let score = Number.MIN_SAFE_INTEGER;
        let position;

        for (const p of this.getSupportedPositions()) {
            const s = this.getScore(containerRect, p);
            if (s > score) {
                score = s;
                position = p;
            }
        }

        return position;
    }

    getCssPosition(containerRect, position, area) {

        const { top, left, width, height } = containerRect;
        const { horizontal, vertical } = area;

        switch (position) {
            case 'top':
                return {
                    left: horizontal < width ? left + (Math.floor(width / 2) - Math.floor(horizontal / 2)) :
                        left - Math.floor(horizontal / 2) + Math.floor(width / 2),
                    top: top - vertical,
                };
            case 'top-left':
                return {
                    left: left - horizontal,
                    top: top - vertical,
                };
            case 'top-right':
                return {
                    left,
                    top: top - vertical,
                };
            case 'bottom':
                return {
                    left: horizontal < width ? left + (Math.floor(width / 2) - Math.floor(horizontal / 2)) :
                        left - Math.floor(horizontal / 2) + Math.floor(width / 2),
                    top: top + height + this.getPadding(),
                };
            case 'bottom-left':
                return {
                    left: left - horizontal,
                    top,
                };
            case 'bottom-right':
                return {
                    left,
                    top,
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
                    left: left + width + this.getPadding(),
                };
        }
    }

    getPosition(containerRect, avaiablePositions = this.getSupportedPositions(), allowNull) {
        const { isPositionAvailable } = OverlayComponent;

        if (this.isPointerBased()) {
            for (const p of [...avaiablePositions]) {
                const inView = this.isVisibleInViewPort(containerRect, p, this.getRequiredArea(p));

                if (!inView) {
                    avaiablePositions.splice(avaiablePositions.indexOf(p), 1);
                }
            }
        }

        let position = (() => {
            for (const p of avaiablePositions) {
                if (isPositionAvailable(containerRect, p, this.getRequiredArea(p))) {
                    return p;
                }
            }
        })();

        if (!position) {
            if (allowNull) {
                return null;
            }
            position = this.getAnyPosition(containerRect);
        }

        const cssStyles = this.getCssPosition(
            containerRect,
            position,
            this.getRenderingArea(position),
        );

        cssStyles.position = 'absolute';
        cssStyles.transform = `translate(0)`;

        return {
            position,
            fn: () => {
                const node = this.getOverlayNode();

                const container = this.getContainer();
                const { style } = node;

                for (let name in cssStyles) {
                    style[name] = cssStyles[name];
                }

                if (container) {
                    node.__scrolled = false;
                }
            },
        };
    }

    getOverlayNode() {
        this.throwError(`getOverlayNode() must be overriden in the subclass`);
    }

    useContainer() {
        return false;
    }

    isVisible() {
        return false;
    }

    static containerScrollListener({ currentTarget }) {
        const { getContainerOverlays } = OverlayComponent;
        const { scrollTop, scrollHeight } = currentTarget;

        const overlayElements = getContainerOverlays(currentTarget)
            .filter(overlay => overlay.isVisible())
            .map(overlay => overlay.getOverlayNode());

        overlayElements.forEach(overlayElement => {
            const { top } = overlayElement.style;
            const _top = Number(top.replace('px', ''));

            if (!overlayElement.__scrolled) {
                overlayElement.style.top = `${_top + scrollTop}px`;
            }

            const offset = ((scrollHeight - scrollTop) - scrollHeight) + 0;

            const translateY = offset;

            overlayElement.style.transform = `translateX(0px) translateY(${translateY}px)`
            overlayElement.__scrolled = true;
        });
    }

    getContainer() {
        return this.#container ? document.querySelector(this.#container) : null;
    }

    getContainerOffset() {
        const container = this.getContainer();
        return container ?
            this.getBoundingClientRectOffset(container) :
            {};
    }

    isVisibleInViewPort(rect, position, area) {

        // We are focused on the vertical view port because scrolling
        // almost always happen vertical only

        return this.isVisibleInVerticalViewPort(rect, position, area);
    }

    isVisibleInVerticalViewPort(rect, position, area) {

        const { top, bottom } = rect;
        const { vertical } = area;

        const verticalTopScrollHeight = window.innerHeight + window.scrollY;
        const verticalBottomScrollHeight = (window.innerHeight + (document.body.scrollHeight - (Math.floor(window.scrollY) + window.innerHeight)));

        const bodyRect = document.body.getBoundingClientRect();
        const containerOffset = this.getContainerOffset();

        // The reason we have this is because in some cases. there may be some space between 
        // the body and the absolute end of the screen
        const bodyDistanceToBottom = document.body.scrollHeight - bodyRect.height;

        let hasSpaceRelativeToTopScroll;
        let hasSpaceRelativeToBottomScroll;

        if (position.startsWith('top')) {
            hasSpaceRelativeToTopScroll = top - (vertical + (containerOffset.top || 0)) >= 0;
            hasSpaceRelativeToBottomScroll = (bottom + vertical + bodyDistanceToBottom) <= verticalBottomScrollHeight;
        } else {
            hasSpaceRelativeToTopScroll = (top + vertical) <= verticalTopScrollHeight;
            hasSpaceRelativeToBottomScroll = ((bottom - vertical) + bodyDistanceToBottom) >= 0;
        }

        return hasSpaceRelativeToTopScroll && hasSpaceRelativeToBottomScroll;
    }

    static isPositionAvailable(rect, position, area) {
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
                    if (hasVeticalSpace === undefined) {
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

                case 'top-left':
                case 'top-right':
                    hasVeticalSpace = top > vertical;

                case 'bottom-left':
                case 'bottom-right':
                    if (hasVeticalSpace === undefined) {
                        hasVeticalSpace = (bottom > vertical);
                    }
                    hasHorizontalSpace = (position.endsWith('left') ? left : right) > horizontal;
                    break;

                case 'left':
                    hasHorizontalSpace = left > horizontal;
                case 'right':
                    if (hasHorizontalSpace === undefined) {
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

        const { horizontal, vertical } = area;
        return fn({ position, horizontal, vertical });
    }

    getBoundingClientRectOffset(container) {
        return this.getBoundingClientRectOffset0(
            container.getBoundingClientRect()
        );
    }

    getBoundingClientRectOffset0(rect) {
        const bodyRect = document.body.getBoundingClientRect();
        return {
            top: rect.top - bodyRect.top,
            left: rect.left - bodyRect.left,
            bottom: bodyRect.bottom - rect.bottom,
            right: bodyRect.right - rect.right,
            width: rect.width,
            height: rect.height,
            x: rect.x,
            y: rect.y,
        };
    }
}

module.exports = OverlayComponent;