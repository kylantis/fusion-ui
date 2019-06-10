class Table extends BaseComponent {

    constructor(data, node) {
        super(data, node);
    }

    tagName() {
        return "table";
    }

    getCssDependencies() {
        const cssDependencies = super.getCssDependencies();
        cssDependencies.push(['/css/table.css']);
        return cssDependencies;
    }


    update(node) {
        let table = this.newTable;
        console.log(table);
        for (let i = 0; i < table.length; i++) {
            let tr = tbody.insertRow(-1);
            for (let j = 0; j < col.length; j++) {
                let tableCell = tr.insertCell(-1);
                tableCell.innerHTML = table[i][col[j]];
                node.append(tableCell);
            }
        }
    }

    render(node) {
        node = this.node;
        let jsonData = this.data;

        let tableId = [];

        if (jsonData['@tableStyle'] === "standard") {

            let table = document.createElement('table');
            let thead = document.createElement('thead');
            let tbody = document.createElement('tbody');
            table.className = "ui ";
            table.setAttribute('id', `${node.getAttribute('id')}-component`);

            //set hoverable attribute
            if (jsonData['@isHoverable']) {
                table.classList.add("selectable");
            }
            //set responsive behavior
            if (jsonData['@isResponsive']) {
                table.classList.add("tablet");
                table.classList.add("stackable");
            }
            if (jsonData['@color'].length > 0) {
                table.classList.add(jsonData['@color']);
            }
            if (jsonData['@isStriped']) {
                table.classList.add("striped");
            }
            if (jsonData['@singleLine']) {
                table.classList.remove("celled");
                table.classList.add("single");
                table.classList.add("line");
            }
            if (jsonData['@isInverted']) {
                table.classList.remove("celled");
                table.classList.add("single");
                table.classList.add("line");
                table.classList.add('inverted');
            }
            if (jsonData['@isFixed']) {
                table.classList.remove("stackable");
                table.classList.remove("tablet");
                table.classList.add("fixed");
            }
            if (jsonData['@hasBorder']) {
                table.classList.add("celled");
            }
            table.classList.add("table");

            table.append(thead);
            table.append(tbody);

            //Create header row 
            let tr = thead.insertRow(-1);
            let trOne = thead.insertRow(-1);

            const columns = this.data['>'][0]['>'];
            const columnTitles = {};
            for(let i = 0; i < columns.length; i++) {
                columnTitles[i.toString()] = columns[i]['@title'];
            }

            for(let value of Object.keys(columnTitles)) {
                let th = document.createElement('th');
                th.textContent = columnTitles[value];
                tr.appendChild(th);
                thead.append(th);
            }

            if(jsonData['>'].length > 1) {
                
                for(let i = 1; i < this.data['>'].length; i++) {
                    const rowData = this.data['>'][i];
                    if(rowData['@tag']  === "row") {
                        let tr = tbody.insertRow(-1);
                        for(let j = 0; j < rowData['>'].length; j++) {
                            for(let [key,value] of Object.entries(rowData['>'][j])) {
                                if(key === "@value") {
                                    let tableCell = tr.insertCell(-1);
                                    tableCell.innerHTML = value;
                                }
                                    
                            }
                        }
                    }

                }
                
            }
            
            const id = table.getAttribute('id') + "-" + this.getRandomInt(10000, 20000);
            tableId.push('#' + id);
            table.setAttribute("id", id);

            node.appendChild(table);

        }

    }


}