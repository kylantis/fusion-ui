
class ProgressBar extends BaseComponent {
    constructor(data, node) {
        super(data, node);
        this.data = data;
        this.node = node;
    }

    tagName() {
        return "progressBar";
    }

    

    getCssDependencies() {
        const baseDependencies = super.getCssDependencies();
        baseDependencies.push(['/css/icon.css']);
        baseDependencies.push(['/css/progress.css']);
        return baseDependencies;
    }

    getJsDependencies() { 
        const baseDependencies = super.getJsDependencies();
        baseDependencies.push('/js/progress.js');
        return baseDependencies;
    }

    // initialize(id) {
    //     $('#'+id).progress();
    // }

    render(node) {
        node = this.node;
        let jsonDep = this.data;
        let progressBarIds = [];

        let uiDiv = document.createElement('div');
        let barDiv = document.createElement('div');
        let progressDiv = document.createElement('div');
        let labelDiv = document.createElement('div');
        uiDiv.setAttribute('id', `${node.getAttribute('id')}-component`);

        uiDiv.className = "ui ";
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

        uiDiv.classList.add("progress");

        const id = uiDiv.getAttribute('id') + "-" + this.getRandomInt(10000, 20000);
        
        progressBarIds.push('#' + id);
        uiDiv.setAttribute("id", id);
        uiDiv.setAttribute('data-value', 20);
        uiDiv.setAttribute('data-total', 100);
        // this.initialize(id);
        uiDiv.setAttribute("onload", "initialize()");


        node.append(uiDiv);
    }

    
    

}





