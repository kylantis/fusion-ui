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

class AppTiles extends components.LightningComponent {

    beforeCompile() {
        this.getInput().maxDescriptionLength;
        this.getInput().items['@mapKey'].sizes[0];
        this.getInput().items['@mapKey'].description;
    }

    initializers() {
        return {
            ['maxDescriptionLength']: () => 65,
            ['items.$_.sizes']: () => (['size_1-of-1', 'medium-size_1-of-3']),
            ['items.$_.description']: () => '',
        };
    }

    events() {
        return ['click'];
    }

    sizesTransform(sizes) {
        return sizes.map((size) => `slds-${size}`).join(' ');
    }

    #getMaxDescriptionLength() {
        const { maxDescriptionLength } = this.getInput();
        // TODO??:
        // If view port <= 480px, determine... because grid columns will use: 1-of-1
        // If view port >= 480px and if element width is 100%.. determine
        // else return 0;

        return maxDescriptionLength;
    }

    descriptionTransform(description) {
        const maxDescriptionLength = this.#getMaxDescriptionLength();

        if (description.length > maxDescriptionLength) {
            return description.substring(0, maxDescriptionLength) + '...';
        }
        return description;
    }

    async createDescriptionTooltip(button) {
        const identifier = button.getMetaInfo()['inlineRef'];
        const { items } = this.getInput();
        const { description } = items[identifier];

        if (description) {
            await button.setTooltipText(description);
            button.showTooltipOnHover();
        }
    }

    onItemClick(evt) {
        const { currentTarget } = evt;
        const identifier = currentTarget.getAttribute('identifier');
        this.dispatchEvent(identifier);
    }
}
module.exports = AppTiles;