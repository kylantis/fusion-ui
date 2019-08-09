class InputImage extends BaseComponent {
    tagName() {
        return 'inputImage';
    }

    #componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/input.min.css']);
    }

    getComponentId() {
        return this.#componentId;
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
        $('#submit', () => {
            const inputTag = this.node.getElementsByTagName('input');
            const input = inputTag[0];
            if (input.value === '') {
                console.log('no image found');
                return;
            }
            if (this.validateImageSize(input)) {
                console.log('file located');
            }
        });
    }

    validateImageSize(file) {
        if (file.size > this.data['@maxSize']) {
            this.loadModal().then((data) => {
                const x = Object.getPrototypeOf(data);
                x.openModal();
            });
            this.value = '';
            return false;
        }
        return true;
    }

    modalData = {
        '@id': 'inputImageModal',
        '@title': 'Image Upload Error',
        '@modalStyle': 'notification',
        '@size': 'mini',
        '@descriptionHeader': 'Image is too large',
        '@descriptionText': 'Sorry, the image you uploaded is too large',
        '@imageSrc': '/assets/images/error-icon.jpg',
        '@modalIcon': 'archive',
        '@imageWidth': '70',
        '@imageHeight': '70',
        '@singleButtonText': 'Close',
        '@singleButtonColor': 'teal',
        '@hasServerCallback': false,
    };

    loadModal(loc) {
        const confirmBox = BaseComponent.getComponent('modal', this.modalData, loc);
        return confirmBox;
    }

    render() {
        const { node } = this;
        const imageId = [];
        const uiDiv = document.createElement('div');
        const inputDiv = document.createElement('input');

        uiDiv.classList.add('ui');
        uiDiv.classList.add('input');
        uiDiv.append(inputDiv);
        inputDiv.setAttribute('type', 'file');
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
        $('#submit').click(() => {
            this.validateImage();
        });
        this.required(inputDiv);
        this.loadModal(uiDiv);
        uiDiv.id = this.getComponentId();
        imageId.push(`#${uiDiv.getAttribute('id')}`);
        node.append(uiDiv);
    }
}

module.exports = InputImage;
