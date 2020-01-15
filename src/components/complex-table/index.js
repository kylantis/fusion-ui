
class ComplexTable extends BaseComponent {
    tagName() {
        return 'complexTable';
    }

    componentId = this.getId();

    selectedRows = new Set();

    getBehaviourNames() {
        return [
            'appendRow', 'deleteRow',
        ];
    }

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/complex-table.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies();
    }

    getComponentId() {
        return this.componentId;
    }

    invokeBehavior(behaviorName, data) {
        const tab = document.getElementById(`${this.getComponentId()}`);
        const tbody = tab.querySelector('tbody');
        switch (behaviorName) {
        case 'appendRow': {
            data.forEach(rowEl => this.createRows(tab, tbody, rowEl, this.incrementId()));
            this.triggerEvent('appendRow', data, this.data);
            break;
        }
        case 'deleteRow': {
            // Currently, element returns a html element but it should be a javascript object
            // a row has to be passed in as data for row to be deleted for now.
            const rowData = tbody.querySelector(`#${data}`);
            if (rowData) {
                $(rowData).remove();
            }
            this.triggerEvent('deleteRow', data, this.data);
            break;
        }
        default:
            break;
        }
        return null;
    }

    appendRow(data) {
        this.invokeBehavior('appendRow', data);
    }

    deleteRow(data) {
        this.invokeBehavior('deleteRow', data);
    }

    modalData = {
        '@id': 'complexTableModalOne',
        '@title': 'Delete',
        '@modalStyle': 'confirm',
        '@size': 'tiny',
        '@descriptionText': 'Are you sure you want to delete the selected rows?',
        '@approveButtonText': 'Confirm',
        '@denyButtonText': 'Cancel',
        '@hasServerCallback': true,
        '@clientCallbacks': () => {
            this.selectedRows.forEach(el => this.deleteRow(el));
        },
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

    addFooter(table) {
        const tfoot = document.createElement('tfoot');
        const trfoot = this.appendNode(tfoot, 'tr');
        const trth = this.appendNode(trfoot, 'th');
        trth.setAttribute('colspan', 8);
        const menuDiv = this.appendNode(trth, 'div', 'ui right floated pagination menu');
        const deleteButton = this.appendNode(menuDiv, 'a', 'item');
        deleteButton.textContent = 'Delete';
        const editButton = this.appendNode(menuDiv, 'a', 'item');
        editButton.textContent = 'Edit';
        deleteButton.addEventListener('click', () => {
            if (this.selectedRows.size >= 1) {
                this.loadModal().then((data) => {
                    const x = Object.getPrototypeOf(data);
                    x.openModal(this.modalData);
                });
            }
        });
        table.append(tfoot);
    }

    loadModal(loc) {
        const confirmBox = BaseComponent.getComponent('modal', this.modalData, loc);
        return confirmBox;
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
        const { node, selectedRows, triggerEvent } = this;
        const jsonData = this.data;

        function selectRow(e) {
            if (!e.target.parentElement.matches('tr')) return;
            const trElement = e.target.parentElement;
            trElement.classList.toggle('negative');
            const sel = this.querySelectorAll('.negative');
            selectedRows.clear();
            sel.forEach((el) => {
                selectedRows.add(el.id);
                triggerEvent('selectRow', selectedRows, jsonData);
            });
        }

        // Save the column titles to the column object in the constructor
        const columnTitles = {};

        const tableId = [];
        const mainParent = document.createElement('kc-complex-table');
        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const tbody = document.createElement('tbody');
        table.className = 'ui selectable fixed compact';
        table.id = this.getComponentId();
        mainParent.appendChild(table);
        // set Color
        if (jsonData['@color'].length > 0) {
            table.classList.add(jsonData['@color']);
        }
        if (jsonData['@isInverted']) {
            table.classList.add('inverted');
        }
        table.classList.add('table');
        tbody.style.cursor = 'pointer';
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
        tbody.addEventListener('click', selectRow);
        this.addFooter(table);
        tableId.push(`#${table.getAttribute('id')}`);

        this.loadModal(document.querySelector('body'));
        node.appendChild(mainParent);
        this.isRendered(this.tagName());
    }
}
module.exports = ComplexTable;
