
class DataTable extends components.LightningComponent {

    #rowIds = [];

    beforeCompile() {
        // compile ContextMenu first because this component depends on it
        components.ContextMenu;
    }

    beforeRender() {

        this.on('insert.rows_$.actions', ({ value: actions, parentObject, afterMount, initial }) => {
            if (!actions) return;

            const { id: rowId } = parentObject;

            this.#setHasActions0(true);

            afterMount(() => {
                this.#addContextMenu(rowId, actions);
            });
        });

        this.on('remove.rows_$.actions', ({ value, afterMount }) => {
            if (!value) return;

            const { id: rowId } = parentObject;

            this.setHasActions();

            afterMount(() => {
                this.#removeContextMenu(rowId);
            });
        });

        this.on('remove.rows_$', ({ value: row, afterMount }) => {
            // We have an initializer for "rows_$", so we know it will never be null
            assert(row);

            const { id } = row;

            const index = this.#rowIds.indexOf(id);
            assert(index >= 0);

            this.#rowIds.splice(index, 1);
        });
    }

    setHasActions() {
        const input = this.getInput();
        const { rows } = input;

        for (let row of rows) {
            if (row.actions) {
                this.#setHasActions0(true);
                return;
            }
        }

        this.#setHasActions0(false);
    }

    #setHasActions0(hasActions) {
        const input = this.getInput();

        if (input.hasActions != hasActions) {
            input.hasActions = hasActions;
        }
    }

    immutablePaths() {
        return ['rows_$.id'];
    }

    initializers() {
        return {
            ['bordered']: true,
            ['rowsSelectable']: true,
            ['resizableColumns']: true,
            ['columns.$_']: () => ({}),
            ['rows_$']: () => ({ id: this.randomString() }),
            ['rows_$.id']: () => this.randomString(),
            ['rows_$.cells_$']: () => ({ value: { text: '' } }),
        }
    }

    transformers() {
        return {
            ['rows_$.id']: (id) => {
                if (this.#rowIds.includes(id)) {
                    id = this.randomString();
                }
                this.#rowIds.push(id);
                return id;
            },
        }
    }

    events() {
        // Todo: Create a header and footer area, for multi-select button set
        return [
            'multiSelectStart', 'multiSelectEnd'
        ];
    }

    behaviours() {
        return [
            'sortAscending', 'sortDescending', 'selectAllRows', 'selectRow'
        ];
    }

    async #addContextMenu(rowId, actions) {
        if (this.isHeadlessContext()) return;

        const contextMenus = this.contextMenus || (this.contextMenus = {});

        if (contextMenus[rowId]) {
            // This method was called by the user multiple times
            this.#removeContextMenu(rowId);
        }

        const btn = this.getActionsTriggerButton(rowId).getButton();

        const contextMenu = new components.ContextMenu({
            input: {
                menu: actions,
                clickType: 'left',
                useTargetPosition: true,
                positions: ['bottom-left', 'top-left']
            }
        });

        contextMenus[rowId] = contextMenu;

        await contextMenu.load();

        contextMenu.addNode(btn);
    }

    #removeContextMenu(rowId) {
        const contextMenu = this.contextMenus[rowId];
        assert(contextMenu);

        contextMenu.destroy();

        delete this.contextMenus[rowId];
    }

    getActionsTriggerButtonRef(rowId) {
        return `actions-trigger-button-${rowId}`;
    }

    getActionsTriggerButton(rowId) {
        return this.getInlineComponent(this.getActionsTriggerButtonRef(rowId));
    }

    getColumnResizeHandle(index) {
        const { columns } = this.getInput();

        const columnName = Object.keys(columns).indexOf(index);

        if (!columnName) {
            return;
        }

        const selector = `#${this.getId()}-resize-handle-${this.replaceWhitespace(columnName)}`

        return this.getNode().querySelector(selector);
    }

    replaceWhitespace(idString) {
        return idString.replace(/\s/g, '-');
    }

    sortAscending(columnIndex) {

    }

    sortDescending(columnIndex) {

    }

    selectAllRows() {

    }

    selectRow(rowIndex) {

    }
}
module.exports = DataTable;