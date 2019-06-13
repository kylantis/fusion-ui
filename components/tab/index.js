class Tab extends BaseComponent {
    constructor(data, node) {
        super(data, node);
    }

    tagName() {
        return "tab";
    }

    getCssDependencies() {
        let baseDependencies = super.getCssDependencies();
        baseDependencies.push('/css/menu.css', '/css/tab.css');
        return baseDependencies;
    }

    getJsDependencies() {
        let baseDependencies = super.getJsDependencies();
        baseDependencies.push('/js/tab.js');
        return baseDependencies;
    }

    render() {
        const node = this.node;
        let tabIds = [];

        let uiDiv = document.createElement('div');
        uiDiv.setAttribute('id', `${node.getAttribute('id')}-component`);
        uiDiv.className = "ui top";
        if(this.data['@displayStyle'] === "tabbed") {
            uiDiv.classList.add("pointing");
            uiDiv.classList.add("secondary");
        } else if (this.data['@displayStyle'] === "pointing tab") {
            uiDiv.classList.add("pointing");
        }   else if (this.data['@displayStyle'] === "basic") {
            uiDiv.classList.add("attached");
            uiDiv.classList.add("tabular");
        }
        node.append(uiDiv);
        let childJson = this.data['>'];
        if (childJson.length > 0) {
            childJson.map(function (children) {
                let atag = document.createElement('a');
                atag.className = "item";
                atag.setAttribute('data-tab', children['@data-tab']);
                atag.textContent = children['@title'];
                uiDiv.append(atag);
            });
            childJson.map(function (children) {
                let itemDiv = document.createElement('div');
                itemDiv.className = "ui bottom attached tab segment";
                itemDiv.setAttribute('data-tab', children['@data-tab']);
                if(children['>']) {
                    for(let [key, value] of Object.entries(children['>'])) {
                        if(key === '@content') {
                            itemDiv.textContent = value;                            
                        }
                    }
                } 
                node.append(itemDiv);
            });
 
        }
        const componentId = uiDiv.getAttribute('id') + "-" + this.getRandomInt(10000, 20000);
        tabIds.push('#' + componentId);
        uiDiv.setAttribute('id', componentId);
        uiDiv.classList.add('menu');
        node.prepend(uiDiv);

        $('.menu .item').tab();
    }
    
}