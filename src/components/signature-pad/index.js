class Signature extends BaseComponent {
    tagName() {
        return 'signature';
    }

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/signature.min.css']);
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


        const id = `image-${this.getRandomInt()}`;
        imageId.push(`#${id}`);
        uiDiv.setAttribute('id', id);
        node.append(uiDiv);
    }
}

module.exports = InputImage;
