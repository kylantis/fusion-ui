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

class IconSvg extends components.LightningComponent {

    initializers() {
        return {
            foreground: ({ type }) => type == 'utility' ? 'text-default' : null,
            solid: true,
            size: ({ size, type }) => size === null ? null : (type == 'utility') ? 'x-small' : 'small'
        };
    }

    eagerlyInline() {
        return true;
    }
    
    toIconClassName(name) {
        if (this.getSharedEnum('iconColor')
            .includes(name.replace('slds-icon-', ''))) {
            return name;
        }
        return name.replaceAll('_', '-');
    }

    static getIconSvgSizesInRem() {
        return {
            ['xx-small']: .875,
            ['x-small']: 1,
            ['small']: 1.5,
            ['large']: 3,
        }
    }
}
module.exports = IconSvg;