
class OverlayComponent extends components.LightningComponent {

    initCompile() {
    }

    static isAbstract() {
        return true;
    }

    getPadding() {
        return 0;
    }

    isPointerBased() {
        return false;
    }

    getSupportedPositions() {
        return this.supportedPositions ? [...this.supportedPositions] : (this.isPointerBased() ?
            ["bottom-right", "bottom-left", "top-right", "top-left"] :
            ["top", "right", "bottom", "left"])
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

    async getCssPosition(containerRect, position, area) {

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

    async getPosition(containerRect) {

        const { isPositionAvailable, isVisibleInViewPort } = OverlayComponent;

        const avaiablePositions = this.getSupportedPositions();

        if (this.isPointerBased()) {
            for (const p of [...avaiablePositions]) {
                const inView = isVisibleInViewPort(containerRect, p, await this.getRequiredArea(p));

                if (!inView) {
                    avaiablePositions.splice(avaiablePositions.indexOf(p), 1);
                }
            }
        }

        let position = await (async () => {
            for (const p of avaiablePositions) {
                if (isPositionAvailable(containerRect, p, await this.getRequiredArea(p))) {
                    return p;
                }
            }
        })();

        if (!position) {
            position = this.getAnyPosition(containerRect);
        }

        const cssPosition = await this.getCssPosition(
            containerRect,
            position,
            await this.getRenderingArea(position)
        );

        return {
            position,
            ...cssPosition,
        };
    }

    static isVisibleInViewPort(rect, position, area) {
        const { isVisibleInVerticalViewPort } = OverlayComponent;

        // We are focused on the vertical view port because scrolling
        // almost always happen vertical only

        return isVisibleInVerticalViewPort(rect, position, area);
    }

    static isVisibleInVerticalViewPort(rect, position, area) {

        const { top, bottom } = rect;
        const { vertical } = area;

        const verticalTopScrollHeight = window.innerHeight + window.scrollY;
        const verticalBottomScrollHeight = (window.innerHeight + (document.body.scrollHeight - (Math.floor(window.scrollY) + window.innerHeight)));

        const bodyRect = document.body.getBoundingClientRect();

        // The reason we have this is because in some cases. there may be some space between 
        // the body and the absolute end of the screen
        const bodyDistanceToBottom = document.body.scrollHeight - bodyRect.height;

        let hasSpaceRelativeToTopScroll;
        let hasSpaceRelativeToBottomScroll;

        switch (position) {
            case 'top-left':
            case 'top-right':
                hasSpaceRelativeToTopScroll = top - vertical >= 0;
                hasSpaceRelativeToBottomScroll = (bottom + vertical + bodyDistanceToBottom) <= verticalBottomScrollHeight;
                break;
            case 'bottom-left':
            case 'bottom-right':
                hasSpaceRelativeToTopScroll = (top + vertical) <= verticalTopScrollHeight;
                hasSpaceRelativeToBottomScroll = ((bottom - vertical) + bodyDistanceToBottom) >= 0;
                break;
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
                    hasVeticalSpace = (top > vertical);

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

    static getBoundingClientRectOffset(container) {
        const { getBoundingClientRectOffset0 } = OverlayComponent;
        return getBoundingClientRectOffset0(
            container.getBoundingClientRect()
        );
    }

    static getBoundingClientRectOffset0(rect) {
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