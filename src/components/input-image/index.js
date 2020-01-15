class InputImage extends BaseComponent {
    tagName() {
        return 'inputImage';
    }

    componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/input.min.css']);
    }

    getComponentId() {
        return this.componentId;
    }

    required(element) {
        if (this.data['@required']) {
            element.setAttribute('required', '');
            return true;
        }
        return false;
    }

    invokeBehavior(behavior, data) {
        switch (behavior) {
        case 'upload':
            // upload image to CDN
            break;
        default:
            break;
        }
    }

    validateImage() {
        const inputTag = this.node.getElementsByTagName('input');
        const input = inputTag[0];
        if (input.value === '') {
            console.log('no image found');
            return false;
        }
        if (this.validateImageSize(input)) {
            console.log('image size valid');
            return true;
        }
        return false;
    }

    validateImageSize(fileInput) {
        const file = Math.round(fileInput.files[0].size / 1024);
        if (file > this.data['@maxSize']) {
            this.loadErrorModal().then((data) => {
                const x = Object.getPrototypeOf(data);
                x.openModal(data.data);
            });
            // eslint-disable-next-line no-param-reassign
            fileInput.value = '';
            return false;
        }
        return true;
    }

    errorModalData = {
        '@id': 'inputImageModal',
        '@title': 'Image Upload Error',
        '@modalStyle': 'notification',
        '@size': 'mini',
        '@descriptionHeader': 'Image is too large',
        '@descriptionText': 'The image you uploaded is too large',
        '@imageSrc': '',
        '@modalIcon': 'archive',
        '@imageWidth': '50',
        '@imageHeight': '50',
        '@singleButtonText': 'Close',
        '@singleButtonColor': 'teal',
        '@hasServerCallback': false,
    };

    loadErrorModal(loc) {
        const confirmBox = BaseComponent.getComponent('modal', this.errorModalData, loc);
        return confirmBox;
    }

    render() {
        const { node } = this;
        const imageId = [];
        const mainParent = document.createElement('kc-input');
        const uiDiv = document.createElement('div');
        const inputDiv = document.createElement('input');
        const cropperDiv = document.createElement('div');
        cropperDiv.className = 'cropElem';
        uiDiv.classList.add('ui');
        uiDiv.classList.add('input');
        uiDiv.append(inputDiv);
        inputDiv.setAttribute('type', 'file');
        inputDiv.id = 'inputEl';
        if (this.data['@acceptAll']) {
            inputDiv.setAttribute('accept', 'image/*');
        } else if (this.data['@pngOnly']) {
            inputDiv.setAttribute('accept', 'image/x-png');
        } else if (this.data['@jpegOnly']) {
            inputDiv.setAttribute('accept', 'image/jpeg');
        } else if (this.data['@gifOnly']) {
            inputDiv.setAttribute('accept', 'image/gif');
        }
        if (this.data['@multiple']) {
            inputDiv.setAttribute('multiple', true);
        }
        this.required(inputDiv);
        this.loadErrorModal(uiDiv);
        uiDiv.id = this.getComponentId();
        imageId.push(`#${uiDiv.getAttribute('id')}`);
        mainParent.appendChild(uiDiv);
        node.append(mainParent);
        $(inputDiv).on('change', () => {
            if (this.validateImage()) {
                if (this.data['@cropper']) {
                    node.append(cropperDiv);
                    const cropperData = {
                        '@id': 'imageCropperOne',
                        '@imgSrc': 'http://localhost:8080/assets/images/nan.jpg', // $(inputDiv).val()
                        '@modal': true,
                    };
                    BaseComponent.getComponent('imageCropper', cropperData, cropperDiv);
                } else {
                    console.log('image uploaded');
                }
            }
        });
        this.isRendered(this.getComponentId());
    }
}

module.exports = InputImage;
