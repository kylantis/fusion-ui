class FileUpload extends BaseComponent {
    tagName() {
        return 'fileUpload';
    }

    componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/dropzone.min.css', '/assets/css/basic-dropzone.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/dropzone.min.js']);
    }

    getComponentId() {
        return this.componentId;
    }

    render() {
        const { node } = this;
        const { data } = this;
        const mainParent = document.createElement('kc-file-upload');
        const form = document.createElement('form');
        mainParent.appendChild(form);
        form.id = data['@id'];
        form.className = 'dropzone';
        form.action = data['@action'];
        form.method = 'post';
        node.appendChild(mainParent);
        this.isRendered(this.getComponentId());
    }
}
module.exports = FileUpload;
