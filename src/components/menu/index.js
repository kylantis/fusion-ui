
class Menu extends components.LightningComponent {

    #identifiers = [];
    
    #items = {};
    #selectedItems = [];

    static #iconMarkupCache = {};

    beforeCompile() {
        this.getInput().overlay;

        // If group role is 'radio' or 'checkbox', this specifies the
        // direction that the check icon should be placed
        this.getInput().groups[0].checkIconPosition

        // If group role is 'radio', this specifies whether the user must specify
        // at least one item. The way it works is: Once an item is the group is selected,
        // we don't allow that to be unselected unless there is a replacement
        this.getInput().groups[0].required
    }

    onMount() {

        this.on('remove.groups_$.items_$', ({ value: item }) => {
            if (!item) return;

            const { identifier } = item;

            const index = this.#identifiers.indexOf(identifier);
            assert(index >= 0);

            this.#identifiers.splice(index, 1);


            this.#removeFromSelectedItems(identifier);
            delete this.#items[identifier];
        });
    }

    immutablePaths() {
        return ['groups_$.items_$.identifier'];
    }

    static itemClassName() {
        return 'slds-dropdown__item';
    }

    events() {
        return ['click', 'select', 'unselect'];
    }

    behaviours() {
        return ['selectItem', 'unselectItem', 'renderSubMenu'];
    }

    initializers() {
        return {
            ['groups_$.checkIconPosition']: 'left',
            ['groups_$.items_$.identifier']: () => this.randomString(),
            ['groups_$.items_$.subMenuX']: 'right',
            ['groups_$.items_$.leftMargin']: true,
            ['groups_$.items_$.rightMargin']: true,
        };
    }

    transformers() {
        return {
            ['groups_$.items_$.identifier']: (identifier) => {
                if (this.#identifiers.includes(identifier)) {
                    identifier = this.randomString();
                }
                this.#identifiers.push(identifier);

                return identifier;
            },
        };
    }

    getItems() {
        return this.#items;
    }

    getSelectedItems() {
        return this.#selectedItems;
    }

    #removeFromSelectedItems(identifier) {
        const selectedItems = this.getSelectedItems();
        const idx = selectedItems.indexOf(identifier);

        if (idx >= 0) {
            selectedItems.splice(idx, 1);
        }
    }

    unselectItem(identifier, transitive = false) {

        const items = this.getItems();
        const selectedItems = this.getSelectedItems();

        const item = items[identifier];

        if (!item) {
            return;
        }

        const {
            group: { role, checkIconPosition, required },
            checkIconContainer, leftIconContainer, leftIcon, rightIconContainer, rightIcon,
        } = item

        assert(item.isSelected && selectedItems.includes(identifier));

        if (role == 'radio' && !transitive && required) {
            // We need to have at least one item
            return;
        }

        checkIconContainer.innerHTML = '';

        switch (checkIconPosition) {
            case 'left':
                if (leftIcon) {
                    assert(checkIconContainer == leftIconContainer);
                    checkIconContainer.append(leftIcon);
                }
                break;
            case 'right':
                if (rightIcon) {
                    assert(checkIconContainer == rightIconContainer);
                    checkIconContainer.append(rightIcon);
                }
                break;
        }

        item.isSelected = false;
        this.#removeFromSelectedItems(identifier);

        this.dispatchEvent('unselect', identifier)
    }

    selectItem(identifier) {

        const items = this.getItems();
        const selectedItems = this.getSelectedItems();

        const item = items[identifier];

        if (!item) {
            return;
        }

        const { group: { role }, checkIconContainer, checkIconMarkup } = item;

        switch (true) {

            case !item.isSelected:

                if (role == 'radio' && selectedItems.length) {
                    // Only one item can be selected at a time, unselect the previous
                    this.unselectItem(selectedItems[selectedItems.length - 1], true);
                }

                checkIconContainer.innerHTML = checkIconMarkup;

                item.isSelected = true;
                selectedItems.push(identifier);

                this.dispatchEvent('select', identifier)

                break;

            case item.isSelected:
                this.unselectItem(identifier);
                break;
        }
    }

    async #getIconMarkup({ type, name, feedbackState }) {
        const input = {
            type,
            name,
            useCurrentColor: feedbackState && feedbackState == 'warning',
            size: 'xx-small',
        };

        const cacheId = `${type}-${name}-${feedbackState}`;

        let markup = Menu.#iconMarkupCache[cacheId];

        if (markup) {
            return markup;
        }

        const icon = new components.Icon({ input });

        await icon.load();

        markup = icon.getNode().outerHTML;

        icon.destroy();

        Menu.#iconMarkupCache[cacheId] = markup;

        return markup;
    }

    renderSubMenu(identifier) {
        const items = this.getItems();

        const item = items[identifier];

        if (!item) {
            return;
        }

        const { blockData, subMenu, li } = item;

        if (subMenu) {

            if (children.length == 1) {

                this.executeWithBlockData(() => {
                    this.renderDecorator('submenu-decorator', (htmlString) => {

                        const range = document.createRange();
                        const node = range.createContextualFragment(htmlString);

                        li.appendChild(
                            node.querySelector('.slds-dropdown')
                        );
                    });
                }, blockData);
            }

            assert(children.length == 2);

        } else {
            const { children } = li;

            if (children.length > 1) {
                // Remove submenu from DOM
                children[1].remove();
            }

            assert(children.length == 1);
        }
    }

    /**
     * Block Hook that processes new items added to this menu
     * @param {HTMLElement} node 
     */
    async itemHook({ node, blockData }) {

        const { pathSeparator } = BaseComponent.CONSTANTS;

        const li = node.querySelector(':scope > li');
        const items = this.getItems();

        const identifier = li.getAttribute('identifier');

        const { overlay, groups } = this.getInput();

        li.setAttribute(this.getOverlayAttribute(), !!overlay)

        const { index: groupIndex } = blockData['groups'];
        const { index: itemIndex } = blockData[`groups_$${pathSeparator}items`];

        const group = groups[groupIndex];
        const groupItem = group.items[itemIndex];

        let { selected, feedbackState, subMenu, subMenuX, leftIcon, rightIcon } = groupItem;

        let { role, checkIconPosition, required } = group;

        if (subMenu) {
            role = 'presentation';
        }

        const item = {
            group: { role, checkIconPosition, required },
            leftIconContainer: li.querySelector('.left-icon-container'),
            rightIconContainer: li.querySelector('.right-icon-container'),
            leftIcon: leftIcon ? leftIcon.getNode() : null,
            rightIcon: rightIcon ? rightIcon.getNode() : null,
            subMenu, blockData, li,
        }

        items[identifier] = item;

        switch (true) {
            case role != 'presentation':

                item.checkIconContainer = (checkIconPosition == 'left') ? item.leftIconContainer : item.rightIconContainer;

                item.checkIconMarkup = await this.#getIconMarkup({
                    type: 'utility',
                    name: 'check',
                    feedbackState,
                });

                if (selected) {
                    this.selectItem(identifier)
                }
                break;

            case !!subMenu:
                // Add the caret icon (either to the left or right),  replacing whatever icon exists

                ((subMenuX == 'left') ? item.leftIconContainer : item.rightIconContainer)
                    .innerHTML = await this.#getIconMarkup({
                        type: 'utility',
                        name: `chevron${subMenuX}`,
                        feedbackState,
                    });

                this.renderSubMenu(identifier);
                break;
        }

        if (!leftIcon) {
            groupItem.leftMargin = false;
        }

        if (!rightIcon) {
            groupItem.rightMargin = false;
        }

        const _this = this;

        li.addEventListener('click', function () {

            const identifier = this.getAttribute('identifier');
            const item = items[identifier];

            _this.dispatchEvent('click', identifier)

            if (item.checkIconContainer) {
                // This item supports selection
                _this.selectItem(identifier)
            }

            if (item.subMenu) {
                li.querySelector(':scope > a').setAttribute('aria-expanded', true);
            }
        });

        li.addEventListener('mouseenter', function () {

            const identifier = this.getAttribute('identifier');
            const item = items[identifier];

            if (item.subMenu) {
                li.querySelector(':scope > a').setAttribute('aria-expanded', true);
            }
        });

        li.addEventListener('mouseleave', function () {

            const identifier = this.getAttribute('identifier');
            const item = items[identifier];

            if (item.subMenu) {
                li.querySelector(':scope > a').removeAttribute('aria-expanded');
            }
        });

    }
}
module.exports = Menu;