class Feed extends BaseComponent {
    tagName() {
        return 'feed';
    }

    componentId = this.getId();

    #likeButton;

    idCounter = 0;

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/feed.min.css', '/assets/css/divider.min.css', '/assets/css/label.min.css', '/assets/css/icon.min.css', '/assets/css/custom-feed.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies();
    }

    behaviorNames() {
        return ['addNewsFeed', 'deleteFeed', 'updateTime'];
    }

    invokeBehavior(behavior, data) {
        const feed = document.getElementById(`${this.getComponentId()}`);
        switch (behavior) {
        case 'addFeed':
            this.feedGenerator(feed, data);
            return data;

        case 'deleteFeed': {
            const oneFeed = feed.querySelector(`#${data.id}`);
            if (oneFeed) {
                $(oneFeed).remove();
            }
            return oneFeed;
        }
        default:
            break;
        }
        return null;
    }

    addFeed(data) {
        this.invokeBehavior('addFeed', data);
    }

    deleteFeed(data) {
        this.invokeBehavior('deleteFeed', data);
    }

    getNumberOfLikes() {
        return this.#likeButton;
    }

    getComponentId() {
        return this.componentId;
    }

    // Modal

    modalData = {
        '@id': '',
        '@title': 'enlarge image',
        '@modalStyle': 'image',
        '@size': 'tiny',
        '@imageSrc': '',
        '@hasServerCallback': false,
    };

    loadModal(loc) {
        const imageModal = BaseComponent.getComponent('modal', this.modalData, loc);
        return imageModal;
    }

    // Modal End

    // User Profile Sidebar

    userProfileJsonData = {
        '@id': 'sidebarOne',
        '@title': 'Sidebar',
        '@orientation': 'vertical',
        '@direction': 'right',
        '@animation': 'overlay',
        '@width': 'wide',
        '>': [{
            '@tag': 'userProfile',
            '@itemTitle': 'Phone',
            '@avatarUrl': '/assets/images/tom.jpg',
            '@subjectName': 'Somebody Someone',
            '@subjectemail': 'somebody@example.com',
            '@subjectDetail': 'Group Managing Director',
            '@subjectBio': 'Employee of the month | Manager of the hour | Man of the year | Best Graduating Student from the University of IDK',
        }],
    }

    loadSidebar(loc) {
        const sidebar = BaseComponent.getComponent('sidebar', this.userProfileJsonData, loc);
        return sidebar;
    }

    // User Profile Sidebar End

    increaseLikes() {
        this.#likeButton += 1;
    }

    genActivityFeed(parent, data, id) {
        const eventDiv = document.createElement('div');
        eventDiv.className = 'event';
        eventDiv.id = `${this.getComponentId()}-feed-${id}`;
        const labelDiv = this.appendNode(eventDiv, 'div', 'label');
        const imgTag = this.appendNode(labelDiv, 'img');
        imgTag.src = data['@avatarImage'];
        const contentDiv = this.appendNode(eventDiv, 'div', 'content');
        const summaryDiv = this.appendNode(contentDiv, 'div', 'summary');
        const aTag = this.appendNode(summaryDiv, 'a', 'user');
        aTag.textContent = data['@userName'];
        summaryDiv.append(` ${data['@activity']}`);
        const dateDiv = this.appendNode(summaryDiv, 'div', 'date');
        dateDiv.textContent = data['@time'];
        /* eslint-disable no-unused-vars */
        const metaDiv = this.appendNode(contentDiv, 'div', 'meta');
        parent.appendChild(eventDiv);
    }

    genNewsFeed(parent, data, id) {
        const eventDiv = document.createElement('div');
        eventDiv.className = 'event';
        eventDiv.id = `${this.getComponentId()}-feed-${id}`;
        const labelDiv = this.appendNode(eventDiv, 'div', 'label');
        const imgTag = this.appendNode(labelDiv, 'img');
        imgTag.src = data['@avatarImage'];
        const contentDiv = this.appendNode(eventDiv, 'div', 'content');
        const summaryDiv = this.appendNode(contentDiv, 'div', 'summary');
        const aTag = this.appendNode(summaryDiv, 'a', 'user');
        aTag.textContent = data['@userName'];
        $(aTag).click(() => {
            this.loadSidebar(parent);
        });
        summaryDiv.append(` ${data['@activity']}`);
        const dateDiv = this.appendNode(summaryDiv, 'div', 'date');
        dateDiv.textContent = data['@time'];
        if (data['@statusText']) {
            const extraText = this.appendNode(contentDiv, 'div', 'extra text');
            extraText.textContent = data['@statusText'];
        }
        if (data['@statusImage'].length > 0) {
            const extraImage = this.appendNode(contentDiv, 'div', 'extra images');
            data['@statusImage'].forEach((element) => {
                const a = document.createElement('a');
                const img = document.createElement('img');
                img.src = element['@src'];
                img.width = '84';
                img.height = '70';
                a.appendChild(img);
                extraImage.append(a);
                $(a).on('click', () => {
                    this.modalData['@imageSrc'] = img.src;
                    this.modalData['@id'] = element['@id'];
                    this.loadModal().then((modalInfo) => {
                        const x = Object.getPrototypeOf(modalInfo);
                        x.openModal(this.modalData);
                    });
                });
            });
        }
        const metaDiv = this.appendNode(contentDiv, 'div', 'meta');
        const likeTag = this.appendNode(metaDiv, 'a', 'like likes');
        // eslint-disable-next-line no-unused-vars
        const likeIcon = this.appendNode(likeTag, 'i', 'like large icon');
        let likes;
        if (this.getNumberOfLikes() === 1) {
            likes = `${this.getNumberOfLikes()} like`;
        } else if (this.getNumberOfLikes() > 1) {
            likes = `${this.getNumberOfLikes()} like`;
        } else {
            likes = 'like';
        }
        likeTag.append(likes);
        $(likeTag).on('click', () => {
            likeTag.classList.toggle('active');
            this.increaseLikes();
        });
        parent.append(eventDiv);
    }

    feedGenerator(parent, data) {
        data.forEach((feed) => {
            this.idCounter += 1;
            if (feed['@tag'] === 'newsFeed') {
                this.genNewsFeed(parent, feed, this.counter);
            }
            if (feed['@tag'] === 'activityFeed') {
                this.genActivityFeed(parent, feed, this.counter);
            }
            const divider = this.appendNode(parent, 'div', 'ui divider');
        });
    }

    render() {
        const { node } = this;
        const { data } = this;
        const uiDiv = document.createElement('div');
        uiDiv.className = 'ui pushable feed';
        uiDiv.id = this.getComponentId();
        this.feedGenerator(uiDiv, data['>']);
        this.loadModal(node);
        node.append(uiDiv);
        this.isRendered(this.tagName());
    }
}

module.exports = Feed;
