class Label extends BaseComponent {
    tagName() {
        return 'label';
    }

    componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/label.min.css', '/assets/css/icon.min.css']);
    }

    getComponentId() {
        return this.componentId;
    }

    imageData() {
        const jsonData = {
            '@id': 'imageOne',
            '@title': '',
            '@type': 'avatar',
            '@avatarName': '',
            '@circular': false,
            '@fluid': false,
            '@float': 'left',
            '@rounded': false,
            '@textAlignment': 'middle',
            '@titleText': 'Username',
            '@text': 'Alignment Of Text',
            '@href': 'https://google.com',
            '@src': '/assets/images/kiwi.svg',
            '@disabled': false,
            '@size': '',
            '@width': '150',
            '@height': '150',
        };
        return jsonData;
    }

    render() {
        const { node } = this;
        let uiDiv;
        if (this.data['@labelType'] === 'horizontal') {
            uiDiv = document.createElement('a');
            uiDiv.className = 'ui';
            if (this.data['@color']) {
                uiDiv.classList.add(this.data['@color']);
            }
            uiDiv.textContent = this.data['@text'];
        }
        if (this.data['@labelType'] === 'tag') {
            uiDiv = document.createElement('a');
            uiDiv.className = 'ui tag';
            uiDiv.classList.add(this.data['@color']);
            uiDiv.textContent = this.data['@text'];
        }
        if (this.data['@labelType'] === 'pointing') {
            uiDiv = document.createElement('div');
            uiDiv.classList.add('ui');
            if (this.data['@pointingDirection'] === 'left' || this.data['@pointingDirection'] === 'right') {
                uiDiv.classList.add(this.data['@pointingDirection']);
                uiDiv.classList.add('pointing');
            }
            if (this.data['@pointingDirection'] === 'below' || this.data['@pointingDirection'] === 'upward') {
                uiDiv.classList.add('pointing');
                uiDiv.classList.add(this.data['@pointingDirection']);
            }
            uiDiv.textContent = this.data['@text'];
        }
        if (this.data['@labelType'] === 'corner') {
            uiDiv = document.createElement('a');
            uiDiv.classList.add('ui');
            uiDiv.classList.add(this.data['@labelPosition']);
            uiDiv.classList.add('corner');
            if (this.data['@icon']) {
                const icon = document.createElement('i');
                icon.classList.add(this.data['@icon']);
                icon.classList.add('icon');
                uiDiv.appendChild(icon);
            }
        }
        if (this.data['@labelType'] === 'ribbon') {
            uiDiv = document.createElement('a');
            uiDiv.classList.add('ui');
            uiDiv.classList.add(this.data['@color']);
            uiDiv.classList.add(this.data['@labelPosition']);
            uiDiv.classList.add('ribbon');
            if (this.data['@icon']) {
                const icon = document.createElement('i');
                icon.classList.add(this.data['@icon']);
                icon.classList.add('icon');
                uiDiv.appendChild(icon);
            }
            uiDiv.append(this.data['@text']);
        }
        if (this.data['@labelType'] === 'floating') {
            uiDiv = document.createElement('div');
            uiDiv.classList.add('ui');
            uiDiv.classList.add('floating');
            uiDiv.classList.add(this.data['@color']);
            uiDiv.textContent = this.data['@text'];
        }
        if (this.data['@labelType'] === 'imageLabel') {
            uiDiv = document.createElement('a');
            uiDiv.classList.add('ui');
            BaseComponent.getComponent('image', this.imageData(), uiDiv);
            uiDiv.classList.add(this.data['@color']);
            uiDiv.append(this.data['@text']);
        }

        uiDiv.id = this.getComponentId();
        uiDiv.classList.add('label');
        node.append(uiDiv);
        this.isRendered(this.getComponentId());
    }
}

module.exports = Label;
