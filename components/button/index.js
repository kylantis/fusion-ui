
class Button {
    constructor() {

    }
//buttonStyle
    getJson () {
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
            "@iconName": "secret user",
            "@tabIndex": 0,
            "@buttonText": "Hello Button",
            "@transitionContent": "Hello",
            "@iconPosition": "right",
            "@color": "green",
            "@socialButton": "twitter logo"
        }
        return jsonData;
    }
    // getCssDependencies() {}

    // selectButton(buttonName) {
    //     let jsonData = this.getJson();
    //     buttonName = jsonData["@name"];
    //     console.log(buttonName);
    //     switch(buttonName) {
    //         case "basic": 
    //             this.loadBasicButton();
    //             break;
    //         case "animated": 
    //             this.loadAnimatedButton();
    //             break;
    //         case "labeled":
    //             this.loadLabeledButton();
    //             break;
    //         case "inverted":
    //             this.loadInvertedButton();
    //             break;
    //         case "icon":
    //             this.loadIconButton();
    //             break;
    //     }
    //     return buttonName;
    // }

    // loadBasicButton(node) {
    //     let firstDiv = document.createElement('button');
    //     firstDiv.className = "ui button";
    //     firstDiv.textContent = "Follow";
    //     node.append(firstDiv);
    //     return firstDiv;
    // }

    loadButtons(node) {
        let jsonData = this.getJson();

        if(jsonData['@buttonStyle'] == "basic" || jsonData['@buttonStyle'].length < 1) {
            let button = document.createElement('button');
            button.className = jsonData['@size'] + " " + "ui button ";
            button.className += jsonData['@type'] + jsonData['@color'];
            button.textContent = jsonData['@buttonText'];
            node.append(button);
        }
        else if(jsonData['@buttonStyle'] == "animated") {
            let button = document.createElement('div');
            let firstDiv = document.createElement('div');
            let secondDiv = document.createElement('div');
            let itag = document.createElement('i');

            button.className = jsonData['@size'] + " " + "ui animated button";
            button.classList.add(jsonData['@transition']);
            button.setAttribute('tab-index', jsonData['@tabIndex']);
            button.appendChild(firstDiv);
            firstDiv.className = "visible content";
            firstDiv.innerHTML = jsonData['@buttonText'];
            if(jsonData['@iconName'].length > 0) {
                button.appendChild(secondDiv);
                secondDiv.className = "hidden content";
                secondDiv.appendChild(itag);
                itag.className = "icon ";
                itag.className += jsonData['@iconName'];
                node.append(button);
            } else {
                button.appendChild(secondDiv);
                secondDiv.className = "hidden content";
                secondDiv.textContent = jsonData['@transitionContent'];
                node.append(button);
            }     
        }
        else if(jsonData['@buttonStyle'] == "labeled") {
            let button = document.createElement('button');
            let iTag = document.createElement('i');
            button.className = jsonData['@size'] + " " + "ui ";
            button.classList.add(jsonData['@iconPosition']);
            button.className += " labeled icon button"
            button.textContent = jsonData['@buttonText'];
            button.appendChild(iTag);
            iTag.className="icon ";
            iTag.className += jsonData['@iconName'];
            
            node.append(button);
        }
        else if(jsonData['@buttonStyle'] == "icon") {
            let button = document.createElement('button');
            let iTag = document.createElement('i');
            button.className = jsonData['@size'] + " " + "ui icon button";
            button.appendChild(iTag);
            iTag.className="icon ";
            iTag.className += jsonData['@iconName'];
            node.append(button);
        }
        else if(jsonData['@buttonStyle'] == "circular") {
            let button = document.createElement('button');
            let iTag = document.createElement('i');
            button.className = jsonData['@size'] + " " + "circular ui icon button";
            button.appendChild(iTag);
            iTag.className="icon ";
            iTag.className += jsonData['@iconName'];
            node.append(button);
        }
        else if(jsonData['@buttonStyle'] == "outline") {
            let button = document.createElement('button');
            button.className = jsonData['@size'] + " " + "ui inverted ";
            button.textContent = (jsonData['@type'] || jsonData['@color']);
            if(jsonData['@type'].length > 1) {
                button.className += jsonData['@type'] + " button";
                node.append(button);
            } 
            else if (jsonData['@color'].length > 1) {
                button.className += jsonData['@color'] + " button";
                node.append(button);
            }
        } 
        else if(jsonData['@buttonStyle'] == "disabled") { 
            let button = document.createElement('button');
            button.className = jsonData['@size'] + " " + "ui disabled button";
            let iTag = document.createElement('i');
            button.textContent=jsonData['@buttonText'];
            button.appendChild(iTag);
            iTag.className = jsonData['@iconName'];
            node.append(button);
        }
    }

}

new Button().loadButtons(document.querySelector("#button"));