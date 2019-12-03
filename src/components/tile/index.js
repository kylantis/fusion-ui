
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

    invokeBehavior(behavior, data) {
        const id = this.getComponentId();
        switch (behavior) {
        case 'click':
            data.clientCallbacks.apply(this);
            this.triggerEvent('click', data, this.data);
            break;

        case 'addTile':
            this.appendTile(id, data);
            break;

        default:
            break;
        }
    }

    click(data) {
        this.invokeBehavior('click', data);
    }

    addTile(data) {
        this.invokeBehavior('addTile', data);
    }

    addButtons(parent) {
        const extraContent = document.createElement('div');
        extraContent.className = 'extra content';
        if (this.data['@buttons'].length > 1) {
            const buttondiv = this.appendNode(extraContent, 'div', 'ui two buttons');
            this.data['@buttons'].forEach((buttonEl) => {
                const button = this.appendNode(buttondiv, 'div', `ui ${buttonEl['@buttonDisplay']} ${buttonEl['@color']} button`);
                button.textContent = buttonEl['@buttonText'];
                button.addEventListener('click', () => { this.click(buttonEl); });
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
                button.addEventListener('click', () => { this.click(); });
            });
            parent.append(extraContent);
        }
    }

    createTile(data) {
        const uiDiv = document.createElement('div');

        uiDiv.setAttribute('id', data['@id']);
        uiDiv.className = 'card';
        const numCols = this.data['@tilesPerRow'];
        if (numCols > 0) {
            let tileWidth = Math.round(window.innerWidth / numCols);
            tileWidth -= 50;
            uiDiv.style.width = `${tileWidth}px`;
        }
        const aTag = this.appendNode(uiDiv, 'a', 'image');
        $(aTag).click((e) => {
            e.preventDefault();
            data.clientCallbacks();
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
        const numCols = this.data['@tilesPerRow'];
        if (numCols > 0) {
            let tileWidth = Math.round(window.innerWidth / numCols);
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
            data.clientCallbacks();
        });
        if (this.data['@buttons']) {
            this.addButtons(uiDiv);
        }
        return uiDiv;
    }

    generateTile(cards, node) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'ui cards';
        cardDiv.id = this.getComponentId();
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

    appendTile(node, appendData) {
        // eslint-disable-next-line no-param-reassign
        node = document.getElementById(node);
        appendData['>'].forEach((card) => {
            if (card['@tag'] === 'tile') {
                node.appendChild(this.createTile(card));
            }
            if (card['@tag'] === 'pill') {
                node.appendChild(this.createPillTile(card));
            }
        });
    }

    render() {
        const { node } = this;
        const cards = this.data['>'];
        const div = document.createElement('div');
        const headerText = document.createElement('h4');
        headerText.className = 'ui header';
        headerText.textContent = this.data['@title'];
        div.appendChild(headerText);
        node.append(div);
        this.generateTile(cards, div);
        this.isRendered(this.getComponentId());
    }
}
module.exports = Tile;
