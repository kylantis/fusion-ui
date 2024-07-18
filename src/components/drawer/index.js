
class Drawer extends components.LightningComponent {

    beforeCompile() {
        this.getInput().showByDefault;
    }

    static isAbstract() {
        return true;
    }

    useWeakRef() {
        return false;
    }
    
    beforeRender() {
        const input = this.getInput();

        if (!input.position) {
            input.position = 'left';
        }

        if (!input.size) {
            input.size = 'medium';
        }
    }

    eventHandlers() {
        return {
            ['insert.size']: ({ afterMount }) => {
                afterMount(() => {
                    this.normalizeSize();
                });
            }
        }
    }

    afterMount() {
        const { showByDefault } = this.getInput();

        if (showByDefault) {
            this.openDrawer();
        }

        this.on('insert.size', 'insert.size');
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

        return this.node.querySelector(selector);
    }

    toggleDrawer() {
        if (this.getDrawerNode().classList.contains('slds-is-open')) {
            this.closeDrawer();
        } else {
            this.openDrawer();
        }
    }

    showToggleButton() {
        const { toggleButton } = this.getInput();

        if (toggleButton) {
            this.getInlineComponent('toggleButton').show();
        }
    }

    hideToggleButton() {
        const { toggleButton } = this.getInput();

        if (toggleButton) {
            this.getInlineComponent('toggleButton').hide();
        }
    }

    openDrawer() {
        const { overlay, backdrop } = this.getInput();

        const drawer = this.getDrawerNode();

        drawer.setAttribute('aria-hidden', false);

        drawer.classList.add('slds-is-open');

        if (overlay && backdrop) {
            this.node.querySelector(':scope .slds-backdrop').classList.add('slds-backdrop_open');
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
        const { backdrop } = this.getInput();

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