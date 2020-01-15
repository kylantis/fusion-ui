class Viewer extends BaseComponent {
    tagName() {
        return 'viewer';
    }

    componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies();
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/viewer.min.js']);
    }

    getComponentId() {
        return this.componentId;
    }

    render() {
        const { node } = this;
        const mainParent = document.createElement('kc-pdfviewer');
        const imgTag = document.createElement('img');
        imgTag.src = this.data['@pdfSrc'];
        imgTag.href = this.data['@pdfSrc'];
        imgTag.id = 'viewerFile';
        imgTag.className = 'pdfFile';
        mainParent.appendChild(imgTag);
        node.append(mainParent);
        $('.pdfFile').EZView();
    }
}

module.exports = Viewer;
