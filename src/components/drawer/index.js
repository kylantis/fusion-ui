
class Drawer extends components.LightningComponent {

    initCompile() {
        this.getInput().showByDefault;
    }

    cssDependencies() {
        return [
            ...super.cssDependencies(),
            '/components/drawer/style.min.css',
        ];
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
        const selector = overlay ? ':scope .slds-c-overlay-drawer' :
            ':scope .slds-c-drawer-container .slds-c-drawer';

        const node = this.node.querySelector(selector);

        if (!node) {
            this.throwError(`Could not find main drawer node "${selector}"`);
        }

        return node;
    }

    toggleDrawer() {
        if (this.getDrawerNode().classList.contains('slds-is-open')) {
            this.closeDrawer();
        } else {
            this.openDrawer();
        }
    }

    openDrawer() {
        const { overlay, backdrop, toggleButton } = this.getInput();

        this.getDrawerNode().setAttribute('aria-hidden', false);

        this.getDrawerNode().classList.add('slds-is-open');

        if (overlay && backdrop) {
            this.node.querySelector(':scope .slds-backdrop').classList.add('slds-backdrop_open');
        }

        if (toggleButton) {
            this.getInlineComponent('toggleButton').node
                .setAttribute("style", "display: none");
        }

        this.dispatchEvent('drawerOpen');
    }

    closeDrawer() {
        const { backdrop, toggleButton } = this.getInput();

        this.getDrawerNode().setAttribute('aria-hidden', true);

        this.getDrawerNode().classList.remove('slds-is-open');

        if (backdrop) {
            this.node.querySelector(':scope .slds-backdrop').classList.remove('slds-backdrop_open');
        }

        if (toggleButton) {
            setTimeout(() => {
                this.getInlineComponent('toggleButton').node
                    .removeAttribute("style");
            }, 200);
        }

        this.dispatchEvent('drawerClose');
    }
}

module.exports = Drawer;