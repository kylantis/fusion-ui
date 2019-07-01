

class NavBar extends BaseComponent {
    tagName() {
        return 'navbar';
    }

    getCssDependencies() {
        const baseDependencies = super.getCssDependencies();
        baseDependencies.push('/assets/css/label.min.css', '/assets/css/menu.min.css', '/assets/css/dropdown.min.css', '/assets/css/navbar.min.css', '/assets/css/transition.min.css');
        return baseDependencies;
    }

    getJsDependencies() {
        const baseDependencies = super.getJsDependencies();
        baseDependencies.push('/assets/js/dropdown.min.js', '/components/navbar/custom.min.js', '/assets/js/transition.min.js');
        return baseDependencies;
    }

    render() {
        const { node } = this;
        const uiDiv = document.createElement('div');
        uiDiv.setAttribute('id', `${node.getAttribute('id')}-component`);
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
                    // Render external component
                    // Note: This is not fleshed out yet


                } else if (!item['>']) {
                    itemContainer = document.createElement('a');
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

                uiDiv.appendChild(itemContainer);
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
                const itemDiv = document.createElement('div');
                itemDiv.className = 'item';

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
