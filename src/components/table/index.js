// eslint-disable-next-line no-unused-vars
class Table extends BaseComponent {
    constructor(data, node) {
        super(data, node);
        this.columnTitles = {};
    }

    tagName() {
        return 'table';
    }

    getCssDependencies() {
        const baseDependencies = super.getCssDependencies();
        baseDependencies.push('/assets/css/table.min.css');
        return baseDependencies;
    }

    render() {
        const { node } = this;
        const jsonData = this.data;
        // Save the column titles to the column object in the constructor
        const { columnTitles } = this;

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
                this.columnTitles[i.toString()] = columns[i]['@title'];
            }

            for (const value of Object.keys(columnTitles)) {
                const th = document.createElement('th');
                th.textContent = columnTitles[value];
                trHead.appendChild(th);
                thead.append(th);
            }

            if (jsonData['>'].length > 1) {
                for (let i = 1; i < this.data['>'].length; i++) {
                    const rowData = this.data['>'][i];
                    if (rowData['@tag'] === 'row') {
                        const trBody = tbody.insertRow(-1);
                        for (let j = 0; j < rowData['>'].length; j++) {
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
