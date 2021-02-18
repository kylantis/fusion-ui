
class Accordion extends BaseComponent {

    /**
     * At compile-time, dynanically register extra params we want to add to the data model,
     * Then later, update config.json to indicate specify the primitive type(s)
     */
    init() {
        this.getInput().singleOnly;
    }

    /**
     * Collapse an accordion section
     * @param {HTMLElement} li 
     */
    closeItem(li) {

        if (!this.active.includes(li)) {
            // Item is already closed;
            return;
        }

        li.querySelector('.slds-accordion__section')
            .classList.remove('slds-is-open');

        li.querySelector('button.slds-accordion__summary-action')
            .setAttribute('aria-expanded', 'false');

        this.active.splice(this.active.indexOf(li), 1);
    }

    /**
     * Expand an accordion section
     * @param {HTMLElement} li 
     */
    openItem(li) {

        if (this.active.includes(li)) {
            // Item is already open
            return;
        }

        li.querySelector('.slds-accordion__section')
            .classList.add('slds-is-open');

        li.querySelector('button.slds-accordion__summary-action')
            .setAttribute('aria-expanded', 'true');

        this.active.push(li);
    }

    /**
     * Block Hook that processes new items added to this accordion
     * @param {HTMLElement} li 
     */
    addClickListener(li) {

        if (!this.active) {
            // By default, the first item is the active item
            this.active = [li];
        }

        li.querySelector('.slds-accordion__summary-action')
            .addEventListener('click', () => {

                if (this.active.includes(li)) {

                    // Close this one
                    this.closeItem(li);

                } else {

                    if (this.getInput().singleOnly && this.active.length) {
                        // Close the one that's currently active
                        this.closeItem(this.active[0]);
                    }

                    // Open this one
                    this.openItem(li);
                }
            });

        const items = this.items || (this.items = []);
        items.push(li);
    }
}
module.exports = Accordion;