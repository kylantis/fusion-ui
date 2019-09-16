
class Tile extends BaseComponent {
    tagName() {
        return 'tile';
    }

    #componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/card.min.css', '/assets/css/icon.min.css', '/assets/css/custom-card.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies();
    }

    getComponentId() {
        return this.#componentId;
    }

    createTile(data) {
        const uiDiv = document.createElement('div');

        uiDiv.setAttribute('id', data['@id']);
        uiDiv.className = 'card';

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
        return uiDiv;
    }

    createTilePill(data) {
        const uiDiv = document.createElement('div');

        uiDiv.setAttribute('id', data['@id']);
        uiDiv.className = 'pill card';

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
                cardDiv.appendChild(this.createTilePill(card));
                node.append(cardDiv);
            }
        });
    }
}
module.exports = Tile;
