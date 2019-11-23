
class ComplexTable extends BaseComponent {
    tagName() {
        return 'complexTable';
    }

    componentId = this.getId();

    getBehaviourNames() {
        return [
            'appendRow', 'deleteRow',
        ];
    }

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/table.min.css', '/assets/css/input.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/checkbox.min.js']);
    }

    getComponentId() {
        return this.componentId;
    }

    invokeBehavior(behaviorName, data) {
        const tab = document.getElementById(`${this.getComponentId()}`);
        const tbody = tab.querySelector('tbody');
        switch (behaviorName) {
        case 'appendRow': {
            // eslint-disable-next-line max-len
            const newInfo = data.map(rowEl => this.createRows(tab, tbody, rowEl, this.incrementId()));
            return newInfo;
        }
        case 'deleteRow': {
            // Currently, element returns a html element but it should be a javascript object
            // a row has to be passed in as data for row to be deleted for now.
            const rowData = tbody.querySelector(`#${data.id}`);
            if (rowData) {
                $(rowData).remove();
            }
            return rowData;
        }
        default:
            break;
        }
        return null;
    }

    appendRow(data) {
        return this.invokeBehavior('appendRow', data);
    }

    deleteRow(data) {
        return this.invokeBehavior('deleteRow', data);
    }

    incrementId() {
        const table = document.getElementById(`${this.getComponentId()}`);
        let index;
        if (document.body.contains(table)) {
            const tbody = table.querySelector('tbody');
            const { lastChild } = tbody;
            const lastDigit = lastChild.id.split('-').pop();
            index = parseInt(lastDigit, 10);
        }
        return index;
    }

    createRows(table, tbody, rowData, rowId) {
        if (rowData['@tag'] === 'row') {
            const trBody = tbody.insertRow(-1);
            if (!rowData['@id']) {
                trBody.id = `${table.id}-row-${rowId + 1}`;
            } else {
                trBody.id = rowData['@id'];
            }
            trBody.className = 'center aligned';
            const innerRowData = rowData['>'];
            for (let j = 0; j < innerRowData.length; j += 1) {
                let componentData;
                let componentTag;
                for (const [key, value] of Object.entries(rowData['>'][j])) {
                    if (key === '@value') {
                        if (value !== undefined && value.length > 0) {
                            const tableCell = trBody.insertCell(-1);
                            tableCell.id = `${trBody.id}-${j + 1}`;
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
                        tableCell.id = `${trBody.id}-${j + 1}`;
                        BaseComponent.getComponent(componentTag, componentData, tableCell);
                    }
                }
            }
        }
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
            // let rowId = 0;
            for (let i = 1; i < jsonData['>'].length; i += 1) {
                const rowData = jsonData['>'][i];
                const rowId = i - 1;
                this.createRows(table, tbody, rowData, rowId);
            }
        }

        tableId.push(`#${table.getAttribute('id')}`);

        node.appendChild(table);
        this.isRendered(this.tagName());
    }
}
module.exports = ComplexTable;
