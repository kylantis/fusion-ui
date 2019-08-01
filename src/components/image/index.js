class Image extends BaseComponent {
    tagName() {
        return 'image';
    }

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/image.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies();
    }

    rounded(el) {
        if (this.data['@rounded']) {
            el.classList.add('rounded');
        }
    }

    fluid(el) {
        if (this.data['@fluid']) {
            el.classList.add('fluid');
        }
    }

    disabled(el) {
        if (this.data['@disabled']) {
            el.classList.add('disabled');
        }
    }

    circular(el) {
        if (this.data['@circular']) {
            el.classList.add('circular');
        }
    }

    alignment(el) {
        if (this.data['@textAlignment'].length > 0) {
            el.classList.add(this.data['@textAlignment']);
            el.classList.add('aligned');
        }
    }

    alignText(el, parent) {
        if (this.data['@text'].length > 0) {
            const spanTag = document.createElement('span');
            spanTag.textContent = this.data['@text'];
            parent.appendChild(spanTag);
        }
    }

    float(el) {
        el.classList.add(this.data['@float']);
        el.classList.add('floated');
        el.classList.remove('middle', 'top', 'bottom', 'aligned');
    }

    render() {
        const { node } = this;
        let uiDiv;
        if (this.data['@type'] === 'imageLink') {
            uiDiv = document.createElement('a');
            uiDiv.classList.add('ui');
            uiDiv.href = this.data['@href'];
            const imgTag = document.createElement('img');
            imgTag.src = this.data['@src'];
            this.rounded(uiDiv);
            this.fluid(uiDiv);
            this.disabled(uiDiv);
            this.alignment(uiDiv);
            uiDiv.appendChild(imgTag);
        }
        if (this.data['@type'] === 'avatar') {
            uiDiv = document.createElement('img');
            uiDiv.classList.add('ui');
            uiDiv.classList.add('avatar');
            this.fluid(uiDiv);
            uiDiv.src = this.data['@src'];
            if (this.data['@avatarName']) {
                const spanTag = document.createElement('span');
                spanTag.textContent = this.data['@avatarName'];
                node.appendChild(spanTag);
            }
        }
        if (this.data['@type'] === 'bordered') {
            uiDiv = document.createElement('img');
            uiDiv.classList.add('ui');
            uiDiv.classList.add('bordered');
            this.rounded(uiDiv);
            this.fluid(uiDiv);
            this.disabled(uiDiv);
            this.alignment(uiDiv);
            uiDiv.src = this.data['@src'];
        }
        if (this.data['@type'] === 'image') {
            uiDiv = document.createElement('img');
            uiDiv.classList.add('ui');
            this.rounded(uiDiv);
            this.disabled(uiDiv);
            this.circular(uiDiv);
            if (!this.data['@float']) {
                this.alignment(uiDiv);
                this.alignText(uiDiv, node);
            } else {
                this.float(uiDiv);
            }
            uiDiv.src = this.data['@src'];
        }
        if (this.data['@type'] === 'svg') {
            uiDiv = document.createElement('div');
            uiDiv.classList.add('ui');
            uiDiv.classList.add('small');
            const svg = document.createElement('svg');
            svg.setAttribute('height', '150');
            svg.setAttribute('width', '150');
            uiDiv.append(svg);
            const img = document.createElement('img');
            img.setAttribute('xlink:href', this.data['@src']);
            img.setAttribute('x', 0);
            img.setAttribute('y', 0);
            svg.appendChild(img);
        }
        if (this.data['@width'] && this.data['@height']) {
            uiDiv.setAttribute('height', this.data['@height']);
            uiDiv.setAttribute('width', this.data['@width']);
        }
        if (this.data['@size']) {
            uiDiv.classList.add(this.data['@size']);
        }
        const imageId = [];
        let id;
        if (this.data['@id']) {
            id = this.data['@id'];
        } else {
            id = `${node.getAttribute('id')}-${this.getRandomInt()}`;
        }
        imageId.push(`#${id}`);
        uiDiv.classList.add('image');
        node.prepend(uiDiv);
    }
}

module.exports = Image;
