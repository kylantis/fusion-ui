
class ProgressBar {
    constructor() {
       
    }

    getJson () {
        let jsonData = {
            "@title":"first progress bar",
            "@value":"50",
            "@label":"Everything worked just fine",
            "@size": "small",
            "@multiple": "true",
            "@animated": "true",
            "@state": "active",
            "@type": "indicating",
            "@content": "progress",
            "@color": "",
            "@size": ""
        }
        // let jsonObj = JSON.parse(jsonData);
        return jsonData;
    }

    // getCssDependencies () {
    //     let cssDep = "./progress-bar.css";
    //     return cssDep;
    // }

    getComp () {
        // let body = document.querySelector('body');
        // let firstDiv = document.createElement('div');
        // let secondDiv = document.createElement('div');
        // let thirdDiv = document.createElement('div');
        // let fourthDiv = document.createElement('div');
        
        // firstDiv.append(secondDiv);
        // secondDiv.append(thirdDiv);
        // let jsonDep = (this.getJson());

        // for(let key of Object.keys(jsonDep)) {
        //     let div = document.createElement('div');
        // }
    }
    
    
    render (node) { 
        let jsonDep = (this.getJson());

        // for(let key of Object.keys(jsonDep)) {
        //     node.innerHTML = `<div class="ui progress ${jsonDep['@state']} ${jsonDep['@type']}"> 
        //     <div class="bar"><div class="progress"></div></div> 
        //     <div class="label">Everything worked, your file is all ready.</div></div>`;
        // }

        // let body = document.querySelector('body');
        let firstDiv = document.createElement('div');
        let secondDiv = document.createElement('div');
        let thirdDiv = document.createElement('div');
        let fourthDiv = document.createElement('div');
        firstDiv.setAttribute('id', 'firstDivId');

        firstDiv.className = "ui progress";
        for(let key of Object.keys(jsonDep)) {
            if(jsonDep['@state'].length > 0) {
                firstDiv.classList.add(jsonDep['@state']);
            }
            if(jsonDep['@type'].length > 0) {
                firstDiv.classList.add(jsonDep['@type']);
            }
        }
        firstDiv.append(secondDiv);
        secondDiv.className="bar";
        secondDiv.appendChild(thirdDiv);
        thirdDiv.className="progress";
        for(let key of Object.keys(jsonDep)) {
            if(jsonDep['@label'].length > 0) {
                firstDiv.append(fourthDiv);
                fourthDiv.className = "label";
                fourthDiv.innerHTML = jsonDep['@label'];
            }
        } 
        
        //Still looking for a way to reference the id
        $('#firstDivId').progress('increment');

        node.append(firstDiv);
    }

}

new ProgressBar().render(document.querySelector("#progress-bar"));




