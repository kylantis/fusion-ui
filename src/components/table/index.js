// eslint-disable-next-line no-unused-vars
class Table extends BaseComponent {
    tagName() {
        return 'table';
    }

    getCssDependencies() {
        const baseDependencies = super.getCssDependencies();
        baseDependencies.push('/assets/css/table.min.css', '/assets/css/input.min.css');
        return baseDependencies;
    }

    behaviorNames() {
        return (['appendRow', 'deleteRow', 'editRow']);
    }

    getTableBody() {
        return this.node.querySelector('tbody');
    }

    static getRowId(event) {
        return event.target.parentNode.id;
    }

    getLastChildId() {
        const originalId = this.node.querySelector('tbody').lastChild.getAttribute('id');
        const id = parseInt(originalId, 10);
        return id;
    }

    update(behavior, data) {
        const lastChildId = this.getLastChildId() + 1;
        const element = document.getElementById(data);

        switch (behavior) {
        case 'appendRow':

            for (let i = 0; i < data.length; i += 1) {
                if (data[i]['@tag'] === 'row') {
                    const updatedBody = this.getTableBody().insertRow(-1);
                    updatedBody.id = `${lastChildId + i}`;
                    // check if row tag
                    const columns = data[i]['>'];
                    for (const k in columns) {
                        if (Object.prototype.hasOwnProperty.call(columns, k)) {
                            const tableCell = updatedBody.insertCell(-1);
                            tableCell.innerHTML = columns[k];
                        }
                    }
                }
            }
            break;

        case 'deleteRow':
            element.parentNode.removeChild(element);
            this.callback('deleteRow', 'element');
            break;

        default:

            break;
        }
    }

    render() {
        const { node } = this;
        const jsonData = this.data;
        // Save the column titles to the column object in the constructor
        const columnTitles = {};

        const tableId = [];

        if (jsonData['@tableStyle'] === 'standard') {
            const table = document.createElement('table');
            const thead = document.createElement('thead');
            const tbody = document.createElement('tbody');
            table.className = 'ui ';
            table.setAttribute('id', `${node.getAttribute('id')}-component`);

            // set hoverable attribute
            if (jsonData['@isHoverable']) {
                table.classList.add('selectable');
            }
            // set responsive behavior
            if (jsonData['@isResponsive']) {
                table.classList.add('tablet');
                table.classList.add('stackable');
            }
            if (jsonData['@color'].length > 0) {
                table.classList.add(jsonData['@color']);
            }
            if (jsonData['@isStriped']) {
                table.classList.add('striped');
            }
            if (jsonData['@singleLine']) {
                table.classList.remove('celled');
                table.classList.add('single');
                table.classList.add('line');
            }
            if (jsonData['@isInverted']) {
                table.classList.remove('celled');
                table.classList.add('single');
                table.classList.add('line');
                table.classList.add('inverted');
            }
            if (jsonData['@isFixed']) {
                table.classList.remove('stackable');
                table.classList.remove('tablet');
                table.classList.add('fixed');
            }
            if (jsonData['@hasBorder']) {
                table.classList.add('celled');
            }
            table.classList.add('table');

            table.append(thead);
            table.append(tbody);

            // Create header row
            const trHead = thead.insertRow(-1);

            const columns = this.data['>'][0]['>'];
            for (let i = 0; i < columns.length; i++) {
                columnTitles[i.toString()] = columns[i]['@title'];
            }

            for (const value of Object.keys(columnTitles)) {
                const th = document.createElement('th');
                th.textContent = columnTitles[value];
                trHead.appendChild(th);
            }

            if (jsonData['>'].length > 0) {
                let id = 0;
                for (let i = 1; i < this.data['>'].length; i++) {
                    const rowData = this.data['>'][i];
                    if (rowData['@tag'] === 'row') {
                        const trBody = tbody.insertRow(-1);
                        trBody.id = `${id += 1}`;
                        const innerRowData = rowData['>'];
                        for (let j = 0; j < innerRowData.length; j++) {
                            for (const [key, value] of Object.entries(rowData['>'][j])) {
                                if (key === '@value') {
                                    const tableCell = trBody.insertCell(-1);
                                    tableCell.innerHTML = value;
                                }
                            }
                        }
                    }
                }
            }

            const id = `${table.getAttribute('id')}-${this.getRandomInt()}`;
            tableId.push(`#${id}`);
            table.setAttribute('id', id);

            node.appendChild(table);
        }
    }
}
