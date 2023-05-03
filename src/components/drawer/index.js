
class Drawer extends components.LightningComponent {

    initCompile() {
        this.getInput().showByDefault;
    }

    static isAbstract() {
        return true;
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

    hooks() {
        return {
            ['onMount.size']: () => {
                this.normalizeSize();
            },
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

        const drawer = this.getDrawerNode();

        drawer.setAttribute('aria-hidden', false);

        drawer.classList.add('slds-is-open');

        if (overlay && backdrop) {
            this.node.querySelector(':scope .slds-backdrop').classList.add('slds-backdrop_open');
        }

        if (toggleButton) {
            this.getInlineComponent('toggleButton').node
                .setAttribute("style", "display: none");
        }

        const fn = ({ propertyName }) => {
            if (propertyName === 'width') {
                this.normalizeSize();
                drawer.removeEventListener('transitionend', fn);
            }
        };

        drawer.addEventListener('transitionend', fn);

        this.dispatchEvent('drawerOpen');
    }

    closeDrawer() {
        const { backdrop, toggleButton } = this.getInput();

        const drawer = this.getDrawerNode();

        drawer.setAttribute('aria-hidden', true);

        drawer.classList.remove('slds-is-open');

        if (this.isMobile()) {
            // If necessary, undo the changes made in normalizeSize()
            drawer.style.width = null;
        }

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

    normalizeSize() {
        const drawer = this.getDrawerNode();

        if (this.isMobile() && drawer.classList.contains('slds-is-open')) {
            // If the drawer width is wider than the viewport, add a width override

            const { width } = getComputedStyle(drawer);

            if (Number(width.replace('px', '')) > window.innerWidth) {
                drawer.style.width = `${window.innerWidth}px`;
            }
        }
    }
}

module.exports = Drawer;