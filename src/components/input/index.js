// eslint-disable-next-line no-unused-vars
class Input extends BaseComponent {
    tagName() {
        return 'input';
    }

    getCssDependencies() {
        const baseDependencies = super.getCssDependencies();
        baseDependencies.push(['/css/input.css']);
        baseDependencies.push(['/css/checkbox.css']);
        return baseDependencies;
    }

    render() {
        const { node } = this;

        const uiDiv = document.createElement('div');
        const inputDiv = document.createElement('input');
        uiDiv.classList.add('ui');

        if (this.data['@type'] === 'text') {
            uiDiv.classList.add('input');
            uiDiv.append(inputDiv);

            if (this.data['@required']) {
                inputDiv.setAttribute('required', '');
            }

            inputDiv.setAttribute('type', 'text');
            inputDiv.setAttribute('placeholder', this.data['@placeholder']);
        } else if (this.data['@type'] === 'checkbox') {
            uiDiv.classList.add('checkbox');
            uiDiv.append(inputDiv);
            inputDiv.setAttribute('type', 'checkbox');

            if (this.data['@required']) {
                inputDiv.setAttribute('required', '');
            }

            if (this.data['@checked']) {
                inputDiv.setAttribute('checked', 'checked');
            }

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

            if (this.data['@required']) {
                inputDiv.setAttribute('required', '');
            }

            if (this.data['@checked']) {
                inputDiv.setAttribute('checked', 'checked');
            }

            if (this.data['@disabled']) {
                inputDiv.setAttribute('disabled', 'disabled');
            }

            const labelDiv = document.createElement('label');
            labelDiv.textContent = this.data['@title'];
            uiDiv.append(labelDiv);
        } else if (this.data['@type'] === 'slider') {
            uiDiv.classList.add('slider');
            uiDiv.classList.add('checkbox');
            uiDiv.append(inputDiv);
            inputDiv.setAttribute('type', 'checkbox');

            if (this.data['@required']) {
                inputDiv.setAttribute('required', '');
            }

            if (this.data['@checked']) {
                inputDiv.setAttribute('checked', 'checked');
            }

            if (this.data['@disabled']) {
                inputDiv.setAttribute('disabled', 'disabled');
            }

            const labelDiv = document.createElement('label');
            labelDiv.textContent = this.data['@title'];
            uiDiv.append(labelDiv);
        } else if (this.data['@type'] === 'toggle') {
            uiDiv.classList.add('toggle');
            uiDiv.classList.add('checkbox');
            uiDiv.append(inputDiv);
            inputDiv.setAttribute('type', 'checkbox');

            if (this.data['@required']) {
                inputDiv.setAttribute('required', '');
            }

            if (this.data['@checked']) {
                inputDiv.setAttribute('checked', 'checked');
            }

            if (this.data['@disabled']) {
                inputDiv.setAttribute('disabled', 'disabled');
            }

            const labelDiv = document.createElement('label');
            labelDiv.textContent = this.data['@title'];
            uiDiv.append(labelDiv);
        } else {
            uiDiv.classList.add('input');
            uiDiv.append(inputDiv);

            if (this.data['@required']) {
                inputDiv.setAttribute('required', '');
            }

            inputDiv.setAttribute('type', this.data['@type']);
            inputDiv.setAttribute('placeholder', this.data['@title']);
        }

        node.append(uiDiv);
    }
}
