
class Modal extends components.LightningComponent {

    initCompile() {
        this.getInput().showByDefault;
    }

    getAssetId() {
        return 'modal';
    }

    events() {
        return ['modalClose', 'modalOpen'];
    }

    onMount() {
        const { showByDefault } = this.getInput();

        if (showByDefault) {
            this.showModal();
        }
    }

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

    renderDecorators() {

        const {
            decorators: { header, content, footer }
        } = this.getMetadata(this.getAssetId0())

        const headerNode = this.node.querySelector('.slds-modal__header');
        const contentNode = this.node.querySelector('.slds-modal__content');
        const footerNode = this.node.querySelector('.slds-modal__footer');


        if (header) {
            const html = this.renderDecorator(header.program).trim();

            if (header.config.container) {
                headerNode.outerHTML = html;
            } else {
                headerNode.innerHTML = html;
            }
        } else {
            headerNode.parentElement.removeChild(headerNode);
        }

        if (content) {
            contentNode.innerHTML = this.renderDecorator(content.program);
        } else {
            this.throwError('A body must be defined for this modal');
        }

        if (footer) {
            const html = this.renderDecorator(footer.program).trim();

            if (footer.config.container) {
                footerNode.outerHTML = html;
            } else {
                footerNode.innerHTML = html;
            }
        } else {
            footerNode.parentElement.removeChild(footerNode);
        }
    }

    async load(...params) {
        return super.load(...params)
            .then(r => {

                if (this.getAssetId() == this.getAssetId0()) {
                    // This is the actual Modal component not a subclass, return
                    return r;
                }

                // Components that extend Modal usually define decorator blocks inorder to inject markup
                // into the model dialog, so we need to render them
                this.renderDecorators();

                // We need to wait for nested components to be loaded
                return this.awaitPendingTasks()
                    .then(() => ({
                        ...r,
                        // <this.node> has been modified, hence we need to return an updated] html string
                        html: this.node.outerHTML,
                    }));
            });
    }

}
module.exports = Modal;