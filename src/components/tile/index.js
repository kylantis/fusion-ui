
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

    render() {
        const { node } = this;

        const uiDiv = document.createElement('div');

        uiDiv.setAttribute('id', this.getComponentId());
        uiDiv.className = 'ui card';

        const aTag = this.appendNode(uiDiv, 'a', 'image');
        $(aTag).click(() => {
            this.data['@clientCallbacks']['@execute']();
        });
        const imgTag = this.appendNode(aTag, 'img');
        imgTag.src = this.data['@tileImage'];
        const contentDiv = this.appendNode(uiDiv, 'div', 'content');
        // eslint-disable-next-line no-unused-vars
        const iTag = this.appendNode(contentDiv, 'i', `${this.data['@headerIcon']} icon`);
        // eslint-disable-next-line no-unused-vars
        const aHeader = this.appendNode(contentDiv, 'a', 'header');
        $(aHeader).click(() => {
            this.data['@clientCallbacks']['@execute']();
        });
        aHeader.textContent = this.data['@tileHeader'];
        const metaDiv = this.appendNode(uiDiv, 'div', 'meta');
        // eslint-disable-next-line no-unused-vars
        const aMetaTag = this.appendNode(metaDiv, 'div');
        aMetaTag.textContent = this.data['@secondaryText'];

        node.append(uiDiv);
    }
}
module.exports = Tile;
