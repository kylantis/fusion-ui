
class Grid extends components.GridElement {

    eventHandlers() {
        return {
            ['insert.columns_$']: ({ value }) => {
                if (!value) return;

                value.setCol(true);

                value.on(
                    'bump', new EventHandler(() => {
                        this.removeCols();
                    }, this)
                )
            }
        }
    }

    beforeRender() {

        if (this.hasBump()) {
            this.removeCols();
        }

        this.on('insert.columns_$', 'insert.columns_$');
    }

    removeCols() {
        const { columns = [] } = this.getInput();

        columns.forEach(gridElement => {
            gridElement.setCol(false);
        });
    }

    hasBump() {
        const { columns = [] } = this.getInput();

        for (let column of columns) {
            if (column && column.bump) {
                return true;
            }
        }
        return false;
    }
}

module.exports = Grid;