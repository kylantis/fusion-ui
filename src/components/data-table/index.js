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

class DataTable extends components.LightningComponent {

    #rowIds = [];

    eventHandlers() {
        return {
            ['insert.rows_$.actions']: ({ value: actions, parentObject, afterMount }) => {
                if (!actions) return;

                const { id: rowId } = parentObject;

                this.#setHasActions0(true);

                afterMount(() => {
                    this.#addContextMenu(rowId, actions);
                });
            },
            ['remove.rows_$.actions']: ({ value, afterMount }) => {
                if (!value) return;

                const { id: rowId } = parentObject;

                this.setHasActions();

                afterMount(() => {
                    this.#removeContextMenu(rowId);
                });
            },
            ['remove.rows_$']: ({ value: row }) => {
                // We have an initializer for "rows_$", so we know it will never be null
                assert(row);

                const { id } = row;

                const index = this.#rowIds.indexOf(id);
                assert(index >= 0);

                this.#rowIds.splice(index, 1);
            }
        }
    }

    beforeRender() {
        this.on('insert.rows_$.actions', 'insert.rows_$.actions');
        this.on('remove.rows_$.actions', 'remove.rows_$.actions');
        this.on('remove.rows_$', 'remove.rows_$');
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
            ['rows_$.id']: () => this.randomString(),
            ['rows_$.cells_$']: () => ({ value: { text: '' } }),
        }
    }

    transformers() {
        return {
            ['rows_$.id']: (id) => {
                if (!id || this.#rowIds.includes(id)) {
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

        const { container } = components.OverlayComponent.getOverlayConfig() || {};

        if (container) {
            contextMenu.setContainer(container);
        }
        
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