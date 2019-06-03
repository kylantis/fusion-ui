class Input {
    constructor() {}

    render(node) {
        node.innerHTML = "Hello index";
    }
    
}

new Input().render(document.querySelector("#input"));