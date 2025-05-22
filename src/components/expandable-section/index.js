
class ExpandableSection extends components.LightningComponent {

    initializers() {
        return {
            ['collapsible']: () => true,
            ['expanded']: () => true,
        };
    }

    toggleExpanded() {
        const input = this.getInput();

        if (input) {
            input.expanded = !input.expanded;
        } else {
            const node = this.getNode();

            const btn = this.getNode('.slds-section__title button');
            const contentDiv = node.querySelector('.slds-section__content');

            const currentValue = contentDiv.getAttribute('aria-hidden') == 'false';

            this.toggleCssClass(!currentValue, 'slds-is-open');

            if (btn) {
                btn.setAttribute('aria-expanded', !currentValue);
            }
            
            contentDiv.setAttribute('aria-hidden', currentValue);
        }
    }
}

module.exports = ExpandableSection;