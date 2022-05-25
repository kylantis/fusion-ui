class ActivityTimeline extends components.LightningComponent {

    initCompile() {
        // Load component class: ContextMenu at compile-time to indicate
        // that this component requires them
        components.ContextMenu;
    }

    hooks() {
        return {
            ['items.$_.actions']: (evt) => {
                const { newValue: menu, parentObject: { ["@key"]: identifier } } = evt;

                const contextMenu = (this.contextMenus || {})[identifier];

                if (menu) {
                    if (contextMenu) {
                        contextMenu.onMenuChange(menu)
                    } else {

                        // Note: Hooks are eagerly called by RootProxy - even before the
                        // newValue is validated, transformed or saved, hence we need to 
                        // manually validate that <menu> is a Menu instance
                        assert(newMenu instanceof components.Menu);

                        this.addContextMenu(identifier, menu);
                    }
                } else {
                    assert(!!contextMenu);

                    contextMenu.destroy();
                    delete this.contextMenus[identifier];
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

    expandOrCollapseItem(identifier) {
        const node = this.node.querySelector(`li[identifier='${identifier}'] > div.slds-timeline__item_expandable`);
        const className = 'slds-is-open';
        const { classList } = node;

        const collapse = classList.contains(className);

        if (collapse) {
            classList.remove(className);
        } else {
            classList.add(className);
        }

        // Note: this is optional
        this.getExpandButton(identifier).setAttribute("aria-expanded", !collapse);
    }

    async addContextMenu(identifier, actions) {
        const contextMenus = this.contextMenus || (this.contextMenus = {});

        const contextMenu = new components.ContextMenu({
            input: {
                menu: actions,
                clickType: 'left',
                useTargetPosition: true,
                hideOnItemClick: true,
            }
        });

        await contextMenu.load();

        contextMenu
            .addNode(this.node.querySelector(
                `#${this.getElementId()} li[identifier='${identifier}'] .slds-timeline__actions button`
            ));

        contextMenus[identifier] = contextMenu;
    }

    async itemTransform({ node, blockData, initial }) {
        const identifier = node.querySelector(':scope > li').getAttribute('identifier');

        const { items } = this.getInput();

        const item = items[identifier];

        if (item.actions) {
            await this.addContextMenu(identifier, item.actions);
        }

        const expandBtn = this.getExpandButton(identifier);

        expandBtn.addEventListener('click', () => { item.expanded = !item.expanded; });

        // Note: this is optional
        expandBtn.setAttribute("aria-controls", this.getArticle(identifier).id);
    }

    getArticle(identifier) {
        return this.node.querySelector(`#${this.getElementId()} li${identifier ? `[identifier='${identifier}']` : ''} > div.slds-timeline__item_expandable .slds-media > .slds-media__body > article`);
    }

    /**
     * Note: this function assumes that the ButtonIcon component renders a button html elemeent
     * @returns 
     */
    getExpandButton(identifier) {
        return this.node.querySelector(`#${this.getElementId()} li${identifier ? `[identifier='${identifier}']` : ''} > div.slds-timeline__item_expandable > .slds-media > .slds-media__figure button`);
    }

    setExpandButtonVisibility(identifier) {

        const node = this.getExpandButton(identifier);
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