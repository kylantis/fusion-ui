class ActivityTimeline extends components.LightningComponent {

    initCompile() {
        // Load component class: ContextMenu at compile-time to indicate
        // that this component requires them
        components.ContextMenu;
    }

    hooks() {
        return {
            ['beforeMount.items.$_.actions']: (evt) => {
                const { newValue: actions, parentObject: { ["@key"]: identifier } } = evt;

                const contextMenu = (this.contextMenus || {})[identifier];

                if (actions) {
                    if (contextMenu) {
                        contextMenu.onMenuChange(actions)
                    } else {
                        this.addContextMenu(identifier, actions);
                    }
                } else {
                    assert(!!contextMenu);

                    contextMenu.destroy();
                    delete this.contextMenus[identifier];
                }
            },
            ['beforeMount.items.$_']: (evt) => {
                const { getKeyFromIndexSegment, getParentFromPath, getMapKeyPrefix } = this;
                const { path, newValue, oldValue } = evt;

                if (!newValue && oldValue.actions) {

                    const key = getKeyFromIndexSegment(
                        path.replace(
                            getParentFromPath(path.split('.')),
                            ''
                        )
                    );

                    const identifier = key.replace(getMapKeyPrefix(), '');

                    const contextMenu = this.contextMenus[identifier];
                    assert(contextMenu);

                    contextMenu.destroy();

                    delete this.contextMenus[identifier];
                }
            },
            ['beforeMount.items.$_.lineColor']: (evt) => {
                const { newValue: lineColor, parentObject: { ["@key"]: identifier } } = evt;

                this.node.querySelector(`.slds-timeline li style[identifier='${identifier}']`)
                    .innerHTML = this.getItemStyle0(identifier, lineColor);
            },
            ['beforeMount.items.$_.expanded']: (evt) => {
                const { parentObject: { ["@key"]: identifier }, newValue } = evt;
                
                this.getExpandButton(identifier)
                    .getButton()
                    .setAttribute("aria-expanded", !newValue);
            }
        }
    }

    async addContextMenu(identifier, actions) {
        const contextMenus = this.contextMenus || (this.contextMenus = {});

        const contextMenu = new components.ContextMenu({
            input: {
                menu: actions,
                clickType: 'left',
                useTargetPosition: true,
            }
        });

        await contextMenu.load();

        contextMenu.addNode(
            this.getActionsTriggerButton(identifier).getButton()
        );

        contextMenus[identifier] = contextMenu;
    }

    async itemHook({ node, blockData, initial }) {
        const identifier = node.querySelector(':scope > li').getAttribute('identifier');

        const { items } = this.getInput();

        const item = items[identifier];

        if (item.actions) {
            await this.addContextMenu(identifier, item.actions);
        }

        const expandBtn = this.getExpandButton(identifier);

        expandBtn.on('click', () => {
            item.expanded = !item.expanded;
        });
        expandBtn.getButton().setAttribute("aria-controls", this.getArticle(identifier).id);
    }

    getArticle(identifier) {
        return this.node.querySelector(`#${this.getElementId()} li${identifier ? `[identifier='${identifier}']` : ''} > div.slds-timeline__item_expandable .slds-media > .slds-media__body > article`);
    }

    getExpandButton(identifier) {
        return this.getInlineComponent(`${identifier}-expand-button`);
    }

    getActionsTriggerButton(identifier) {
        return this.getInlineComponent(`${identifier}-actions-trigger-button`);
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