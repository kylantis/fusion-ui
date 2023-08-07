
class DataTable extends components.LightningComponent {

    beforeRender() {
        this.setHasActions();
    }

    setHasActions() {
        const input = this.getInput();
        const { rows } = input;

        if (
            Object.values(rows)
                .filter(row => row)
                .filter(({ actions }) => actions).length
        ) {
            input.hasActions = true;
        }
    }

    renameTagVisitor({ content }) {
        const rgx = /^tag-/g;
        if (content.name.match(rgx)) {
            content.name = content.name.replace(rgx, '');
        }
    }

    renameTagsTransform(node) {
        // Note: <node> can be a node or a node array, this way we have the flexibility of using it as either an outer
        // transform or an inner transform
        (Array.isArray(node) ? node : [node])
            .forEach(n => {
                this.visitHtmlAst({
                    ast: n, tagVisitor: this.renameTagVisitor
                })
            })
    }

    thInnerTransform(nodes) {
        nodes
            .filter(({ nodeType }) => nodeType == 'tag')
            .forEach(node => {
                if (!node.content.children) {

                    // This cell is null, add an empty cell element as it's child. This is needed for moveWrapperToFirstChild(...)
                    node.content.children = [
                        this.createEmptyCellElement('th')
                    ];

                } else if (this.isComponentRendered()) {
                    this.renameTagsTransform(node);
                }
            });
    }

    tdInnerTransform(nodes) {
        nodes
            .filter(({ nodeType }) => nodeType == 'tag')
            .forEach(node => {
                if (!node.content.children) {

                    // This cell is null, add an empty cell element as it's child. This is needed for moveWrapperToFirstChild(...)
                    node.content.children = [
                        this.createEmptyCellElement()
                    ];

                } else if (this.isComponentRendered()) {
                    this.renameTagsTransform(node);
                }
            });
    }

    rowInnerTransform(nodes) {
        nodes
            .filter(({ nodeType }) => nodeType == 'tag')
            .forEach(node => {
                if (!node.content.children) {

                    // This row is null, add an empty row element as it's child. This is needed for moveWrapperToFirstChild(...)
                    node.content.children = [
                        this.createEmptyRowElement()
                    ];

                } else if (this.isComponentRendered()) {
                    this.renameTagsTransform(node);
                }
            });
    }

    createEmptyCellElement(tagName = 'td') {
        return this.createTag(
            tagName,
            [{
                nodeType: 'text',
                content: {
                    value: {
                        type: 'token:text',
                        content: '&nbsp;',
                    }
                }
            }],
            [{
                key: {
                    type: 'token:attribute-key',
                    content: this.getEmptyNodeAttributeKey(),
                }
            }]
        );
    }

    createEmptyRowElement() {
        const { columns, rowsSelectable, hasActions } = this.getInput();

        // This is an array used to determine the number of blank columns we will generate
        const columnList = Object.keys(columns);

        if (rowsSelectable) {
            columnList.push('');
        }

        if (hasActions) {
            columnList.push('');
        }

        return this.createTag(
            'tr',
            columnList.map(() => this.createEmptyCellElement()),
            [{
                key: {
                    type: 'token:attribute-key',
                    content: this.getEmptyNodeAttributeKey(),
                }
            }]
        );
    }

    createTag(nodeName, children = [], attributes = []) {
        return {
            nodeType: 'tag',
            content: {
                openStart: {
                    type: 'token:open-tag-start',
                    content: `<${nodeName}`,
                },
                name: nodeName,
                attributes,
                openEnd: {
                    type: 'token:open-tag-end',
                    content: '>',
                },
                selfClosing: false,
                children,
                close: {
                    type: 'token:close-tag',
                    content: `</${nodeName}>`,
                }
            }
        }
    };

    hasRequiredCells(row) {
        const { columns } = this.getInput();
        return row.cells && (row.cells.length == columns.size);
    }

    getDefaultValues() {
        return {
            bordered: true,
            rowsSelectable: true,
            resizableColumns: true,
        }
    }

    hooks() {
        return {
            ['afterMount.rows.$_.actions']: (evt) => {
                const { newValue: actions, parentObject: { ["@key"]: identifier } } = evt;

                const input = this.getInput();
                const contextMenu = (this.contextMenus || {})[identifier];

                if (actions) {
                    if (contextMenu) {
                        contextMenu.onMenuChange(actions)
                    } else {
                        this.addContextMenu(identifier, actions);
                    }

                    if (!input.hasActions) {
                        input.hasActions = true;
                    }

                } else {
                    assert(!!contextMenu);

                    contextMenu.destroy();
                    delete this.contextMenus[identifier];

                    this.setHasActions();
                }
            },
            ['afterMount.rows.$_']: (evt) => {
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

    events() {


        // Create a header and footer area, for multi-select button set



        return [
            'multiSelectStart', 'multiSelectEnd'
        ];
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
            }
        });

        await contextMenu.load();

        contextMenu.addNode(
            this.getActionsTriggerButton(identifier).getButton()
        );

        contextMenus[identifier] = contextMenu;
    }

    async rowHook({ node }) {

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