class ActivityTimeline extends components.LightningComponent {

    #identifiers = [];

    beforeCompile() {
        this.getInput().items[0].lineColor;
    }

    eventHandlers() {
        return {
            ['insert.items_$.actions']: ({ value: actions, parentObject, afterMount }) => {
                if (!actions) return;

                const { identifier } = parentObject;

                afterMount(() => {
                    this.#addContextMenu(identifier, actions);
                });
            },
            ['remove.items_$.actions']: ({ value, parentObject, afterMount }) => {
                if (!value) return;

                const { identifier } = parentObject;

                afterMount(() => {
                    this.#removeContextMenu(identifier);
                });
            },
            ['insert.items_$.lineColor']: ({ value: lineColor, parentObject, afterMount }) => {
                const { identifier } = parentObject;

                afterMount(() => {
                    this.getLineColorStyleElement(identifier).innerHTML = lineColor ? this.getLineColorStyleRule(identifier, lineColor) : '';
                });
            },
            ['insert.items_$.expanded']: ({ value: expanded, parentObject: { identifier }, afterMount }) => {

                afterMount(() => {
                    this.getExpandButton(identifier).getButton()
                        .setAttribute("aria-expanded", expanded);

                    const { classList } = this.getTimelineItem(identifier);

                    if (expanded) {
                        classList.add('slds-is-open');
                    } else {
                        classList.remove('slds-is-open');
                    }
                });
            }
        }
    }

    beforeRender() {
        this.on('insert.items_$.actions', 'insert.items_$.actions');
        this.on('remove.items_$.actions', 'remove.items_$.actions');
        this.on('insert.items_$.lineColor', 'insert.items_$.lineColor');
        this.on('insert.items_$.expanded', 'insert.items_$.expanded');
    }

    onMount() {

        // Todo: There are other components we need to do this for. 
        // Scan SLDS CSS file for .slds-is-open

        const nodeId = `${this.getElementId()}-ul`;

        this.getNode().id = nodeId;

        this.getNode().insertAdjacentElement(
            "beforebegin",
            document.createRange().createContextualFragment(
                this.getInlineStylesForVisibility(nodeId)
            )
                .children[0]
        );
    }

    initializers() {
        return {
            ['items_$.identifier']: () => this.randomString(),
        };
    }

    transformers() {
        return {
            ['items_$.identifier']: (identifier) => {
                if (!identifier || this.#identifiers.includes(identifier)) {
                    identifier = this.randomString();
                }
                this.#identifiers.push(identifier);

                return identifier;
            },
        };
    }

    immutablePaths() {
        return ['items_$.identifier'];
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

        const { container } = components.OverlayComponent.getOverlayConfig() || {};

        if (container) {
            contextMenu.setContainer(container);
        }

        await contextMenu.load();

        contextMenu.addNode(btn);
    }

    #removeContextMenu(identifier) {
        const contextMenu = this.contextMenus[identifier];
        assert(contextMenu);

        contextMenu.destroy();

        delete this.contextMenus[identifier];
    }

    getItem(identifier) {
        const { items } = this.getInput();
        return items.filter(item => item.identifier == identifier)[0];
    }

    setupExpandBtn({ node }) {
        const identifier = node.querySelector(':scope > li').getAttribute('identifier');
        const expandBtn = this.getExpandButton(identifier)

        expandBtn.on('click', new EventHandler(
            () => {
                const input = _this.getInput();

                if (input) {
                    const item = _this.getItem(_identifier);
                    item.expanded = !item.expanded;
                } else {

                    const btn = _this.getExpandButton(_identifier).getButton();
                    const currentValue = (btn.getAttribute("aria-expanded") == 'true') ? true : false;

                    btn.setAttribute("aria-expanded", !currentValue);

                    _this.toggleCssClass0(
                        _this.getTimelineItem(_identifier), !currentValue, 'slds-is-open',
                    );
                }
            },
            null,
            { _this: this, _identifier: identifier },
        ));

        expandBtn.on('load', new EventHandler(
            function () {
                this.component.getButton().setAttribute(
                    "aria-controls", _this.getArticle(_identifier).id
                );
            },
            null,
            { _this: this, _identifier: identifier },
        ));
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