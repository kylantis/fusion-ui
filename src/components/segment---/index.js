class Segment extends BaseComponent {
    tagName() {
        return 'segment';
    }

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/segment.min.css']);
    }

    render() {
        const { node } = this;
        const segmentId = [];
        const uiDiv = document.createElement('div');
        uiDiv.classList.add('ui');
        if (this.data['@circular']) {
            uiDiv.classList.add('circular');
        }
        if (this.data['@placeholder']) {
            uiDiv.classList.add('placeholder');
        }
        if (this.data['@raised']) {
            uiDiv.classList.add('raised');
        }
        if (this.data['@stacked']) {
            uiDiv.classList.add('stacked');
        }
        if (this.data['@piled']) {
            uiDiv.classList.add('piled');
        }
        if (this.data['@compact']) {
            uiDiv.classList.add('compact');
        }
        if (this.data['@orientation']) {
            uiDiv.classList.add(this.data['@orientation']);
        }
        if (this.data['@content']) {
            const contentDiv = document.createElement('div');
            contentDiv.append(this.data['@content']);
        }
        let id;
        if (this.data['@id']) {
            id = this.data['@id'];
        } else {
            id = `segment-${this.getRandomInt()}`;
        }
        segmentId.push(`#${id}`);
        if (this.data['@grouped']) {
            uiDiv.classList.add('segments');
        } else {
            uiDiv.classList.add('segment');
        }
        node.append(uiDiv);
    }
}

module.exports = Segment;
