
class ProgressBar extends BaseComponent {
    constructor(data, node) {
        super(data, node);
    }

    tagName() {
        return "progressBar";
    } 

    getCssDependencies() {
        const baseDependencies = super.getCssDependencies();
        baseDependencies.push('/css/icon.css', '/css/progress.css');
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

    render() {
        const node = this.node;
        let jsonData = this.data;
        let progressBarIds = [];

        let uiDiv = document.createElement('div');
        let barDiv = document.createElement('div');
        let progressDiv = document.createElement('div');
        let labelDiv = document.createElement('div');
        uiDiv.setAttribute('id', `${node.getAttribute('id')}-component`);

        uiDiv.className = "ui";
        if (jsonData['@state'].length > 0) {
            uiDiv.classList.add(jsonData['@state']);
        }
        if (jsonData['@type'].length > 0) {
            uiDiv.classList.add(jsonData['@type']);
        }
        uiDiv.append(barDiv);
        barDiv.className = "bar";
        barDiv.appendChild(progressDiv);
        progressDiv.className = "progress";

        if (jsonData['@label'].length > 0) {
            uiDiv.append(labelDiv);
            labelDiv.className = "label";
            labelDiv.innerHTML = jsonData['@label'];
        }

        uiDiv.classList.add("progress");

        const id = uiDiv.getAttribute('id') + "-" + this.getRandomInt(10000, 20000);
        
        progressBarIds.push('#' + id);
        uiDiv.setAttribute("id", id);
        uiDiv.setAttribute('data-value', 20);
        uiDiv.setAttribute('data-total', 100);
        // this.initialize(id);
        // uiDiv.setAttribute("onload", this.initialize(id));

        node.append(uiDiv);
    }

    
    

}





