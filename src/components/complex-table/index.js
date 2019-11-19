
class ComplexTable extends BaseComponent {
    tagName() {
        return 'complexTable';
    }

    componentId = this.getId();

    getBehaviourNames() {
        return [
            'appendRow', 'deleteRow', 'editRow',
        ];
    }

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/table.min.css', '/assets/css/input.min.css']);
    }

    getTableBody() {
        return this.node.querySelector('tbody');
    }

    getTableId() {
        return this.node.querySelector('table').getAttribute('id');
    }

    static getCellId(event) {
        return event.target.id;
    }

    static getRow(event) {
        return event.target.parentNode;
    }

    getLastChildId() {
        return this.node.querySelector('tbody').lastChild.getAttribute('id');
    }

    getComponentId() {
        return this.componentId;
    }

    invokeBehavior(behaviorName, data) {
        let lastChildId;
        if (this.getLastChildId().includes('table')) {
            lastChildId = parseInt(this.getLastChildId().split('-')[3], 10) + 1;
        } else {
            lastChildId = parseInt(this.getLastChildId(), 10) + 1;
        }
        const element = document.getElementById(data.id); // get html element from the data
        const newContent = data.content; // Data from json
        const id = this.getTableId(); // get id from table component

        switch (behaviorName) {
        case 'appendRow':

            for (let i = 0; i < data.length; i += 1) {
                if (data[i]['@tag'] === 'row') {
                    const updatedBody = this.getTableBody().insertRow(-1);
                    if (!data[i]['@id']) {
                        updatedBody.id = `${id}-row-${lastChildId + i}`;
                    } else {
                        updatedBody.id = data[i]['@id'];
                    }
                    // check if row tag
                    const columns = data[i]['>'];
                    let j = 0;
                    for (const k in columns) {
                        if (Object.prototype.hasOwnProperty.call(columns, k)) {
                            const tableCell = updatedBody.insertCell(-1);
                            tableCell.id = `${updatedBody.id}-${j += 1}`;
                            tableCell.innerHTML = columns[k];
                        }
                    }
                    $(updatedBody).click((e) => {
                        this.invokeBehavior('', e.target.parentNode);
                    });
                }
            }
            break;

        case 'deleteRow':
            // Currently, element returns a html element but it should be a javascript object
            if (element) {
                element.parentNode.removeChild(element);
            }
            break;

        case 'editRow':
            element.innerHTML = newContent;
            break;

        default:

            break;
        }
    }

    appendRow(data) {
        this.invokeBehavior('appendRow', data);
    }

    deleteRow(data) {
        this.invokeBehavior('deleteRow', data);
    }

    editRow(data) {
        this.invokeBehavior('editRow', data);
    }

    render() {
        // Add listeners that respond to user event, then this should buuble up to this.callback();
        const { node } = this;
        const jsonData = this.data;
        // Save the column titles to the column object in the constructor
        const columnTitles = {};

        const tableId = [];

        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const tbody = document.createElement('tbody');
        table.className = 'ui selectable fixed compact';
        table.id = this.getComponentId();
        // set Color
        if (jsonData['@color'].length > 0) {
            table.classList.add(jsonData['@color']);
        }
        if (jsonData['@isInverted']) {
            table.classList.add('inverted');
        }
        table.classList.add('table');

        table.append(thead);
        table.append(tbody);
        // Create header row
        const trHead = thead.insertRow(-1);
        trHead.className = 'center aligned';
        const columns = this.data['>'][0]['>'];
        for (let i = 0; i < columns.length; i += 1) {
            columnTitles[i.toString()] = columns[i]['@title'];
        }
        let columnId = 0;
        for (const value of Object.keys(columnTitles)) {
            const th = document.createElement('th');
            th.textContent = columnTitles[value];
            th.id = `${table.id}-title-${columnId += 1}`;
            if (value === '0') {
                th.className = 'one wide';
            }
            trHead.appendChild(th);
        }

        if (jsonData['>'].length > 0) {
            let rowId = 0;
            for (let i = 1; i < this.data['>'].length; i++) {
                const rowData = this.data['>'][i];
                if (rowData['@tag'] === 'row') {
                    const trBody = tbody.insertRow(-1);
                    if (!rowData['@id']) {
                        trBody.id = `${table.id}-row-${rowId += 1}`;
                    } else {
                        trBody.id = rowData['@id'];
                    }
                    trBody.className = 'center aligned';
                    const innerRowData = rowData['>'];
                    for (let j = 0; j < innerRowData.length; j++) {
                        let componentData;
                        let componentTag;
                        for (const [key, value] of Object.entries(rowData['>'][j])) {
                            if (key === '@value') {
                                if (value !== undefined && value.length > 0) {
                                    const tableCell = trBody.insertCell(-1);
                                    tableCell.id = `${table.id}-${trBody.id}-${j + 1}`;
                                    tableCell.innerHTML = value;
                                }
                            }
                            if (key === '@component-data') {
                                componentData = value;
                            }
                            if (key === '@component-tag') {
                                componentTag = value;
                            }
                            if (componentData !== undefined && componentTag !== undefined && componentData !== '' && componentTag !== '') {
                                const tableCell = trBody.insertCell(-1);
                                tableCell.id = `${table.id}-${trBody.id}-${j + 1}`;
                                BaseComponent.getComponent(componentTag, componentData, tableCell);
                            }
                        }
                    }
                    // Add click callback, e.t.c
                    $(trBody).click((e) => {
                        this.invokeBehavior('', e.target.parentNode);
                    });
                    $(trBody).dblclick((e) => {
                        const editData = { id: e.target.id, content: 'new content added' };
                        this.editRow(editData);
                    });
                }
            }
        }

        tableId.push(`#${table.getAttribute('id')}`);

        node.appendChild(table);
    }
}
module.exports = ComplexTable;
