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

// Todo: Update this component - it is outdated and uses a deprecated approach
class Accordion extends components.LightningComponent {

    beforeCompile() {
        this.getInput().expandSingle;
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
     * @param {HTMLElement} node 
     */
    addClickListener({ node }) {

        const li = node.querySelector(':scope > li');

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

                    if (this.getInput().expandSingle && this.active.length) {
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