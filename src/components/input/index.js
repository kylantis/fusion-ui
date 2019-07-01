
class Input extends BaseComponent {
    tagName() {
        return 'input';
    }

    getCssDependencies() {
        if (this.data['@type'] === 'radio' || this.data['@type'] === 'checkbox'
            || this.data['@type'] === 'boolean') {
            return super.getCssDependencies().concat(['/assets/css/input.min.css', '/assets/css/checkbox.min.css']);
        }
        if (this.data['@type'] === 'signature') {
            return (['/assets/css/input-signature.min.css']);
        }
        return super.getCssDependencies().concat(['/assets/css/input.min.css']);
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

    setCheckedInput() {

    }

    getCheckedInput(element) {
        return $(element).attr('checked');
    }

    getInputValue(element) {
        console.log(element.val());
        return $(element).val();
    }

    setInputValue(element, value) {
        return $(element).val(value);
    }

    validate(element, value) {
        // pass in the element to be validated and pass in the conditions to pass
        // return true or false
        if (value) {
            console.log(`${element} valid`);
            return true;
        }
        console.log(`${element} invalid`);
        return false;
    }

    render() {
        const { node } = this;
        const inputId = [];
        const uiDiv = document.createElement('div');
        const inputDiv = document.createElement('input');
        uiDiv.classList.add('ui');

        if (this.data['@type'] === 'plain') {
            uiDiv.classList.add('input');
            uiDiv.append(inputDiv);
            this.required(inputDiv);

            inputDiv.setAttribute('type', 'text');
            inputDiv.setAttribute('placeholder', this.data['@placeholder']);
            const label = document.createElement('label');
            label.className = 'error';
            uiDiv.appendChild(label);
            label.innerHTML = 'invalid input';
            // Button added for testing get value
            // eslint-disable-next-line func-names
            $(function () {
                $('.error').hide();
                $(this).on('submit', () => {
                    if (inputDiv.value === '') {
                        $('.error').show();
                        $(inputDiv).focus();
                        return false;
                    }
                    this.getInputValue(inputDiv);
                    return true;
                });
            });
        } else if (this.data['@type'] === 'secret') {
            uiDiv.classList.add('input');
            uiDiv.append(inputDiv);
            this.required(inputDiv);
            inputDiv.setAttribute('type', 'password');
            inputDiv.setAttribute('placeholder', this.data['@placeholder']);
            // Get data from the subcomponent
            this.getInputValue(inputDiv);
        } else if (this.data['@type'] === 'email') {
            uiDiv.classList.add('input');
            uiDiv.append(inputDiv);
            this.required(inputDiv);
            inputDiv.setAttribute('type', 'email');
            inputDiv.setAttribute('placeholder', this.data['@placeholder']);
            inputDiv.setAttribute('pattern', '[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$');
            // Get data from the subcomponent
            this.getInputValue(inputDiv);
        } else if (this.data['@type'] === 'amount') {
            uiDiv.classList.add('input');
            uiDiv.append(inputDiv);
            this.required(inputDiv);
            inputDiv.setAttribute('type', 'number');
            inputDiv.setAttribute('step', '0.01');
            inputDiv.setAttribute('placeholder', this.data['@placeholder']);
            // Get data from the subcomponent
            this.getInputValue(inputDiv);
        } else if (this.data['@type'] === 'number2l' || this.data['@type'] === 'number3l'
                    || this.data['@type'] === 'number4l' || this.data['@type'] === 'number') {
            uiDiv.classList.add('input');
            uiDiv.append(inputDiv);
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
            inputDiv.setAttribute('type', 'number');
            inputDiv.setAttribute('placeholder', this.data['@placeholder']);
            // Get data from the subcomponent
            this.getInputValue(inputDiv);
        } else if (this.data['@type'] === 'phone') {
            uiDiv.classList.add('input');
            uiDiv.append(inputDiv);
            this.required(inputDiv);
            inputDiv.setAttribute('type', 'tel');
            inputDiv.setAttribute('pattern', '[0-9]*');
            inputDiv.setAttribute('placeholder', this.data['@placeholder']);
            // Get data from the subcomponent
            this.getInputValue(inputDiv);
            const buttonDiv = document.createElement('button');
            buttonDiv.innerHTML = 'submit';
            uiDiv.appendChild(buttonDiv);
            $(buttonDiv).on('click', () => {
                console.log(this.getInputValue(inputDiv));
            });
        } else if (this.data['@type'] === 'image') {
            uiDiv.classList.add('input');
            uiDiv.append(inputDiv);
            inputDiv.setAttribute('type', 'file');
            inputDiv.setAttribute('accept', 'image/*');
            this.required(inputDiv);
        } else if (this.data['@type'] === 'signature') {
            const canvaDiv = document.createElement('canvas');
            const submitButton = document.createElement('button');
            const eraseButton = document.createElement('button');
            uiDiv.appendChild(canvaDiv);
            canvaDiv.setAttribute('width', this.data['@canvaWidth']);
            canvaDiv.setAttribute('height', this.data['@canvaHeight']);
            canvaDiv.className = 'js-paint paint-canvas';
            canvaDiv.setAttribute('id', 'signature-pad');
            submitButton.setAttribute('id', 'save');
            eraseButton.setAttribute('id', 'clear');
            submitButton.className = 'button submit';
            eraseButton.className = 'button erase';
            submitButton.innerHTML = 'Submit';
            eraseButton.innerHTML = 'Clear';
            uiDiv.appendChild(submitButton);
            uiDiv.appendChild(eraseButton);

            $(canvaDiv).ready(() => {
                const paintCanvas = document.getElementById('signature-pad');
                const context = paintCanvas.getContext('2d');
                const backgroundColor = '#fff';
                context.lineCap = 'round';
                context.strokeStyle = '#000';
                context.lineWidth = 2;
                context.fillStyle = backgroundColor;
                context.fillRect(0, 0, canvaDiv.width, canvaDiv.height);

                let x = 0;
                let y = 0;
                let userInput = false;
                let isMouseDown = false;
                const stopDrawing = () => { isMouseDown = false; };
                const startDrawing = (event) => {
                    isMouseDown = true;
                    [x, y] = [event.offsetX, event.offsetY];
                    userInput = true;
                };
                const drawLine = (event) => {
                    if (isMouseDown) {
                        const newX = event.offsetX;
                        const newY = event.offsetY;
                        context.beginPath();
                        context.moveTo(x, y);
                        context.lineTo(newX, newY);
                        context.stroke();
                        [x, y] = [newX, newY];
                        userInput = true;
                    }
                };
                paintCanvas.addEventListener('mousedown', startDrawing);
                paintCanvas.addEventListener('mousemove', drawLine);
                paintCanvas.addEventListener('mouseup', stopDrawing);
                paintCanvas.addEventListener('mouseout', stopDrawing);
                $('#clear').on('click', () => {
                    userInput = false;
                    context.fillStyle = backgroundColor;
                    context.clearRect(0, 0, canvaDiv.width, canvaDiv.height);
                    context.fillRect(0, 0, canvaDiv.width, canvaDiv.height);
                });
                $('#save').on('click', () => {
                    if (userInput) {
                        const signatureImage = paintCanvas.toDataURL('image/jpeg', 0.5);
                        console.log(signatureImage);
                        this.validate(this.data['@type'], true);
                    } else {
                        this.validate(this.data['@type'], false);
                    }
                });
            });
        } else if (this.data['@type'] === 'radio' || this.data['@type'] === 'checkbox') {
            uiDiv.className = 'ui form';
            const alignmentDiv = document.createElement('div');
            alignmentDiv.classList.add(this.data['@alignment']);
            alignmentDiv.classList.add('fields');
            uiDiv.appendChild(alignmentDiv);
            const labelDiv = document.createElement('label');
            labelDiv.textContent = this.data['@title'];
            alignmentDiv.appendChild(labelDiv);
            const dataValues = this.data['>'];
            if (dataValues.length > 0) {
                dataValues.forEach((data) => {
                    const fieldDiv = document.createElement('div');
                    fieldDiv.className = 'field';
                    const innerUiDiv = document.createElement('div');
                    innerUiDiv.className = `ui ${this.data['@type']} checkbox`;
                    fieldDiv.appendChild(innerUiDiv);
                    const InnerInputDiv = document.createElement('input');
                    InnerInputDiv.type = this.data['@type'];
                    InnerInputDiv.name = data['@name'];
                    innerUiDiv.appendChild(InnerInputDiv);
                    const innerLabel = document.createElement('label');
                    innerLabel.textContent = data['@value'];
                    innerUiDiv.appendChild(innerLabel);
                    alignmentDiv.appendChild(fieldDiv);
                });
            }
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
        } else {
            uiDiv.classList.add('input');
            uiDiv.append(inputDiv);

            this.required(inputDiv);

            inputDiv.setAttribute('type', this.data['@type']);
            inputDiv.setAttribute('placeholder', this.data['@placeholder']);
        }

        const id = `input-${this.getRandomInt()}`;
        inputId.push(`#${id}`);
        uiDiv.setAttribute('id', id);
        node.append(uiDiv);
    }
}

module.exports = Input;
