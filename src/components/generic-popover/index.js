/*
 *  Fusion UI
 *  Copyright (C) 2025 Kylantis, Inc
 *  
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *  
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *  
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

class GenericPopover extends components.Popover {

    eventHandlers() {
        return {
            ['insert.feedbackState']: ({ value: feedbackState, afterMount }) => {
                if (!feedbackState) return;
    
                afterMount(() => {
                    this.addFeedbackState(feedbackState);
                });
            },
            ['remove.feedbackState']: ({ value: feedbackState }) => {
                if (!feedbackState) return;
    
                this.removeFeedbackState(feedbackState);
            }
        }
    }

    beforeRender() {
        const input = this.getInput();
        input.closeIcon = true;

        this.on('insert.feedbackState', 'insert.feedbackState');
        this.on('remove.feedbackState', 'remove.feedbackState');
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