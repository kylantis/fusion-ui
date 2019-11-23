
class Tile extends BaseComponent {
    tagName() {
        return 'tile';
    }

    componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/card.min.css', '/assets/css/icon.min.css', '/assets/css/button.min.css', '/assets/css/custom-tile.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies();
    }

    getComponentId() {
        return this.componentId;
    }

    addButtons(parent) {
        const extraContent = document.createElement('div');
        extraContent.className = 'extra content';
        if (this.data['@buttons'].length > 1) {
            const buttondiv = this.appendNode(extraContent, 'div', 'ui two buttons');
            this.data['@buttons'].forEach((buttonEl) => {
                const button = this.appendNode(buttondiv, 'div', `ui ${buttonEl['@buttonDisplay']} ${buttonEl['@color']} button`);
                button.textContent = buttonEl['@buttonText'];
            });
            parent.append(extraContent);
            return;
        }
        if (this.data['@buttons'].length === 1) {
            this.data['@buttons'].forEach((buttonEl) => {
                const button = this.appendNode(extraContent, 'div', `ui ${buttonEl['@buttonDisplay']} ${buttonEl['@color']} button`);
                button.textContent = buttonEl['@buttonText'];
                if (buttonEl['@fluid']) {
                    button.classList.add('fluid');
                }
            });
            parent.append(extraContent);
        }
    }

    createTile(data) {
        const uiDiv = document.createElement('div');

        uiDiv.setAttribute('id', data['@id']);
        uiDiv.className = 'card';
        const number = this.data['@tilesPerRow'];
        if (number > 0) {
            let tileWidth = Math.round(window.innerWidth / number);
            tileWidth -= 50;
            uiDiv.style.width = `${tileWidth}px`;
        }
        const aTag = this.appendNode(uiDiv, 'a', 'image');
        $(aTag).click((e) => {
            e.preventDefault();
            // console.log(data['@clientCallbacks']['@execute']());
            console.log(data.clientCallbacks());
        });
        const imgTag = this.appendNode(aTag, 'img');
        imgTag.src = data['@tileImage'];
        const contentDiv = this.appendNode(uiDiv, 'div', 'content');
        // eslint-disable-next-line no-unused-vars
        const iTag = this.appendNode(contentDiv, 'i', `${data['@headerIcon']} icon`);
        // eslint-disable-next-line no-unused-vars
        const aHeader = this.appendNode(contentDiv, 'div', 'header');
        aHeader.textContent = data['@tileHeader'];
        const metaDiv = this.appendNode(uiDiv, 'div', 'meta');
        // eslint-disable-next-line no-unused-vars
        if (data['@secondaryText']) {
            const aMetaTag = this.appendNode(metaDiv, 'div');
            aMetaTag.textContent = data['@secondaryText'];
        }
        if (this.data['@buttons']) {
            this.addButtons(uiDiv);
        }
        return uiDiv;
    }

    createPillTile(data) {
        const uiDiv = document.createElement('div');

        uiDiv.setAttribute('id', data['@id']);
        uiDiv.className = 'pill card';
        const number = this.data['@tilesPerRow'];
        if (number > 0) {
            let tileWidth = Math.round(window.innerWidth / number);
            tileWidth -= 50;
            uiDiv.style.width = `${tileWidth}px`;
        }

        const contentDiv = this.appendNode(uiDiv, 'div', 'content');
        // eslint-disable-next-line no-unused-vars
        const iTag = this.appendNode(contentDiv, 'i', `${data['@headerIcon']} icon`);
        // eslint-disable-next-line no-unused-vars
        const aHeader = this.appendNode(contentDiv, 'div', 'header');
        aHeader.textContent = data['@tileHeader'];
        const metaDiv = this.appendNode(uiDiv, 'div', 'meta');
        // eslint-disable-next-line no-unused-vars
        if (data['@secondaryText']) {
            const aMetaTag = this.appendNode(metaDiv, 'div');
            aMetaTag.textContent = data['@secondaryText'];
        }
        $(uiDiv).click(() => {
            console.log(data.clientCallbacks());
            console.log('clicked');
        });
        if (this.data['@buttons']) {
            this.addButtons(uiDiv);
        }
        return uiDiv;
    }

    render() {
        const { node } = this;
        const cards = this.data['>'];
        const headerText = document.createElement('h4');
        headerText.className = 'ui header';
        headerText.textContent = this.data['@title'];
        node.append(headerText);
        const cardDiv = document.createElement('div');
        cardDiv.className = 'ui cards';
        cards.forEach((card) => {
            if (card['@tag'] === 'tile') {
                cardDiv.appendChild(this.createTile(card));
                node.append(cardDiv);
            }
            if (card['@tag'] === 'pill') {
                cardDiv.appendChild(this.createPillTile(card));
                node.append(cardDiv);
            }
        });
    }
}
module.exports = Tile;
