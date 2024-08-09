
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