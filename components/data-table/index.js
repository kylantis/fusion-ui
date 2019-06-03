class Table {
    constructor() {

    }

    myTable = [
        {
            "Name": "Patrick Paul",
            "Phone": "(03) 1260 0845",
            "Age": "50",
            "Email": "nec.mauris@dolorsit.net", 
            "Office": "Lithuania",
            "Salary": "$1959.78"
        },
        { 
            "Name": "Tatum James",
            "Phone": "(03) 1878 2513",
            "Age": "13",
            "Email": "molestie@mieleifend.ca", 
            "Office": "French Southern Territories",
            "Salary": "$8809.37"
        },
        {
            "Name": "Brenna May",
            "Phone": "(02) 0447 1692",
            "Age": "59",
            "Email": "turpis@malesuadaaugue.ca", 
            "Office": "Lebanon",
            "Salary": "$3556.91"
        },
        {
            "Name": "Jaquelyn Schneider",
            "Phone": "(01) 9531 4839",
            "Age": "50",
            "Email": "sed.dictum@quisa.ca", 
            "Office": "Brunei",
            "Salary": "$7748.94"
        },
        { 
            "Name": "Vanna Rogers",
            "Phone": "(04) 8302 4239",
            "Age": "40",
            "Email": "molestie@mieleifend.ca", 
            "Office": "Suriname",
            "Salary": "$8034.19"
        },
        {
            "Name": "Imogene Wyatt",
            "Phone": "(02) 4149 2448",
            "Age": "22",
            "Email": "nec.ligula@pedeCrase.com", 
            "Office": "Chile",
            "Salary": "$7056.53"
        }
    ]
    
    getJson () {
        let tablejson = {
            "@title": "Datatable",
            "@tableStyle": "standard",
            "@isHoverable": true,
            "@isResponsive": false,
            "@isStriped": false,
            "@hasBorder": true,
            "@singleLine": false,
            "@isPaginated": false,
            "@isInverted": false,
            "@color": "red",
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
            }],
            "@tableWidth": "100%",

        }
        return tablejson;
    }

    createTable(node) {
        let tableData = this.myTable;
        let jsonData = this.getJson();

        let rowDiv = document.createElement('div');
        rowDiv.className = "row";
        let wideDiv = document.createElement('div');
        rowDiv.appendChild(wideDiv);
        wideDiv.className="sixteen wide column";
        let segmentsDiv = document.createElement('div');
        wideDiv.appendChild(segmentsDiv);
        segmentsDiv.className = "ui segments";
        let segmentDiv = document.createElement('div');
        segmentDiv.className = "ui segment";
        let h5 = document.createElement('h5');
        segmentDiv.appendChild(h5);
        h5.innerHTML = jsonData['@title'];
        let segment2 = document.createElement('div');
        segmentsDiv.append(segment2);
        segment2.className = "ui segment";
        let table = document.createElement('table');
        table.className = "ui compact selectable striped celled table tablet stackable";
        segment2.appendChild(table);
        table.setAttribute("cellspacing", 0);
        table.setAttribute("width", "100%");
        
        // create thead and tbody variables
        let thead = document.createElement('thead');
        let tbody = document.createElement('tbody');
        table.appendChild(thead);
        table.appendChild(tbody);
        //insert row into head
        let tr = thead.insertRow(-1);
        thead.appendChild(tr);

        // extract value for header
        let col = [];

        for(let i=0; i < tableData.length; i++) {
            for(let key in tableData[i]) {
                if(col.indexOf(key) === -1) {
                    col.push(key);
                }
            }
        }

        //add header information into cells
        for(let i = 0; i < col.length; i++) {
            let th = document.createElement('th');
            th.innerHTML = col[i];
            tr.appendChild(th);
        }
        
        for(let i = 0; i < tableData.length; i++) {
            let tr = tbody.insertRow(-1);
            for(let j = 0; j < col.length; j++) {
                let tableCell = tr.insertCell(-1);
                tableCell.innerHTML = tableData[i][col[j]];
            }
        }

        // function rec(n) {
        //     if (n === 1) {
        //         return;
        //     }
        //     for(let i = 0; i < tableData.length; i++) {
        //         let tr = tbody.insertRow(-1);
        //         for(let j = 0; j < col.length; j++) {
        //             let tableCell = tr.insertCell(-1);
        //             tableCell.innerHTML = tableData[i][col[j]];
        //         }
        //     }
        
        //     return rec(n-1);
        // }
        // rec(30);

        node.appendChild(rowDiv);
    }

}
new Table().createTable(document.querySelector("#Table"));