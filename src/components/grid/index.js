
class Grid extends components.GridElement {

    onMount() {
        const { columns } = this.getInput();

        if (this.hasBump()) {
            columns.forEach(gridElement => {
                gridElement.setCol(false);
            });
        }
    }

    hasBump() {
        const { columns = [] } = this.getInput();
        return columns.filter(({ bump }) => bump)[0];
    }

}

module.exports = Grid;