class Button extends BaseComponent {

    // class Button {
    constructor() {
        super();
        this.data = this.getJson();
    }

    tagName() {
        return "button";
    }
    //buttonStyle
    getJson() {
        let jsonData = {
            "@name": "",
            "@value": "",
            "@buttonStyle": "basic",
            "@state": "",
            "@type": "info",
            "@iconUrl": "",
            "@displayStyle": "default",
            "@size": "",
            "@animated": "animated",
            "@visible": "visible",
            "@visibleContent": "text",
            "@hiddenContent": "icon",
            "@transition": "fade",
            "@iconName": "user",
            "@tabIndex": 0,
            "@buttonText": "Hello Button",
            "@transitionContent": "Hello",
            "@iconPosition": "right",
            "@color": "green",
            "@socialButton": "twitter logo"
        }
        return jsonData;
    }
    getCssDependencies() {
        const baseDependencies = super.getCssDependencies();
        baseDependencies.push(['/css/button.css', '/css/icon.css', '/shared/css/site.css', '/shared/css/reset.css']);
        return baseDependencies;
    }

    getJsDependencies() {
        const jsDependencies = super.getJsDependencies();
        jsDependencies.push(['/components/button/index.js']);
        return jsDependencies;
    }

    render(node) {
        let jsonData = this.data;
        let button = document.createElement('button');
        let buttonId = [];
        button.setAttribute('id', `${node.getAttribute('id')}-component`);


        if (jsonData['@buttonStyle'] == "basic" || jsonData['@buttonStyle'].length < 1) {
            button.className = jsonData['@size'] + " " + "ui button ";
            button.className += jsonData['@type'] + " " + jsonData['@color'];
            button.textContent = jsonData['@buttonText'];
        }
        else if (jsonData['@buttonStyle'] == "animated") {
            let firstDiv = document.createElement('div');
            let secondDiv = document.createElement('div');
            let itag = document.createElement('i');

            button.className = jsonData['@size'] + " " + "ui animated button";
            button.classList.add(jsonData['@transition']);
            button.setAttribute('tab-index', jsonData['@tabIndex']);
            button.appendChild(firstDiv);
            firstDiv.className = "visible content";
            firstDiv.innerHTML = jsonData['@buttonText'];
            if (jsonData['@iconName'].length > 0) {
                button.appendChild(secondDiv);
                secondDiv.className = "hidden content";
                secondDiv.appendChild(itag);
                itag.className = "icon ";
                itag.className += jsonData['@iconName'];
            } else {
                button.appendChild(secondDiv);
                secondDiv.className = "hidden content";
                secondDiv.textContent = jsonData['@transitionContent'];
            }
        }
        else if (jsonData['@buttonStyle'] == "labeled") {
            let iTag = document.createElement('i');
            button.className = jsonData['@size'] + " " + "ui ";
            button.classList.add(jsonData['@iconPosition']);
            button.className += " labeled icon button"
            button.textContent = jsonData['@buttonText'];
            button.appendChild(iTag);
            iTag.className = "icon ";
            iTag.className += jsonData['@iconName'];
        }
        else if (jsonData['@buttonStyle'] == "icon") {
            let iTag = document.createElement('i');
            button.className = "ui icon button" + " " + jsonData['@size'];
            button.appendChild(iTag);
            iTag.className += "icon ";
            iTag.className += (jsonData['@iconName'] || jsonData['@socialButton']);
        }
        else if (jsonData['@buttonStyle'] == "circular") {
            let iTag = document.createElement('i');
            button.className = jsonData['@size'] + " " + "circular ui icon button";
            button.appendChild(iTag);
            iTag.className = "icon ";
            iTag.className += jsonData['@iconName'];
        }
        else if (jsonData['@buttonStyle'] == "outline") {
            button.className = "ui inverted ";
            if (jsonData['@size'].length > 1) {
                button.classList.add(jsonData['@size']);
            }
            button.textContent = jsonData['@buttonText'];
            if (jsonData['@type'].length > 1) {
                button.classList.add(jsonData['@type']);
                if (jsonData['@color'].length > 1) {
                    button.classList.add(jsonData['@color']);
                }
                button.className += " button";
            }
            else if (jsonData['@color'].length > 1) {
                button.className += jsonData['@color'] + " button";
            }
        }
        else if (jsonData['@buttonStyle'] == "disabled") {
            button.className = jsonData['@size'] + " " + "ui disabled button";
            let iTag = document.createElement('i');
            button.textContent = jsonData['@buttonText'];
            button.appendChild(iTag);
            iTag.className = jsonData['@iconName'];
        }

        const id = button.getAttribute('id') + "-" + this.getRandomInt(10000, 20000);
        buttonId.push('#' + id);
        button.setAttribute("id", id);

        node.append(button);

    }

}
