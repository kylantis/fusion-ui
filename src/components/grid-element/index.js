
class GridElement extends components.LightningComponent {

    beforeCompile() {
        this.getInput().size[0];
        this.getInput().order[0];
    }

    eventHandlers() {
        return {
            ['insert.bump']: ({ value, initial }) => {
                const grid = this.getGrid();

                if (grid) {
                    if (value && !initial) {
                        this.dispatchEvent('bump');
                    }
                } else if (value) {
                    this.getInput().bump = null;
                }
            }
        }
    }

    beforeRender() {
        this.on('insert.bump', 'insert.bump');
    }

    events() {
        return ['bump'];
    }

    getGrid() {
        const parent = this.getInlineParent();
        return (parent && (parent instanceof components.Grid)) ? parent : null;
    }

    setCol(col) {
        this.getInput().col = col;
    }

    concatTranform(arr) {
        return arr ? arr.filter(a => a).map(a => `slds-${a}`).join(' ') : arr;
    }
}

module.exports = GridElement;