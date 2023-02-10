
class GenericPopover extends components.Popover {

    beforeMount() {
        const input = this.getInput();
        input.closeIcon = true;
    }

    onMount() {
        const { feedbackState } = this.getInput();

        if (feedbackState) {
            this.addFeedbackState(feedbackState);
        }
    }

    hooks() {
        return {
            feedbackState: ({ oldValue, newValue }) => {
                if (oldValue) {
                    this.removeFeedbackState(oldValue);
                }
                if (newValue) {
                    this.addFeedbackState(newValue);
                }
            }
        }
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