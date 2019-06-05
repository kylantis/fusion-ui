class Table extends BaseComponent {
    
    constructor() {
        super();
        this.data = this.getJson();
    }

    tagName() {
        return "table";
    }

    getCssDependencies() {
        const cssDependencies = super.getCssDependencies();
        cssDependencies.push['/css/table.css', '/shared/css/site.css', '/shared/css/reset.css'];
        return cssDependencies;
    } 

    getJsDependencies() {
        const jsDepenedencies = super.getJsDependencies();
        jsDepenedencies.push['/shared/js/jquery-3.4.1.min.js'];
        return jsDepenedencies;
    }

    myTable = [
        {
            "Name": "James",
            "Age": "24",
            "Job": "Engineer",
            "Salary": "125000.60",
            "Description": "James is an interesting boy but sometimes" +
                " you don't really have enough room to describe everything you'd like"
        },
        {
            "Name": "Jill",
            "Age": "26",
            "Job": "Engineer",
            "Salary": "516000.00",
            "Description": "Jill is an alright girl but sometimes you don't" +
                " really have enough room to describe everything you'd like"
        },
        {
            "Name": "Elyse",
            "Age": "24",
            "Job": "Designer",
            "Salary": "210000.40",
            "Description": "Elyse is a kind girl but sometimes you don't really have" +
                " enough room to describe everything you'd like"
        }
    ]

    getJson() {
        let tablejson = {
            "@title": "People Of The World",
            "@tableStyle": "standard",
            "@isHoverable": true,
            "@isResponsive": true,
            "@isStriped": true,
            "@hasBorder": false,
            "@singleLine": true,
            "@isInverted": true,
            "@color": "blue",
            "@isDataTable": false,
            "@isEditableTable": false,
            "@isFixed": true,
            ">": [{
                "@tag": "columns-definitions",
                ">": [{
                    "@tag": "column",
                    "@textAlign": "center | left | right",
                    "@title": "abc"
                }, {
                    "@tag": "column",
                    "@textAlign": "center | left | right",
                    "@title": "abc"
                }, {
                    "@tag": "column",
                    "@textAlign": "center | left | right",
                    "@title": "abc"
                }]
            }]
        }
        return tablejson;
    }

    render(node) {
        let tableData = this.myTable;
        let jsonData = this.data;
        let tableId = [];

        if (jsonData['@tableStyle'] === "standard") {
            //extract value for header
            let col = [];

            for (let i = 0; i < tableData.length; i++) {
                for (let key in tableData[i]) {
                    if (col.indexOf(key) === -1) {
                        col.push(key);
                    }
                }
            }

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

            //Add title
            if (jsonData['@title'].length > 0) {
                let thOne = document.createElement('th');
                thOne.innerHTML = jsonData['@title'];
                thOne.setAttribute("colspan", col.length);
                trOne.appendChild(thOne);
                thead.prepend(trOne);
            }

            for (let i = 0; i < col.length; i++) {
                let th = document.createElement('th');
                th.innerHTML = col[i];
                tr.appendChild(th);
            }
            //Add JSON data to table as rows
            for (let i = 0; i < tableData.length; i++) {
                let tr = tbody.insertRow(-1);
                for (let j = 0; j < col.length; j++) {
                    let tableCell = tr.insertCell(-1);
                    tableCell.innerHTML = tableData[i][col[j]];
                }
            }
            const id = table.getAttribute('id') + "-" + this.getRandomInt(10000, 20000);
            tableId.push('#' + id);
            table.setAttribute("id", id);
            node.appendChild(table);
        }

    }

}