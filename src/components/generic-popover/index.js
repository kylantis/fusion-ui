
class GenericPopover extends components.Popover {

    beforeRender() {
        const input = this.getInput();
        input.closeIcon = true;

        this.on('insert.feedbackState', ({ value: feedbackState, afterMount }) => {
            if (!feedbackState) return;

            afterMount(() => {
                this.addFeedbackState(feedbackState);
            });
        });

        this.on('remove.feedbackState', ({ value: feedbackState }) => {
            if (!feedbackState) return;

            this.removeFeedbackState(feedbackState);
        });
    }

    behaviours() {
        return ['addFeedbackState', 'removeFeedbackState'];
    }

    addFeedbackState(feedbackState) {
        const closeIcon = this.getCloseIcon();

        if (closeIcon && feedbackState == 'error') {
            closeIcon.getInput().type = 'inverse';
        }

        this.togglePopoverCssClass(true, `slds-popover_${feedbackState}`);
    }

    removeFeedbackState(feedbackState) {
        const closeIcon = this.getCloseIcon();

        if (closeIcon) {
            closeIcon.getInput().type = null;
        }

        this.togglePopoverCssClass(false, `slds-popover_${feedbackState}`);
    }

    getPopoverNode() {
        return this.node.querySelector(':scope .slds-popover');
    }

    togglePopoverCssClass(predicate, className) {
        const { classList } = this.getPopoverNode();

        if (predicate) {
            classList.add(className);
        } else {
            classList.remove(className);
        }
    }
}

module.exports = GenericPopover;