class ImageCropper extends BaseComponent {
    tagName() {
        return 'imageCropper';
    }

    componentId = this.getId();

    getCssDependencies() {
        if (this.data['@modal']) {
            return super.getCssDependencies().concat(['/assets/css/modal.min.css', '/assets/css/dimmer.min.css', '/assets/css/transition.min.css', '/assets/css/button.min.css', '/assets/css/icon.min.css', '/assets/css/imagecropper.min.css', '/assets/css/custom-cropper.min.css']);
        }
        return (['/assets/css/imagecropper.min.css']);
    }

    getJsDependencies() {
        if (this.data['@modal']) {
            return super.getJsDependencies().concat(['/assets/js/modal.min.js', '/assets/js/dimmer.min.js', '/assets/js/transition.min.js', '/assets/js/imagecropper.min.js']);
        }
        return super.getJsDependencies().concat(['/assets/js/imagecropper.min.js']);
    }

    getComponentId() {
        return this.componentId;
    }

    getImage() {
        const srcOriginal = $(`#${this.data['@id']}`).rcrop('getDataURL');
        console.log(srcOriginal);
    }

    initializeCrop(id) {
        $(id).rcrop({
            inputs: true,
            grid: true,
            minSize: [200, 200],
            preserveAspectRatio: true,

            preview: {
                display: false,
                size: [100, 100],
            },
        });
        $(id).on('rcrop-ready', () => {
            $(id).rcrop('resize', 300, 300, 0, 0);
        });
    }

    invokeBehavior(behavior, data) {
        const originalImage = $('.ui.dimmer').children().first();
        switch (behavior) {
        case 'upload': {
            if ($('.ui.dimmer').children().first().is('img')) {
                this.triggerEvent('upload', { imagesrc: originalImage[0].currentSrc }, this.data);
            }
            break;
        }
        case 'cancel': {
            console.log('cancel clicked');
            break;
        }
        default:
            break;
        }
    }

    clickDone(approveButton, cancelButton) {
        const srcOriginal = $(`#${this.data['@id']}`).rcrop('getDataURL');
        const originalImage = $('.ui.dimmer').children().first();
        const img = document.createElement('img');
        img.setAttribute('style', 'transition: all 5s ease;');
        img.src = srcOriginal;
        originalImage.replaceWith(img);

        const uploadButton = document.createElement('div');
        uploadButton.className = 'ui positive right labeled icon button';
        uploadButton.textContent = 'Upload';
        // eslint-disable-next-line no-unused-vars
        const uploadButtonIcon = this.appendNode(uploadButton, 'i', 'checkmark icon');
        approveButton.replaceWith(uploadButton);
        uploadButton.addEventListener('click', () => this.clickUpload(), { once: true });
        const cancelCropButton = document.createElement('div');
        cancelCropButton.className = 'ui left labeled icon red deny button';
        cancelCropButton.textContent = 'Cancel';
        // eslint-disable-next-line no-unused-vars
        const cancelCropIcon = this.appendNode(cancelCropButton, 'i', 'close icon');
        cancelButton.replaceWith(cancelCropButton);
        cancelCropButton.addEventListener('click', () => this.clickCancel(), { once: true });
    }

    clickUpload() {
        this.invokeBehavior('upload');
    }

    clickCrop() {
        console.log('Crop Clicked');
    }

    clickCancel() {
        const currentImage = $('.ui.dimmer').children();
        $(currentImage).remove();
        this.render();
    }

    buttonTriggers(src) {
        const { data } = this;
        $(src).ready(() => {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'actions';
            const cropButton = document.createElement('div');
            cropButton.className = 'ui left labeled icon black deny button';
            cropButton.textContent = 'Crop';
            // eslint-disable-next-line no-unused-vars
            let cropButtonIcon = this.appendNode(cropButton, 'i', 'crop icon');
            const approveButton = document.createElement('div');
            approveButton.className = 'ui positive right labeled icon button';
            approveButton.textContent = 'Upload';
            src.appendChild(actionsDiv);
            actionsDiv.appendChild(cropButton);
            actionsDiv.appendChild(approveButton);
            // eslint-disable-next-line no-unused-vars
            let approveButtonIcon = this.appendNode(approveButton, 'i', 'checkmark icon');
            $('.ui.dimmer').append(actionsDiv);
            approveButton.addEventListener('click', () => this.clickUpload(), { once: true });
            cropButton.addEventListener('click', this.clickCrop, { once: true });
            $(cropButton).click(() => {
                if ($('.ui.dimmer').children().first().is('img') && cropButton.textContent === 'Crop') {
                    this.initializeCrop(`#${data['@id']}`);
                    cropButton.textContent = 'Cancel';
                    cropButtonIcon = this.appendNode(cropButton, 'i', 'cancel icon');
                    approveButton.className = 'ui positive right labeled icon button';
                    approveButton.textContent = 'Done';
                    approveButtonIcon = this.appendNode(approveButton, 'i', 'checkmark icon');
                    approveButton.addEventListener('click', () => this.clickDone(approveButton, cropButton), { once: true });
                } else {
                    $(`#${data['@id']}`).rcrop('destroy');
                    cropButton.className = 'ui left labeled icon black deny button';
                    cropButton.textContent = 'Crop';
                    cropButtonIcon = this.appendNode(cropButton, 'i', 'crop icon');
                    approveButton.className = 'ui positive right labeled icon button';
                    approveButton.textContent = 'Upload';
                    approveButtonIcon = this.appendNode(approveButton, 'i', 'checkmark icon');
                    cropButton.addEventListener('click', this.clickCrop, { once: true });
                    approveButton.addEventListener('click', () => this.clickUpload(), { once: true });
                }
            });
        });
    }

    render() {
        const { node } = this;
        const { data } = this;
        const uiDiv = document.createElement('div');
        const contentDiv = document.createElement('div');
        contentDiv.className = 'content';
        uiDiv.appendChild(contentDiv);
        uiDiv.className = 'ui modal';
        const imageWrapper = document.createElement('div');
        contentDiv.appendChild(imageWrapper);
        imageWrapper.className = 'image-wrapper';
        const cropWrapper = document.createElement('div');
        cropWrapper.className = 'rcrop-wrapper';
        imageWrapper.appendChild(cropWrapper);
        const imageTag = document.createElement('img');
        cropWrapper.appendChild(imageTag);
        imageTag.id = data['@id'];
        imageTag.src = data['@imgSrc'];
        imageTag.height = 500;
        imageTag.width = 500;
        const button = document.createElement('button');
        button.setAttribute('style', 'display:block;');
        imageWrapper.appendChild(button);
        button.textContent = 'crop';
        $(button).click(() => {
            console.log('clicked');
            this.getImage();
        });

        if (!data['@modal']) {
            node.append(imageWrapper);

            $(`#${data['@id']}`).rcrop({
                inputs: true,
                grid: true,
                minSize: [100, 100],
                preserveAspectRatio: true,

                preview: {
                    display: data['@displayPreview'],
                    size: [100, 100],
                },
            });
            return;
        }
        this.buttonTriggers(uiDiv);
        node.append(uiDiv);

        $(`#${data['@id']}`)
            .modal('setting', 'closable', false)
            .modal('show');
    }
}

module.exports = ImageCropper;
