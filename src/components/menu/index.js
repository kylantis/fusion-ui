
class Menu extends components.OverlayComponent {

    static #defaultSubMenuX = 'right';

    static #iconMarkupCache = {};

    #identifiers = [];

    #items = {};
    #selectedItems = [];

    #renderingArea;

    beforeCompile() {
        this.getInput().overlay;

        // If group role is 'radio' or 'checkbox', this specifies the
        // direction that the check icon should be placed
        this.getInput().groups[0].checkIconX;

        // If group role is 'radio', this specifies whether the user must specify
        // at least one item. The way it works is: Once an item is the group is selected,
        // we don't allow that to be unselected unless there is a replacement
        this.getInput().groups[0].required;

        // This indicates the preferred x, y direction of submenus
        this.getInput().groups[0].items[0].subMenuX;
        this.getInput().groups[0].items[0].subMenuY;
    }

    useWeakRef() {
        return false;
    }

    eventHandlers() {
        return {
            ['remove.groups_$.items_$']: ({ value: item }) => {
                if (!item) return;

                const { identifier } = item;

                const index = this.#identifiers.indexOf(identifier);
                assert(index >= 0);

                this.#identifiers.splice(index, 1);

                this.#removeFromSelectedItems(identifier);
                delete this.#items[identifier];
            },
            ['splice.groups']: ({ offsetIndexes, newLength }) => {
                Object.values(this.#getItems())
                    .forEach(({ blockData, group }) => {
                        const entry = blockData['groups'];

                        assert(entry.index == group.index);

                        const j = offsetIndexes[entry.index];

                        if (j !== undefined) {
                            entry.index = j;
                            group.index = j;
                        }

                        entry.length = newLength;
                    });
            },
            ['splice.groups_$.items']: ({ parentObject, offsetIndexes, newLength }) => {
                const { indexProperty, parentRefProperty } = BaseComponent.CONSTANTS;

                const group = parentObject[parentRefProperty];
                const groupIndex = group[indexProperty];

                Object.values(this.#getItems())
                    .filter(({ group: { index } }) => index == groupIndex)
                    .forEach(({ blockData }) => {
                        const entry = blockData['groups_$__items'];
                        const j = offsetIndexes[entry.index];

                        if (j !== undefined) {
                            entry.index = j;
                        }

                        entry.length = newLength;
                    });
            },
            ['insert.groups_$.items_$.subMenu']: ({ parentObject: { identifier }, primary }) => {
                if (!primary) {
                    // renderSubMenu(...) will be called in itemHook(...)
                }
                this.renderSubMenu(identifier);
            },
            ['remove.groups_$.items_$.subMenu']: ({ parentObject: { identifier }, primary }) => {
                if (!primary) {
                    // item_$ is about to be pruned, so no need to do anything else
                }
                this.removeSubMenu(identifier);
            },
            ['insert.groups_$.items_$.feedbackState']: ({ parentObject: { identifier }, primary }) => {
                if (!primary) {
                    // itemHook(...) will make necessary DOM changes
                }

                const { leftIconContainer, rightIconContainer } = this.#getItems()[identifier];

                for (const { children } of [leftIconContainer, rightIconContainer]) {
                    if (this.#isDynamicIcon(children[0])) {

                        this.#reloadDynamicIcon(identifier);
                        break;
                    }
                }
            },
        }
    }

    isElementIdTransient() {
        return true;
    }

    beforeMount() {
        const { overlay, isSubMenu } = this.getInput();

        if (!isSubMenu && overlay) {
            const node = this.getNode();

            node.style.visibility = 'hidden';
            node.classList.add('overlay-menu');
        }
    }

    onMount() {
        const { overlay, isSubMenu } = this.getInput();

        if (!isSubMenu && overlay) {
            BaseComponent.on('bodyClick', () => {
                this.hideMenu();
            });
        }

        this.on('remove.groups_$.items_$', 'remove.groups_$.items_$');
        this.on('splice.groups', 'splice.groups');
        this.on('splice.groups_$.items', 'splice.groups_$.items');
        this.on('insert.groups_$.items_$.subMenu', 'insert.groups_$.items_$.subMenu');
        this.on('remove.groups_$.items_$.subMenu', 'remove.groups_$.items_$.subMenu');
        this.on('insert.groups_$.items_$.feedbackState', 'insert.groups_$.items_$.feedbackState');
    }

    immutablePaths() {
        return [
            'isSubMenu',
            'groups_$.role',
            'groups_$.checkIconX',
            'groups_$.required',
            'groups_$.items_$.identifier',
            'groups_$.items_$.subMenuX',
            'groups_$.items_$.subMenuY',
        ];
    }

    static itemClassName() {
        return 'slds-dropdown__item';
    }

    events() {
        return [
            'click', 'select', 'unselect', 'menuHide', 'menuShow'
        ];
    }

    behaviours() {
        return [
            'selectItem', 'unselectItem', 'renderSubMenu', 'removeSubMenu',
            'showMenu', 'hideMenu',
        ];
    }

    initializers() {
        return {
            ['size']: 'small',
            ['groups_$.role']: 'presentation',
            ['groups_$.checkIconX']: 'left',
            ['groups_$.items_$.identifier']: () => this.randomString(),
            ['groups_$.items_$.subMenuY']: 'bottom',
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
            ['groups_$.items_$.subMenuX']: () => Menu.#defaultSubMenuX,
        };
    }

    showMenu() {
        const { overlay, isSubMenu } = this.getInput();

        if (isSubMenu || !overlay) return;

        const node = this.getNode();

        if (!node.classList.contains('visible')) {
            node.style.visibility = 'visible';
            node.classList.add('visible');

            this.dispatchEvent('menuShow');
        }
    }

    hideMenu() {
        const { overlay, isSubMenu } = this.getInput();

        if (isSubMenu || !overlay) return;

        const node = this.getNode();

        if (node.classList.contains('visible')) {
            node.classList.remove('visible');

            const fn = () => {
                node.style.visibility = 'hidden';
                node.removeEventListener('transitionend', fn);
            };

            node.addEventListener('transitionend', fn);

            this.dispatchEvent('menuHide');
        }
    }

    #getItems() {
        return this.#items;
    }

    #getSelectedItems() {
        return this.#selectedItems;
    }

    #removeFromSelectedItems(identifier) {
        const selectedItems = this.#getSelectedItems();
        const idx = selectedItems.indexOf(identifier);

        if (idx >= 0) {
            selectedItems.splice(idx, 1);
        }
    }

    unselectItem(identifier, transitive = false) {

        const items = this.#getItems();
        const selectedItems = this.#getSelectedItems();

        const item = items[identifier];

        if (!item) {
            return;
        }

        const { group: { role, required } } = item;

        if (!item.isSelected) return;

        assert(selectedItems.includes(identifier));

        if (role == 'radio' && !transitive && required) {
            // We need to have at least one item
            return;
        }

        this.#loadItemIcon(identifier);

        item.isSelected = false;
        this.#removeFromSelectedItems(identifier);

        this.dispatchEvent('unselect', identifier)
    }

    async selectItem(identifier) {

        const items = this.#getItems();
        const selectedItems = this.#getSelectedItems();

        const item = items[identifier];

        if (!item) {
            return;
        }

        const {
            group: { role, checkIconX }, ref: { feedbackState },
            leftIconContainer, rightIconContainer, isSelected,
        } = item;

        if (!isSelected) {

            if (role == 'radio' && selectedItems.length) {
                // Only one item can be selected at a time, unselect the previous
                this.unselectItem(selectedItems[selectedItems.length - 1], true);
            }

            const markup = await this.#getCheckIconMarkup(feedbackState);

            ((checkIconX == 'left') ? leftIconContainer : rightIconContainer)
                .innerHTML = markup;

            item.isSelected = true;
            selectedItems.push(identifier);

            this.dispatchEvent('select', identifier);

        } else {
            this.unselectItem(identifier);
        }
    }

    #isDynamicIcon(element) {
        return element.hasAttribute('dynamicIcon');
    }

    async #getDynamicIconMarkup({ type, name, feedbackState }) {
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

        const node = icon.getNode();

        node.setAttribute('dynamicIcon', 'true');

        markup = node.outerHTML;

        icon.destroy();

        Menu.#iconMarkupCache[cacheId] = markup;

        return markup;
    }

    #parseHTMLString(htmlString) {
        const parser = new window.DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        return doc.body.firstChild;
    }

    removeSubMenu(identifier) {
        const item = this.#getItems()[identifier];

        if (!item) return;

        const { group: { role }, li } = item;

        if (role != 'presentation') return;

        const { children } = li;

        if (children.length != 2) {
            assert(children.length == 1);
            // Submenu is not on the DOM
            return;
        }

        // Remove submenu from DOM
        children[1].remove();

        if (item.subMenuX != item.ref.subMenuX) {
            item.subMenuX = item.ref.subMenuX;
        }

        this.#loadItemIcon(identifier);
    }

    async renderSubMenu(identifier) {

        const item = this.#getItems()[identifier];

        if (!item) return;

        const {
            group: { role }, blockData, ref: { subMenu, feedbackState },
            li, subMenuX, leftIconContainer, rightIconContainer,
        } = item;

        if (role != 'presentation') return;

        const { children } = li;

        if (children.length != 1) {
            assert(children.length == 2);
            // Submenu is already on the DOM
            return;
        }

        let wrapper;

        const futures = await this.renderDecorator('submenu', (htmlString) => {
            wrapper = this.#parseHTMLString(htmlString);
            li.appendChild(wrapper);
        }, blockData);

        await Promise.all(futures);

        const [node] = wrapper.children;

        const dropdown = node.querySelector('.slds-dropdown');

        dropdown.setAttribute('__component', subMenu.getId());

        if (!dropdown.id) {
            dropdown.id = subMenu.getId();
        }

        li.replaceChild(
            dropdown,
            wrapper,
        );

        // We have updated the root node of <subMenu>, hence we need to call <refreshNode>
        subMenu.refreshNode();

        assert(children.length == 2);

        // Add caret icon
        this.#getCaretIconMarkup(subMenuX, feedbackState)
            .then(markup => {
                ((subMenuX == 'left') ? leftIconContainer : rightIconContainer)
                    .innerHTML = markup;
            });
    }

    async #loadItemIcon(identifier) {
        const { group: { role, checkIconX }, subMenuX, blockData, leftIconContainer, rightIconContainer } = this.#getItems()[identifier];

        const x = (role == 'presentation') ? subMenuX : checkIconX;
        const container = (x == 'left') ? leftIconContainer : rightIconContainer;

        const futures = await this.renderDecorator(`${x}IconDecorator`, container, blockData);
        await Promise.all(futures);
    }

    async #reloadDynamicIcon(identifier) {
        const {
            group: { role, checkIconX }, ref: { feedbackState },
            subMenuX, leftIconContainer, rightIconContainer
        } = this.#getItems()[identifier];

        let markup;
        let x;

        if (role == 'presentation') {
            x = subMenuX;
            markup = await this.#getCaretIconMarkup(subMenuX, feedbackState);
        } else {
            x = checkIconX;
            markup = await this.#getCheckIconMarkup(feedbackState);
        }

        ((x == 'left') ? leftIconContainer : rightIconContainer).innerHTML = markup;
    }

    async itemHook({ node, blockData }) {

        const li = node.querySelector(':scope > li');
        const items = this.#getItems();

        const identifier = li.getAttribute('identifier');

        const { groups, overlay, isSubMenu } = this.getInput();

        if (overlay || isSubMenu) {
            li.setAttribute(this.getOverlayAttribute(), true);
        }

        const { index: groupIndex } = blockData['groups'];
        const { index: itemIndex } = blockData[`groups_$__items`];

        const group = groups[groupIndex];
        const groupItem = group.items[itemIndex];

        const { selected, subMenu, subMenuX, subMenuY, feedbackState } = groupItem;
        const { role, checkIconX, required } = group;

        items[identifier] = {
            group: { index: groupIndex, role, checkIconX, required },
            leftIconContainer: li.querySelector('.left-icon-container'),
            rightIconContainer: li.querySelector('.right-icon-container'),
            blockData, li, ref: groupItem, subMenuX, subMenuY,
        };

        if (role == 'presentation') {
            if (subMenu) {
                const { leftIconContainer, rightIconContainer } = items[identifier];

                // Add caret icon
                this.#getCaretIconMarkup(subMenuX, feedbackState)
                    .then(markup => {
                        ((subMenuX == 'left') ? leftIconContainer : rightIconContainer)
                            .innerHTML = markup;
                    });
            }
        } else if (selected) {
            this.selectItem(identifier);
        }

        this.#addMenuItemListeners(li);
    }

    #getCheckIconMarkup(feedbackState) {
        return this.#getDynamicIconMarkup({
            type: 'utility',
            name: `check`,
            feedbackState,
        });
    }

    #getCaretIconMarkup(x, feedbackState) {
        return this.#getDynamicIconMarkup({
            type: 'utility',
            name: `chevron${x}`,
            feedbackState,
        });
    }

    #addMenuItemListeners(li) {

        li.addEventListener('click', (evt) => {
            const li = evt.currentTarget;

            const items = this.#getItems();
            const identifier = li.getAttribute('identifier');

            const { group: { role }, ref: { subMenu } } = items[identifier];

            this.dispatchEvent('click', identifier)

            if (role != 'presentation') {
                // This item supports selection
                this.selectItem(identifier)
            } else if (subMenu) {
                if (this.isMobile()) {
                    this.#showSubmenu(li);
                }
            }
        });

        li.addEventListener('mouseenter', (evt) => {
            if (!this.isMobile()) {
                const { currentTarget: li } = evt;
                li.mouseover = true;

                this.#showSubmenu(li, () => li.mouseover);
            }
        });

        li.addEventListener('mouseleave', (evt) => {
            if (!this.isMobile()) {
                const { currentTarget: li } = evt;
                li.mouseover = false;

                this.#hideSubmenu(li);
            }
        });
    }

    #hideSubmenu(li) {
        const items = this.#getItems();

        const identifier = li.getAttribute('identifier');
        const item = items[identifier];

        const { ref: { subMenu } } = item;

        if (!subMenu) return;

        li.querySelector(':scope > a').removeAttribute('aria-expanded');
    }

    async #showSubmenu(li, predicate) {

        const identifier = li.getAttribute('identifier');

        const items = this.#getItems();
        const item = items[identifier];

        const {
            group: { role }, ref: { subMenu }, subMenuX,
        } = item;

        if (role != 'presentation' || !subMenu) return;

        // Render submenu, if not already rendered
        await this.renderSubMenu(identifier);

        const position = await this.#setSubMenuPosition(li);
        const { x, y } = this.#getPositionXY(position);

        if (x != subMenuX) {
            item.subMenuX = x;
            item.subMenuY = y;
        }

        if (predicate()) {
            // Display submenu
            li.querySelector(':scope > a').setAttribute('aria-expanded', true);
        }
    }

    isVisible() {
        const { overlay, isSubMenu } = this.getInput();

        switch (true) {
            case isSubMenu: return false;
            case !overlay: return true;
            default:
                const { classList } = this.getNode();
                return classList.contains('visible');
        }
    }

    isPointerBased() {
        return true;
    }

    getSupportedPositions() {
        return ["bottom-right", "bottom-left", "top-right", "top-left"];
    }

    getRequiredArea() {
        return this.getRenderingArea();
    }

    getRenderingArea() {
        if (this.#renderingArea) return this.#renderingArea;

        return {
            horizontal: Menu.#getMenuWidth(this),
            vertical: Menu.#getMenuHeight(this),
        }
    }

    #setRenderingArea(area) {
        this.#renderingArea = area;
    }

    #setSubMenuPosition(li) {
        const items = this.#getItems();

        const identifier = li.getAttribute('identifier');
        const { subMenuX, subMenuY, ref: { subMenu } } = items[identifier];

        const positions = [`${subMenuY}-${subMenuX}`];

        this.getSupportedPositions().forEach(p => {
            if (positions[0] != p) positions.push(p);
        });

        let { left: x, top: y, width, height } = li.getBoundingClientRect();

        this.#setRenderingArea(
            subMenu.getRenderingArea()
        );

        for (let i = 0; i < positions.length; i++) {
            const pos = positions[i];

            switch (pos) {
                case 'top-left':
                    y += height;
                    break;

                case 'top-right':
                    x += width;
                    y += height;
                    break;

                case 'bottom-left':
                    break;

                case 'bottom-right':
                    x += width;
                    break;
            }

            const { position: ret } = this.getPosition(
                this.getBoundingClientRectOffset0({
                    width: 0, height: 0,
                    top: y,
                    bottom: y,
                    left: x,
                    right: x,
                }),
                [pos],
                i < positions.length - 1,
            ) || {};

            if (ret) {
                this.#setRenderingArea(null);

                const { x, y } = this.#getPositionXY(ret);
                const input = subMenu.getInput();

                input.y = y;

                return this.updateInputData(subMenu, input, 'x', x)
                    .then(() => ret);
            }
        }

        assert(false);
    }

    #getPositionXY(position) {
        const [y, x] = position.split('-');
        return { x, y };
    }

    ////////////    Methods for calculating the size of the menus  //////////////

    static #getFontSize() {
        const { getRootFontSize } = components.LightningComponent;

        // .slds-dropdown has a font-size of .75rem
        return getRootFontSize() * .75;
    }

    static #getItemWidthSizesInRem() {
        return {
            ['xx-small']: { min: 6, max: 20 },
            ['x-small']: { min: 12, max: 20 },
            ['small']: { min: 15, max: 20 },
            ['medium']: { min: 20, max: 20 },
            ['large']: { min: 25, max: 512 },
        }
    }

    static #getMenuItemIconWidth(item) {
        const { getIconSize } = components.Icon;

        let left = getIconSize({ marginLeft: 'small' }).width;
        let right = getIconSize({ marginRight: 'x-small' }).width;

        const { leftIcon, rightIcon, subMenu } = item;

        if (leftIcon) {
            const { size, marginLeft } = leftIcon.getInput();
            left += getIconSize({ size, marginLeft, marginRight: 'x-small' }).width;
        }

        if (rightIcon && !subMenu) {
            const { size, marginRight } = rightIcon.getInput();
            right += getIconSize({ size, marginRight, marginLeft: 'small' }).width;
        }

        return left + right;
    }

    static #getMenuItemIconHeight(item) {
        const { getIconSize } = components.Icon;

        let left = 0;
        let right = 0;

        const { leftIcon, rightIcon } = item;

        if (leftIcon) {
            const { size } = leftIcon.getInput();
            left += getIconSize({ size }).height;
        }

        if (rightIcon) {
            const { size } = rightIcon.getInput();
            right += getIconSize({ size }).height;
        }

        return (left > right) ? left : right;
    }

    static #getLineHeight(fontSize) {
        return 1.5 * fontSize;
    }

    static #getMenuItemHeight(item) {
        const { getRootFontSize } = components.LightningComponent;

        let height = 0;

        // .slds-dropdown__item>a has a vertical padding of 0.5rem
        const verticalPadding = (.5 * getRootFontSize()) * 2;

        height += verticalPadding

        const iconHeight = Menu.#getMenuItemIconHeight(item);

        const lineHeight = Menu.#getLineHeight(Menu.#getFontSize());

        height += (iconHeight > lineHeight) ? iconHeight : lineHeight;

        return height;
    }

    static #getEstimatedTextWidth(text, fontSize) {
        const factor = 0.55;

        // add a margin of error = 4
        return (text.length * fontSize * factor) + 4;
    }

    static #getMenuItemWidth(item, menuSize) {

        const { getRootFontSize } = components.LightningComponent;
        const { getIconSize } = components.Icon;

        const rootFontSize = getRootFontSize();

        const { title, subMenu } = item;

        // .slds-dropdown__item>a has a horizontal padding of .75rem
        const horizontalPadding = (.75 * rootFontSize) * 2;

        const iconWidth = Menu.#getMenuItemIconWidth(item);

        const textWidth = Menu.#getEstimatedTextWidth(title, Menu.#getFontSize());

        let width = horizontalPadding + iconWidth + textWidth;


        if (subMenu) {
            // add width of caret icon
            // note: container margins have been added in #getMenuItemIconWidth(...) above.
            // size is 'xx-small' as defined in #getIconMarkup(...)

            const caretIconWidth = getIconSize({ size: 'xx-small' }).width * 2;
            width += caretIconWidth;
        }

        const { min, max } = Menu.#getItemWidthSizesInRem()[menuSize];

        const minWidth = min * rootFontSize;
        const maxWidth = max * rootFontSize;

        return (width < minWidth) ? minWidth : (width > maxWidth) ? maxWidth : width;
    }

    static #getMenuHeight(menu) {
        const { getRootFontSize } = components.LightningComponent;

        const rootFontSize = getRootFontSize();

        let ret = 0;

        const margin = 2 * 2;
        const border = 1 * 2;
        const padding = 4 * 2;

        ret += margin + border + padding;

        const { groups = [] } = menu.getInput();

        groups.forEach(({ title, items = [] } = {}) => {
            if (title) {
                // .slds-dropdown__header has a vertical padding of .5rem;
                ret += (.5 * rootFontSize) * 2;

                // .slds-dropdown__header has a font-size of .875rem;
                ret += Menu.#getLineHeight(rootFontSize * .875)
            }

            items.forEach(item => {
                if (item) {
                    ret += Menu.#getMenuItemHeight(item);
                };
            })
        });

        return ret;
    }

    static #getMenuWidth(menu) {
        const { getRootFontSize } = components.LightningComponent;

        const rootFontSize = getRootFontSize();

        // menus use a default size of 'small' as indicated in the 
        const { size = 'small', groups = [] } = menu.getInput();

        let ret = 0;

        groups.forEach(({ title, items = [] } = {}) => {
            if (title) {
                let textWidth = 0;

                // .slds-dropdown__header has a horizontal padding of .75rem;
                textWidth += (.75 * rootFontSize) * 2;

                // .slds-dropdown__header has a font-size of .875rem;
                textWidth += Menu.#getEstimatedTextWidth(title, rootFontSize * .875);

                if (textWidth > ret) {
                    ret = textWidth;
                }
            }
            items.forEach(item => {
                if (item) {
                    const width = Menu.#getMenuItemWidth(item, size);

                    if (width > ret) {
                        ret = width;
                    }
                };
            })
        });

        return ret;
    }

    ////////////    Methods for calculating the size of the menus   //////////////

}
module.exports = Menu;