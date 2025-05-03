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

class LinkItems extends components.LightningComponent {
    beforeCompile() {
        this.getInput().items['@mapKey'].sizes[0];
    }

    initializers() {
        return {
            ['items.$_.sizes']: () => (['size_1-of-5']),
        };
    }

    events() {
        return ['click'];
    }

    sizesTransform(sizes) {
        return sizes.map((size) => `slds-${size}`).join(' ');
    }

    onItemClick(evt) {
        const { currentTarget } = evt;
        const identifier = currentTarget.getAttribute('identifier');
        this.dispatchEvent(identifier);
    }
}
module.exports = LinkItems;