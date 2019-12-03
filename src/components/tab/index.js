
class Tab extends BaseComponent {
    tagName() {
        return 'tab';
    }

    componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/menu.min.css', '/assets/css/tab.min.css', '/assets/css/transition.min.css', '/assets/css/custom-tab.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/tab.min.js', '/assets/js/transition.min.js']);
    }

    getComponentId() {
        return this.componentId;
    }

    render() {
        const { node } = this;
        const tabIds = [];

        const uiDiv = document.createElement('div');

        uiDiv.setAttribute('id', this.getComponentId());
        uiDiv.className = 'ui';
        if (this.data['@displayStyle'] === 'tabbed') {
            uiDiv.classList.add('pointing');
            uiDiv.classList.add('secondary');
        } else if (this.data['@displayStyle'] === 'pointingTab') {
            uiDiv.classList.add('pointing');
        } else if (this.data['@displayStyle'] === 'basic') {
            uiDiv.classList.add('attached');
            uiDiv.classList.add('tabular');
        }
        if (this.data['@position']) {
            uiDiv.classList.add(this.data['@position']);
        }
        if (this.data['@centered']) {
            uiDiv.classList.add('customCenter');
        }
        uiDiv.classList.add('menu');

        node.append(uiDiv);
        const childJson = this.data['>'];
        if (childJson.length) {
            childJson.forEach((children, i) => {
                const atag = document.createElement('a');
                atag.className = 'item';
                if (children['@titleSymbol']) {
                    const iTag = document.createElement('i');
                    iTag.className += `${children['@titleSymbol']} icon`;
                    atag.appendChild(iTag);
                }
                if (this.data['@displayFull']) {
                    atag.classList.add('fulltab');
                }
                atag.setAttribute('data-tab', children['@data-tab']);
                atag.append(children['@title']);
                if (i === 0) {
                    atag.classList.add('active');
                }
                uiDiv.append(atag);
            });
            childJson.forEach((children, i) => {
                if (children['>']) {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'ui bottom attached tab segment';
                    itemDiv.setAttribute('data-tab', children['@data-tab']);
                    if (i === 0) {
                        itemDiv.classList.add('active');
                    }

                    let componentData;
                    let componentTag;
                    for (const [key, value] of Object.entries(children['>'])) {
                        if (key === '@textContent') {
                            itemDiv.textContent = value;
                        }
                        if (key === '@componentData') {
                            componentData = value;
                        }
                        if (key === '@componentTag') {
                            componentTag = value;
                        }
                    }
                    if (componentData !== undefined && componentTag !== undefined) {
                        BaseComponent.getComponent(componentTag, componentData, itemDiv);
                    }
                    node.append(itemDiv);
                }
            });
        }
        tabIds.push(`#${this.getComponentId()}`);
        node.prepend(uiDiv);

        $('.menu .item').tab();
        this.isRendered(this.getComponentId());
    }
}
module.exports = Tab;
