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

    getImage() {
        const srcOriginal = $(`#${this.data['@id']}`).rcrop('getDataURL');
        console.log(srcOriginal);
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
        imageTag.id = data['@id'];
        imageTag.src = data['@imgSrc'];
        const button = document.createElement('button');
        cropWrapper.appendChild(button);
        button.textContent = 'crop';
        $(button).click(() => {
            console.log('clicked');
            this.getImage();
        });
        node.append(imageWrapper);
        $(`#${data['@id']}`).rcrop({
            grid: true,
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
