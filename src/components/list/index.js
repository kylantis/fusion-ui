class List extends BaseComponent {
    tagName() {
        return 'list';
    }

    getCssDependencies() {
        if (this.data['@listStyle'] === 'tree view') {
            return super.getCssDependencies().concat(['/assets/css/list.min.css', '/assets/css/icon.min.css']);
        }
        return super.getCssDependencies().concat(['/assets/css/list.min.css', '/assets/css/icon.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies();
    }

    appendSiblingItem(parentId, item) {
        const parent = document.getElementById(parentId);
        const itemTag = this.appendNode(parent, 'li');
        itemTag.textContent = item;
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
        const { node } = this;
        const uiDiv = document.createElement('div');
        uiDiv.className = 'ui list';
        let id;
        if (this.data['@id']) {
            id = this.data['@id'];
        } else {
            id = `list-${this.getRandomInt()}`;
        }
        uiDiv.setAttribute('id', id);
        if (this.data['@animated']) {
            uiDiv.classList.add('animated');
        }
        if (this.data['@listType'] === 'unordered') {
            if (this.data['@icon'] !== 'bullet') {
                this.data['>'].forEach((element) => {
                    if (this.data['@listOrientation'] === 'horizontal') {
                        uiDiv.className += ' horizontal bulleted';
                        const a = document.createElement('a');
                        a.className = 'item';
                        a.textContent = element['@text'];
                        uiDiv.appendChild(a);
                    }
                    if (this.data['@listOrientation'] === 'vertical') {
                        const div = document.createElement('div');
                        div.className = 'item';
                        div.textContent = element['@text'];
                        uiDiv.appendChild(div);
                    }
                });
            }
            if (this.data['@icon'] === 'bullet') {
                const ul = document.createElement('ul');
                ul.id = id;
                ul.className = 'ui list';
                this.data['>'].forEach((element) => {
                    const li = document.createElement('li');
                    li.textContent = element['@text'];
                    if (element['>']) {
                        const ulEl = document.createElement('ul');
                        li.appendChild(ulEl);
                        this.traverse(element['>'], ulEl, 'li', 'ul');
                    }
                    ul.appendChild(li);
                    node.appendChild(ul);
                });
            }
            return;
        }
        if (this.data['@listType'] === 'ordered') {
            const ol = document.createElement('ol');
            ol.id = id;
            ol.className = 'ui list';
            this.data['>'].forEach((element) => {
                const li = document.createElement('li');
                li.textContent = element['@text'];
                if (element['>']) {
                    const olEl = document.createElement('ol');
                    li.appendChild(olEl);
                    this.traverse(element['>'], olEl, 'li', 'ol');
                }
                ol.appendChild(li);
                node.appendChild(ol);
            });
            return;
        }
        if (this.data['@listType'] === 'iconList') {
            this.data['>'].forEach((element) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'item';
                itemDiv.id = `${this.data['@id']}-${element['@id']}`;
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
        if (this.data['@listType'] === 'divided') {
            uiDiv.className += ' relaxed divided';
            this.data['>'].forEach((element) => {
                const itemDiv = document.createElement('div');
                const iconDiv = document.createElement('i');
                itemDiv.appendChild(iconDiv);
                itemDiv.className = 'item';
                itemDiv.id = `${this.data['@id']}-${element['@id']}`;
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
        if (this.data['@listType'] === 'tree view') {
            this.data['>'].forEach((element) => {
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
                if (element['>']) {
                    // const newITag = document.createElement('i');
                    // newITag.className = 'chevron right icon';
                    // itemDiv.prepend(newITag);
                    contentDiv.appendChild(this.traverseEl(element['>']));
                }
                uiDiv.appendChild(itemDiv);
            });
        }
        node.append(uiDiv);
    }
}

module.exports = List;
