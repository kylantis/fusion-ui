
class GridElement extends components.LightningComponent {

    initCompile() {
        this.getInput().size[0];
        this.getInput().order[0];
    }

    concatTranform(arr) {
        return arr.filter(a => a).map(a => `slds-${a}`).join(' ');
    }

    beforeRender() {
        const { bump } = this.getInput();

        this.setCol(!!this.getGrid());
        this.toggleBump(bump, true);
    }

    hooks() {
        return {
            ['afterMount.bump']: ({ newValue }) => {
                this.toggleBump(newValue);
            }
        }
    }

    toggleBump(bump, initial) {
        const grid = this.getGrid();

        if (grid) {

            if (!initial) {
                const { columns = [] } = grid.getInput();

                const col = !(bump || grid.hasBump());

                columns.forEach(gridElement => {
                    gridElement.setCol(col);
                });
            } else {
                // See Grid.afterMount()
            }

        } else {
            this.set0(() => {
                this.getInput().bump = null;
            });
        }
    }

    getGrid() {
        const parent = this.getInlineParent();
        return (parent && (parent instanceof components.Grid)) ? parent : null;
    }

    setCol(col) {
        this.getInput().col = col;
    }
}

module.exports = GridElement;