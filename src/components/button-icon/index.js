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

class ButtonIcon extends components.TextCompanion {

    eagerlyInline() {
        return false;
    }

    getButton() {
        return this.node ? this.node.querySelector(':scope > button') : null;
    }

    events() {
        return ['click'];
    }

    onMount() {
        // Todo: Ensure that the attribute "aria-pressed" is set to true or false, depending on its 
        // state. This is applicable to the types: border, border-filled, border-inverse

        this.node.querySelector(':scope > button').addEventListener("click", () => {
            this.dispatchEvent('click');
        });
    }

    getTooltipTarget() {
        return this.isMounted() ? `#${this.getElementId()} svg` : null;
    }

    getTooltipHoverTarget() {
        return super.getTooltipTarget();
    }

    getIconSvg() {
        return this.getInlineComponent('iconSvg');
    }

    #getContainerTypes() {
        return ["border", "border-filled", "border-inverse"];
    }

    isIconContainer() {
        const { classList } = this.getNode();

        if (classList.contains(`slds-button_icon-container`)) {
            return true;
        }

        for (const type of this.#getContainerTypes()) {
            if (classList.contains(`slds-button_icon-${type}`)) {
                return true;
            }
        }

        return false;
    }
}

module.exports = ButtonIcon;