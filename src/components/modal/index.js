
class Modal extends components.LightningComponent {

    beforeCompile() {
        this.getInput().showByDefault;
    }

    static isAbstract() {
        return true;
    }

    events() {
        return ['modalClose', 'modalOpen'];
    }

    afterMount() {
        const { showByDefault } = this.getInput();

        if (showByDefault) {
            this.showModal();
        }
    }

    behaviours() {
        return ['showModal', 'closeModal'];
    }

    // Note: Subclasses should override showModal() and closeModal() if this implementation
    // does not play nicely with their markup
    
    showModal() {
        this.node.querySelector(':scope > section').classList.add('slds-fade-in-open');
        this.node.querySelector(':scope > .slds-backdrop').classList.add('slds-backdrop_open');

        this.dispatchEvent('modalOpen');
    }

    closeModal() {
        this.node.querySelector(':scope > section').classList.remove('slds-fade-in-open');
        this.node.querySelector(':scope > .slds-backdrop').classList.remove('slds-backdrop_open');

        this.dispatchEvent('modalClose');
    }

}
module.exports = Modal;