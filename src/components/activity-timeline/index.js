class ActivityTimeline extends components.LightningComponent {

    initCompile() {
        // Load component class: ContextMenu at compile-time to indicate
        // that this component requires them
        components.ContextMenu;
    }

    beforeLoad(domRelayTimeout) {

        if (domRelayTimeout) {

            // When there's a domRelayTimeout, the user will see the skeletal markup
            // rendered on the screen for a while before the inner components load.
            // For ActivityTimeline, this view is not appealing at all, so we will hide until
            // components start laoding

            this.once(() => {
                this.node.style.visibility = 'hidden';
            }, 'templateRender');

            this.once(() => {
                this.node.style.removeProperty('visibility');
            }, 'resolve');
        }
    }

    hooks() {
        return {
            ['afterMount.items.$_.actions']: (evt) => {
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
            ['afterMount.items.$_']: (evt) => {
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
            ['afterMount.items.$_.lineColor']: (evt) => {
                const { newValue: lineColor, parentObject: { ["@key"]: identifier } } = evt;

                this.getStyleElement(identifier).innerHTML = lineColor ? this.getItemStyle0(identifier, lineColor) : '';
            },
            ['beforeMount.items.$_.expanded']: (evt) => {
                const { parentObject: { ["@key"]: identifier, expandable }, newValue } = evt;

                if (expandable) {
                    this.getExpandButton(identifier)
                        .getButton()
                        .setAttribute("aria-expanded", !newValue);
                }
            }
        }
    }

    hide() {
        super.hide();

        // Because of the high specifity of the rule ".slds-timeline__item_expandable.slds-is-open .slds-timeline__item_details"
        // we need to add the 'slds-hidden' class directly to the node

        this.setArticlesCssClass(true, 'slds-hidden')
    }

    show() {
        super.show();

        // Because of the high specifity of the rule ".slds-timeline__item_expandable.slds-is-open .slds-timeline__item_details"
        // we need to add the 'slds-hidden' class directly to the node

        this.setArticlesCssClass(false, 'slds-hidden')
    }

    setArticlesCssClass(predicate, cssClass) {
        const { items } = this.getInput();

        items.keys()
            .forEach(identifier => {
                const node = this.getArticle(identifier);

                if (predicate) {
                    node.classList.add(cssClass);
                } else {
                    node.classList.remove(cssClass);
                }
            });
    }

    async addContextMenu(identifier, actions) {
        const contextMenus = this.contextMenus || (this.contextMenus = {});

        const contextMenu = new components.ContextMenu({
            input: {
                menu: actions,
                clickType: 'left',
                useTargetPosition: true,
                positions: ['bottom-left', 'top-left']
            }
        });

        await contextMenu.load();

        contextMenu.addNode(
            this.getActionsTriggerButton(identifier).getButton()
        );

        contextMenus[identifier] = contextMenu;
    }

    getItemFromLi(node) {
        const identifier = node.querySelector(':scope > li').getAttribute('identifier');
        const { items } = this.getInput();

        return { identifier, item: items[identifier] }
    }

    setupExpandBtn({ node }) {
        const { identifier, item } = this.getItemFromLi(node);

        this.onceInlineComponentLoad(
            this.getExpandButtonRef(identifier),
            () => {
                const expandBtn = this.getExpandButton(identifier);

                expandBtn.on('click', () => {
                    item.expanded = !item.expanded;
                });

                expandBtn.on('load', () => {
                    expandBtn.getButton().setAttribute("aria-controls", this.getArticle(identifier).id);
                });
            }
        );
    }

    async setupContextMenu({ node }) {
        const { identifier, item } = this.getItemFromLi(node);

        if (item.actions) {
            await this.addContextMenu(identifier, item.actions);
        }
    }

    getTimelineItem(identifier) {
        return this.node.querySelector(`#${this.getElementId()} li${identifier ? `[identifier='${identifier}']` : ''} > div.slds-timeline__item_expandable`);
    }

    getArticle(identifier) {
        return this.getTimelineItem(identifier).querySelector('.slds-media > .slds-media__body > article');
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

    getStyleElement(identifier) {
        return this.node.querySelector(`.slds-timeline li style[identifier='${identifier}']`);
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