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

class Spinner extends components.LightningComponent {

    initializers() {
        return {
            ['color']: 'brand',
            ['size']: 'medium',
        };
    }

    getNode() {
        const node = this.getNode0();

        return node.querySelector('.slds-spinner_container') ||
            node.querySelector('.slds-spinner');
    }

    canDisplay() {
        return getComputedStyle(this.getNode()).display != 'none';
    }

    setCssDisplay(display = 'initial') {
        this.getNode().style.display = display;
    }

    sizeTransform(size) {
        if (size && ['x-large', 'xx-large'].includes(size)) {
            size = 'large';
        }
        return size;
    }
}
module.exports = Spinner;