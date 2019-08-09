
class Input extends BaseComponent {
    tagName() {
        return 'input';
    }

    #componentId = this.getId();

    getCssDependencies() {
        return super.getCssDependencies().concat(['/assets/css/input.min.css', '/assets/css/label.min.css']);
    }

    getJsDependencies() {
        return super.getJsDependencies();
    }

    behaviorNames() {
        return ['validate', 'getValue', 'setValue', 'clearField'];
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

    checked(element) {
        if (this.data['@checked']) {
            element.setAttribute('checked', '');
            return true;
        }
        return false;
    }

    disabled(element) {
        if (this.data['@disabled']) {
            element.setAttribute('disabled', '');
            return true;
        }
        return false;
    }

    getCheckedInput(element) {
        return $(element).attr('checked');
    }

    invokeBehavior(behavior, element, data) {
        switch (behavior) {
        case 'getValue':
            return $(element).val();

        case 'setValue':
            $(element).val(data);
            break;

        default:
            break;
        }
        return false;
    }

    getValue(element) {
        this.invokeBehavior('setValue', element, null);
    }

    setValue(element, value) {
        this.invokeBehavior('setValue', element, value);
    }

    validateEntry(element) {
        // pass in the element to be validated and pass in the conditions to pass
        // return true or false
        if ($(element).val() === '') {
            console.log('Invalid Entry');
            if (!element.checkValidity()) {
                this.errorLabel(element);
            }
            return false;
        }
        console.log($(element).val());
        return true;
    }

    errorLabel(element) {
        const label = document.createElement('div');
        label.className = 'ui pointing label';
        $(element).after(label);
        label.textContent = 'Please enter a value';
    }

    inputCallback(inputEl) {
        $(inputEl).on('focusout', () => {
            if (this.validateEntry(inputEl)) {
                this.getValue(inputEl);
            }
        });
    }

    render() {
        const { node } = this;
        let uiDiv = document.createElement('div');
        const inputDiv = document.createElement('input');
        uiDiv.classList.add('ui');
        const inputId = [];

        if (this.data['@type'] === 'text') {
            uiDiv.classList.add('input');
            uiDiv.append(inputDiv);
            this.required(inputDiv);
            inputDiv.setAttribute('type', 'text');
            inputDiv.setAttribute('placeholder', this.data['@placeholder']);
            this.inputCallback(inputDiv);
        } else if (this.data['@type'] === 'secret') {
            uiDiv.classList.add('input');
            uiDiv.append(inputDiv);
            this.required(inputDiv);
            inputDiv.setAttribute('type', 'password');
            inputDiv.setAttribute('placeholder', this.data['@placeholder']);
            // Get data from the subcomponent
            this.inputCallback(inputDiv);
        } else if (this.data['@type'] === 'email') {
            uiDiv.classList.add('input');
            uiDiv.append(inputDiv);
            this.required(inputDiv);
            inputDiv.setAttribute('type', 'email');
            inputDiv.setAttribute('placeholder', this.data['@placeholder']);
            inputDiv.setAttribute('pattern', '[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$');
            // Get data from the subcomponent'
            this.inputCallback(inputDiv);
        } else if (this.data['@type'] === 'amount') {
            uiDiv.classList.add('input');
            uiDiv.append(inputDiv);
            this.required(inputDiv);
            inputDiv.setAttribute('type', 'number');
            inputDiv.setAttribute('step', '0.01');
            inputDiv.setAttribute('placeholder', this.data['@placeholder']);
            // Get data from the subcomponent
            this.inputCallback(inputDiv);
        } else if (this.data['@type'] === 'number2l' || this.data['@type'] === 'number3l'
            || this.data['@type'] === 'number4l' || this.data['@type'] === 'number') {
            uiDiv.classList.add('input');
            uiDiv.append(inputDiv);
            inputDiv.setAttribute('type', 'number');
            inputDiv.setAttribute('placeholder', this.data['@placeholder']);
            this.required(inputDiv);
            if (this.data['@type'] === 'number2l') {
                inputDiv.setAttribute('min', '-99');
                inputDiv.setAttribute('max', '99');
            } else if (this.data['@type'] === 'number3l') {
                inputDiv.setAttribute('min', '-999');
                inputDiv.setAttribute('max', '999');
            } else if (this.data['@type'] === 'number4l') {
                inputDiv.setAttribute('min', '-9999');
                inputDiv.setAttribute('max', '9999');
            }
            this.inputCallback(inputDiv);
        } else if (this.data['@type'] === 'phone') {
            uiDiv.classList.add('input');
            uiDiv.append(inputDiv);
            this.required(inputDiv);
            inputDiv.setAttribute('type', 'tel');
            inputDiv.setAttribute('pattern', '[0-9]*');
            inputDiv.setAttribute('placeholder', this.data['@placeholder']);
            // Get data from the subcomponent
            this.inputCallback(inputDiv);
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
        } else if (this.data['@type'] === 'boolean') {
            uiDiv.classList.add('toggle');
            uiDiv.classList.add('checkbox');
            uiDiv.append(inputDiv);
            inputDiv.setAttribute('type', 'checkbox');

            this.required(inputDiv);
            this.disabled(inputDiv);
            this.checked(inputDiv);

            const labelDiv = document.createElement('label');
            labelDiv.textContent = this.data['@title'];
            uiDiv.appendChild(labelDiv);
        } else if (this.data['@type'] === 'date') {
            uiDiv.classList.add('input');
            uiDiv.append(inputDiv);
            inputDiv.setAttribute('type', 'date');

            this.required(inputDiv);
            this.disabled(inputDiv);
            this.inputCallback(inputDiv);
        } else if (this.data['@type'] === 'hidden') {
            uiDiv.classList.add('input');
            uiDiv.append(inputDiv);
            inputDiv.setAttribute('type', 'hidden');
        } else if (this.data['@type'] === 'textarea') {
            uiDiv = document.createElement('textarea');
            uiDiv.classList.add('ui');
            uiDiv.classList.add('input');
            this.required(uiDiv);
            this.disabled(uiDiv);
            if (this.data['@rows']) {
                uiDiv.setAttribute('rows', this.data['@rows']);
            }
            if (this.data['@cols']) {
                uiDiv.setAttribute('cols', this.data['@cols']);
            }
            uiDiv.setAttribute('placeholder', this.data['@placeholder']);
            this.inputCallback(uiDiv);
        }
        inputDiv.id = this.getComponentId();
        inputId.push(`#${inputDiv.getAttribute('id')}`);
        node.append(uiDiv);
    }
}

module.exports = Input;
