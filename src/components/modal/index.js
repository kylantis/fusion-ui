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

class Modal extends components.LightningComponent {

    beforeCompile() {
        this.getInput().showByDefault;
    }

    static isAbstract() {
        return true;
    }

    events() {
        return ['modalClose', 'modalOpen'];
    }

    afterMount() {
        const { showByDefault } = this.getInput();

        if (showByDefault) {
            this.showModal();
        }
    }

    behaviours() {
        return ['showModal', 'closeModal'];
    }

    // Note: Subclasses should override showModal() and closeModal() if this implementation
    // does not play nicely with their markup
    
    showModal() {
        this.node.querySelector(':scope > section').classList.add('slds-fade-in-open');
        this.node.querySelector(':scope > .slds-backdrop').classList.add('slds-backdrop_open');

        this.dispatchEvent('modalOpen');
    }

    closeModal() {
        this.node.querySelector(':scope > section').classList.remove('slds-fade-in-open');
        this.node.querySelector(':scope > .slds-backdrop').classList.remove('slds-backdrop_open');

        this.dispatchEvent('modalClose');
    }

}
module.exports = Modal;