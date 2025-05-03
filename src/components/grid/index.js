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

class Grid extends components.GridElement {

    #hasBump;

    initializers() {
        return {
            ['columns']: () => ([]),
        };
    }

    eventHandlers() {
        return {
            ['insert.columns_$']: ({ value }) => {
                if (!value) return;

                value.setCol(true);

                if (value.getInput().bump) {
                    this.#hasBump = true;
                }

                value.on(
                    'bump', new EventHandler(bump => {
                        if (bump) {
                            _this.removeCols();
                        }

                        _this.refreshBump();
                    }, null, { _this: this })
                )
            }
        }
    }

    #hasBump0() {
        const { columns = [] } = this.getInput();

        for (let column of columns) {
            if (column && column.bump) {
                return true;
            }
        }

        return false;
    }

    refreshBump() {
        this.#hasBump = this.#hasBump0();
    }

    beforeRender() {

        if (this.#hasBump0()) {
            this.removeCols();
        }

        this.on('insert.columns_$', 'insert.columns_$');
    }

    removeCols() {
        const input = this.getInput();

        if (input) {
            const { columns = [] } = input;

            columns.forEach(gridElement => {
                gridElement.setCol(false);
            });
        } else {
            const { GridElement } = components;

            GridElement.getGridElementNodeList(this)
                .forEach(node => {
                    GridElement.toggleCol(node, false);
                })
        }
    }

    hasBump() {
        const input = getInput();
        return input ? this.#hasBump0() : this.#hasBump;
    }
}

module.exports = Grid;