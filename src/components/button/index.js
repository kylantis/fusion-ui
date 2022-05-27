
class Button extends components.LightningComponent {
    
    events() {
        return ['click'];
    }

    onMount() {
        this.node.querySelector(':scope > button').addEventListener("click", () => {
            this.dispatchEvent('click');;
        });
    }
}
module.exports = Button;