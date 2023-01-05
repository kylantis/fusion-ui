
class ExpandableSection extends components.LightningComponent {

    hooks() {
        return {
            ['expanded']: ({ newValue: expanded }) => {
                const node = this.node.querySelector(':scope > .slds-section');
                if (expanded) {
                    node.classList.add('slds-is-open');
                } else {
                    node.classList.remove('slds-is-open');
                }
            },
            ['collapsible']: ({ newValue: collapsible }) => {
                if (collapsible && !this.hasClickListener) {
                    this.addClickListener();
                }
            }
        }
    }

    addClickListener() {
        const btn = this.node.querySelector(':scope > .slds-section .slds-section__title > button');
        
        if (btn) {
            btn.addEventListener('click', () => this.toggleExpanded());
            this.hasClickListener = true;
        } else {
            assert(!this.getInput().collapsible);
        }
    }

    onMount() {
           this.addClickListener();
    }

    toggleExpanded() {
        const input = this.getInput();
        input.expanded = !input.expanded;
    }

}
module.exports = ExpandableSection;