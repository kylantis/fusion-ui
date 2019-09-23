class ImageCropper extends BaseComponent {
    tagName() {
        return 'imageCropper';
    }

    componentId = this.getId();

    getCssDependencies() {
        return (['/assets/css/imagecropper.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies().concat(['/assets/js/imagecropper.min.js']);
    }

    getComponentId() {
        return this.componentId;
    }

    render() {
        const { node } = this;
        const { data } = this;

        const imageWrapper = document.createElement('div');
        imageWrapper.className = 'image-wrapper';
        const cropWrapper = document.createElement('div');
        cropWrapper.className = 'rcrop-wrapper';
        imageWrapper.appendChild(cropWrapper);
        const imageTag = document.createElement('img');
        cropWrapper.appendChild(imageTag);
        imageTag.id = 'imageOne';
        imageTag.src = data['@imgSrc'];
        node.append(imageWrapper);
        $('#imageOne').rcrop({
            minSize: [200, 200],
            preserveAspectRatio: true,

            preview: {
                display: true,
                size: [100, 100],
            },
        });
    }
}

module.exports = ImageCropper;
