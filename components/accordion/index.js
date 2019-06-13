class Accordion extends BaseComponent {
    constructor(data, node) {
        super(data, node);
    }

    tagName() {
        return "accordion";
    }

    getCssDependencies() {
        let baseDependencies = super.getCssDependencies();
        baseDependencies.push('/css/accordion.css', '/css/dropdown.css');
        return baseDependencies;
    }

    getJsDependencies() {
        let baseDependencies = super.getJsDependencies();
        baseDependencies.push('/js/accordion.js', '/js/dropdown.js');
        return baseDependencies;
    }

    

    render() {
        const node = this.node;

        let uiDiv = document.createElement('div');
        uiDiv.className = "ui fluid";

        this.data['@displayStyle']==="styled" ? uiDiv.classList.add("styled") : "";
        if(this.data['>']) {
            for(let i = 0; i < this.data['>'].length; i++) {
                for(let [key, value] of Object.entries(this.data['>'][i])) {     
                    if(key === "@title"){
                        let titleDiv = document.createElement('div');
                        // let iTag = document.createElement('i');
                        this.appendNode(titleDiv, "i", "dropdown icon")
                        // titleDiv.prepend(iTag);
                        // iTag.className = "dropdown icon";
                        titleDiv.className = "title";
                        uiDiv.appendChild(titleDiv);
                        let textnode = document.createTextNode(value);
                        titleDiv.appendChild(textnode);
                    }
                    if(key === "@content") {
                        let contentDiv = document.createElement('div');
                        contentDiv.className = "content";
                        uiDiv.appendChild(contentDiv);
                        let ptag = document.createElement('p');
                        contentDiv.appendChild(ptag);
                        ptag.className = "transition hidden";
                        ptag.textContent = value;
                    }
                }   
            }
            uiDiv.classList.add("accordion");
            node.append(uiDiv);
            $('.ui.accordion').accordion();
        }

    }

}