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

class Avatar extends components.LightningComponent {

    eventHandlers() {
        return {
            ['insert.size']: ({ value: size, parentObject }) => {
                if (size == 'large' && this.isMobile()) {
                    parentObject.size = 'medium';
                }
            }
        }
    }

    beforeRender() {
        // Note: This can be removed if you don't want it
        this.on('insert.size', 'insert.size');
    }

    initializers() {
        return {
            ['initials.name']: '',
        };
    }

    truncateInitials(name) {
        if (name.length > 2) {
            return name.slice(0, 2)
        }
        return name;
    }

}
module.exports = Avatar;