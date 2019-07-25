
class Tab extends BaseComponent {
    tagName() {
        return 'tab';
    }

    getCssDependencies() {
        const baseDependencies = super.getCssDependencies();
        baseDependencies.push('/assets/css/menu.min.css', '/assets/css/tab.min.css', '/assets/css/transition.min.css');
        return baseDependencies;
    }

    getJsDependencies() {
        const baseDependencies = super.getJsDependencies();
        baseDependencies.push('/assets/js/tab.min.js', '/assets/js/transition.min.js');
        return baseDependencies;
    }

    render() {
        const { node } = this;
        const tabIds = [];

        const uiDiv = document.createElement('div');
        let id;
        if (this.data['@id']) {
            id = this.data['@id'];
        } else {
            id = `${node.getAttribute('id')}-${this.getRandomInt()}`;
        }
        uiDiv.setAttribute('id', id);
        uiDiv.className = 'ui top';
        if (this.data['@displayStyle'] === 'tabbed') {
            uiDiv.classList.add('pointing');
            uiDiv.classList.add('secondary');
        } else if (this.data['@displayStyle'] === 'pointing tab') {
            uiDiv.classList.add('pointing');
        } else if (this.data['@displayStyle'] === 'basic') {
            uiDiv.classList.add('attached');
            uiDiv.classList.add('tabular');
        }
        node.append(uiDiv);
        const childJson = this.data['>'];
        if (childJson.length > 0) {
            childJson.forEach((children) => {
                const atag = document.createElement('a');
                atag.className = 'item';
                atag.setAttribute('data-tab', children['@data-tab']);
                atag.textContent = children['@title'];
                uiDiv.append(atag);
            });
            childJson.forEach((children) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'ui bottom attached tab segment';
                itemDiv.setAttribute('data-tab', children['@data-tab']);
                if (children['>']) {
                    for (const [key, value] of Object.entries(children['>'])) {
                        if (key === '@content') {
                            itemDiv.textContent = value;
                        }
                    }
                }
                node.append(itemDiv);
            });
        }
        tabIds.push(`#${id}`);
        uiDiv.classList.add('menu');
        node.prepend(uiDiv);

        $('.menu .item').tab();
    }
}
module.exports = Tab;
