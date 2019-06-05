class Input extends BaseComponent {
    constructor() {
        super();
        this.data = this.getJson();
    }

    getCssDependencies() {
        const baseDependencies = super.getCssDependencies();
        baseDependencies.push([]);
        return baseDependencies;
    }

    getJsDependencies() {
        const baseDependencies = super.getJsDependencies;
        baseDependencies.push([]);
        return baseDependencies;
    }

    getJson () {
        let jsonData = {
            "@title": "Email",
            "@type": "checkbox",
            "@placeholder": "Enter Email",
            "@maxlength": "",
            "@value": "",
            "@checked": false,
            "@autofocus": false,
            "@required": false
        }
        return jsonData;
    }
    render(node) {
        const uiDiv = document.createElement('div');
        const inputDiv = document.createElement('input');
        uiDiv.classList.add('ui');

        if(this.data['@type'] === "text") {
            uiDiv.classList.add("input");
            uiDiv.append(inputDiv);
            inputDiv.setAttribute("type", "text");
            inputDiv.setAttribute("placeholder", this.data['@type']);
        } else if (this.data['@type'] === "checkbox") {
            uiDiv.classList.add("checkbox");
            uiDiv.append(inputDiv);
            inputDiv.setAttribute("type", "checkbox");
            let labelDiv = document.createElement('label');
            labelDiv.textContent = this.data['@title'];
            uiDiv.append(labelDiv);
        }

        node.append(uiDiv);

    } 
    
    // <div class="ui checkbox">
    //     <input type="checkbox" name="example">
    //     <label>Make my profile visible</label>
    // </div>
}

new Input().render(document.querySelector("#input"));