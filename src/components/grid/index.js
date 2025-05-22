
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