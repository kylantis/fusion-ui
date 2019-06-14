// eslint-disable-next-line no-unused-vars
class Input extends BaseComponent {
    tagName() {
        return 'input';
    }

    getCssDependencies() {
        const baseDependencies = super.getCssDependencies();
        baseDependencies.push('/assets/css/input.min.css');
        if (this.data['@type'] === 'radio' || this.data['@type'] === 'checkbox') {
            baseDependencies.push('/assets/css/checkbox.min.css');
        }
        return baseDependencies;
    }

    required(element) {
        if (this.data['@required']) {
            element.setAttribute('required', '');
        }
    }

    checked(element) {
        if (this.data['@checked']) {
            element.setAttribute('required', '');
        }
    }

    disabled(element) {
        if (this.data['@disabled']) {
            element.setAttribute('disabled', '');
        }
    }

    render() {
        const { node } = this;

        const uiDiv = document.createElement('div');
        const inputDiv = document.createElement('input');
        uiDiv.classList.add('ui');

        if (this.data['@type'] === 'text') {
            uiDiv.classList.add('input');
            uiDiv.append(inputDiv);

            this.required(inputDiv);

            inputDiv.setAttribute('type', 'text');
            inputDiv.setAttribute('placeholder', this.data['@placeholder']);
        } else if (this.data['@type'] === 'checkbox') {
            uiDiv.classList.add('checkbox');
            uiDiv.append(inputDiv);
            inputDiv.setAttribute('type', 'checkbox');

            this.required(inputDiv);
            this.disabled(inputDiv);
            this.checked(inputDiv);

            if (this.data['@disabled']) {
                inputDiv.setAttribute('disabled', 'disabled');
            }

            const labelDiv = document.createElement('label');
            labelDiv.textContent = this.data['@title'];
            uiDiv.append(labelDiv);
        } else if (this.data['@type'] === 'radio') {
            uiDiv.classList.add('radio');
            uiDiv.classList.add('checkbox');
            uiDiv.append(inputDiv);
            inputDiv.setAttribute('type', 'radio');

            this.required(inputDiv);
            this.disabled(inputDiv);
            this.checked(inputDiv);

            const labelDiv = document.createElement('label');
            labelDiv.textContent = this.data['@title'];
            uiDiv.append(labelDiv);
        } else if (this.data['@type'] === 'slider') {
            uiDiv.classList.add('slider');
            uiDiv.classList.add('checkbox');
            uiDiv.append(inputDiv);
            inputDiv.setAttribute('type', 'checkbox');

            this.required(inputDiv);
            this.disabled(inputDiv);
            this.checked(inputDiv);

            const labelDiv = document.createElement('label');
            labelDiv.textContent = this.data['@title'];
            uiDiv.append(labelDiv);
        } else if (this.data['@type'] === 'toggle') {
            uiDiv.classList.add('toggle');
            uiDiv.classList.add('checkbox');
            uiDiv.append(inputDiv);
            inputDiv.setAttribute('type', 'checkbox');

            this.required(inputDiv);
            this.disabled(inputDiv);
            this.checked(inputDiv);

            const labelDiv = document.createElement('label');
            labelDiv.textContent = this.data['@title'];
            uiDiv.append(labelDiv);
        } else {
            uiDiv.classList.add('input');
            uiDiv.append(inputDiv);

            this.required(inputDiv);

            inputDiv.setAttribute('type', this.data['@type']);
            inputDiv.setAttribute('placeholder', this.data['@placeholder']);
        }

        node.append(uiDiv);
    }
}
