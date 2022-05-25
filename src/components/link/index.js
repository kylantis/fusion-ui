
class Link extends components.LightningComponent {

    events() {
        return ['click'];
    }

    onMount() {
        this.node.querySelector(':scope > a').addEventListener("click", () => {
            this.dispatchEvent('click');
        });
    }
    
}
module.exports = Link;