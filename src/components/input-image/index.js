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

    getImage() {
        
    }

    validateImage() {

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
        this.required(inputDiv);

        const id = `image-${this.getRandomInt()}`;
        imageId.push(`#${id}`);
        uiDiv.setAttribute('id', id);
        node.append(uiDiv);
    }
}

module.exports = InputImage;
