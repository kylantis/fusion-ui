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

class TextCompanion extends components.LightningComponent {
    static isAbstract() {
        return true;
    }

    static getMarginSizesInRem() {
        return {
            ['xx-small']: .25,
            ['x-small']: .5,
            ['small']: .75,
            ['medium']: 1,
            ['large']: 1.5,
            ['x-large']: 2,
            ['xx-large']: 3,
        }
    }
}

module.exports = TextCompanion;