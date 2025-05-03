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

class Prompt extends components.Modal {

    beforeRender() {
        const input = this.getInput();

        input.tabIndex = 0;
        input.cssClass = 'slds-modal_prompt';

        // Lightning hides the closeIcon in the Prompt component, hence we alaways need to 
        // exclude the markup because it's not needed
        input.closeIcon = false;
    }

    initializers() {
        return {
            ['type']: 'shade'
        }
    }

}
module.exports = Prompt;