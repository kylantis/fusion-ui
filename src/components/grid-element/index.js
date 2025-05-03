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

class GridElement extends components.LightningComponent {

    beforeCompile() {
        this.getInput().size[0];
        this.getInput().order[0];
    }

    eventHandlers() {
        return {
            ['insert.bump']: ({ value, initial }) => {
                if (initial) return;

                this.dispatchEvent('bump', value);
            }
        }
    }

    onMount() {
        const grid = this.getGrid();

        if (grid) {
            this.getNode().classList.add(
                GridElement.#getGridMarkerCssClass(grid)
            )
        }
    }

    transformers() {
        return {
            ['bump']: (value) => {
                const grid = this.getGrid();
                return grid ? value : null;
            }
        };
    }

    beforeRender() {
        this.on('insert.bump', 'insert.bump');
    }

    events() {
        return ['bump'];
    }

    getGrid() {
        const parent = this.getInlineParent();
        return (parent instanceof components.Grid) ? parent : null;
    }

    setCol(col) {
        const input = this.getInput();

        if (input) {
            input.col = col;
        } else {
            GridElement.toggleCol(
                this.getNode(), col
            )
        }
    }

    concatTranform(arr) {
        return arr ? arr.filter(a => a).map(a => `slds-${a}`).join(' ') : arr;
    }

    static #getGridMarkerCssClass(grid) {
        return `for-grid-${grid.getId()}`;
    }

    static getGridElementNodeList(grid) {
        return document.querySelectorAll(
            `.${GridElement.#getGridMarkerCssClass(grid)}`
        );
    }

    static toggleCol(node, col) {
        GridElement.toggleCssClass0(node, col, 'slds-col');
    }
}

module.exports = GridElement;