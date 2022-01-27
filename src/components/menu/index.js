class Menu extends AbstractComponent {

    init() {
        // If group role is 'radio' or 'checkbox', this specifies the
        // direction that the check icon should be placed
        this.getInput().groups[0].checkIconPosition

        // If group role is 'radio', this specifies whether the user must specify
        // at least one item. The way it works is: Once an item is the group is selected,
        // we don't allow that to be unselected unless there is a replacement
        this.getInput().groups[0].required
    }

    static itemClassName() {
        return 'slds-dropdown__item';
    }

    events() {
        return [
            ...super.events(),
            'click', 'select', 'unselect'
        ]
    }

    getItems() {
        return this.items || (this.items = {})
    }

    getSelectedItems() {
        return this.selectedItems || (this.selectedItems = []);
    }

    unselectItem(identifier, transitive = false) {

        const items = this.getItems();
        const selectedItems = this.getSelectedItems();

        const item = items[identifier];
        const {
            checkIconContainer, leftIconContainer, leftIcon,
            rightIconContainer, rightIcon, group
        } = item

        assert(item.isSelected && selectedItems.includes(identifier));

        if (group.role == 'radio' && !transitive && group.required) {
            // We need to have at least one item
            return;
        }

        checkIconContainer.innerHTML = '';

        switch (group.checkIconPosition) {
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
        selectedItems.splice(selectedItems.indexOf(identifier), 1);

        this.dispatch('unselect', identifier)
    }

    selectItem(identifier) {

        const items = this.getItems();
        const selectedItems = this.getSelectedItems();

        const item = items[identifier];

        switch (true) {

            case !item.isSelected:

                if (item.group.role == 'radio' && selectedItems.length) {
                    // Only one item can be selected at a time, unselect the previous
                    this.unselectItem(selectedItems[selectedItems.length - 1], true);
                }

                item.checkIconContainer.innerHTML = item.checkIconMarkup

                item.isSelected = true;
                selectedItems.push(identifier);

                this.dispatch('select', identifier)

                break;

            case item.isSelected:
                this.unselectItem(identifier);
                break;
        }
    }

    async createIcon({ type, name, level, direction, container }) {
        const input = {
            type,
            name,
            useCurrentColor: level && level == 'warning',
        };

        if (direction == 'left') {
            input.marginRight = 'x-small';
        } else {
            input.marginLeft = 'small';
        }

        return await new components.Icon({
            input
        }).load({ container })
    }

    /**
     * Block Hook that processes new items added to this menu
     * @param {HTMLElement} node 
     */
    async itemTransform({ node, blockData }) {

        const { htmlWrapperCssClassname } = RootCtxRenderer
        const { pathSeparator } = RootProxy;

        const _this = this;
        const li = node.querySelector(':scope > li');

        const { index: groupIndex } = blockData['groups'];

        const { index: itemIndex } = blockData[`groups_$${pathSeparator}items`];

        const group = this.getInput()['groups'][groupIndex];
        let {
            selected: initiallySelected, level,
            subMenu, subMenuDirection
        } = group.items[itemIndex];

        let { role, checkIconPosition = 'left', required } = group;

        if (subMenu) {
            role = 'presentation';

            if (!subMenuDirection) {
                subMenuDirection = 'right'
            }
        }

        const items = this.getItems();

        const identifier = li.getAttribute('identifier');

        if (!identifier) {
            const msg = `[${this.getId()}] Empty item identifier`;
            throw Error(msg)
        }

        const item = {
            group: { role, checkIconPosition, required },
            leftIconContainer: li.querySelector(`a span .${htmlWrapperCssClassname}`),
            rightIconContainer: li.querySelector(`a > .${htmlWrapperCssClassname}`),
            hasSubMenu: !!subMenu
        }

        // Depending on checkIconPosition, if the leftIconContainer or rightIconContainer
        // is available, the contents will be overwritten by the check icon if the item
        // is selectable, hence we want to store the actual icon div element, which we can
        // then re-insert in the container if the item is unselected at a later time

        if (item.leftIconContainer) {
            item.leftIcon = item.leftIconContainer.querySelector(`div.${htmlWrapperCssClassname}`)
        }

        if (item.rightIconContainer) {
            item.rightIcon = item.rightIconContainer.querySelector(`div.${htmlWrapperCssClassname}`)
        }

        items[identifier] = item;

        const createContainerDiv = () => {
            const elem = document.createElement('div');
            elem.id = global.clientUtils.randomString();
            elem.className = htmlWrapperCssClassname;

            return elem;
        }

        if (role != 'presentation') {

            // Based on the checkIconPosition specified, select the appropriate icon container
            let checkIconContainer = checkIconPosition == 'left' ? item.leftIconContainer : item.rightIconContainer

            if (!checkIconContainer) {
                // This item does not have an icon, manually create an icon container
                // Note that: since this container is only  being created for the purpose
                // of adding selection support, we will only be creating a container either
                // on the left or right side, depending on the checkIconPosition setting

                checkIconContainer = createContainerDiv();

                if (checkIconPosition == 'left') {
                    li.querySelector('a span').prepend(checkIconContainer);
                } else {
                    li.querySelector('a').append(checkIconContainer);
                }
            }

            item.checkIconContainer = checkIconContainer;

            item.checkIconMarkup = await this.createIcon({
                type: 'utility',
                name: 'check',
                level,
                direction: checkIconPosition
            })

            if (initiallySelected) {
                this.selectItem(identifier)
            }
        } else if (subMenu) {

            // Add the caret icon (either to the left or right), 
            // replacing whatever icon exists

            const caretContainer = subMenuDirection == 'left' ? item.leftIconContainer : item.rightIconContainer

            if (!caretContainer) {
                caretContainer = createContainerDiv();

                if (subMenuDirection == 'left') {
                    li.querySelector('a span').prepend(caretContainer);
                } else {
                    li.querySelector('a').append(caretContainer);
                }
            }

            this.createIcon({
                type: 'utility',
                name: `chevron${subMenuDirection}`,
                level,
                direction: subMenuDirection,
                container: caretContainer.id
            })


            // Move the sub-menu directly into <li>
            const subMenuElement = li.querySelector('.slds-dropdown');

            li.removeChild(
                li.querySelector(':scope > :nth-child(2)')
            )

            li.append(subMenuElement);
        }

        li.addEventListener('click', function () {

            const identifier = this.getAttribute('identifier');
            const item = items[identifier];

            _this.dispatch('click', identifier)

            if (item.checkIconContainer) {
                // This item supports selection
                _this.selectItem(identifier)
            }

            if (item.hasSubMenu) {
                li.querySelector('a').setAttribute('aria-expanded', true);
            }
        });

        li.addEventListener('mouseenter', function () {

            const identifier = this.getAttribute('identifier');
            const item = items[identifier];

            if (item.hasSubMenu) {
                li.querySelector('a').setAttribute('aria-expanded', true);
            }
        });

        li.addEventListener('mouseleave', function () {

            const identifier = this.getAttribute('identifier');
            const item = items[identifier];

            if (item.hasSubMenu) {
                li.querySelector('a').removeAttribute('aria-expanded');
            }
        });

    }
}
module.exports = Menu;