class Sidebar extends BaseComponent {
    tagName() {
        return 'sidebar';
    }

    componentId = this.getId();

    getComponentId() {
        return this.componentId;
    }

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/sidebar.min.css', '/assets/css/transition.min.css', '/assets/css/table.min.css', '/assets/css/image.min.css', '/assets/css/menu.min.css', '/assets/css/icon.min.css', '/assets/css/card.min.css', '/assets/css/tab.min.css', '/assets/css/custom-sidebar.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/sidebar.min.js', '/assets/js/tab.min.js', '/assets/js/transition.min.js']);
    }

    toggleSidebar() {
        if (this.data['@animation'] === 'overlay') {
            $('.demo.sidebar').sidebar('setting', 'transition', 'overlay').sidebar('toggle');
        } else if (this.data['@animation'] === 'push') { $('.demo.sidebar').sidebar('toggle'); }
        $('#tabbedProps .item').tab();
    }

    genItemSidebar(parent, data) {
        const aTag = document.createElement('a');
        aTag.classList.add('item');
        const text = data['@itemTitle'];
        if (data['@icon']) {
            parent.classList.add('icon');
            const iTag = document.createElement('i');
            iTag.className = `${data['@icon']} icon`;
            aTag.appendChild(iTag);
        }
        aTag.append(text);
        parent.appendChild(aTag);
    }

    // Find a way to keep track of loaded dependencies
    // Probably save them in a datastructure

    genProfileSideBar(parent, data) {
        parent.classList.remove('inverted');
        const uiDiv = document.createElement('div');
        uiDiv.className = 'ui ce-card card';
        const imageDiv = this.appendNode(uiDiv, 'div', 'image');
        const imgTag = this.appendNode(imageDiv, 'img', null);
        imgTag.src = data['@avatarUrl'];
        const contentDiv = this.appendNode(uiDiv, 'div', 'content details');
        const aTag = this.appendNode(contentDiv, 'div', 'header');
        aTag.textContent = data['@subjectName'];
        const metaDiv = this.appendNode(contentDiv, 'div', 'meta');
        const spanTag = this.appendNode(metaDiv, 'span', 'date');
        spanTag.textContent = data['@subjectDetail'];

        const emailUiDiv = document.createElement('div');
        emailUiDiv.className = 'ui card email';
        const emailContentDiv = this.appendNode(emailUiDiv, 'div', 'email content');
        const emailHeader = this.appendNode(emailContentDiv, 'div', 'header customHeader');
        emailHeader.textContent = 'Email address';
        const emailMetaDiv = this.appendNode(emailContentDiv, 'div', 'meta');
        // eslint-disable-next-line no-unused-vars
        const emailSpanTag = this.appendNode(emailMetaDiv, 'span', 'date');
        const emailDescDiv = this.appendNode(emailContentDiv, 'div', 'description');
        emailDescDiv.textContent = data['@subjectemail'];

        const bioContentDiv = this.appendNode(emailUiDiv, 'div', 'bio content');
        const bioHeader = this.appendNode(bioContentDiv, 'div', 'header customHeader');
        bioHeader.textContent = 'Bio';
        const BioMetaDiv = this.appendNode(bioContentDiv, 'div', 'meta');
        // eslint-disable-next-line no-unused-vars
        const bioSpanTag = this.appendNode(BioMetaDiv, 'span', 'date');
        const bioDescDiv = this.appendNode(bioContentDiv, 'div', 'description');
        bioDescDiv.textContent = data['@subjectBio'];
        parent.appendChild(uiDiv);
        parent.appendChild(emailUiDiv);
    }

    genProperties(parent, data) {
        parent.classList.remove('inverted');
        const contentDiv = document.createElement('div');
        contentDiv.className = 'content';
        const aTag = this.appendNode(contentDiv, 'h3', 'header');
        aTag.textContent = data['@title'];
        contentDiv.appendChild(aTag);
        const tabDiv = document.createElement('div');
        contentDiv.appendChild(tabDiv);
        tabDiv.id = 'tabbedProps';
        tabDiv.className = 'ui pointing secondary top menu';
        const detailTab = this.appendNode(tabDiv, 'a', 'detail item');
        detailTab.textContent = 'Detail';
        detailTab.setAttribute('data-tab', 'detail');
        const detailContent = document.createElement('div');
        detailContent.className = 'ui bottom attached tab segment';
        detailContent.setAttribute('data-tab', 'detail');
        const imgContent = this.appendNode(detailContent, 'img', 'ui image fluid');
        imgContent.src = data['@imageUrl'];
        const table = document.createElement('table');
        const tbody = document.createElement('tbody');
        table.appendChild(tbody);
        if (data['>'].length > 0) {
            table.className = 'ui unstackable very basic table';
            tbody.id = 'workingTableBody';
            let trBody;
            for (let i = 0; i < data['>'].length; i++) {
                const rowData = data['>'][i];
                if (rowData['@tag'] === 'prop') {
                    trBody = tbody.insertRow(-1);
                }
                for (const [key, value] of Object.entries(data['>'][i])) {
                    if (key === '@propName') {
                        const tableCell = trBody.insertCell(-1);
                        tableCell.innerHTML = value;
                        tableCell.className = 'right aligned four wide';
                    }
                    if (key === '@propValue') {
                        const tableCell = trBody.insertCell(-1);
                        tableCell.innerHTML = value;
                        tableCell.className = 'ten wide';
                    }
                }
            }
        }
        detailContent.append(table);

        const activityTab = this.appendNode(tabDiv, 'a', 'item');
        activityTab.textContent = 'Activity';
        activityTab.setAttribute('data-tab', 'activity');
        const activityContent = document.createElement('div');
        activityContent.className = 'ui bottom attached tab segment';
        activityContent.setAttribute('data-tab', 'activity');
        activityContent.textContent = 'noyasiudhkanvsdoiunfaosjdnonasdf';
        tabDiv.appendChild(detailTab);
        tabDiv.appendChild(activityTab);
        parent.appendChild(contentDiv);
        parent.appendChild(detailContent);
        parent.appendChild(activityContent);
    }

    render() {
        const { node } = this;
        const { data } = this;

        const uiDiv = document.createElement('div');
        uiDiv.className = 'ui demo inverted sidebar labeled';
        uiDiv.classList.add(data['@direction']);
        if (data['@orientation']) {
            uiDiv.classList.add(data['@orientation']);
        }
        if (data['@width']) {
            uiDiv.className += ` ${data['@width']}`;
        }
        if (data['>']) {
            data['>'].forEach((element) => {
                if (element['@tag'] === 'item') {
                    this.genItemSidebar(uiDiv, element);
                } else if (element['@tag'] === 'userProfile') {
                    this.genProfileSideBar(uiDiv, element);
                } else if (element['@tag'] === 'properties') {
                    this.genProperties(uiDiv, element);
                }
            });
        }
        setTimeout(() => {
            this.toggleSidebar();
        });
        uiDiv.classList.add('menu');

        node.append(uiDiv);
    }
}

module.exports = Sidebar;
