class Segment extends BaseComponent {
    tagName() {
        return 'segment';
    }

    componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/segment.min.css']);
    }

    getComponentId() {
        return this.componentId;
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
        if (this.data['@grouped']) {
            uiDiv.classList.add('segments');
        } else {
            uiDiv.classList.add('segment');
        }
        uiDiv.id = this.getComponentId();
        segmentId.push(`#${uiDiv.getAttribute('id')}`);
        node.append(uiDiv);
        this.isRendered(this.getComponentId());
    }
}

module.exports = Segment;
