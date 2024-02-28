
class Grid extends components.GridElement {

    beforeRender() {
        
        if (this.hasBump()) {
            this.#removeCols();
        }

        this.on('insert.columns_$', ({ value }) => {
            if (!value) return;

            value.setCol(true);
            value.on('bump', () => {
                this.#removeCols();
            });
        });
    }

    #removeCols() {
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