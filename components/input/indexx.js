class CheckBox {
    constructor() {

    }
    render(node) {
        new Input().render(node);
        node.innerHTML = "Hello Indexx";
    }
}
new Input().render(document.querySelector("#inputtt"));

new CheckBox().render(document.querySelector("#inputt"));
