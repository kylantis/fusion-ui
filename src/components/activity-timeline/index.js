class ActivityTimeline extends components.LightningComponent {

    beforeCompile() {
        // compile ContextMenu first because this component depends on it
        components.ContextMenu;
    }

    beforeRender() {
        
        this.on('insert.items.$_.actions', ({ value: actions, parentObject, afterMount }) => {
            if (!actions) return;

            const { ['@key']: identifier } = parentObject;

            afterMount(() => {
                this.#addContextMenu(identifier, actions);
            });
        });

        this.on('remove.items.$_.actions', ({ value, parentObject, afterMount }) => {
            if (!value) return;

            const { ['@key']: identifier } = parentObject;

            afterMount(() => {
                this.#removeContextMenu(identifier);
            });
        });

        this.on('insert.items.$_.lineColor', ({ value: lineColor, parentObject, afterMount }) => {
            const { ['@key']: identifier } = parentObject;

            afterMount(() => {
                this.getLineColorStyleElement(identifier).innerHTML = lineColor ? this.getLineColorStyleRule(identifier, lineColor) : '';
            });
        });

        this.on('insert.items.$_.expanded', ({ value: expanded, parentObject, afterMount }) => {
            const { ['@key']: identifier } = parentObject;

            afterMount(() => {
                this.getExpandButton(identifier).getButton()
                    .setAttribute("aria-expanded", expanded);
            });
        });
    }

    onMount() {

        // Todo: There are other components we need to do this for. 
        // Scan SLDS CSS file for .slds-is-open

        const nodeId = `${this.getId()}-ul`;

        this.getNode().id = nodeId;

        this.getNode().insertAdjacentElement(
            "beforebegin",
            document.createRange().createContextualFragment(
                this.getInlineStylesForVisibility(nodeId)
            )
                .children[0]
        );
    }

    getNode() {
        return this.node.querySelector(':scope > ul');
    }

    async #addContextMenu(identifier, actions) {
        if (this.isHeadlessContext()) return;

        const contextMenus = this.contextMenus || (this.contextMenus = {});

        if (contextMenus[identifier]) {
            // This method was called by the user multiple times
            this.#removeContextMenu(identifier);
        }

        const btn = this.getActionsTriggerButton(identifier).getButton();

        const contextMenu = new components.ContextMenu({
            input: {
                menu: actions,
                clickType: 'left',
                useTargetPosition: true,
                positions: ['bottom-left', 'top-left']
            }
        });

        contextMenus[identifier] = contextMenu;

        await contextMenu.load();

        contextMenu.addNode(btn);
    }

    #removeContextMenu(identifier) {
        const contextMenu = this.contextMenus[identifier];
        assert(contextMenu);

        contextMenu.destroy();

        delete this.contextMenus[identifier];
    }

    setupExpandBtn({ node }) {

        const { items } = this.getInput();
        const identifier = node.querySelector(':scope > li').getAttribute('identifier');

        const item = items[identifier];

        this.onceInlineComponentLoad(
            this.getExpandButtonRef(identifier),
            () => {
                const expandBtn = this.getExpandButton(identifier)

                expandBtn.on('click', () => {
                    item.expanded = !item.expanded;
                });

                expandBtn.on('load', () => {
                    expandBtn.getButton().setAttribute("aria-controls", this.getArticle(identifier).id);
                });
            }
        );
    }

    getTimelineItem(identifier) {
        return this.node.querySelector(`#${this.getElementId()} li[identifier='${identifier}'] > div.slds-timeline__item_expandable`);
    }

    getArticle(identifier) {
        return this.getTimelineItem(identifier).querySelector(':scope > .slds-media > .slds-media__body > article');
    }

    getExpandButtonRef(identifier) {
        return `${identifier}-expand-button`;
    }

    getExpandButton(identifier) {
        return this.getInlineComponent(this.getExpandButtonRef(identifier));
    }

    getActionsTriggerButtonRef(identifier) {
        return `${identifier}-actions-trigger-button`;
    }

    getActionsTriggerButton(identifier) {
        return this.getInlineComponent(this.getActionsTriggerButtonRef(identifier));
    }

    getLineColorStyleElement(identifier) {
        return this.node.querySelector(`.slds-timeline li[identifier='${identifier}'] > style:nth-child(1)`);
    }

    getLineColorStyleRule(identifier, lineColor) {
        return `
        .slds-timeline__item_lc_${identifier}:before {
            background:${lineColor}!important;
        }`;
    }

}
module.exports = ActivityTimeline;