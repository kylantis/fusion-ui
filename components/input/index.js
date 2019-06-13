class Input extends BaseComponent {
    constructor(data, node) {
        super(data, node);
        this.data = data;
        this.node = node;
    }

    tagName() {
        return "input";
    } 

    getCssDependencies() {
        const baseDependencies = super.getCssDependencies();
        baseDependencies.push(["/css/input.css"]);
        baseDependencies.push(["/css/checkbox.css"]);
        return baseDependencies;
    }
 
    render(node) {
        node = this.node;

        const uiDiv = document.createElement('div');
        const inputDiv = document.createElement('input');
        uiDiv.classList.add('ui');

        if(this.data['@type'] === "text") {
            uiDiv.classList.add("input");
            uiDiv.append(inputDiv);
            this.data['@required'] ? inputDiv.setAttribute('required', '') : '';
            inputDiv.setAttribute("type", "text");
            inputDiv.setAttribute("placeholder", this.data['@placeholder']);
        } else if (this.data['@type'] === "checkbox") {
            uiDiv.classList.add("checkbox");
            uiDiv.append(inputDiv);
            inputDiv.setAttribute("type", "checkbox");
            this.data['@required'] ? inputDiv.setAttribute('required', '') : '';
            this.data['@checked'] ? inputDiv.setAttribute('checked', 'checked') : '';
            this.data['@disabled'] ? inputDiv.setAttribute('disabled', 'disabled') : '';
            let labelDiv = document.createElement('label');
            labelDiv.textContent = this.data['@title'];
            uiDiv.append(labelDiv);
        } else if (this.data['@type'] === "radio") {
            uiDiv.classList.add("radio");
            uiDiv.classList.add("checkbox");
            uiDiv.append(inputDiv);
            inputDiv.setAttribute("type", "radio");
            this.data['@required'] ? inputDiv.setAttribute('required', '') : '';
            this.data['@checked'] ? inputDiv.setAttribute('checked', 'checked') : '';
            this.data['@disabled'] ? inputDiv.setAttribute('disabled', 'disabled') : '';
            let labelDiv = document.createElement('label');
            labelDiv.textContent = this.data['@title'];
            uiDiv.append(labelDiv);
        } else if (this.data['@type'] === "slider") {
            uiDiv.classList.add("slider");
            uiDiv.classList.add("checkbox");
            uiDiv.append(inputDiv);
            inputDiv.setAttribute("type", "checkbox");
            this.data['@required'] ? inputDiv.setAttribute('required', '') : '';
            this.data['@checked'] ? inputDiv.setAttribute('checked', 'checked') : '';
            this.data['@disabled'] ? inputDiv.setAttribute('disabled', 'disabled') : '';
            let labelDiv = document.createElement('label');
            labelDiv.textContent = this.data['@title'];
            uiDiv.append(labelDiv);
        } else if (this.data['@type'] === "toggle") {
            uiDiv.classList.add("toggle");
            uiDiv.classList.add("checkbox");
            uiDiv.append(inputDiv);
            inputDiv.setAttribute("type", "checkbox");
            this.data['@required'] ? inputDiv.setAttribute('required', '') : '';
            this.data['@checked'] ? inputDiv.setAttribute('checked', 'checked') : '';
            this.data['@disabled'] ? inputDiv.setAttribute('disabled', 'disabled') : '';
            let labelDiv = document.createElement('label');
            labelDiv.textContent = this.data['@title'];
            uiDiv.append(labelDiv);
        } else {
            uiDiv.classList.add("input");
            uiDiv.append(inputDiv);
            this.data['@required'] ? inputDiv.setAttribute('required', '') : '';
            inputDiv.setAttribute("type", this.data['@type']);
            inputDiv.setAttribute("placeholder", this.data['@title']);
        }

        node.append(uiDiv);

    } 
    
}
