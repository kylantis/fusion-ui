
class Drawer extends components.LightningComponent {

    initCompile() {
        this.getInput().showByDefault;
    }

    beforeMount() {
        const input = this.getInput();

        if (!input.position) {
            input.position = 'left';
        }

        if (!input.size) {
            input.size = 'medium';
        }
    }

    onMount() {
        const { showByDefault } = this.getInput();

        if (showByDefault) {
            this.openDrawer();
        }
    }

    events() {
        return ['drawerClose', 'drawerOpen'];
    }

    getContentContainerSelector() {
        const { random } = this.getGlobalVariables();
        return `#${random}-content-container`;
    }

    getDrawerNode() {
        const { overlay } = this.getInput();
        return overlay ? this.node.querySelector(':scope .slds-c-overlay-drawer') :
            this.node.querySelector(':scope .slds-c-drawer-container .slds-c-drawer');
    }

    openDrawer() {
        const { backdrop } = this.getInput();

        this.getDrawerNode().setAttribute('aria-hidden', false);

        this.getDrawerNode().classList.add('slds-is-open');

        if (backdrop) {
            this.node.querySelector(':scope .slds-backdrop').classList.add('slds-backdrop_open');
        }

        this.dispatchEvent('drawerOpen');
    }

    closeDrawer() {
        const { backdrop } = this.getInput();

        this.getDrawerNode().setAttribute('aria-hidden', true);

        this.getDrawerNode().classList.remove('slds-is-open');

        if (backdrop) {
            this.node.querySelector(':scope .slds-backdrop').classList.remove('slds-backdrop_open');
        }

        this.dispatchEvent('drawerClose');
    }
}

module.exports = Drawer;