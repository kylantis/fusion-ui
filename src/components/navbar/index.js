

class NavBar extends BaseComponent {
    tagName() {
        return 'navbar';
    }

    componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/label.min.css', '/assets/css/dropdown.min.css', '/assets/css/navbar.min.css', '/assets/css/transition.min.css', '/assets/css/icon.min.css', '/assets/css/menu.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/dropdown.min.js', '/components/navbar/custom.min.js', '/assets/js/transition.min.js']);
    }

    getComponentId() {
        return this.componentId;
    }

    executeStuff() {
        console.log('stuff executing...');
    }

    render() {
        const { node } = this;
        const uiDiv = document.createElement('div');
        uiDiv.setAttribute('id', `${this.getComponentId()}`);
        uiDiv.className = 'ui';

        if (this.data['@orientation'] === 'vertical') {
            uiDiv.classList.add('vertical');
        }

        // Iterate groups

        const dropdownIds = [];

        for (const group of this.data['>']) {
            let isFirstNode = true;

            for (const item of group['>']) {
                let itemContainer;

                if (item['@tag'] !== 'item') {
                    const comp = BaseComponent.getComponent(item['@tag'], item['>'], uiDiv);
                    comp.then((data) => {
                        itemContainer = data;
                    });
                } else if (!item['>']) {
                    itemContainer = document.createElement('a');
                    if (item['@url']) {
                        itemContainer.href = item['@url'];
                    } else {
                        $(itemContainer).click(item['@onClickEvent']);
                    }
                    // Todo: Add logic to handling item action
                    itemContainer.className = 'item';

                    this.renderChildren(itemContainer, item);
                } else {
                    itemContainer = document.createElement('div');
                    itemContainer.className = 'ui pointing dropdown link item';

                    if (this.data['@orientation'] === 'vertical') {
                        itemContainer.classList.add('left');
                    }

                    // Generate unique dropdown id
                    const id = `${uiDiv.getAttribute('id')}-${this.getRandomInt()}`;
                    dropdownIds.push(`#${id}`);
                    itemContainer.setAttribute('id', id);

                    this.renderChildren(itemContainer, item, false);
                }

                if (this.data['@orientation'] === 'horizontal') {
                    // Todo: Based on horizontal orientation, set CSS alignment
                    switch (group['@position']) {
                    case 'left':
                    case 'right':
                        itemContainer.style.float = group['@position'];
                        console.log(itemContainer);
                        if (isFirstNode && group['@position'] === 'right') {
                            itemContainer.style.marginLeft = 'auto';
                        }
                        break;
                    case 'center':
                    default:

                        break;
                    }
                }

                if (isFirstNode) {
                    isFirstNode = false;
                }
                if (itemContainer !== undefined) {
                    uiDiv.append(itemContainer);
                }
            }
        }
        uiDiv.classList.add('menu');

        node.append(uiDiv);

        $(dropdownIds.join(','))
            .dropdown({
                on: 'hover',
                allowTab: false,
                action: 'nothing',
            });
    }

    renderChildren(parentNode, item, recursive) {
        if (!item['>'] || (!item['>'].length)) {
            parentNode.appendChild(document.createTextNode(item['@title']));

            // Create badge, if availble
            if (item['@badge']) {
                const badgeDiv = document.createElement('div');
                badgeDiv.innerHTML = item['@badge'];
                badgeDiv.className = 'ui teal left label';

                parentNode.appendChild(badgeDiv);
            } else if (item['@iconName']) {
                // eslint-disable-next-line no-unused-vars
                const iconTag = this.appendNode(parentNode, 'i', `icon ${item['@iconName']} ${item['@iconColor']}`);
            }
            return;
        }

        const titleSpan = document.createElement('span');
        titleSpan.innerHTML = item['@title'];
        titleSpan.className = 'text';

        const iTag = document.createElement('i');
        iTag.className = 'dropdown icon';

        if (!recursive) {
            // This is a direct navbar item
            parentNode.appendChild(titleSpan);
            parentNode.appendChild(iTag);
        } else {
            // This is a navbar subitem (at any given hierarchy)
            parentNode.appendChild(iTag);
            parentNode.appendChild(titleSpan);
        }

        const menuDiv = document.createElement('div');
        menuDiv.className = 'menu';

        let firstGroup = true;

        for (const group of this.getGroups(item['>']).entries()) {
            // Firs, render group name

            if (group[0]) {
                if (!firstGroup) {
                    // Add divider
                    const dividerDiv = document.createElement('div');
                    dividerDiv.className = 'divider';
                    menuDiv.appendChild(dividerDiv);
                }

                // Add group title
                const groupHeaderDiv = document.createElement('div');
                groupHeaderDiv.className = 'header';
                [groupHeaderDiv.innerHTML] = group;

                menuDiv.appendChild(groupHeaderDiv);
            }

            for (const subItem of group[1]) {
                const itemDiv = document.createElement('a');
                itemDiv.className = 'item';
                if (subItem['@url']) {
                    itemDiv.href = subItem['@url'];
                } else {
                    $(itemDiv).click(item['@onClickEvent']);
                }

                this.renderChildren(itemDiv, subItem, true);

                menuDiv.appendChild(itemDiv);
            }

            firstGroup = false;
        }

        parentNode.appendChild(menuDiv);
    }

    /**
   * This method returns a collection of groups
   * @param {Array{String}} itemsArray
   * @returns Map
   */
    getGroups(itemsArray) {
        const DEFAULT_GROUP = '';
        // First, we need to process itemArray into groups
        const groupNames = [...new Set(itemsArray.map(i => i['@groupName'] || DEFAULT_GROUP))];
        const groups = new Map();
        groupNames.forEach((name) => {
            groups.set(name, []);
        });

        itemsArray.forEach((subItem) => {
            groups.get(subItem['@groupName'] || DEFAULT_GROUP).push(subItem);
        });
        return groups;
    }
}
module.exports = NavBar;
