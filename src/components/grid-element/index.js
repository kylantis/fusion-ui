
class GridElement extends components.LightningComponent {

    initCompile() {
        this.getInput().size[0];
        this.getInput().order[0];
    }

    concatTranform(arr) {
        return arr.filter(a => a).map(a => `slds-${a}`).join(' ');
    }

    beforeMount() {
        const { bump } = this.getInput();

        this.setCol(!!this.getGrid());
        this.toggleBump(bump, true);
    }

    hooks() {
        return {
            ['beforeMount.bump']: ({ newValue }) => {
                this.toggleBump(newValue);
            }
        }
    }

    toggleBump(bump, initial) {
        const grid = this.getGrid();
        const input = this.getInput();

        if (grid) {

            if (!initial) {
                const { columns = [] } = grid.getInput();

                const col = !(bump || grid.hasBump());

                columns.forEach(gridElement => {
                    gridElement.setCol(col);
                });
            } else {
                // See Grid.onMount()
            }

        } else {

            // Note: hooks need to be suspended and resumed later to avoid a stackoverflow exception
            // (if this component is mounted) because the assignment below will cause toggleBump(...) 
            // to be called again via the 'beforeMount.bump' hook
            this.suspendHooks();

            input.bump = null;
            this.resumeHooks();
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