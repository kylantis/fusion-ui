
class DataTable extends components.LightningComponent {

    getDefaaultValues() {
        return {
            bordered: true,
            rowsSelectable: true,
            resizableColumns: true,
        }
    }

    hooks() {
        return {
            ['beforeMount.rows.$_.actions']: (evt) => {
                const { newValue: actions, parentObject: { ["@key"]: identifier } } = evt;

                const contextMenu = (this.contextMenus || {})[identifier];

                if (actions) {
                    if (contextMenu) {
                        contextMenu.onMenuChange(actions)
                    } else {
                        this.addContextMenu(identifier, actions);
                    }
                } else {
                    assert(!!contextMenu);

                    contextMenu.destroy();
                    delete this.contextMenus[identifier];
                }
            },
            ['beforeMount.rows.$_']: (evt) => {
                const { getKeyFromIndexSegment, getParentFromPath, getMapKeyPrefix } = this;
                const { path, newValue, oldValue } = evt;

                if (!newValue && oldValue.actions) {

                    const key = getKeyFromIndexSegment(
                        path.replace(
                            getParentFromPath(path.split('.')),
                            ''
                        )
                    );

                    const identifier = key.replace(getMapKeyPrefix(), '');

                    const contextMenu = this.contextMenus[identifier];
                    assert(contextMenu);

                    contextMenu.destroy();

                    delete this.contextMenus[identifier];
                }
            },
        }
    }

    behaviours() {
        return [
            'sortAscending', 'sortDescending', 'selectAllRows', 'selectRow'
        ];
    }

    async addContextMenu(identifier, actions) {
        const contextMenus = this.contextMenus || (this.contextMenus = {});

        const contextMenu = new components.ContextMenu({
            input: {
                menu: actions,
                clickType: 'left',
                useTargetPosition: true,
                hideOnItemClick: true,
            }
        });

        await contextMenu.load();

        contextMenu.addNode(
            this.getActionsTriggerButton(identifier).getButton()
        );

        contextMenus[identifier] = contextMenu;
    }

    async rowHook({ node, blockData, initial }) {

        console.info(node.outerHTML);

        const identifier = node.querySelector(':scope > tr').getAttribute('identifier');
        const { rows } = this.getInput();

        const row = rows[identifier];

        if (row.actions) {
            await this.addContextMenu(identifier, row.actions);
        }
    }

    getActionsTriggerButton(identifier) {
        return this.getInlineComponent(`${identifier}-actions-trigger-button`);
    }

    getColumnResizeHandle(index) {
        return this.node ? this.node.querySelector(`${this.getId()}-resize-handle-${index}`) : null;
    }

    isURL(val) {

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