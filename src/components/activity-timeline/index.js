class ActivityTimeline extends components.LightningComponent {

    initCompile() {
        // Load component class: ContextMenu at compile-time to indicate
        // that this component requires them
        components.ContextMenu;
    }

    hooks() {
        return {
            contextActions: (evt) => {
                const { newValue: menu } = evt;
                if (this.contextMenu) {
                    this.contextMenu.onMenuChange(menu)
                } else {

                    // Note: Hooks are eagerly called by RootProxy - even before the
                    // newValue is validated, transformed or saved, hence we need to 
                    // manually validate that <menu> is a Menu instance
                    assert(newMenu instanceof components.Menu);

                    this.createContextMenu(menu);
                    this.registerContextMenuTargetNodes()
                }
            },
            ['items.$_.lineColor']: (evt) => {
                const { newValue: lineColor, parentObject: { ["@key"]: identifier } } = evt;

                this.node.querySelector(`.slds-timeline li style[identifier='${identifier}']`)
                    .innerHTML = this.getItemStyle0(identifier, lineColor);
            },
            ['items.$_.expandable']: (evt) => {
                const { parentObject: { ["@key"]: identifier } } = evt;
                this.setExpandButtonVisibility(identifier);
            },
            ['items.$_.expanded']: (evt) => {
                const { newValue: expanded, parentObject: { ["@key"]: identifier } } = evt;
                const { items } = this.getInput();
                const item = items[identifier];

                if (item.expanded == expanded) {
                    return;
                }

                this.expandOrCollapseItem(identifier);
            }
        }
    }

    registerContextMenuTargetNodes() {
        const { items } = this.getInput();

        if (!Object.keys(items).length) {
            return;
        }

        const targetNodes = document.querySelectorAll(
            `#${this.getElementId()} li .slds-timeline__actions button`
        );

        targetNodes.forEach(targetNode => {
            this.contextMenu.addNode(targetNode);
        });
    }

    async createContextMenu(menu) {
        this.contextMenu = new components.ContextMenu({
            input: {
                menu,
                clickType: 'left',
                useTargetPosition: true,
            }
        });

        await this.contextMenu.load();
    }

    async onMount() {
        const { contextActions } = this.getInput();

        if (contextActions) {
            await this.createContextMenu(contextActions);
            this.registerContextMenuTargetNodes();
        }
    }

    expandOrCollapseItem(identifier) {
        const node = this.node.querySelector(`li[identifier='${identifier}'] > div.slds-timeline__item_expandable`);
        const className = 'slds-is-open';
        const { classList } = node;

        if (classList.contains(className)) {
            classList.remove(className);
        } else {
            classList.add(className);
        }
    }

    itemTransform({ node, blockData, initial }) {
        const identifier = node.querySelector(':scope > li').getAttribute('identifier');

        const { items } = this.getInput();

        const item = items[identifier];

        if (this.contextMenu) {
            if (!initial) {
                const targetNode = node.querySelector(':scope > li .slds-timeline__actions button');
                this.contextMenu.addNode(targetNode);
            } else {
                // If initial, contextMenu has already been registered
                // through the onMount lifecycle method
            }
            return;
        }

        this.node.querySelector(
            this.getExpandButtonSelector(identifier)
        )
            .addEventListener('click', () => {
                item.expanded = !item.expanded;
            });
    }

    getExpandButtonSelector(identifier) {
        return `#${this.getElementId()} li${identifier ? `[identifier='${identifier}']` : ''} > div.slds-timeline__item_expandable .slds-media__figure > button`;
    }

    setExpandButtonVisibility(identifier) {
        const { getExpandButtonSelector } = ActivityTimeline;

        const node = this.node.querySelector(this.getExpandButtonSelector(identifier));
        const { items } = this.getInput();
        const item = items[identifier];

        if (item.expandable) {
            node.style.visibility = 'visible';
        } else {
            node.style.visibility = 'hidden';
        }
    }

    /**
     * This helper is created because we can't use mustache expressions
     * within stylesheets as that would invalidate our entire html.
     * 
     * Note: we are using hooks to manually orchestrate data-binding
     */
    getItemStyle(identifier, lineColor) {
        let rules = '';
        if (lineColor) {
            rules += this.getItemStyle0(identifier, lineColor);
        }
        return `<style identifier="${identifier}">${rules}</style>`;
    }

    getItemStyle0(identifier, lineColor) {
        return `
        .slds-timeline__item_lc_${identifier}:before{
            background:${lineColor}!important;
        }`;
    }

}
module.exports = ActivityTimeline;