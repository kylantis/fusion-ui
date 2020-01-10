class List extends BaseComponent {
    tagName() {
        return 'list';
    }

    componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/list.min.css', '/assets/css/icon.min.css', '/assets/css/image.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies();
    }

    getComponentId() {
        return this.componentId;
    }

    appendSiblingItem(parentId, item) {
        const parent = document.getElementById(parentId);
        const itemTag = this.appendNode(parent, 'li');
        itemTag.textContent = item;
    }

    prependSiblingItem() {

    }

    appendChildItem(parentId, item) {
        const parent = document.getElementById(parentId);
        let parentTag;
        if (parent.tagName === 'ul' || parent.parentElement.tagName === 'ul') {
            parentTag = document.createElement('ul');
        } else if (parent.tagName === 'ul' || parent.parentElement.tagName === 'ol') {
            parentTag = document.createElement('ol');
        }
        const itemTag = this.appendNode(parentTag, 'li');
        itemTag.textContent = item;
    }

    traverse(somedata, parent, parentEl, childEl) {
        somedata.forEach((element) => {
            const elem = document.createElement(parentEl);
            elem.textContent = element['@text'];
            parent.append(elem);
            if (element['>']) {
                const el = document.createElement(childEl);
                elem.appendChild(el);
                this.traverse(element['>'], el, parentEl, childEl);
            }
        });
    }

    traverseEl(el) {
        const list = document.createElement('div');
        list.className = 'list';
        el.forEach((element) => {
            const itemDiv = document.createElement('div');
            const iconDiv = document.createElement('i');
            itemDiv.appendChild(iconDiv);
            itemDiv.className = 'item';
            itemDiv.id = `${this.data['@id']}-${element['@id']}`;
            iconDiv.className = `${element['@icon']} icon`;
            const contentDiv = document.createElement('div');
            itemDiv.appendChild(contentDiv);
            contentDiv.className = 'content';
            const headerDiv = document.createElement('div');
            headerDiv.className = 'header';
            headerDiv.textContent = element['@text'];
            contentDiv.appendChild(headerDiv);
            const descDiv = document.createElement('div');
            descDiv.className = 'description';
            descDiv.textContent = element['@description'];
            contentDiv.appendChild(descDiv);
            list.appendChild(itemDiv);
            if (element['>']) {
                // const newITag = document.createElement('i');
                // newITag.className = 'chevron right icon';
                // itemDiv.prepend(newITag);
                contentDiv.appendChild(this.traverseEl(element['>']));
            }
        });
        return list;
    }

    render() {
        const { node, data } = this;
        const mainParent = document.createElement('kc-list');
        const uiDiv = document.createElement('div');
        uiDiv.className = 'ui list';
        uiDiv.setAttribute('id', this.getComponentId());
        if (data['@animated']) {
            uiDiv.classList.add('animated');
        }
        if (data['@listType'] === 'unordered') {
            if (data['@icon'] !== 'bullet') {
                data['>'].forEach((element) => {
                    if (data['@listOrientation'] === 'horizontal') {
                        uiDiv.className += ' horizontal bulleted';
                        const a = document.createElement('a');
                        a.className = 'item';
                        a.textContent = element['@text'];
                        uiDiv.appendChild(a);
                        mainParent.appendChild(uiDiv);
                        node.append(mainParent);
                        return;
                    }
                    if (data['@listOrientation'] === 'vertical') {
                        const div = document.createElement('div');
                        div.className = 'item';
                        div.textContent = element['@text'];
                        mainParent.appendChild(uiDiv);
                        node.append(mainParent);
                    }
                });
                this.isRendered(this.getComponentId());
                return;
            }
            if (data['@icon'] === 'bullet') {
                const ul = document.createElement('ul');
                ul.id = this.getComponentId();
                ul.className = 'ui list';
                data['>'].forEach((element) => {
                    const li = document.createElement('li');
                    li.textContent = element['@text'];
                    if (element['>']) {
                        const ulEl = document.createElement('ul');
                        li.appendChild(ulEl);
                        this.traverse(element['>'], ulEl, 'li', 'ul');
                    }
                    ul.appendChild(li);
                    mainParent.appendChild(ul);
                    node.appendChild(mainParent);
                });
            }
            this.isRendered(this.getComponentId());
            return;
        }
        if (data['@listType'] === 'ordered') {
            const ol = document.createElement('ol');
            ol.id = this.getComponentId();
            ol.className = 'ui list';
            data['>'].forEach((element) => {
                const li = document.createElement('li');
                li.textContent = element['@text'];
                if (element['>']) {
                    const olEl = document.createElement('ol');
                    li.appendChild(olEl);
                    this.traverse(element['>'], olEl, 'li', 'ol');
                }
                ol.appendChild(li);
                mainParent.appendChild(ol);
                node.appendChild(mainParent);
            });
            this.isRendered(this.getComponentId());
            return;
        }
        if (data['@listType'] === 'iconList') {
            data['>'].forEach((element) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'item';
                itemDiv.id = `${data['@id']}-${element['@id']}`;
                const iconDiv = document.createElement('i');
                iconDiv.className = `${element['@icon']} icon`;
                itemDiv.appendChild(iconDiv);
                const contentDiv = document.createElement('div');
                itemDiv.appendChild(contentDiv);
                contentDiv.className = 'content';
                contentDiv.textContent = element['@text'];
                uiDiv.appendChild(itemDiv);
            });
        }
        if (data['@listType'] === 'divided') {
            uiDiv.className += ' relaxed divided';
            data['>'].forEach((element) => {
                const itemDiv = document.createElement('div');
                const iconDiv = document.createElement('i');
                itemDiv.appendChild(iconDiv);
                itemDiv.className = 'item';
                itemDiv.id = `${data['@id']}-${element['@id']}`;
                iconDiv.className = `large ${element['@icon']} middle aligned icon`;
                const contentDiv = document.createElement('div');
                itemDiv.appendChild(contentDiv);
                contentDiv.className = 'content';
                const aTag = document.createElement('a');
                aTag.className = 'header';
                aTag.textContent = element['@text'];
                contentDiv.appendChild(aTag);
                const descDiv = document.createElement('div');
                descDiv.className = 'description';
                descDiv.textContent = element['@description'];
                contentDiv.appendChild(descDiv);
                uiDiv.appendChild(itemDiv);
            });
        }
        if (data['@listType'] === 'treeView') {
            data['>'].forEach((element) => {
                const itemDiv = document.createElement('div');
                const iconDiv = document.createElement('i');
                itemDiv.appendChild(iconDiv);
                itemDiv.className = 'item';
                itemDiv.id = `${data['@id']}-${element['@id']}`;
                iconDiv.className = `${element['@icon']} icon`;
                const contentDiv = document.createElement('div');
                itemDiv.appendChild(contentDiv);
                contentDiv.className = 'content';
                const headerDiv = document.createElement('div');
                headerDiv.className = 'header';
                headerDiv.textContent = element['@text'];
                contentDiv.appendChild(headerDiv);
                const descDiv = document.createElement('div');
                descDiv.className = 'description';
                descDiv.textContent = element['@description'];
                contentDiv.appendChild(descDiv);
                if (element['>']) {
                    contentDiv.appendChild(this.traverseEl(element['>']));
                }
                uiDiv.appendChild(itemDiv);
            });
        }
        if (data['@listType'] === 'imageList') {
            if (data['@celled']) {
                uiDiv.classList.add('celled');
            }
            data['>'].forEach((element) => {
                const itemDiv = this.appendNode(uiDiv, 'div', 'item');
                const imageTag = this.appendNode(itemDiv, 'img', 'ui avatar image');
                imageTag.src = element['@imageSrc'];
                const contentDiv = this.appendNode(itemDiv, 'div', 'content');
                const aHeader = this.appendNode(contentDiv, 'a', 'header');
                aHeader.textContent = element['@text'];
                if (element['@description']) {
                    const descDiv = this.appendNode(contentDiv, 'div', 'description');
                    descDiv.textContent = element['@description'];
                }
            });
        }
        mainParent.appendChild(uiDiv);
        node.append(mainParent);
        this.isRendered(this.getComponentId());
    }
}

module.exports = List;
