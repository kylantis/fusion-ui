/* eslint-disable no-unused-vars */
class Feed extends BaseComponent {
    tagName() {
        return 'feed';
    }

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
        console.log(this.#likeButton);
        return this.#likeButton;
    }

    increaseLikes() {
        this.#likeButton += 1;
    }

    render() {
        const { node } = this;
        const feedId = [];
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
            if (this.data['@statusImage']) {
                const extraImage = this.appendNode(contentDiv, 'div', 'extra image');
                extraImage.append = this.data['@statusImage'].forEach((element) => {
                    const a = document.createElement('a');
                    const img = document.createElement('img');
                    img.src = element['@src'];
                    a.appendChild(img);
                });
            }
            const metaDiv = this.appendNode(contentDiv, 'div', 'meta');
            const likeTag = this.appendNode(metaDiv, 'a', 'like likes');
            // eslint-disable-next-line no-unused-vars
            const likeIcon = this.appendNode(likeTag, 'i', 'like large icon');
            const likes = `${this.getNumberOfLikes()} likes`;
            likeTag.append(likes);
            $(likeTag).on('click', () => {
                likeTag.classList.toggle('active');
                this.increaseLikes();
            });
        }
        let id;
        if (this.data['@id']) {
            id = this.data['@id'];
        } else {
            id = `feed-${this.getRandomInt()}`;
        }
        feedId.push(`#${id}`);
        node.append(uiDiv);
    }
}

module.exports = Feed;
