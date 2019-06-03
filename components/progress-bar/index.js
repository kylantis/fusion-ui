
class ProgressBar extends BaseComponent {
    constructor() {
        super();
        this.data = this.getJson();
    }

    tagName() {
        return "progressBar";
    }

    getJson() {
        let jsonData = {
            "@title": "first progress bar",
            "@value": "50",
            "@label": "Everything worked just fine",
            "@size": "small",
            "@multiple": "true",
            "@animated": "true",
            "@state": "active",
            "@type": "indicating",
            "@content": "progress",
            "@color": "",
            "@size": ""
        }
        return jsonData;
    }

    getCssDependencies() {
        const cssDependencies = super.getCssDependencies();
        cssDependencies.push['/css/progress.css', '/css/icon.css', '/shared/css/site.css', '/shared/css/reset.css'];
        return cssDependencies;
    }

    getJsDependencies() {
        const jsDepenedencies = super.getJsDependencies();
        jsDepenedencies.push['/js/progress.js', '/shared/js/jquery-3.4.1.min.js'];
        return jsDepenedencies;
    }

    render(node) {
        let jsonDep = this.data;
        let progressBarIds = [];


        // let body = document.querySelector('body');
        let uiDiv = document.createElement('div');
        let barDiv = document.createElement('div');
        let progressDiv = document.createElement('div');
        let labelDiv = document.createElement('div');
        uiDiv.setAttribute('id', `${node.getAttribute('id')}-component`);

        uiDiv.className = "ui progress";
        for (let key of Object.keys(jsonDep)) {
            if (jsonDep['@state'].length > 0) {
                uiDiv.classList.add(jsonDep['@state']);
            }
            if (jsonDep['@type'].length > 0) {
                uiDiv.classList.add(jsonDep['@type']);
            }
        }
        uiDiv.append(barDiv);
        barDiv.className = "bar";
        barDiv.appendChild(progressDiv);
        progressDiv.className = "progress";
        for (let key of Object.keys(jsonDep)) {
            if (jsonDep['@label'].length > 0) {
                uiDiv.append(labelDiv);
                labelDiv.className = "label";
                labelDiv.innerHTML = jsonDep['@label'];
            }
        }

        //Still looking for a way to reference the id

        const id = uiDiv.getAttribute('id') + "-" + this.getRandomInt(10000, 20000);

        $('#' + id).progress('increment');


        progressBarIds.push('#' + id);
        uiDiv.setAttribute("id", id);

        node.append(uiDiv);
    }

}





