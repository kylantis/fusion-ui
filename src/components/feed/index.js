class Feed extends BaseComponent {
    tagName() {
        return 'feed';
    }

    #componentId = this.getId();

    #likeButton;

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/feed.min.css', '/assets/css/label.min.css', '/assets/css/icon.min.css', '/assets/css/custom-feed.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies();
    }

    behaviorNames() {
        return ['addNewFeed', 'deleteFeed', 'editFeed', 'updateTime'];
    }

    getNumberOfLikes() {
        return this.#likeButton;
    }

    getComponentId() {
        return this.#componentId;
    }

    // Modal

    modalData = {
        '@id': 'feedModal',
        '@title': 'enlarge image',
        '@modalStyle': 'image',
        '@imageSrc': '',
        '@hasServerCallback': true,
    };

    loadModal(loc) {
        const confirmBox = BaseComponent.getComponent('modal', this.modalData, loc);
        return confirmBox;
    }

    imageSrc(link) {
        this.modalData['@imageSrc'] = link;
    }

    // Modal End

    increaseLikes() {
        this.#likeButton += 1;
    }

    render() {
        const { node } = this;
        const uiDiv = document.createElement('div');
        uiDiv.className = 'ui feed';
        if (this.data['@feedStyle'] === 'activityFeed') {
            const eventDiv = this.appendNode(uiDiv, 'div', 'event');
            const labelDiv = this.appendNode(eventDiv, 'div', 'label');
            const imgTag = this.appendNode(labelDiv, 'img');
            imgTag.src = this.data['@avatarImage'];
            const contentDiv = this.appendNode(eventDiv, 'div', 'content');
            const summaryDiv = this.appendNode(contentDiv, 'div', 'summary');
            const aTag = this.appendNode(summaryDiv, 'a', 'user');
            aTag.textContent = this.data['@userName'];
            summaryDiv.append(` ${this.data['@activity']}`);
            const dateDiv = this.appendNode(summaryDiv, 'div', 'date');
            dateDiv.textContent = this.data['@time'];
            /* eslint-disable no-unused-vars */
            const metaDiv = this.appendNode(contentDiv, 'div', 'meta');
        }
        if (this.data['@feedStyle'] === 'newsFeed') {
            const eventDiv = this.appendNode(uiDiv, 'div', 'event');
            const labelDiv = this.appendNode(eventDiv, 'div', 'label');
            const imgTag = this.appendNode(labelDiv, 'img');
            imgTag.src = this.data['@avatarImage'];
            const contentDiv = this.appendNode(eventDiv, 'div', 'content');
            const summaryDiv = this.appendNode(contentDiv, 'div', 'summary');
            const aTag = this.appendNode(summaryDiv, 'a', 'user');
            aTag.textContent = this.data['@userName'];
            summaryDiv.append(` ${this.data['@activity']}`);
            const dateDiv = this.appendNode(summaryDiv, 'div', 'date');
            dateDiv.textContent = this.data['@time'];
            if (this.data['@statusText']) {
                const extraText = this.appendNode(contentDiv, 'div', 'extra text');
                extraText.textContent = this.data['@statusText'];
            }
            if (this.data['@statusImage'].length > 0) {
                const extraImage = this.appendNode(contentDiv, 'div', 'extra images');
                this.data['@statusImage'].forEach((element) => {
                    const a = document.createElement('a');
                    const img = document.createElement('img');
                    img.src = element['@src'];
                    img.width = '84';
                    img.height = '70';
                    a.appendChild(img);
                    extraImage.append(a);
                    $(a).on('click', () => {
                        this.imageSrc(element['@src']);
                        this.loadModal().then((data) => {
                            const x = Object.getPrototypeOf(data);
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
        }
        uiDiv.id = this.getComponentId();
        this.loadModal(uiDiv);
        node.append(uiDiv);
    }
}

module.exports = Feed;
