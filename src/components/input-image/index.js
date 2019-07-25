class InputImage extends BaseComponent {
    tagName() {
        return 'inputImage';
    }

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/input.min.css']);
    }

    required(element) {
        if (this.data['@required']) {
            element.setAttribute('required', '');
            return true;
        }
        return false;
    }

    validateImage() {
        $('#submit', () => {
            const inputTag = this.node.getElementsByTagName('input');
            const input = inputTag[0];
            if (input.value === '') {
                console.log('no image found');
                return false;
            }
            console.log('file located');
            return true;
        });
    }

    render() {
        const { node } = this;
        const imageId = [];
        const uiDiv = document.createElement('div');
        const inputDiv = document.createElement('input');
        let id;
        if (this.data['@id']) {
            id = this.data['@id'];
        } else {
            id = `image-${this.getRandomInt()}`;
        }
        imageId.push(`#${id}`);
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
        uiDiv.setAttribute('id', id);
        node.append(uiDiv);
    }
}

module.exports = InputImage;
